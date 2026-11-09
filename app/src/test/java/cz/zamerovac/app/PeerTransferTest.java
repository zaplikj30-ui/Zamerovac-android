package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

/** Full application data and real TLS loopback streams. No radio, account or customer data. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerTransferTest {
 static class Device extends ContextWrapper {
  final File home,noBackup,cache;final SharedPreferences prefs;
  Device(File root,String label){super(RuntimeEnvironment.getApplication());home=new File(root,label+"/files");noBackup=new File(root,label+"/no-backup");cache=new File(root,label+"/cache");home.mkdirs();noBackup.mkdirs();cache.mkdirs();prefs=getSharedPreferences("synthetic-"+root.getName()+label,MODE_PRIVATE);}
  @Override public File getFilesDir(){return home;} @Override public File getNoBackupFilesDir(){return noBackup;} @Override public File getCacheDir(){return cache;} @Override public Context getApplicationContext(){return this;}
 }
 PeerTlsTest tls;Device a,b;String aid,bid;SyncPeerRegistry ar,br;PeerDataStore as,bs;
 @Before public void setup()throws Exception{
  tls=new PeerTlsTest();tls.setup();a=new Device(tls.root,"source");b=new Device(tls.root,"receiver");aid=DeviceIdentity.get(a.noBackup);bid=DeviceIdentity.get(b.noBackup);ar=new SyncPeerRegistry(a.noBackup);br=new SyncPeerRegistry(b.noBackup);ar.approve(bid,tls.b.fingerprint(),"Synthetic tablet");br.approve(aid,tls.a.fingerprint(),"Synthetic phone");as=store(a,ar);bs=store(b,br);
 }
 PeerDataStore store(Device context,SyncPeerRegistry registry){return new PeerDataStore(context,context.prefs,registry,null);}
 JSONObject record(String id,String device,String value)throws Exception{return new JSONObject().put("id",id).put("type","photo").put("title","žárovka").put("syncClock",new JSONObject().put(device,1)).put("items",new JSONArray().put(new JSONObject().put("type","dimension").put("measure",value).put("unit","mm").put("points",new JSONArray().put(new JSONObject().put("x",12.125).put("y",23.875)))));}
 JSONObject db(JSONObject... records)throws Exception{JSONArray list=new JSONArray();for(JSONObject r:records)list.put(r);return new JSONObject().put("schema",1).put("records",list).put("prefs",new JSONObject().put("localOnly",true));}
 void save(Device device,JSONObject data)throws Exception{LocalDatabase.write(device.home,data.toString());}
 JSONObject read(Device device)throws Exception{return new JSONObject(LocalDatabase.read(device.home));}
 void media(Device device,JSONObject record,int count)throws Exception{if(!new File(device.home,"projects.json").exists())LocalDatabase.write(device.home,"{\"schema\":1,\"records\":[]}");JSONArray refs=new JSONArray();File directory=new File(device.home,"media");directory.mkdirs();for(int i=0;i<count;i++){String id="media-"+i;byte[] bytes=new byte[8192+i];Arrays.fill(bytes,(byte)(i+17));Files.write(new File(directory,id).toPath(),bytes);refs.put(id);device.prefs.edit().putString("mime-"+id,"image/jpeg").putString("name-"+id,"Zkušební foto "+i).commit();}record.put("media",refs);}
 void exchange(PeerTransfer.Progress sender,PeerTransfer.Progress receiver)throws Exception{
  tls.sockets(tls.b.context(br,()->false),tls.a.context(ar,()->false),socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,bid,"Synthetic tablet",tls.b,br,()->false,request->false);new PeerTransfer(bs,receiver).exchange(socket,peer,false);},socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,aid,"Synthetic phone",tls.a,ar,()->false,request->false);new PeerTransfer(as,sender).exchange(socket,peer,true);});
 }
 @Test public void firstSyncIntoCleanReceiverKeepsExactPhotoAndNoDuplicateOnRetry()throws Exception{
  JSONObject photo=record("photo-first",aid,"1585,800001234567890");
  photo.getJSONArray("items").getJSONObject(0).put("laserMeasuredMm","1585.800001234567890");
  media(a,photo,1);save(a,db(photo));
  assertFalse(new File(b.home,"projects.json").exists());
  exchange(null,null);exchange(null,null);
  assertTrue(new File(b.home,"projects.json").isFile());
  assertTrue(DatabaseRecovery.exists(b.home));
  JSONArray received=read(b).getJSONArray("records");assertEquals(1,received.length());
  JSONObject stored=received.getJSONObject(0);
  assertEquals("photo-first",stored.getString("id"));
  assertEquals("1585,800001234567890",stored.getJSONArray("items").getJSONObject(0).getString("measure"));
  assertEquals("1585.800001234567890",stored.getJSONArray("items").getJSONObject(0).getString("laserMeasuredMm"));
  assertEquals("media-0",stored.getJSONArray("media").getString(0));
  assertArrayEquals(Files.readAllBytes(new File(a.home,"media/media-0").toPath()),
      Files.readAllBytes(new File(b.home,"media/media-0").toPath()));
  exchange(null,null);
  assertEquals(1,read(b).getJSONArray("records").length());
  assertEquals(0,as.outbox.pending(bid));
 }
 @Test public void interruptedFirstPhotoTransferKeepsCleanBaselineAndResumesSafely()throws Exception{
  JSONObject photo=record("photo-first",aid,"1250,000000987654321");
  photo.getJSONArray("items").getJSONObject(0).put("laserMeasuredMm","1250.000000987654321");
  media(a,photo,2);save(a,db(photo));
  AtomicBoolean interrupted=new AtomicBoolean();
  try{
   exchange(null,(peer,phase,done,total)->{
    if("receiving".equals(phase)&&done==1&&interrupted.compareAndSet(false,true))
     throw new IOException("synthetic first-install interruption");
   });
   fail("Interrupted first photo transfer was acknowledged");
  }catch(Exception expected){assertTrue(PeerTlsTest.contains(expected,"synthetic first-install interruption"));}
  assertTrue(interrupted.get());
  assertTrue("First media must be preceded by a durable empty primary",new File(b.home,"projects.json").isFile());
  assertEquals(0,new JSONObject(LocalDatabase.readForCas(b.home)).getJSONArray("records").length());
  assertTrue(as.outbox.pending(bid)>0);
  assertEquals("1250,000000987654321",read(a).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
  as=store(a,new SyncPeerRegistry(a.noBackup));
  bs=store(b,new SyncPeerRegistry(b.noBackup));
  exchange(null,null);exchange(null,null);
  JSONArray records=read(b).getJSONArray("records");assertEquals(1,records.length());
  JSONObject stored=records.getJSONObject(0);
  assertEquals("photo-first",stored.getString("id"));
  assertEquals("1250,000000987654321",stored.getJSONArray("items").getJSONObject(0).getString("measure"));
  assertEquals("1250.000000987654321",stored.getJSONArray("items").getJSONObject(0).getString("laserMeasuredMm"));
  for(int i=0;i<2;i++)
   assertArrayEquals(Files.readAllBytes(new File(a.home,"media/media-"+i).toPath()),
       Files.readAllBytes(new File(b.home,"media/media-"+i).toPath()));
  assertEquals(0,as.outbox.pending(bid));
 }
 @Test public void diskFailureBeforePeerDatabaseCommitLeavesMetadataAndExactDataUntouched()throws Exception{
  JSONObject incoming=record("incoming-photo",aid,"1585,800001234567890");
  incoming.getJSONArray("items").getJSONObject(0).put("laserMeasuredMm","1585.800001234567890");
  media(a,incoming,1);save(a,db(incoming));
  JSONObject local=record("local-project",bid,"1250,000000123456789");
  save(b,db(local));String before=CausalClock.canonical(read(b));
  b.prefs.edit().putString("name-media-0","Original local label").commit();
  PeerSnapshot snapshot=PeerSnapshot.capture(a,a.prefs);
  File directory=new File(b.home,"media");assertTrue(directory.mkdirs());
  byte[] original=Files.readAllBytes(new File(a.home,"media/media-0").toPath());
  PeerMedia.receive(directory,"media-0",new ByteArrayInputStream(original),snapshot.media.get("media-0"));
  File blocker=new File(b.home,"projects.tmp");assertTrue(blocker.mkdir());
  File keep=new File(blocker,"force-write-failure");Files.write(keep.toPath(),new byte[]{1});
  PeerHandshake.Peer peer=new PeerHandshake.Peer(aid,"Synthetic source",tls.a.fingerprint());
  try{
   bs.apply(snapshot,peer);
   fail("Disk write fault was acknowledged as completed sync");
  }catch(IOException expected){}
  finally{assertTrue(keep.delete());assertTrue(blocker.delete());}
  assertEquals(before,CausalClock.canonical(read(b)));
  assertEquals("Original local label",b.prefs.getString("name-media-0",null));
  assertArrayEquals(original,Files.readAllBytes(new File(b.home,"media/media-0").toPath()));
  bs.apply(snapshot,peer);bs.apply(snapshot,peer);
  JSONArray records=read(b).getJSONArray("records");assertEquals(2,records.length());
  Set<String> ids=new HashSet<>();
  for(int i=0;i<records.length();i++){
   JSONObject item=records.getJSONObject(i);
   ids.add(item.getString("id"));
   if("incoming-photo".equals(item.getString("id"))){
    assertEquals("1585,800001234567890",item.getJSONArray("items").getJSONObject(0).getString("measure"));
    assertEquals("1585.800001234567890",item.getJSONArray("items").getJSONObject(0).getString("laserMeasuredMm"));
    assertEquals("media-0",item.getJSONArray("media").getString(0));
   }
  }
  assertEquals(Set.of("incoming-photo","local-project"),ids);
  assertEquals("Zkušební foto 0",b.prefs.getString("name-media-0",null));
  assertArrayEquals(original,Files.readAllBytes(new File(b.home,"media/media-0").toPath()));
 }
 @Test public void completeBidirectionalMediaAndExactAnnotationsRemainIdempotent()throws Exception{
  JSONObject photo=record("photo-a",aid,"0,000000000123456789"),note=record("note-b",bid,"99999999,123456789");media(a,photo,3);photo.put("notes",new JSONArray().put(new JSONObject().put("text","Přesná poznámka").put("audioMedia",new JSONArray().put("media-1"))));photo.getJSONArray("items").put(new JSONObject().put("type","detail").put("detailItems",new JSONArray().put(new JSONObject().put("media",new JSONArray().put("media-2")).put("measure","1585,800001"))));save(a,db(photo));save(b,db(note));
  exchange(null,null);exchange(null,null);assertEquals(2,read(a).getJSONArray("records").length());assertEquals(CausalClock.canonical(read(a)),CausalClock.canonical(read(b)));assertEquals(CausalClock.canonical(photo),CausalClock.canonical(read(b).getJSONArray("records").getJSONObject(1)));
  for(int i=0;i<3;i++)assertArrayEquals(Files.readAllBytes(new File(a.home,"media/media-"+i).toPath()),Files.readAllBytes(new File(b.home,"media/media-"+i).toPath()));assertEquals("Zkušební foto 2",b.prefs.getString("name-media-2",null));assertEquals(0,as.outbox.pending(bid));assertEquals(0,bs.outbox.pending(aid));assertTrue(new File(a.noBackup,"sync-queue-v2.json").exists());assertFalse(new File(a.home,"sync-queue-v2.json").exists());
 }
 @Test public void corruptReceiverCannotAcceptOldBackupOrAckPeerSnapshot()throws Exception{
  JSONObject source=record("photo-from-peer",aid,"1585,800001234567890");
  source.getJSONArray("items").getJSONObject(0).put("laserMeasuredMm","1585.800001234567890");
  media(a,source,1);save(a,db(source));
  JSONObject before=db(record("existing",bid,"1000,000001"));
  JSONObject newer=db(record("existing",bid,"999,000000000123456789"));
  save(b,before);save(b,newer);
  File primary=new File(b.home,"projects.json"),backup=new File(b.home,"projects.bak");
  File receiverMedia=new File(b.home,"media");assertTrue(receiverMedia.mkdir());
  byte[] original=new byte[]{12,23,34,45};
  File preserved=new File(receiverMedia,"existing-original");
  Files.write(preserved.toPath(),original);
  Files.write(primary.toPath(),"{damaged-current".getBytes(StandardCharsets.UTF_8));
  byte[] damaged=Files.readAllBytes(primary.toPath()),oldBackup=Files.readAllBytes(backup.toPath());
  PeerSnapshot snapshot=PeerSnapshot.capture(a,a.prefs);
  byte[] incoming=Files.readAllBytes(new File(a.home,"media/media-0").toPath());
  PeerMedia.receive(receiverMedia,"media-0",new ByteArrayInputStream(incoming),snapshot.media.get("media-0"));
  PeerHandshake.Peer peer=new PeerHandshake.Peer(aid,"source",tls.a.fingerprint());
  try{bs.apply(snapshot,peer);fail("Damaged receiver accepted fallback as live CAS");}
  catch(IOException expected){}
  assertArrayEquals(damaged,Files.readAllBytes(primary.toPath()));
  assertArrayEquals(oldBackup,Files.readAllBytes(backup.toPath()));
  assertArrayEquals(original,Files.readAllBytes(preserved.toPath()));
  assertEquals(2,receiverMedia.listFiles().length);
  assertArrayEquals(incoming,Files.readAllBytes(new File(receiverMedia,"media-0").toPath()));
  assertFalse(b.prefs.contains("mime-media-0"));
 }
 @Test public void fallbackOnResponderInvalidatesRemoteAckAndRestoresExactDataWithoutNewUserEdit()throws Exception{
  JSONObject photo=record("photo-a",aid,"123,000000123456789");media(a,photo,1);save(a,db(photo));save(b,db());exchange(null,null);exchange(null,null);assertEquals(0,as.outbox.pending(bid));assertEquals(0,bs.outbox.pending(aid));String before=CausalClock.canonical(read(a));Files.write(new File(b.home,"projects.bak").toPath(),db().toString().getBytes(StandardCharsets.UTF_8));Files.write(new File(b.home,"projects.json").toPath(),new byte[]{0});
  exchange(null,null);exchange(null,null);assertEquals(before,CausalClock.canonical(read(b)));assertTrue(DeviceIdentity.valid(LocalDatabase.recoveryId(b.home)));assertEquals(LocalDatabase.recoveryId(b.home),ar.snapshot().getJSONObject(bid).getString("recovery"));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/media-0").toPath()),Files.readAllBytes(new File(b.home,"media/media-0").toPath()));exchange(null,null);assertEquals(0,as.outbox.pending(bid));assertEquals(0,bs.outbox.pending(aid));
 }
 @Test public void recoveryOnInitiatorInvalidatesRemoteAckBeforeResponderPreparesSnapshot()throws Exception{
  save(a,db());save(b,db(record("photo-b",bid,"999,000000000001")));exchange(null,null);exchange(null,null);String before=CausalClock.canonical(read(b));Files.write(new File(a.home,"projects.bak").toPath(),db().toString().getBytes(StandardCharsets.UTF_8));Files.write(new File(a.home,"projects.json").toPath(),new byte[]{0});exchange(null,null);assertEquals(before,CausalClock.canonical(read(a)));assertEquals(LocalDatabase.recoveryId(a.home),br.snapshot().getJSONObject(aid).getString("recovery"));
 }
 @Test public void disconnectNineteenthOfThirtyKeepsDatabaseAndResumesAfterReopen()throws Exception{
  JSONObject photo=record("photo-a",aid,"1234,500000001"),original=db(record("local-b",bid,"55,123456"));media(a,photo,30);save(a,db(photo));save(b,original);AtomicBoolean dropped=new AtomicBoolean();
  try{exchange(null,(peer,phase,done,total)->{if("receiving".equals(phase)&&done==19&&dropped.compareAndSet(false,true))throw new IOException("synthetic disconnect at nineteen");});fail("Interrupted transfer completed");}catch(Exception expected){assertTrue(PeerTlsTest.contains(expected,"synthetic disconnect at nineteen"));}
  assertEquals(CausalClock.canonical(original),CausalClock.canonical(read(b)));assertTrue(as.outbox.pending(bid)>0);assertEquals(19,new File(b.home,"media").listFiles().length);
  as=store(a,new SyncPeerRegistry(a.noBackup));bs=store(b,new SyncPeerRegistry(b.noBackup));AtomicInteger remaining=new AtomicInteger();exchange(null,(peer,phase,done,total)->{if("receiving".equals(phase)&&done==19)remaining.incrementAndGet();});assertEquals(1,remaining.get());assertEquals(30,new File(b.home,"media").listFiles().length);assertEquals(2,read(b).getJSONArray("records").length());exchange(null,null);assertEquals(0,as.outbox.pending(bid));
 }
 @Test public void editDuringMediaTransferIsMergedFromLatestDatabase()throws Exception{
  JSONObject photo=record("photo-a",aid,"1585,800001");media(a,photo,3);save(a,db(photo));save(b,db(record("local-b",bid,"12,01")));AtomicBoolean edited=new AtomicBoolean();
  exchange(null,(peer,phase,done,total)->{if("receiving".equals(phase)&&done==1&&edited.compareAndSet(false,true)){assertFalse("Network must not hold shared DB lock",Thread.holdsLock(TrashPurger.LOCK));save(b,db(record("local-b",bid,"12,010000123").put("syncClock",new JSONObject().put(bid,2))));}});
  assertTrue(edited.get());assertEquals("12,010000123",read(a).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }
 @Test public void sameMediaIdDifferentBytesRefusesWithoutOverwritingOrFalseAck()throws Exception{
  JSONObject photo=record("photo-a",aid,"1,25");media(a,photo,1);JSONObject original=db(record("local-b",bid,"3,75"));save(a,db(photo));save(b,original);File destination=new File(b.home,"media/media-0");destination.getParentFile().mkdirs();byte[] different="other immutable original".getBytes(StandardCharsets.UTF_8);Files.write(destination.toPath(),different);
  try{exchange(null,null);fail("Different original overwritten");}catch(Exception expected){assertTrue(PeerTlsTest.contains(expected,"Obsah stejného identifikátoru"));}assertArrayEquals(different,Files.readAllBytes(destination.toPath()));assertEquals(CausalClock.canonical(original),CausalClock.canonical(read(b)));assertTrue(as.outbox.pending(bid)>0);
 }
 @Test public void corruptAndPartialStreamsDoNotPublishMedia()throws Exception{
  JSONObject photo=record("photo-a",aid,"7,01");media(a,photo,1);save(a,db(photo));PeerSnapshot snapshot=PeerSnapshot.capture(a,a.prefs);JSONObject expected=snapshot.media.get("media-0");File target=new File(b.home,"media");byte[] bytes=Files.readAllBytes(new File(a.home,"media/media-0").toPath());
  try{PeerMedia.receive(target,"media-0",new ByteArrayInputStream(Arrays.copyOf(bytes,7)),expected);fail("Partial stream committed");}catch(EOFException correct){}assertEquals(0,target.listFiles().length);
  bytes[1]^=1;try{PeerMedia.receive(target,"media-0",new ByteArrayInputStream(bytes),expected);fail("Wrong hash committed");}catch(IOException correct){assertTrue(correct.getMessage().contains("Kontrola přijaté"));}assertEquals(0,target.listFiles().length);
 }
 @Test public void coalescesOnlyObservedRevisionsAndRejectsUnsafeMetadata()throws Exception{
  JSONObject original=record("photo-a",aid,"100,0001");save(a,db(original));as.outbox.prepare(bid);JSONObject newer=new JSONObject(original.toString()).put("syncClock",new JSONObject().put(aid,2)).put("title","new title");save(a,db(newer));as.outbox.prepare(bid);assertEquals(1,as.outbox.messages(bid).size());
  JSONObject independent=new JSONObject(original.toString()).put("syncClock",new JSONObject().put(bid,1)).put("title","independent");save(a,db(independent));as.outbox.prepare(bid);assertEquals(2,as.outbox.messages(bid).size());
  PeerSnapshot snapshot=PeerSnapshot.capture(a,a.prefs);try{PeerSnapshot.parse(snapshot.bytes,bid);fail("Spoofed source accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("cizí"));}
  JSONObject wire=new JSONObject(snapshot.wire.toString()).put("sourceId",aid);wire.getJSONObject("data").put("unsafeInteger",9007199254740992L);try{PeerSnapshot.parse(wire.toString().getBytes(StandardCharsets.UTF_8),aid);fail("Inexact number accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("Číselné pole"));}
  String duplicate="{\"format\":1,\"format\":2}";try{PeerSnapshot.parse(duplicate.getBytes(StandardCharsets.UTF_8),aid);fail("Duplicate JSON key accepted");}catch(IOException expected){}
 }

 @Test public void recoveryQuarantineWithMoreThanSixteenOldJobsDoesNotBlockDirectTls()throws Exception{
  String precise="1585,800001234567890";
  JSONObject finalDb=null;
  // The transport fixture pairs identities before it seeds project storage.
  // Supply a validated legacy baseline before exercising Context-based writers;
  // the test concerns recovered outbox liveness, not first-install pairing.
  LocalDatabase.write(a.home,"{\"schema\":1,\"records\":[]}");
  LocalDatabase.write(b.home,"{\"schema\":1,\"records\":[]}");
  for(int i=0;i<20;i++){
   JSONObject historical=db(record("historic-"+i,aid,precise));
   LocalDatabase.write(a,historical.toString());
   as.outbox.prepare(bid);
   finalDb=historical;
  }
  assertNotNull(finalDb);
  assertEquals(20,as.outbox.pending(bid));
  assertEquals(16,as.outbox.messages(bid).size());
  JSONObject old=as.outbox.messages(bid).get(0);
  File evidence=new File(a.noBackup,"sync-v2-outbox/"+old.getString("hash")+".json");
  byte[] original=Files.readAllBytes(evidence.toPath());
  assertTrue(new File(a.home,"projects.json").delete());
  try{LocalDatabase.readForCas(a);fail("Lost primary accepted");}
  catch(IOException expected){}
  String recovery=DatabaseRecovery.id(a.home);
  assertTrue(DeviceIdentity.valid(recovery));
  // Synthetic production-boundary fixture: manual recovery itself is NOT implemented.
  Files.write(new File(a.home,"projects.json").toPath(),
      finalDb.toString().getBytes(StandardCharsets.UTF_8));
  DatabaseRecovery.healthy(a.home,false);
  as=store(a,new SyncPeerRegistry(a.noBackup));
  bs=store(b,new SyncPeerRegistry(b.noBackup));
  PeerSnapshot current=as.outbox.prepare(bid);
  assertEquals(recovery,current.wire.getString("recoveryEpoch"));
  assertEquals(20,as.outbox.quarantinedCount(bid));
  assertEquals(1,as.outbox.messages(bid).size());
  try{as.outbox.completed(bid,old);fail("Old direct ACK retired evidence");}
  catch(IOException expected){}
  assertArrayEquals(original,Files.readAllBytes(evidence.toPath()));
  // Exercise the real production TLS exchange, not a fabricated queue-only read.
  exchange(null,null);
  exchange(null,null);
  JSONObject received=read(b);
  assertEquals(1,received.getJSONArray("records").length());
  assertEquals("historic-19",received.getJSONArray("records").getJSONObject(0).getString("id"));
  assertEquals(precise,received.getJSONArray("records").getJSONObject(0)
      .getJSONArray("items").getJSONObject(0).getString("measure"));
  assertEquals(0,as.outbox.pending(bid));
  assertEquals(20,as.outbox.quarantinedCount(bid));
  assertArrayEquals(original,Files.readAllBytes(evidence.toPath()));
  // Restart/retry uses the same production queue, not an in-memory mark.
  as=store(a,new SyncPeerRegistry(a.noBackup));
  exchange(null,null);
  assertEquals(20,as.outbox.quarantinedCount(bid));
  assertEquals(1,read(b).getJSONArray("records").length());
  assertArrayEquals(original,Files.readAllBytes(evidence.toPath()));
 }
}
