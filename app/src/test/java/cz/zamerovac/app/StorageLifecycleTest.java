package cz.zamerovac.app;

import android.content.*;
import android.graphics.*;
import android.media.ExifInterface;
import android.net.Uri;
import android.webkit.ValueCallback;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.*;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.security.MessageDigest;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.zip.*;
import static org.junit.Assert.*;

/** Real native files/ZIP/bitmap operations under Robolectric; does not claim an installed-app update. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35) @GraphicsMode(GraphicsMode.Mode.NATIVE)
public class StorageLifecycleTest {
    Context context; MainActivity activity; SharedPreferences prefs; File dir;
    @Before public void setup()throws Exception {
        context=RuntimeEnvironment.getApplication();activity=Robolectric.buildActivity(MainActivity.class).get();
        prefs=context.getSharedPreferences("lifecycle-"+UUID.randomUUID(),0);
        ReflectionHelpers.setField(activity,"settings",prefs);ReflectionHelpers.setField(activity,"web",org.mockito.Mockito.mock(android.webkit.WebView.class));dir=new File(context.getFilesDir(),"media");dir.mkdirs();
    }
    Object call(String name,Class<?>[] types,Object...args)throws Exception {
        java.lang.reflect.Method m=MainActivity.class.getDeclaredMethod(name,types);m.setAccessible(true);
        try{return m.invoke(activity,args);}catch(java.lang.reflect.InvocationTargetException e){throw (Exception)e.getCause();}
    }
    String digest(File f)throws Exception {return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(Files.readAllBytes(f.toPath())));}
    JSONObject fixture()throws Exception {return new JSONObject("{\"schema\":1,\"prefs\":{\"unit\":\"in\"},\"records\":[{\"id\":\"project\",\"kind\":\"folder\",\"parentId\":null},{\"id\":\"photo-record\",\"kind\":\"photo\",\"parentId\":\"project\",\"media\":[\"original-photo\"],\"items\":[{\"id\":\"dim\",\"type\":\"dimension\",\"measure\":\"0,000000123456789\",\"unit\":\"in\",\"a\":{\"x\":0.125,\"y\":999.5},\"b\":{\"x\":1234.56789,\"y\":0.5},\"media\":[\"original-photo\"],\"detailItems\":[{\"measure\":\"1250,123456789\",\"media\":[\"original-video\"]}]}]},{\"id\":\"video-record\",\"kind\":\"video\",\"parentId\":\"project\",\"media\":[\"original-video\"]}]}");}
    void persist(JSONObject db)throws Exception {call("writeDb",new Class[]{String.class},db.toString());}
    Map<String,byte[]> entries(byte[] archive)throws Exception {
        Map<String,byte[]> result=new HashMap<>();try(ZipInputStream in=new ZipInputStream(new ByteArrayInputStream(archive))){ZipEntry e;while((e=in.getNextEntry())!=null){assertNull(result.put(e.getName(),in.readAllBytes()));}}return result;
    }
    byte[] export()throws Exception {ByteArrayOutputStream out=new ByteArrayOutputStream();call("exportArchive",new Class[]{OutputStream.class,String.class},out,null);return out.toByteArray();}
    File zip(JSONObject db,Map<String,byte[]> media)throws Exception {
        File f=File.createTempFile("lifecycle-",".zip",context.getCacheDir());
        try(ZipOutputStream out=new ZipOutputStream(new FileOutputStream(f))){
            out.putNextEntry(new ZipEntry("projects.json"));out.write(db.toString().getBytes(StandardCharsets.UTF_8));out.closeEntry();
            for(Map.Entry<String,byte[]> e:media.entrySet()){out.putNextEntry(new ZipEntry(e.getKey()));out.write(e.getValue());out.closeEntry();}
        }return f;
    }
    Map<String,byte[]> media()throws Exception {
        Map<String,byte[]> result=Map.of("media/original-photo",new byte[]{1,2,3,4},"media/original-video",new byte[]{0,0,0,24,102,116,121,112});
        for(Map.Entry<String,byte[]> e:result.entrySet())Files.write(new File(context.getFilesDir(),e.getKey()).toPath(),e.getValue());return result;
    }
    @Test public void repeatedRestoreCreatesIntentionalIsolatedCopiesAndPreservesAllLinks()throws Exception {
        JSONObject original=fixture();String before=original.toString();Map<String,byte[]> bytes=media();File archive=zip(original,bytes);JSONObject current=original;
        for(int repeat=0;repeat<3;repeat++){
            current=BackupImporter.importZip(context,Uri.fromFile(archive),current,prefs).data;
            JSONArray records=current.getJSONArray("records");assertEquals(3+(repeat+1)*4,records.length());
            Set<String> ids=new HashSet<>();for(int i=0;i<records.length();i++)assertTrue(ids.add(records.getJSONObject(i).getString("id")));
            int offset=3+repeat*4;JSONObject root=records.getJSONObject(offset),project=records.getJSONObject(offset+1),photo=records.getJSONObject(offset+2),video=records.getJSONObject(offset+3);
            assertEquals(root.getString("id"),project.getString("parentId"));assertEquals(project.getString("id"),photo.getString("parentId"));assertEquals(project.getString("id"),video.getString("parentId"));
            JSONObject item=photo.getJSONArray("items").getJSONObject(0);assertEquals("0,000000123456789",item.getString("measure"));assertEquals("in",item.getString("unit"));assertEquals(fixture().getJSONArray("records").getJSONObject(1).getJSONArray("items").getJSONObject(0).getJSONObject("a").toString(),item.getJSONObject("a").toString());
            assertEquals(photo.getJSONArray("media").getString(0),item.getJSONArray("media").getString(0));assertEquals(video.getJSONArray("media").getString(0),item.getJSONArray("detailItems").getJSONObject(0).getJSONArray("media").getString(0));
            for(JSONObject rec:new JSONObject[]{photo,video}){String id=rec.getJSONArray("media").getString(0);assertArrayEquals(bytes.get(rec==photo?"media/original-photo":"media/original-video"),Files.readAllBytes(new File(dir,id).toPath()));}
        }
        assertEquals(before,original.toString());for(Map.Entry<String,byte[]> e:bytes.entrySet())assertArrayEquals(e.getValue(),Files.readAllBytes(new File(context.getFilesDir(),e.getKey()).toPath()));
    }
    @Test public void cancelledPickersSettleOnceWithoutChangingConfirmedDataOrOriginals()throws Exception {
        media();persist(fixture());File db=new File(context.getFilesDir(),"projects.json");String saved=digest(db),photo=digest(new File(dir,"original-photo")),video=digest(new File(dir,"original-video"));
        AtomicInteger calls=new AtomicInteger();ReflectionHelpers.setField(activity,"fileCallback",(ValueCallback<Uri[]>)values->{assertNull(values);calls.incrementAndGet();});
        for(int request:new int[]{20,20,25,28,29,30,32})activity.onActivityResult(request,MainActivity.RESULT_CANCELED,null);
        assertEquals(1,calls.get());for(String field:new String[]{"fileCallback","pendingArchiveFolderId","pendingArchiveSelectionIds","pendingIssueZipId","pendingCustomerZip"})assertNull(ReflectionHelpers.getField(activity,field));
        assertEquals(saved,digest(db));assertEquals(photo,digest(new File(dir,"original-photo")));assertEquals(video,digest(new File(dir,"original-video")));
    }
    @Test public void parallelSaveAndFiftyExportsHaveCompleteSnapshotsAndUnchangedOriginals()throws Exception {
        media();JSONObject initial=fixture();persist(initial);String photo=digest(new File(dir,"original-photo")),video=digest(new File(dir,"original-video"));
        ExecutorService workers=Executors.newFixedThreadPool(2);CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        try{
            Future<?> saves=workers.submit(()->{try{ready.countDown();start.await();for(int i=0;i<50;i++)persist(fixture().put("sequence",i));}catch(Exception e){throw new RuntimeException(e);}});
            Future<?> exports=workers.submit(()->{try{ready.countDown();start.await();for(int i=0;i<50;i++){Map<String,byte[]> files=entries(export());JSONObject backed=new JSONObject(new String(files.get("projects.json"),StandardCharsets.UTF_8));assertEquals(initial.getJSONArray("records").toString(),backed.getJSONArray("records").toString());assertArrayEquals(new byte[]{1,2,3,4},files.get("media/original-photo"));assertArrayEquals(new byte[]{0,0,0,24,102,116,121,112},files.get("media/original-video"));}}catch(Exception e){throw new RuntimeException(e);}});
            assertTrue(ready.await(5,TimeUnit.SECONDS));start.countDown();saves.get(20,TimeUnit.SECONDS);exports.get(20,TimeUnit.SECONDS);
        }finally{workers.shutdownNow();}
        JSONObject latest=new JSONObject(activity.new JsApi().loadData());assertEquals(49,latest.getInt("sequence"));assertEquals(photo,digest(new File(dir,"original-photo")));assertEquals(video,digest(new File(dir,"original-video")));
    }
    @Test public void rotatedExifThumbnailAndCacheLeaveJpegBytesMetadataAndDimensionsUntouched()throws Exception {
        File source=new File(dir,"exif-original");Bitmap image=Bitmap.createBitmap(160,80,Bitmap.Config.ARGB_8888);Canvas canvas=new Canvas(image);canvas.drawColor(Color.RED);Paint paint=new Paint();paint.setColor(Color.BLUE);canvas.drawRect(80,0,160,80,paint);
        try(OutputStream out=new FileOutputStream(source)){image.compress(Bitmap.CompressFormat.JPEG,95,out);}image.recycle();
        ExifInterface exif=new ExifInterface(source.getPath());exif.setAttribute(ExifInterface.TAG_ORIENTATION,"6");exif.setAttribute(ExifInterface.TAG_MAKE,"Synthetic QA");exif.saveAttributes();String before=digest(source);
        for(int i=0;i<2;i++)try(InputStream in=(InputStream)call("photoThumbnail",new Class[]{String.class},source.getName())){
            Bitmap thumb=BitmapFactory.decodeStream(in);assertEquals(144,thumb.getWidth());assertEquals(144,thumb.getHeight());
            assertTrue(Color.red(thumb.getPixel(72,15))>180);assertTrue(Color.blue(thumb.getPixel(72,129))>180);thumb.recycle();
        }
        assertEquals(before,digest(source));ExifInterface after=new ExifInterface(source.getPath());assertEquals(6,after.getAttributeInt(ExifInterface.TAG_ORIENTATION,0));assertEquals("Synthetic QA",after.getAttribute(ExifInterface.TAG_MAKE));BitmapFactory.Options bounds=new BitmapFactory.Options();bounds.inJustDecodeBounds=true;BitmapFactory.decodeFile(source.getPath(),bounds);assertEquals(160,bounds.outWidth);assertEquals(80,bounds.outHeight);
    }
    @Test @Config(sdk=26) public void confirmedDatabaseSurvivesActivityPauseStopAndNewInstance()throws Exception {
        media();persist(fixture());String expected=activity.new JsApi().loadData();String video=digest(new File(dir,"original-video"));
        try(org.robolectric.android.controller.ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            assertEquals(expected,controller.get().new JsApi().loadData());controller.pause().stop();controller.start().resume();assertEquals(expected,controller.get().new JsApi().loadData());
        }
        try(org.robolectric.android.controller.ActivityController<MainActivity> reopened=Robolectric.buildActivity(MainActivity.class).setup()){
            assertEquals(expected,reopened.get().new JsApi().loadData());assertEquals(video,digest(new File(dir,"original-video")));
        }
        // This is activity/disk persistence under Robolectric, not an OS process-kill or APK-upgrade test.
    }
    @Test public void duplicateIncomingRecordIdsAreRejectedBeforeAnyMediaWrites()throws Exception {
        media();persist(fixture());JSONObject incoming=fixture();incoming.getJSONArray("records").put(new JSONObject(incoming.getJSONArray("records").getJSONObject(1).toString()));String before=digest(new File(context.getFilesDir(),"projects.json"));int count=dir.list().length;
        try{BackupImporter.importZip(context,Uri.fromFile(zip(incoming,media())),fixture(),prefs);fail("Duplicate IDs can cross-link jobs and must be rejected");}catch(IOException expected){}
        assertEquals(before,digest(new File(context.getFilesDir(),"projects.json")));assertEquals(count,dir.list().length);
    }
    @Test public void unsafeZipPathsCannotEscapeAndInvalidMediaReferencesFailSafely()throws Exception {
        JSONObject incoming=fixture();Map<String,byte[]> bytes=new HashMap<>(media());bytes.put("../escape-test",new byte[]{99});bytes.put("media/../../escape-test",new byte[]{99});
        BackupImporter.Result restored=BackupImporter.importZip(context,Uri.fromFile(zip(incoming,bytes)),fixture(),prefs);assertEquals(3,restored.recordCount);assertFalse(new File(context.getFilesDir(),"escape-test").exists());assertFalse(new File(context.getCacheDir(),"escape-test").exists());
        for(String bad:new String[]{"../secret","/absolute","x","bad.id"}){
            JSONObject invalid=fixture();invalid.getJSONArray("records").getJSONObject(1).put("media",new JSONArray().put(bad));String before=invalid.toString();int count=dir.list().length;
            try{BackupImporter.importZip(context,Uri.fromFile(zip(invalid,media())),fixture(),prefs);fail("Invalid media reference accepted: "+bad);}catch(IOException expected){}
            assertEquals(before,invalid.toString());assertEquals(count,dir.list().length);
        }
    }
    @Test public void missingAndEmptyNestedMediaAbortBeforeAnyArchiveBytes()throws Exception {
        media();persist(fixture());String before=digest(new File(context.getFilesDir(),"projects.json"));
        for(boolean empty:new boolean[]{false,true}){
            File file=new File(dir,"original-video");if(empty)Files.write(file.toPath(),new byte[0]);else assertTrue(file.delete());
            ByteArrayOutputStream out=new ByteArrayOutputStream();
            try{call("exportArchive",new Class[]{OutputStream.class,String.class},out,null);fail("Incomplete backup accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("příloha"));}
            assertEquals(0,out.size());assertEquals(before,digest(new File(context.getFilesDir(),"projects.json")));
            media();
        }
    }
    @Test public void exportWriteFailurePropagatesAndPreservesDatabaseAndOriginals()throws Exception {
        media();persist(fixture());String before=digest(new File(context.getFilesDir(),"projects.json")),photo=digest(new File(dir,"original-photo"));
        OutputStream rejected=new OutputStream(){public void write(int value)throws IOException{throw new IOException("simulated full destination");}};
        try{call("exportArchive",new Class[]{OutputStream.class,String.class},rejected,null);fail("Write failure swallowed");}catch(IOException expected){}
        assertEquals(before,digest(new File(context.getFilesDir(),"projects.json")));assertEquals(photo,digest(new File(dir,"original-photo")));
    }
    @Test public void compareAndSaveRejectsStaleSnapshotAndReportsDiskFailure()throws Exception {
        persist(fixture());MainActivity.JsApi api=activity.new JsApi();String first=api.loadData();
        String newer=fixture().put("sequence",1).toString();assertTrue(new JSONObject(api.saveDataChecked(newer,first)).getBoolean("ok"));
        JSONObject stale=new JSONObject(api.saveDataChecked(fixture().put("sequence",2).toString(),first));
        assertFalse(stale.getBoolean("ok"));assertEquals(newer,stale.getString("current"));assertEquals(newer,api.loadData());
        File blocker=new File(context.getFilesDir(),"projects.tmp");assertTrue(blocker.mkdir());
        try{JSONObject failed=new JSONObject(api.saveDataChecked(first,newer));assertFalse(failed.getBoolean("ok"));assertTrue(failed.has("error"));assertEquals(newer,api.loadData());}finally{blocker.delete();}
    }
    @Test public void failedAudioStopReleasesRecorderAndDoesNotAttachAnEmptyFile()throws Exception {
        android.media.MediaRecorder recorder=org.mockito.Mockito.mock(android.media.MediaRecorder.class);
        org.mockito.Mockito.doThrow(new RuntimeException("interrupted")).when(recorder).stop();
        ReflectionHelpers.setField(activity,"recorder",recorder);ReflectionHelpers.setField(activity,"recordingId","failed-recording");Files.write(new File(dir,"failed-recording").toPath(),new byte[]{1});
        assertFalse(activity.new JsApi().stopAudio());org.mockito.Mockito.verify(recorder).release();assertNull(ReflectionHelpers.getField(activity,"recorder"));assertFalse(new File(dir,"failed-recording").exists());
    }

    File archiveEntries(Map<String,byte[]> entries)throws Exception {
        File file=File.createTempFile("integrity-",".zip",context.getCacheDir());
        try(ZipOutputStream out=new ZipOutputStream(new FileOutputStream(file))){for(Map.Entry<String,byte[]> item:entries.entrySet()){out.putNextEntry(new ZipEntry(item.getKey()));out.write(item.getValue());out.closeEntry();}}return file;
    }
    @Test public void v2ArchiveRoundtripAndTamperOrMissingManifestFailBeforeWrites()throws Exception {
        media();persist(fixture());Map<String,byte[]> complete=entries(export());assertTrue(complete.containsKey("manifest.json"));
        BackupImporter.Result restored=BackupImporter.importZip(context,Uri.fromFile(archiveEntries(complete)),fixture(),prefs);assertEquals(3,restored.recordCount);restored.rollback(context,prefs);
        String before=digest(new File(context.getFilesDir(),"projects.json"));int count=dir.list().length;
        for(boolean strip:new boolean[]{false,true}){
            Map<String,byte[]> changed=new HashMap<>(complete);if(strip)changed.remove("manifest.json");else changed.put("media/original-photo",new byte[]{1,2,3,9});
            try{BackupImporter.importZip(context,Uri.fromFile(archiveEntries(changed)),fixture(),prefs);fail("Damaged archive accepted");}catch(IOException expected){}
            assertEquals(before,digest(new File(context.getFilesDir(),"projects.json")));assertEquals(count,dir.list().length);
        }
    }
    @Test public void mediaUploadStagesAndAcknowledgesOnlyCompleteFilesWithoutOverwritingOriginals()throws Exception {
        MainActivity.JsApi api=activity.new JsApi();String id="staged-upload";
        assertTrue(api.beginMediaChecked(id,"application/octet-stream","Synthetic",4));assertTrue(api.appendMedia(id,"AQID"));assertFalse(new File(dir,id).exists());assertFalse(api.finishMedia(id));assertFalse(new File(dir,id).exists());
        assertTrue(api.beginMediaChecked(id,"application/octet-stream","Synthetic",4));assertTrue(api.appendMedia(id,"AQIDBA=="));assertTrue(api.finishMedia(id));assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,id).toPath()));
        assertFalse(api.beginMediaChecked(id,"application/octet-stream","overwrite",4));assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,id).toPath()));assertFalse(api.finishMedia("other-upload"));
    }

}
