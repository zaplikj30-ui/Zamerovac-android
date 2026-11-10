package cz.zamerovac.app;

import android.content.Context;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** One durable writer shared by UI, restore and sync. The lock protects LOCAL I/O only. */
final class LocalDatabase {
    static final int MAX_BYTES=20*1024*1024;
    private static final java.util.concurrent.ConcurrentHashMap<String,java.util.concurrent.atomic.AtomicLong> GENERATIONS=new java.util.concurrent.ConcurrentHashMap<>();
    static long generation(File home){return GENERATIONS.computeIfAbsent(home.getAbsolutePath(),key->new java.util.concurrent.atomic.AtomicLong()).get();}
    private static void changed(File home){GENERATIONS.computeIfAbsent(home.getAbsolutePath(),key->new java.util.concurrent.atomic.AtomicLong()).incrementAndGet();}
    static void validate(String text)throws IOException {
        if(text==null||text.length()>MAX_BYTES||text.getBytes(StandardCharsets.UTF_8).length>MAX_BYTES)throw new IOException("Databáze je příliš velká");
        JsonInput.check(text);
        try{JSONObject db=new JSONObject(text);JsonInput.unicode(db);if(db.optInt("schema")!=1||db.optJSONArray("records")==null)throw new IOException("Neplatná databáze");
            Set<String> ids=new HashSet<>();JSONArray records=db.getJSONArray("records");
            for(int i=0;i<records.length();i++){JSONObject record=records.optJSONObject(i);if(record==null||!(record.opt("id") instanceof String)||record.getString("id").isEmpty()||!ids.add(record.getString("id")))throw new IOException("Neplatný nebo duplicitní záznam");try{CausalClock.clock(record);}catch(Exception invalid){throw new IOException("Neplatná synchronizační revize",invalid);}}
            JSONObject tombstones=db.optJSONObject("syncTombstones");if(db.has("syncTombstones")&&tombstones==null)throw new IOException("Neplatný koš synchronizace");
            if(tombstones!=null)for(Iterator<String> it=tombstones.keys();it.hasNext();)try{CausalClock.validate(tombstones.getJSONObject(it.next()));}catch(Exception invalid){throw new IOException("Neplatná revize koše",invalid);}
        }catch(JSONException e){throw new IOException("Neplatná databáze",e);}
    }
    /** Invalid verified bytes are different from an unreadable or changing file. */
    private static final class InvalidBytes extends IOException {
        final String fingerprint;
        InvalidBytes(String fingerprint,IOException cause){super("Neplatný obsah databáze",cause);this.fingerprint=fingerprint;}
    }
    private static final class ConfirmedCorruption extends IOException {
        ConfirmedCorruption(IOException cause){super("Opakovaně potvrzené poškození databáze",cause);}
    }
    private static java.nio.file.attribute.BasicFileAttributes attributes(File file)throws IOException{
        return Files.readAttributes(file.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
    }
    static String readFile(File file)throws IOException {
        java.nio.file.attribute.BasicFileAttributes before=attributes(file);
        if(!before.isRegularFile()||before.isSymbolicLink())
            throw new IOException("Databázový soubor není bezpečně čitelný");
        if(before.size()>MAX_BYTES)
            throw new InvalidBytes("oversize:"+before.size()+":"+before.lastModifiedTime().toMillis(),
                new IOException("Databáze překračuje limit"));
        byte[] bytes=Files.readAllBytes(file.toPath());
        java.nio.file.attribute.BasicFileAttributes after=attributes(file);
        if(!after.isRegularFile()||after.isSymbolicLink()||bytes.length>MAX_BYTES||
            before.size()!=after.size()||bytes.length!=after.size()||
            !before.lastModifiedTime().equals(after.lastModifiedTime()))
            throw new IOException("Databáze se během čtení změnila; zkuste operaci zopakovat");
        try{
            String text=JsonInput.decode(bytes);
            validate(text);
            return text;
        }catch(IOException invalid){
            throw new InvalidBytes(PeerWire.hash(bytes),invalid);
        }
    }
    /**
     * Retry a transient read once, without modifying the recovery journal.
     * A corrupt payload is confirmed only by two matching, independently read
     * fingerprints. An intermittent failure can never rotate recovery epoch.
     */
    private static String readPrimary(File file)throws IOException{
        try{return readFile(file);}
        catch(InvalidBytes first){
            try{readFile(file);}
            catch(InvalidBytes repeated){
                if(first.fingerprint.equals(repeated.fingerprint))
                    throw new ConfirmedCorruption(repeated);
                throw new IOException("Databáze se během ověřování změnila; nic nebylo přepsáno",repeated);
            }
            throw new IOException("Neplatný první pokus čtení se neopakoval; zkuste znovu");
        }catch(IOException transientFailure){
            try{return readFile(file);}
            catch(IOException repeated){throw new IOException(
                "Databázi nyní nelze bezpečně přečíst; původní stav nebyl změněn",repeated);}
        }
    }
    /**
     * Strict UI/CAS read: a stale backup is NOT a current writable snapshot.
     * Recovery must be explicit. A vanished initialized DB is not a fresh install.
     */
    /** Unknown file accessibility is never evidence of a clean first install. */
    private static boolean present(File path)throws IOException{
        try{return Files.readAttributes(path.toPath(),java.nio.file.attribute.BasicFileAttributes.class,
                LinkOption.NOFOLLOW_LINKS)!=null;}
        catch(NoSuchFileException missing){return false;}
    }
    /** Rotate recovery epoch once and durably retire previous local peer ACKs. */
    private static void lost(File home,File noBackup)throws IOException{
        if(DatabaseRecovery.recovered(home))changed(home);
        if(noBackup!=null)try{
            new SyncPeerRegistry(noBackup).localRecovery(DatabaseRecovery.id(home));
        }catch(Exception failure){throw new IOException("Synchronizační doklady obnovy nelze zneplatnit",failure);}
    }
    /** Check the durable independent no_backup recovery witness before trusting
     * a valid primary, publishing a snapshot, accepting an ACK or writing. */
    private static void requireRecoveryWitness(File home,File noBackup)throws IOException{
        if(noBackup!=null)
            SyncPeerRegistry.requireMatchingRecoveryEpoch(noBackup,DatabaseRecovery.id(home));
    }
    static String readForCas(Context context)throws IOException{
        return readForCas(context.getFilesDir(),context.getNoBackupFilesDir());
    }
    static String readForCas(File home)throws IOException{return readForCas(home,null);}
    static String readForCas(File home,File noBackup)throws IOException{
        synchronized(TrashPurger.LOCK){
            File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
            if(!present(primary)){
                File media=new File(home,"media");
                boolean mediaPresent=present(media);
                File[] artifacts=mediaPresent?media.listFiles():null;
                boolean mediaUnsafe=mediaPresent&&(
                    Files.isSymbolicLink(media.toPath())||!media.isDirectory()||
                    artifacts==null||artifacts.length>0);
                boolean evidence=DatabaseInstallEvidence.exists(home,noBackup);
                boolean traces=DatabaseInstallEvidence.legacySyncTraces(noBackup);
                boolean prior=evidence||traces||present(backup)||DatabaseRecovery.exists(home)||ProtectedRevisions.evidence(home);
                if(prior)lost(home,noBackup);
                if(prior||present(new File(home,"projects.tmp"))||
                    present(new File(home,"projects.backup.tmp"))||mediaUnsafe)
                    throw new IOException("Dříve uložená databáze chybí; ruční obnova je nutná");
                return "";
            }
            // A valid primary cannot dismiss a pending recovery without
            // an explicit future recovery promotion and new ACK epoch.
            String text;
            try{text=readPrimary(primary);}
            catch(ConfirmedCorruption confirmed){lost(home,noBackup);throw confirmed;}
            if(DatabaseRecovery.pending(home))
                throw new IOException("Databáze vyžaduje výslovné dokončení obnovy");
            requireRecoveryWitness(home,noBackup);
            DatabaseInstallEvidence.ensure(home,noBackup);
            SyncPeerRegistry.recordDatabaseInitialized(noBackup);
            return text;
        }
    }
    static String read(Context context)throws IOException{
        return read(context.getFilesDir(),context.getNoBackupFilesDir());
    }
    static String read(File home)throws IOException{return read(home,null);}
    static String read(File home,File noBackup)throws IOException{
        synchronized(TrashPurger.LOCK){
            File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
            boolean primaryExists=present(primary),backupExists=present(backup);
            if(!primaryExists&&!backupExists){
                boolean previous=DatabaseInstallEvidence.exists(home,noBackup)||
                    DatabaseInstallEvidence.legacySyncTraces(noBackup)||DatabaseRecovery.exists(home)||ProtectedRevisions.evidence(home);
                if(previous){lost(home,noBackup);throw new IOException("Dříve uložená databáze chybí; ruční obnova je nutná");}
                return "";
            }
            String text;
            if(!primaryExists){
                // Proven missing primary is itself recovery evidence: record the
                // durable barrier BEFORE attempting possibly unavailable backup I/O.
                lost(home,noBackup);
                text=readFile(backup);
                DatabaseInstallEvidence.ensure(home,noBackup);
                return text;
            }
            try{text=readPrimary(primary);}
            catch(ConfirmedCorruption confirmed){
                // Stable, repeated corruption (never a transient read failure).
                // Retire stale ACKs even when the backup cannot be read.
                lost(home,noBackup);
                try{text=readFile(backup);}
                catch(IOException unavailable){
                    throw new IOException("Ověřeně poškozená primární databáze; původní soubory zůstaly beze změny",confirmed);
                }
                DatabaseInstallEvidence.ensure(home,noBackup);
                return text;
            }
            if(DatabaseRecovery.pending(home))
                throw new IOException("Obnova databáze musí být výslovně potvrzena");
            requireRecoveryWitness(home,noBackup);
            DatabaseInstallEvidence.ensure(home,noBackup);
            SyncPeerRegistry.recordDatabaseInitialized(noBackup);
            return text;
        }
    }
    static String recoveryId(Context context)throws IOException{
        synchronized(TrashPurger.LOCK){
            // A sync epoch is a write/ACK authority, not a diagnostic read.
            // A stale backup must NEVER authorize publishing a new snapshot.
            readForCas(context);
            return DatabaseRecovery.id(context.getFilesDir());
        }
    }
    static String recoveryId(File home)throws IOException{
        synchronized(TrashPurger.LOCK){read(home);return DatabaseRecovery.id(home);}
    }
    private static void replace(File from,File to)throws IOException {
        try{Files.move(from.toPath(),to.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
        catch(AtomicMoveNotSupportedException error){Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING);}
    }
    private static void writeSynced(File file,byte[] bytes)throws IOException {
        try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);out.getFD().sync();}
    }
    static void write(Context context,String text)throws IOException{
        write(context.getFilesDir(),context.getNoBackupFilesDir(),text,context.getSharedPreferences("zamerovac",Context.MODE_PRIVATE));
    }
    static void write(File home,String text)throws IOException{write(home,null,text);}
    static void write(File home,File noBackup,String text)throws IOException{
        write(home,noBackup,text,null);
    }
    private static void write(File home,File noBackup,String text,android.content.SharedPreferences prefs)throws IOException{
        synchronized(TrashPurger.LOCK){
            validate(text);File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak"),
                next=new File(home,"projects.tmp"),backupNext=new File(home,"projects.backup.tmp");
            String confirmed=readForCas(home,noBackup);
            if(!confirmed.isEmpty()&&!confirmed.equals(text))
                new ProtectedRevisions(home,noBackup,prefs).preserveDatabase(confirmed);
            // Protect the proposed exact state before publishing it as current.
            // If the later DB commit fails, this remains recovery evidence only.
            new ProtectedRevisions(home,noBackup,prefs).preserveDatabase(text);
            // Persist BOTH proofs before the first DB commit; any failed write
            // remains visible to the next process and never authorizes a reset.
            DatabaseInstallEvidence.ensure(home,noBackup);
            // Monotonic evidence in preexisting pairing metadata is written
            // before the first durable database commit. A crash cannot turn
            // an already-used installation into a fresh pairing-only device.
            SyncPeerRegistry.recordDatabaseInitialized(noBackup);
            DatabaseRecovery.healthy(home,true);
            try{
                writeSynced(next,text.getBytes(StandardCharsets.UTF_8));
                if(primary.isFile()){
                    String previous=null;try{previous=readFile(primary);}catch(IOException ignored){}
                    if(previous!=null){writeSynced(backupNext,previous.getBytes(StandardCharsets.UTF_8));replace(backupNext,backup);}
                }
                replace(next,primary);changed(home);
            }finally{next.delete();backupNext.delete();}
        }
    }
}
