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
        if(!new File(context.getFilesDir(),"projects.json").exists())LocalDatabase.write(context.getFilesDir(),"{\"schema\":1,\"records\":[]}");
        Map<String,byte[]> result=Map.of("media/original-photo",new byte[]{1,2,3,4},"media/original-video",new byte[]{0,0,0,24,102,116,121,112});
        for(Map.Entry<String,byte[]> e:result.entrySet())Files.write(new File(context.getFilesDir(),e.getKey()).toPath(),e.getValue());return result;
    }
    @Test public void archiveRestoreOnCleanInstallationBootstrapsBeforeFirstOriginal()throws Exception {
        File root=Files.createTempDirectory(context.getCacheDir().toPath(),"archive-first-").toFile();
        PeerTransferTest.Device receiver=new PeerTransferTest.Device(root,"clean");
        File archive=zip(fixture(),Map.of(
            "media/original-photo",new byte[]{3,5,7,11},
            "media/original-video",new byte[]{1,2,3,4,5}));
        assertFalse(new File(receiver.home,"projects.json").exists());
        BackupImporter.Result imported=BackupImporter.restoreZip(receiver,Uri.fromFile(archive),receiver.prefs);
        JSONArray records=new JSONObject(LocalDatabase.readForCas(receiver.home)).getJSONArray("records");
        assertEquals(4,records.length());assertEquals(3,imported.recordCount);
        assertTrue(DatabaseRecovery.exists(receiver.home));
        JSONObject photo=null;for(int i=0;i<records.length();i++){
            JSONObject item=records.getJSONObject(i);
            if("photo".equals(item.optString("kind")))photo=item;
        }
        assertNotNull(photo);
        assertEquals("0,000000123456789",photo.getJSONArray("items").getJSONObject(0).getString("measure"));
        String id=photo.getJSONArray("media").getString(0);
        assertArrayEquals(new byte[]{3,5,7,11},Files.readAllBytes(new File(receiver.home,"media/"+id).toPath()));
        assertEquals(id,photo.getJSONArray("items").getJSONObject(0).getJSONArray("media").getString(0));
    }
    @Test public void archiveRestoreCannotTouchCorruptPrimaryOrResurrectOldBackup()throws Exception {
        File root=Files.createTempDirectory(context.getCacheDir().toPath(),"archive-corrupt-").toFile();
        PeerTransferTest.Device receiver=new PeerTransferTest.Device(root,"corrupt");
        String old="{\"schema\":1,\"records\":[{\"id\":\"existing\",\"measure\":\"1000,000000001\"}]}";
        String newest="{\"schema\":1,\"records\":[{\"id\":\"existing\",\"measure\":\"1585,800001234567890\"}]}";
        LocalDatabase.write(receiver.home,old);LocalDatabase.write(receiver.home,newest);
        File mediaDir=new File(receiver.home,"media");assertTrue(mediaDir.mkdir());
        byte[] original=new byte[]{9,7,5,3};File image=new File(mediaDir,"untouched-photo");
        Files.write(image.toPath(),original);
        File primary=new File(receiver.home,"projects.json"),backup=new File(receiver.home,"projects.bak");
        Files.write(primary.toPath(),"{corrupt".getBytes(StandardCharsets.UTF_8));
        byte[] broken=Files.readAllBytes(primary.toPath()),older=Files.readAllBytes(backup.toPath());
        File archive=zip(fixture(),Map.of(
            "media/original-photo",new byte[]{3,5,7,11},
            "media/original-video",new byte[]{1,2,3,4,5}));
        try{
            BackupImporter.restoreZip(receiver,Uri.fromFile(archive),receiver.prefs);
            fail("A stale backup must never authorize archive restore into a corrupt DB");
        }catch(IOException expected){}
        assertArrayEquals(broken,Files.readAllBytes(primary.toPath()));
        assertArrayEquals(older,Files.readAllBytes(backup.toPath()));
        assertArrayEquals(original,Files.readAllBytes(image.toPath()));
        assertEquals(1,mediaDir.listFiles().length);
        assertTrue(receiver.prefs.getAll().isEmpty());
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
    @Test public void missingDatabaseCannotMasqueradeAsEmptyCASAndCanRecover()throws Exception {
        media();persist(fixture());MainActivity.JsApi api=activity.new JsApi();
        String confirmed=api.loadData(),photo=digest(new File(dir,"original-photo"));
        File primary=new File(context.getFilesDir(),"projects.json"),backup=new File(context.getFilesDir(),"projects.bak");
        byte[] original=Files.readAllBytes(primary.toPath());
        byte[] recovery=backup.isFile()?Files.readAllBytes(backup.toPath()):null;
        try {
            assertTrue(primary.delete());Files.deleteIfExists(backup.toPath());
            JSONObject refused=new JSONObject(api.saveDataChecked(fixture().put("sequence",42).toString(),confirmed));
            assertFalse(refused.getBoolean("ok"));assertFalse("Missing database cannot be a valid empty conflict",refused.has("current"));
            assertTrue(refused.has("error"));assertFalse(primary.exists());assertFalse(backup.exists());
            assertEquals(photo,digest(new File(dir,"original-photo")));
        } finally {
            Files.write(primary.toPath(),original);
            if(recovery!=null)Files.write(backup.toPath(),recovery);
        }
        assertEquals(confirmed,api.loadData());
        String edited=fixture().put("sequence",43).toString();
        assertTrue(new JSONObject(api.saveDataChecked(edited,confirmed)).getBoolean("ok"));
        assertEquals(edited,api.loadData());assertEquals(photo,digest(new File(dir,"original-photo")));
        JSONObject purged=new JSONObject().put("schema",1).put("records",new JSONArray())
            .put("trashPurgedIds",new JSONArray().put("project").put("photo-record").put("video-record"))
            .put("syncTombstones",new JSONObject().put("project",new JSONObject())
                .put("photo-record",new JSONObject()).put("video-record",new JSONObject()));
        LocalDatabase.write(context.getFilesDir(),purged.toString());
        JSONObject realConflict=new JSONObject(api.saveDataChecked(edited,edited));
        assertFalse(realConflict.getBoolean("ok"));
        assertEquals(purged.toString(),realConflict.getString("current"));
        assertEquals(purged.toString(),api.loadData());assertEquals(photo,digest(new File(dir,"original-photo")));
    }
    @Test public void corruptedPrimaryWithOlderValidBackupNeverAcknowledgesCAS()throws Exception {
        media();JSONObject older=fixture();persist(older);MainActivity.JsApi api=activity.new JsApi();
        String oldText=api.loadData();
        JSONObject latest=fixture();
        JSONObject photoRecord=latest.getJSONArray("records").getJSONObject(1);
        photoRecord.getJSONArray("items").getJSONObject(0).put("measure","1585,800001234567890");
        photoRecord.getJSONArray("items").getJSONObject(0).put("laserMeasuredMm","1585.800001234567890");
        photoRecord.getJSONArray("media").put(0,"new-photo-id");
        photoRecord.getJSONArray("items").getJSONObject(0).getJSONArray("media").put(0,"new-photo-id");
        Files.write(new File(dir,"new-photo-id").toPath(),new byte[]{7,1,9,3,5});
        String newMediaDigest=digest(new File(dir,"new-photo-id"));
        String newest=latest.toString();
        assertTrue(new JSONObject(api.saveDataChecked(newest,oldText)).getBoolean("ok"));
        File primary=new File(context.getFilesDir(),"projects.json"),backup=new File(context.getFilesDir(),"projects.bak");
        assertEquals(oldText,LocalDatabase.readFile(backup));
        byte[] latestBytes=Files.readAllBytes(primary.toPath());
        String photoDigest=digest(new File(dir,"original-photo"));
        try {
            Files.write(primary.toPath(),"{broken".getBytes(StandardCharsets.UTF_8));
            byte[] corrupt=Files.readAllBytes(primary.toPath());
            assertTrue(new JSONObject(api.loadData()).getBoolean("_loadError"));
            JSONObject denied=new JSONObject(api.saveDataChecked(oldText,newest));
            assertFalse(denied.getBoolean("ok"));assertTrue(denied.has("error"));
            assertFalse("Old backup must not be a mergeable current",denied.has("current"));
            assertArrayEquals(corrupt,Files.readAllBytes(primary.toPath()));
            assertEquals(oldText,LocalDatabase.readFile(backup));
            try{LocalDatabase.write(context.getFilesDir(),oldText);fail("Direct writer replaced corrupt primary with stale backup");}catch(IOException expected){}
            try{PeerSnapshot.capture(context,prefs);fail("Background snapshot accepted stale backup");}catch(IOException expected){}
            assertEquals(newMediaDigest,digest(new File(dir,"new-photo-id")));
            assertEquals(photoDigest,digest(new File(dir,"original-photo")));
        } finally {Files.write(primary.toPath(),latestBytes);}
        assertEquals(newest,api.loadData());
        JSONObject repeat=new JSONObject(newest).put("sequence",9);
        assertTrue(new JSONObject(api.saveDataChecked(repeat.toString(),newest)).getBoolean("ok"));
        JSONObject saved=new JSONObject(api.loadData()).getJSONArray("records").getJSONObject(1);
        assertEquals("1585,800001234567890",saved.getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("1585.800001234567890",saved.getJSONArray("items").getJSONObject(0).getString("laserMeasuredMm"));
        assertEquals("new-photo-id",saved.getJSONArray("media").getString(0));
        assertEquals(newMediaDigest,digest(new File(dir,"new-photo-id")));
    }
    @Test public void lostDatabaseAfterReopenCannotLookLikeFreshInstallation()throws Exception {
        media();persist(fixture());MainActivity.JsApi api=activity.new JsApi();
        String confirmed=api.loadData(),photo=digest(new File(dir,"original-photo"));
        File primary=new File(context.getFilesDir(),"projects.json"),backup=new File(context.getFilesDir(),"projects.bak");
        byte[] primaryBytes=Files.readAllBytes(primary.toPath());
        byte[] backupBytes=backup.isFile()?Files.readAllBytes(backup.toPath()):null;
        try {
            Files.delete(primary.toPath());Files.deleteIfExists(backup.toPath());
            try(org.robolectric.android.controller.ActivityController<MainActivity> reopened=Robolectric.buildActivity(MainActivity.class).setup()){
                MainActivity.JsApi restarted=reopened.get().new JsApi();
                assertTrue(new JSONObject(restarted.loadData()).getBoolean("_loadError"));
                JSONObject denied=new JSONObject(restarted.saveDataChecked("{\"schema\":1,\"records\":[]}",""));
                assertFalse(denied.getBoolean("ok"));assertTrue(denied.has("error"));
                assertFalse(denied.has("current"));
                assertFalse(primary.exists());assertFalse(backup.exists());
                try{LocalDatabase.write(context.getFilesDir(),confirmed);fail("Automatic writer recreated a missing initialized DB");}catch(IOException expected){}
            }
            assertEquals(photo,digest(new File(dir,"original-photo")));
        } finally {
            Files.write(primary.toPath(),primaryBytes);
            if(backupBytes!=null)Files.write(backup.toPath(),backupBytes);
        }
        assertEquals(confirmed,api.loadData());
        JSONObject amended=new JSONObject(confirmed).put("sequence",87);
        assertTrue(new JSONObject(api.saveDataChecked(amended.toString(),confirmed)).getBoolean("ok"));
        assertEquals(amended.toString(),api.loadData());
    }
    @Test public void firstLaunchInitializesDatabaseBeforeFirstPhotoAndExactMeasurement()throws Exception {
        MainActivity.JsApi api=activity.new JsApi();
        File primary=new File(context.getFilesDir(),"projects.json");
        assertFalse("This test requires an untouched first-install storage",primary.exists());
        String first=api.loadData();
        JSONObject empty=new JSONObject(first);
        assertEquals(1,empty.getInt("schema"));
        assertEquals(0,empty.getJSONArray("records").length());
        assertTrue("First load must establish a durable baseline",primary.isFile());
        assertTrue(DatabaseRecovery.exists(context.getFilesDir()));
        assertEquals(first,LocalDatabase.readForCas(context.getFilesDir()));
        String id="first-original-photo";
        assertTrue(api.beginMediaChecked(id,"image/jpeg","First photo",4));
        assertTrue(api.appendMedia(id,"AQIDBA=="));
        assertTrue(api.finishMedia(id));
        File original=new File(dir,id);
        String digest=digest(original);
        JSONObject photo=new JSONObject().put("id","first-record")
            .put("kind","photo").put("media",new JSONArray().put(id))
            .put("items",new JSONArray().put(new JSONObject()
                .put("id","first-dimension")
                .put("measure","1585,800001234567890")
                .put("laserMeasuredMm","1585.800001234567890")));
        empty.getJSONArray("records").put(photo);
        String next=empty.toString();
        JSONObject saved=new JSONObject(api.saveDataChecked(next,first));
        assertTrue("First photo must be saveable without phantom database loss",saved.getBoolean("ok"));
        String actual=api.loadData();
        assertEquals(next,actual);
        JSONObject stored=new JSONObject(actual).getJSONArray("records").getJSONObject(0);
        assertEquals(id,stored.getJSONArray("media").getString(0));
        assertEquals("1585,800001234567890",stored.getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("1585.800001234567890",stored.getJSONArray("items").getJSONObject(0).getString("laserMeasuredMm"));
        assertEquals(digest,digest(original));
        JSONObject denied=new JSONObject(api.saveDataChecked(first,first));
        assertFalse("Old first-load snapshot cannot overwrite later exact dimensions",denied.getBoolean("ok"));
        assertEquals(actual,denied.getString("current"));
        assertEquals(digest,digest(original));
    }
    @Test public void cleanFirstInstallAndLegacyMediaAreDistinctWithoutChangingSchema()throws Exception {
        File clean=Files.createTempDirectory(context.getCacheDir().toPath(),"clean-cas-").toFile();
        assertEquals("",LocalDatabase.readForCas(clean));
        String initial=fixture().toString();
        LocalDatabase.write(clean,initial);
        assertEquals(initial,LocalDatabase.readForCas(clean));
        assertTrue(DatabaseRecovery.exists(clean));
        Files.delete(new File(clean,"projects.json").toPath());
        Files.deleteIfExists(new File(clean,"projects.bak").toPath());
        try{LocalDatabase.readForCas(clean);fail("Previously initialized DB vanished");}catch(IOException expected){}
        File legacy=Files.createTempDirectory(context.getCacheDir().toPath(),"legacy-cas-").toFile();
        File mediaDir=new File(legacy,"media");assertTrue(mediaDir.mkdirs());
        Files.write(new File(mediaDir,"original-photo").toPath(),new byte[]{1,2,3});
        assertFalse(DatabaseRecovery.exists(legacy));
        try{LocalDatabase.readForCas(legacy);fail("Legacy media without DB was treated as a new install");}catch(IOException expected){}
    }
    @Test public void failedAudioStopReleasesRecorderAndDoesNotAttachAnEmptyFile()throws Exception {
        AudioCapture.Recorder recorder=org.mockito.Mockito.mock(AudioCapture.Recorder.class);
        org.mockito.Mockito.doAnswer(call->{Files.write(((File)call.getArgument(0)).toPath(),new byte[]{1});return null;}).when(recorder).start(org.mockito.ArgumentMatchers.any());
        org.mockito.Mockito.doThrow(new RuntimeException("interrupted")).when(recorder).stop();
        AudioCapture capture=new AudioCapture(dir,prefs,()->recorder);assertTrue(capture.start("failed-recording"));ReflectionHelpers.setField(activity,"audioCapture",capture);
        assertFalse(activity.new JsApi().stopAudio());org.mockito.Mockito.verify(recorder).release();assertFalse(capture.active());assertFalse(new File(dir,"failed-recording").exists());assertEquals(0,dir.listFiles(file->file.getName().startsWith(".capture-")).length);
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
        assertTrue(api.beginMediaChecked(id,"application/octet-stream","Synthetic",4));assertFalse(api.appendMedia("unrelated-upload","AQIDBA=="));assertFalse(api.finishMedia("unrelated-upload"));assertTrue(api.appendMedia(id,"AQIDBA=="));assertTrue(api.finishMedia(id));assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,id).toPath()));
        assertFalse(api.beginMediaChecked(id,"application/octet-stream","overwrite",4));assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,id).toPath()));assertFalse(api.finishMedia("other-upload"));
    }
    @Test public void mediaUploadCannotAcknowledgeFailedMetadataOrUnsafeInputs()throws Exception {
        SharedPreferences failed=org.mockito.Mockito.mock(SharedPreferences.class);SharedPreferences.Editor editor=org.mockito.Mockito.mock(SharedPreferences.Editor.class);org.mockito.Mockito.when(failed.edit()).thenReturn(editor);org.mockito.Mockito.when(editor.putString(org.mockito.ArgumentMatchers.anyString(),org.mockito.ArgumentMatchers.anyString())).thenReturn(editor);org.mockito.Mockito.when(editor.commit()).thenReturn(false);ReflectionHelpers.setField(activity,"settings",failed);MainActivity.JsApi api=activity.new JsApi();
        assertFalse(api.beginMediaChecked("unsafe-input","image/png\r\nInjected: yes","file",1));assertFalse(api.beginMediaChecked("unsafe-input","image/png","line\n\nname",1));assertFalse(api.beginMediaChecked("unsafe-input","image/png","bad\ud800",1));assertTrue(api.beginMediaChecked("failed-metadata","image/png","Synthetic",4));assertTrue(api.appendMedia("failed-metadata","AQIDBA=="));assertFalse(api.finishMedia("failed-metadata"));assertFalse(new File(dir,"failed-metadata").exists());assertEquals(0,dir.listFiles(file->file.getName().contains(".upload-")).length);
    }
    @Test public void uriCopyStagesPartialDataAndDoesNotOverwriteExistingOriginal()throws Exception {
        Uri uri=Uri.parse("content://synthetic/incoming");org.robolectric.Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,new InputStream(){int reads;public int read()throws IOException{if(reads++<3)return 1;throw new IOException("synthetic interrupted source");}});
        try{call("filePicked",new Class[]{Uri.class,String.class,String.class,String.class,String.class,String.class},uri,"uri-partial","application/octet-stream","Synthetic",null,"picker-storage-test");fail("Interrupted copy acknowledged");}catch(IOException expected){}assertFalse(new File(dir,"uri-partial").exists());assertFalse(prefs.contains("mime-uri-partial"));assertEquals(0,dir.listFiles(file->file.getName().startsWith(".capture-")).length);
        org.robolectric.Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,new ByteArrayInputStream(new byte[]{1,2,3,4}));call("filePicked",new Class[]{Uri.class,String.class,String.class,String.class,String.class,String.class},uri,"uri-complete","application/octet-stream","Synthetic",null,"picker-storage-test");assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,"uri-complete").toPath()));assertEquals("Synthetic",prefs.getString("name-uri-complete",""));assertEquals("picker-storage-test",new MediaImportOwnership(prefs).owner("uri-complete"));assertTrue(new MediaImportOwnership(prefs).isPublished("uri-complete"));
        try{call("filePicked",new Class[]{Uri.class,String.class,String.class,String.class,String.class,String.class},uri,"uri-complete","image/png","Replacement",null,"picker-storage-test");fail("Original overwritten");}catch(IOException expected){}assertArrayEquals(new byte[]{1,2,3,4},Files.readAllBytes(new File(dir,"uri-complete").toPath()));assertEquals("Synthetic",prefs.getString("name-uri-complete",""));assertEquals("picker-storage-test",new MediaImportOwnership(prefs).owner("uri-complete"));assertTrue(new MediaImportOwnership(prefs).isPublished("uri-complete"));
    }

    @Test public void annotationHistoryProtectsSharedMediaDuringAnotherRecordsPurge()throws Exception {
        media();JSONObject db=fixture();JSONObject photo=db.getJSONArray("records").getJSONObject(1),video=db.getJSONArray("records").getJSONObject(2);
        photo.put("versionHistory",new JSONArray().put(new JSONObject().put("items",new JSONArray().put(new JSONObject().put("media",new JSONArray().put("original-video"))).toString())));video.put("deleted",true);persist(db);
        String snapshot=activity.new JsApi().loadData();JSONObject result=new JSONObject(activity.new JsApi().purgeTrash(snapshot,snapshot,"[\"video-record\"]"));assertFalse(result.has("error"));assertTrue(new File(dir,"original-video").isFile());
    }

}
