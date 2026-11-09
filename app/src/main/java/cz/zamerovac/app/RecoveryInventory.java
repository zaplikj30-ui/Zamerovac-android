package cz.zamerovac.app;

import android.content.Context;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.*;

/**
 * Read-only B16 discovery. Not a recovery transaction and NEVER a source of
 * authority for a DB write, ACK, media deletion or snapshot promotion.
 * Results describe separately observed files, not an atomic filesystem view.
 */
final class RecoveryInventory {
    private static final int MAX_FILES=20000;
    private static final long MAX_MEDIA=PeerSnapshot.MAX_MEDIA;
    private static final long MAX_META=LocalDatabase.MAX_BYTES;
    private static final long MAX_JOURNAL=4096;
    private static final String MARKER="zamerovac-install-state-v1.marker";
    private RecoveryInventory(){}

    static JSONObject inspect(Context context)throws Exception {
        return inspect(context.getFilesDir(),context.getNoBackupFilesDir());
    }
    static JSONObject inspect(File home,File noBackup)throws Exception {
        requireDirectory(home,true);
        if(noBackup!=null)requireDirectory(noBackup,false);
        JSONObject report=new JSONObject().put("format","cz.zamerovac.recovery.inventory")
            .put("version",1).put("readOnly",true).put("safeToPromote",false)
            .put("coherentSnapshot",false)
            .put("undoRedo","IN_MEMORY_NOT_RECOVERABLE_FROM_FILES")
            .put("externalBackupHistory","NOT_SCANNED_PROVIDER");
        JSONArray candidates=new JSONArray(),evidence=new JSONArray(),media=new JSONArray();
        SortedSet<String> referenced=new TreeSet<>();
        int records=0,deleted=0,history=0;
        for(String name:new String[]{"projects.json","projects.bak","projects.json.bak",
                "projects.tmp","projects.backup.tmp"}) {
            JSONObject entry=inspectFile(new File(home,name),"files/"+name,"database",MAX_META,true);
            entry.put("unconfirmed",name.endsWith(".tmp"));
            if("VALID".equals(entry.optString("state"))) {
                JSONObject data;
                try{data=JsonInput.object(readStable(new File(home,name),MAX_META));}
                catch(Exception changed){
                    // Discovery is informational; a racing second read cannot
                    // turn stale metadata into an authorized recovery candidate.
                    if(changed instanceof InterruptedIOException)throw changed;
                    entry.put("state","CHANGED").put("complete",false);
                    candidates.put(entry);
                    continue;
                }
                entry.put("records",data.getJSONArray("records").length());
                int trashed=0,embedded=0;
                JSONArray rows=data.getJSONArray("records");
                for(int i=0;i<rows.length();i++){
                    JSONObject row=rows.getJSONObject(i);
                    if(row.optBoolean("deleted"))trashed++;
                    if(row.has("history")||row.has("undoStack")||row.has("redoStack"))embedded++;
                }
                entry.put("deletedRecords",trashed).put("embeddedHistoryRecords",embedded);
                entry.put("purgedRecordIds",data.optJSONArray("trashPurgedIds")==null
                    ?0:data.getJSONArray("trashPurgedIds").length());
                entry.put("syncTombstones",data.optJSONObject("syncTombstones")==null
                    ?0:data.getJSONObject("syncTombstones").length());
                try {
                    Set<String> refs=PeerSnapshot.references(rows);
                    if(refs.size()>MAX_FILES)throw new IOException("Příliš mnoho odkazů na přílohy");
                    JSONArray required=new JSONArray();
                    int missing=0;
                    for(String id:new TreeSet<>(refs)){
                        required.put(id);
                        referenced.add(id);
                        if(!availableMedia(new File(home,"media"),id))missing++;
                    }
                    entry.put("mediaReferences",required).put("missingMedia",missing);
                    entry.put("complete",missing==0);
                    if(missing>0)entry.put("state","INCOMPLETE");
                }catch(Exception unknown){
                    entry.put("state","INCOMPLETE").put("complete",false)
                        .put("referencesUnverifiable",true)
                        .put("error","Odkazy příloh, historie nebo koše nejsou bezpečně ověřitelné");
                }
                if("projects.json".equals(name)){
                    records=rows.length();deleted=trashed;history=embedded;
                }
            }
            candidates.put(entry);
        }
        for(String name:new String[]{"projects.recovery-v1.json",
                "projects.recovery-v1.json.bak","projects.recovery-v1.json.new",
                "trash-cleanup.json","trash-cleanup.json.bak","trash-cleanup.json.new",
                "projects.bak.bak","projects.bak.new",
                MARKER,MARKER+".bak",MARKER+".new"}) {
            String type=name.startsWith("projects.recovery-")?"journal":
                name.startsWith("trash-cleanup")?"trashEvidence":
                name.startsWith("projects.bak.")?"databaseBackupEvidence":"installationEvidence";
            JSONObject entry=inspectFile(new File(home,name),"files/"+name,type,
                type.equals("journal")?MAX_JOURNAL:MAX_META,false);
            entry.put("unconfirmed",name.endsWith(".new"));
            evidence.put(entry);
        }
        if(noBackup!=null){
            for(String name:new String[]{MARKER,MARKER+".bak",MARKER+".new",
                    "sync-peers-v2.json","sync-peers-v2.json.bak","sync-peers-v2.json.new",
                    "sync-queue-v2.json","sync-queue-v2.json.bak","sync-queue-v2.json.new"}) {
                JSONObject entry=inspectFile(new File(noBackup,name),"no_backup/"+name,
                    name.startsWith("sync-")?"syncEvidence":"installationEvidence",MAX_META,false);
                entry.put("unconfirmed",name.endsWith(".new"));
                evidence.put(entry);
            }
        }
        File mediaDirectory=new File(home,"media");
        boolean mediaAvailable=requireDirectory(mediaDirectory,false);
        Set<String> foundMedia=new HashSet<>();
        if(mediaAvailable){
            File[] children=mediaDirectory.listFiles();
            if(children==null)throw new IOException("Nelze vypsat původní přílohy");
            if(children.length>MAX_FILES)throw new IOException("Příliš mnoho souborů médií");
            Arrays.sort(children,Comparator.comparing(File::getName));
            for(File file:children){
                String name=file.getName();
                foundMedia.add(name);
                JSONObject entry=inspectFile(file,"files/media/"+name,"media",MAX_MEDIA,false);
                entry.put("referenced",referenced.contains(name));
                if(!PeerSnapshot.validMediaId(name)){
                    entry.put("state","UNSAFE_NAME");
                    entry.put("complete",false);
                }
                media.put(entry);
            }
        }
        for(String id:referenced)
            if(!foundMedia.contains(id))
                media.put(new JSONObject().put("path","files/media/"+id)
                    .put("kind","media").put("state","MISSING_OR_UNSAFE")
                    .put("referenced",true).put("complete",false));
        Map<String,String> observedMedia=new HashMap<>();
        for(int i=0;i<media.length();i++){
            JSONObject row=media.getJSONObject(i);
            String path=row.getString("path");
            if(path.startsWith("files/media/"))
                observedMedia.put(path.substring("files/media/".length()),row.getString("state"));
        }
        int validCount=0;
        for(int i=0;i<candidates.length();i++){
            JSONObject candidate=candidates.getJSONObject(i);
            JSONArray required=candidate.optJSONArray("mediaReferences");
            if(required!=null){
                int unavailable=0;
                for(int j=0;j<required.length();j++)
                    if(!"PRESENT".equals(observedMedia.get(required.getString(j))))unavailable++;
                candidate.put("unavailableMedia",unavailable);
                if(unavailable>0){
                    candidate.put("state","INCOMPLETE").put("complete",false);
                    candidate.put("missingMedia",unavailable);
                }
            }
            if("VALID".equals(candidate.optString("state")))validCount++;
        }
        report.put("candidates",candidates).put("evidence",evidence)
            .put("media",media).put("mediaDirectoryPresent",mediaAvailable)
            .put("validatedCandidateFiles",validCount)
            .put("primaryRecordCount",records).put("primaryDeletedRecordCount",deleted)
            .put("primaryEmbeddedHistoryRecordCount",history)
            .put("historyGuarantee","ONLY_EMBEDDED_BYTES_PRESENT; UNDO_REDO_NOT_DURABLE")
            .put("notes","Bezpečný inventář neobnovuje ani nepřepisuje žádná živá data");
        return report;
    }

    private static boolean requireDirectory(File dir,boolean required)throws IOException{
        BasicFileAttributes a=attributes(dir);
        if(a==null){if(required)throw new IOException("Adresář databáze chybí");return false;}
        if(!a.isDirectory()||a.isSymbolicLink())
            throw new IOException("Neplatný adresář diagnostiky");
        return true;
    }
    private static BasicFileAttributes attributes(File file)throws IOException {
        try{return Files.readAttributes(file.toPath(),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
        catch(NoSuchFileException absent){return null;}
    }
    private static boolean availableMedia(File directory,String id)throws IOException{
        if(!PeerSnapshot.validMediaId(id))return false;
        if(!requireDirectory(directory,false))return false;
        BasicFileAttributes a=attributes(new File(directory,id));
        return a!=null&&a.isRegularFile()&&!a.isSymbolicLink()&&
            a.size()>0&&a.size()<=MAX_MEDIA;
    }
    private static byte[] readStable(File path,long max)throws Exception{
        BasicFileAttributes before=attributes(path);
        if(before==null||!before.isRegularFile()||before.isSymbolicLink()||
            before.size()<0||before.size()>max)throw new IOException("Zdroj není bezpečně čitelný");
        byte[] bytes;
        try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS);
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] buffer=new byte[65536];int n;long total=0;
            while((n=in.read(buffer))!=-1){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Diagnostika přerušena");
                if(n==0)throw new IOException("Čtení diagnostiky nepostupuje");
                total+=n;if(total>max)throw new IOException("Soubor překročil limit");
                out.write(buffer,0,n);
            }
            bytes=out.toByteArray();
        }
        BasicFileAttributes after=attributes(path);
        if(after==null||!after.isRegularFile()||after.isSymbolicLink()||
           before.size()!=after.size()||bytes.length!=after.size()||
           !before.lastModifiedTime().equals(after.lastModifiedTime())||
           !Objects.equals(before.fileKey(),after.fileKey()))
            throw new IOException("Soubor se během diagnostiky změnil");
        return bytes;
    }
    private static JSONObject inspectFile(File path,String location,String kind,
                                          long max,boolean database)throws Exception{
        JSONObject entry=new JSONObject().put("path",location).put("kind",kind);
        BasicFileAttributes before;
        try{before=attributes(path);}
        catch(IOException error){return entry.put("state","UNREADABLE").put("complete",false);}
        if(before==null)return entry.put("state","MISSING").put("complete",false);
        entry.put("size",before.size());
        if(!before.isRegularFile()||before.isSymbolicLink())
            return entry.put("state","UNSAFE").put("complete",false);
        if(before.size()>max)
            return entry.put("state","TOO_LARGE").put("complete",false);
        try{
            MessageDigest digest=ArchiveIntegrity.digest();
            ByteArrayOutputStream buffered=database||kind.equals("journal")||
                kind.equals("trashEvidence")?new ByteArrayOutputStream():null;
            long total=0;
            try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS)){
                byte[] block=new byte[65536];int n;
                while((n=in.read(block))!=-1){
                    if(Thread.currentThread().isInterrupted())
                        throw new InterruptedIOException("Diagnostika přerušena");
                    if(n==0)throw new IOException("Čtení diagnostiky nepostupuje");
                    total+=n;if(total>max)throw new IOException("Soubor překročil limit");
                    digest.update(block,0,n);
                    if(buffered!=null)buffered.write(block,0,n);
                }
            }
            BasicFileAttributes after=attributes(path);
            if(after==null||!after.isRegularFile()||after.isSymbolicLink()||
                before.size()!=total||after.size()!=total||
                !before.lastModifiedTime().equals(after.lastModifiedTime())||
                !Objects.equals(before.fileKey(),after.fileKey()))
                return entry.put("state","CHANGED").put("complete",false);
            entry.put("sha256",ArchiveIntegrity.hex(digest.digest()));
            entry.put("size",total).put("complete",true);
            if(database){
                byte[] bytes=buffered.toByteArray();
                try{LocalDatabase.validate(JsonInput.decode(bytes));}
                catch(Exception invalid){
                    return entry.put("state","CORRUPT").put("complete",false);
                }
                return entry.put("state","VALID");
            }
            if(kind.equals("journal")){
                try{
                    JSONObject state=JsonInput.object(buffered.toByteArray());
                    Object epoch=state.get("epoch");
                    if(state.optInt("version")!=1||!(epoch instanceof String)||
                       !((String)epoch).isEmpty()&&!DeviceIdentity.valid((String)epoch)||
                       !(state.get("recovering") instanceof Boolean))
                        throw new IOException("Neplatný journal");
                    entry.put("epoch",epoch).put("recovering",state.getBoolean("recovering"));
                }catch(Exception invalid){
                    return entry.put("state","CORRUPT").put("complete",false);
                }
            }
            if(kind.equals("trashEvidence")){
                try{
                    JSONArray ids=new JSONArray(JsonInput.decode(buffered.toByteArray()));
                    if(ids.length()>MAX_FILES)throw new IOException("Koš překračuje limit");
                    for(int i=0;i<ids.length();i++)
                        if(!PeerSnapshot.validMediaId(ids.getString(i)))
                            throw new IOException("Neplatná položka úklidu");
                    entry.put("pendingTrashMedia",ids.length());
                }catch(Exception invalid){
                    return entry.put("state","CORRUPT").put("complete",false);
                }
            }
            return entry.put("state","PRESENT");
        }catch(Exception failure){
            if(failure instanceof InterruptedIOException)throw failure;
            return entry.put("state","UNREADABLE").put("complete",false);
        }
    }
}
