package cz.zamerovac.app;

import android.content.*;
import android.net.Uri;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

/** Independent audit: assertions describe the desired invariant, not the existing implementation. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class Audit39FindingsTest {
 Context context; MainActivity activity; SharedPreferences prefs;
 @Before public void setup() {
  context=RuntimeEnvironment.getApplication(); activity=Robolectric.buildActivity(MainActivity.class).get();
  prefs=context.getSharedPreferences("independent-audit-"+UUID.randomUUID(),0);
  ReflectionHelpers.setField(activity,"settings",prefs);
  ReflectionHelpers.setField(activity,"web",org.mockito.Mockito.mock(android.webkit.WebView.class));
 }
 JSONObject db(JSONObject... records)throws Exception{return new JSONObject().put("schema",1).put("records",new JSONArray(Arrays.asList(records)));}
 @Test public void independentOfflineFolderMovesMustNotCreateUnreachableCycle()throws Exception {
  String a="11111111-1111-4111-8111-111111111111",b="22222222-2222-4222-8222-222222222222";
  JSONObject first=new JSONObject().put("id","folder-a").put("kind","folder").put("title","A").put("parentId",JSONObject.NULL).put("syncClock",new JSONObject().put(a,1));
  JSONObject second=new JSONObject().put("id","folder-b").put("kind","folder").put("title","B").put("parentId",JSONObject.NULL).put("syncClock",new JSONObject().put(a,1));
  JSONObject base=db(first,second),local=new JSONObject(base.toString()),remote=new JSONObject(base.toString());
  // Each offline device moves a root folder into a different root folder: both moves are locally valid.
  local.getJSONArray("records").getJSONObject(0).put("parentId","folder-b").put("syncClock",new JSONObject().put(a,2));
  remote.getJSONArray("records").getJSONObject(1).put("parentId","folder-a").put("syncClock",new JSONObject().put(a,1).put(b,1));
  JSONObject merged=new SyncEngine(context,prefs).mergePeer(local,remote);
  LocalDatabase.write(context.getFilesDir(),merged.toString());
  JSONArray records=new JSONObject(LocalDatabase.read(context.getFilesDir())).getJSONArray("records");Map<String,String> parents=new HashMap<>();
  for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);parents.put(r.getString("id"),r.optString("parentId",""));}
  for(String id:parents.keySet()){Set<String> seen=new HashSet<>();String at=id;while(parents.containsKey(at)){assertTrue("Merge committed unreachable folder cycle: "+parents,seen.add(at));at=parents.get(at);}}
 }
 @Test public void acknowledgedUnicodeDatabaseMustBeReadableImmediately()throws Exception {
  String original=db(new JSONObject().put("id","old").put("text","confirmed")).toString();
  LocalDatabase.write(context.getFilesDir(),original);
  String large=db(new JSONObject().put("id","new").put("text","č".repeat(11*1024*1024))).toString();
  assertTrue(large.length()<20*1024*1024);
  assertTrue(large.getBytes(StandardCharsets.UTF_8).length>20*1024*1024);
  JSONObject reply=new JSONObject(activity.new JsApi().saveDataChecked(large,original));
  String actual=activity.new JsApi().loadData();
  assertTrue("Acknowledged UTF-8 write reopened the previous database: ok="+reply.optBoolean("ok")+", storedBytes="+new File(context.getFilesDir(),"projects.json").length()+", actualOld="+original.equals(actual),
    reply.optBoolean("ok")?large.equals(actual):original.equals(actual));
 }
 @Test public void stalledZipProviderMustNotBlockLocalSave()throws Exception {
  String before=db().toString(); LocalDatabase.write(context.getFilesDir(),before);
  CountDownLatch reading=new CountDownLatch(1),release=new CountDownLatch(1);
  Uri uri=Uri.parse("content://synthetic.audit/stalled.zip");
  InputStream blocked=new InputStream(){public int read()throws IOException{reading.countDown();try{if(!release.await(10,TimeUnit.SECONDS))throw new IOException("fixture timeout");}catch(InterruptedException e){throw new InterruptedIOException();}return -1;}};
  Shadows.shadowOf(context.getContentResolver()).registerInputStream(uri,blocked);
  ExecutorService worker=Executors.newSingleThreadExecutor();
  try {
   activity.onActivityResult(29,MainActivity.RESULT_OK,new Intent().setData(uri));
   assertTrue("Restore never reached provider",reading.await(3,TimeUnit.SECONDS));
   Future<String> save=worker.submit(()->activity.new JsApi().saveDataChecked(db(new JSONObject().put("id","new-local")).toString(),before));
   try{assertTrue(new JSONObject(save.get(700,TimeUnit.MILLISECONDS)).getBoolean("ok"));}
   catch(TimeoutException timeout){fail("Local save is blocked by stalled ZIP provider holding TrashPurger.LOCK");}
  } finally {release.countDown();worker.shutdown();assertTrue(worker.awaitTermination(5,TimeUnit.SECONDS));}
 }
 @Test public void successfulZipExportMustFitImporterEntryLimit()throws Exception {
  File media=new File(context.getFilesDir(),"media");media.mkdirs();JSONArray ids=new JSONArray();
  // 19,998 one-byte originals plus the three mandatory metadata entries = 20,001.
  for(int i=0;i<19998;i++){String id="audit-media-"+i;ids.put(id);Files.write(new File(media,id).toPath(),new byte[]{42});}
  String before=db(new JSONObject().put("id","photo").put("kind","photo").put("media",ids)).toString();LocalDatabase.write(context.getFilesDir(),before);
  File zip=new File(context.getCacheDir(),"audit-many.zip");
  java.lang.reflect.Method export=MainActivity.class.getDeclaredMethod("exportArchive",OutputStream.class,String.class);export.setAccessible(true);
  try(OutputStream out=new FileOutputStream(zip)){try{export.invoke(activity,out,null);}catch(java.lang.reflect.InvocationTargetException rejected){assertTrue(rejected.getCause() instanceof IOException);return;}}
  try{BackupImporter.importZip(context,Uri.fromFile(zip),new JSONObject(before),prefs);}
  catch(IOException rejected){fail("Export returned success but its own importer rejects it: "+rejected.getMessage());}
 }
 @Test public void purgeRetainsExclusiveVoiceAndRemovesHistoricalPhoto()throws Exception {
  File media=new File(context.getFilesDir(),"media");media.mkdirs();
  for(String id:new String[]{"voice-only","history-only","shared-safe"})Files.write(new File(media,id).toPath(),new byte[]{1,2,3});
  JSONObject removed=new JSONObject().put("id","deleted-record").put("deleted",true)
    .put("items",new JSONArray().put(new JSONObject().put("audioMedia",new JSONArray().put("voice-only"))))
    .put("versionHistory",new JSONArray().put(new JSONObject().put("items","[{\"media\":[\"history-only\",\"shared-safe\"]}]")));
  JSONObject kept=new JSONObject().put("id","live-record").put("media",new JSONArray().put("shared-safe"));
  String saved=db(removed,kept).toString();LocalDatabase.write(context.getFilesDir(),saved);
  JSONObject result=new TrashPurger(context,prefs).purge(saved,saved,new JSONArray().put("deleted-record"),text->LocalDatabase.write(context.getFilesDir(),text));
  assertTrue(new File(media,"shared-safe").isFile());assertEquals(0,result.getInt("pending"));
  boolean voice=new File(media,"voice-only").exists(),history=new File(media,"history-only").exists();
  // Variant B deliberately retains completed/uncertain audio after trash purge.
  assertTrue("Voice must be retained",voice);assertArrayEquals(new byte[]{1,2,3},Files.readAllBytes(new File(media,"voice-only").toPath()));
  assertFalse("Ordinary historical photo cleanup must remain effective",history);
 }
}
