package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;

/** Provider boundary simulation; does not claim Google Drive or physical radio verification. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncSafetyTest {
 Context context;SharedPreferences prefs;File home;
 @Before public void setup(){context=RuntimeEnvironment.getApplication();prefs=context.getSharedPreferences("sync-safety-"+UUID.randomUUID(),0);home=context.getFilesDir();}
 JSONObject data(String rev,String value)throws Exception{return new JSONObject().put("schema",1).put("records",new JSONArray().put(new JSONObject().put("id","photo").put("rev",rev).put("measure",value)));}
 class Transport extends SyncEngine {
  JSONObject remote;CountDownLatch entered=new CountDownLatch(1),resume=new CountDownLatch(1);boolean pause=false,fail=false;
  Transport(JSONObject data){super(context,prefs);remote=data;}
  @Override protected JSONObject fetchRemote()throws Exception{entered.countDown();if(pause&&!resume.await(10,TimeUnit.SECONDS))throw new IOException("timeout");return remote;}
  @Override protected void transferMedia(JSONObject data)throws Exception{if(fail)throw new IOException("synthetic disconnection");}
  @Override protected void publishRemote(JSONObject data){}
 }
 @Test public void slowRemoteDoesNotBlockSaveAndFinalCommitKeepsBothExactValues()throws Exception {
  LocalDatabase.write(home,data("base","1,000001").toString());prefs.edit().putString("syncBase","{\"photo\":\"base\"}").commit();
  Transport transport=new Transport(data("remote","2,000000987654321"));transport.pause=true;ExecutorService workers=Executors.newFixedThreadPool(2);
  try{Future<SyncEngine.Result> sync=workers.submit(transport::sync);assertTrue(transport.entered.await(5,TimeUnit.SECONDS));
   Future<?> save=workers.submit(()->{try{LocalDatabase.write(home,data("local","3,000000123456789").toString());}catch(Exception failure){throw new RuntimeException(failure);}});
   save.get(2,TimeUnit.SECONDS);transport.resume.countDown();sync.get(10,TimeUnit.SECONDS);
   JSONArray records=new JSONObject(LocalDatabase.read(home)).getJSONArray("records");assertEquals(2,records.length());Set<String> values=new HashSet<>();for(int i=0;i<records.length();i++)values.add(records.getJSONObject(i).getString("measure"));assertEquals(Set.of("2,000000987654321","3,000000123456789"),values);assertTrue(prefs.getBoolean("syncPending",false));
  }finally{transport.resume.countDown();workers.shutdownNow();}
 }
 @Test public void transferFailurePreservesConfirmedDatabaseAndPersistsPendingState()throws Exception {
  String before=data("local","1250,123456789").toString();LocalDatabase.write(home,before);Transport transport=new Transport(data("remote","0,000001"));transport.fail=true;
  try{transport.sync();fail("Failure was hidden");}catch(IOException expected){}
  assertEquals(before,LocalDatabase.read(home));assertTrue(prefs.getBoolean("syncPending",false));
 }
 @Test public void retryCannotDuplicateConflictEvenWhenExternalRevisionsAreEqual()throws Exception {
  LocalDatabase.write(home,data("same-rev","123,000001").toString());Transport transport=new Transport(data("same-rev","456,000002"));
  for(int i=0;i<4;i++)transport.sync();JSONArray records=new JSONObject(LocalDatabase.read(home)).getJSONArray("records");assertEquals(2,records.length());
  assertNotEquals(records.getJSONObject(0).getString("measure"),records.getJSONObject(1).getString("measure"));
 }
 @Test public void sharedWriterRejectsInvalidDataBeforeTouchingConfirmedCopies()throws Exception {
  String before=data("local","17,0000009").toString();LocalDatabase.write(home,before);LocalDatabase.write(home,before);byte[] backup=Files.readAllBytes(new File(home,"projects.bak").toPath());
  try{LocalDatabase.write(home,"{\"schema\":1,\"records\":[{\"id\":\"x\"},{\"id\":\"x\"}]}");fail("Duplicate IDs accepted");}catch(IOException expected){}
  assertEquals(before,LocalDatabase.read(home));assertArrayEquals(backup,Files.readAllBytes(new File(home,"projects.bak").toPath()));
 }
 @Test public void deeplyNestedOrMalformedUtf8DataIsRejectedWithoutReplacingTheDatabase()throws Exception {
  String before=data("local","123,000001").toString();LocalDatabase.write(home,before);
  String deep="{\"schema\":1,\"records\":[],\"nested\":"+"[".repeat(200)+"0"+"]".repeat(200)+"}";
  try{LocalDatabase.write(home,deep);fail("Deep JSON accepted");}catch(IOException expected){}
  try{JsonInput.decode(new byte[]{(byte)0xc3,(byte)0x28});fail("Invalid UTF-8 accepted");}catch(IOException expected){}
  assertEquals(before,LocalDatabase.read(home));JsonInput.check(new JSONObject().put("text","Brackets [ { inside string "+(char)34+"quoted"+(char)34).toString());
 }

}
