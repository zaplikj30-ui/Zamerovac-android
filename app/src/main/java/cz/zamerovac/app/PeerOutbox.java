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
    private PeerSnapshot cached;private long cachedGeneration=-1;private String cachedContent="";
    private String destinationKind="tls",destinationScope="paired-tls-v2";
    void destination(String kind,String scope){destinationKind=kind;destinationScope=scope;}
    private String target(SyncLedger ledger,String peer)throws Exception{
        JSONObject identity=peers.snapshot().getJSONObject(peer);
        return ledger.target(destinationKind,destinationScope+"/"+identity.getString("fingerprint")+"/"+identity.optString("pairedAt","")+"/"+identity.optString("recovery",""),peer);
    }
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
        if(bytes.length!=job.getLong("size")||!hash.equals(PeerWire.hash(bytes)))throw new IOException("Kontrola čekající revize selhala");
        PeerSnapshot snapshot=PeerSnapshot.parse(bytes,DeviceIdentity.get(context.getNoBackupFilesDir()));
        // An immutable pre-recovery outbox is evidence, not permission to
        // resend/acknowledge it after a local recovery. Keep the bytes intact
        // until a future explicit reconciliation has decided what to do.
        String epoch=DatabaseRecovery.id(context.getFilesDir());
        if(!epoch.equals(snapshot.wire.optString("recoveryEpoch","")))
            throw new IOException("Čekající přenos patří staré databázové epoše; vyžaduje ruční prověření");
        return snapshot;
    }
    private interface Mutation {boolean apply(JSONObject queue)throws Exception;}
    private void mutate(Mutation mutation)throws Exception{for(int attempt=0;attempt<8;attempt++){JSONObject current=new JSONObject(queue.read());long revision=current.getLong("revision");if(!mutation.apply(current))return;current.put("revision",revision+1);if(queue.save(revision,current.toString()))return;}throw new IOException("Fronta se souběžně změnila, přenos zůstává čekající");}
    private String contentStamp()throws IOException{
        StringBuilder stamp=new StringBuilder();
        for(String name:new String[]{"media","protected-revisions","pending-audio-v1"}){
            File directory=new File(context.getFilesDir(),name);File[] files=directory.listFiles();
            if(files==null){if(directory.exists())throw new IOException("Obsah přenosu nelze načíst");continue;}
            Arrays.sort(files,Comparator.comparing(File::getName));
            for(File file:files)stamp.append(name).append('/').append(file.getName()).append(':').append(file.length()).append(':').append(file.lastModified()).append(';');
        }
        return PeerWire.hash(stamp.toString().getBytes(StandardCharsets.UTF_8));
    }
    private PeerSnapshot current(ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        // Detect a fallback even when this outbox still holds a cached newer snapshot.
        LocalDatabase.read(context);
        long generation=LocalDatabase.generation(context.getFilesDir());String content=contentStamp();boolean fresh=cached!=null&&cachedGeneration==generation&&cachedContent.equals(content);
        if(fresh)for(Map.Entry<String,long[]> item:cached.localStats.entrySet()){File file=new File(mediaDirectory,item.getKey());if(!file.isFile()||file.length()!=item.getValue()[0]||file.lastModified()!=item.getValue()[1]){fresh=false;break;}}
        if(fresh)return cached;PeerSnapshot snapshot=PeerSnapshot.capture(context,prefs,checkpoint);cached=snapshot;cachedGeneration=generation;cachedContent=content;return snapshot;
    }
    PeerSnapshot prepare(String peer)throws Exception{return prepare(peer,false);}
    PeerSnapshot prepare(String peer,boolean forcePublication)throws Exception{return prepare(peer,forcePublication,()->{});}
    PeerSnapshot prepare(String peer,boolean forcePublication,ImmutableStore.Checkpoint checkpoint)throws Exception{synchronized(lock){checkpoint.check();return prepareLocked(peer,forcePublication,checkpoint);}}
    /** Read an immutable queued snapshot; never infer its epoch from current DB. */
    private PeerSnapshot queuedSnapshot(String source)throws Exception{
        File target=file(source);
        if(!target.isFile()||java.nio.file.Files.isSymbolicLink(target.toPath())||
            target.length()<1||target.length()>PeerWire.MAX_JSON)
            throw new IOException("Původní revizi fronty nelze ověřit");
        byte[] bytes=new AtomicFile(target).readFully();
        if(!source.equals(PeerWire.hash(bytes)))
            throw new IOException("Původní revize fronty má jiný kontrolní součet");
        return PeerSnapshot.parse(bytes,DeviceIdentity.get(context.getNoBackupFilesDir()));
    }
    /** Upgrade existing durable intents BEFORE ACK, supersession or forget can
     * drop them. A stale epoch is evidence worth retaining, never new authority.
     */
    private void protectSources(String peer,boolean dropping)throws Exception{
        ProtectedRevisions protection=new ProtectedRevisions(context,prefs);
        JSONObject state=new JSONObject(queue.read());Set<String> sources=new TreeSet<>();
        for(String section:new String[]{"jobs","recoveryQuarantine"}){
            JSONArray rows=state.optJSONArray(section);if(rows==null)continue;
            for(int i=0;i<rows.length();i++){
                JSONObject job=rows.getJSONObject(i);
                if(peer!=null&&!peer.equals(job.optString("peer")))continue;
                String source=job.optString("sourceRef","");
                if(!source.isEmpty())sources.add(source);
            }
        }
        for(String source:sources){
            if(protection.hasSnapshot(source))continue;
            try{protection.preserveSnapshot(queuedSnapshot(source));}
            catch(Exception unavailable){if(dropping)throw unavailable;}
            // prepare keeps UNKNOWN jobs and their source refs. Only a verified
            // protected source may be discarded by ACK or explicit forget.
        }
    }
    /**
     * A proved different epoch is permanently archived, preserving source
     * bytes. A temporarily unreadable source is NOT proof of an old epoch:
     * retain its original active job for a later retry/restart. Transport
     * selection and ACK independently require a verified immutable snapshot.
     */
    private enum EpochCheck { CURRENT, OLD, UNKNOWN }
    private EpochCheck stale(JSONObject job,String epoch,Map<String,EpochCheck> cache)throws Exception{
        if(epoch.isEmpty())return EpochCheck.CURRENT;
        String source=job.optString("sourceRef","");
        if(source.isEmpty())return EpochCheck.OLD;
        EpochCheck prior=cache.get(source);
        if(prior!=null)return prior;
        EpochCheck result;
        try{
            PeerSnapshot stored=queuedSnapshot(source);
            result=epoch.equals(stored.wire.optString("recoveryEpoch",""))
                ?EpochCheck.CURRENT:EpochCheck.OLD;
        }catch(Exception unavailable){
            // No irreversible quarantine decision on an unproved epoch.
            // messages()/load()/verifyAckJob() independently fail closed.
            result=EpochCheck.UNKNOWN;
        }
        cache.put(source,result);
        return result;
    }
    private PeerSnapshot prepareLocked(String peer,boolean forcePublication,ImmutableStore.Checkpoint checkpoint)throws Exception{
        if(!DeviceIdentity.valid(peer)||!peers.snapshot().has(peer))
            throw new IOException("Zařízení není spárované");
        PeerSnapshot primary=current(checkpoint);checkpoint.check();prepareSnapshot(peer,forcePublication,checkpoint,primary);
        try{
            PeerSnapshot recovery=PeerSnapshot.captureRecovery(context,prefs,checkpoint);
            if(recovery!=null)prepareSnapshot(peer,false,checkpoint,recovery);
            try(SyncLedger ledger=SyncLedger.open(context.getNoBackupFilesDir())){ledger.contentInventory(target(ledger,peer),recovery==null?"none":"complete");}
        }catch(CloudScan.Deferred|java.io.InterruptedIOException deferred){throw deferred;}
        catch(Exception incomplete){try(SyncLedger ledger=SyncLedger.open(context.getNoBackupFilesDir())){ledger.contentInventory(target(ledger,peer),"error");}}
        return primary;
    }
    boolean contentProblem(String peer)throws Exception{try(SyncLedger ledger=SyncLedger.open(context.getNoBackupFilesDir())){return ledger.contentProblem(target(ledger,peer));}}
    private PeerSnapshot prepareSnapshot(String peer,boolean forcePublication,ImmutableStore.Checkpoint checkpoint,PeerSnapshot snapshot)throws Exception{

        synchronized(TrashPurger.LOCK){
            LocalDatabase.readForCas(context);
            protectSources(null,false);
            String epoch=DatabaseRecovery.id(context.getFilesDir());
            if(!epoch.equals(snapshot.wire.optString("recoveryEpoch","")))
                throw new IOException("Období databáze se během přípravy přenosu změnilo");
            boolean acknowledgedDestination;
            try(SyncLedger ledger=SyncLedger.open(context.getNoBackupFilesDir())){
                String destination=target(ledger,peer);ledger.prepare(destination,snapshot);
                acknowledgedDestination=!forcePublication&&"transport-ack".equals(ledger.state(destination,snapshot.hash));
                if(!"tls".equals(destinationKind)&&!peers.cloudAckAllowed(peer))acknowledgedDestination=false;
            }
            final boolean alreadyAcked=acknowledgedDestination;
            // Independent of jobs, peer identity, ACKs and recovery authority.
            new ProtectedRevisions(context,prefs).preserveSnapshot(snapshot);
            if(!alreadyAcked)persist(snapshot);
            mutate(state->{
                JSONArray jobs=state.getJSONArray("jobs"),active=new JSONArray();
                JSONArray quarantine=state.optJSONArray("recoveryQuarantine");
                if(quarantine==null)quarantine=new JSONArray();
                Map<String,EpochCheck> cache=new HashMap<>();
                Set<String> obsolete=new HashSet<>(),ids=new HashSet<>();
                boolean changed=false;
                for(int i=0;i<jobs.length();i++){
                    JSONObject job=jobs.getJSONObject(i);
                    if(stale(job,epoch,cache)==EpochCheck.OLD){
                        quarantine.put(new JSONObject(job.toString()).put("quarantinedAtEpoch",epoch));
                        changed=true;
                    }else active.put(job);
                }
                // Normal supersession remains restricted to current-epoch active jobs.
                if(!alreadyAcked)for(int i=0;i<active.length();i++){
                    JSONObject job=active.getJSONObject(i);
                    if(peer.equals(job.getString("peer"))&&"metadata".equals(job.getString("kind"))&&
                        !snapshot.hash.equals(job.getString("hash"))){
                        try{if(supersedes(snapshot,load(job))&&
                            new ProtectedRevisions(context,prefs).hasSnapshot(job.getString("sourceRef")))
                            obsolete.add(job.getString("hash"));}
                        catch(IOException unreadable){/* keep questionable evidence, never delete */}
                    }
                }
                JSONArray next=new JSONArray();
                for(int i=0;i<active.length();i++){
                    JSONObject job=active.getJSONObject(i);
                    if(obsolete.contains(job.optString("sourceRef",""))){
                        changed=true;
                        continue;
                    }
                    next.put(job);ids.add(job.getString("id"));
                }
                if(!alreadyAcked){
                    JSONObject metadata=job(peer,"metadata",snapshot.hash,snapshot.bytes.length,snapshot.hash,null);
                    if(ids.add(metadata.getString("id"))){next.put(metadata);changed=true;}
                    for(JSONObject media:snapshot.media.values()){
                        String id=media.getString("id");
                        JSONObject blob=job(peer,"blob",media.getString("hash"),media.getLong("size"),snapshot.hash,id);
                        if(ids.add(blob.getString("id"))){next.put(blob);changed=true;}
                    }
                }
                if(!changed)return false;
                state.put("jobs",next).put("recoveryQuarantine",quarantine);
                return true;
            });
            cleanup(); // retains every quarantined source
        }
        return snapshot;
    }
    private static boolean supersedes(PeerSnapshot next,PeerSnapshot old)throws Exception{
        if(next.wire.optBoolean("recoveryOnly")!=old.wire.optBoolean("recoveryOnly"))return false;
        if(!old.wire.optBoolean("recoveryOnly"))return dominates(next.data,old.data);
        Set<String> retained=new HashSet<>();JSONArray revisions=next.wire.optJSONArray("recovery");
        if(revisions!=null)for(int i=0;i<revisions.length();i++)retained.add(revisions.getJSONObject(i).getString("hash"));
        revisions=old.wire.optJSONArray("recovery");if(revisions!=null)for(int i=0;i<revisions.length();i++)if(!retained.contains(revisions.getJSONObject(i).getString("hash")))return false;
        return next.media.keySet().containsAll(old.media.keySet());
    }
    private static JSONObject job(String peer,String kind,String hash,long size,String source,String media)throws Exception{
        return new JSONObject().put("id",jobId(peer,kind,hash,source,media)).put("peer",peer).put("kind",kind).put("hash",hash).put("size",size).put("sourceRef",source).put("payload",media==null?JSONObject.NULL:new JSONObject().put("mediaId",media)).put("attempts",0).put("nextAttempt",0);
    }
    List<JSONObject> messages(String peer)throws Exception{
        synchronized(lock){synchronized(TrashPurger.LOCK){
            // An UNKNOWN job remains durable, but neither TLS nor cloud may
            // send it until its immutable source AND recovery epoch verify.
            // Recheck the DB witness before exposing even a cached job.
            LocalDatabase.readForCas(context);
            String epoch=DatabaseRecovery.id(context.getFilesDir());
            ArrayList<JSONObject> result=new ArrayList<>();
            JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");
            for(int i=0;i<jobs.length()&&result.size()<16;i++){
                JSONObject job=jobs.getJSONObject(i);
                if(!peer.equals(job.getString("peer"))||
                    !"metadata".equals(job.getString("kind")))continue;
                try{
                    verifyAckJob(job,epoch);
                    result.add(new JSONObject(job.toString()));
                }catch(Exception unverifiable){
                    // Still queued, never ACKed or deleted. Other valid jobs
                    // remain eligible; a later call can retry this source.
                }
            }
            return result;
        }}
    }
    int pending(String peer)throws Exception{
        int count=0;
        JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");
        for(int i=0;i<jobs.length();i++)
            if(peer.equals(jobs.getJSONObject(i).getString("peer")))count++;
        return count;
    }
    int pendingProjects(String peer)throws Exception{
        int count=0;JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");
        for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(!peer.equals(job.optString("peer"))||!"metadata".equals(job.optString("kind")))continue;
            try{if(!queuedSnapshot(job.getString("sourceRef")).wire.optBoolean("recoveryOnly"))count++;}catch(Exception unknown){count++;}
        }return count;
    }
    int quarantinedCount(String peer)throws Exception{
        JSONArray rows=new JSONObject(queue.read()).optJSONArray("recoveryQuarantine");
        if(rows==null)return 0;
        int count=0;
        for(int i=0;i<rows.length();i++)
            if(peer.equals(rows.getJSONObject(i).getString("peer")))count++;
        return count;
    }
    private void verifyAckJob(JSONObject job,String epoch)throws Exception{
        String source=job.optString("sourceRef","");
        if(source.isEmpty())throw new IOException("Potvrzení nemá ověřitelný původní snímek");
        PeerSnapshot snapshot=queuedSnapshot(source);
        if(!epoch.equals(snapshot.wire.optString("recoveryEpoch","")))
            throw new IOException("Opožděné potvrzení patří jiné epoše databáze");
        if("metadata".equals(job.getString("kind"))){
            if(!source.equals(job.getString("hash"))||snapshot.bytes.length!=job.getLong("size"))
                throw new IOException("Potvrzení nesouhlasí s metadaty revize");
        }else if("blob".equals(job.getString("kind"))){
            JSONObject payload=job.getJSONObject("payload");
            JSONObject media=snapshot.media.get(payload.getString("mediaId"));
            if(media==null||!job.getString("hash").equals(media.getString("hash"))||
                job.getLong("size")!=media.getLong("size"))
                throw new IOException("Potvrzení přílohy neodpovídá původní revizi");
        }else throw new IOException("Neznámý typ potvrzení");
    }
    /**
     * Every peer ACK, including a per-blob ACK, must prove the concrete
     * queued job belongs to the current durable recovery epoch.
     * Returns false for an already absent job; never deletes quarantine.
     */
    boolean acknowledge(String id,String hash,long size,boolean metadata)throws Exception{
        synchronized(lock){synchronized(TrashPurger.LOCK){
            LocalDatabase.readForCas(context);
            String epoch=DatabaseRecovery.id(context.getFilesDir());
            final boolean[] accepted={false};
            mutate(state->{
                JSONArray jobs=state.getJSONArray("jobs"),next=new JSONArray();
                JSONObject match=null;
                for(int i=0;i<jobs.length();i++){
                    JSONObject item=jobs.getJSONObject(i);
                    if(id.equals(item.getString("id"))){match=item;break;}
                }
                if(match==null){accepted[0]=false;return false;}
                if(!hash.equals(match.getString("hash"))||size!=match.getLong("size")||
                    metadata!=("metadata".equals(match.getString("kind"))))
                    throw new IOException("ACK neodpovídá položce fronty");
                verifyAckJob(match,epoch); // no queue changes on stale/unknown ACK
                protectSources(match.getString("peer"),true);
                accepted[0]=true;
                String peer=match.getString("peer"),source=match.optString("sourceRef","");
                for(int i=0;i<jobs.length();i++){
                    JSONObject item=jobs.getJSONObject(i);
                    if(id.equals(item.getString("id"))||
                        metadata&&peer.equals(item.getString("peer"))&&
                        source.equals(item.optString("sourceRef","")))
                        continue;
                    next.put(item);
                }
                state.put("jobs",next);
                return true;
            });
            return accepted[0];
        }}
    }
    void discard(String peer)throws Exception{
        synchronized(lock){synchronized(TrashPurger.LOCK){
            protectSources(peer,true);
            mutate(state->{
                JSONArray jobs=state.getJSONArray("jobs"),keep=new JSONArray();
                for(int i=0;i<jobs.length();i++)
                    if(!peer.equals(jobs.getJSONObject(i).getString("peer")))keep.put(jobs.getJSONObject(i));
                state.put("jobs",keep);
                return true;
            });
            cleanup();
        }}
    }
    void completed(String peer,JSONObject metadata)throws Exception{
        synchronized(lock){synchronized(TrashPurger.LOCK){
            LocalDatabase.readForCas(context);
            String id=metadata.getString("id"),hash=metadata.getString("hash");
            long size=metadata.getLong("size");
            JSONArray jobs=new JSONObject(queue.read()).getJSONArray("jobs");
            JSONObject matched=null;
            for(int i=0;i<jobs.length();i++){
                JSONObject job=jobs.getJSONObject(i);
                if(id.equals(job.getString("id"))){matched=job;break;}
            }
            if(matched==null||!"metadata".equals(matched.getString("kind"))||
                !peer.equals(matched.getString("peer"))||
                !hash.equals(matched.getString("hash"))||size!=matched.getLong("size"))
                throw new IOException("Opožděné nebo cizí ACK nemá platnou položku fronty");
            verifyAckJob(matched,DatabaseRecovery.id(context.getFilesDir()));
            if(!acknowledge(id,hash,size,true))
                throw new IOException("Potvrzovaná položka již není v aktivní frontě");
            if(!load(matched).wire.optBoolean("recoveryOnly"))peers.acknowledged(peer,hash);
            try(SyncLedger ledger=SyncLedger.open(context.getNoBackupFilesDir())){
                // ACK is a transport receipt for this exact destination/epoch, never a backup.
                ledger.state(target(ledger,peer),hash,"transport-ack",id);
            }
            cleanup();
        }}
    }
    private void cleanup()throws Exception{
        Set<String> keep=new HashSet<>();
        JSONObject state=new JSONObject(queue.read());
        for(String section:new String[]{"jobs","recoveryQuarantine"}){
            JSONArray rows=state.optJSONArray(section);
            if(rows==null)continue;
            for(int i=0;i<rows.length();i++){
                String ref=rows.getJSONObject(i).optString("sourceRef","");
                if(!ref.isEmpty())keep.add(ref);
            }
        }
        File[] files=directory.listFiles();
        if(files==null){
            if(directory.exists())throw new IOException("Původní soubory fronty nelze prověřit");
            return;
        }
        for(File file:files)
            if(file.isFile()&&file.getName().matches("[a-f0-9]{64}\\.json")&&
                !keep.contains(file.getName().substring(0,64))){
                String source=file.getName().substring(0,64);
                try{
                    ProtectedRevisions protection=new ProtectedRevisions(context,prefs);
                    if(!protection.hasSnapshot(source))protection.preserveSnapshot(queuedSnapshot(source));
                    file.delete(); // Only the redundant transport copy; hold and original pins remain.
                }catch(Exception uncertain){/* retain unverified/orphan evidence across restart */}
            }
    }
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
