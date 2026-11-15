package cz.zamerovac.app;
import android.content.SharedPreferences;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.security.*;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Identical byte-preservation contract runs on the historical classes and variant B. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class AudioCompletedKeepTest {
 @Test public void completedOriginalSurvivesMetadataCommitFalse()throws Exception{
  final byte[] original={0,1,2,3,4,5,20,40,80,(byte)255};
  File media=Files.createTempDirectory(RuntimeEnvironment.getApplication().getFilesDir().toPath(),"audio-keep-").toFile();
  SharedPreferences prefs=mock(SharedPreferences.class);SharedPreferences.Editor edit=mock(SharedPreferences.Editor.class);
  when(prefs.edit()).thenReturn(edit);when(edit.putString(anyString(),anyString())).thenReturn(edit);when(edit.commit()).thenReturn(false);
  AudioCapture.Recorder recorder=new AudioCapture.Recorder(){public void start(File file)throws Exception{Files.write(file.toPath(),original);}public void stop(){}public void release(){}};
  AudioCapture capture=new AudioCapture(media,prefs,()->recorder);assertTrue(capture.start("audio_107_03"));
  try{capture.stop();fail("False metadata commit acknowledged");}catch(IOException expected){}capture.close();
  boolean survived=false;File[] files=media.listFiles();assertNotNull(files);
  for(File file:files)if(file.isFile()&&Arrays.equals(original,Files.readAllBytes(file.toPath())))survived=true;
  assertTrue("Completed original deleted after prefs failure; expected KEEP",survived);
  String hash=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(original));
  assertEquals("86d5b35cddd2c4be8c0ba478afe72ab809717878b5bce1d8e9865f5cb3f7d50a",hash);
  System.out.println("EXACT_ORIGINAL_AND_RETAINED_SHA256="+hash+" bytes=10");
 }
}
