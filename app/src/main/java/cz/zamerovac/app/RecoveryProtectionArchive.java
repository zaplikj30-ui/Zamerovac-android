package cz.zamerovac.app;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.channels.FileChannel;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.security.MessageDigest;
import java.util.*;

/**
 * B16 stage 2: isolated, byte-exact preservation of AVAILABLE recovery evidence.
 * This is NOT an import, a recovery promotion, or permission to acknowledge sync.
 * The "COMPLETE" marker only certifies the archived bytes; sourceComplete may
 * still be false (missing photos, invalid DB, missing recovery evidence).
 */
final class RecoveryProtectionArchive {
    private static final String ROOT="recovery-protection-v1";
    private static final String FORMAT="cz.zamerovac.recovery.protection";
    private static final long MAX_META=LocalDatabase.MAX_BYTES;
    private static final long MAX_MEDIA=PeerSnapshot.MAX_MEDIA;
    private static final long RESERVE=8L*1024*1024;
    private static final int MAX_FILES=20000;
    private static final String MARKER="zamerovac-install-state-v1.marker";

    interface Space {long available(File directory)throws IOException;}
    interface Checkpoint {void check()throws IOException;}
    private RecoveryProtectionArchive(){}

    static JSONObject create(Context context)throws Exception {
        return create(context.getFilesDir(),context.getNoBackupFilesDir());
    }
    static JSONObject create(File home,File noBackup)throws Exception {
        return create(home,noBackup,File::getUsableSpace,()->{});
    }
    /** Test seams inject a full disk or interruption without touching source bytes. */
    static JSONObject create(File home,File noBackup,Space space,Checkpoint checkpoint)throws Exception {
        if(home==null||noBackup==null||space==null||checkpoint==null)
            throw new IOException("Chybí zdroj ochranné kopie");
        synchronized(TrashPurger.LOCK){
            safeDirectory(home,true);safeDirectory(noBackup,true);
            checkpoint.check();
            JSONObject manifest=manifest(home,noBackup);
            byte[] encoded=canonical(manifest);
            if(encoded.length>MAX_META)throw new IOException("Manifest je příliš velký");
            String id=PeerWire.hash(encoded);
            File root=new File(noBackup,ROOT),finalDir=new File(root,"snapshot-"+id);
            // Verify an existing copy BEFORE consuming any new disk space.
            if(exists(finalDir)){
                JSONObject checked=verifyInternal(finalDir,id,false);
                // Interrupted after atomic publication but before COMPLETE:
                // finish only if every archived byte is independently valid.
                if(!checked.getBoolean("complete")){
                    if(!checked.getBoolean("payloadVerified"))
                        throw new IOException("Dřívější ochranná kopie je neúplná; nepřepisovat");
                    checkpoint.check();
                    finish(finalDir,id);
                    checked=verifyInternal(finalDir,id,true);
                }
                return checked.put("reused",true);
            }
            long required=RESERVE+3L*encoded.length;
            JSONArray files=manifest.getJSONArray("files");
            if(files.length()>MAX_FILES)throw new IOException("Příliš mnoho podkladů obnovy");
            for(int i=0;i<files.length();i++)
                required=Math.addExact(required,files.getJSONObject(i).getLong("size"));
            long free=space.available(noBackup);
            if(free<0||free<required)
                throw new IOException("Nedostatek místa pro ochrannou kopii");
            safeDirectory(root,false);
            if(!root.exists()){
                Files.createDirectory(root.toPath());syncDirectory(noBackup);
            }
            safeDirectory(root,true);
            checkpoint.check();
            File stage=Files.createTempDirectory(root.toPath(),".staging-").toFile();
            // Orphaned staging directories are intentionally NEVER accepted as
            // completed archives. Do not delete possible evidence after failure.
            File payload=new File(stage,"payload");
            Files.createDirectory(payload.toPath());
            for(int i=0;i<files.length();i++){
                JSONObject entry=files.getJSONObject(i);
                String path=entry.getString("path");
                File source=source(home,noBackup,path);
                File destination=new File(payload,path);
                File parent=destination.getParentFile();
                createDirectoriesChecked(stage,parent);
                copyExact(stage,source,destination,entry,checkpoint);
            }
            byte[] after=canonical(manifest(home,noBackup));
            if(!Arrays.equals(encoded,after))
                throw new IOException("Původní zdroje se během archivace změnily");
            File metadata=new File(stage,"manifest.json");
            writeSynced(metadata,encoded);
            syncTreeDirectories(stage);
            if(!payloadVerified(stage,id))
                throw new IOException("Ochrannou kopii nelze ověřit");
            DirectoryChain stageChain=new DirectoryChain(noBackup,stage);
            checkpoint.check();
            stageChain.check();
            if(exists(finalDir)) // must not replace even an incomplete prior copy
                throw new IOException("Cílová kopie již existuje, nic nebylo přepsáno");
            try{
                Files.move(stage.toPath(),finalDir.toPath(),StandardCopyOption.ATOMIC_MOVE);
            }catch(AtomicMoveNotSupportedException unsupported){
                throw new IOException("Souborový systém nepodporuje atomické potvrzení ochranné kopie",unsupported);
            }
            syncDirectory(root);
            checkpoint.check();
            finish(finalDir,id);
            return verifyInternal(finalDir,id,true).put("reused",false);
        }
    }

    /** Reopen after process death; invalid/incomplete archives fail CLOSED. */
    static JSONObject verify(File noBackup,String id)throws Exception{
        if(noBackup==null||id==null||!id.matches("[a-f0-9]{64}"))
            throw new IOException("Neplatná identita kopie");
        safeDirectory(noBackup,true);
        File root=new File(noBackup,ROOT);safeDirectory(root,true);
        File archive=new File(root,"snapshot-"+id);
        JSONObject result=verifyInternal(archive,id,true);
        if(!result.getBoolean("complete"))
            throw new IOException("Kopie nemá potvrzenou úplnost");
        return result;
    }

    private static JSONObject manifest(File home,File noBackup)throws Exception{
        JSONObject inventory=RecoveryInventory.inspect(home,noBackup);
        TreeMap<String,JSONObject> sources=new TreeMap<>();
        JSONArray missing=new JSONArray();
        boolean sourceComplete=true;
        for(String section:new String[]{"candidates","evidence","media"}){
            JSONArray entries=inventory.getJSONArray(section);
            for(int i=0;i<entries.length();i++){
                JSONObject entry=entries.getJSONObject(i);
                String path=entry.getString("path"),status=entry.getString("state");
                validatePath(path);
                if("MISSING".equals(status)){
                    if("files/projects.json".equals(path))sourceComplete=false;
                    continue; // optional backup/journal/metadata files may be absent
                }
                if("MISSING_OR_UNSAFE".equals(status)){
                    missing.put(new JSONObject().put("path",path).put("reason",status));
                    sourceComplete=false;
                    continue;
                }
                if("UNSAFE".equals(status)||"UNSAFE_NAME".equals(status)||
                    "UNREADABLE".equals(status)||"TOO_LARGE".equals(status)||
                    "CHANGED".equals(status))
                    throw new IOException("Nebezpečný nebo nedostupný podklad: "+path);
                if(!entry.has("sha256")||!entry.has("size"))
                    throw new IOException("Podklad bez úplné kontroly: "+path);
                if(!"VALID".equals(status)&&!"PRESENT".equals(status))
                    sourceComplete=false; // CORRUPT and INCOMPLETE are preserved, not promoted
                putSource(sources,path,entry.getLong("size"),entry.getString("sha256"),status);
            }
        }
        // Preserve pending immutable peer snapshots and namespace-specific
        // cloud receipts; never include this archive's own root recursively.
        File outbox=new File(noBackup,"sync-v2-outbox");
        if(safeDirectory(outbox,false)){
            File[] items=outbox.listFiles();
            if(items==null||items.length>MAX_FILES)throw new IOException("Nepřístupné původní přenosy");
            for(File item:items){
                if(!item.getName().matches("[a-f0-9]{64}\\.json(\\.bak|\\.new)?"))
                    throw new IOException("Neznámý soubor v důkazech synchronizace");
                String path="no_backup/sync-v2-outbox/"+item.getName();
                JSONObject evidence=inspectExtra(item,path);
                putSource(sources,path,evidence.getLong("size"),evidence.getString("sha256"),"PRESENT");
            }
        }
        File[] top=noBackup.listFiles();
        if(top==null)throw new IOException("Nedostupné synchronizační doklady");
        for(File item:top){
            if(!item.getName().matches("sync-(inbox|scan|publications)-v2-[a-f0-9-]{36}-[a-f0-9]{64}\\.json(\\.bak|\\.new)?"))
                continue;
            String path="no_backup/"+item.getName();
            JSONObject evidence=inspectExtra(item,path);
            putSource(sources,path,evidence.getLong("size"),evidence.getString("sha256"),"PRESENT");
        }
        // MainActivity persists original media MIME/name settings in
        // shared_prefs/zamerovac.xml, outside files/ and no_backup/.
        // Preserve it byte-for-byte when present; never reconstruct it.
        File parent=home.getParentFile();
        if(parent!=null&&parent.equals(noBackup.getParentFile())){
            safeDirectory(parent,true);
            File prefsDir=new File(parent,"shared_prefs");
            if(safeDirectory(prefsDir,false)){
                File prefsFile=new File(prefsDir,"zamerovac.xml");
                if(exists(prefsFile)){
                    String path="shared_prefs/zamerovac.xml";
                    JSONObject evidence=inspectExtra(prefsFile,path);
                    putSource(sources,path,evidence.getLong("size"),
                        evidence.getString("sha256"),"PRESENT");
                }
            }
        }
        if(sources.isEmpty())throw new IOException("Nejsou dostupné žádné původní soubory");
        if(sources.size()>MAX_FILES)throw new IOException("Příliš mnoho souborů ochranné kopie");
        JSONArray listed=new JSONArray();
        for(JSONObject entry:sources.values())listed.put(entry);
        return new JSONObject().put("format",FORMAT).put("version",1)
            // Even inside a fully copied staging directory this manifest
            // never claims completion: only a verified durable COMPLETE marker
            // permits verify() to report a finished archive.
            .put("copyComplete",false).put("canPromote",false)
            .put("sourceComplete",sourceComplete).put("files",listed)
            .put("missing",missing)
            .put("undoRedo","ONLY_DURABLY_STORED_HISTORY")
            .put("externalProviderHistory","NOT_INCLUDED")
            .put("purpose","BYTE_EXACT_PROTECTION_ONLY");
    }
    private static void putSource(TreeMap<String,JSONObject> sources,String path,
                                  long size,String hash,String status)throws Exception{
        validatePath(path);
        if(size<0||size>limit(path)||!hash.matches("[0-9a-f]{64}"))
            throw new IOException("Neplatné údaje zdroje "+path);
        if(sources.put(path,new JSONObject().put("path",path).put("size",size)
            .put("sha256",hash).put("state",status))!=null)
            throw new IOException("Duplicitní původní soubor: "+path);
    }
    private static JSONObject inspectExtra(File path,String name)throws Exception{
        BasicFileAttributes attrs=attributes(path);
        if(attrs==null||!attrs.isRegularFile()||attrs.isSymbolicLink()||
           attrs.size()>limit(name))throw new IOException("Neplatný soubor synchronizace");
        String hash=hashStable(path,limit(name));
        return new JSONObject().put("size",attrs.size()).put("sha256",hash);
    }

    private static void validatePath(String path)throws IOException{
        boolean prefs="shared_prefs/zamerovac.xml".equals(path);
        boolean db=path.matches("files/(projects\\.json(\\.bak)?|projects\\.bak|projects\\.tmp|projects\\.backup\\.tmp)");
        boolean journal=path.matches("files/(projects\\.recovery-v1\\.json(\\.bak|\\.new)?|trash-cleanup\\.json(\\.bak)?|zamerovac-install-state-v1\\.marker(\\.bak|\\.new)?)");
        boolean media=path.startsWith("files/media/")&&
            PeerSnapshot.validMediaId(path.substring("files/media/".length()));
        boolean nativeEvidence=path.matches("no_backup/(zamerovac-install-state-v1\\.marker(\\.bak|\\.new)?|sync-peers-v2\\.json(\\.bak|\\.new)?|sync-queue-v2\\.json(\\.bak|\\.new)?)");
        boolean other=path.matches("no_backup/sync-(inbox|scan|publications)-v2-[a-f0-9-]{36}-[a-f0-9]{64}\\.json(\\.bak|\\.new)?");
        boolean queued=path.matches("no_backup/sync-v2-outbox/[a-f0-9]{64}\\.json(\\.bak|\\.new)?");
        if(!db&&!journal&&!media&&!nativeEvidence&&!other&&!queued&&!prefs)
            throw new IOException("Nepovolená cesta ochranné kopie");
    }
    private static long limit(String path)throws IOException{
        validatePath(path);
        if(path.startsWith("files/media/"))return MAX_MEDIA;
        if(path.startsWith("files/projects.recovery-v1"))return 4096;
        return MAX_META;
    }
    private static File source(File home,File noBackup,String path)throws IOException{
        validatePath(path);
        if(path.startsWith("shared_prefs/")){
            File parent=home.getParentFile();
            if(parent==null||!parent.equals(noBackup.getParentFile()))
                throw new IOException("Neplatné umístění nastavení");
            safeDirectory(new File(parent,"shared_prefs"),true);
            return new File(parent,path);
        }
        return path.startsWith("files/")?
            new File(home,path.substring(6)):new File(noBackup,path.substring(10));
    }
    private static BasicFileAttributes attributes(File file)throws IOException{
        try{return Files.readAttributes(file.toPath(),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
        catch(NoSuchFileException missing){return null;}
    }
    private static boolean exists(File file)throws IOException{return attributes(file)!=null;}
    private static boolean safeDirectory(File file,boolean required)throws IOException{
        BasicFileAttributes attrs=attributes(file);
        if(attrs==null){if(required)throw new IOException("Adresář ochranné kopie chybí");return false;}
        if(!attrs.isDirectory()||attrs.isSymbolicLink())
            throw new IOException("Nebezpečný adresář ochranné kopie");
        new DirectoryChain(file).check();
        return true;
    }

    /**
     * Path-based Android NIO cannot make a whole traversal atomic. Reject links
     * in every ancestor from the checked application/archive anchor and detect observed directory replacement across I/O.
     * A swap-and-restore entirely between checks still needs descriptor-relative
     * openat traversal; these checks do not claim that stronger guarantee.
     */
    private static final class DirectoryChain {
        final LinkedHashMap<Path,BasicFileAttributes> directories=new LinkedHashMap<>();
        DirectoryChain(File directory)throws IOException{this(directory,directory);}
        DirectoryChain(File anchor,File directory)throws IOException{
            Path base=anchor.toPath().toAbsolutePath().normalize();
            Path path=directory.toPath().toAbsolutePath().normalize();
            if(!path.startsWith(base))throw new IOException("Cesta opustila kořen ochranné kopie");
            Path current=base;
            remember(current);
            if(!base.equals(path))for(Path component:base.relativize(path)){
                current=current.resolve(component);remember(current);
            }
            check();
        }
        private void remember(Path path)throws IOException{
            BasicFileAttributes a=attributes(path.toFile());
            if(a==null||!a.isDirectory()||a.isSymbolicLink()||a.fileKey()==null)
                throw new IOException("Neověřitelný adresář ochranné kopie: "+path);
            directories.put(path,a);
        }
        void check()throws IOException{
            for(Map.Entry<Path,BasicFileAttributes> entry:directories.entrySet()){
                BasicFileAttributes a=attributes(entry.getKey().toFile()),before=entry.getValue();
                if(a==null||!a.isDirectory()||a.isSymbolicLink()||
                   !Objects.equals(before.fileKey(),a.fileKey())||
                   !before.creationTime().equals(a.creationTime()))
                    throw new IOException("Adresář se během archivace změnil");
            }
        }
    }
    private static void createDirectoriesChecked(File anchor,File directory)throws IOException{
        File absolute=directory.getAbsoluteFile();
        if(!exists(absolute)){
            File parent=absolute.getParentFile();
            if(parent==null)throw new IOException("Chybí kořen adresáře");
            createDirectoriesChecked(anchor,parent);
            DirectoryChain chain=new DirectoryChain(anchor,parent);
            Files.createDirectory(absolute.toPath());
            chain.check();
        }
        new DirectoryChain(anchor,absolute).check();
    }
    private static DirectoryChain parents(File file)throws IOException{
        return new DirectoryChain(file.getAbsoluteFile().getParentFile());
    }
    private static byte[] readChecked(File file)throws IOException{
        DirectoryChain chain=parents(file);
        byte[] bytes;
        try(InputStream in=Files.newInputStream(file.toPath(),LinkOption.NOFOLLOW_LINKS);
            ByteArrayOutputStream out=new ByteArrayOutputStream()){
            byte[] block=new byte[8192];int n;
            while((n=in.read(block))!=-1)out.write(block,0,n);
            bytes=out.toByteArray();
        }
        chain.check();return bytes;
    }

    private static String hashStable(File file,long max)throws Exception{
        DirectoryChain chain=parents(file);
        BasicFileAttributes before=attributes(file);
        if(before==null||!before.isRegularFile()||before.isSymbolicLink()||
           before.size()>max)throw new IOException("Soubor nelze bezpečně přečíst");
        MessageDigest sha=ArchiveIntegrity.digest();long count=0;
        try(InputStream in=Files.newInputStream(file.toPath(),LinkOption.NOFOLLOW_LINKS)){
            byte[] block=new byte[65536];int n;
            while((n=in.read(block))!=-1){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Archivace přerušena");
                if(n==0)throw new IOException("Čtení zdroje nepostupuje");
                count+=n;if(count>max)throw new IOException("Zdroj překročil limit");
                sha.update(block,0,n);
            }
        }
        chain.check();
        BasicFileAttributes after=attributes(file);
        if(after==null||!after.isRegularFile()||after.isSymbolicLink()||
           count!=before.size()||after.size()!=before.size()||
           !before.lastModifiedTime().equals(after.lastModifiedTime())||
           !Objects.equals(before.fileKey(),after.fileKey()))
            throw new IOException("Zdroj se během kontroly změnil");
        return ArchiveIntegrity.hex(sha.digest());
    }
    private static void copyExact(File stage,File source,File destination,JSONObject expected,
                                  Checkpoint checkpoint)throws Exception{
        long size=expected.getLong("size"),max=limit(expected.getString("path"));
        String hash=expected.getString("sha256");
        DirectoryChain sourceChain=parents(source),
            destinationChain=new DirectoryChain(stage,destination.getParentFile());
        BasicFileAttributes before=attributes(source);
        if(before==null||!before.isRegularFile()||before.isSymbolicLink()||before.size()!=size)
            throw new IOException("Zdroj kopie zmizel nebo změnil velikost");
        MessageDigest digest=ArchiveIntegrity.digest();long copied=0;
        try(InputStream in=Files.newInputStream(source.toPath(),LinkOption.NOFOLLOW_LINKS);
            FileChannel out=FileChannel.open(destination.toPath(),StandardOpenOption.WRITE,
                StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS)){
            byte[] block=new byte[65536];int n;
            while((n=in.read(block))!=-1){
                checkpoint.check();
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Kopírování přerušeno");
                if(n==0)throw new IOException("Zdroj nepostupuje");
                copied+=n;
                if(copied>size||copied>max)throw new IOException("Zdroj změnil délku");
                sourceChain.check();destinationChain.check();
                ByteBuffer buffer=ByteBuffer.wrap(block,0,n);
                while(buffer.hasRemaining())out.write(buffer);
                digest.update(block,0,n);
            }
            checkpoint.check();sourceChain.check();destinationChain.check();out.force(true);
        }
        sourceChain.check();destinationChain.check();
        BasicFileAttributes after=attributes(source);
        if(after==null||!after.isRegularFile()||after.isSymbolicLink()||
           copied!=size||after.size()!=size||
           !before.lastModifiedTime().equals(after.lastModifiedTime())||
           !Objects.equals(before.fileKey(),after.fileKey())||
           !hash.equals(ArchiveIntegrity.hex(digest.digest()))||
           !hash.equals(hashStable(destination,max)))
            throw new IOException("Původní bajty se během archivace změnily");
    }
    private static byte[] canonical(JSONObject object)throws Exception{
        return CausalClock.canonical(object).getBytes(StandardCharsets.UTF_8);
    }
    private static void writeSynced(File file,byte[] bytes)throws IOException{
        DirectoryChain chain=parents(file);
        try(FileChannel out=FileChannel.open(file.toPath(),StandardOpenOption.WRITE,
                StandardOpenOption.CREATE_NEW,LinkOption.NOFOLLOW_LINKS)){
            ByteBuffer buffer=ByteBuffer.wrap(bytes);
            while(buffer.hasRemaining())out.write(buffer);
            out.force(true);
        }
        chain.check();
    }
    private static void syncDirectory(File dir)throws IOException{
        safeDirectory(dir,true);
        try(FileChannel channel=FileChannel.open(dir.toPath(),StandardOpenOption.READ)){
            channel.force(true);
        }
    }
    private static void syncTreeDirectories(File stage)throws IOException{
        // Durability is checked from leaves towards the staging root.
        File payload=new File(stage,"payload");
        for(File area:new File[]{new File(payload,"files/media"),
                new File(payload,"no_backup/sync-v2-outbox"),new File(payload,"files"),
                new File(payload,"no_backup"),new File(payload,"shared_prefs"),
                payload,stage}){
            if(exists(area))syncDirectory(area);
        }
    }
    private static boolean payloadVerified(File archive,String id)throws Exception{
        return payloadVerified(archive,id,new ArrayList<>());
    }
    private static boolean payloadVerified(File archive,String id,List<DirectoryChain> checkedPaths)throws Exception{
        DirectoryChain archiveChain=new DirectoryChain(archive.getParentFile().getParentFile(),archive);
        checkedPaths.add(archiveChain);
        File manifestFile=new File(archive,"manifest.json");
        if(!exists(manifestFile))return false;
        BasicFileAttributes a=attributes(manifestFile);
        if(!a.isRegularFile()||a.isSymbolicLink()||a.size()>MAX_META)return false;
        byte[] bytes=readChecked(manifestFile);
        if(!id.equals(PeerWire.hash(bytes)))return false;
        JSONObject manifest=JsonInput.object(bytes);
        if(!FORMAT.equals(manifest.optString("format"))||manifest.optInt("version")!=1||
           manifest.optBoolean("copyComplete")||manifest.optBoolean("canPromote"))
            return false;
        File payload=new File(archive,"payload");
        safeDirectory(payload,true);
        JSONArray listed=manifest.getJSONArray("files");
        if(listed.length()>MAX_FILES)return false;
        Set<String> seen=new HashSet<>();
        for(int i=0;i<listed.length();i++){
            JSONObject entry=listed.getJSONObject(i);
            String path=entry.getString("path");
            validatePath(path);
            if(!seen.add(path))return false;
            File candidate=new File(payload,path);
            DirectoryChain chain=new DirectoryChain(archive,candidate.getParentFile());
            checkedPaths.add(chain);
            long size=entry.getLong("size");
            if(size<0||size>limit(path)||!entry.getString("sha256").equals(hashStable(candidate,limit(path))))
                return false;
            if(attributes(candidate).size()!=size)return false;
        }
        for(DirectoryChain chain:checkedPaths)chain.check();
        archiveChain.check();
        return true;
    }
    private static JSONObject verifyInternal(File dir,String id,boolean requireMarker)throws Exception{
        DirectoryChain chain=new DirectoryChain(dir.getParentFile().getParentFile(),dir);
        if(!exists(dir)||!safeDirectory(dir,true))
            throw new IOException("Ochranná kopie není dostupná");
        List<DirectoryChain> checkedPaths=new ArrayList<>();
        boolean content=payloadVerified(dir,id,checkedPaths);
        if(!content)throw new IOException("Obsah ochranné kopie je poškozený");
        File manifestFile=new File(dir,"manifest.json");
        JSONObject manifest=JsonInput.object(readChecked(manifestFile));
        File complete=new File(dir,"COMPLETE");
        boolean marked=false;
        if(exists(complete)){
            if(!attributes(complete).isRegularFile()||attributes(complete).isSymbolicLink())
                throw new IOException("Neplatné potvrzení ochranné kopie");
            byte[] stamp=readChecked(complete);
            marked=Arrays.equals(stamp,(id+"\n").getBytes(StandardCharsets.US_ASCII));
            if(!marked)throw new IOException("Potvrzení ochranné kopie nesouhlasí");
        }
        if(requireMarker&&!marked)throw new IOException("Ochranná kopie nebyla potvrzena");
        for(DirectoryChain checked:checkedPaths)checked.check();
        chain.check();
        return new JSONObject().put("id",id).put("complete",marked)
            .put("payloadVerified",content)
            .put("sourceComplete",manifest.optBoolean("sourceComplete"))
            .put("canPromote",false).put("files",manifest.getJSONArray("files"))
            .put("missing",manifest.getJSONArray("missing"));
    }
    private static void finish(File dir,String id)throws Exception{
        if(!payloadVerified(dir,id))
            throw new IOException("Poškozený obsah nelze potvrdit");
        File complete=new File(dir,"COMPLETE");
        if(exists(complete))throw new IOException("Kopie je již potvrzená");
        File tmp=new File(dir,".complete-"+UUID.randomUUID()+".tmp");
        writeSynced(tmp,(id+"\n").getBytes(StandardCharsets.US_ASCII));
        Files.move(tmp.toPath(),complete.toPath(),StandardCopyOption.ATOMIC_MOVE);
        syncDirectory(dir);
        syncDirectory(dir.getParentFile());
    }
}
