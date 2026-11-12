package cz.zamerovac.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
/** Actual signatures, media streams, immutable files and native DB/outbox. Not a Google Drive account test. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SafSyncV2Test {
 static class Store extends BackupHistoryTest.FilesStore implements SyncStore {
  int readsOfLarge,messageReads;String largeHash="",watchedMessages="";int writes,largeWritten;Runnable onLargeChunk,beforeAckWrite;boolean failTwentieth,failAck;
  Store(File root){super(root);}
  @Override public String namespace(){return root.getAbsolutePath();}
  @Override File file(String path)throws Exception{SyncStore.parts(path);return new File(root,path);}
  @Override public InputStream open(String path)throws Exception{if(!largeHash.isEmpty()&&path.contains(largeHash))readsOfLarge++;if(!watchedMessages.isEmpty()&&path.startsWith(watchedMessages))messageReads++;return super.open(path);}
  @Override public OutputStream create(String path)throws Exception{OutputStream out=super.create(path);if(path.startsWith("sync/v2/acks/")&&beforeAckWrite!=null){Runnable action=beforeAckWrite;beforeAckWrite=null;action.run();}if(path.startsWith("sync/v2/acks/")&&failAck){failAck=false;return new FilterOutputStream(out){@Override public void write(byte[] bytes,int offset,int length)throws IOException{out.write(bytes,offset,Math.min(17,length));throw new IOException("synthetic lost ACK publication");}};}if(!largeHash.isEmpty()&&path.contains(largeHash)&&onLargeChunk!=null)return new FilterOutputStream(out){@Override public void write(byte[] bytes,int offset,int length)throws IOException{out.write(bytes,offset,length);largeWritten+=length;Runnable action=onLargeChunk;onLargeChunk=null;if(action!=null)action.run();}};if(path.startsWith("sync/v2/blobs/")&&++writes==20&&failTwentieth){failTwentieth=false;return new FilterOutputStream(out){@Override public void write(byte[] bytes,int offset,int length)throws IOException{out.write(bytes,offset,Math.min(17,length));throw new IOException("synthetic twentieth blob disconnected");}};}return out;}
 }
 /** Provider-boundary diagnostic: Drive stages until publish; SAF writes directly. */
 static final class LateAckProviderStore extends Store {
  final PeerTransferTest.Device receiver;final boolean staged;boolean injected;
  LateAckProviderStore(File root,PeerTransferTest.Device receiver,boolean staged){super(root);this.receiver=receiver;this.staged=staged;}
  private void loseAuthority()throws IOException{
   injected=true;
   Files.write(new File(receiver.home,"projects.json").toPath(),new byte[]{0});
  }
  @Override public OutputStream create(String path)throws Exception{
   if(!path.startsWith("sync/v2/acks/"))return super.create(path);
   if(staged){
    class StagedAck extends OutputStream implements ImmutableStore.PendingOutput {
     final ByteArrayOutputStream buffer=new ByteArrayOutputStream();
     public void write(int value){buffer.write(value);}
     public void write(byte[] bytes,int offset,int length){buffer.write(bytes,offset,length);}
     public void publish()throws IOException{
      // Local CAS was last checked by GuardedOutput.publish immediately before this callback.
      loseAuthority();
      try(OutputStream destination=LateAckProviderStore.super.create(path)){buffer.writeTo(destination);}
      catch(IOException failure){throw failure;}
      catch(Exception failure){throw new IOException(failure);}
     }
    }
    return new StagedAck();
   }
   // SAF-style direct output is already visible; provider writes AFTER the caller's guard.
   OutputStream direct=super.create(path);
   return new FilterOutputStream(direct){
    boolean began;
    private void firstWrite()throws IOException{if(!began){began=true;loseAuthority();}}
    @Override public void write(int value)throws IOException{firstWrite();out.write(value);}
    @Override public void write(byte[] bytes,int offset,int length)throws IOException{firstWrite();out.write(bytes,offset,length);}
   };
  }
 }
 PeerTransferTest.Device a,b;SyncTls ai,bi,rogue;SyncPeerRegistry ar,br;Store store;String aid,bid;JSONObject original;
 @Before public void setup()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"cloud-sync-").toFile();a=new PeerTransferTest.Device(root,"a");b=new PeerTransferTest.Device(root,"b");ai=PeerTlsTest.material("a");bi=PeerTlsTest.material("b");rogue=PeerTlsTest.material("rogue");aid=DeviceIdentity.get(a.noBackup);bid=DeviceIdentity.get(b.noBackup);ar=new SyncPeerRegistry(a.noBackup);br=new SyncPeerRegistry(b.noBackup);ar.approve(bid,bi.fingerprint(),"B");br.approve(aid,ai.fingerprint(),"A");ar.rememberCertificate(bid,bi.certificate());br.rememberCertificate(aid,ai.certificate());store=new Store(new File(root,"provider"));original=new JSONObject().put("schema",1).put("records",new JSONArray().put(new JSONObject().put("id","photo-a").put("title","Syntetické foto").put("syncClock",new JSONObject().put(aid,1)).put("items",new JSONArray().put(new JSONObject().put("measure","1585,800001").put("unit","mm")))));
 }
 void files(int count,int size)throws Exception{if(!new File(a.home,"projects.json").exists())LocalDatabase.write(a.home,"{\"schema\":1,\"records\":[]}");new File(a.home,"media").mkdirs();JSONArray refs=new JSONArray();for(int i=0;i<count;i++){String id="original-"+i;byte[] bytes=new byte[size+i];Arrays.fill(bytes,(byte)(i+1));Files.write(new File(a.home,"media/"+id).toPath(),bytes);refs.put(id);}original.getJSONArray("records").getJSONObject(0).put("media",refs);LocalDatabase.write(a.home,original.toString());LocalDatabase.write(b.home,new JSONObject().put("schema",1).put("records",new JSONArray()).toString());}
 void canonicalFiles(int count,int size)throws Exception{files(count,size);original.put("trashPurgedIds",new JSONArray()).put("syncTombstones",new JSONObject());LocalDatabase.write(a.home,original.toString());}
 SafSyncV2 sync(PeerTransferTest.Device device,SyncTls identity,boolean metered)throws Exception{return new SafSyncV2(device,device.prefs,store,identity,bytes->!metered||bytes<=1024*1024);}
 void converge()throws Exception{for(int i=0;i<6;i++){sync(a,ai,false).sync();sync(b,bi,false).sync();}}
 SafSyncV2 engine(PeerTransferTest.Device device,SyncTls identity,Store selected,boolean metered)throws Exception{return new SafSyncV2(device,device.prefs,selected,identity,bytes->!metered||bytes<=1024*1024);}
 /**
  * A cloud ACK is evidence of an earlier verified commit, not a guarantee
  * against later disk failure. The two stricter RED diagnostics remain untouched in PR #88.
  * This checks the independent retention/recovery safety contract.
  */
 void assertLateProviderAckDoesNotDestroySource(boolean staged)throws Exception{
  canonicalFiles(1,4000);
  String exactSource=LocalDatabase.readForCas(a);
  byte[] sourceDb=Files.readAllBytes(new File(a.home,"projects.json").toPath());
  byte[] sourcePhoto=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  PeerSnapshot snapshot=PeerSnapshot.capture(a,a.prefs);
  sync(a,ai,false).sync();
  assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  String messageDirectory="sync/v2/messages/"+bid+"/"+aid;
  String message=store.list(messageDirectory).get(0).name;
  String ackDirectory="sync/v2/acks/"+aid+"/"+bid;
  LateAckProviderStore remote=new LateAckProviderStore(store.root,b,staged);
  try{engine(b,bi,remote,false).sync();}catch(IOException blocked){}
  assertTrue("The provider boundary must actually corrupt the receiver",remote.injected);
  byte[] damaged=Files.readAllBytes(new File(b.home,"projects.json").toPath());
  assertArrayEquals(new byte[]{0},damaged);
  assertTrue("Receiver recovery must remain durable",DatabaseRecovery.pending(b.home));
  String epoch=DatabaseRecovery.id(b.home);
  assertTrue(DeviceIdentity.valid(epoch));
  assertNull("Old inbox receipt cannot survive a local recovery epoch",
      new CloudInbox(b.noBackup,bid,store.namespace(),b.home).get(aid,message));
  try{LocalDatabase.readForCas(b);fail("Corrupt receiver regained write authority");}
  catch(IOException blocked){}
  try{LocalDatabase.write(b,exactSource);fail("Sender data was silently restored into damaged receiver");}
  catch(IOException blocked){}
  int acknowledged=0;
  for(ImmutableStore.Entry entry:remote.list(ackDirectory))try{
   JSONObject body=CloudProof.verify(
       CloudProof.read(remote.open(ackDirectory+"/"+entry.name),PeerWire.MAX_HELLO),
       bi.certificate(),CloudProof.ACK,bid,aid);
   if(snapshot.hash.equals(body.getString("hash")))acknowledged++;
  }catch(IOException ignored){}
  assertTrue("Synthetic provider cannot create more than one matching ACK",acknowledged<=1);
  // Even when a signed ACK physically escaped, sender never treats it as
  // permission to unlink its only complete project or original photo.
  if(acknowledged==1){
   sync(a,ai,false).sync();
   assertEquals("Sender may quiet only active upload metadata",0,
       new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup)).activeProjects(bid));
   assertTrue("Historical ACK must retain an unverified working intent",
       new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup)).pendingProjects(bid)>0);
  }
  assertArrayEquals(sourceDb,Files.readAllBytes(new File(a.home,"projects.json").toPath()));
  assertEquals(exactSource,LocalDatabase.readForCas(a));
  assertArrayEquals(sourcePhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(snapshot.hash,PeerSnapshot.capture(a,a.prefs).hash);
  assertEquals(0,new TrashPurger(a,a.prefs).pendingCount());
  int acknowledgementsBefore=remote.list(ackDirectory).size();
  try{engine(b,bi,remote,false).sync();fail("Restarted receiver bypassed pending recovery");}
  catch(IOException blocked){}
  assertEquals("Restart must not publish additional ACK",acknowledgementsBefore,
      remote.list(ackDirectory).size());
  assertEquals(epoch,DatabaseRecovery.id(b.home));
  assertArrayEquals(damaged,Files.readAllBytes(new File(b.home,"projects.json").toPath()));
  assertArrayEquals(sourcePhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
 }
 @Test public void driveLateAckKeepsOriginalsAndRejectsUnapprovedRecoveryOnRestart()throws Exception{
  assertLateProviderAckDoesNotDestroySource(true);
 }
 @Test public void safLateAckKeepsOriginalsAndRejectsUnapprovedRecoveryOnRestart()throws Exception{
  assertLateProviderAckDoesNotDestroySource(false);
 }
 @Test public void observedReceiverRecoveryCannotReuseHistoricalSignedCloudAck()throws Exception{
  canonicalFiles(1,4000);
  converge();
  PeerSnapshot source=PeerSnapshot.capture(a,a.prefs);
  byte[] originalDb=Files.readAllBytes(new File(a.home,"projects.json").toPath());
  byte[] originalPhoto=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  assertEquals(source.hash,ar.lastAck(bid));
  assertTrue("Signed historical cloud proof must exist before recovery",!store.list("sync/v2/acks/"+aid+"/"+bid).isEmpty());
  assertTrue("Healthy peer can accept ordinary cloud ACK",ar.cloudAckAllowed(bid));
  assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
  String recoveredEpoch=java.util.UUID.randomUUID().toString();
  ar.recovered(bid,recoveredEpoch); // existing authenticated remote-recovery signal
  assertEquals("",ar.lastAck(bid));
  assertFalse("Old successful pairing status must be retired",ar.snapshot().getJSONObject(bid).has("lastSuccess"));
  assertEquals(recoveredEpoch,ar.snapshot().getJSONObject(bid).getString("recovery"));
  assertFalse("Pre-recovery cloud ACK cannot confirm the new era",ar.cloudAckAllowed(bid));
  SafSyncV2.Result retry=sync(a,ai,false).sync();
  assertTrue("Old signed cloud proof must not finish post-recovery work",retry.pending);
  assertTrue("Old ACK cannot retire the new-epoch outbound intent",
      new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup)).pending(bid)>0);
  assertEquals("",new SyncPeerRegistry(a.noBackup).lastAck(bid));
  assertArrayEquals(originalDb,Files.readAllBytes(new File(a.home,"projects.json").toPath()));
  assertArrayEquals(originalPhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(source.hash,PeerSnapshot.capture(a,a.prefs).hash);
  assertEquals("1585,800001",new JSONObject(LocalDatabase.readForCas(a)).getJSONArray("records")
      .getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }

 @Test public void recoveredPeerCannotClearCloudAckBarrierByUnpairAndRepair()throws Exception{
  canonicalFiles(1,4000);converge();
  PeerSnapshot source=PeerSnapshot.capture(a,a.prefs);
  byte[] sourceDb=Files.readAllBytes(new File(a.home,"projects.json").toPath());
  byte[] sourcePhoto=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  assertEquals(source.hash,ar.lastAck(bid));
  String epoch=java.util.UUID.randomUUID().toString();
  ar.recovered(bid,epoch);
  assertFalse(ar.cloudAckAllowed(bid));
  ar.forget(bid); // An ordinary user may re-pair a damaged tablet later.
  assertFalse(ar.isTrusted(bid,bi.fingerprint()));
  ar.approve(bid,bi.fingerprint(),"Synthetic tablet re-paired");
  ar.rememberCertificate(bid,bi.certificate());
  assertFalse("Re-pair must not erase durable remote recovery witness",ar.cloudAckAllowed(bid));
  assertEquals(epoch,ar.snapshot().getJSONObject(bid).getString("recovery"));
  SafSyncV2.Result retry=sync(a,ai,false).sync();
  assertTrue("Old cloud ACK cannot complete post-repair queue",retry.pending);
  assertEquals("",new SyncPeerRegistry(a.noBackup).lastAck(bid));
  assertTrue(new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup)).pending(bid)>0);
  assertArrayEquals(sourceDb,Files.readAllBytes(new File(a.home,"projects.json").toPath()));
  assertArrayEquals(sourcePhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(source.hash,PeerSnapshot.capture(a,a.prefs).hash);
 }

 @Test public void legacyRemoteRecoveryHoldSurvivesCoordinatorForgetNewCertificateAndRestart()throws Exception{
  canonicalFiles(1,4000);converge();
  PeerSnapshot before=PeerSnapshot.capture(a,a.prefs);
  byte[] source=Files.readAllBytes(new File(a.home,"projects.json").toPath());
  byte[] originalPhoto=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  String epoch=java.util.UUID.randomUUID().toString();
  ar.recovered(bid,epoch);
  File registryFile=new File(a.noBackup,"sync-peers-v2.json");
  JSONObject legacy=new JSONObject(new String(Files.readAllBytes(registryFile.toPath()),java.nio.charset.StandardCharsets.UTF_8));
  assertEquals(epoch,legacy.getJSONObject("peers").getJSONObject(bid).getString("recovery"));
  legacy.remove("remoteRecoveryHolds");
  // A realistic old installation has peer.recovery but no global witness map.
  Files.write(registryFile.toPath(),legacy.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  assertFalse(ar.cloudAckAllowed(bid));
  java.util.concurrent.CountDownLatch finished=new java.util.concurrent.CountDownLatch(1);
  PeerCoordinator coordinator=new PeerCoordinator(a,a.prefs,new PeerCoordinator.Events(){
   public void state(JSONObject state){
    if(!state.optJSONObject("peers").has(bid))finished.countDown();
   }
   public void pairing(JSONObject request){}
   public void saved(JSONObject data,String transport){}
  });
  try{
   coordinator.forget(bid);
   assertTrue("Coordinator forget did not finish full discard",
       finished.await(10,java.util.concurrent.TimeUnit.SECONDS));
  }finally{coordinator.close();}
  assertFalse(new SyncPeerRegistry(a.noBackup).snapshot().has(bid));
  JSONObject persisted=new JSONObject(new String(Files.readAllBytes(registryFile.toPath()),java.nio.charset.StandardCharsets.UTF_8));
  assertEquals("Legacy peer.recovery must migrate before removing contact",epoch,
      persisted.getJSONObject("remoteRecoveryHolds").getString(bid));
  ar.approve(bid,rogue.fingerprint(),"Replacement tablet with new cert");
  ar.rememberCertificate(bid,rogue.certificate());
  SyncPeerRegistry restarted=new SyncPeerRegistry(a.noBackup);
  assertEquals(epoch,restarted.snapshot().getJSONObject(bid).getString("recovery"));
  assertFalse(restarted.cloudAckAllowed(bid));
  assertEquals("",restarted.lastAck(bid));
  SafSyncV2.Result retry=sync(a,ai,false).sync();
  assertTrue("An old cloud ACK must not finish a re-paired recovered device",retry.pending);
  assertEquals("",new SyncPeerRegistry(a.noBackup).lastAck(bid));
  assertArrayEquals(source,Files.readAllBytes(new File(a.home,"projects.json").toPath()));
  assertArrayEquals(originalPhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(before.hash,PeerSnapshot.capture(a,a.prefs).hash);
  assertEquals("1585,800001",new JSONObject(LocalDatabase.readForCas(a)).getJSONArray("records")
      .getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }
 @Test public void coordinatorRevocationDuringCloudAckProofCannotCompleteStaleOutbox()throws Exception{
  canonicalFiles(1,4000);converge();
  PeerSnapshot before=PeerSnapshot.capture(a,a.prefs);
  byte[] source=Files.readAllBytes(new File(a.home,"projects.json").toPath());
  byte[] originalPhoto=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  assertEquals(before.hash,ar.lastAck(bid));
  new PeerOutbox(a,a.prefs,ar).prepare(bid,true);
  assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  java.util.concurrent.CountDownLatch revoked=new java.util.concurrent.CountDownLatch(1);
  PeerCoordinator coordinator=new PeerCoordinator(a,a.prefs,new PeerCoordinator.Events(){
   public void state(JSONObject state){
    if(!state.optJSONObject("peers").has(bid))revoked.countDown();
   }
   public void pairing(JSONObject request){}
   public void saved(JSONObject data,String transport){}
  });
  java.util.concurrent.atomic.AtomicBoolean injected=new java.util.concurrent.atomic.AtomicBoolean();
  final String ackDirectory="sync/v2/acks/"+aid+"/"+bid+"/";
  Store blocking=new Store(store.root){
   @Override public InputStream open(String path)throws Exception{
    if(path.startsWith(ackDirectory)&&injected.compareAndSet(false,true)){
     // The control thread revokes pairing WHILE proof() reads immutable cloud evidence.
     coordinator.forget(bid);
     assertTrue("Revocation did not finish during proof",
         revoked.await(10,java.util.concurrent.TimeUnit.SECONDS));
    }
    return super.open(path);
   }
  };
  try{
   SafSyncV2.Result result=engine(a,ai,blocking,false).sync();
   assertTrue("Revocation cannot result in a confirmed transfer",result.pending);
  }finally{coordinator.close();}
  assertTrue("Revocation must occur inside signed cloud proof",injected.get());
  SyncPeerRegistry restarted=new SyncPeerRegistry(a.noBackup);
  assertFalse(restarted.snapshot().has(bid));
  assertEquals("",restarted.lastAck(bid));
  assertEquals(0,new PeerOutbox(a,a.prefs,restarted).pending(bid)); // explicit forget discards old jobs
  assertArrayEquals(source,Files.readAllBytes(new File(a.home,"projects.json").toPath()));
  assertArrayEquals(originalPhoto,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(before.hash,PeerSnapshot.capture(a,a.prefs).hash);
  assertEquals("1585,800001",new JSONObject(LocalDatabase.readForCas(a)).getJSONArray("records")
      .getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }
 void ackProviderBoundary(boolean staged)throws Exception{
  canonicalFiles(1,4000);
  byte[] sourceMedia=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  String sourceDb=LocalDatabase.readForCas(a);
  PeerSnapshot outgoing=PeerSnapshot.capture(a,a.prefs);
  sync(a,ai,false).sync();
  assertTrue("Source must keep unconfirmed transfer",new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  String ackDir="sync/v2/acks/"+aid+"/"+bid;
  assertTrue(store.list(ackDir).isEmpty());
  LateAckProviderStore provider=new LateAckProviderStore(store.root,b,staged);
  try{engine(b,bi,provider,false).sync();}catch(IOException expected){}
  assertTrue("Inject at actual provider "+(staged?"publish":"write"),provider.injected);
  assertTrue("Recovery must remain pending",DatabaseRecovery.pending(b.home));
  assertArrayEquals("Damaged DB bytes must not be silently repaired",new byte[]{0},
      Files.readAllBytes(new File(b.home,"projects.json").toPath()));
  assertArrayEquals("Already accepted synthetic media bytes must remain exact",sourceMedia,
      Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
  assertEquals("Source DB must remain unchanged",sourceDb,LocalDatabase.readForCas(a));
  assertArrayEquals("Original sender photo unchanged",sourceMedia,
      Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  int accepted=0;
  for(ImmutableStore.Entry entry:provider.list(ackDir)){
   try{
    JSONObject proof=CloudProof.verify(CloudProof.read(provider.open(ackDir+"/"+entry.name),PeerWire.MAX_HELLO),
        bi.certificate(),CloudProof.ACK,bid,aid);
    if(outgoing.hash.equals(proof.getString("hash")))accepted++;
   }catch(IOException incompleteOrMissing){}
  }
  assertEquals("Provider completed signed ACK after recovery epoch loss: "+(staged?"Drive staged":"SAF direct"),0,accepted);
  assertTrue("Sender must not retire unacknowledged data",new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
 }
 @Test public void driveStagedAckMustNotPublishAfterLocalAuthorityLostInsideProviderCommit()throws Exception{
  ackProviderBoundary(true);
 }
 @Test public void safDirectAckMustNotPublishAfterLocalAuthorityLostInsideProviderWrite()throws Exception{
  ackProviderBoundary(false);
 }
 @Test public void corruptionAfterAckOutputCreateCannotPublishValidCloudAck()throws Exception{
  canonicalFiles(1,4000);
  sync(a,ai,false).sync(); // signed message exists; receiver has not committed it
  String ackDirectory="sync/v2/acks/"+aid+"/"+bid;
  assertTrue(store.list(ackDirectory).isEmpty());
  byte[] originalMedia=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  String originalDb=LocalDatabase.readForCas(a);
  File primary=new File(b.home,"projects.json");
  byte[] initialDb=Files.readAllBytes(primary.toPath());
  java.util.concurrent.atomic.AtomicBoolean injected=new java.util.concurrent.atomic.AtomicBoolean();
  store.beforeAckWrite=()->{
   injected.set(true);
   try{Files.write(primary.toPath(),new byte[]{0});}
   catch(IOException failure){throw new UncheckedIOException(failure);}
  };
  try{sync(b,bi,false).sync();fail("Receiver acknowledged after primary corruption");}
  catch(IOException expected){}
  assertTrue("Failure injection must be at ACK output creation",injected.get());
  assertTrue("Damaged database must require manual recovery",DatabaseRecovery.pending(b.home));
  assertArrayEquals(new byte[]{0},Files.readAllBytes(primary.toPath()));
  assertFalse(Arrays.equals(initialDb,Files.readAllBytes(primary.toPath())));
  for(ImmutableStore.Entry entry:store.list(ackDirectory)){
   assertEquals("No complete signed ACK may be published after loss of write authority",
       0,Files.size(store.file(ackDirectory+"/"+entry.name).toPath()));
  }
  assertTrue("Unacknowledged source snapshot must stay pending",
      new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  assertEquals(originalDb,LocalDatabase.readForCas(a));
  assertArrayEquals(originalMedia,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  try{sync(b,bi,false).sync();fail("Retry bypassed pending recovery");}
  catch(IOException expected){}
 }
 @Test public void authenticatedDirectArrivalDuringLocalHashReleasesCloudGateBeforePublication()throws Exception{
  canonicalFiles(1,2000000);byte[] before=Files.readAllBytes(new File(a.home,"media/original-0").toPath());java.util.concurrent.atomic.AtomicInteger hashChecks=new java.util.concurrent.atomic.AtomicInteger();java.util.concurrent.atomic.AtomicBoolean arrived=new java.util.concurrent.atomic.AtomicBoolean();
  SafSyncV2 engine=new SafSyncV2(a,a.prefs,store,ai,bytes->{for(StackTraceElement frame:Thread.currentThread().getStackTrace())if(frame.getClassName().startsWith(PeerMedia.class.getName())&&"read".equals(frame.getMethodName())){if(hashChecks.incrementAndGet()==3){arrived.set(true);PeerGates.direct(a,bid);}break;}return true;});try{SafSyncV2.Result result=engine.sync();assertTrue(arrived.get());assertTrue(result.pending);assertTrue(result.message.contains("místní přenos"));assertFalse(PeerGates.get(a,bid).isLocked());assertEquals(0,store.writes);assertTrue(store.list("sync/v2/messages/"+bid+"/"+aid).isEmpty());assertArrayEquals(before,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));}finally{java.util.Map<String,Long> marks=org.robolectric.util.ReflectionHelpers.getStaticField(PeerGates.class,"DIRECT");marks.remove(a.noBackup.getAbsolutePath()+"/"+bid);}converge();assertArrayEquals(before,Files.readAllBytes(new File(b.home,"media/original-0").toPath()));assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
 }
 @Test public void unavailableOldMetadataDoesNotBlockNewerIncomingOrOwnOutgoingAndNeverGetsAcked()throws Exception{
  canonicalFiles(1,1500000);PeerSnapshot old=PeerSnapshot.capture(a,a.prefs);sync(a,ai,true).sync();String oldName=store.list("sync/v2/messages/"+bid+"/"+aid).get(0).name;for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(old.hash))assertTrue(store.file("sync/v2/blobs/"+entry.name).delete());
  JSONObject next=new JSONObject(LocalDatabase.read(a.home));JSONObject record=next.getJSONArray("records").getJSONObject(0);record.put("syncClock",new JSONObject().put(aid,2));record.getJSONArray("items").getJSONObject(0).put("measure","999,000000123");LocalDatabase.write(a.home,next.toString());sync(a,ai,false).sync();SafSyncV2.Result first=sync(b,bi,false).sync();assertTrue(first.pending);assertEquals("999,000000123",new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
  JSONObject reply=new JSONObject(LocalDatabase.read(b.home));reply.getJSONArray("records").put(new JSONObject().put("id","reply-b").put("title","New independent synthetic note").put("type","note").put("text","B can still send").put("syncClock",new JSONObject().put(bid,1)));LocalDatabase.write(b.home,reply.toString());assertTrue(sync(b,bi,false).sync().pending);sync(a,ai,false).sync();JSONArray arrived=new JSONObject(LocalDatabase.read(a.home)).getJSONArray("records");boolean found=false;for(int i=0;i<arrived.length();i++)if("reply-b".equals(arrived.getJSONObject(i).getString("id"))){found=true;assertEquals("B can still send",arrived.getJSONObject(i).getString("text"));}assertTrue(found);assertNull(new CloudInbox(b.noBackup,bid,store.namespace(),b.home).get(aid,oldName));
  for(ImmutableStore.Entry entry:store.list("sync/v2/acks/"+aid+"/"+bid)){JSONObject ack=CloudProof.verify(CloudProof.read(store.open("sync/v2/acks/"+aid+"/"+bid+"/"+entry.name),PeerWire.MAX_HELLO),bi.certificate(),CloudProof.ACK,bid,aid);assertNotEquals(old.hash,ack.getString("hash"));}
 }
 @Test public void newCloudNamespacePublishesCompleteCopyDespitePriorConfirmedPeerAck()throws Exception{
  canonicalFiles(2,4000);converge();PeerSnapshot current=PeerSnapshot.capture(a,a.prefs);
  assertEquals(current.hash,ar.lastAck(bid));assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
  int oldFiles=store.list("sync/v2/blobs").size();Store selected=new Store(new File(store.root.getParentFile(),"new-provider"));
  assertTrue(engine(a,ai,selected,false).sync().pending);
  // A receipt in the old namespace cannot advance the new target's history phase.
  assertEquals(3,selected.list("sync/v2/blobs").size());
  CloudFiles.find(selected,current.hash,current.bytes.length);for(JSONObject media:current.media.values())CloudFiles.find(selected,media.getString("hash"),media.getLong("size"));
  assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  for(int round=0;round<6;round++){engine(b,bi,selected,false).sync();engine(a,ai,selected,false).sync();}
  // Every preexisting cloud blob must be available byte-exactly in the new namespace.
  // Fresh reconciliation can retain additional exact metadata revisions; file count alone is not completeness evidence.
  Set<String> priorHashes=new HashSet<>(),copiedHashes=new HashSet<>();
  for(ImmutableStore.Entry entry:store.list("sync/v2/blobs")){String hash=entry.name.substring(0,64);priorHashes.add(hash);CloudFiles.find(selected,hash,entry.size);}
  for(ImmutableStore.Entry entry:selected.list("sync/v2/blobs")){String hash=entry.name.substring(0,64);CloudFiles.verify(selected,"sync/v2/blobs/"+entry.name,hash,entry.size);assertTrue("No redundant physical upload in a healthy namespace",copiedHashes.add(hash));}
  assertEquals(oldFiles,priorHashes.size());assertTrue(copiedHashes.containsAll(priorHashes));
  assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
  assertEquals("1585,800001",new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }
 @Test public void historicalSignedAckCannotHideIncompleteNewNamespaceOnMeteredNetwork()throws Exception{
  canonicalFiles(1,1500000);converge();PeerSnapshot current=PeerSnapshot.capture(a,a.prefs);Store selected=new Store(new File(store.root.getParentFile(),"new-metered-provider"));selected.largeHash=current.media.get("original-0").getString("hash");CloudFiles.publish(selected,"sync/v2/acks/"+aid+"/"+bid,current.hash,CloudProof.sign(CloudProof.body(CloudProof.ACK,bid,aid,current.hash,current.bytes.length),bi));SafSyncV2 first=engine(a,ai,selected,true);assertTrue(first.sync().pending);assertFalse(first.publications.snapshotPublished(bid,current.hash));assertEquals(0,selected.readsOfLarge);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);engine(a,ai,selected,false).sync();CloudFiles.find(selected,selected.largeHash,1500000);assertTrue(new CloudPublications(a.noBackup,aid,selected.namespace()).snapshotPublished(bid,current.hash));assertEquals(0,new PeerOutbox(a,a.prefs,ar).activeProjects(bid));assertTrue("Historical signed ACK cannot verify receiver health",new PeerOutbox(a,a.prefs,ar).pendingProjects(bid)>0);assertTrue("Auxiliary history still needs the receiver ACK",new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
 }
 @Test public void repairAfterFinalAckRestoresFallbackReceiverAndNeverOverwritesCorruptRemoteCopy()throws Exception{
  // Legacy name: cloud repair must wait for a separately authorized Stage 3 recovery.
  canonicalFiles(1,4000);converge();
  assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
  byte[] source=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  String hash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");
  File bad=null;
  for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(hash)){
   bad=store.file("sync/v2/blobs/"+entry.name);Files.write(bad.toPath(),new byte[4000]);
  }
  assertNotNull(bad);
  byte[] corruptCloud=Files.readAllBytes(bad.toPath());
  File primary=new File(b.home,"projects.json"),backup=new File(b.home,"projects.bak");
  byte[] fallback="{\"schema\":1,\"records\":[]}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
  Files.write(backup.toPath(),fallback);Files.write(primary.toPath(),new byte[]{0});
  byte[] damaged=Files.readAllBytes(primary.toPath());
  assertTrue(new File(b.home,"media/original-0").delete());
  int requestsBefore=store.list("sync/v2/requests/"+aid+"/"+bid).size();
  int acksBefore=store.list("sync/v2/acks/"+aid+"/"+bid).size();
  try{sync(b,bi,false).sync();fail("Cloud repair ran before database recovery authorization");}
  catch(IOException expected){}
  String epoch=DatabaseRecovery.id(b.home);
  assertTrue(DeviceIdentity.valid(epoch));assertTrue(DatabaseRecovery.pending(b.home));
  try{LocalDatabase.readForCas(b);fail("Damaged cloud receiver writable");}catch(IOException expected){}
  assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());
  assertEquals(requestsBefore,store.list("sync/v2/requests/"+aid+"/"+bid).size());
  assertEquals(acksBefore,store.list("sync/v2/acks/"+aid+"/"+bid).size());
  assertArrayEquals(damaged,Files.readAllBytes(primary.toPath()));
  assertArrayEquals(fallback,Files.readAllBytes(backup.toPath()));
  assertFalse(new File(b.home,"media/original-0").exists());
  assertArrayEquals(corruptCloud,Files.readAllBytes(bad.toPath()));
  assertArrayEquals(source,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals("1585,800001",new JSONObject(LocalDatabase.readForCas(a)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
  try{sync(b,bi,false).sync();fail("Second cloud pass bypassed recovery barrier");}catch(IOException expected){}
  assertEquals(epoch,DatabaseRecovery.id(b.home));
  assertEquals(requestsBefore,store.list("sync/v2/requests/"+aid+"/"+bid).size());
  assertArrayEquals(corruptCloud,Files.readAllBytes(bad.toPath()));
 }

@Test public void purgedPendingPhotoDoesNotBlockNewerTombstoneOrFalselyAckMissingOldMedia()throws Exception{
  canonicalFiles(1,1500000);PeerSnapshot old=PeerSnapshot.capture(a,a.prefs);sync(a,ai,true).sync();String oldName=store.list("sync/v2/messages/"+bid+"/"+aid).get(0).name;assertTrue(sync(b,bi,false).sync().pending);JSONObject deleted=new JSONObject(LocalDatabase.read(a.home));deleted.getJSONArray("records").getJSONObject(0).put("deleted",true).put("syncClock",new JSONObject().put(aid,2));LocalDatabase.write(a.home,deleted.toString());String saved=LocalDatabase.read(a.home);synchronized(TrashPurger.LOCK){new TrashPurger(a,a.prefs).purge(saved,saved,new JSONArray().put("photo-a"),text->LocalDatabase.write(a.home,text));}assertTrue("Approved hybrid retention keeps the last original after purge",new File(a.home,"media/original-0").exists());assertTrue(new ProtectedRevisions(a,a.prefs).pins().contains("original-0"));sync(a,ai,true).sync();assertTrue("Historical content remains pending on metered network",sync(b,bi,true).sync().pending);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());SafSyncV2.Result last=null;for(int i=0;i<7;i++){sync(a,ai,false).sync();last=sync(b,bi,false).sync();}assertNotNull(last);assertTrue("Cloud-only receiver remains UNKNOWN",last.pending);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());assertTrue(new JSONObject(LocalDatabase.read(b.home)).getJSONObject("syncTombstones").has("photo-a"));JSONObject receipt=new CloudInbox(b.noBackup,bid,store.namespace(),b.home).get(aid,oldName);assertTrue(receipt.getBoolean("obsolete"));assertFalse(receipt.getBoolean("acked"));for(ImmutableStore.Entry entry:store.list("sync/v2/acks/"+aid+"/"+bid)){JSONObject proof=CloudProof.verify(CloudProof.read(store.open("sync/v2/acks/"+aid+"/"+bid+"/"+entry.name),PeerWire.MAX_HELLO),bi.certificate(),CloudProof.ACK,bid,aid);assertNotEquals(old.hash,proof.getString("hash"));}
 }
 @Test public void concurrentLocalVersionCannotRetireAnUnfinishedRemoteSnapshot()throws Exception{
  canonicalFiles(1,1500000);sync(a,ai,true).sync();String name=store.list("sync/v2/messages/"+bid+"/"+aid).get(0).name;JSONObject independent=new JSONObject(original.toString());independent.getJSONArray("records").getJSONObject(0).put("syncClock",new JSONObject().put(bid,1)).put("media",new JSONArray()).getJSONArray("items").getJSONObject(0).put("measure","999,000001");LocalDatabase.write(b.home,independent.toString());String before=LocalDatabase.read(b.home);assertTrue(sync(b,bi,false).sync().pending);assertEquals(before,LocalDatabase.read(b.home));assertNull(new CloudInbox(b.noBackup,bid,store.namespace(),b.home).get(aid,name));converge();JSONArray records=new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records");assertEquals(2,records.length());Set<String> values=new HashSet<>();for(int i=0;i<records.length();i++)values.add(records.getJSONObject(i).getJSONArray("items").getJSONObject(0).getString("measure"));assertEquals(Set.of("1585,800001","999,000001"),values);
 }
 @Test public void missingFileStillRequiredByNewerLocalVersionCannotBeRetired()throws Exception{
  canonicalFiles(1,1500000);sync(a,ai,true).sync();String name=store.list("sync/v2/messages/"+bid+"/"+aid).get(0).name;JSONObject newer=new JSONObject(original.toString());newer.getJSONArray("records").getJSONObject(0).put("syncClock",new JSONObject().put(aid,2));// Create the legitimate newer revision first, then simulate external media loss.
  File receiverPhoto=new File(b.home,"media/original-0");receiverPhoto.getParentFile().mkdirs();
  Files.copy(new File(a.home,"media/original-0").toPath(),receiverPhoto.toPath());
  LocalDatabase.write(b.home,newer.toString());assertTrue(receiverPhoto.delete());String before=LocalDatabase.read(b.home);assertTrue(sync(b,bi,false).sync().pending);assertEquals(before,LocalDatabase.read(b.home));assertNull(new CloudInbox(b.noBackup,bid,store.namespace(),b.home).get(aid,name));
 }
 @Test public void fallbackAfterFinalCloudAckReappliesHistoricalMessageDespiteCachedInbox()throws Exception{
  // Legacy name: an old signed ACK/inbox entry cannot authorize replay after loss.
  canonicalFiles(1,4000);converge();
  assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
  SafSyncV2 cached=sync(b,bi,false);
  String directory="sync/v2/messages/"+bid+"/"+aid;
  List<ImmutableStore.Entry> messages=store.list(directory);
  assertFalse(messages.isEmpty());
  String entry=messages.get(0).name;
  assertTrue(cached.inbox.get(aid,entry).getBoolean("acked"));
  byte[] original=Files.readAllBytes(new File(b.home,"media/original-0").toPath());
  File primary=new File(b.home,"projects.json"),backup=new File(b.home,"projects.bak");
  byte[] fallback="{\"schema\":1,\"records\":[]}".getBytes(java.nio.charset.StandardCharsets.UTF_8);
  Files.write(backup.toPath(),fallback);Files.write(primary.toPath(),new byte[]{0});
  byte[] damaged=Files.readAllBytes(primary.toPath());
  int ackCount=store.list("sync/v2/acks/"+aid+"/"+bid).size();
  store.watchedMessages=directory+"/";store.messageReads=0;
  try{cached.sync();fail("Cached inbox silently re-applied old cloud message");}
  catch(IOException expected){}
  String epoch=DatabaseRecovery.id(b.home);
  assertTrue(DeviceIdentity.valid(epoch));assertTrue(DatabaseRecovery.pending(b.home));
  assertNull("Pre-recovery cached ACK reused across epochs",cached.inbox.get(aid,entry));
  assertEquals(0,store.messageReads); // no network read before database authority check
  assertEquals(ackCount,store.list("sync/v2/acks/"+aid+"/"+bid).size());
  assertTrue(b.prefs.getBoolean("syncPending",false));
  assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length()); // read-only fallback
  try{LocalDatabase.readForCas(b);fail("Historical inbox authorized stale CAS");}catch(IOException expected){}
  assertArrayEquals(damaged,Files.readAllBytes(primary.toPath()));
  assertArrayEquals(fallback,Files.readAllBytes(backup.toPath()));
  assertArrayEquals(original,Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
  assertEquals("1585,800001",new JSONObject(LocalDatabase.readForCas(a)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
  store.messageReads=0;
  try{cached.sync();fail("Second cached pass bypassed recovery barrier");}catch(IOException expected){}
  assertEquals(0,store.messageReads);
  assertEquals(epoch,DatabaseRecovery.id(b.home));
 }

@Test public void signedImmutableMessagesConvergeAndNoMutableProjectsFileExists()throws Exception{
  files(3,8000);converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertEquals(0,new PeerOutbox(b,b.prefs,br).pending(aid));JSONObject received=new JSONObject(LocalDatabase.read(b.home));assertEquals("1585,800001",received.getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));for(int i=0;i<3;i++)assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-"+i).toPath()),Files.readAllBytes(new File(b.home,"media/original-"+i).toPath()));assertFalse(new File(store.root,"projects.json").exists());assertFalse(new File(store.root,"backups").exists());
 }
 @Test public void interruptedBlobAndRestartResumeWithoutPublishingPartialDatabase()throws Exception{
  files(30,4000);store.failTwentieth=true;SafSyncV2.Result first=sync(a,ai,false).sync();assertTrue(first.pending);assertTrue(first.message.contains("synthetic twentieth"));String before=LocalDatabase.read(b.home);assertTrue(sync(b,bi,false).sync().pending);assertEquals(before,LocalDatabase.read(b.home));assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);converge();assertEquals(30,new File(b.home,"media").listFiles(file->!file.getName().startsWith("revision-")).length);File[] revisionFiles=new File(b.home,"media").listFiles(file->file.getName().startsWith("revision-"));assertEquals(1,revisionFiles.length);for(File revisionFile:revisionFiles)assertEquals(revisionFile.getName().substring(9),PeerMedia.inspect(revisionFile).getString("hash"));assertEquals(1,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
 }
 @Test public void forgedAcknowledgementCannotClearQueueAndRevokedAuthorCannotWrite()throws Exception{
  files(1,4000);sync(a,ai,false).sync();JSONObject job=new PeerOutbox(a,a.prefs,ar).messages(bid).get(0);CloudFiles.publish(store,"sync/v2/acks/"+aid+"/"+bid,job.getString("hash"),CloudProof.sign(CloudProof.body(CloudProof.ACK,bid,aid,job.getString("hash"),job.getLong("size")),rogue));assertTrue(sync(a,ai,false).sync().pending);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);String before=LocalDatabase.read(b.home);br.forget(aid);try{sync(b,bi,false).sync();fail("Revoked author accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("spáruj"));}assertEquals(before,LocalDatabase.read(b.home));
 }
 @Test public void meteredMetadataUsesExistingOriginalButMissingLargePhotoWaits()throws Exception{
  files(1,1500000);store.largeHash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");assertTrue(sync(a,ai,true).sync().pending);assertTrue(sync(b,bi,true).sync().pending);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());assertEquals(0,store.readsOfLarge);converge();store.readsOfLarge=0;
  JSONObject fresh=new JSONObject(LocalDatabase.read(a.home)),record=fresh.getJSONArray("records").getJSONObject(0);record.getJSONArray("items").getJSONObject(0).put("measure","0,000000000123456789");record.put("syncClock",CausalClock.advance(CausalClock.clock(record),aid));LocalDatabase.write(a.home,fresh.toString());for(int i=0;i<3;i++){sync(a,ai,true).sync();sync(b,bi,true).sync();}assertEquals("0,000000000123456789",new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));assertEquals(0,store.readsOfLarge);
 }
 @Test public void committedInboxSurvivesLostAckAndAvoidsReadingOldMessagesAfterRestart()throws Exception{
  files(1,4000);store.watchedMessages="sync/v2/messages/"+bid+"/"+aid+"/";sync(a,ai,false).sync();store.failAck=true;SafSyncV2.Result interrupted=sync(b,bi,false).sync();assertTrue(interrupted.pending);assertTrue(interrupted.message.contains("synthetic lost ACK"));assertEquals(1,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());store.messageReads=0;sync(b,bi,false).sync();assertEquals(0,store.messageReads);converge();store.messageReads=0;sync(b,bi,true).sync();assertEquals(0,store.messageReads);assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
 }
 @Test public void signedBodyCannotBeChangedReaddressedOrUsedAsAnotherProofKind()throws Exception{
  String hash="a".repeat(64);JSONObject envelope=CloudProof.sign(CloudProof.body(CloudProof.MESSAGE,aid,bid,hash,100),ai);CloudProof.verify(envelope,ai.certificate(),CloudProof.MESSAGE,aid,bid);
  try{CloudProof.verify(envelope,ai.certificate(),CloudProof.ACK,aid,bid);fail("Message used as ACK");}catch(IOException expected){}envelope.getJSONObject("body").put("hash","b".repeat(64));try{CloudProof.verify(envelope,ai.certificate(),CloudProof.MESSAGE,aid,bid);fail("Changed signed body accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("Podpis"));}
 }
 @Test public void rejectedNetworkPolicyCannotExposeStaleFallbackAsConfirmed()throws Exception{
  files(1,4000);
  String older=LocalDatabase.readForCas(a.home);
  JSONObject latest=new JSONObject(older);
  JSONObject photo=latest.getJSONArray("records").getJSONObject(0);
  photo.getJSONArray("items").getJSONObject(0).put("measure","1585,800001234567890")
      .put("laserMeasuredMm","1585.800001234567890");
  LocalDatabase.write(a.home,latest.toString());
  File primary=new File(a.home,"projects.json"),backup=new File(a.home,"projects.bak");
  assertEquals(older,LocalDatabase.readFile(backup));
  byte[] originalBytes=Files.readAllBytes(new File(a.home,"media/original-0").toPath());
  Files.write(primary.toPath(),"{broken-primary".getBytes(java.nio.charset.StandardCharsets.UTF_8));
  byte[] broken=Files.readAllBytes(primary.toPath());
  try{
   new SafSyncV2(a,a.prefs,store,ai,bytes->false).sync();
   fail("An old valid backup must never be returned as current DB");
  }catch(IOException expected){}
  assertArrayEquals(broken,Files.readAllBytes(primary.toPath()));
  assertEquals(older,LocalDatabase.readFile(backup));
  assertArrayEquals(originalBytes,Files.readAllBytes(new File(a.home,"media/original-0").toPath()));
  assertEquals(0,store.writes);
  assertTrue(a.prefs.getBoolean("syncPending",false));
 }
 @Test public void rejectedNetworkPolicyDoesNotEvenListOrReadProvider()throws Exception{
  files(1,4000);SyncStore denied=new SyncStore(){public String namespace(){return "denied-store";}public InputStream open(String path){throw new AssertionError("Denied provider read");}public OutputStream create(String path){throw new AssertionError("Denied provider write");}public List<ImmutableStore.Entry> list(String path){throw new AssertionError("Denied provider list");}};String before=LocalDatabase.read(a.home);SafSyncV2.Result result=new SafSyncV2(a,a.prefs,denied,ai,bytes->false).sync();assertTrue(result.pending);assertTrue(result.message.contains("povolené připojení"));assertEquals(before,LocalDatabase.read(a.home));
 }
 @Test public void manyInvalidMessagesUseBoundedBatchesResumeAfterRestartAndCannotClearOutbox()throws Exception{
  files(1,4000);sync(a,ai,false).sync();String directory="sync/v2/messages/"+bid+"/"+aid;store.watchedMessages=directory+"/";for(int i=0;i<80;i++){File bad=store.file(directory+"/"+CloudScanTest.name(i));bad.getParentFile().mkdirs();Files.write(bad.toPath(),"{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));}store.messageReads=0;String before=LocalDatabase.read(b.home);SafSyncV2.Result first=sync(b,bi,false).sync();assertTrue(first.pending);assertTrue(store.messageReads<=64);assertEquals(before,LocalDatabase.read(b.home));assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);
  for(int i=0;i<4;i++){store.messageReads=0;sync(b,bi,false).sync();assertTrue(store.messageReads<=64);sync(a,ai,false).sync();}
  assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));JSONObject received=new JSONObject(LocalDatabase.read(b.home));assertEquals(1,received.getJSONArray("records").length());assertEquals("1585,800001",received.getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-0").toPath()),Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
 }

 @Test public void newlyAvailableDirectRouteYieldsCloudBetweenChunksWithoutClearingQueue()throws Exception{
  files(1,400000);store.largeHash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");String before=LocalDatabase.read(a.home);store.onLargeChunk=()->PeerGates.direct(a,bid);SafSyncV2.Result result=sync(a,ai,false).sync();assertTrue(result.pending);assertTrue(result.message.contains("místní přenos"));assertTrue(store.largeWritten>0&&store.largeWritten<=65536);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);assertEquals(before,LocalDatabase.read(a.home));assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());
  java.util.Map<?,?> activity=org.robolectric.util.ReflectionHelpers.getStaticField(PeerGates.class,"DIRECT");activity.clear();converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-0").toPath()),Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
 }
 @Test public void networkPolicyChangeDuringLargeUploadStopsAtNextChunkAndRecovers()throws Exception{
  files(1,1500000);store.largeHash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");java.util.concurrent.atomic.AtomicBoolean unmetered=new java.util.concurrent.atomic.AtomicBoolean(true);store.onLargeChunk=()->unmetered.set(false);SafSyncV2.Result result=new SafSyncV2(a,a.prefs,store,ai,bytes->unmetered.get()||bytes<=1024*1024).sync();assertTrue(result.pending);assertTrue(store.largeWritten>0&&store.largeWritten<=65536);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-0").toPath()),Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
 }

 @Test public void pendingSourceReopenDoesNotReadAlreadyVerifiedLargeOriginalAgain()throws Exception{
  canonicalFiles(1,1500000);store.largeHash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");assertTrue(sync(a,ai,false).sync().pending);int writes=store.writes;store.readsOfLarge=0;for(int i=0;i<3;i++)assertTrue(sync(a,ai,false).sync().pending);assertEquals(0,store.readsOfLarge);assertEquals(writes,store.writes);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
 }
 @Test public void deletedCloudCopyIsRepublishedWithoutOverwritingLocalOriginal()throws Exception{
  canonicalFiles(1,4000);String hash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");sync(a,ai,false).sync();for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(hash))Files.delete(store.file("sync/v2/blobs/"+entry.name).toPath());assertTrue(sync(b,bi,false).sync().pending);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());assertFalse(store.list("sync/v2/requests/"+aid+"/"+bid).isEmpty());converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-0").toPath()),Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
 }
 @Test public void signedRepairFixesSameSizeCorruptBlobAndReplayedRequestDoesNotRedownloadIt()throws Exception{
  canonicalFiles(1,4000);String hash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");store.largeHash=hash;sync(a,ai,false).sync();File bad=null;for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(hash)){bad=store.file("sync/v2/blobs/"+entry.name);Files.write(bad.toPath(),new byte[4000]);}assertNotNull(bad);store.readsOfLarge=0;sync(a,ai,false).sync();assertEquals(0,store.readsOfLarge);String before=LocalDatabase.read(b.home);assertTrue(sync(b,bi,false).sync().pending);assertEquals(before,LocalDatabase.read(b.home));assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);sync(a,ai,false).sync();assertTrue(store.readsOfLarge>0);store.readsOfLarge=0;sync(a,ai,false).sync();assertEquals(0,store.readsOfLarge);assertArrayEquals(new byte[4000],Files.readAllBytes(bad.toPath()));converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertArrayEquals(Files.readAllBytes(new File(a.home,"media/original-0").toPath()),Files.readAllBytes(new File(b.home,"media/original-0").toPath()));
 }
 @Test public void forgedOrUnreferencedRepairCannotTriggerLargeReadsOrClearOutbox()throws Exception{
  canonicalFiles(1,1500000);String hash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");store.largeHash=hash;sync(a,ai,false).sync();JSONObject job=new PeerOutbox(a,a.prefs,ar).messages(bid).get(0);String directory="sync/v2/requests/"+aid+"/"+bid;JSONObject need=CloudProof.need(bid,aid,job.getString("hash"),job.getLong("size"),hash,1500000,1,PeerTlsTest.C);CloudFiles.publish(store,directory,job.getString("hash"),CloudProof.sign(need,rogue));CloudFiles.publish(store,directory,job.getString("hash"),CloudProof.sign(CloudProof.need(bid,aid,job.getString("hash"),job.getLong("size"),"f".repeat(64),1500000,2,PeerTlsTest.C),bi));store.readsOfLarge=0;sync(a,ai,false).sync();assertEquals(0,store.readsOfLarge);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);try{CloudProof.verify(CloudProof.sign(need,bi),bi.certificate(),CloudProof.ACK,bid,aid);fail("Repair accepted as final data ACK");}catch(IOException expected){}
 }
 @Test public void largeRepairWaitsForUnmeteredPolicy()throws Exception{
  canonicalFiles(1,1500000);String hash=PeerMedia.inspect(new File(a.home,"media/original-0")).getString("hash");store.largeHash=hash;sync(a,ai,false).sync();for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(hash))Files.write(store.file("sync/v2/blobs/"+entry.name).toPath(),new byte[1500000]);sync(b,bi,false).sync();store.readsOfLarge=0;assertTrue(sync(a,ai,true).sync().pending);assertEquals(0,store.readsOfLarge);assertTrue(new PeerOutbox(a,a.prefs,ar).pending(bid)>0);converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));
 }

 @Test public void missingSnapshotRequestsVerifiedMetadataAndLegacyStateStillConverges()throws Exception{
  files(1,4000);sync(a,ai,false).sync();JSONObject job=new PeerOutbox(a,a.prefs,ar).messages(bid).get(0);String hash=job.getString("hash");for(ImmutableStore.Entry entry:store.list("sync/v2/blobs"))if(entry.name.startsWith(hash))Files.delete(store.file("sync/v2/blobs/"+entry.name).toPath());assertTrue(sync(b,bi,false).sync().pending);assertEquals(0,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());List<ImmutableStore.Entry> requests=store.list("sync/v2/requests/"+aid+"/"+bid);assertFalse(requests.isEmpty());JSONObject request=CloudProof.verify(CloudProof.read(store.open("sync/v2/requests/"+aid+"/"+bid+"/"+requests.get(0).name),PeerWire.MAX_HELLO),bi.certificate(),CloudProof.NEED,bid,aid);assertEquals(hash,request.getString("blob"));assertEquals(job.getLong("size"),request.getLong("blobSize"));converge();assertEquals(0,new PeerOutbox(a,a.prefs,ar).pending(bid));assertEquals("1585,800001",new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
 }


 @Test public void quarantinedHistoricalOutboxDoesNotBlockFreshSignedCloudSync()throws Exception{
  String precise="1585,800001234567890";
  JSONObject finalDb=null;
  // The transport fixture pairs identities before it seeds project storage.
  // Supply a validated legacy baseline before exercising Context-based writers;
  // the test concerns recovered outbox liveness, not first-install pairing.
  LocalDatabase.write(a.home,"{\"schema\":1,\"records\":[]}");
  LocalDatabase.write(b.home,"{\"schema\":1,\"records\":[]}");
  PeerOutbox outbox=new PeerOutbox(a,a.prefs,ar);
  for(int i=0;i<20;i++){
   JSONObject rec=new JSONObject().put("id","historic-cloud-"+i)
       .put("title","Old synthetic project")
       .put("syncClock",new JSONObject().put(aid,1))
       .put("items",new JSONArray().put(new JSONObject().put("measure",precise)));
   finalDb=new JSONObject().put("schema",1).put("records",new JSONArray().put(rec));
   LocalDatabase.write(a,finalDb.toString());
   outbox.prepare(bid);
  }
  assertEquals(40,outbox.pending(bid)); // 20 projects, one history intent and 19 revision blobs
  JSONObject old=outbox.messages(bid).get(0);
  File originalFile=new File(a.noBackup,"sync-v2-outbox/"+old.getString("hash")+".json");
  byte[] originalBytes=Files.readAllBytes(originalFile.toPath());
  assertTrue(new File(a.home,"projects.json").delete());
  try{LocalDatabase.readForCas(a);fail("Missing primary was accepted");}
  catch(IOException expected){}
  String epoch=DatabaseRecovery.id(a.home);
  assertTrue(DeviceIdentity.valid(epoch));
  // Synthetically model the explicit future restore without changing production DB semantics.
  Files.write(new File(a.home,"projects.json").toPath(),
      finalDb.toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));
  DatabaseRecovery.healthy(a.home,false);
  PeerSnapshot current=new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup)).prepare(bid);
  assertEquals(epoch,current.wire.getString("recoveryEpoch"));
  assertNotEquals(old.getString("hash"),current.hash);
  assertEquals(40,new PeerOutbox(a,a.prefs,ar).quarantinedCount(bid));
  // The actual signed-cloud send/receive/ACK path must process the fresh job.
  SafSyncV2.Result first=sync(a,ai,false).sync();
  assertTrue("Archived evidence must not be reported as fully ACKed",first.pending);
  converge();
  JSONArray accepted=new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records");
  assertEquals(1,accepted.length());
  assertEquals("historic-cloud-19",accepted.getJSONObject(0).getString("id"));
  assertEquals(precise,accepted.getJSONObject(0)
      .getJSONArray("items").getJSONObject(0).getString("measure"));
  PeerOutbox restarted=new PeerOutbox(a,a.prefs,new SyncPeerRegistry(a.noBackup));
  assertEquals(0,restarted.pending(bid));
  assertEquals(40,restarted.quarantinedCount(bid));
  assertArrayEquals(originalBytes,Files.readAllBytes(originalFile.toPath()));
  assertTrue(new SyncPeerRegistry(a.noBackup).lastAck(bid).matches("[a-f0-9]{64}"));
  assertNotEquals(old.getString("hash"),new SyncPeerRegistry(a.noBackup).lastAck(bid));
  assertFalse(store.list("sync/v2/acks/"+aid+"/"+bid).isEmpty());
  for(ImmutableStore.Entry entry:store.list("sync/v2/acks/"+aid+"/"+bid)){
   JSONObject signed=CloudProof.verify(CloudProof.read(
       store.open("sync/v2/acks/"+aid+"/"+bid+"/"+entry.name),PeerWire.MAX_HELLO),
       bi.certificate(),CloudProof.ACK,bid,aid);
   assertNotEquals(old.getString("hash"),signed.getString("hash"));
  }
  sync(a,ai,false).sync();
  sync(b,bi,false).sync();
  assertEquals(40,new PeerOutbox(a,a.prefs,ar).quarantinedCount(bid));
  assertEquals(1,new JSONObject(LocalDatabase.read(b.home)).getJSONArray("records").length());
  assertArrayEquals(originalBytes,Files.readAllBytes(originalFile.toPath()));
 }
}
