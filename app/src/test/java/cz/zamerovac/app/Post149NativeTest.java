package cz.zamerovac.app;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import android.app.Application;
import android.bluetooth.*;
import android.content.Context;
import android.content.Intent;
import android.graphics.*;
import android.media.MediaPlayer;
import android.os.*;
import android.util.Base64;
import android.widget.*;
import java.io.*;
import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.concurrent.atomic.AtomicReference;
import java.util.zip.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;
import org.robolectric.util.ReflectionHelpers;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@LooperMode(LooperMode.Mode.PAUSED)
public class Post149NativeTest {
    private static Object call(Object target,String name,Class<?>[] types,Object... args)throws Exception {
        Method method=target.getClass().getDeclaredMethod(name,types);method.setAccessible(true);return method.invoke(target,args);
    }
    private static Object field(Object target,String name){return ReflectionHelpers.getField(target,name);}
    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    public void pagesStayTogetherAndIncompletePdfCannotBeSaved()throws Exception {
        Context context=RuntimeEnvironment.getApplication();
        CustomerPdfExport export=new CustomerPdfExport(context.getCacheDir());
        Bitmap bitmap=Bitmap.createBitmap(100,60,Bitmap.Config.ARGB_8888);bitmap.eraseColor(Color.RED);
        ByteArrayOutputStream png=new ByteArrayOutputStream();bitmap.compress(Bitmap.CompressFormat.PNG,100,png);bitmap.recycle();
        String image=Base64.encodeToString(png.toByteArray(),Base64.NO_WRAP);
        export.begin("Poznámky");export.addPage(image);
        try{export.archive();fail("Incomplete PDF accepted");}catch(IOException expected){}
        export.addPage(image);export.addPage(image);export.end();
        File archive=export.archive();
        java.nio.file.Files.copy(archive.toPath(),new File("build/customer-pdf-multipage.zip").toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        try(ZipInputStream zip=new ZipInputStream(new FileInputStream(archive))){
            assertTrue(zip.getNextEntry().getName().endsWith(".pdf"));
            String pdf=new String(zip.readAllBytes(),StandardCharsets.ISO_8859_1);
            assertTrue(pdf.contains("/Count 3"));assertEquals(3,pdf.split("/Subtype /Image",-1).length-1);
            assertFalse(pdf.contains("/Metadata"));assertFalse(pdf.contains("/EmbeddedFiles"));
            assertNull(zip.getNextEntry());
        }finally{export.close();}
    }
    @Test public void earlyGattCallbackIsQueuedAndTimeoutClosesOnlyItsOwnSession()throws Exception {
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();BluetoothDevice device=mock(BluetoothDevice.class);
            BluetoothGatt connection=mock(BluetoothGatt.class);AtomicReference<BluetoothGattCallback> callback=new AtomicReference<>();
            when(device.getAddress()).thenReturn("00:11:22:33:44:55");when(device.getName()).thenReturn("GLM 100-25 C");
            when(connection.discoverServices()).thenReturn(true);
            when(device.connectGatt(eq(activity),eq(false),any(BluetoothGattCallback.class),eq(BluetoothDevice.TRANSPORT_LE)))
                .thenAnswer(invocation->{BluetoothGattCallback cb=invocation.getArgument(2);callback.set(cb);
                    cb.onConnectionStateChange(connection,BluetoothGatt.GATT_SUCCESS,BluetoothProfile.STATE_CONNECTED);return connection;});
            call(activity,"connectGatt",new Class<?>[]{BluetoothDevice.class},device);
            assertSame(connection,field(activity,"gatt"));verify(connection,never()).close();
            Shadows.shadowOf(Looper.getMainLooper()).idle();verify(connection).discoverServices();
            // Cancel while services are pending. Late successful discovery cannot revive it.
            call(activity,"stopLaserConnection",new Class<?>[]{});
            callback.get().onServicesDiscovered(connection,BluetoothGatt.GATT_SUCCESS);
            Shadows.shadowOf(Looper.getMainLooper()).idle();assertNull(field(activity,"gatt"));
            verify(connection,never()).getService(any());
            BluetoothGatt second=mock(BluetoothGatt.class);
            when(device.connectGatt(eq(activity),eq(false),any(BluetoothGattCallback.class),eq(BluetoothDevice.TRANSPORT_LE))).thenReturn(second);
            call(activity,"connectGatt",new Class<?>[]{BluetoothDevice.class},device);
            BluetoothGattCharacteristic stale=mock(BluetoothGattCharacteristic.class);
            when(stale.getUuid()).thenReturn(BoschBleProtocol.MEASUREMENT_UUID);
            callback.get().onCharacteristicWrite(connection,stale,BluetoothGatt.GATT_SUCCESS);
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertSame(second,field(activity,"gatt"));assertFalse((boolean)field(activity,"boschStreamEnabled"));
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(21));
            assertNull(field(activity,"gatt"));verify(second).disconnect();verify(second).close();
            assertFalse((boolean)field(activity,"boschStreamEnabled"));
        }
    }
    @Test public void permissionReplyAfterCancelDoesNotRestartScan()throws Exception {
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();
            call(activity,"startScan",new Class<?>[]{boolean.class},true);
            assertTrue((boolean)field(activity,"pendingLaserPermission"));
            call(activity,"stopLaserConnection",new Class<?>[]{});int generation=(int)field(activity,"laserConnectionGeneration");
            activity.onRequestPermissionsResult(31,new String[]{android.Manifest.permission.BLUETOOTH_SCAN,android.Manifest.permission.BLUETOOTH_CONNECT},new int[]{0,0});
            Shadows.shadowOf(Looper.getMainLooper()).idle();
            assertEquals(generation,(int)field(activity,"laserConnectionGeneration"));assertNull(field(activity,"scanCallback"));
        }
    }
    @Test public void videoTimeoutAndErrorsPreserveOriginalAndPauseReleasesPlayback()throws Exception {
        Application app=RuntimeEnvironment.getApplication();File dir=new File(app.getFilesDir(),"media");dir.mkdirs();
        File original=new File(dir,"video-test");byte[] bytes={0,1,2,3,4};java.nio.file.Files.write(original.toPath(),bytes);
        Intent intent=new Intent(app,VideoActivity.class).putExtra("mediaId","video-test");
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent).setup()){
            VideoActivity activity=controller.get();VideoView video=(VideoView)field(activity,"video");
            MediaPlayer.OnInfoListener info=ReflectionHelpers.getField(video,"mOnInfoListener");
            // Rendering start cancels the deadline; normal videos can exceed twenty seconds.
            info.onInfo(null,MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START,0);
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(21));assertFalse((boolean)field(activity,"failed"));
            info.onInfo(null,MediaPlayer.MEDIA_INFO_BUFFERING_START,0);
            controller.pause();
            info.onInfo(null,MediaPlayer.MEDIA_INFO_BUFFERING_START,0);
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(21));
            assertFalse((boolean)field(activity,"failed"));controller.resume();
            Shadows.shadowOf(Looper.getMainLooper()).idleFor(Duration.ofSeconds(21));assertTrue((boolean)field(activity,"failed"));
            assertTrue(((TextView)field(activity,"status")).getText().toString().contains("včas"));
            // Late platform events cannot replace the error by an endless loading message.
            info.onInfo(null,MediaPlayer.MEDIA_INFO_BUFFERING_START,0);
            assertTrue(((TextView)field(activity,"status")).getText().toString().contains("včas"));
        }
        assertArrayEquals(bytes,java.nio.file.Files.readAllBytes(original.toPath()));
    }
    @Test public void videoRejectsMissingAndTraversalIds(){
        for(String id:new String[]{"../projects.json","missing-file"}){
            Intent intent=new Intent(RuntimeEnvironment.getApplication(),VideoActivity.class).putExtra("mediaId",id);
            try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent).create()){
                assertTrue(controller.get().isFinishing());
            }
        }
    }
    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    public void videoThumbnailCacheAndUnsupportedFormatNeverChangeOriginal()throws Exception {
        Context context=RuntimeEnvironment.getApplication();File source=new File(context.getCacheDir(),"synthetic-video");
        byte[] original={1,4,9,16};java.nio.file.Files.write(source.toPath(),original);
        File cache=new File(context.getCacheDir(),"synthetic-thumbnails");
        android.media.MediaMetadataRetriever decoder=mock(android.media.MediaMetadataRetriever.class);
        when(decoder.getScaledFrameAtTime(0,android.media.MediaMetadataRetriever.OPTION_CLOSEST_SYNC,288,288))
            .thenAnswer(invocation->{Bitmap frame=Bitmap.createBitmap(300,150,Bitmap.Config.ARGB_8888);frame.eraseColor(Color.BLUE);return frame;});
        try(VideoThumbnails thumbnails=new VideoThumbnails(()->decoder,1000)){
            try(InputStream stream=thumbnails.open(source,cache)){
                Bitmap preview=BitmapFactory.decodeStream(stream);assertEquals(144,preview.getWidth());assertEquals(144,preview.getHeight());preview.recycle();
            }
            try(InputStream stream=thumbnails.open(source,cache)){assertNotNull(stream);}
            verify(decoder,times(1)).setDataSource(source.getAbsolutePath());
            assertTrue(source.setLastModified(new File(cache,source.getName()+".jpg").lastModified()+1000));
            try(InputStream stream=thumbnails.open(source,cache)){assertNotNull(stream);}
            try(InputStream stream=thumbnails.open(source,cache)){assertNotNull(stream);}
            verify(decoder,times(2)).setDataSource(source.getAbsolutePath());
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(source.toPath()));
        File bad=new File(context.getCacheDir(),"unsupported-video");java.nio.file.Files.write(bad.toPath(),original);
        android.media.MediaMetadataRetriever unsupported=mock(android.media.MediaMetadataRetriever.class);
        try(VideoThumbnails thumbnails=new VideoThumbnails(()->unsupported,1000)){
            assertNull(thumbnails.open(bad,cache));assertNull(thumbnails.open(bad,cache));
            verify(unsupported,times(1)).setDataSource(bad.getAbsolutePath());
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(bad.toPath()));
    }
    @Test(timeout=10000) public void blockedThumbnailCannotHoldDataLockOrLoadForever()throws Exception {
        Context context=RuntimeEnvironment.getApplication();File source=new File(context.getCacheDir(),"blocked-video");
        java.nio.file.Files.write(source.toPath(),new byte[]{1,2});
        java.util.concurrent.CountDownLatch started=new java.util.concurrent.CountDownLatch(1),release=new java.util.concurrent.CountDownLatch(1);
        android.media.MediaMetadataRetriever decoder=mock(android.media.MediaMetadataRetriever.class);
        doAnswer(invocation->{started.countDown();release.await();return null;}).when(decoder).setDataSource(anyString());
        try(VideoThumbnails thumbnails=new VideoThumbnails(()->decoder,50)){
            assertNull(thumbnails.open(source,new File(context.getCacheDir(),"blocked-thumbs")));
            assertTrue(started.await(2,java.util.concurrent.TimeUnit.SECONDS));
            synchronized(TrashPurger.LOCK){assertTrue(source.isFile());}
        }finally{release.countDown();}
    }
    @Test public void videoUsesInternalPlayerAndReadOnlyLargeFileDescriptor()throws Exception {
        Application app=RuntimeEnvironment.getApplication();File dir=new File(app.getFilesDir(),"media");dir.mkdirs();
        File file=new File(dir,"long-video");long offset=(1L<<31)+42;
        try(RandomAccessFile out=new RandomAccessFile(file,"rw")){out.setLength(offset+1);out.seek(offset);out.write(123);}
        app.getSharedPreferences("zamerovac",0).edit().putString("mime-long-video","video/mp4").commit();
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();activity.new JsApi().openMedia("long-video");
            Intent intent=Shadows.shadowOf(activity).getNextStartedActivity();
            assertEquals(VideoActivity.class.getName(),intent.getComponent().getClassName());assertEquals("long-video",intent.getStringExtra("mediaId"));
        }
        MediaProvider provider=Robolectric.buildContentProvider(MediaProvider.class).create().get();
        android.net.Uri uri=android.net.Uri.parse("content://"+app.getPackageName()+".files/long-video");
        try(ParcelFileDescriptor descriptor=provider.openFile(uri,"r");FileInputStream in=new FileInputStream(descriptor.getFileDescriptor())){
            in.getChannel().position(offset);assertEquals(123,in.read());
        }
        try{provider.openFile(uri,"w");fail("Writable original");}catch(FileNotFoundException expected){}
        assertEquals(offset+1,file.length());file.delete();
    }

    @Test public void rotationKeepsActivityWebViewAndSavedProject()throws Exception {
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();Object web=field(activity,"web");
            String data="{\"schema\":1,\"records\":[{\"id\":\"saved-photo\",\"kind\":\"photo\",\"media\":[\"original-image\"],\"items\":[{\"measure\":\"1585,800001\",\"unit\":\"mm\"}]}]}";
            activity.new JsApi().loadData(); // confirmed first-launch DB before media
            File original=new File(activity.getFilesDir(),"media/original-image");original.getParentFile().mkdirs();
            java.nio.file.Files.write(original.toPath(),new byte[]{1,3,5,7});
            assertTrue(activity.new JsApi().saveData(data));
            for(int orientation:new int[]{android.content.res.Configuration.ORIENTATION_LANDSCAPE,android.content.res.Configuration.ORIENTATION_PORTRAIT}){
                android.content.res.Configuration configuration=new android.content.res.Configuration(activity.getResources().getConfiguration());
                configuration.orientation=orientation;configuration.screenWidthDp=orientation==2?1024:768;configuration.screenHeightDp=orientation==2?768:1024;
                controller.configurationChange(configuration);
                assertSame(activity,controller.get());assertSame(web,field(activity,"web"));
                assertEquals(data,activity.new JsApi().loadData());
            }
        }
    }

}
