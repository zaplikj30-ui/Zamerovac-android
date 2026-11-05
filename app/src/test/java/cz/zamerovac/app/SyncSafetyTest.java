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

 static final String A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222";
 JSONObject clock(long a,long b)throws Exception{JSONObject value=new JSONObject();if(a>0)value.put(A,a);if(b>0)value.put(B,b);return value;}
 JSONObject version(String rev,String measure,JSONObject clock)throws Exception{JSONObject result=data(rev,measure);result.getJSONArray("records").getJSONObject(0).put("syncClock",clock);return result;}
 @Test public void causalRevisionBeatsWallClockWithoutChangingMeasurement()throws Exception {
  JSONObject local=version("local","123,000000123456789",clock(2,0)),remote=version("remote","999,000001",clock(1,0));remote.getJSONArray("records").getJSONObject(0).put("updatedAt","9999-12-31");LocalDatabase.write(home,local.toString());new Transport(remote).sync();
  JSONArray records=new JSONObject(LocalDatabase.read(home)).getJSONArray("records");assertEquals(1,records.length());assertEquals("123,000000123456789",records.getJSONObject(0).getString("measure"));
 }
 @Test public void concurrentPurgeKeepsIndependentEditAsOneStableCopyAndNeverRevivesOriginal()throws Exception {
  JSONObject local=new JSONObject().put("schema",1).put("records",new JSONArray()).put("trashPurgedIds",new JSONArray().put("photo")).put("syncTombstones",new JSONObject().put("photo",clock(1,1)));
  LocalDatabase.write(home,local.toString());Transport transport=new Transport(version("independent","0,000000123456789",clock(2,0)));
  for(int i=0;i<4;i++)transport.sync();JSONArray records=new JSONObject(LocalDatabase.read(home)).getJSONArray("records");assertEquals(1,records.length());assertNotEquals("photo",records.getJSONObject(0).getString("id"));assertEquals("photo",records.getJSONObject(0).getString("conflictOf"));assertEquals("0,000000123456789",records.getJSONObject(0).getString("measure"));
  transport.remote=version("old","999,000001",clock(1,0));transport.sync();assertEquals(1,new JSONObject(LocalDatabase.read(home)).getJSONArray("records").length());
 }
 @Test public void purgedConflictDoesNotReviveAndLegacyCopyDoesNotMultiply()throws Exception{
  JSONObject record=version("independent","0,000000123456789",clock(2,0)).getJSONArray("records").getJSONObject(0),copy=SyncConflicts.purged("photo",record,clock(1,1));String copyId=copy.getString("id");JSONObject local=new JSONObject().put("schema",1).put("records",new JSONArray()).put("syncTombstones",new JSONObject().put("photo",clock(1,1)).put(copyId,clock(2,2)));JSONObject remote=new JSONObject().put("schema",1).put("records",new JSONArray().put(record));assertEquals(0,new SyncEngine(context,prefs).mergePeer(local,remote).getJSONArray("records").length());
  copy.put("id","legacy-copy");local.getJSONObject("syncTombstones").remove(copyId);local.put("records",new JSONArray().put(copy));JSONArray result=new SyncEngine(context,prefs).mergePeer(local,remote).getJSONArray("records");assertEquals(1,result.length());assertEquals("legacy-copy",result.getJSONObject(0).getString("id"));
 }
 @Test public void durableQueueSurvivesReopenAndRejectsStaleOrInvalidRevision()throws Exception {
  SyncQueueStore store=new SyncQueueStore(home);assertEquals(0,new JSONObject(store.read()).getInt("revision"));String one="{\"version\":2,\"revision\":1,\"jobs\":[]}";assertTrue(store.save(0,one));assertEquals(one,new SyncQueueStore(home).read());assertFalse(store.save(0,one));
  try{store.save(1,"{\"version\":2,\"revision\":2.5,\"jobs\":[]}");fail("Fractional revision accepted");}catch(Exception expected){}assertEquals(one,store.read());
  File blocker=new File(home,"sync-queue-v2.json.new");blocker.mkdirs();java.nio.file.Files.write(new File(blocker,"block").toPath(),new byte[]{1});
  try{try{store.save(1,"{\"version\":2,\"revision\":2,\"jobs\":[]}");fail("Write failure hidden");}catch(IOException expected){}assertEquals(one,store.read());}finally{new File(blocker,"block").delete();blocker.delete();}
 }
 @Test public void installationIdentityIsStableAndVectorsValidateExactCounters()throws Exception {
  String id=DeviceIdentity.get(context.getNoBackupFilesDir());assertTrue(DeviceIdentity.valid(id));assertEquals(id,DeviceIdentity.get(context.getNoBackupFilesDir()));assertNotEquals(id,DeviceIdentity.get(new File(context.getNoBackupFilesDir(),"another-installation")));assertEquals("concurrent",CausalClock.compare(clock(1,0),clock(0,1)));assertEquals(2,CausalClock.advance(clock(1,0),A).getLong(A));
  try{CausalClock.advance(new JSONObject().put(A,9007199254740991L),A);fail("Overflow accepted");}catch(IOException expected){}
 }

 @Test public void webBridgeCannotInvokeLegacyUnconditionalDatabaseWriter()throws Exception {
  assertNull(MainActivity.JsApi.class.getDeclaredMethod("saveData",String.class).getAnnotation(android.webkit.JavascriptInterface.class));
  assertNotNull(MainActivity.JsApi.class.getDeclaredMethod("saveDataChecked",String.class,String.class).getAnnotation(android.webkit.JavascriptInterface.class));
 }

}
