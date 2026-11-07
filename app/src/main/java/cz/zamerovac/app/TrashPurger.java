package cz.zamerovac.app;

import android.content.SharedPreferences;
import android.content.Context;
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
    private final File home, cache, identityDirectory;
    private final SharedPreferences prefs;
    private final Unlink unlink;
    TrashPurger(Context context,SharedPreferences prefs){this(context.getFilesDir(),context.getCacheDir(),prefs,File::delete,context.getNoBackupFilesDir());}
    TrashPurger(File home, File cache, SharedPreferences prefs) { this(home,cache,prefs,File::delete); }
    TrashPurger(File home, File cache, SharedPreferences prefs, Unlink unlink) {
        this(home,cache,prefs,unlink,new File(home.getParentFile(),"no_backup"));
    }
    private TrashPurger(File home,File cache,SharedPreferences prefs,Unlink unlink,File identityDirectory){
        this.home=home;this.cache=cache;this.prefs=prefs;this.unlink=unlink;this.identityDirectory=identityDirectory;
    }
    private File pendingFile(){return new File(home,"trash-cleanup.json");}
    private static boolean validId(String id){return id.matches("[a-zA-Z0-9_-]{3,120}");}
    // Include unknown fields/history in the protection set. Shared detail photos must survive.
    // A separate JSON string may be valid at depth 100 while its enclosing record
    // is also at depth 100. Count the combined walk, not just each parsed fragment.
    private static final int MAX_REFERENCE_DEPTH=100;
    private static void strings(Object value, Set<String> found) throws JSONException,IOException {
        strings(value,found,0);
    }
    private static void strings(Object value, Set<String> found,int depth) throws JSONException,IOException {
        // An uncertain reference graph must abort the purge BEFORE any unlink.
        if(depth>MAX_REFERENCE_DEPTH)throw new IOException("Historie příloh je příliš zanořená. Koš nebyl vysypán.");
        if(value instanceof String){
            String text=(String)value;found.add(text);
            // Older and imported records may encode complete arrays OR objects
            // as strings. A live reference inside either must block media unlinking.
            String trimmed=text.trim();
            if(trimmed.startsWith("[")||trimmed.startsWith("{")){
                // Limit failures must propagate; silently ignoring them could let
                // a still-referenced original become an unlink candidate.
                JsonInput.check(text);
                Object parsed;
                try{
                    parsed=trimmed.startsWith("[")?new JSONArray(text):new JSONObject(text);
                }catch(JSONException malformed){
                    // An invalid object-looking history may still contain media IDs.
                    // The safe response is to reject cleanup, never unlink by guess.
                    throw new IOException("Nelze ověřit historické odkazy na přílohy. Koš nebyl vysypán.",malformed);
                }
                strings(parsed,found,depth+1);
            }
        }
        else if(value instanceof JSONObject){
            JSONObject o=(JSONObject)value;Iterator<String> keys=o.keys();
            while(keys.hasNext())strings(o.get(keys.next()),found,depth+1);
        }
        else if(value instanceof JSONArray){
            JSONArray a=(JSONArray)value;
            for(int i=0;i<a.length();i++)strings(a.get(i),found,depth+1);
        }
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
        JSONObject tombstones=db.optJSONObject("syncTombstones");if(tombstones==null)tombstones=new JSONObject();
        int removed=0;
        for(int i=0;i<records.length();i++){
            JSONObject r=records.getJSONObject(i);
            if(ids.contains(r.getString("id"))){
                if(!r.optBoolean("deleted"))throw new IOException("Položka již není v koši. Nic nebylo odstraněno.");
                tombstones.put(r.getString("id"),CausalClock.advance(CausalClock.merge(CausalClock.clock(r),tombstones.optJSONObject(r.getString("id"))==null?new JSONObject():tombstones.getJSONObject(r.getString("id"))),DeviceIdentity.get(identityDirectory)));candidates.addAll(PeerSnapshot.cleanupReferences(r));removed++;
            }else kept.put(r);
        }
        if(removed!=ids.size())throw new IOException("Obsah koše se změnil. Potvrď jej znovu.");
        db.put("records",kept);db.put("syncTombstones",tombstones);db.put("syncProtocol",2);
        // Keep only IDs, never removed payloads. Sync must not reintroduce old deleted records.
        Set<String> purged=purgedIds(db);purged.addAll(ids);
        db.put("trashPurgedIds",new JSONArray(purged));
        Set<String> protectedIds=new HashSet<>();
        JSONObject live=new JSONObject(db.toString());live.remove("trashPurgedIds");
        strings(live,protectedIds);candidates.removeAll(protectedIds);
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
                boolean ok=removeFile(source)&&removeFile(thumb)&&removeFile(new File(cache,"photo-thumbs/"+id+".tmp"))&&removeFile(new File(cache,"photo-thumbs/"+id+".failed"));
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
