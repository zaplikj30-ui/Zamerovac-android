package cz.zamerovac.app;

import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.*;

/**
 * Stage 3A ONLY: independently recheck candidate source bytes and, optionally,
 * an already existing protection archive. This does not create an archive,
 * install a database, recover media, acknowledge a peer, or approve promotion.
 * The scan is non-atomic. A later Stage 3B MUST independently repeat all checks
 * and obtain explicit user consent before any transactional installation.
 */
final class RecoveryCandidateReview {
    interface Checkpoint {void afterInventory()throws Exception;}
    private static final String FORMAT="cz.zamerovac.recovery.candidate-review";
    private static final String PRIMARY="files/projects.json";
    private static final long MAX_DB=LocalDatabase.MAX_BYTES;
    private static final long MAX_MEDIA=PeerSnapshot.MAX_MEDIA;
    private RecoveryCandidateReview(){}

    static JSONObject inspect(File home,File noBackup,String archivedId)throws Exception{
        return inspect(home,noBackup,archivedId,()->{});
    }
    static JSONObject inspect(File home,File noBackup,String archivedId,
                              Checkpoint checkpoint)throws Exception{
        if(home==null||noBackup==null||checkpoint==null)
            throw new IOException("Chybí adresáře zdrojů nebo diagnostika");
        // These APIs READ ONLY. In particular, do not call LocalDatabase.readForCas,
        // RecoveryProtectionArchive.create, DatabaseRecovery.healthy or any sync API.
        JSONObject first=RecoveryInventory.inspect(home,noBackup);
        checkpoint.afterInventory();

        JSONObject archive=new JSONObject().put("status","NOT_SELECTED").put("canPromote",false);
        JSONObject verified=null;
        if(archivedId!=null){
            try{
                verified=RecoveryProtectionArchive.verify(noBackup,archivedId);
                archive.put("status","VERIFIED_READ_ONLY")
                    .put("id",verified.getString("id"))
                    .put("sourceComplete",verified.getBoolean("sourceComplete"));
            }catch(InterruptedIOException interrupted){throw interrupted;}
            catch(Exception invalid){archive.put("status","BLOCKED")
                .put("reason","ARCHIVE_NOT_VERIFIED");}
        }
        // Repeat the whole inventory AFTER any optional (possibly expensive)
        // archive verification, so changes during either scan are fail-closed.
        JSONObject second=RecoveryInventory.inspect(home,noBackup);
        boolean stable=fingerprints(first).equals(fingerprints(second));
        boolean evidenceValid=true;
        try{DatabaseInstallEvidence.verify(home,noBackup);}
        catch(IOException unverifiable){evidenceValid=false;}
        for(String section:new String[]{"candidates","evidence","media"}){
            JSONArray entries=second.getJSONArray(section);
            for(int i=0;i<entries.length();i++){
                JSONObject entry=entries.getJSONObject(i);
                String state=entry.getString("state");
                boolean dangerous="CHANGED".equals(state)||"UNREADABLE".equals(state)||
                    "UNSAFE".equals(state)||"UNSAFE_NAME".equals(state)||
                    "TOO_LARGE".equals(state);
                if(("evidence".equals(section)||"media".equals(section))&&
                    (dangerous||"CORRUPT".equals(state)||"MISSING_OR_UNSAFE".equals(state)))
                    evidenceValid=false;
                if("candidates".equals(section)&&dangerous)evidenceValid=false;
            }
        }
        // AtomicFile.readFully/openRead can rename .bak and delete .new.
        // Never call DatabaseRecovery.pending()/id() from this read-only path.
        boolean recovering=false;
        String recoveryEpoch="",journalStatus="UNKNOWN";
        JSONArray journalEvidence=second.getJSONArray("evidence");
        JSONObject journal=find(journalEvidence,"files/projects.recovery-v1.json");
        JSONObject legacy=find(journalEvidence,"files/projects.recovery-v1.json.bak");
        JSONObject unfinished=find(journalEvidence,"files/projects.recovery-v1.json.new");
        if(journal==null||legacy==null||unfinished==null||
                !"MISSING".equals(legacy.optString("state"))||
                !"MISSING".equals(unfinished.optString("state"))){
            evidenceValid=false;
        }else if("MISSING".equals(journal.optString("state"))){
            journalStatus="ABSENT";
        }else if("PRESENT".equals(journal.optString("state"))&&
                journal.optBoolean("complete")){
            try{
                JSONObject state=readVerifiedJournal(new File(home,"projects.recovery-v1.json"),journal);
                recovering=state.getBoolean("recovering");
                recoveryEpoch=state.getString("epoch");
                journalStatus="VERIFIED_READ_ONLY";
            }catch(InterruptedIOException interrupted){throw interrupted;}
            catch(Exception uncertain){evidenceValid=false;}
        }else{
            evidenceValid=false;
        }

        JSONArray listed=second.getJSONArray("candidates");
        JSONObject live=find(listed,PRIMARY);
        boolean liveValid=live!=null&&"VALID".equals(live.optString("state"))&&
            live.optBoolean("complete")&&!live.optBoolean("referencesUnverifiable");
        JSONObject liveData=null;
        if(liveValid){
            try{liveData=readVerifiedDb(new File(home,"projects.json"),live);}
            catch(Exception changed){liveValid=false;}
        }
        JSONArray out=new JSONArray();
        Map<String,JSONObject> media=rows(second.getJSONArray("media"));
        Map<String,JSONObject> archived=verified==null?Collections.emptyMap():
            rows(verified.getJSONArray("files"));
        for(int i=0;i<listed.length();i++){
            JSONObject source=listed.getJSONObject(i);
            String path=source.getString("path"),state=source.getString("state");
            JSONObject item=new JSONObject().put("path",path)
                .put("sourceState",state).put("safeToPromote",false)
                .put("decision","BLOCKED").put("reason","NOT_VERIFIED");
            for(String field:new String[]{"size","sha256","records","deletedRecords",
                    "embeddedHistoryRecords","purgedRecordIds","syncTombstones",
                    "missingMedia","unavailableMedia","unconfirmed"})
                if(source.has(field))item.put(field,source.get(field));
            if("MISSING".equals(state)){
                item.put("decision","ABSENT").put("reason","NO_SOURCE");
            }else if(!stable){
                item.put("reason","SOURCE_CHANGED_DURING_SCAN");
            }else if(!evidenceValid){
                item.put("reason","INSTALL_OR_RECOVERY_EVIDENCE_UNVERIFIABLE");
            }else if(source.optBoolean("unconfirmed")){
                item.put("reason","UNCONFIRMED_TEMPORARY_SOURCE");
            }else if(!"VALID".equals(state)||!source.optBoolean("complete")||
                    source.optBoolean("referencesUnverifiable")){
                item.put("reason","INVALID_OR_INCOMPLETE_SOURCE");
            }else if(!PRIMARY.equals(path)&&!liveValid){
                item.put("reason","PRIMARY_AUTHORITY_UNKNOWN");
            }else if(!PRIMARY.equals(path)&&
                    !source.optString("sha256").equals(live.optString("sha256"))){
                item.put("reason","DIFFERS_FROM_LIVE_DATABASE");
            }else if(archivedId!=null&&(verified==null||
                    !verified.optBoolean("sourceComplete"))){
                item.put("reason","ARCHIVE_INCOMPLETE_OR_UNVERIFIED");
            }else{
                try{
                    JSONObject data=readVerifiedDb(file(home,path),source);
                    if(PRIMARY.equals(path)&&!liveValid)
                        throw new IOException("Aktuální databáze se změnila");
                    if(PRIMARY.equals(path)&&tombstonesLost(data,liveBackup(home,listed)))
                        throw new IOException("Chybí tombstones nebo koš z existující zálohy");
                    Set<String> refs=PeerSnapshot.references(data.getJSONArray("records"));
                    for(String id:refs){
                        JSONObject medium=media.get("files/media/"+id);
                        if(medium==null||!"PRESENT".equals(medium.optString("state"))||
                           !matches(new File(home,"media/"+id),medium,MAX_MEDIA))
                            throw new IOException("Chybí nebo se změnilo médium");
                        if(archivedId!=null&&!archivedMatches(archived,medium))
                            throw new IOException("Archiv neobsahuje přesné původní médium");
                    }
                    if(archivedId!=null&&!archivedMatches(archived,source))
                        throw new IOException("Archiv neobsahuje přesný kandidátní JSON");
                    item.put("decision","CHECKED_READ_ONLY").put("reason","BYTE_EXACT_CHECKED");
                    item.put("referencedMedia",refs.size());
                }catch(InterruptedIOException interrupted){throw interrupted;}
                catch(Exception blocked){item.put("reason","BYTES_MEDIA_HISTORY_OR_TOMBSTONES_UNVERIFIABLE");}
            }
            out.put(item);
        }
        // A final scan detects a source mutation introduced while hashing the
        // candidate/media above. Still never claim an atomic filesystem snapshot.
        JSONObject finalScan=RecoveryInventory.inspect(home,noBackup);
        if(!fingerprints(second).equals(fingerprints(finalScan))){
            for(int i=0;i<out.length();i++){
                JSONObject item=out.getJSONObject(i);
                if(!"ABSENT".equals(item.optString("decision")))
                    item.put("decision","BLOCKED").put("reason","SOURCE_CHANGED_DURING_RECHECK");
            }
            stable=false;
        }
        return new JSONObject().put("format",FORMAT).put("version",1)
            .put("readOnly",true).put("safeToPromote",false)
            .put("coherentSnapshot",false)
            .put("sourceStableAcrossChecks",stable)
            .put("installationEvidenceVerified",evidenceValid)
            .put("recoveryPending",recovering).put("recoveryEpoch",recoveryEpoch)
            .put("recoveryJournalStatus",journalStatus)
            .put("undoRedo","IN_MEMORY_NOT_RECOVERABLE_FROM_FILES")
            .put("archive",archive).put("candidates",out)
            .put("note","Kontrola není svolením k obnově, zapisování ani ACK");
    }

    private static File file(File home,String path)throws IOException{
        if(!path.startsWith("files/")||path.contains("..")||path.indexOf('\\')>=0)
            throw new IOException("Neplatná cesta kandidáta");
        return new File(home,path.substring("files/".length()));
    }
    private static JSONObject find(JSONArray rows,String path)throws JSONException{
        for(int i=0;i<rows.length();i++){
            JSONObject item=rows.getJSONObject(i);
            if(path.equals(item.optString("path")))return item;
        }
        return null;
    }
    private static Map<String,JSONObject> rows(JSONArray rows)throws JSONException{
        Map<String,JSONObject> found=new TreeMap<>();
        for(int i=0;i<rows.length();i++){
            JSONObject item=rows.getJSONObject(i);found.put(item.getString("path"),item);
        }
        return found;
    }
    private static SortedMap<String,String> fingerprints(JSONObject inventory)throws Exception{
        SortedMap<String,String> result=new TreeMap<>();
        for(String section:new String[]{"candidates","evidence","media"}){
            JSONArray entries=inventory.getJSONArray(section);
            for(int i=0;i<entries.length();i++){
                JSONObject row=entries.getJSONObject(i);
                String path=row.getString("path");
                String value=row.optString("state")+"|"+row.optString("sha256")+
                    "|"+row.optString("size")+"|"+row.optString("missingMedia")+
                    "|"+row.optString("unavailableMedia")+"|"+row.optString("unconfirmed");
                if(result.put(section+":"+path,value)!=null)
                    throw new IOException("Duplicitní diagnostický zdroj");
            }
        }
        return result;
    }
    private static boolean archivedMatches(Map<String,JSONObject> archived,JSONObject source)
            throws JSONException{
        JSONObject row=archived.get(source.getString("path"));
        return row!=null&&source.getString("sha256").equals(row.optString("sha256"))&&
            source.getLong("size")==row.optLong("size",-1);
    }
    private static JSONObject readVerifiedDb(File path,JSONObject source)throws Exception{
        if(!matches(path,source,MAX_DB))throw new IOException("Kandidátní JSON změněn");
        // Never follow a replacement symlink between the two source checks.
        // Bound the second read too: this is inspection of untrusted damaged DB.
        byte[] bytes;
        try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS);
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[65536];int n;long total=0;
            while((n=in.read(buffer))!=-1){
                if(Thread.currentThread().isInterrupted())
                    throw new InterruptedIOException("Kontrola přerušena");
                if(n==0||total>MAX_DB-n)
                    throw new IOException("Kandidátní JSON překročil limit");
                total+=n;out.write(buffer,0,n);
            }
            bytes=out.toByteArray();
        }
        if(bytes.length!=source.getLong("size")||
           !PeerWire.hash(bytes).equals(source.getString("sha256"))||
           !matches(path,source,MAX_DB))
            throw new IOException("Nestabilní kandidátní JSON");
        String decoded=JsonInput.decode(bytes);
        LocalDatabase.validate(decoded);
        return new JSONObject(decoded);
    }
    /** Read-only journal inspection: never use AtomicFile or repair the evidence. */
    private static JSONObject readVerifiedJournal(File path,JSONObject evidence)throws Exception{
        final long max=4096;
        if(!matches(path,evidence,max))throw new IOException("Evidence obnovy se změnila");
        byte[] bytes;
        try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS);
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[1024];int n;long total=0;
            while((n=in.read(buffer))!=-1){
                if(Thread.currentThread().isInterrupted())
                    throw new InterruptedIOException("Kontrola evidence obnovy přerušena");
                if(n==0||total>max-n)
                    throw new IOException("Evidence obnovy překročila limit");
                out.write(buffer,0,n);total+=n;
            }
            bytes=out.toByteArray();
        }
        if(bytes.length!=evidence.getLong("size")||
           !PeerWire.hash(bytes).equals(evidence.getString("sha256"))||
           !matches(path,evidence,max))
            throw new IOException("Evidence obnovy není stabilní");
        JSONObject state=JsonInput.object(bytes);
        Object epoch=state.get("epoch");
        if(state.optInt("version")!=1||!(epoch instanceof String)||
           (!((String)epoch).isEmpty()&&!DeviceIdentity.valid((String)epoch))||
           !(state.get("recovering") instanceof Boolean)||
           !epoch.equals(evidence.optString("epoch"))||
           state.getBoolean("recovering")!=evidence.getBoolean("recovering"))
            throw new IOException("Neověřená evidence obnovy");
        return state;
    }
    private static JSONObject liveBackup(File home,JSONArray listed)throws Exception{
        JSONObject backup=find(listed,"files/projects.bak");
        if(backup==null||!"VALID".equals(backup.optString("state")))return null;
        return readVerifiedDb(new File(home,"projects.bak"),backup);
    }
    private static boolean tombstonesLost(JSONObject current,JSONObject older)throws Exception{
        if(older==null)return false;
        JSONObject olderTombs=older.optJSONObject("syncTombstones");
        JSONObject currentTombs=current.optJSONObject("syncTombstones");
        if(olderTombs!=null)
            for(Iterator<String> it=olderTombs.keys();it.hasNext();){
                String id=it.next();
                if(currentTombs==null||!currentTombs.has(id))return true;
                // Only equal or causally newer clocks demonstrate preserved
                // deletion semantics. Concurrent/older values are unverified.
                String order=CausalClock.compare(currentTombs.getJSONObject(id),
                    olderTombs.getJSONObject(id));
                if(!"equal".equals(order)&&!"after".equals(order))return true;
            }
        JSONArray purged=older.optJSONArray("trashPurgedIds"),now=current.optJSONArray("trashPurgedIds");
        if(purged!=null)for(int i=0;i<purged.length();i++){
            String id=purged.optString(i);boolean found=false;
            if(now!=null)for(int j=0;j<now.length();j++)if(id.equals(now.optString(j)))found=true;
            if(!found)return true;
        }
        return false;
    }
    private static boolean matches(File path,JSONObject source,long max)throws Exception{
        BasicFileAttributes before;
        try{before=Files.readAttributes(path.toPath(),BasicFileAttributes.class,
            LinkOption.NOFOLLOW_LINKS);}
        catch(NoSuchFileException missing){return false;}
        if(!before.isRegularFile()||before.isSymbolicLink()||before.size()<=0||
           before.size()>max||before.size()!=source.getLong("size"))return false;
        MessageDigest md=ArchiveIntegrity.digest();
        long length=0;
        try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS)){
            byte[] data=new byte[65536];int n;
            while((n=in.read(data))!=-1){
                if(Thread.currentThread().isInterrupted())
                    throw new InterruptedIOException("Kontrola obnovy přerušena");
                if(n==0||length>max-n)return false;
                md.update(data,0,n);length+=n;
            }
        }
        BasicFileAttributes after=Files.readAttributes(path.toPath(),
            BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        return after.isRegularFile()&&!after.isSymbolicLink()&&
            before.size()==length&&after.size()==length&&
            before.lastModifiedTime().equals(after.lastModifiedTime())&&
            Objects.equals(before.fileKey(),after.fileKey())&&
            source.getString("sha256").equals(ArchiveIntegrity.hex(md.digest()));
    }
}
