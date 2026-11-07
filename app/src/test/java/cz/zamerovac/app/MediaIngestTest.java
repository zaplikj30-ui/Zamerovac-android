package cz.zamerovac.app;

import android.app.Activity;
import android.content.*;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.*;
import android.webkit.WebView;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.nio.file.Files;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class MediaIngestTest {
 Context context;SharedPreferences prefs;Uri uri=Uri.parse("content://synthetic/media");
 @Before public void setup(){context=RuntimeEnvironment.getApplication();prefs=context.getSharedPreferences("ingest-test",0);}
 @Test public void providerTimeoutAndCancellationKeepDatabaseAndOriginalAndDiscardStaging()throws Exception{
  LocalDatabase.write(context.getFilesDir(),"{\"schema\":1,\"records\":[]}");String before=LocalDatabase.read(context.getFilesDir());CountDownLatch release=new CountDownLatch(1);AtomicInteger closed=new AtomicInteger();InputStream stalled=new InputStream(){public int read(){while(true)try{release.await();return -1;}catch(InterruptedException ignored){}}public void close(){closed.incrementAndGet();}};Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,stalled);
  try(ProviderIo io=new ProviderIo(80,1)){MediaIngest ingest=new MediaIngest(context,prefs,()->false,io);long started=System.nanoTime();try{ingest.copy(uri,"timed-out","image/jpeg","Synthetic");fail("Stalled source acknowledged");}catch(IOException expected){assertTrue(expected.getMessage().contains("včas"));}assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started)<3000);File media=new File(context.getFilesDir(),"media");assertFalse(new File(media,"timed-out").exists());assertEquals(0,media.listFiles(file->file.getName().startsWith(".capture-")).length);assertEquals(before,LocalDatabase.read(context.getFilesDir()));assertFalse(prefs.contains("mime-timed-out"));}
  finally{release.countDown();}
  AtomicBoolean cancel=new AtomicBoolean(true);try{new MediaIngest(context,prefs,cancel::get).copy(uri,"cancelled-file","image/jpeg","Synthetic");fail("Cancelled copy committed");}catch(InterruptedIOException expected){}assertFalse(new File(context.getFilesDir(),"media/cancelled-file").exists());
 }
 @Test public void metadataDeadlineAndUnsafeSourcesFailBeforePublishing()throws Exception{
  Context wrapper=mock(Context.class);ContentResolver resolver=mock(ContentResolver.class);when(wrapper.getContentResolver()).thenReturn(resolver);when(wrapper.getFilesDir()).thenReturn(context.getFilesDir());when(resolver.getType(uri)).thenReturn("IMAGE/JPEG");MatrixCursor cursor=new MatrixCursor(new String[]{"_display_name"});cursor.addRow(new Object[]{"žluťoučký 🧰.jpg"});when(resolver.query(eq(uri),any(String[].class),isNull(),isNull(),isNull(),any(android.os.CancellationSignal.class))).thenReturn(cursor);
  MediaIngest.Metadata valid=new MediaIngest(wrapper,prefs,()->false).metadata(uri);assertEquals("image/jpeg",valid.mime);assertEquals("žluťoučký 🧰.jpg",valid.name);
  assertEquals("application/octet-stream",new MediaIngest(wrapper,prefs,()->false).metadata(Uri.parse("content://10@synthetic/media")).mime);
  for(String path:new String[]{"file:///data/private.db","https://evil.invalid/data","javascript:bad","content://user@foreign/data"})try{new MediaIngest(wrapper,prefs,()->false).copy(Uri.parse(path),"unsafe-source","image/png","Synthetic");fail("Unsafe source read");}catch(IOException expected){}verify(resolver,never()).openInputStream(any());
  CountDownLatch release=new CountDownLatch(1);when(resolver.getType(uri)).thenAnswer(call->{while(true)try{release.await();return "image/png";}catch(InterruptedException ignored){}});try(ProviderIo io=new ProviderIo(80,1)){try{new MediaIngest(wrapper,prefs,()->false,io).metadata(uri);fail("Metadata timeout hidden");}catch(IOException expected){assertTrue(expected.getMessage().contains("včas"));}}finally{release.countDown();}
 }
 @Test public void actualActivityResultUsesWorkerLeavesUiAndConfirmedSavingAvailable()throws Exception{
  CountDownLatch reading=new CountDownLatch(1),release=new CountDownLatch(1);InputStream slow=new InputStream(){boolean supplied;public int read()throws IOException{throw new IOException("single read not used");}public int read(byte[] bytes,int offset,int length)throws IOException{if(supplied)return -1;reading.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new IOException("test timeout");}catch(InterruptedException failure){throw new InterruptedIOException();}supplied=true;bytes[offset]=1;bytes[offset+1]=2;bytes[offset+2]=3;return 3;}};Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,slow);
  ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();MainActivity.JsApi api=activity.new JsApi();try{
   api.selectFilesForRequest("media","synthetic-request-one");Shadows.shadowOf(Looper.getMainLooper()).idle();activity.onActivityResult(25,Activity.RESULT_OK,new Intent().setData(uri));assertTrue(reading.await(2,TimeUnit.SECONDS));AtomicBoolean responsive=new AtomicBoolean();new Handler(Looper.getMainLooper()).post(()->responsive.set(true));Shadows.shadowOf(Looper.getMainLooper()).idle();assertTrue(responsive.get());assertTrue((Boolean)ReflectionHelpers.getField(activity,"mediaImportBusy"));String expected=api.loadData();assertTrue(new JSONObject(api.saveDataChecked("{\"schema\":1,\"records\":[]}",expected)).getBoolean("ok"));assertTrue(new JSONObject(api.purgeTrash(api.loadData(),api.loadData(),"[]")).has("error"));release.countDown();
   long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);while(System.nanoTime()<deadline){Shadows.shadowOf(Looper.getMainLooper()).idle();if(!(Boolean)ReflectionHelpers.getField(activity,"mediaImportBusy"))break;Thread.sleep(10);}assertFalse((Boolean)ReflectionHelpers.getField(activity,"mediaImportBusy"));File[] files=new File(activity.getFilesDir(),"media").listFiles(file->!file.getName().startsWith("."));assertEquals(1,files.length);assertArrayEquals(new byte[]{1,2,3},Files.readAllBytes(files[0].toPath()));SharedPreferences ownershipPrefs=ReflectionHelpers.getField(activity,"settings");MediaImportOwnership owned=new MediaImportOwnership(ownershipPrefs);assertEquals("synthetic-request-one",owned.owner(files[0].getName()));assertTrue(owned.isPublished(files[0].getName()));WebView web=ReflectionHelpers.getField(activity,"web");assertTrue(Shadows.shadowOf(web).getLastEvaluatedJavascript().contains("synthetic-request-one"));assertEquals(0,new JSONObject(LocalDatabase.read(activity.getFilesDir())).getJSONArray("records").length());
  }finally{release.countDown();controller.pause().stop().destroy();}
 }
}
