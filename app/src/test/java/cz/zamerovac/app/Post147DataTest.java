package cz.zamerovac.app;

import android.content.Context;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.net.Uri;
import android.util.Base64;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.RuntimeEnvironment;
import org.robolectric.annotation.Config;
import org.robolectric.annotation.GraphicsMode;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
public class Post147DataTest {
    private Context context;
    @Before public void setup(){context=RuntimeEnvironment.getApplication();}
    private File archive(JSONObject data,boolean media)throws Exception {
        File zip=File.createTempFile("fixture-", ".zip",context.getCacheDir());
        try(ZipOutputStream out=new ZipOutputStream(new FileOutputStream(zip))){
            out.putNextEntry(new ZipEntry("projects.json"));out.write(data.toString().getBytes(StandardCharsets.UTF_8));out.closeEntry();
            if(media){out.putNextEntry(new ZipEntry("media/original-photo"));out.write(new byte[]{1,2,3,4,5});out.closeEntry();}
        }
        return zip;
    }
    private JSONObject legacy()throws Exception {
        return new JSONObject("{\"schema\":1,\"prefs\":{\"unit\":\"in\"},\"records\":[{\"id\":\"old-photo\",\"kind\":\"photo\",\"title\":\"Kuchyň – stěna.jpg\",\"parentId\":null,\"media\":[\"original-photo\"],\"text\":\"soukromé\",\"items\":[{\"id\":\"dim\",\"type\":\"chain\",\"measure\":\"1250,123456\",\"unit\":\"mm\",\"points\":[{\"x\":1.25,\"y\":5},{\"x\":700.5,\"y\":8}],\"segmentData\":[{\"measure\":\"1250,123456\",\"unit\":\"mm\",\"text\":\"přesné\"}],\"futureField\":\"preserve\"}],\"versionHistory\":[{\"items\":\"legacy opaque value\"}]}]}");
    }
    @Test public void importAddsCopyAndPreservesLegacyPrecisionAndUnknownFields()throws Exception {
        JSONObject incoming=legacy(),existing=legacy();String before=existing.toString(),sourceBefore=incoming.toString();
        BackupImporter.Result result=BackupImporter.importZip(context,Uri.fromFile(archive(incoming,true)),existing,context.getSharedPreferences("test",0));
        assertEquals(before,existing.toString());assertEquals(sourceBefore,incoming.toString());
        JSONArray records=result.data.getJSONArray("records");assertEquals(3,records.length());
        assertEquals(existing.getJSONArray("records").getJSONObject(0).toString(),records.getJSONObject(0).toString());
        JSONObject root=records.getJSONObject(1),copy=records.getJSONObject(2);
        assertTrue(root.getString("title").startsWith("Kuchyň – stěna.jpg – obnovená kopie"));
        assertNotEquals("old-photo",copy.getString("id"));assertEquals(root.getString("id"),copy.getString("parentId"));
        assertEquals(incoming.getJSONArray("records").getJSONObject(0).getJSONArray("items").toString(),copy.getJSONArray("items").toString());
        assertEquals("1250,123456",copy.getJSONArray("items").getJSONObject(0).getJSONArray("segmentData").getJSONObject(0).getString("measure"));
        assertEquals("in",result.data.getJSONObject("prefs").getString("unit"));
        String newMedia=copy.getJSONArray("media").getString(0);assertNotEquals("original-photo",newMedia);
        try(InputStream in=new FileInputStream(new File(context.getFilesDir(),"media/"+newMedia))){assertArrayEquals(new byte[]{1,2,3,4,5},in.readAllBytes());}
    }
    @Test public void invalidOrIncompleteBackupCannotReplaceExistingRecords()throws Exception {
        JSONObject existing=legacy();String before=existing.toString();
        try{BackupImporter.importZip(context,Uri.fromFile(archive(legacy(),false)),existing,context.getSharedPreferences("test",0));fail("Missing media must fail");}catch(IOException expected){}
        assertEquals(before,existing.toString());
        JSONObject unsupported=legacy().put("schema",999);
        try{BackupImporter.importZip(context,Uri.fromFile(archive(unsupported,true)),existing,context.getSharedPreferences("test",0));fail("Unknown schema must fail");}catch(IOException expected){}
        assertEquals(before,existing.toString());
    }
    @Test public void originalBackupExporterRoundTripsEditableDataAndOriginalMedia()throws Exception {
        MainActivity activity=org.robolectric.Robolectric.buildActivity(MainActivity.class).get();
        android.content.SharedPreferences prefs=context.getSharedPreferences("backup-test",0);
        java.lang.reflect.Field settings=MainActivity.class.getDeclaredField("settings");settings.setAccessible(true);settings.set(activity,prefs);
        JSONObject original=legacy();
        java.nio.file.Files.write(new File(activity.getFilesDir(),"projects.json").toPath(),original.toString().getBytes(StandardCharsets.UTF_8));
        File mediaDir=new File(activity.getFilesDir(),"media");mediaDir.mkdirs();
        byte[] originalBytes={10,20,30,40};java.nio.file.Files.write(new File(mediaDir,"original-photo").toPath(),originalBytes);
        java.lang.reflect.Method export=MainActivity.class.getDeclaredMethod("exportArchive",OutputStream.class,String.class);export.setAccessible(true);
        for(String selection:new String[]{null,"old-photo"}){
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();export.invoke(activity,bytes,selection);
            Map<String,byte[]> entries=new HashMap<>();
            try(ZipInputStream zip=new ZipInputStream(new ByteArrayInputStream(bytes.toByteArray()))){ZipEntry entry;while((entry=zip.getNextEntry())!=null)entries.put(entry.getName(),zip.readAllBytes());}
            assertTrue(entries.containsKey("projects.json"));assertTrue(entries.containsKey("media-meta.json"));assertArrayEquals(originalBytes,entries.get("media/original-photo"));
            JSONObject backed=new JSONObject(new String(entries.get("projects.json"),StandardCharsets.UTF_8));
            assertEquals(original.getJSONArray("records").toString(),backed.getJSONArray("records").toString());
            File file=File.createTempFile("roundtrip-", ".zip",context.getCacheDir());java.nio.file.Files.write(file.toPath(),bytes.toByteArray());
            BackupImporter.Result result=BackupImporter.importZip(context,Uri.fromFile(file),original,prefs);
            assertEquals(original.getJSONArray("records").getJSONObject(0).getJSONArray("items").toString(),result.data.getJSONArray("records").getJSONObject(2).getJSONArray("items").toString());
        }
    }
    @Test public void unreadableDatabaseNeverBecomesWritableEmptyState()throws Exception {
        MainActivity activity=org.robolectric.Robolectric.buildActivity(MainActivity.class).get();
        File primary=new File(activity.getFilesDir(),"projects.json"),backup=new File(activity.getFilesDir(),"projects.bak");
        java.nio.file.Files.write(primary.toPath(),"broken-primary".getBytes(StandardCharsets.UTF_8));
        java.nio.file.Files.write(backup.toPath(),"broken-backup".getBytes(StandardCharsets.UTF_8));
        String loaded=activity.new JsApi().loadData();assertTrue(new JSONObject(loaded).getBoolean("_loadError"));
        java.lang.reflect.Method write=MainActivity.class.getDeclaredMethod("writeDb",String.class);write.setAccessible(true);
        try{write.invoke(activity,"{\"schema\":1,\"records\":[]}");fail("Write after failed load must be blocked");}
        catch(java.lang.reflect.InvocationTargetException expected){assertTrue(expected.getCause() instanceof IOException);}
        assertEquals("broken-primary",new String(java.nio.file.Files.readAllBytes(primary.toPath()),StandardCharsets.UTF_8));
        assertEquals("broken-backup",new String(java.nio.file.Files.readAllBytes(backup.toPath()),StandardCharsets.UTF_8));
        String recovered=legacy().toString();java.nio.file.Files.write(backup.toPath(),recovered.getBytes(StandardCharsets.UTF_8));
        assertEquals(recovered,activity.new JsApi().loadData());
        write.invoke(activity,recovered);
        assertEquals(recovered,new String(java.nio.file.Files.readAllBytes(primary.toPath()),StandardCharsets.UTF_8));
        assertEquals(recovered,new String(java.nio.file.Files.readAllBytes(backup.toPath()),StandardCharsets.UTF_8));
    }
    @Test @GraphicsMode(GraphicsMode.Mode.NATIVE)
    public void customerZipContainsOnlyRasterPdfForOneAndMultiplePhotos()throws Exception {
        Bitmap image=Bitmap.createBitmap(160,90,Bitmap.Config.ARGB_8888);image.eraseColor(Color.YELLOW);
        ByteArrayOutputStream png=new ByteArrayOutputStream();image.compress(Bitmap.CompressFormat.PNG,100,png);image.recycle();
        String encoded=Base64.encodeToString(png.toByteArray(),Base64.NO_WRAP);
        for(int count:new int[]{1,3}){
            CustomerPdfExport export=new CustomerPdfExport(context.getCacheDir());
            for(int i=0;i<count;i++)export.add("../Snímek.jpg",encoded);
            File zip=export.archive();int found=0;
            try(ZipInputStream in=new ZipInputStream(new FileInputStream(zip))){
                ZipEntry entry;
                while((entry=in.getNextEntry())!=null){
                    assertTrue(entry.getName().endsWith(".pdf"));assertFalse(entry.getName().contains("/"));
                    byte[] bytes=in.readAllBytes();String pdf=new String(bytes,StandardCharsets.ISO_8859_1);
                    assertTrue(pdf.startsWith("%PDF-"));assertTrue(pdf.contains("/Image"));
                    assertFalse(pdf.contains("projects.json"));assertFalse(pdf.contains("segmentData"));assertFalse(pdf.contains("soukromé"));
                    found++;
                }
            }
            assertEquals(count,found);
            File fixture=new File("build/customer-pdf-"+count+".zip");fixture.getParentFile().mkdirs();
            java.nio.file.Files.copy(zip.toPath(),fixture.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
            export.close();assertFalse(zip.exists());
        }
    }
    @Test public void emptyExportAndInvalidImagesFailWithoutDatabaseWrites()throws Exception {
        CustomerPdfExport export=new CustomerPdfExport(context.getCacheDir());
        try{export.archive();fail("Empty export");}catch(IOException expected){}
        try{export.add("test","invalid-image");fail("Invalid image");}catch(IOException expected){}
        export.close();
    }
}
