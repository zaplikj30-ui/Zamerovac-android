package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicLong;
import javax.net.ssl.SSLSocket;

/** Symmetric complete-project exchange over an ALREADY authenticated TLS socket. */
final class PeerTransfer {
    interface Progress {void update(String peer,String phase,int completed,int total)throws Exception;}
    private final PeerDataStore store;private final Progress progress;
    private final ScheduledExecutorService heartbeat=Executors.newScheduledThreadPool(2);
    PeerTransfer(PeerDataStore store,Progress progress){this.store=store;this.progress=progress;}
    private interface Work<T>{T run()throws Exception;}
    private <T>T working(DataOutputStream out,Work<T> work)throws Exception{
        AtomicBoolean active=new AtomicBoolean(true);ScheduledFuture<?> task=heartbeat.scheduleAtFixedRate(()->{synchronized(out){if(active.get())try{PeerWire.write(out,new JSONObject().put("type","working"),PeerWire.MAX_HELLO);}catch(Exception ignored){}}},2,2,TimeUnit.SECONDS);
        try{return work.run();}finally{synchronized(out){active.set(false);}task.cancel(false);}
    }
    private JSONObject message(DataInputStream in)throws Exception{for(;;){JSONObject message=PeerWire.read(in,PeerWire.MAX_JSON);if(!"working".equals(message.optString("type")))return message;}}
    private void update(PeerHandshake.Peer peer,String phase,int complete,int total)throws Exception{if(progress!=null)progress.update(peer.id,phase,complete,total);}
    void exchange(SSLSocket socket,PeerHandshake.Peer peer,boolean initiator)throws Exception{
        if(!socket.getSession().isValid())throw new IOException("TLS relace není platná");
        // Recovery fallback cannot authorize a peer session.
        LocalDatabase.readForCas(store.context);
        store.trusted(peer);AtomicLong activity=new AtomicLong(System.nanoTime());
        InputStream trackedInput=new FilterInputStream(socket.getInputStream()){@Override public int read(byte[] bytes,int offset,int length)throws IOException{int count=in.read(bytes,offset,length);activity.set(System.nanoTime());return count;}@Override public int read()throws IOException{int value=in.read();activity.set(System.nanoTime());return value;}};
        OutputStream trackedOutput=new FilterOutputStream(socket.getOutputStream()){@Override public void write(byte[] bytes,int offset,int length)throws IOException{out.write(bytes,offset,length);activity.set(System.nanoTime());}@Override public void write(int value)throws IOException{out.write(value);activity.set(System.nanoTime());}};
        DataInputStream in=new DataInputStream(new BufferedInputStream(trackedInput,65536));DataOutputStream out=new DataOutputStream(new BufferedOutputStream(trackedOutput,65536));
        // Java sockets have no write timeout. Close a stalled writer as well as a stalled reader.
        ScheduledFuture<?> watchdog=heartbeat.scheduleAtFixedRate(()->{if(System.nanoTime()-activity.get()>TimeUnit.SECONDS.toNanos(45))try{socket.close();}catch(IOException ignored){}},5,5,TimeUnit.SECONDS);
        try{if(initiator){send(in,out,peer);receive(in,out,peer);}else{receive(in,out,peer);send(in,out,peer);}store.trusted(peer);store.outbox.prepare(peer.id);update(peer,store.outbox.pending(peer.id)==0&&store.outbox.quarantinedCount(peer.id)==0&&!store.outbox.contentProblem(peer.id)?"done":"waiting",0,store.outbox.pending(peer.id));}
        finally{watchdog.cancel(false);heartbeat.shutdownNow();}
    }
    private void send(DataInputStream in,DataOutputStream out,PeerHandshake.Peer peer)throws Exception{
        working(out,()->{update(peer,"preparing",0,0);store.outbox.prepare(peer.id);return null;});List<JSONObject> messages=store.outbox.messages(peer.id);
        if(!peer.recoveryContent){List<JSONObject> compatible=new ArrayList<>();for(JSONObject job:messages)if(!store.outbox.load(job).wire.optBoolean("recoveryOnly"))compatible.add(job);messages=compatible;}
        PeerWire.write(out,new JSONObject().put("type","batch").put("count",messages.size()).put("recovery",LocalDatabase.recoveryId(store.context)),PeerWire.MAX_HELLO);
        for(JSONObject job:messages){
            store.trusted(peer);PeerSnapshot snapshot=store.outbox.load(job);
            PeerWire.write(out,new JSONObject().put("type","snapshot").put("id",job.getString("id")).put("hash",snapshot.hash).put("size",snapshot.bytes.length),PeerWire.MAX_HELLO);PeerWire.writeBytes(out,snapshot.bytes,PeerWire.MAX_JSON);
            JSONObject response=message(in);if(!"need".equals(response.optString("type"))||!snapshot.hash.equals(response.optString("hash")))throw new IOException("Neplatné potvrzení seznamu příloh");
            JSONArray needs=response.getJSONArray("ids");Set<String> requested=new HashSet<>();for(int i=0;i<needs.length();i++){String id=needs.getString(i);if(!snapshot.media.containsKey(id)||!requested.add(id))throw new IOException("Neplatný požadavek přílohy");}
            for(JSONObject media:snapshot.media.values())if(!requested.contains(media.getString("id"))){
                LocalDatabase.readForCas(store.context);
                store.outbox.acknowledge(PeerOutbox.jobId(peer.id,"blob",media.getString("hash"),snapshot.hash,media.getString("id")),media.getString("hash"),media.getLong("size"),false);
            }
            int completed=snapshot.media.size()-requested.size();update(peer,"sending",completed,snapshot.media.size());
            for(int i=0;i<needs.length();i++){
                store.trusted(peer);String id=needs.getString(i);JSONObject media=snapshot.media.get(id);String blobId=PeerOutbox.jobId(peer.id,"blob",media.getString("hash"),snapshot.hash,id);
                PeerWire.write(out,new JSONObject().put("type","blob").put("id",id).put("jobId",blobId).put("hash",media.getString("hash")).put("size",media.getLong("size")),PeerWire.MAX_HELLO);
                PeerMedia.send(new File(store.outbox.mediaDirectory,id),out,media);JSONObject ack=message(in);ack(ack,blobId,media.getString("hash"),media.getLong("size"));LocalDatabase.readForCas(store.context);store.outbox.acknowledge(blobId,media.getString("hash"),media.getLong("size"),false);update(peer,"sending",++completed,snapshot.media.size());
            }
            PeerWire.write(out,new JSONObject().put("type","commit").put("hash",snapshot.hash).put("id",job.getString("id")),PeerWire.MAX_HELLO);
            JSONObject ack=message(in);ack(ack,job.getString("id"),snapshot.hash,snapshot.bytes.length);LocalDatabase.readForCas(store.context);store.outbox.completed(peer.id,job);
        }
    }
    private void receive(DataInputStream in,DataOutputStream out,PeerHandshake.Peer peer)throws Exception{
        JSONObject batch=message(in);if(!"batch".equals(batch.optString("type")))throw new IOException("Neplatná dávka synchronizace");long count=PeerSnapshot.integer(batch,"count",16);
        if(batch.has("recovery")){Object recovery=batch.get("recovery");if(!(recovery instanceof String))throw new IOException("Neplatná obnova zařízení");if(!((String)recovery).isEmpty())store.peers.recovered(peer.id,(String)recovery);}
        for(int n=0;n<count;n++){
            store.trusted(peer);JSONObject header=message(in);if(!"snapshot".equals(header.optString("type")))throw new IOException("Neplatná zpráva revize");String hash=header.getString("hash"),jobId=header.getString("id");long size=PeerSnapshot.integer(header,"size",PeerWire.MAX_JSON);
            byte[] bytes=PeerWire.readBytes(in,PeerWire.MAX_JSON);if(size!=bytes.length||!hash.equals(PeerWire.hash(bytes)))throw new IOException("Neúplná nebo poškozená revize");
            PeerSnapshot snapshot=PeerSnapshot.parse(bytes,peer.id);String own=DeviceIdentity.get(store.context.getNoBackupFilesDir());if(!jobId.equals(PeerOutbox.jobId(own,"metadata",hash,hash,null)))throw new IOException("Nesprávná identita zprávy");
            JSONArray needed=working(out,()->store.needed(snapshot,peer));PeerWire.write(out,new JSONObject().put("type","need").put("hash",hash).put("ids",needed),PeerWire.MAX_JSON);update(peer,"receiving",snapshot.media.size()-needed.length(),snapshot.media.size());
            for(int i=0;i<needed.length();i++){
                String id=needed.getString(i);JSONObject expected=snapshot.media.get(id),blob=message(in);String expectedJob=PeerOutbox.jobId(own,"blob",expected.getString("hash"),hash,id);
                if(!"blob".equals(blob.optString("type"))||!id.equals(blob.optString("id"))||!expectedJob.equals(blob.optString("jobId"))||!expected.getString("hash").equals(blob.optString("hash"))||PeerSnapshot.integer(blob,"size",PeerSnapshot.MAX_MEDIA)!=expected.getLong("size"))throw new IOException("Neplatná příloha relace");
                store.receive(id,in,expected,peer);LocalDatabase.readForCas(store.context);PeerWire.write(out,receipt(expectedJob,expected.getString("hash"),expected.getLong("size")),PeerWire.MAX_HELLO);update(peer,"receiving",snapshot.media.size()-needed.length()+i+1,snapshot.media.size());
            }
            JSONObject commit=message(in);if(!"commit".equals(commit.optString("type"))||!hash.equals(commit.optString("hash"))||!jobId.equals(commit.optString("id")))throw new IOException("Neplatné dokončení revize");
            working(out,()->store.apply(snapshot,peer));LocalDatabase.readForCas(store.context);PeerWire.write(out,receipt(jobId,hash,size),PeerWire.MAX_HELLO);
        }
    }
    private static JSONObject receipt(String id,String hash,long size)throws Exception{return new JSONObject().put("type","ack").put("committed",true).put("id",id).put("hash",hash).put("size",size);}
    private static void ack(JSONObject ack,String id,String hash,long size)throws Exception{if(!"ack".equals(ack.optString("type"))||!Boolean.TRUE.equals(ack.opt("committed"))||!id.equals(ack.optString("id"))||!hash.equals(ack.optString("hash"))||PeerSnapshot.integer(ack,"size",PeerSnapshot.MAX_MEDIA)!=size)throw new IOException("Zápis protistrany nebyl bezpečně potvrzen");}
}
