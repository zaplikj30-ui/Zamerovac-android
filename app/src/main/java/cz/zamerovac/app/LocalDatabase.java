package cz.zamerovac.app;

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
    static String readFile(File file)throws IOException {
        if(!file.isFile()||file.length()>MAX_BYTES)throw new IOException("Databáze není dostupná");
        String text=JsonInput.decode(Files.readAllBytes(file.toPath()));validate(text);return text;
    }
    /**
     * Strict UI/CAS read: a stale backup is NOT a current writable snapshot.
     * Recovery must be explicit. A vanished initialized DB is not a fresh install.
     */
    static String readForCas(File home)throws IOException {
        synchronized(TrashPurger.LOCK){
            File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
            if(!primary.exists()){
                File media=new File(home,"media");
                File[] artifacts=media.listFiles();
                // A blocked/unreadable media directory and a symlink are NOT
                // proof of an empty installation. Never overwrite such state.
                boolean mediaUnsafe=media.exists()&&(
                    Files.isSymbolicLink(media.toPath())||!media.isDirectory()||
                    artifacts==null||artifacts.length>0);
                if(backup.exists()||DatabaseRecovery.exists(home)||DatabaseInstallEvidence.exists(home)||
                    new File(home,"projects.tmp").exists()||
                    new File(home,"projects.backup.tmp").exists()||
                    mediaUnsafe)
                    throw new IOException("Dříve uložená databáze chybí; obnovu je nutné potvrdit");
                return "";
            }
            // Deliberately never fall back to projects.bak for a writable CAS.
            String text=readFile(primary);
            // Migrate legacy installations while the actual primary is still verifiably intact.
            // A vanished text-only database is no longer indistinguishable from first launch.
            DatabaseInstallEvidence.ensure(home);
            DatabaseRecovery.healthy(home,false);
            return text;
        }
    }
    static String read(File home)throws IOException {
        synchronized(TrashPurger.LOCK){
            File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
            if(!primary.exists()&&!backup.exists()){
                if(DatabaseInstallEvidence.exists(home))throw new IOException("Dříve inicializovaná databáze chybí; ruční obnova je nutná");
                if(DatabaseRecovery.exists(home)&&DatabaseRecovery.recovered(home))changed(home);
                return "";
            }
            String text;
            try{text=readFile(primary);}catch(IOException error){try{text=readFile(backup);}catch(IOException ignored){throw new IOException("Uložené zakázky nelze načíst; původní soubory zůstaly beze změny",error);}DatabaseInstallEvidence.ensure(home);if(DatabaseRecovery.recovered(home))changed(home);return text;}
            DatabaseInstallEvidence.ensure(home);DatabaseRecovery.healthy(home,false);return text;
        }
    }
    static String recoveryId(File home)throws IOException{synchronized(TrashPurger.LOCK){read(home);return DatabaseRecovery.id(home);}}
    private static void replace(File from,File to)throws IOException {
        try{Files.move(from.toPath(),to.toPath(),StandardCopyOption.ATOMIC_MOVE,StandardCopyOption.REPLACE_EXISTING);}
        catch(AtomicMoveNotSupportedException error){Files.move(from.toPath(),to.toPath(),StandardCopyOption.REPLACE_EXISTING);}
    }
    private static void writeSynced(File file,byte[] bytes)throws IOException {
        try(FileOutputStream out=new FileOutputStream(file)){out.write(bytes);out.getFD().sync();}
    }
    static void write(File home,String text)throws IOException {
        synchronized(TrashPurger.LOCK){
            validate(text);File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak"),next=new File(home,"projects.tmp"),backupNext=new File(home,"projects.backup.tmp");
            // Every writer, including legacy direct callers, must use the SAME strict
            // preflight as CAS. Media without a database is ambiguous: it may be
            // an interrupted transfer or the last surviving customer original.
            // Only a genuinely clean installation can create its first database.
            // Real media import paths bootstrap that database BEFORE staging files.
            readForCas(home);
            // Persist independent installation evidence BEFORE the first database commit.
            // If the process is killed here, the next launch fails closed instead of
            // treating a previously used, text-only database as a clean installation.
            DatabaseInstallEvidence.ensure(home);
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
