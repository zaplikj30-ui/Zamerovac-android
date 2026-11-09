package cz.zamerovac.app;

import android.content.*;
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
public class AudioCaptureTest {
 File root,media;SharedPreferences prefs;
 static class Recorder implements AudioCapture.Recorder {File output;int released;boolean failStart,failStop,empty;public void start(File out)throws Exception{output=out;if(failStart)throw new IOException("synthetic start failed");if(!empty)Files.write(out.toPath(),new byte[]{1,2,3,4});}public void stop()throws Exception{if(failStop)throw new IOException("synthetic stop failed");}public void release(){released++;}}
 @Before public void setup()throws Exception{Context context=RuntimeEnvironment.getApplication();root=Files.createTempDirectory(context.getCacheDir().toPath(),"audio-capture-").toFile();media=new File(root,"media");prefs=context.getSharedPreferences("audio-"+UUID.randomUUID(),0);}
 int temporaries(){File[] files=media.listFiles(file->file.getName().startsWith(".capture-"));return files==null?0:files.length;}
 @Test public void onlySuccessfulStopPublishesCompleteFileAndConfirmedMetadata()throws Exception{
  Recorder recorder=new Recorder();AudioCapture capture=new AudioCapture(media,prefs,()->recorder);assertTrue(capture.start("voice-one"));assertTrue(capture.active());assertFalse(new File(media,"voice-one").exists());assertFalse(prefs.contains("mime-voice-one"));assertFalse(capture.start("voice-two"));assertTrue(capture.stop());assertEquals(1,recorder.released);assertFalse(capture.active());assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(media,"voice-one").toPath()));assertEquals("audio/mp4",prefs.getString("mime-voice-one",""));assertEquals(0,temporaries());assertFalse(capture.stop());
 }
 @Test public void startStopEmptyAndCancelFailuresNeverPublishPartialRecording()throws Exception{
  for(String mode:new String[]{"start","stop","empty","cancel"}){Recorder recorder=new Recorder();recorder.failStart=mode.equals("start");recorder.failStop=mode.equals("stop");recorder.empty=mode.equals("empty");AudioCapture capture=new AudioCapture(media,prefs,()->recorder);try{assertTrue(capture.start("voice-"+mode));if(mode.equals("cancel"))capture.close();else{capture.stop();fail("Invalid recording committed");}}catch(IOException expected){assertFalse(mode.equals("cancel"));}assertFalse(capture.active());assertEquals(1,recorder.released);assertFalse(new File(media,"voice-"+mode).exists());assertFalse(prefs.contains("mime-voice-"+mode));assertEquals(0,temporaries());}
 }
 @Test public void existingAndLateCollidingOriginalsAndMetadataStayUnchanged()throws Exception{
  media.mkdirs();File original=new File(media,"voice-one");Files.write(original.toPath(),new byte[]{9,8});prefs.edit().putString("mime-voice-one","image/jpeg").commit();Recorder recorder=new Recorder();AudioCapture capture=new AudioCapture(media,prefs,()->recorder);
  try{capture.start("voice-one");fail("Existing original accepted");}catch(IOException expected){}assertArrayEquals(new byte[]{9,8},Files.readAllBytes(original.toPath()));assertEquals(0,recorder.released);
  assertTrue(capture.start("voice-late"));File late=new File(media,"voice-late");Files.write(late.toPath(),new byte[]{7,6});prefs.edit().putString("mime-voice-late","video/mp4").commit();try{capture.stop();fail("Concurrent original overwritten");}catch(IOException expected){}assertArrayEquals(new byte[]{7,6},Files.readAllBytes(late.toPath()));assertEquals("video/mp4",prefs.getString("mime-voice-late",""));assertEquals("image/jpeg",prefs.getString("mime-voice-one",""));assertEquals(0,temporaries());
 }
 @Test public void unconfirmedMetadataRollsBackOnlyNewFile()throws Exception{
  SharedPreferences failed=mock(SharedPreferences.class);SharedPreferences.Editor edit=mock(SharedPreferences.Editor.class);when(failed.edit()).thenReturn(edit);when(edit.putString(anyString(),anyString())).thenReturn(edit);when(edit.commit()).thenReturn(false);Recorder recorder=new Recorder();AudioCapture capture=new AudioCapture(media,failed,()->recorder);assertTrue(capture.start("voice-failed"));try{capture.stop();fail("Unconfirmed metadata acknowledged");}catch(IOException expected){}assertFalse(new File(media,"voice-failed").exists());assertEquals(1,recorder.released);assertEquals(0,temporaries());
 }
 @Test public void slowRecorderStartNeverOwnsGlobalDatabaseLock()throws Exception{
         // Production initializes the DB before media recording/import.
         LocalDatabase.write(root,"{\"schema\":1,\"records\":[]}");
  CountDownLatch entered=new CountDownLatch(1),resume=new CountDownLatch(1);Recorder recorder=new Recorder(){@Override public void start(File file)throws Exception{super.start(file);entered.countDown();if(!resume.await(5,TimeUnit.SECONDS))throw new IOException("test timeout");}};AudioCapture capture=new AudioCapture(media,prefs,()->recorder);ExecutorService workers=Executors.newFixedThreadPool(2);
  try{Future<Boolean> starting=workers.submit(()->capture.start("voice-slow"));assertTrue(entered.await(2,TimeUnit.SECONDS));Future<?> saved=workers.submit(()->{try{LocalDatabase.write(root,"{\"schema\":1,\"records\":[]}");}catch(Exception failure){throw new CompletionException(failure);}});saved.get(2,TimeUnit.SECONDS);assertEquals("{\"schema\":1,\"records\":[]}",LocalDatabase.read(root));resume.countDown();assertTrue(starting.get(2,TimeUnit.SECONDS));capture.close();assertEquals(0,temporaries());assertFalse(new File(media,"voice-slow").exists());}finally{resume.countDown();capture.close();workers.shutdownNow();}
 }
}
