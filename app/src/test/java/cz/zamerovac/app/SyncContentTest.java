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
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncContentTest {
    @Test public void olderExactHistoryAndDetachedCompletedAudioEnterVersionedManifestButActiveRecordingDoesNot()throws Exception{
        Context c=RuntimeEnvironment.getApplication();SharedPreferences prefs=c.getSharedPreferences("content",0);File home=c.getFilesDir(),media=new File(home,"media");
        LocalDatabase.write(c,"{\"schema\":1,\"records\":[]}");media.mkdirs();
        byte[] photo={8,4,9,3},voice={1,9,8,5};Files.write(new File(media,"photo-original").toPath(),photo);
        String old="{ \"schema\":1, \"records\":[{\"id\":\"photo\",\"media\":[\"photo-original\"],\"items\":[{\"measure\":\"1585,800001234567890\",\"unit\":\"in\",\"x\":12.25,\"y\":94.125}]}]}";
        LocalDatabase.write(c,old);LocalDatabase.write(c,"{\"schema\":1,\"records\":[],\"sequence\":3}");
        PendingAudio audio=new PendingAudio(media,prefs);JSONObject completed=audio.begin("voice-detached");Files.write(audio.temporary(completed).toPath(),voice);audio.complete(completed);audio.abandon(completed);
        JSONObject active=audio.begin("voice-recording");Files.write(audio.temporary(active).toPath(),new byte[]{1,2});
        PeerSnapshot snapshot=PeerSnapshot.captureRecovery(c,prefs,()->{});assertEquals(3,snapshot.wire.getInt("version"));assertTrue(snapshot.media.keySet().containsAll(Set.of("photo-original","voice-detached")));assertFalse(snapshot.media.containsKey("voice-recording"));
        JSONArray history=snapshot.wire.getJSONArray("recovery");boolean exact=false;for(int i=0;i<history.length();i++)if(old.equals(new String(Files.readAllBytes(new File(media,history.getJSONObject(i).getString("metadataId")).toPath()),java.nio.charset.StandardCharsets.UTF_8)))exact=true;assertTrue("Original UTF-8 JSON must remain byte-exact",exact);
        PeerSnapshot parsed=PeerSnapshot.parse(snapshot.bytes,DeviceIdentity.get(c.getNoBackupFilesDir()));assertEquals(snapshot.hash,parsed.hash);assertArrayEquals(photo,Files.readAllBytes(new File(media,"photo-original").toPath()));assertArrayEquals(voice,Files.readAllBytes(new File(media,"voice-detached").toPath()));
        JSONObject bad=new JSONObject(snapshot.wire.toString());bad.getJSONArray("recovery").getJSONObject(0).put("metadataId","revision-"+"0".repeat(64));try{PeerSnapshot.parse(CausalClock.canonical(bad).getBytes(java.nio.charset.StandardCharsets.UTF_8),DeviceIdentity.get(c.getNoBackupFilesDir()));fail("Changed history accepted");}catch(IOException expected){}
        bad=new JSONObject(snapshot.wire.toString()).put("version",2);try{PeerSnapshot.parse(CausalClock.canonical(bad).getBytes(java.nio.charset.StandardCharsets.UTF_8),DeviceIdentity.get(c.getNoBackupFilesDir()));fail("Legacy manifest falsely claimed complete history");}catch(IOException expected){}
        audio.abandon(active);
    }
    @Test public void unverifiedCompletedAudioDoesNotHideHealthyProjectOrClaimContentComplete()throws Exception{
        Context c=RuntimeEnvironment.getApplication();SharedPreferences prefs=c.getSharedPreferences("uncertain-content",0);
        String saved="{\"schema\":1,\"records\":[{\"id\":\"healthy-note\",\"measure\":\"1585,800001234567890\"}]}";
        LocalDatabase.write(c,saved);File media=new File(c.getFilesDir(),"media");PendingAudio audio=new PendingAudio(media,prefs);JSONObject recording=audio.begin("uncertain-voice");Files.write(audio.temporary(recording).toPath(),new byte[]{1,2,3});audio.complete(recording);audio.abandon(recording);
        Files.write(new File(media,"uncertain-voice").toPath(),new byte[]{4,5,6});SyncPeerRegistry peers=new SyncPeerRegistry(c.getNoBackupFilesDir());peers.approve(PeerTlsTest.B,"b".repeat(64),"Synthetic tablet");
        PeerOutbox outbox=new PeerOutbox(c,prefs,peers);PeerSnapshot working=outbox.prepare(PeerTlsTest.B);assertFalse(working.media.containsKey("uncertain-voice"));assertEquals(1,outbox.pendingProjects(PeerTlsTest.B));assertTrue(outbox.contentProblem(PeerTlsTest.B));assertTrue(new PeerOutbox(c,prefs,peers).contentProblem(PeerTlsTest.B));assertEquals(saved,LocalDatabase.readForCas(c));assertArrayEquals(new byte[]{4,5,6},Files.readAllBytes(new File(media,"uncertain-voice").toPath()));
    }
    @Test public void recoveryArchiveIncludesPortableLedgerButNeverPrivateUploadSession()throws Exception{
        Context c=RuntimeEnvironment.getApplication();SharedPreferences prefs=c.getSharedPreferences("archive-content",0);String saved="{\"schema\":1,\"records\":[{\"id\":\"exact\",\"measure\":\"0,000000000123456789\"}]}";LocalDatabase.write(c,saved);PeerSnapshot snapshot=PeerSnapshot.capture(c,prefs);
        try(SyncLedger ledger=SyncLedger.open(c.getNoBackupFilesDir())){String target=ledger.target("drive","account-space",PeerTlsTest.B);ledger.prepare(target,snapshot);ledger.transfer(PeerWire.hash(new byte[]{1}),target,snapshot.hash,123,"private-resume-session",0);}
        JSONObject archive=RecoveryProtectionArchive.create(c);assertTrue(archive.getBoolean("complete"));String id=archive.getString("id");assertTrue(RecoveryProtectionArchive.verify(c.getNoBackupFilesDir(),id).getBoolean("complete"));
        File payload=new File(c.getNoBackupFilesDir(),"recovery-protection-v1/snapshot-"+id+"/payload/no_backup/sync-ledger-v1.export.json");String portable=new String(Files.readAllBytes(payload.toPath()),java.nio.charset.StandardCharsets.UTF_8);assertTrue(portable.contains(snapshot.hash));assertFalse(portable.contains("private-resume-session"));
        JSONArray files=new JSONObject(portable).getJSONArray("files");boolean exact=false;for(int i=0;i<files.length();i++){String path=files.getJSONObject(i).getString("path");if(path.equals("no_backup/sync-ledger-revisions/"+snapshot.hash+".json")){File archived=new File(c.getNoBackupFilesDir(),"recovery-protection-v1/snapshot-"+id+"/payload/"+path);assertArrayEquals(snapshot.bytes,Files.readAllBytes(archived.toPath()));exact=true;}}assertTrue(exact);assertEquals(saved,LocalDatabase.readForCas(c));
    }

    @Test public void revisionMetadataIsASeparateVerifiedBlobInsteadOfInflatingTheManifest()throws Exception{
        Context c=RuntimeEnvironment.getApplication();SharedPreferences prefs=c.getSharedPreferences("large-history",0);
        String old=new JSONObject().put("schema",1).put("records",new JSONArray().put(new JSONObject().put("id","older").put("text","x".repeat(2*1024*1024)).put("measure","1585,800001234567890"))).toString();
        LocalDatabase.write(c,old);LocalDatabase.write(c,"{\"schema\":1,\"records\":[{\"id\":\"newer\"}]}");PeerSnapshot snapshot=PeerSnapshot.captureRecovery(c,prefs,()->{});assertTrue(snapshot.bytes.length<65536);assertFalse(new String(snapshot.bytes,java.nio.charset.StandardCharsets.UTF_8).contains("xxxxxx"));JSONObject entry=snapshot.wire.getJSONArray("recovery").getJSONObject(0);String id=entry.getString("metadataId");assertTrue(snapshot.media.get(id).getLong("size")>2*1024*1024);assertEquals(old,new String(Files.readAllBytes(new File(c.getFilesDir(),"media/"+id).toPath()),java.nio.charset.StandardCharsets.UTF_8));assertEquals(PeerWire.hash(old.getBytes(java.nio.charset.StandardCharsets.UTF_8)),snapshot.media.get(id).getString("hash"));
    }

}
