package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import java.io.*;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;

/** Immutable, pinned-author cloud exchange over the selected provider. No shared projects.json writer. */
final class SafSyncV2 {
 static final class Result {final String message;final JSONObject data;final boolean pending;Result(String message,JSONObject data,boolean pending){this.message=message;this.data=data;this.pending=pending;}}
 interface Policy {boolean allow(long bytes);}
 private static final ConcurrentHashMap<String,AtomicBoolean> RUNNING=new ConcurrentHashMap<>();
 private static final ProviderIo CONTROL_IO=new ProviderIo(60000,2);
 final Context context;final SharedPreferences prefs;final SyncStore store;final SyncTls identity;final SyncPeerRegistry peers;final PeerDataStore data;final String own;final Policy policy;final CloudInbox inbox;final CloudScan scan;final CloudPublications publications;private Map<String,ImmutableStore.Entry> blobEntries;private volatile long transferred;private long controlNanos;private volatile String activePeer;private int controls;private volatile boolean deferred;private final Map<String,List<ImmutableStore.Entry>> listings=new HashMap<>();
 SafSyncV2(Context context,SharedPreferences prefs,SyncStore store,SyncTls identity,Policy policy)throws Exception{this.context=context;this.prefs=prefs;this.store=new GuardedSyncStore(store,this::route);this.identity=identity;this.policy=policy;peers=new SyncPeerRegistry(context.getNoBackupFilesDir());own=DeviceIdentity.get(context.getNoBackupFilesDir());data=new PeerDataStore(context,prefs,peers,null);inbox=new CloudInbox(context.getNoBackupFilesDir(),own,store.namespace(),context.getFilesDir());scan=new CloudScan(context.getNoBackupFilesDir(),own,store.namespace());publications=new CloudPublications(context.getNoBackupFilesDir(),own,store.namespace());}
 private static String directory(String kind,String recipient,String author){return "sync/v2/"+kind+"/"+recipient+"/"+author;}
 private void route()throws CloudScan.Deferred{if(Thread.currentThread().isInterrupted()||activePeer!=null&&PeerGates.recentlyDirect(context,activePeer)||!policy.allow(Math.max(1,transferred))){deferred=true;throw new CloudScan.Deferred();}}
 private void controlTime()throws CloudScan.Deferred{route();if(controls>=128||controlNanos>TimeUnit.SECONDS.toNanos(60)){deferred=true;throw new CloudScan.Deferred();}}
 private void control()throws Exception{controlTime();if(!policy.allow(transferred+PeerWire.MAX_HELLO+1)){deferred=true;throw new CloudScan.Deferred();}transferred+=PeerWire.MAX_HELLO+1;controls++;}
 private List<ImmutableStore.Entry> listed(String path)throws Exception{controlTime();List<ImmutableStore.Entry> entries=listings.get(path);if(entries==null){long started=System.nanoTime();try{entries=CONTROL_IO.call(()->store.list(path),null);}finally{controlNanos+=System.nanoTime()-started;}if(entries.size()>100000)throw new IOException("Příliš mnoho cloudových položek");listings.put(path,entries);}return entries;}
 private JSONObject envelope(String path,String scope,String name)throws Exception{control();scan.advance(scope,name);long started=System.nanoTime();try{return CONTROL_IO.call(()->CloudProof.read(store.open(path),PeerWire.MAX_HELLO),null);}finally{controlNanos+=System.nanoTime()-started;}}
 private void publish(String directory,String hash,JSONObject envelope)throws Exception{long bytes=CloudProof.bytes(envelope).length*2L;if(!policy.allow(transferred+bytes)){deferred=true;throw new CloudScan.Deferred();}transferred+=bytes;CloudFiles.publish(store,directory,hash,envelope);listings.remove(directory);}
 private boolean proof(String kind,String recipient,String author,String hash,long size,X509Certificate certificate,String format)throws Exception{
  String directory=directory(kind,recipient,author),scope=directory+"/"+hash;List<ImmutableStore.Entry> candidates=new ArrayList<>();for(ImmutableStore.Entry entry:listed(directory))if(!entry.directory&&entry.name.matches(hash+"-[a-f0-9-]{36}\\.json"))candidates.add(entry);int count=0;
  for(ImmutableStore.Entry entry:scan.ordered(scope,candidates)){if(++count>8){deferred=true;throw new CloudScan.Deferred();}JSONObject envelope=envelope(directory+"/"+entry.name,scope,entry.name);
   try{JSONObject body=CloudProof.verify(envelope,certificate,format,author,recipient);if(hash.equals(body.getString("hash"))&&size==body.getLong("size"))return true;}catch(Exception forged){/* Never treat a forged proof as an ACK. */}
  }return false;
 }
 private Map<String,ImmutableStore.Entry> blobs()throws Exception{if(blobEntries==null){blobEntries=new HashMap<>();for(ImmutableStore.Entry entry:listed("sync/v2/blobs"))blobEntries.put(entry.name,entry);}return blobEntries;}
 private boolean putPublished(String peer,PeerSnapshot snapshot,String hash,long size,CloudFiles.Source source)throws Exception{
  long repair=publications.pending(peer,snapshot.hash,hash);String round=repair==0?"":PeerWire.hash((peer+"/"+snapshot.hash+"/"+hash+"/"+repair).getBytes(java.nio.charset.StandardCharsets.UTF_8));
  if(publications.fresh(hash,size,round,blobs())==null){long budget=size*3;if(!policy.allow(transferred+budget))return false;transferred+=budget;String path=CloudFiles.put(store,hash,size,source);publications.published(hash,size,path,round);blobEntries.put(path.substring(path.lastIndexOf('/')+1),new ImmutableStore.Entry(path.substring(path.lastIndexOf('/')+1),false,size));}
  if(repair>0)publications.handled(peer,snapshot.hash,hash,repair);return true;
 }
 private void repairRequests(String peer,PeerSnapshot snapshot,X509Certificate certificate)throws Exception{
  String directory=directory("requests",own,peer),scope=directory+"/"+snapshot.hash;List<ImmutableStore.Entry> candidates=new ArrayList<>();for(ImmutableStore.Entry entry:listed(directory))if(!entry.directory&&entry.name.matches(snapshot.hash+"-[a-f0-9-]{36}\\.json")&&!publications.seen(peer,entry.name))candidates.add(entry);int count=0;
  for(ImmutableStore.Entry entry:scan.ordered(scope,candidates)){if(++count>8)break;JSONObject body;try{body=CloudProof.verify(envelope(directory+"/"+entry.name,scope,entry.name),certificate,CloudProof.NEED,peer,own);}catch(CloudScan.Deferred next){throw next;}catch(Exception invalid){continue;}
   String blob=body.getString("blob");long size=body.getLong("blobSize");boolean referenced=snapshot.hash.equals(blob)&&snapshot.bytes.length==size;for(JSONObject media:snapshot.media.values())if(blob.equals(media.getString("hash"))&&size==media.getLong("size"))referenced=true;
   if(referenced&&snapshot.hash.equals(body.getString("hash"))&&snapshot.bytes.length==body.getLong("size"))publications.observe(peer,entry.name,snapshot.hash,blob,body.getLong("sequence"));
  }
 }
 private void requestRepair(String peer,String snapshot,long snapshotSize,String blob,long size)throws Exception{
  JSONObject request=publications.need(peer,snapshot,snapshotSize,blob,size);if(request.getBoolean("sent"))return;
  JSONObject body=CloudProof.need(own,peer,snapshot,snapshotSize,blob,size,request.getLong("sequence"),request.getString("request"));publish(directory("requests",peer,own),snapshot,CloudProof.sign(body,identity));publications.sent(peer,snapshot,blob,request.getLong("sequence"));
 }
 private String findCloud(String peer,String snapshot,long snapshotSize,String blob,long size)throws Exception{
  try{return CloudFiles.find(store,blob,size);}catch(CloudScan.Deferred next){throw next;}catch(IOException missing){requestRepair(peer,snapshot,snapshotSize,blob,size);throw missing;}
 }
 private boolean receive(String peer,X509Certificate certificate)throws Exception{
  LocalDatabase.read(context.getFilesDir());String directory=directory("messages",own,peer);int count=0;boolean pending=false;
  try{List<ImmutableStore.Entry> unseen=new ArrayList<>(),waiting=new ArrayList<>();for(ImmutableStore.Entry entry:listed(directory)){if(entry.directory||!entry.name.matches("[a-f0-9]{64}-[a-f0-9-]{36}\\.json"))continue;JSONObject known=inbox.get(peer,entry.name);if(known==null)unseen.add(entry);else if(!known.getBoolean("acked"))waiting.add(entry);}waiting.addAll(scan.ordered(directory,unseen));
  for(ImmutableStore.Entry entry:waiting){
   LocalDatabase.read(context.getFilesDir());JSONObject committed=inbox.get(peer,entry.name);if(committed!=null){if(!committed.getBoolean("acked")){publish(directory("acks",peer,own),committed.getString("hash"),CloudProof.sign(CloudProof.body(CloudProof.ACK,own,peer,committed.getString("hash"),committed.getLong("size")),identity));inbox.acknowledged(peer,entry.name);}continue;}if(++count>32){deferred=true;return true;}JSONObject body;
   try{body=CloudProof.verify(envelope(directory+"/"+entry.name,directory,entry.name),certificate,CloudProof.MESSAGE,peer,own);}catch(CloudScan.Deferred nextBatch){throw nextBatch;}catch(IOException unavailable){return true;}catch(Exception invalid){pending=true;continue;}
   String hash=body.getString("hash");long size=body.getLong("size");if(!entry.name.startsWith(hash+"-"))throw new IOException("Nesprávná cesta podepsané zprávy");
   // A historical cloud ACK cannot prove that this local database survived recovery.
   if(!policy.allow(transferred+size*2)){pending=true;continue;}transferred+=size*2;
   byte[] bytes=CloudFiles.read(store.open(findCloud(peer,hash,size,hash,size)),(int)size);if(bytes.length!=size||!hash.equals(PeerWire.hash(bytes)))throw new IOException("Poškozená revize cloudu");PeerSnapshot snapshot=PeerSnapshot.parse(bytes,peer);PeerHandshake.Peer authenticated=new PeerHandshake.Peer(peer,peers.snapshot().getJSONObject(peer).optString("name","Android"),SyncTls.fingerprint(certificate));JSONArray needed=data.needed(snapshot,authenticated);
   long neededBytes=0;for(int i=0;i<needed.length();i++)neededBytes+=snapshot.media.get(needed.getString(i)).getLong("size")*2;if(!policy.allow(transferred+neededBytes)){pending=true;continue;}transferred+=neededBytes;
   for(int i=0;i<needed.length();i++){String id=needed.getString(i);JSONObject media=snapshot.media.get(id);try(InputStream in=store.open(findCloud(peer,hash,size,media.getString("hash"),media.getLong("size")))){data.receive(id,in,media,authenticated);if(in.read()!=-1)throw new IOException("Cloudová příloha je delší než manifest");}}
   route();data.apply(snapshot,authenticated);inbox.committed(peer,entry.name,hash,size);JSONObject ack=CloudProof.sign(CloudProof.body(CloudProof.ACK,own,peer,hash,size),identity);publish(directory("acks",peer,own),hash,ack);inbox.acknowledged(peer,entry.name);
  }return pending;}catch(CloudScan.Deferred nextBatch){return true;}
 }
 private boolean send(String peer,X509Certificate certificate)throws Exception{
  boolean pending=false;try{controlTime();PeerHandshake.Peer authenticated=new PeerHandshake.Peer(peer,"Android",SyncTls.fingerprint(certificate));data.trusted(authenticated);data.outbox.prepare(peer);
  for(JSONObject job:data.outbox.messages(peer)){
   data.trusted(authenticated);PeerSnapshot snapshot=data.outbox.load(job);
   if(proof("acks",own,peer,snapshot.hash,snapshot.bytes.length,certificate,CloudProof.ACK)){data.outbox.completed(peer,job);continue;}
   repairRequests(peer,snapshot,certificate);
   if(!putPublished(peer,snapshot,snapshot.hash,snapshot.bytes.length,()->new ByteArrayInputStream(snapshot.bytes))){pending=true;continue;}
   // A signed message is a pending intent, not a claim that the receiver has committed the project.
   // This lets small edits reach a peer which already has the originals, even on a metered network.
   data.trusted(authenticated);if(!proof("messages",peer,own,snapshot.hash,snapshot.bytes.length,identity.certificate(),CloudProof.MESSAGE))publish(directory("messages",peer,own),snapshot.hash,CloudProof.sign(CloudProof.body(CloudProof.MESSAGE,own,peer,snapshot.hash,snapshot.bytes.length),identity));
   for(JSONObject media:snapshot.media.values()){data.trusted(authenticated);String id=media.getString("id");if(!putPublished(peer,snapshot,media.getString("hash"),media.getLong("size"),()->new FileInputStream(new File(data.outbox.mediaDirectory,id))))pending=true;}
   pending=true;
  }return pending;}catch(CloudScan.Deferred nextBatch){return true;}
 }
 Result sync()throws Exception{
  AtomicBoolean running=RUNNING.computeIfAbsent(context.getNoBackupFilesDir().getAbsolutePath(),ignored->new AtomicBoolean());if(!running.compareAndSet(false,true))throw new IOException("Cloudová synchronizace již probíhá");boolean pending=false;String error="";transferred=0;controls=0;controlNanos=0;deferred=false;listings.clear();blobEntries=null;
  try{if(!policy.allow(1)){prefs.edit().putBoolean("syncPending",true).commit();String local=LocalDatabase.read(context.getFilesDir());return new Result("Synchronizace čeká na povolené připojení",local.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(local),true);}JSONObject known=peers.snapshot();if(known.length()==0)throw new IOException("Nejdříve spáruj telefon a tablet přes Synchronizace zařízení. Cloud přijímá jen podepsaná data schválené instalace.");
   List<ImmutableStore.Entry> peerIds=new ArrayList<>();for(Iterator<String> it=known.keys();it.hasNext();)peerIds.add(new ImmutableStore.Entry(it.next(),false,0));
   for(ImmutableStore.Entry entry:scan.ordered("peers",peerIds)){try{controlTime();}catch(CloudScan.Deferred nextBatch){pending=true;break;}String peer=entry.name;scan.advance("peers",peer);ReentrantLock gate=PeerGates.get(context,peer);if(PeerGates.recentlyDirect(context,peer)||!gate.tryLock()){pending=true;continue;}try{activePeer=peer;X509Certificate certificate=peers.certificate(peer);pending|=receive(peer,certificate);pending|=send(peer,certificate);pending|=receive(peer,certificate);if(data.outbox.pending(peer)>0)pending=true;}catch(FileNotFoundException waitingForBlob){pending=true;}catch(Exception failure){pending=true;error=String.valueOf(failure.getMessage());}finally{activePeer=null;gate.unlock();}}
   prefs.edit().putBoolean("syncPending",pending).commit();String text=LocalDatabase.read(context.getFilesDir());JSONObject result=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(text);return new Result(!error.isEmpty()?"Synchronizace hlásí chybu: "+error:deferred?"Synchronizace čeká na místní přenos, povolenou síť nebo další dávku zpráv":pending?"Synchronizace: čeká na spojení, přílohy nebo potvrzení druhého zařízení":"Synchronizace: všechny přenášené změny potvrzeny",result,pending);
  }catch(Exception failure){prefs.edit().putBoolean("syncPending",true).commit();throw failure;}finally{running.set(false);}
 }
}
