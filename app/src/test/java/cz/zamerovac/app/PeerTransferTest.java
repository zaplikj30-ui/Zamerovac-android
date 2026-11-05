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
 void media(Device device,JSONObject record,int count)throws Exception{JSONArray refs=new JSONArray();File directory=new File(device.home,"media");directory.mkdirs();for(int i=0;i<count;i++){String id="media-"+i;byte[] bytes=new byte[8192+i];Arrays.fill(bytes,(byte)(i+17));Files.write(new File(directory,id).toPath(),bytes);refs.put(id);device.prefs.edit().putString("mime-"+id,"image/jpeg").putString("name-"+id,"Zkušební foto "+i).commit();}record.put("media",refs);}
 void exchange(PeerTransfer.Progress sender,PeerTransfer.Progress receiver)throws Exception{
  tls.sockets(tls.b.context(br,()->false),tls.a.context(ar,()->false),socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,bid,"Synthetic tablet",tls.b,br,()->false,request->false);new PeerTransfer(bs,receiver).exchange(socket,peer,false);},socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,aid,"Synthetic phone",tls.a,ar,()->false,request->false);new PeerTransfer(as,sender).exchange(socket,peer,true);});
 }
 @Test public void completeBidirectionalMediaAndExactAnnotationsRemainIdempotent()throws Exception{
  JSONObject photo=record("photo-a",aid,"0,000000000123456789"),note=record("note-b",bid,"99999999,123456789");media(a,photo,3);photo.put("notes",new JSONArray().put(new JSONObject().put("text","Přesná poznámka").put("audioMedia",new JSONArray().put("media-1"))));photo.getJSONArray("items").put(new JSONObject().put("type","detail").put("detailItems",new JSONArray().put(new JSONObject().put("media",new JSONArray().put("media-2")).put("measure","1585,800001"))));save(a,db(photo));save(b,db(note));
  exchange(null,null);exchange(null,null);assertEquals(2,read(a).getJSONArray("records").length());assertEquals(CausalClock.canonical(read(a)),CausalClock.canonical(read(b)));assertEquals(CausalClock.canonical(photo),CausalClock.canonical(read(b).getJSONArray("records").getJSONObject(1)));
  for(int i=0;i<3;i++)assertArrayEquals(Files.readAllBytes(new File(a.home,"media/media-"+i).toPath()),Files.readAllBytes(new File(b.home,"media/media-"+i).toPath()));assertEquals("Zkušební foto 2",b.prefs.getString("name-media-2",null));assertEquals(0,as.outbox.pending(bid));assertEquals(0,bs.outbox.pending(aid));assertTrue(new File(a.noBackup,"sync-queue-v2.json").exists());assertFalse(new File(a.home,"sync-queue-v2.json").exists());
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
}
