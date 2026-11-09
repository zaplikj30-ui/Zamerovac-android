package cz.zamerovac.app;
import android.content.*;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Prepared immutable messages and per-file acknowledgements survive process death. No backup namespace access. */
final class PeerOutbox {
    private static final java.util.concurrent.ConcurrentHashMap<String,Object> LOCKS=new java.util.concurrent.ConcurrentHashMap<>();
    private final Object lock;
    final Context context;final SharedPreferences prefs;final File mediaDirectory;
    final SyncQueueStore queue;final SyncPeerRegistry peers;private final File directory;
    private PeerSnapshot cached;private long cachedGeneration=-1;
    PeerOutbox(Context context,SharedPreferences prefs,SyncPeerRegistry peers){this.context=context;this.prefs=prefs;this.peers=peers;mediaDirectory=new File(context.getFilesDir(),"media");directory=new File(context.getNoBackupFilesDir(),"sync-v2-outbox");queue=new SyncQueueStore(context.getNoBackupFilesDir());lock=LOCKS.computeIfAbsent(directory.getAbsolutePath(),key->new Object());}
    static String jobId(String peer,String kind,String hash,String sourceRef,String mediaId)throws Exception{
        return PeerWire.hash(CausalClock.canonical(new JSONObject().put("format","cz.zamerovac.sync.job").put("version",2).put("peer",peer).put("kind",kind).put("hash",hash).put("sourceRef",sourceRef==null?JSONObject.NULL:sourceRef).put("mediaId",mediaId==null?JSONObject.NULL:mediaId)).getBytes(StandardCharsets.UTF_8));
    }
    private File file(String hash)throws IOException{if(hash==null||!hash.matches("[0-9a-f]{64}"))throw new IOException("Neplatná revize fronty");return new File(directory,hash+".json");}
    private void persist(PeerSnapshot snapshot)throws Exception{
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Nelze připravit frontu přenosu");File target=file(snapshot.hash);
        if(target.isFile()&&target.length()<=PeerWire.MAX_JSON&&snapshot.hash.equals(PeerWire.hash(java.nio.file.Files.readAllBytes(target.toPath()))))return;
        AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;try{out=atomic.startWrite();out.write(snapshot.bytes);out.getFD().sync();atomic.finishWrite(out);out=null;if(!snapshot.hash.equals(PeerWire.hash(atomic.readFully())))throw new IOException("Revize fronty nebyla potvrzena");}catch(Exception failure){if(out!=null)atomic.failWrite(out);throw failure;}
    }
    PeerSnapshot load(JSONObject job)throws Exception{
        String hash=job.getString("hash"),source=job.optString("sourceRef","");byte[] bytes;
        if(!source.isEmpty()){
            File target=file(source);if(!target.isFile()||target.length()>PeerWire.MAX_JSON)throw new IOException("Čekající revize není dostupná");bytes=new AtomicFile(target).readFully();
        }else if(job.optJSONObject("payload")!=null)bytes=CausalClock.canonical(job.getJSONObject("payload")).getBytes(StandardCharsets.UTF_8);
        else throw new IOException("Čekající revize je neúplná");
        if(bytes.length!=job.getLong("size")||!hash.equals(PeerWire.hash(bytes)))throw new IOException("Kontrola čekající revize selhala");return PeerSnapshot.parse(bytes,DeviceIdentity.get(context.getNoBackupFilesDir()));
    }
    private interface Mutation {boolean apply(JSONObject queue)throws Exception;}
    private void mutate(Mutation mutation)throws Exception{for(int attempt=0;attempt<8;attempt++){JSONObject current=new JSONObject(queue.read());long revision=current.getLong("revision");if(!mutation.apply(current))return;current.put("revision",revision+1);if(queue.save(revision,current.toString()))return;}throw new IOException("Fronta se souběžně změnila, přenos zůstává čekající");}
    private PeerSnapshot current(ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        // Detect a fallback even when this outbox still holds a cached newer snapshot.
        LocalDatabase.read(context);
        long generation=LocalDatabase.generation(context.getFilesDir());boolean fresh=cached!=null&&cachedGeneration==generation;
        if(fresh)for(Map.Entry<String,long[]> item:cached.localStats.entrySet()){File file=new File(mediaDirectory,item.getKey());if(!file.isFile()||file.length()!=item.getValue()[0]||file.lastModified()!=item.getValue()[1]){fresh=false;break;}}
        if(fresh)return cached;PeerSnapshot snapshot=PeerSnapshot.capture(context,prefs,checkpoint);cached=snapshot;cachedGeneration=generation;return snapshot;
    }
    PeerSnapshot prepare(String peer)throws Exception{return prepare(peer,false);}
    PeerSnapshot prepare(String peer,boolean forcePublication)throws Exception{return prepare(peer,forcePublication,()->{});}
    PeerSnapshot prepare(String peer,boolean forcePublication,ImmutableStore.Checkpoint checkpoint)throws Exception{synchronized(lock){checkpoint.check();return prepareLocked(peer,forcePublication,checkpoint);}}
    private PeerSnapshot prepareLocked(String peer,boolean forcePublication,ImmutableStore.Checkpoint checkpoint)throws Exception{
        if(!DeviceIdentity.valid(peer)||!peers.snapshot().has(peer))throw new IOException("Zařízení není spárované");PeerSnapshot snapshot=current(checkpoint);checkpoint.check();if(!forcePublication&&snapshot.hash.equals(peers.lastAck(peer)))return snapshot;persist(snapshot);
        mutate(state->{JSONArray jobs=state.getJSONArray("jobs"),next=new JSONArray();Set<String> obsolete=new HashSet<>(),ids=new HashSet<>();
            for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(peer.equals(job.getString("peer"))&&"metadata".equals(job.getString("kind"))&&!snapshot.hash.equals(job.getString("hash")))try{if(dominates(snapshot.data,load(job).data))obsolete.add(job.getString("hash"));}catch(IOException ignored){/* Never drop an unreadable older message without proof. */}}
            for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(peer.equals(job.getString("peer"))&&obsolete.contains(job.optString("sourceRef","")))continue;next.put(job);ids.add(job.getString("id"));}
            JSONObject metadata=job(peer,"metadata",snapshot.hash,snapshot.bytes.length,snapshot.hash,null);if(ids.add(metadata.getString("id")))next.put(metadata);
            for(JSONObject media:snapshot.media.values()){String id=media.getString("id");JSONObject blob=job(peer,"blob",media.getString("hash"),media.getLong("size"),snapshot.hash,id);if(ids.add(blob.getString("id")))next.put(blob);}
            state.put("jobs",next);return true;
        });cleanup();return snapshot;
    }
    private static JSONObject job(String peer,String kind,String hash,long size,String source,String media)throws Exception{
        return new JSONObject().put("id",jobId(peer,kind,hash,source,media)).put("peer",peer).put("kind",kind).put("hash",hash).put("size",size).put("sourceRef",source).put("payload",media==null?JSONObject.NULL:new JSONObject().put("mediaId",media)).put("attempts",0).put("nextAttempt",0);
    }
    List<JSONObject> messages(String peer)throws Exception{
        ArrayList<JSONObject> result=new ArrayList<>();JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");for(int i=0;i<jobs.length()&&result.size()<16;i++){JSONObject job=jobs.getJSONObject(i);if(peer.equals(job.getString("peer"))&&"metadata".equals(job.getString("kind")))result.add(job);}return result;
    }
    int pending(String peer)throws Exception{int count=0;JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");for(int i=0;i<jobs.length();i++)if(peer.equals(jobs.getJSONObject(i).getString("peer")))count++;return count;}
    void acknowledge(String id,String hash,long size,boolean metadata)throws Exception{
        mutate(state->{JSONArray jobs=state.getJSONArray("jobs"),next=new JSONArray();String peer=null,source=null;for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(id.equals(job.getString("id"))){if(!hash.equals(job.getString("hash"))||size!=job.getLong("size"))throw new IOException("Nesprávné potvrzení přenosu");peer=job.getString("peer");source=job.optString("sourceRef","");}}
            if(peer==null)return false;for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(id.equals(job.getString("id"))||metadata&&peer.equals(job.getString("peer"))&&source.equals(job.optString("sourceRef","")))continue;next.put(job);}state.put("jobs",next);return true;});
    }
    void discard(String peer)throws Exception{synchronized(lock){mutate(state->{JSONArray jobs=state.getJSONArray("jobs"),keep=new JSONArray();for(int i=0;i<jobs.length();i++)if(!peer.equals(jobs.getJSONObject(i).getString("peer")))keep.put(jobs.getJSONObject(i));state.put("jobs",keep);return true;});cleanup();}}
    void completed(String peer,JSONObject metadata)throws Exception{synchronized(lock){
        // A remote ACK is not proof that our local source DB still exists.
        // Hold the writer lock through both the local queue and receipt commit.
        synchronized(TrashPurger.LOCK){
            LocalDatabase.readForCas(context);
            acknowledge(metadata.getString("id"),metadata.getString("hash"),metadata.getLong("size"),true);
            peers.acknowledged(peer,metadata.getString("hash"));
            cleanup();
        }
    }}
    private void cleanup()throws Exception{Set<String> keep=new HashSet<>();JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");for(int i=0;i<jobs.length();i++){String ref=jobs.getJSONObject(i).optString("sourceRef","");if(!ref.isEmpty())keep.add(ref);}File[] files=directory.listFiles();if(files!=null)for(File file:files)if(file.isFile()&&file.getName().matches("[a-f0-9]{64}\\.json")&&!keep.contains(file.getName().substring(0,64)))file.delete();}
    static boolean dominates(JSONObject newer,JSONObject older)throws Exception{
        Map<String,JSONObject> latest=new HashMap<>();JSONArray records=newer.getJSONArray("records");for(int i=0;i<records.length();i++){JSONObject record=records.getJSONObject(i);latest.put(record.getString("id"),record);}
        JSONObject tombs=newer.optJSONObject("syncTombstones");JSONArray before=older.getJSONArray("records");
        for(int i=0;i<before.length();i++){JSONObject record=before.getJSONObject(i),next=latest.get(record.getString("id"));JSONObject clock=CausalClock.clock(record);
            if(next!=null){String order=CausalClock.compare(CausalClock.clock(next),clock);if(!"after".equals(order)&&!CausalClock.canonical(next).equals(CausalClock.canonical(record)))return false;}
            else{JSONObject tomb=tombs==null?null:tombs.optJSONObject(record.getString("id"));if(tomb==null||!("after".equals(CausalClock.compare(tomb,clock))||clock.length()>0&&"equal".equals(CausalClock.compare(tomb,clock))))return false;}
        }
        JSONObject oldTombs=older.optJSONObject("syncTombstones");if(oldTombs!=null)for(Iterator<String> it=oldTombs.keys();it.hasNext();){String id=it.next();if(tombs==null||!tombs.has(id)||"before".equals(CausalClock.compare(tombs.getJSONObject(id),oldTombs.getJSONObject(id)))||"concurrent".equals(CausalClock.compare(tombs.getJSONObject(id),oldTombs.getJSONObject(id))))return false;}
        return true;
    }
}
