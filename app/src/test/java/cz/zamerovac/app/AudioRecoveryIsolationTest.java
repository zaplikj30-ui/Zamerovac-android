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
        String actual=ArchiveIntegrity.hex(java.security.MessageDigest.getInstance("SHA-256").digest(output.toByteArray()));
        assertEquals(ArchiveIntegrity.hex(java.security.MessageDigest.getInstance("SHA-256").digest(expected)),actual);
        System.out.println("NATIVE_EXPORTED bytes="+output.size()+" SHA256="+actual);
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
    static final byte[] OTHER={9,8,7,6,5,4,3,2,1,0};
    JSONObject split(String id)throws Exception{
        JSONObject e=completed(id,ONE);File reserved=store.temporary(e),target=new File(media,id);Files.delete(reserved.toPath());Files.write(reserved.toPath(),OTHER);
        assertTrue(Files.isRegularFile(reserved.toPath(),LinkOption.NOFOLLOW_LINKS));assertTrue(Files.isRegularFile(target.toPath(),LinkOption.NOFOLLOW_LINKS));
        assertEquals(ONE.length,reserved.length());assertEquals(target.length(),reserved.length());assertFalse(Files.isSameFile(target.toPath(),reserved.toPath()));
        assertNotEquals(PeerMedia.inspect(target).getString("hash"),PeerMedia.inspect(reserved).getString("hash"));exact(target,ONE);exact(reserved,OTHER);return e;
    }
    JSONObject variant(JSONArray items,String id,String integrity)throws Exception{
        for(int i=0;i<items.length();i++){JSONObject item=items.getJSONObject(i);if(id.equals(item.optString("id"))&&integrity.equals(item.optString("integrity")))return item;}
        fail("Missing "+integrity+" copy for "+id+": "+items);return null;
    }
    @Test public void knownOriginalTokenMustExportJournalBytesInsteadOfDifferentRegularReservation()throws Exception{
        JSONObject e=split("voice-split-direct");ByteArrayOutputStream output=new ByteArrayOutputStream();JSONObject proof=store.copyOriginal(e.getString("token"),output);
        System.out.println("SPLIT_EXPORT actual_sha="+ArchiveIntegrity.hex(java.security.MessageDigest.getInstance("SHA-256").digest(output.toByteArray()))+" expected_sha="+PeerMedia.inspect(new File(media,"voice-split-direct")).getString("hash"));
        assertArrayEquals("Known journal token selected wrong original",ONE,output.toByteArray());assertEquals(ONE.length,proof.getLong("size"));assertTrue(proof.getBoolean("verified"));
    }
    @Test public void nativeOriginalExportMustUseVerifiedFinalRatherThanSameSizeOtherInode()throws Exception{
        JSONObject e=split("voice-split-native");export(e.getString("token"),ONE);exact(new File(media,"voice-split-native"),ONE);exact(store.temporary(e),OTHER);
    }
    @Test public void splitRecoveryMustExposeVerifiedFinalAndUncertainReservationSeparately()throws Exception{
        JSONObject e=split("voice-split-rows");JSONArray items=new JSONArray(api.pendingAudio());JSONObject good=variant(items,"voice-split-rows","verified"),suspect=variant(items,"voice-split-rows","uncertain");
        assertNotEquals(good.getString("token"),suspect.getString("token"));assertFalse(good.getBoolean("attachable"));assertFalse(suspect.getBoolean("attachable"));assertFalse(suspect.getBoolean("available"));
        exportAcknowledged(good.getString("token"),ONE,true);exportAcknowledged(suspect.getString("token"),OTHER,false);exact(new File(media,"voice-split-rows"),ONE);exact(store.temporary(e),OTHER);
    }
    @Test public void splitUnknownEvidenceFailedSaveAndStaleCASKeepBothCopiesAndHealthyNeighbour()throws Exception{
        JSONObject e=split("voice-split-combined"),healthy=completed("voice-healthy",TWO);File unknown=new File(home,"pending-audio-v1/unexpected.tmp");Files.write(unknown.toPath(),new byte[]{42});
        File ledger=new File(home,"pending-audio-v1/"+e.getString("token")+".json");byte[] evidence=Files.readAllBytes(ledger.toPath());String initial="{\"schema\":1,\"records\":[]}";LocalDatabase.write(home,initial);String saved="{\"schema\":1,\"records\":[{\"id\":\"notes\",\"kind\":\"note\",\"media\":[\"voice-split-combined\",\"voice-healthy\"]}]}";
        File blocker=new File(home,"projects.tmp");assertTrue(blocker.mkdir());try{assertFalse(new JSONObject(api.saveDataChecked(saved,initial)).getBoolean("ok"));assertEquals(initial,LocalDatabase.read(home));}finally{blocker.delete();}
        assertTrue(new JSONObject(api.saveDataChecked(saved,initial)).getBoolean("ok"));String newer=new JSONObject(saved).put("sequence",2).toString();assertTrue(new JSONObject(api.saveDataChecked(newer,saved)).getBoolean("ok"));assertFalse(api.confirmPendingAudio(saved,"notes","","voice-split-combined"));assertFalse(api.confirmPendingAudio(newer,"notes","","voice-split-combined"));
        for(int attempt=0;attempt<2;attempt++){
            JSONArray items=new JSONArray(api.pendingAudio());export(variant(items,"voice-split-combined","verified").getString("token"),ONE);export(variant(items,"voice-split-combined","uncertain").getString("token"),OTHER);export(row(items,"voice-healthy").getString("token"),TWO);
            assertEquals(newer,LocalDatabase.read(home));assertArrayEquals(evidence,Files.readAllBytes(ledger.toPath()));assertArrayEquals(new byte[]{42},Files.readAllBytes(unknown.toPath()));exact(new File(media,"voice-split-combined"),ONE);exact(store.temporary(e),OTHER);exact(store.temporary(healthy),TWO);
        }
    }
    void exportAcknowledged(String token,byte[] expected,boolean verified)throws Exception{
        android.webkit.WebView web=ReflectionHelpers.getField(activity,"web");java.util.concurrent.atomic.AtomicReference<String> script=new java.util.concurrent.atomic.AtomicReference<>();
        doAnswer(call->{script.set(call.getArgument(0));return null;}).when(web).evaluateJavascript(contains("window.PendingAudio?.exported("),isNull());
        export(token,expected);for(int i=0;i<40&&script.get()==null;i++){Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();Thread.sleep(25);}
        assertEquals("window.PendingAudio?.exported("+verified+")",script.get());
    }
    @Test public void verifiedCopyChecksStreamSHAEvenWhenChangedFileRetainsSizeInodeAndTimestamp()throws Exception{
        JSONObject e=completed("voice-stream-sha",ONE);File target=new File(media,"voice-stream-sha");java.nio.file.attribute.FileTime stamp=Files.getLastModifiedTime(target.toPath());
        java.util.concurrent.atomic.AtomicBoolean changed=new java.util.concurrent.atomic.AtomicBoolean();PendingAudio injected=new PendingAudio(media,prefs,step->{if(step.equals("export-read")&&changed.compareAndSet(false,true)){Files.write(target.toPath(),OTHER);Files.setLastModifiedTime(target.toPath(),stamp);}});
        ByteArrayOutputStream output=new ByteArrayOutputStream();try{injected.copyOriginal(e.getString("token"),output);fail("Wrong stream SHA acknowledged");}catch(IOException expected){assertTrue(expected.getMessage().contains("SHA-256"));}
        assertTrue(changed.get());assertArrayEquals(OTHER,output.toByteArray());Files.write(target.toPath(),ONE);ByteArrayOutputStream retry=new ByteArrayOutputStream();assertTrue(store.copyOriginal(e.getString("token"),retry).getBoolean("verified"));assertArrayEquals(ONE,retry.toByteArray());
    }
    @Test public void reverseSplitRetainsVerifiedReservationAndIndependentUncertainFinal()throws Exception{
        JSONObject e=completed("voice-reverse",ONE);File target=new File(media,"voice-reverse");Files.delete(target.toPath());Files.write(target.toPath(),OTHER);
        JSONArray items=new JSONArray(api.pendingAudio());JSONObject good=variant(items,"voice-reverse","verified"),bad=variant(items,"voice-reverse","uncertain");
        assertFalse(good.getBoolean("available"));assertFalse(good.getBoolean("attachable"));exportAcknowledged(good.getString("token"),ONE,true);exportAcknowledged(bad.getString("token"),OTHER,false);exact(store.temporary(e),ONE);exact(target,OTHER);
    }
    @Test public void noMatchingCopyCannotClaimOriginalOrOpenDestinationButBothRawFilesRemainExportable()throws Exception{
        JSONObject e=split("voice-no-match");byte[] third={4,4,4,4,4,4,4,4,4,4};File target=new File(media,"voice-no-match");Files.write(target.toPath(),third);
        java.util.concurrent.atomic.AtomicInteger opened=new java.util.concurrent.atomic.AtomicInteger();try{store.copyOriginal(e.getString("token"),()->{opened.incrementAndGet();return new ByteArrayOutputStream();});fail("Missing original falsely acknowledged");}catch(IOException expected){}assertEquals(0,opened.get());
        JSONArray items=new JSONArray(api.pendingAudio());int raw=0;for(int i=0;i<items.length();i++){JSONObject row=items.getJSONObject(i);if("voice-no-match".equals(row.optString("id"))&&row.has("token")){
            assertEquals("uncertain",row.getString("integrity"));ByteArrayOutputStream bytes=new ByteArrayOutputStream();assertFalse(store.copyOriginal(row.getString("token"),bytes).getBoolean("verified"));assertArrayEquals(row.getString("token").startsWith("source-")?OTHER:third,bytes.toByteArray());raw++;
        }}assertEquals(2,raw);exact(store.temporary(e),OTHER);exact(target,third);
    }
}
