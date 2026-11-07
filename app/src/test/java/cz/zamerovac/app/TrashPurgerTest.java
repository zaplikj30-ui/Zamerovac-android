package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class TrashPurgerTest {
    File home,cache;SharedPreferences prefs;TrashPurger purger;
    @Before public void setup() throws Exception {
        Context c=RuntimeEnvironment.getApplication();home=Files.createTempDirectory(c.getFilesDir().toPath(),"trash-test-").toFile();
        cache=Files.createTempDirectory(c.getCacheDir().toPath(),"trash-test-").toFile();
        new File(home,"media").mkdirs();new File(cache,"photo-thumbs").mkdirs();
        prefs=c.getSharedPreferences(UUID.randomUUID().toString(),0);purger=new TrashPurger(home,cache,prefs);
    }
    JSONObject fixture() throws Exception {
        return new JSONObject("{\"schema\":1,\"records\":["+
            "{\"id\":\"active\",\"locked\":true,\"items\":[{\"measure\":\"1250,123456789\",\"unit\":\"in\",\"detailItems\":[{\"media\":[\"shared-media\"]}]}],\"history\":{\"futureField\":\"history-photo\"},\"media\":[\"active-media\"]},"+
            "{\"id\":\"deleted-folder\",\"kind\":\"folder\",\"deleted\":true},"+
            "{\"id\":\"deleted-photo\",\"deleted\":true,\"parentId\":\"deleted-folder\",\"media\":[\"trash-media\",\"shared-media\",\"history-photo\",\"../outside\"],\"items\":[{\"media\":[\"note-audio\"],\"detailItems\":[{\"media\":[\"detail-photo\"]}]}]},"+
            "{\"id\":\"active-child\",\"parentId\":\"deleted-folder\",\"media\":[\"child-media\"]}]}");
    }
    void file(String id) throws Exception {Files.write(new File(home,"media/"+id).toPath(),new byte[]{1,2,3});prefs.edit().putString("mime-"+id,"image/png").putString("name-"+id,id).commit();}
    void persist(String text) throws Exception {Files.write(new File(home,"projects.json").toPath(),text.getBytes(StandardCharsets.UTF_8));}
    String read(File file) throws Exception{return new String(Files.readAllBytes(file.toPath()),StandardCharsets.UTF_8);}
    JSONArray targets() throws Exception{return new JSONArray("[\"deleted-folder\",\"deleted-photo\"]");}
    @Test public void purgeRemovesOnlyDeletedRecordsAndExclusiveNestedMediaAndSurvivesRestart() throws Exception {
        JSONObject db=fixture();db.getJSONArray("records").getJSONObject(2).getJSONArray("media").put("deleted-photo");String active=db.getJSONArray("records").getJSONObject(0).toString();
        for(String id:new String[]{"active-media","shared-media","history-photo","trash-media","note-audio","detail-photo","child-media","unrelated","deleted-photo"})file(id);
        File thumb=new File(cache,"photo-thumbs/trash-media.jpg");Files.write(thumb.toPath(),new byte[]{5});
        File temporaryThumb=new File(cache,"photo-thumbs/trash-media.tmp");Files.write(temporaryThumb.toPath(),new byte[]{6});
        persist(db.toString());JSONObject result=purger.purge(db.toString(),db.toString(),targets(),this::persist);
        assertEquals(0,result.getInt("pending"));assertEquals("",result.getString("warning"));
        JSONObject reloaded=new JSONObject(read(new File(home,"projects.json")));
        assertEquals(2,reloaded.getJSONArray("records").length());
        assertEquals(active,reloaded.getJSONArray("records").getJSONObject(0).toString());
        assertEquals("active-child",reloaded.getJSONArray("records").getJSONObject(1).getString("id"));
        assertEquals(reloaded.toString(),read(new File(home,"projects.bak")));
        for(String id:new String[]{"active-media","shared-media","history-photo","child-media","unrelated"})assertTrue(id,new File(home,"media/"+id).isFile());
        for(String id:new String[]{"trash-media","note-audio","detail-photo","deleted-photo"}){assertFalse(new File(home,"media/"+id).exists());assertFalse(prefs.contains("mime-"+id));}
        assertFalse(thumb.exists());assertFalse(temporaryThumb.exists());assertEquals(0,new TrashPurger(home,cache,prefs).pendingCount());
        // Safe repeated empty purge; no broad media garbage collection.
        purger.purge(reloaded.toString(),reloaded.toString(),new JSONArray(),this::persist);
        assertTrue(new File(home,"media/unrelated").isFile());
    }
    @Test public void staleSnapshotOrRestoredRecordCannotDeleteAnything() throws Exception {
        String db=fixture().toString();file("trash-media");persist(db);
        try{purger.purge(db,db+" ",targets(),this::persist);fail();}catch(IOException expected){}
        try{purger.purge(db,db,new JSONArray("[\"active\"]"),this::persist);fail();}catch(IOException expected){}
        assertEquals(db,read(new File(home,"projects.json")));assertTrue(new File(home,"media/trash-media").exists());
    }
    @Test public void failedDatabaseWriteLeavesAllMediaAndRecordsRecoverable() throws Exception {
        String db=fixture().toString();persist(db);file("trash-media");
        try{purger.purge(db,db,targets(),text->{throw new IOException("disk full");});fail();}catch(IOException expected){}
        assertEquals(db,read(new File(home,"projects.json")));assertTrue(new File(home,"media/trash-media").exists());
        assertTrue(new TrashPurger(home,cache,prefs).pendingCount()>0);
        purger.purge(db,db,targets(),this::persist);assertFalse(new File(home,"media/trash-media").exists());
    }
    @Test public void failedUnlinkIsReportedAndRetryableAfterRestart() throws Exception {
        String db=fixture().toString();persist(db);file("trash-media");
        TrashPurger failing=new TrashPurger(home,cache,prefs,f->false);
        JSONObject result=failing.purge(db,db,targets(),this::persist);
        assertEquals(1,result.getInt("pending"));assertFalse(result.getString("warning").isEmpty());
        assertTrue(new File(home,"media/trash-media").isFile());
        String saved=read(new File(home,"projects.json"));
        result=new TrashPurger(home,cache,prefs).purge(saved,saved,new JSONArray(),this::persist);
        assertEquals(0,result.getInt("pending"));assertFalse(new File(home,"media/trash-media").exists());
    }
    @Test public void failedBackupWriteNeverUnlinksMedia() throws Exception {
        String db=fixture().toString();persist(db);file("trash-media");
        // A nonempty directory cannot be atomically replaced by a backup file.
        File backup=new File(home,"projects.bak");backup.mkdirs();Files.write(new File(backup,"blocker").toPath(),new byte[]{1});
        JSONObject result=purger.purge(db,db,targets(),this::persist);
        assertFalse(result.getString("warning").isEmpty());assertTrue(new File(home,"media/trash-media").exists());
    }
    @Test public void pendingCleanupCannotDeleteMediaReusedByActiveRecord() throws Exception {
        String db=fixture().toString();file("trash-media");
        JSONObject result=new TrashPurger(home,cache,prefs,f->false).purge(db,db,targets(),this::persist);
        JSONObject updated=result.getJSONObject("data");updated.getJSONArray("records").getJSONObject(0).put("media",new JSONArray("[\"trash-media\"]"));
        purger.purge(updated.toString(),updated.toString(),new JSONArray(),this::persist);
        assertTrue(new File(home,"media/trash-media").exists());
    }
    @Test public void restartedCleanupKeepsExactBytesReusedByNoteHistory() throws Exception {
        String db=fixture().toString();file("trash-media");file("note-audio");
        byte[] original=Files.readAllBytes(new File(home,"media/trash-media").toPath());
        byte[] audio=Files.readAllBytes(new File(home,"media/note-audio").toPath());
        // The unlink failed; retry will run after restart, when another owner may
        // already need the same immutable IDs. Do not replace this with broad GC.
        JSONObject result=new TrashPurger(home,cache,prefs,f->false).purge(db,db,targets(),this::persist);
        assertTrue(result.getInt("pending")>0);
        JSONObject next=result.getJSONObject("data");
        next.getJSONArray("records").getJSONObject(0).put("versionHistory",new JSONArray()
            .put(new JSONObject().put("items","[{\"media\":[\"trash-media\"],\"audioMedia\":[\"note-audio\"]}]")));
        persist(next.toString());
        new TrashPurger(home,cache,prefs).purge(next.toString(),next.toString(),new JSONArray(),this::persist);
        assertArrayEquals(original,Files.readAllBytes(new File(home,"media/trash-media").toPath()));
        assertArrayEquals(audio,Files.readAllBytes(new File(home,"media/note-audio").toPath()));
        assertEquals("image/png",prefs.getString("mime-trash-media",null));
        assertEquals("image/png",prefs.getString("mime-note-audio",null));
    }
    @Test public void purgeKeepsSharedOriginalsReferencedInsideSerializedJsonObjects() throws Exception {
        JSONObject db=fixture();
        JSONObject active=db.getJSONArray("records").getJSONObject(0);
        // A legacy entry contains a JSON OBJECT string instead of the already-tested
        // JSON ARRAY string. Recursively nested object-encoded text is realistic
        // for imported snapshots and future fields unknown to this app version.
        active.put("packedSnapshot",new JSONObject()
            .put("history",new JSONObject().put("nested",new JSONArray().put(
                new JSONObject().put("media",new JSONArray().put("trash-media")))))
            .put("otherLegacy",new JSONObject().put("text",new JSONObject()
                .put("audioMedia",new JSONArray().put("note-audio")).toString()))
            .toString());
        for(String id:new String[]{"trash-media","note-audio","detail-photo"})file(id);
        byte[] protectedPhoto=Files.readAllBytes(new File(home,"media/trash-media").toPath());
        byte[] protectedAudio=Files.readAllBytes(new File(home,"media/note-audio").toPath());
        persist(db.toString());
        JSONObject result=purger.purge(db.toString(),db.toString(),targets(),this::persist);
        assertEquals(0,result.getInt("pending"));
        assertArrayEquals(protectedPhoto,Files.readAllBytes(new File(home,"media/trash-media").toPath()));
        assertArrayEquals(protectedAudio,Files.readAllBytes(new File(home,"media/note-audio").toPath()));
        assertTrue(prefs.contains("mime-trash-media"));
        assertTrue(prefs.contains("mime-note-audio"));
        assertFalse("Exclusively deleted original must still be cleaned",new File(home,"media/detail-photo").exists());
        assertEquals(active.toString(),new JSONObject(read(new File(home,"projects.json")))
            .getJSONArray("records").getJSONObject(0).toString());
        // Repeated cleanup after restart must not delete these originals.
        String stable=read(new File(home,"projects.json"));
        new TrashPurger(home,cache,prefs).purge(stable,stable,new JSONArray(),this::persist);
        assertArrayEquals(protectedPhoto,Files.readAllBytes(new File(home,"media/trash-media").toPath()));
        assertArrayEquals(protectedAudio,Files.readAllBytes(new File(home,"media/note-audio").toPath()));
    }
    @Test public void pendingCleanupMustRecheckSerializedObjectReferencesAfterRestart() throws Exception {
        String db=fixture().toString();
        file("trash-media");
        JSONObject result=new TrashPurger(home,cache,prefs,f->false)
            .purge(db,db,targets(),this::persist);
        assertTrue(result.getInt("pending")>0);
        JSONObject changed=result.getJSONObject("data");
        changed.getJSONArray("records").getJSONObject(0).put("legacyJson",
            new JSONObject().put("deep",new JSONObject()
                .put("media",new JSONArray().put("trash-media"))).toString());
        persist(changed.toString());
        String now=changed.toString();
        new TrashPurger(home,cache,prefs).purge(now,now,new JSONArray(),this::persist);
        assertTrue("Pending cleanup after reboot must preserve newly referenced original",
            new File(home,"media/trash-media").isFile());
        assertEquals(0,new TrashPurger(home,cache,prefs).pendingCount());
    }
    @Test public void excessiveCombinedDepthAbortsPurgeWithoutDeletingOriginals() throws Exception {
        // The outer 45 levels and the embedded 65 levels are EACH within the
        // JsonInput limit, but their combined reference traversal is not.
        JSONObject inner=new JSONObject().put("media",new JSONArray().put("trash-media"));
        for(int i=0;i<65;i++)inner=new JSONObject().put("next",inner);
        JSONObject outer=new JSONObject().put("embedded",inner.toString());
        for(int i=0;i<45;i++)outer=new JSONObject().put("next",outer);
        JSONObject db=fixture();
        db.getJSONArray("records").getJSONObject(0).put("legacyHistory",outer);
        String saved=db.toString();persist(saved);file("trash-media");
        byte[] original=Files.readAllBytes(new File(home,"media/trash-media").toPath());
        try{
            purger.purge(saved,saved,targets(),this::persist);
            fail("Overdeep nested media references were allowed into cleanup");
        }catch(IOException expected){
            assertTrue(expected.getMessage().contains("příloh")||expected.getMessage().contains("zanořen"));
        }
        assertEquals(saved,read(new File(home,"projects.json")));
        assertArrayEquals(original,Files.readAllBytes(new File(home,"media/trash-media").toPath()));
        assertTrue(prefs.contains("mime-trash-media"));
        assertEquals(0,new TrashPurger(home,cache,prefs).pendingCount());
    }
    @Test public void invalidStructuredHistoryAbortsPurgeInsteadOfDiscardingPossibleReference() throws Exception {
        JSONObject db=fixture();
        db.getJSONArray("records").getJSONObject(0).put("legacyHistory",
            "{unfinished \"media\": [\"trash-media\"]");
        String saved=db.toString();persist(saved);file("trash-media");
        try{
            purger.purge(saved,saved,targets(),this::persist);
            fail("Invalid structured history was silently discarded");
        }catch(IOException expected){}
        assertEquals(saved,read(new File(home,"projects.json")));
        assertTrue(new File(home,"media/trash-media").isFile());
        assertTrue(prefs.contains("mime-trash-media"));
        assertEquals(0,new TrashPurger(home,cache,prefs).pendingCount());
    }
    @Test public void nativeBridgeChecksDiskSnapshotAndKeepsLegacyUnsavedDefaults() throws Exception {
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).get();
        java.lang.reflect.Field field=MainActivity.class.getDeclaredField("settings");field.setAccessible(true);field.set(activity,prefs);
        String saved=fixture().toString();File db=new File(activity.getFilesDir(),"projects.json");
        Files.write(db.toPath(),saved.getBytes(StandardCharsets.UTF_8));
        MainActivity.JsApi api=activity.new JsApi();
        JSONObject error=new JSONObject(api.purgeTrash(saved+" ",saved,targets().toString()));assertTrue(error.has("error"));assertEquals(saved,read(db));
        JSONObject desired=new JSONObject(saved).put("prefs",new JSONObject().put("unit","mm"));
        JSONObject result=new JSONObject(api.purgeTrash(saved,desired.toString(),targets().toString()));assertFalse(result.toString(),result.has("error"));
        assertEquals(2,new JSONObject(read(db)).getJSONArray("records").length());assertEquals(read(db),result.getString("snapshot"));
        // Replaying the same bridge request cannot overwrite newer records.
        assertTrue(new JSONObject(api.purgeTrash(saved,desired.toString(),targets().toString())).has("error"));
    }
    @Test public void backupExportAndRestoreAfterPurgeKeepActivePrecisionAndSharedMedia() throws Exception {
        MainActivity activity=Robolectric.buildActivity(MainActivity.class).get();
        java.lang.reflect.Field field=MainActivity.class.getDeclaredField("settings");field.setAccessible(true);field.set(activity,prefs);
        JSONObject original=fixture();String saved=original.toString();
        File mediaDir=new File(activity.getFilesDir(),"media");mediaDir.mkdirs();
        byte[] photo={11,22,33};
        for(String id:new String[]{"active-media","shared-media","child-media","trash-media"})Files.write(new File(mediaDir,id).toPath(),photo);
        Files.write(new File(activity.getFilesDir(),"projects.json").toPath(),saved.getBytes(StandardCharsets.UTF_8));
        JSONObject result=new JSONObject(activity.new JsApi().purgeTrash(saved,saved,targets().toString()));assertFalse(result.toString(),result.has("error"));
        java.lang.reflect.Method export=MainActivity.class.getDeclaredMethod("exportArchive",OutputStream.class,String.class);export.setAccessible(true);
        ByteArrayOutputStream bytes=new ByteArrayOutputStream();export.invoke(activity,bytes,null);
        Map<String,byte[]> entries=new HashMap<>();
        try(java.util.zip.ZipInputStream zip=new java.util.zip.ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()))){java.util.zip.ZipEntry entry;while((entry=zip.getNextEntry())!=null)entries.put(entry.getName(),zip.readAllBytes());}
        assertArrayEquals(photo,entries.get("media/shared-media"));assertArrayEquals(photo,entries.get("media/active-media"));assertFalse(entries.containsKey("media/trash-media"));
        JSONObject backed=new JSONObject(new String(entries.get("projects.json"),StandardCharsets.UTF_8));
        assertEquals(original.getJSONArray("records").getJSONObject(0).getJSONArray("items").toString(),backed.getJSONArray("records").getJSONObject(0).getJSONArray("items").toString());
        File archive=File.createTempFile("after-purge-", ".zip",activity.getCacheDir());Files.write(archive.toPath(),bytes.toByteArray());
        BackupImporter.Result restored=BackupImporter.importZip(activity,android.net.Uri.fromFile(archive),backed,prefs);
        assertEquals(5,restored.data.getJSONArray("records").length());
        JSONObject copied=restored.data.getJSONArray("records").getJSONObject(3).getJSONArray("items").getJSONObject(0);
        assertEquals("1250,123456789",copied.getString("measure"));assertEquals("in",copied.getString("unit"));
        String copiedPhoto=copied.getJSONArray("detailItems").getJSONObject(0).getJSONArray("media").getString(0);
        assertNotEquals("shared-media",copiedPhoto);assertArrayEquals(photo,Files.readAllBytes(new File(mediaDir,copiedPhoto).toPath()));
        assertEquals(backed.getJSONArray("records").getJSONObject(0).toString(),restored.data.getJSONArray("records").getJSONObject(0).toString());
    }
    @Test public void syncDoesNotResurrectPurgedTrashButPreservesRemoteActiveRecord() throws Exception {
        JSONObject original=fixture();String db=original.toString();
        JSONObject local=purger.purge(db,db,targets(),this::persist).getJSONObject("data");
        Context c=RuntimeEnvironment.getApplication();SyncEngine sync=new SyncEngine(c,prefs);
        java.lang.reflect.Method merge=SyncEngine.class.getDeclaredMethod("merge",JSONObject.class,JSONObject.class);merge.setAccessible(true);
        JSONObject merged=(JSONObject)merge.invoke(sync,local,original);
        assertEquals(2,merged.getJSONArray("records").length());
        original.getJSONArray("records").getJSONObject(2).put("deleted",false);
        merged=(JSONObject)merge.invoke(sync,local,original);assertEquals(3,merged.getJSONArray("records").length());
        String originalId=original.getJSONArray("records").getJSONObject(2).getString("id");boolean copy=false;for(int i=0;i<merged.getJSONArray("records").length();i++){JSONObject rec=merged.getJSONArray("records").getJSONObject(i);assertNotEquals(originalId,rec.getString("id"));if(originalId.equals(rec.optString("conflictOf")))copy=true;}assertTrue(copy);
    }
}
