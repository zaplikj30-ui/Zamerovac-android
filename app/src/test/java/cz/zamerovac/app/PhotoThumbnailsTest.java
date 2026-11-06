package cz.zamerovac.app;
import android.graphics.*;
import android.media.ExifInterface;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class PhotoThumbnailsTest {
 File root,source;
 @Before public void setup()throws Exception{root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"cold-photo-").toFile();source=new File(root,"synthetic-photo");Bitmap bitmap=Bitmap.createBitmap(160,160,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(bitmap);Paint paint=new Paint();paint.setColor(Color.RED);canvas.drawRect(0,0,80,160,paint);paint.setColor(Color.BLUE);canvas.drawRect(80,0,160,160,paint);try(OutputStream out=new FileOutputStream(source)){bitmap.compress(Bitmap.CompressFormat.JPEG,95,out);}bitmap.recycle();}
 @Test public void coldDecoderDoesNotBlockDatabaseAndPurgedSourceCannotPublishLateCache()throws Exception{
  CountDownLatch entered=new CountDownLatch(1),resume=new CountDownLatch(1);PhotoThumbnails thumbnails=new PhotoThumbnails(){@Override protected Bitmap decode(File file,BitmapFactory.Options options){if(options.inJustDecodeBounds){assertFalse(Thread.holdsLock(TrashPurger.LOCK));entered.countDown();try{if(!resume.await(5,TimeUnit.SECONDS))throw new AssertionError("Test decoder wait timed out");}catch(InterruptedException error){throw new AssertionError(error);}}return super.decode(file,options);}};ExecutorService workers=Executors.newFixedThreadPool(2);File cache=new File(root,"thumbs"),home=new File(root,"database");home.mkdirs();
  try{Future<InputStream> thumbnail=workers.submit(()->thumbnails.open(source,cache));assertTrue(entered.await(5,TimeUnit.SECONDS));Future<?> save=workers.submit(()->{try{LocalDatabase.write(home,new JSONObject().put("schema",1).put("records",new JSONArray()).toString());}catch(Exception failure){throw new CompletionException(failure);}});save.get(2,TimeUnit.SECONDS);synchronized(TrashPurger.LOCK){assertTrue(source.delete());}resume.countDown();assertNull(thumbnail.get(5,TimeUnit.SECONDS));assertFalse(new File(cache,"synthetic-photo.jpg").exists());}finally{resume.countDown();workers.shutdownNow();}
 }
 @Test public void mirroredExifThumbnailAndReusePreserveEveryOriginalByte()throws Exception{
  ExifInterface exif=new ExifInterface(source.getPath());exif.setAttribute(ExifInterface.TAG_ORIENTATION,String.valueOf(ExifInterface.ORIENTATION_FLIP_HORIZONTAL));exif.saveAttributes();byte[] original=Files.readAllBytes(source.toPath());PhotoThumbnails thumbnails=new PhotoThumbnails();File cache=new File(root,"thumbs");for(int i=0;i<2;i++)try(InputStream in=thumbnails.open(source,cache)){assertNotNull(in);Bitmap thumb=BitmapFactory.decodeStream(in);assertEquals(144,thumb.getWidth());int left=thumb.getPixel(20,72),right=thumb.getPixel(124,72);assertTrue(Color.blue(left)>Color.red(left));assertTrue(Color.red(right)>Color.blue(right));thumb.recycle();}assertArrayEquals(original,Files.readAllBytes(source.toPath()));
 }
 @Test public void malformedImageAndCacheWriteFailureDoNotTouchOriginal()throws Exception{
  byte[] original=Files.readAllBytes(source.toPath());File blocker=new File(root,"not-directory");Files.write(blocker.toPath(),new byte[]{1});try{new PhotoThumbnails().open(source,blocker);fail("Cache failure hidden");}catch(IOException expected){}assertArrayEquals(original,Files.readAllBytes(source.toPath()));Files.write(source.toPath(),new byte[]{1,2,3});assertNull(new PhotoThumbnails().open(source,new File(root,"thumbs")));assertArrayEquals(new byte[]{1,2,3},Files.readAllBytes(source.toPath()));
 }
}
