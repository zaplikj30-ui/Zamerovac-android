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
        JSONObject db=fixture();String active=db.getJSONArray("records").getJSONObject(0).toString();
        for(String id:new String[]{"active-media","shared-media","history-photo","trash-media","note-audio","detail-photo","child-media","unrelated"})file(id);
        File thumb=new File(cache,"photo-thumbs/trash-media.jpg");Files.write(thumb.toPath(),new byte[]{5});
        persist(db.toString());JSONObject result=purger.purge(db.toString(),db.toString(),targets(),this::persist);
        assertEquals(0,result.getInt("pending"));assertEquals("",result.getString("warning"));
        JSONObject reloaded=new JSONObject(read(new File(home,"projects.json")));
        assertEquals(2,reloaded.getJSONArray("records").length());
        assertEquals(active,reloaded.getJSONArray("records").getJSONObject(0).toString());
        assertEquals("active-child",reloaded.getJSONArray("records").getJSONObject(1).getString("id"));
        assertEquals(reloaded.toString(),read(new File(home,"projects.bak")));
        for(String id:new String[]{"active-media","shared-media","history-photo","child-media","unrelated"})assertTrue(id,new File(home,"media/"+id).isFile());
        for(String id:new String[]{"trash-media","note-audio","detail-photo"}){assertFalse(new File(home,"media/"+id).exists());assertFalse(prefs.contains("mime-"+id));}
        assertFalse(thumb.exists());assertEquals(0,new TrashPurger(home,cache,prefs).pendingCount());
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
    @Test public void syncDoesNotResurrectPurgedTrashButPreservesRemoteActiveRecord() throws Exception {
        JSONObject original=fixture();String db=original.toString();
        JSONObject local=purger.purge(db,db,targets(),this::persist).getJSONObject("data");
        Context c=RuntimeEnvironment.getApplication();SyncEngine sync=new SyncEngine(c,prefs);
        java.lang.reflect.Method merge=SyncEngine.class.getDeclaredMethod("merge",JSONObject.class,JSONObject.class);merge.setAccessible(true);
        JSONObject merged=(JSONObject)merge.invoke(sync,local,original);
        assertEquals(2,merged.getJSONArray("records").length());
        original.getJSONArray("records").getJSONObject(2).put("deleted",false);
        merged=(JSONObject)merge.invoke(sync,local,original);assertEquals(3,merged.getJSONArray("records").length());
    }
}
