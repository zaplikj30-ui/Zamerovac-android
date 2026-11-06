package cz.zamerovac.app;

import android.content.*;
import android.net.Uri;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

/** Boundary/failure regressions for the six audit findings. Synthetic data only, no APK. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class Audit39SafetyTest {
    Context context;MainActivity activity;SharedPreferences prefs;
    @Before public void setup(){
        context=RuntimeEnvironment.getApplication();activity=Robolectric.buildActivity(MainActivity.class).get();prefs=context.getSharedPreferences("audit39-safety-"+UUID.randomUUID(),0);
        org.robolectric.util.ReflectionHelpers.setField(activity,"settings",prefs);org.robolectric.util.ReflectionHelpers.setField(activity,"web",org.mockito.Mockito.mock(android.webkit.WebView.class));
    }
    JSONObject db(JSONObject... records)throws Exception{return new JSONObject().put("schema",1).put("records",new JSONArray(Arrays.asList(records)));}
    JSONObject empty()throws Exception{return db();}
    JSONArray hierarchyFixtures()throws Exception{
        try(InputStream in=getClass().getResourceAsStream("/audit39-hierarchy.json")){assertNotNull(in);return new JSONArray(new String(in.readAllBytes(),StandardCharsets.UTF_8));}
    }
    static void acyclic(JSONArray records)throws Exception{
        Map<String,String> parents=new HashMap<>();for(int i=0;i<records.length();i++){JSONObject record=records.getJSONObject(i);parents.put(record.getString("id"),record.optString("parentId",""));}
        for(String id:parents.keySet()){Set<String> path=new HashSet<>();while(parents.containsKey(id)){assertTrue("cycle "+parents,path.add(id));id=parents.get(id);}}
    }
    @Test public void utf8LimitBelowAtAndAbovePreservesBothConfirmedCopies()throws Exception{
        String prefix="{\"schema\":1,\"records\":[{\"id\":\"unicode\",\"text\":\"",suffix="\"}]}";
        String previous=empty().toString();LocalDatabase.write(context.getFilesDir(),previous);
        for(int delta:new int[]{-1,0,1}){
            int padding=LocalDatabase.MAX_BYTES+delta-prefix.length()-suffix.length();
            String text=prefix+"č".repeat(padding/2)+(padding%2==1?"a":"")+suffix;
            assertEquals(LocalDatabase.MAX_BYTES+delta,text.getBytes(StandardCharsets.UTF_8).length);
            byte[] primary=Files.readAllBytes(new File(context.getFilesDir(),"projects.json").toPath());File backup=new File(context.getFilesDir(),"projects.bak");byte[] copy=backup.exists()?Files.readAllBytes(backup.toPath()):null;
            JSONObject reply=new JSONObject(activity.new JsApi().saveDataChecked(text,previous));
            assertEquals(delta<=0,reply.getBoolean("ok"));
            assertEquals(delta<=0?text:previous,activity.new JsApi().loadData());
            if(delta<=0)previous=text;else{assertArrayEquals(primary,Files.readAllBytes(new File(context.getFilesDir(),"projects.json").toPath()));assertArrayEquals(copy,Files.readAllBytes(backup.toPath()));}
        }
    }
    @Test public void sharedHierarchyFixturesConvergeAndPreserveAllPayloadsAndInputs()throws Exception{
        JSONArray fixtures=hierarchyFixtures();SyncEngine engine=new SyncEngine(context,prefs);
        for(int i=0;i<fixtures.length();i++){
            JSONObject fixture=fixtures.getJSONObject(i);JSONArray records=fixture.getJSONArray("records"),expected=fixture.getJSONArray("expected");
            JSONObject original=empty().put("records",records),repaired=engine.mergePeer(original,empty());
            assertEquals(CausalClock.canonical(expected),CausalClock.canonical(repaired.getJSONArray("records")));acyclic(repaired.getJSONArray("records"));
            assertEquals(CausalClock.canonical(records),CausalClock.canonical(original.getJSONArray("records")));
            for(int repeat=0;repeat<5;repeat++)for(JSONObject next:new JSONObject[]{engine.mergePeer(original,repaired),engine.mergePeer(repaired,original)}){
                assertEquals(expected.length(),next.getJSONArray("records").length());assertEquals(CausalClock.canonical(expected),CausalClock.canonical(next.getJSONArray("records")));repaired=next;
            }
            BackupImporter.Result restored=BackupImporter.restoreVerified(context,empty(),prefs,original,new JSONObject(),Collections.emptyMap());
            acyclic(restored.data.getJSONArray("records"));assertEquals(records.length()+1,restored.data.getJSONArray("records").length());
            for(int n=1;n<restored.data.getJSONArray("records").length();n++)assertEquals("1585,800001000000000123",restored.data.getJSONArray("records").getJSONObject(n).getJSONArray("items").getJSONObject(0).getString("measure"));
        }
    }
    File archive(JSONObject source,Map<String,byte[]> media)throws Exception{
        File file=File.createTempFile("audit39-",".zip",context.getCacheDir());try(java.util.zip.ZipOutputStream out=new java.util.zip.ZipOutputStream(new FileOutputStream(file))){out.putNextEntry(new java.util.zip.ZipEntry("projects.json"));out.write(source.toString().getBytes(StandardCharsets.UTF_8));out.closeEntry();for(Map.Entry<String,byte[]> entry:media.entrySet()){out.putNextEntry(new java.util.zip.ZipEntry("media/"+entry.getKey()));out.write(entry.getValue());out.closeEntry();}}return file;
    }
    @Test public void slowRestoreCommitsLatestLocalEditAndRollsBackFailedCommit()throws Exception{
        JSONObject source=db(new JSONObject().put("id","incoming").put("items",new JSONArray().put(new JSONObject().put("measure","0,000000000001").put("audioMedia",new JSONArray().put("voice-in")))));
        byte[] zip=Files.readAllBytes(archive(source,Map.of("voice-in",new byte[]{4,5,6})).toPath());
        CountDownLatch reading=new CountDownLatch(1),release=new CountDownLatch(1);Uri uri=Uri.parse("content://audit39/slow-valid.zip");
        Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,new ByteArrayInputStream(zip){boolean first=true;@Override public synchronized int read(byte[] b,int off,int length){if(first){first=false;reading.countDown();try{if(!release.await(5,TimeUnit.SECONDS))throw new AssertionError("fixture stalled");}catch(InterruptedException e){throw new AssertionError(e);}}return super.read(b,off,length);}});
        LocalDatabase.write(context.getFilesDir(),empty().toString());ExecutorService worker=Executors.newSingleThreadExecutor();
        try{
            Future<BackupImporter.Result> restoring=worker.submit(()->BackupImporter.restoreZip(context,uri,prefs));assertTrue(reading.await(3,TimeUnit.SECONDS));
            String local=db(new JSONObject().put("id","local").put("measure","999999,123456789")).toString();LocalDatabase.write(context.getFilesDir(),local);release.countDown();
            BackupImporter.Result result=restoring.get(10,TimeUnit.SECONDS);assertEquals(3,result.data.getJSONArray("records").length());assertEquals("999999,123456789",result.data.getJSONArray("records").getJSONObject(0).getString("measure"));assertEquals(result.data.toString(),LocalDatabase.read(context.getFilesDir()));
            Set<String> prior=new HashSet<>(Arrays.asList(new File(context.getFilesDir(),"media").list()));Map<String,?> metadata=prefs.getAll();
            // Both DB paths unreadable: commit must fail without replacing either or retaining new media.
            Files.write(new File(context.getFilesDir(),"projects.json").toPath(),"broken primary".getBytes(StandardCharsets.UTF_8));Files.write(new File(context.getFilesDir(),"projects.bak").toPath(),"broken backup".getBytes(StandardCharsets.UTF_8));
            try{BackupImporter.restoreZip(context,Uri.fromFile(archive(source,Map.of("voice-in",new byte[]{4,5,6}))),prefs);fail("Unreadable current DB must block commit");}catch(IOException expected){}
            assertEquals(prior,new HashSet<>(Arrays.asList(new File(context.getFilesDir(),"media").list())));assertEquals(metadata,prefs.getAll());assertEquals("broken primary",new String(Files.readAllBytes(new File(context.getFilesDir(),"projects.json").toPath()),StandardCharsets.UTF_8));assertEquals("broken backup",new String(Files.readAllBytes(new File(context.getFilesDir(),"projects.bak").toPath()),StandardCharsets.UTF_8));
        }finally{release.countDown();worker.shutdownNow();}
    }
    @Test public void stalledProviderTimesOutWithoutPublishingOrLeakingMedia()throws Exception{
        String before=empty().toString();LocalDatabase.write(context.getFilesDir(),before);CountDownLatch release=new CountDownLatch(1);
        Uri uri=Uri.parse("content://audit39/never.zip");Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,new InputStream(){public int read(){ProviderIoTest.uninterruptible(release);return -1;}});
        try(ProviderIo io=new ProviderIo(80,2)){
            try{BackupImporter.restoreZip(context,uri,prefs,io);fail("Provider should time out");}catch(IOException expected){assertTrue(expected.getMessage().contains("včas"));}
            assertEquals(before,LocalDatabase.read(context.getFilesDir()));assertEquals(0,prefs.getAll().size());
        }finally{release.countDown();}
    }
    @Test public void exportRejectsTotalOverTwoGiBBeforeWritingAndBudgetIncludesMetadata()throws Exception{
        File media=new File(context.getFilesDir(),"media");media.mkdirs();try(RandomAccessFile file=new RandomAccessFile(new File(media,"sparse-media"),"rw")){file.setLength(ArchiveLimits.MAX_BYTES);}
        LocalDatabase.write(context.getFilesDir(),db(new JSONObject().put("id","large").put("media",new JSONArray().put("sparse-media"))).toString());
        ByteArrayOutputStream out=new ByteArrayOutputStream();java.lang.reflect.Method export=MainActivity.class.getDeclaredMethod("exportArchive",OutputStream.class,String.class);export.setAccessible(true);
        try{export.invoke(activity,out,null);fail("Metadata plus 2 GiB exceeds importer budget");}catch(java.lang.reflect.InvocationTargetException expected){assertTrue(expected.getCause() instanceof IOException);}assertEquals(0,out.size());
        assertEquals(ArchiveLimits.MAX_BYTES,ArchiveLimits.add(ArchiveLimits.MAX_BYTES-1,1));try{ArchiveLimits.add(ArchiveLimits.MAX_BYTES,1);fail();}catch(IOException expected){}
        ArchiveLimits.entries(ArchiveLimits.MAX_ENTRIES);try{ArchiveLimits.entries(ArchiveLimits.MAX_ENTRIES+1);fail();}catch(IOException expected){}
        ArchiveLimits.json(ArchiveLimits.MAX_JSON);try{ArchiveLimits.json(ArchiveLimits.MAX_JSON+1L);fail();}catch(IOException expected){}
    }
    @Test public void purgeProtectsLiveAudioHistoryAndSeparateImmutableBackup()throws Exception{
        File media=new File(context.getFilesDir(),"media");media.mkdirs();for(String id:new String[]{"shared-audio","shared-history","exclusive"})Files.write(new File(media,id).toPath(),new byte[]{7});
        File immutable=new File(context.getFilesDir(),"Zamerovac-zalohy/backups/v2/blobs/exclusive");immutable.getParentFile().mkdirs();Files.write(immutable.toPath(),new byte[]{9});
        JSONObject deleted=new JSONObject().put("id","deleted").put("deleted",true).put("audioMedia",new JSONArray().put("shared-audio").put("exclusive")).put("versionHistory",new JSONArray().put(new JSONObject().put("items","[{\"media\":[\"shared-history\"]}]")));
        JSONObject live=new JSONObject().put("id","live").put("audioMedia",new JSONArray().put("shared-audio")).put("versionHistory",new JSONArray().put(new JSONObject().put("items","[{\"audioMedia\":[\"shared-history\"]}]")));
        String before=db(deleted,live).toString();LocalDatabase.write(context.getFilesDir(),before);new TrashPurger(context,prefs).purge(before,before,new JSONArray().put("deleted"),text->LocalDatabase.write(context.getFilesDir(),text));
        assertFalse(new File(media,"exclusive").exists());assertTrue(new File(media,"shared-audio").isFile());assertTrue(new File(media,"shared-history").isFile());assertArrayEquals(new byte[]{9},Files.readAllBytes(immutable.toPath()));
    }
    @Test public void maximumEntryArchiveRoundTripsWithAllThreeMetadataEntries()throws Exception{
        File media=new File(context.getFilesDir(),"media");media.mkdirs();JSONArray ids=new JSONArray();
        for(int i=0;i<ArchiveLimits.MAX_ENTRIES-3;i++){String id="boundary-media-"+i;ids.put(id);Files.write(new File(media,id).toPath(),new byte[]{42});}
        LocalDatabase.write(context.getFilesDir(),db(new JSONObject().put("id","boundary").put("media",ids).put("measure","1585,800001000000000123")).toString());
        File file=File.createTempFile("audit39-boundary-",".zip",context.getCacheDir());java.lang.reflect.Method export=MainActivity.class.getDeclaredMethod("exportArchive",OutputStream.class,String.class);export.setAccessible(true);
        try(OutputStream out=new FileOutputStream(file)){export.invoke(activity,out,null);}
        int count=0;try(java.util.zip.ZipInputStream in=new java.util.zip.ZipInputStream(new FileInputStream(file))){while(in.getNextEntry()!=null){count++;in.closeEntry();}}assertEquals(ArchiveLimits.MAX_ENTRIES,count);
        BackupImporter.Result restored=BackupImporter.importZip(context,Uri.fromFile(file),empty(),prefs);
        assertEquals(1,restored.recordCount);assertEquals(ids.length(),restored.createdMedia.size());assertEquals("1585,800001000000000123",restored.data.getJSONArray("records").getJSONObject(1).getString("measure"));
        for(String id:restored.createdMedia)assertArrayEquals(new byte[]{42},Files.readAllBytes(new File(media,id).toPath()));
    }
    @Test public void streamingBudgetRejectsGrowthAndOversizedJsonWithoutWritingExcessByte()throws Exception{
        final long[] written={0};OutputStream sink=new OutputStream(){public void write(int b){written[0]++;}public void write(byte[] b,int off,int length){written[0]+=length;}};
        ArchiveLimits.Budget budget=new ArchiveLimits.Budget();byte[] block=new byte[1024*1024];OutputStream data=budget.output(sink,false);
        for(int i=0;i<2048;i++)data.write(block);assertEquals(ArchiveLimits.MAX_BYTES,written[0]);
        try{budget.output(sink,true).write(1);fail("Metadata byte beyond 2 GiB accepted");}catch(IOException expected){}assertEquals(ArchiveLimits.MAX_BYTES,written[0]);
        written[0]=0;OutputStream json=new ArchiveLimits.Budget().output(sink,true);for(int i=0;i<20;i++)json.write(block);
        try{json.write(1);fail("Oversized metadata accepted");}catch(IOException expected){}assertEquals(ArchiveLimits.MAX_JSON,written[0]);
    }
}
