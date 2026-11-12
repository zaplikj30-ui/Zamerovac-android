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
        JSONArray history=snapshot.wire.getJSONArray("recovery");boolean exact=false;for(int i=0;i<history.length();i++)if(old.equals(history.getJSONObject(i).getString("metadata")))exact=true;assertTrue("Original UTF-8 JSON must remain byte-exact",exact);
        PeerSnapshot parsed=PeerSnapshot.parse(snapshot.bytes,DeviceIdentity.get(c.getNoBackupFilesDir()));assertEquals(snapshot.hash,parsed.hash);assertArrayEquals(photo,Files.readAllBytes(new File(media,"photo-original").toPath()));assertArrayEquals(voice,Files.readAllBytes(new File(media,"voice-detached").toPath()));
        JSONObject bad=new JSONObject(snapshot.wire.toString());bad.getJSONArray("recovery").getJSONObject(0).put("metadata",old+" ");try{PeerSnapshot.parse(CausalClock.canonical(bad).getBytes(java.nio.charset.StandardCharsets.UTF_8),DeviceIdentity.get(c.getNoBackupFilesDir()));fail("Changed history accepted");}catch(IOException expected){}
        bad=new JSONObject(snapshot.wire.toString()).put("version",2);try{PeerSnapshot.parse(CausalClock.canonical(bad).getBytes(java.nio.charset.StandardCharsets.UTF_8),DeviceIdentity.get(c.getNoBackupFilesDir()));fail("Legacy manifest falsely claimed complete history");}catch(IOException expected){}
        audio.abandon(active);
    }
}
