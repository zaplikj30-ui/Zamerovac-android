package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PendingAudioTest {
    static final byte[] ORIGINAL={0,1,2,3,4,5,20,40,80,(byte)255};
    static final String SHA="86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a";
    File home,media;SharedPreferences prefs;PendingAudio store;
    @Before public void setup()throws Exception{
        Context c=RuntimeEnvironment.getApplication();home=Files.createTempDirectory(c.getFilesDir().toPath(),"pending-audio-").toFile();media=new File(home,"media");
        prefs=c.getSharedPreferences(UUID.randomUUID().toString(),0);store=new PendingAudio(media,prefs);
    }
    static String readText(Path p)throws Exception{return new String(Files.readAllBytes(p),java.nio.charset.StandardCharsets.UTF_8);}
    static void writeText(Path p,String s)throws Exception{Files.write(p,s.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    AudioCapture.Recorder recorder(byte[] bytes){return new AudioCapture.Recorder(){public void start(File f)throws Exception{Files.write(f.toPath(),bytes);}public void stop(){}public void release(){}};}
    JSONObject completed(String id)throws Exception{JSONObject e=store.begin(id);Files.write(store.temporary(e).toPath(),ORIGINAL);store.complete(e);store.abandon(e);return e;}
    JSONObject note(String id)throws Exception{return new JSONObject().put("id","photo-one").put("kind","photo").put("media",new JSONArray().put("original-photo")).put("width",8000).put("items",new JSONArray().put(new JSONObject().put("id","note-one").put("media",new JSONArray().put(id)).put("audioMedia",new JSONArray().put(id)).put("measure","1250,123456789").put("unit","in")));}
    String db(JSONObject record)throws Exception{return new JSONObject().put("schema",1).put("records",new JSONArray().put(record)).toString();}
    File journal(JSONObject e)throws Exception{return new File(home,"pending-audio-v1/"+e.getString("token")+".json");}
    JSONObject entry(JSONObject e)throws Exception{return new JSONObject(new JSONObject(readText(journal(e).toPath())).getString("payload"));}
    void exact(File f)throws Exception{assertArrayEquals(ORIGINAL,Files.readAllBytes(f.toPath()));assertEquals(SHA,PeerMedia.inspect(f).getString("hash"));}
    @Test public void completedMetadataFailurePreservesExactBytes()throws Exception{
        SharedPreferences failed=mock(SharedPreferences.class);SharedPreferences.Editor edit=mock(SharedPreferences.Editor.class);
        when(failed.edit()).thenReturn(edit);when(edit.putString(anyString(),anyString())).thenReturn(edit);when(edit.commit()).thenReturn(false);
        AudioCapture capture=new AudioCapture(media,failed,()->recorder(ORIGINAL));assertTrue(capture.start("voice-failed"));
        try{capture.stop();fail("Metadata failure acknowledged");}catch(IOException expected){}
        capture.close();assertFalse(capture.active());exact(new File(media,"voice-failed"));
        JSONArray recovered=new PendingAudio(media,prefs).recoverPrimary();assertEquals(1,recovered.length());assertTrue(recovered.getJSONObject(0).getBoolean("available"));
        exact(new File(media,"voice-failed"));assertEquals("pending",recovered.getJSONObject(0).getString("state"));
        System.out.println("ORIGINAL_AND_RECOVERED_SHA256="+SHA+" EXACT_BYTES=10");
    }
    @Test public void boundRequiresExactDurableSnapshotAndNoteIdentityAndIsIdempotent()throws Exception{
        JSONObject e=completed("voice-one");String saved=db(note("voice-one"));
        assertFalse(new File(home,"projects.json").exists());assertEquals("pending",entry(e).getString("state"));
        LocalDatabase.write(home,saved);assertFalse(store.confirm(saved,"wrong-photo","note-one","voice-one"));
        assertFalse(store.confirm(saved,"photo-one","wrong-note","voice-one"));assertFalse(store.confirm(saved+" ","photo-one","note-one","voice-one"));
        assertTrue(store.confirm(saved,"photo-one","note-one","voice-one"));assertTrue(store.confirm(saved,"photo-one","note-one","voice-one"));
        byte[] before=Files.readAllBytes(journal(e).toPath());assertEquals(0,new PendingAudio(media,prefs).recoverPrimary().length());assertArrayEquals(before,Files.readAllBytes(journal(e).toPath()));
        assertEquals(saved,LocalDatabase.read(home));exact(new File(media,"voice-one"));
        // A subsequent CAS writer removes the binding; the old UI cannot bind it or restore old DB.
        String newer="{\"schema\":1,\"records\":[],\"sequence\":2}";LocalDatabase.write(home,newer);
        assertFalse(store.confirm(saved,"photo-one","note-one","voice-one"));assertEquals(1,store.recoverPrimary().length());assertEquals(newer,LocalDatabase.read(home));exact(new File(media,"voice-one"));
    }
    @Test public void faultsAtEveryDurabilityBoundaryKeepOriginalAndRecoveryIsRepeatable()throws Exception{
        for(String step:new String[]{"audio-sync","before-ledger","ledger-sync","after-ledger","after-complete","before-move","after-move","before-metadata","after-metadata"}){
            File dir=new File(home,step+"/media");PendingAudio normal=new PendingAudio(dir,prefs);JSONObject e=normal.begin("voice-boundary");Files.write(normal.temporary(e).toPath(),ORIGINAL);
            PendingAudio failing=new PendingAudio(dir,prefs,s->{if(step.equals(s))throw new IOException("synthetic ENOSPC/I/O at "+s);});
            try{failing.complete(e);fail("Fault not reached: "+step);}catch(IOException expected){}normal.abandon(e);
            exact(normal.temporary(e));JSONArray first=new PendingAudio(dir,prefs).recoverPrimary();JSONArray again=new PendingAudio(dir,prefs).recoverPrimary();
            assertEquals(step,first.toString(),again.toString());assertEquals(1,again.length());exact(normal.temporary(e));
            if(new File(dir,"voice-boundary").exists())exact(new File(dir,"voice-boundary"));
        }
    }
    @Test public void restartBetweenJournalAndPublicationRecoversCompletedBytes()throws Exception{
        JSONObject e=store.begin("voice-crash");Files.write(store.temporary(e).toPath(),ORIGINAL);
        PendingAudio crash=new PendingAudio(media,prefs,s->{if(s.equals("after-complete"))throw new IOException("power cut");});
        try{crash.complete(e);fail();}catch(IOException expected){}store.abandon(e);
        assertFalse(new File(media,"voice-crash").exists());assertEquals(1,new PendingAudio(media,prefs).recoverPrimary().length());exact(new File(media,"voice-crash"));
    }
    @Test public void corruptMissingAndAtomicBackupJournalNeverHideOrDeleteOriginals()throws Exception{
        JSONObject e=completed("voice-corrupt");File file=journal(e);byte[] good=Files.readAllBytes(file.toPath());
        writeText(file.toPath(),"{broken");JSONArray bad=store.recoverPrimary();assertEquals("needs-review",bad.getJSONObject(0).getString("state"));assertFalse(bad.getJSONObject(0).getBoolean("available"));exact(store.temporary(e));
        assertEquals("{broken",readText(file.toPath()));assertTrue(store.protects("unrelated-unknown"));
        Files.write(new File(file+".bak").toPath(),good);assertTrue(store.recoverPrimary().getJSONObject(0).getBoolean("available"));
        Files.delete(file.toPath());assertEquals("needs-review",store.recoverPrimary().getJSONObject(0).getString("state"));exact(new File(media,"voice-corrupt"));
        writeText(new File(file+".bak").toPath(),"broken backup");assertEquals("needs-review",store.recoverPrimary().getJSONObject(0).getString("state"));exact(store.temporary(e));
    }
    @Test public void ledgerPathAndAudioSymlinksAreRejectedWithoutTouchingTargets()throws Exception{
        File outside=new File(home,"outside");Files.write(outside.toPath(),ORIGINAL);media.mkdirs();
        Files.createSymbolicLink(new File(media,"voice-link").toPath(),outside.toPath());
        try{store.begin("voice-link");fail();}catch(IOException expected){}exact(outside);
        for(String id:new String[]{"../outside","a/b","bad.id","","xx"})try{store.begin(id);fail(id);}catch(IOException expected){}
        File external=Files.createTempDirectory("audio-external-").toFile();File linked=new File(home,"linked");Files.createSymbolicLink(linked.toPath(),external.toPath());
        try{new PendingAudio(new File(linked,"media"),prefs).begin("voice-escape");fail();}catch(IOException expected){}assertEquals(0,external.list().length);
        JSONObject e=completed("voice-ledger-link");File ledger=journal(e);Files.delete(ledger.toPath());Files.createSymbolicLink(ledger.toPath(),outside.toPath());assertEquals("needs-review",store.recoverPrimary().getJSONObject(0).getString("state"));exact(outside);exact(store.temporary(e));
    }
    @Test public void collisionsConcurrentReservationsAndPublicationCannotOverwriteEitherCopy()throws Exception{
        JSONObject e=store.begin("voice-collision");Files.write(store.temporary(e).toPath(),ORIGINAL);
        ExecutorService worker=Executors.newSingleThreadExecutor();try{assertTrue(worker.submit(()->{try{new PendingAudio(media,prefs).begin("voice-collision");return false;}catch(Exception expected){return true;}}).get(3,TimeUnit.SECONDS));}finally{worker.shutdownNow();}
        File other=new File(media,"voice-collision");Files.write(other.toPath(),new byte[]{9,8});
        try{store.complete(e);fail();}catch(IOException expected){}store.abandon(e);assertFalse(store.recoverPrimary().getJSONObject(0).getBoolean("available"));
        assertArrayEquals(new byte[]{9,8},Files.readAllBytes(other.toPath()));exact(store.temporary(e));
    }
    @Test public void emptyLargeAndChangedOriginalsNeverAcquireFalseCompletedProof()throws Exception{
        JSONObject empty=store.begin("voice-empty");try{store.complete(empty);fail();}catch(IOException expected){}store.abandon(empty);assertEquals(0,store.temporary(empty).length());
        JSONObject big=store.begin("voice-large");byte[] bytes=new byte[4*1024*1024];new Random(107).nextBytes(bytes);Files.write(store.temporary(big).toPath(),bytes);store.complete(big);store.abandon(big);assertArrayEquals(bytes,Files.readAllBytes(new File(media,"voice-large").toPath()));
        Files.write(new File(media,"voice-large").toPath(),new byte[]{6,6,6});JSONArray result=store.recoverPrimary();assertEquals(2,result.length());assertTrue(result.toString().contains("needs-review"));
    }
    @Test public void historyUndoTrashBackupAndOldRestoreDoNotAuthorizeDeletionOrBinding()throws Exception{
        JSONObject e=completed("voice-history"),r=note("voice-history");String saved=db(r);LocalDatabase.write(home,saved);store.recoverPrimary();assertEquals("bound",entry(e).getString("state"));
        JSONArray items=r.getJSONArray("items");r.put("items",new JSONArray()).put("history",new JSONArray().put(items.toString())).put("versionHistory",new JSONArray().put(new JSONObject().put("items",items.toString())));
        String history=db(r);LocalDatabase.write(home,history);assertEquals(1,store.recoverPrimary().length());exact(store.temporary(e));assertEquals(history,LocalDatabase.read(home));
        r.put("items",items).put("deleted",true);LocalDatabase.write(home,db(r));assertEquals(1,store.recoverPrimary().length());assertTrue(store.protects("voice-history"));
        r.remove("deleted");String restored=db(r);LocalDatabase.write(home,restored);assertEquals(0,store.recoverPrimary().length());
        // Primary unreadable, backup older: read-only recovery must never promote it to bound.
        writeText(new File(home,"projects.json").toPath(),"broken");assertEquals(1,store.recoverPrimary().length());assertEquals("broken",readText(new File(home,"projects.json").toPath()));exact(new File(media,"voice-history"));
    }
    @Test public void failedLedgerAfterProjectCommitDoesNotUndoDurableProject()throws Exception{
        JSONObject e=completed("voice-saved");String saved=db(note("voice-saved"));LocalDatabase.write(home,saved);
        PendingAudio blocked=new PendingAudio(media,prefs,step->{if(step.equals("before-ledger"))throw new IOException("journal disk full");});
        assertEquals("needs-review",blocked.recoverPrimary().getJSONObject(0).getString("state"));assertEquals("pending",entry(e).getString("state"));assertEquals(saved,LocalDatabase.read(home));exact(new File(media,"voice-saved"));
        assertEquals(0,store.recoverPrimary().length());assertEquals("bound",entry(e).getString("state"));
    }
    @Test public void realUnwritableJournalLocationAndActiveRecoveryKeepCapture()throws Exception{
        writeText(new File(home,"pending-audio-v1").toPath(),"block directory");try{store.begin("voice-blocked");fail();}catch(IOException expected){}
        assertEquals("block directory",readText(new File(home,"pending-audio-v1").toPath()));assertEquals(0,media.list().length);
        Files.delete(new File(home,"pending-audio-v1").toPath());JSONObject e=store.begin("voice-active");Files.write(store.temporary(e).toPath(),ORIGINAL);
        // Active capture is not modified by recovery.
        store.recoverPrimary();assertEquals("recording",entry(e).getString("state"));store.abandon(e);exact(store.temporary(e));
    }
    @Test public void unconfirmedNewJournalAndExportOfCorruptEvidencePreserveExactOriginal()throws Exception {
        JSONObject e=completed("voice-export");File journal=journal(e),next=new File(journal+".new");Files.write(next.toPath(),new byte[]{7,7});
        assertEquals("needs-review",store.recoverPrimary().getJSONObject(0).getString("state"));assertArrayEquals(new byte[]{7,7},Files.readAllBytes(next.toPath()));
        exact(store.original(e.getString("token")));Files.delete(next.toPath());Files.write(journal.toPath(),new byte[]{9});exact(store.original(e.getString("token")));
        try{store.original("../outside");fail();}catch(IOException expected){}
    }
    @Test public void trashPurgeRetainsPendingBoundAndUnknownAudioWhileOtherMediaStillDeletes()throws Exception {
        JSONObject e=completed("voice-trash");String saved=db(note("voice-trash").put("deleted",true));LocalDatabase.write(home,saved);
        new TrashPurger(home,new File(home,"cache"),prefs).purge(saved,saved,new JSONArray().put("photo-one"),text->LocalDatabase.write(home,text));
        exact(new File(media,"voice-trash"));exact(store.temporary(e));assertEquals(1,store.recoverPrimary().length());
    }
    @Test public void legacyUnknownAndInterruptedCaptureRemainVisibleAndExportable()throws Exception {
        media.mkdirs();File unknown=new File(media,"voice-legacy"),staged=new File(media,".capture-voice-old-aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa.tmp");
        Files.write(unknown.toPath(),ORIGINAL);Files.write(staged.toPath(),ORIGINAL);JSONArray result=store.recoverPrimary();assertEquals(2,result.length());
        exact(store.original("legacy-voice-legacy"));exact(store.original("staging-"+staged.getName()));
        for(int i=0;i<result.length();i++){assertFalse(result.getJSONObject(i).getBoolean("available"));assertEquals("needs-review",result.getJSONObject(i).getString("state"));}
    }
}
