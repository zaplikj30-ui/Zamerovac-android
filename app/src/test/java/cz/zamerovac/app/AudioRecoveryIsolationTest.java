package cz.zamerovac.app;

import android.content.*;
import android.net.Uri;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real private files and Native bridge; synthetic audio, no installed Android recorder/provider. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class AudioRecoveryIsolationTest {
    static final byte[] ONE={0,1,2,3,4,5,20,40,80,(byte)255},TWO={9,8,7,6,5,4,3};
    Context context;File home,media;SharedPreferences prefs;PendingAudio store;MainActivity activity;MainActivity.JsApi api;
    @Before public void setup()throws Exception{
        context=RuntimeEnvironment.getApplication();home=context.getFilesDir();media=new File(home,"media");
        prefs=context.getSharedPreferences("isolation-"+UUID.randomUUID(),0);store=new PendingAudio(media,prefs);
        activity=Robolectric.buildActivity(MainActivity.class).get();ReflectionHelpers.setField(activity,"settings",prefs);
        ReflectionHelpers.setField(activity,"web",mock(android.webkit.WebView.class));api=activity.new JsApi();
    }
    JSONObject completed(String id,byte[] bytes)throws Exception{JSONObject e=store.begin(id);Files.write(store.temporary(e).toPath(),bytes);store.complete(e);store.abandon(e);return e;}
    JSONObject row(JSONArray items,String id)throws Exception{for(int i=0;i<items.length();i++)if(id.equals(items.getJSONObject(i).optString("id")))return items.getJSONObject(i);fail("Missing recoverable recording: "+id+" in "+items);return null;}
    void exact(File file,byte[] bytes)throws Exception{assertEquals(bytes.length,file.length());assertArrayEquals(bytes,Files.readAllBytes(file.toPath()));System.out.println(file.getName()+" SIZE="+file.length()+" SHA256="+PeerMedia.inspect(file).getString("hash"));}
    void export(String token,byte[] expected)throws Exception{
        Uri uri=Uri.parse("content://synthetic-audio-export/"+UUID.randomUUID());CountDownLatch closed=new CountDownLatch(1);
        ByteArrayOutputStream output=new ByteArrayOutputStream(){@Override public void close()throws IOException{super.close();closed.countDown();}};
        Shadows.shadowOf(context.getContentResolver()).registerOutputStream(uri,output);
        ReflectionHelpers.setField(activity,"retainedAudioExportToken",token);
        activity.onActivityResult(36,android.app.Activity.RESULT_OK,new Intent().setData(uri));
        assertTrue("Native export did not complete",closed.await(5,TimeUnit.SECONDS));assertArrayEquals(expected,output.toByteArray());
    }
    @Test public void unknownJournalMustNotHideTwoValidRecordingsOrTheirNativeExports()throws Exception{
        JSONObject one=completed("voice-one",ONE),two=completed("voice-two",TWO);
        exact(new File(media,"voice-one"),ONE);exact(new File(media,"voice-two"),TWO);
        File unknown=new File(home,"pending-audio-v1/unexpected.tmp");Files.write(unknown.toPath(),new byte[]{42,0,99});
        String saved="{\"schema\":1,\"records\":[{\"id\":\"note-record\",\"kind\":\"note\",\"media\":[\"voice-one\",\"voice-two\"]}]}";
        assertTrue(new JSONObject(api.saveDataChecked(saved,api.loadData())).getBoolean("ok"));
        byte[] ledgerBefore=Files.readAllBytes(new File(home,"pending-audio-v1/"+one.getString("token")+".json").toPath());
        for(int attempt=0;attempt<2;attempt++){
            JSONArray items=new JSONArray(api.pendingAudio());JSONObject first=row(items,"voice-one"),second=row(items,"voice-two");
            assertNotEquals(first.getString("token"),second.getString("token"));
            assertTrue("Uncertainty must be visible",items.toString().contains("journal-uncertain"));
            export(first.getString("token"),ONE);export(second.getString("token"),TWO);
            assertFalse("Unknown evidence cannot authorize binding",api.confirmPendingAudio(saved,"note-record","","voice-one"));
            assertArrayEquals(new byte[]{42,0,99},Files.readAllBytes(unknown.toPath()));
            exact(store.temporary(one),ONE);exact(store.temporary(two),TWO);assertArrayEquals(ledgerBefore,Files.readAllBytes(new File(home,"pending-audio-v1/"+one.getString("token")+".json").toPath()));
        }
        assertTrue(store.protects("any-unrelated-candidate"));
    }
    @Test public void validFinalOriginalIsExportableWhenItsReservationLinkIsMissing()throws Exception{
        JSONObject e=completed("voice-final-only",ONE);Files.delete(store.temporary(e).toPath());
        row(new JSONArray(api.pendingAudio()),"voice-final-only");exact(store.original(e.getString("token")),ONE);export(e.getString("token"),ONE);
    }
    @Test public void malformedProjectHistoryCannotHideHealthyAudioOrRewriteProject()throws Exception{
        completed("voice-history-one",ONE);completed("voice-history-two",TWO);
        String saved="{\"schema\":1,\"records\":[{\"id\":\"photo\",\"versionHistory\":[{\"items\":\"[broken\"}]}]}";
        LocalDatabase.write(home,saved);JSONArray items=new JSONArray(api.pendingAudio());
        export(row(items,"voice-history-one").getString("token"),ONE);export(row(items,"voice-history-two").getString("token"),TWO);
        assertEquals(saved,LocalDatabase.read(home));
    }
    @Test public void duplicateReservationTokenExposesBothOriginalsWithoutChoosingAnArbitraryOne()throws Exception{
        JSONObject e=completed("voice-token-one",ONE);String token=e.getString("token");
        File other=new File(media,".audio-voice-token-two--"+token+".tmp");Files.write(other.toPath(),TWO);
        JSONArray items=new JSONArray(api.pendingAudio());JSONObject first=row(items,"voice-token-one"),second=row(items,"voice-token-two");
        assertNotEquals(first.getString("token"),second.getString("token"));
        assertFalse(first.optBoolean("attachable",true));assertFalse(second.optBoolean("attachable",true));
        export(first.getString("token"),ONE);export(second.getString("token"),TWO);exact(other,TWO);exact(store.temporary(e),ONE);
    }
    @Test public void combinedUnknownCorruptEvidenceAndWriteFailureKeepHealthyExportsAndTrashRetention()throws Exception{
        JSONObject one=completed("voice-combo-one",ONE),two=completed("voice-combo-two",TWO),bad=completed("voice-combo-bad",ONE);
        File unknown=new File(home,"pending-audio-v1/unexpected.tmp"),broken=new File(home,"pending-audio-v1/"+bad.getString("token")+".json");
        Files.write(unknown.toPath(),new byte[]{5});Files.write(broken.toPath(),new byte[]{6});
        PendingAudio failing=new PendingAudio(media,prefs,step->{if(step.equals("before-ledger"))throw new IOException("disk full");});
        JSONArray items=failing.recoverPrimary();export(row(items,"voice-combo-one").getString("token"),ONE);export(row(items,"voice-combo-two").getString("token"),TWO);export(row(items,"voice-combo-bad").getString("token"),ONE);
        String saved="{\"schema\":1,\"records\":[{\"id\":\"removed\",\"deleted\":true,\"kind\":\"note\",\"media\":[\"voice-combo-one\",\"voice-combo-two\",\"voice-combo-bad\"]}]}";LocalDatabase.write(home,saved);
        new TrashPurger(context,prefs).purge(saved,saved,new JSONArray().put("removed"),text->LocalDatabase.write(home,text));
        exact(store.temporary(one),ONE);exact(store.temporary(two),TWO);exact(store.temporary(bad),ONE);assertArrayEquals(new byte[]{5},Files.readAllBytes(unknown.toPath()));assertArrayEquals(new byte[]{6},Files.readAllBytes(broken.toPath()));
    }
    @Test public void unreadableJournalDirectoryDoesNotPreventRawExportOfBothReservations()throws Exception{
        JSONObject one=completed("voice-dir-one",ONE),two=completed("voice-dir-two",TWO);File ledger=new File(home,"pending-audio-v1"),kept=new File(home,"kept-evidence");Files.move(ledger.toPath(),kept.toPath());Files.write(ledger.toPath(),new byte[]{9});
        JSONArray items=new JSONArray(api.pendingAudio());export(row(items,"voice-dir-one").getString("token"),ONE);export(row(items,"voice-dir-two").getString("token"),TWO);exact(store.temporary(one),ONE);exact(store.temporary(two),TWO);assertArrayEquals(new byte[]{9},Files.readAllBytes(ledger.toPath()));assertTrue(kept.isDirectory());
    }
    @Test public void outputFailureDoesNotChangeSourceAndRetryChecksLengthAndDigest()throws Exception{
        JSONObject e=completed("voice-copy",ONE);OutputStream rejected=new OutputStream(){int written;public void write(int b)throws IOException{if(++written>3)throw new IOException("provider disk full");}};
        try{store.copyOriginal(e.getString("token"),rejected);fail("Output failure was acknowledged");}catch(IOException expected){}
        exact(store.temporary(e),ONE);ByteArrayOutputStream output=new ByteArrayOutputStream();JSONObject proof=store.copyOriginal(e.getString("token"),output);assertArrayEquals(ONE,output.toByteArray());assertEquals(ONE.length,proof.getLong("size"));assertEquals("86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a",proof.getString("sha256"));
    }
    @Test public void confirmationHashesOnlySelectedAudioAndReportsMultiFileRecoveryCost()throws Exception{
        byte[] large=new byte[8*1024*1024];new Random(107).nextBytes(large);for(String id:new String[]{"voice-large-one","voice-large-two","voice-large-three"})completed(id,large);
        String saved="{\"schema\":1,\"records\":[{\"id\":\"notes\",\"kind\":\"note\",\"media\":[\"voice-large-one\",\"voice-large-two\",\"voice-large-three\"]}]}";LocalDatabase.write(home,saved);
        java.util.concurrent.atomic.AtomicInteger hashes=new java.util.concurrent.atomic.AtomicInteger();PendingAudio measured=new PendingAudio(media,prefs,step->{if(step.equals("hash-media"))hashes.incrementAndGet();});
        long start=System.nanoTime();assertEquals(0,measured.recoverPrimary().length());long recovery=System.nanoTime()-start;assertEquals(3,hashes.get());hashes.set(0);
        start=System.nanoTime();assertTrue(measured.confirm(saved,"notes","","voice-large-two"));long confirm=System.nanoTime()-start;assertEquals("Confirmation must not hash unrelated recordings",1,hashes.get());
        System.out.println("HOST_ONLY_PERFORMANCE bytes=25165824 recovery_ms="+(recovery/1000000)+" selected_confirm_ms="+(confirm/1000000)+" recovery_hashes=3 confirm_hashes=1 Android_performance=NOT_RUN");
    }
    @Test public void unsafeReservationCannotHideTheLastVerifiedFinalCopy()throws Exception{
        JSONObject e=completed("voice-safe-final",ONE);File reserved=store.temporary(e),outside=new File(home,"outside");Files.write(outside.toPath(),TWO);Files.delete(reserved.toPath());Files.createSymbolicLink(reserved.toPath(),outside.toPath());
        JSONObject item=row(new JSONArray(api.pendingAudio()),"voice-safe-final");assertTrue("Final original needs a safe export action",item.has("token"));export(item.getString("token"),ONE);exact(outside,TWO);exact(new File(media,"voice-safe-final"),ONE);assertTrue(Files.isSymbolicLink(reserved.toPath()));
    }
    @Test public void invalidSourceCannotOpenOrTruncateTheChosenCopyDestination()throws Exception{
        java.util.concurrent.atomic.AtomicInteger opened=new java.util.concurrent.atomic.AtomicInteger();
        try{store.copyOriginal("missing-token",()->{opened.incrementAndGet();return new ByteArrayOutputStream();});fail();}catch(IOException expected){}
        assertEquals(0,opened.get());
        JSONObject e=completed("voice-close-failure",ONE);
        try{store.copyOriginal(e.getString("token"),()->new ByteArrayOutputStream(){@Override public void close()throws IOException{throw new IOException("provider close failed");}});fail("Close failure acknowledged");}catch(IOException expected){}
        exact(store.temporary(e),ONE);exact(new File(media,"voice-close-failure"),ONE);
    }
    @Test public void aFailedBindingWriteDoesNotRollBackProjectOrHideOtherHealthyAudio()throws Exception{
        JSONObject one=completed("voice-write-one",ONE),two=completed("voice-write-two",TWO);
        String saved="{\"schema\":1,\"records\":[{\"id\":\"notes\",\"kind\":\"note\",\"media\":[\"voice-write-one\",\"voice-write-two\"]}]}";LocalDatabase.write(home,saved);
        java.util.concurrent.atomic.AtomicInteger writes=new java.util.concurrent.atomic.AtomicInteger();PendingAudio failing=new PendingAudio(media,prefs,step->{if(step.equals("before-ledger")&&writes.getAndIncrement()==0)throw new IOException("ledger full");});
        JSONArray items=failing.recoverPrimary();assertEquals(1,items.length());assertEquals("needs-review",items.getJSONObject(0).getString("state"));
        String id=items.getJSONObject(0).getString("id");export(items.getJSONObject(0).getString("token"),id.equals("voice-write-one")?ONE:TWO);
        assertEquals(saved,LocalDatabase.read(home));exact(store.temporary(one),ONE);exact(store.temporary(two),TWO);assertEquals(0,store.recoverPrimary().length());
    }
    @Test public void oneChangedAudioHashDoesNotHideTheTwoUnchangedOriginals()throws Exception{
        JSONObject one=completed("voice-hash-one",ONE),two=completed("voice-hash-two",TWO),bad=completed("voice-hash-bad",ONE);Files.write(store.temporary(bad).toPath(),TWO);
        JSONArray items=new JSONArray(api.pendingAudio());export(row(items,"voice-hash-one").getString("token"),ONE);export(row(items,"voice-hash-two").getString("token"),TWO);
        assertFalse(row(items,"voice-hash-bad").getBoolean("available"));export(row(items,"voice-hash-bad").getString("token"),TWO);exact(store.temporary(one),ONE);exact(store.temporary(two),TWO);
    }
    @Test public void malformedHistoryCannotReconfirmAnOldBoundFlag()throws Exception{
        JSONObject e=completed("voice-bound-history",ONE);String valid="{\"schema\":1,\"records\":[{\"id\":\"notes\",\"kind\":\"note\",\"media\":[\"voice-bound-history\"]}]}";LocalDatabase.write(home,valid);assertEquals(0,store.recoverPrimary().length());
        JSONObject db=new JSONObject(valid);db.getJSONArray("records").getJSONObject(0).put("versionHistory",new JSONArray().put(new JSONObject().put("items","[broken")));String broken=db.toString();LocalDatabase.write(home,broken);
        assertFalse(api.confirmPendingAudio(broken,"notes","","voice-bound-history"));export(row(new JSONArray(api.pendingAudio()),"voice-bound-history").getString("token"),ONE);assertEquals(broken,LocalDatabase.read(home));exact(store.temporary(e),ONE);
    }
    @Test public void duplicateAudioIdsInTwoJournalsRemainSeparateExportableOriginals()throws Exception{
        JSONObject one=completed("voice-duplicate",ONE),two=completed("voice-other",TWO);File source=store.temporary(two);
        two.put("id","voice-duplicate").put("temporary",".audio-voice-duplicate--"+two.getString("token")+".tmp");Files.move(source.toPath(),new File(media,two.getString("temporary")).toPath());
        String payload=two.toString(),hash=ArchiveIntegrity.hex(java.security.MessageDigest.getInstance("SHA-256").digest(payload.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        Files.write(new File(home,"pending-audio-v1/"+two.getString("token")+".json").toPath(),new JSONObject().put("payload",payload).put("sha256",hash).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
        JSONArray items=new JSONArray(api.pendingAudio());Set<String> tokens=new HashSet<>();int copies=0;
        for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);if("voice-duplicate".equals(item.optString("id"))&&item.has("token")){
            assertFalse(item.getBoolean("attachable"));assertTrue(tokens.add(item.getString("token")));export(item.getString("token"),item.getString("token").contains(one.getString("token"))?ONE:TWO);copies++;
        }}
        assertEquals(2,copies);exact(store.temporary(one),ONE);exact(new File(media,two.getString("temporary")),TWO);
    }
}
