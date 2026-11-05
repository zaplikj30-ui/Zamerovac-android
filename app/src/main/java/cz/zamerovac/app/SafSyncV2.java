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
 final Context context;final SharedPreferences prefs;final SyncStore store;final SyncTls identity;final SyncPeerRegistry peers;final PeerDataStore data;final String own;final Policy policy;private long transferred;
 SafSyncV2(Context context,SharedPreferences prefs,SyncStore store,SyncTls identity,Policy policy)throws Exception{this.context=context;this.prefs=prefs;this.store=store;this.identity=identity;this.policy=policy;peers=new SyncPeerRegistry(context.getNoBackupFilesDir());own=DeviceIdentity.get(context.getNoBackupFilesDir());data=new PeerDataStore(context,prefs,peers,null);}
 private static String directory(String kind,String recipient,String author){return "sync/v2/"+kind+"/"+recipient+"/"+author;}
 private boolean proof(String kind,String recipient,String author,String hash,long size,X509Certificate certificate,String format)throws Exception{
  for(ImmutableStore.Entry entry:store.list(directory(kind,recipient,author))){if(entry.directory||!entry.name.matches(hash+"-[a-f0-9-]{36}\\.json"))continue;try{JSONObject body=CloudProof.verify(CloudProof.read(store.open(directory(kind,recipient,author)+"/"+entry.name),PeerWire.MAX_HELLO),certificate,format,author,recipient);if(hash.equals(body.getString("hash"))&&size==body.getLong("size"))return true;}catch(Exception incomplete){/* Never treat a partially written or forged proof as an ACK. */}}
  return false;
 }
 private boolean receive(String peer,X509Certificate certificate)throws Exception{
  String directory=directory("messages",own,peer);int count=0;boolean pending=false;
  for(ImmutableStore.Entry entry:store.list(directory)){
   if(entry.directory||!entry.name.matches("[a-f0-9]{64}-[a-f0-9-]{36}\\.json"))continue;if(++count>10000)throw new IOException("Příliš mnoho cloudových zpráv");JSONObject body;
   try{body=CloudProof.verify(CloudProof.read(store.open(directory+"/"+entry.name),PeerWire.MAX_HELLO),certificate,CloudProof.MESSAGE,peer,own);}catch(Exception invalid){pending=true;continue;}
   String hash=body.getString("hash");long size=body.getLong("size");if(!entry.name.startsWith(hash+"-"))throw new IOException("Nesprávná cesta podepsané zprávy");
   if(proof("acks",peer,own,hash,size,identity.certificate(),CloudProof.ACK))continue;if(!policy.allow(transferred+size*2)){pending=true;continue;}transferred+=size*2;
   byte[] bytes=CloudFiles.read(store.open(CloudFiles.find(store,hash,size)),PeerWire.MAX_JSON);if(bytes.length!=size||!hash.equals(PeerWire.hash(bytes)))throw new IOException("Poškozená revize cloudu");PeerSnapshot snapshot=PeerSnapshot.parse(bytes,peer);PeerHandshake.Peer authenticated=new PeerHandshake.Peer(peer,peers.snapshot().getJSONObject(peer).optString("name","Android"),SyncTls.fingerprint(certificate));JSONArray needed=data.needed(snapshot,authenticated);
   long neededBytes=0;for(int i=0;i<needed.length();i++)neededBytes+=snapshot.media.get(needed.getString(i)).getLong("size")*2;if(!policy.allow(transferred+neededBytes)){pending=true;continue;}transferred+=neededBytes;
   for(int i=0;i<needed.length();i++){String id=needed.getString(i);JSONObject media=snapshot.media.get(id);try(InputStream in=store.open(CloudFiles.find(store,media.getString("hash"),media.getLong("size")))){data.receive(id,in,media,authenticated);if(in.read()!=-1)throw new IOException("Cloudová příloha je delší než manifest");}}
   data.apply(snapshot,authenticated);JSONObject ack=CloudProof.sign(CloudProof.body(CloudProof.ACK,own,peer,hash,size),identity);CloudFiles.publish(store,directory("acks",peer,own),hash,ack);
  }return pending;
 }
 private boolean send(String peer,X509Certificate certificate)throws Exception{
  PeerHandshake.Peer authenticated=new PeerHandshake.Peer(peer,"Android",SyncTls.fingerprint(certificate));data.trusted(authenticated);data.outbox.prepare(peer);boolean pending=false;
  for(JSONObject job:data.outbox.messages(peer)){
   data.trusted(authenticated);PeerSnapshot snapshot=data.outbox.load(job);
   if(proof("acks",own,peer,snapshot.hash,snapshot.bytes.length,certificate,CloudProof.ACK)){data.outbox.completed(peer,job);continue;}
   if(!policy.allow(transferred+snapshot.bytes.length*3L)){pending=true;continue;}transferred+=snapshot.bytes.length*3L;
   CloudFiles.put(store,snapshot.hash,snapshot.bytes.length,()->new ByteArrayInputStream(snapshot.bytes));
   // A signed message is a pending intent, not a claim that the receiver has committed the project.
   // This lets small edits reach a peer which already has the originals, even on a metered network.
   data.trusted(authenticated);if(!proof("messages",peer,own,snapshot.hash,snapshot.bytes.length,identity.certificate(),CloudProof.MESSAGE))CloudFiles.publish(store,directory("messages",peer,own),snapshot.hash,CloudProof.sign(CloudProof.body(CloudProof.MESSAGE,own,peer,snapshot.hash,snapshot.bytes.length),identity));
   for(JSONObject media:snapshot.media.values()){data.trusted(authenticated);String id=media.getString("id");long budget=media.getLong("size")*3;if(!policy.allow(transferred+budget)){pending=true;continue;}transferred+=budget;CloudFiles.put(store,media.getString("hash"),media.getLong("size"),()->new FileInputStream(new File(data.outbox.mediaDirectory,id)));}
   pending=true;
  }return pending;
 }
 Result sync()throws Exception{
  AtomicBoolean running=RUNNING.computeIfAbsent(context.getNoBackupFilesDir().getAbsolutePath(),ignored->new AtomicBoolean());if(!running.compareAndSet(false,true))throw new IOException("Cloudová synchronizace již probíhá");boolean pending=false;String error="";transferred=0;
  try{JSONObject known=peers.snapshot();if(known.length()==0)throw new IOException("Nejdříve spáruj telefon a tablet přes Synchronizace zařízení. Cloud přijímá jen podepsaná data schválené instalace.");
   for(Iterator<String> it=known.keys();it.hasNext();){String peer=it.next();ReentrantLock gate=PeerGates.get(context,peer);if(PeerGates.recentlyDirect(context,peer)||!gate.tryLock()){pending=true;continue;}try{X509Certificate certificate=peers.certificate(peer);pending|=receive(peer,certificate);pending|=send(peer,certificate);pending|=receive(peer,certificate);if(data.outbox.pending(peer)>0)pending=true;}catch(FileNotFoundException waitingForBlob){pending=true;}catch(Exception failure){pending=true;error=String.valueOf(failure.getMessage());}finally{gate.unlock();}}
   prefs.edit().putBoolean("syncPending",pending).commit();String text=LocalDatabase.read(context.getFilesDir());JSONObject result=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(text);return new Result(!error.isEmpty()?"Synchronizace hlásí chybu: "+error:pending?"Synchronizace: čeká na spojení, přílohy nebo potvrzení druhého zařízení":"Synchronizace: všechny přenášené změny potvrzeny",result,pending);
  }catch(Exception failure){prefs.edit().putBoolean("syncPending",true).commit();throw failure;}finally{running.set(false);}
 }
}
