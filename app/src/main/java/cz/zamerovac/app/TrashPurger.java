package cz.zamerovac.app;

import android.content.SharedPreferences;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/** Local trash only. Commit records before unlinking media; failed cleanup is durable/retryable. */
final class TrashPurger {
    // Shared with foreground saves and background sync, not just one Activity instance.
    static final Object LOCK = new Object();
    interface Writer { void write(String data) throws Exception; }
    interface Unlink { boolean delete(File file); }
    private final File home, cache;
    private final SharedPreferences prefs;
    private final Unlink unlink;
    TrashPurger(File home, File cache, SharedPreferences prefs) { this(home,cache,prefs,File::delete); }
    TrashPurger(File home, File cache, SharedPreferences prefs, Unlink unlink) {
        this.home=home;this.cache=cache;this.prefs=prefs;this.unlink=unlink;
    }
    private File pendingFile(){return new File(home,"trash-cleanup.json");}
    private static boolean validId(String id){return id.matches("[a-zA-Z0-9_-]{3,120}");}
    // Include unknown fields/history in the protection set. Shared detail photos must survive.
    private static void strings(Object value, Set<String> found) throws JSONException {
        if(value instanceof String)found.add((String)value);
        else if(value instanceof JSONObject){JSONObject o=(JSONObject)value;Iterator<String> keys=o.keys();while(keys.hasNext())strings(o.get(keys.next()),found);}
        else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)strings(a.get(i),found);}
    }
    private static void media(Object value, Set<String> found) throws JSONException {
        if(value instanceof JSONObject){
            JSONObject o=(JSONObject)value;JSONArray a=o.optJSONArray("media");
            if(a!=null)for(int i=0;i<a.length();i++){String id=a.optString(i);if(validId(id))found.add(id);}
            Iterator<String> keys=o.keys();while(keys.hasNext())media(o.get(keys.next()),found);
        }else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)media(a.get(i),found);}
    }
    private Set<String> pending() throws Exception {
        Set<String> ids=new TreeSet<>();AtomicFile file=new AtomicFile(pendingFile());
        if(!pendingFile().exists()&&!new File(pendingFile()+".bak").exists())return ids;
        JSONArray a=new JSONArray(new String(file.readFully(),StandardCharsets.UTF_8));
        for(int i=0;i<a.length();i++){String id=a.getString(i);if(!validId(id))throw new IOException("Neplatný seznam úklidu koše");ids.add(id);}
        return ids;
    }
    private static void atomic(File target,String text) throws IOException {
        AtomicFile file=new AtomicFile(target);FileOutputStream out=null;
        try{out=file.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();file.finishWrite(out);
            if(!target.isFile()||!Arrays.equals(file.readFully(),text.getBytes(StandardCharsets.UTF_8)))throw new IOException("Nelze ověřit zápis úklidu koše");}
        catch(IOException e){if(out!=null)file.failWrite(out);throw e;}
    }
    int pendingCount() throws Exception {return pending().size();}
    JSONObject purge(String saved,String expected,JSONArray requested,Writer writer) throws Exception {
        if(!saved.equals(expected))throw new IOException("Zakázky se mezitím změnily. Otevři koš znovu a potvrď aktuální obsah.");
        JSONObject db=new JSONObject(saved);
        if(db.optInt("schema")!=1)throw new IOException("Nepodporovaná databáze");
        JSONArray records=db.getJSONArray("records"),kept=new JSONArray();
        Set<String> ids=new HashSet<>(),candidates=pending();
        for(int i=0;i<requested.length();i++)ids.add(requested.getString(i));
        int removed=0;
        for(int i=0;i<records.length();i++){
            JSONObject r=records.getJSONObject(i);
            if(ids.contains(r.getString("id"))){
                if(!r.optBoolean("deleted"))throw new IOException("Položka již není v koši. Nic nebylo odstraněno.");
                media(r,candidates);removed++;
            }else kept.put(r);
        }
        if(removed!=ids.size())throw new IOException("Obsah koše se změnil. Potvrď jej znovu.");
        db.put("records",kept);
        // Keep only IDs, never removed payloads. Sync must not reintroduce old deleted records.
        Set<String> purged=purgedIds(db);purged.addAll(ids);
        db.put("trashPurgedIds",new JSONArray(purged));
        Set<String> protectedIds=new HashSet<>();strings(db,protectedIds);candidates.removeAll(protectedIds);
        // Save the cleanup intent first. A failure here cannot change records or media.
        atomic(pendingFile(),new JSONArray(candidates).toString());
        String next=db.toString();
        writer.write(next); // Durable database commit. Never unlink before this succeeds.
        String warning="";
        try {
            // Recovery must not restore deleted records referring to files about to be removed.
            atomic(new File(home,"projects.bak"),next);
            Set<String> failed=new TreeSet<>();
            for(String id:candidates){
                File source=new File(home,"media/"+id),thumb=new File(cache,"photo-thumbs/"+id+".jpg");
                boolean ok=removeFile(source)&&removeFile(thumb)&&removeFile(new File(cache,"photo-thumbs/"+id+".tmp"));
                if(ok){if(!prefs.edit().remove("mime-"+id).remove("name-"+id).commit())ok=false;}
                if(!ok)failed.add(id);
            }
            atomic(pendingFile(),new JSONArray(failed).toString());
            candidates=failed;
        }catch(Exception e){warning="Některé soubory se nepodařilo odstranit. Zopakuj úklid v koši.";}
        if(!candidates.isEmpty())warning="Některé soubory se nepodařilo odstranit. Zopakuj úklid v koši.";
        return new JSONObject().put("data",db).put("snapshot",next).put("pending",candidates.size()).put("warning",warning);
    }
    static Set<String> purgedIds(JSONObject db) {
        Set<String> ids=new TreeSet<>();JSONArray a=db.optJSONArray("trashPurgedIds");
        if(a!=null)for(int i=0;i<a.length();i++)ids.add(a.optString(i));
        return ids;
    }
    private boolean removeFile(File file) throws IOException {
        // No recursive delete and no links escaping the private media/cache directories.
        if(!file.exists()&&!Files.isSymbolicLink(file.toPath()))return true;
        if(Files.isSymbolicLink(file.toPath())||!file.isFile())return false;
        return unlink.delete(file);
    }
}
