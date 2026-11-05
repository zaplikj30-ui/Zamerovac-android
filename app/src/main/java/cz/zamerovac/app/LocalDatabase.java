package cz.zamerovac.app;

import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** One durable writer shared by UI, restore and sync. The lock protects LOCAL I/O only. */
final class LocalDatabase {
    private static final java.util.concurrent.ConcurrentHashMap<String,java.util.concurrent.atomic.AtomicLong> GENERATIONS=new java.util.concurrent.ConcurrentHashMap<>();
    static long generation(File home){return GENERATIONS.computeIfAbsent(home.getAbsolutePath(),key->new java.util.concurrent.atomic.AtomicLong()).get();}
    private static void changed(File home){GENERATIONS.computeIfAbsent(home.getAbsolutePath(),key->new java.util.concurrent.atomic.AtomicLong()).incrementAndGet();}
    static void validate(String text)throws IOException {
        if(text==null||text.length()>20*1024*1024)throw new IOException("Databáze je příliš velká");
        JsonInput.check(text);
        try{JSONObject db=new JSONObject(text);JsonInput.unicode(db);if(db.optInt("schema")!=1||db.optJSONArray("records")==null)throw new IOException("Neplatná databáze");
            Set<String> ids=new HashSet<>();JSONArray records=db.getJSONArray("records");
            for(int i=0;i<records.length();i++){JSONObject record=records.optJSONObject(i);if(record==null||!(record.opt("id") instanceof String)||record.getString("id").isEmpty()||!ids.add(record.getString("id")))throw new IOException("Neplatný nebo duplicitní záznam");try{CausalClock.clock(record);}catch(Exception invalid){throw new IOException("Neplatná synchronizační revize",invalid);}}
            JSONObject tombstones=db.optJSONObject("syncTombstones");if(db.has("syncTombstones")&&tombstones==null)throw new IOException("Neplatný koš synchronizace");
            if(tombstones!=null)for(Iterator<String> it=tombstones.keys();it.hasNext();)try{CausalClock.validate(tombstones.getJSONObject(it.next()));}catch(Exception invalid){throw new IOException("Neplatná revize koše",invalid);}
        }catch(JSONException e){throw new IOException("Neplatná databáze",e);}
    }
    static String readFile(File file)throws IOException {
        if(!file.isFile()||file.length()>20L*1024*1024)throw new IOException("Databáze není dostupná");
        String text=JsonInput.decode(Files.readAllBytes(file.toPath()));validate(text);return text;
    }
    static String read(File home)throws IOException {
        synchronized(TrashPurger.LOCK){
            File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
            if(!primary.exists()&&!backup.exists())return "";
            try{return readFile(primary);}catch(IOException error){try{return readFile(backup);}catch(IOException ignored){throw new IOException("Uložené zakázky nelze načíst; původní soubory zůstaly beze změny",error);}}
        }
    }
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
            // If an existing primary and its recovery copy are BOTH unreadable, do not overwrite either.
            if(primary.exists()||backup.exists())read(home);
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
