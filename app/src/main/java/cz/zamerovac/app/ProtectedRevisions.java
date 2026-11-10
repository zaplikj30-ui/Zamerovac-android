package cz.zamerovac.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Local, append-only recovery evidence. Transport ACKs never grant a release.
 * All callers use TrashPurger.LOCK; no network operation belongs under this lock.
 * The two catalogs are monotonic witnesses, not database/ACK authority.
 */
final class ProtectedRevisions {
    static final String WARNING="Chráněné původní přílohy zůstávají uložené i po vysypání koše. Ochranu nelze zrušit potvrzením synchronizace.";
    private final File home, directory, witness;
    private final SharedPreferences prefs;
    ProtectedRevisions(Context context,SharedPreferences prefs){this(context.getFilesDir(),context.getNoBackupFilesDir(),prefs);}
    ProtectedRevisions(File home,File noBackup,SharedPreferences prefs){
        this.home=home;this.prefs=prefs;directory=new File(home,"protected-revisions");
        // Android's fixed no_backup sibling is also reachable by File-only media
        // publishers. Never key protection by a peer or an open Context instance.
        witness=new File(new File(home.getParentFile(),"no_backup"),"protected-revisions.json");
    }
    private IOException blocked(Exception cause){return new IOException("Ochranu původních dat nelze potvrdit. Operace byla zastavena; při nedostatku místa uvolni jiné soubory. Chráněná data nebyla odstraněna.",cause);}
    private static void safe(File file)throws IOException{
        if(Files.isSymbolicLink(file.toPath())||file.exists()&&!file.isFile())throw new IOException("Nebezpečný soubor ochrany");
    }
    private static boolean exists(File file)throws IOException{
        safe(file);File backup=new File(file+".bak");safe(backup);
        return file.exists()||backup.exists();
    }
    private static byte[] read(File file)throws IOException{
        safe(file);safe(new File(file+".bak"));
        if(file.length()>3L*LocalDatabase.MAX_BYTES||new File(file+".bak").length()>3L*LocalDatabase.MAX_BYTES)throw new IOException("Příliš velký soubor ochrany");
        return new AtomicFile(file).readFully();
    }
    private static void write(File target,byte[] bytes)throws IOException{
        safe(target);safe(new File(target+".bak"));
        if(!target.getParentFile().isDirectory()&&!target.getParentFile().mkdirs())throw new IOException("Nelze připravit ochranu dat");
        AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;
        try{out=atomic.startWrite();out.write(bytes);out.getFD().sync();atomic.finishWrite(out);out=null;
            if(!Arrays.equals(bytes,read(target)))throw new IOException("Ochrana dat nebyla potvrzena");
            syncDirectory(target.getParentFile());
        }catch(IOException failure){if(out!=null)atomic.failWrite(out);throw failure;}
    }
    private static void syncDirectory(File dir)throws IOException{
        java.io.FileDescriptor fd=null;
        try{fd=android.system.Os.open(dir.getAbsolutePath(),android.system.OsConstants.O_RDONLY|android.system.OsConstants.O_DIRECTORY,0);android.system.Os.fsync(fd);}
        catch(android.system.ErrnoException e){throw new IOException("Adresář ochrany nebyl potvrzen",e);}
        finally{if(fd!=null)try{android.system.Os.close(fd);}catch(android.system.ErrnoException e){/* already synced */}}
    }
    private Set<String> catalog(File file)throws Exception{
        Set<String> ids=new TreeSet<>();if(!exists(file))return ids;
        JSONObject value=new JSONObject(JsonInput.decode(read(file)));
        if(!"cz.zamerovac.protection.catalog".equals(value.getString("format"))||value.getInt("version")!=1)throw new IOException("Neplatný registr ochrany");
        JSONArray list=value.getJSONArray("holds");for(int i=0;i<list.length();i++){
            String id=list.getString(i);if(!id.matches("[a-f0-9]{64}")||!ids.add(id))throw new IOException("Neplatná identita ochrany");
        }return ids;
    }
    private File file(String hash){return new File(directory,hash+".json");}
    private JSONObject hold(String hash)throws Exception{
        byte[] bytes=read(file(hash));if(!hash.equals(PeerWire.hash(bytes)))throw new IOException("Poškozená chráněná revize");
        String text=JsonInput.decode(bytes);JsonInput.check(text);JSONObject hold=new JSONObject(text);
        if(!"cz.zamerovac.protected.revision".equals(hold.getString("format"))||hold.getInt("version")!=1)throw new IOException("Neplatná chráněná revize");
        byte[] metadata=hold.getString("metadata").getBytes(StandardCharsets.UTF_8);
        if(!hold.getString("sourceHash").equals(PeerWire.hash(metadata)))throw new IOException("Poškozená přesná metadata");
        JSONObject data=new JSONObject(hold.getString("metadata"));
        if("snapshot".equals(hold.getString("kind")))data=data.getJSONObject("data");
        else if(!"database".equals(hold.getString("kind")))throw new IOException("Neznámý druh revize");
        LocalDatabase.validate(data.toString());
        Set<String> ids=new TreeSet<>();JSONArray media=hold.getJSONArray("media");
        for(int i=0;i<media.length();i++){
            JSONObject entry=media.getJSONObject(i);String id=entry.getString("id");
            if(!PeerSnapshot.validMediaId(id)||!ids.add(id)||!entry.getString("hash").matches("[a-f0-9]{64}")||PeerSnapshot.integer(entry,"size",PeerSnapshot.MAX_MEDIA)<1||!PeerSnapshot.validMime(entry.getString("mime"))||entry.getString("name").length()>256)throw new IOException("Poškozený pin originálu");
        }
        if(!ids.containsAll(PeerSnapshot.references(data.getJSONArray("records"))))throw new IOException("Neúplná ochrana příloh");
        return hold;
    }
    /** Repair the union after a crash between the two catalog commits.
     * An orphan valid hold adds protection; a missing/corrupt indexed hold blocks cleanup.
     * No historical manifest is ever pruned, even after epoch/namespace changes.
     */
    private Map<String,JSONObject> inventory(boolean repair)throws Exception{
        if(Files.isSymbolicLink(directory.toPath())||directory.exists()&&!directory.isDirectory()||Files.isSymbolicLink(witness.getParentFile().toPath()))throw new IOException("Neplatné úložiště ochrany");
        File index=new File(directory,"catalog.json");Set<String> local=catalog(index),other=catalog(witness),ids=new TreeSet<>(local);ids.addAll(other);
        File[] files=directory.listFiles();if(files==null&&directory.exists())throw new IOException("Registr ochrany nelze načíst");
        if(files!=null)for(File f:files){
            String name=f.getName();
            if(name.matches("[a-f0-9]{64}\\.json(\\.bak|\\.new)?"))ids.add(name.substring(0,64));
            else if(!name.matches("catalog\\.json(\\.bak|\\.new)?"))throw new IOException("Neznámý soubor ochrany");
        }
        Map<String,JSONObject> result=new TreeMap<>();for(String id:ids)result.put(id,hold(id));
        if(repair&&!ids.isEmpty()&&(!local.equals(ids)||!other.equals(ids)))saveCatalog(ids);
        return result;
    }
    private void saveCatalog(Set<String> ids)throws Exception{
        byte[] bytes=new JSONObject().put("format","cz.zamerovac.protection.catalog").put("version",1).put("holds",new JSONArray(ids)).toString().getBytes(StandardCharsets.UTF_8);
        write(new File(directory,"catalog.json"),bytes);write(witness,bytes);
    }
    Set<String> pins()throws IOException{synchronized(TrashPurger.LOCK){try{
        Set<String> ids=new TreeSet<>();for(JSONObject hold:inventory(true).values()){
            JSONArray list=hold.getJSONArray("media");for(int i=0;i<list.length();i++)ids.add(list.getJSONObject(i).getString("id"));
        }return ids;
    }catch(Exception e){throw blocked(e);}}}
    JSONObject status()throws IOException{synchronized(TrashPurger.LOCK){try{
        Map<String,JSONObject> holds=inventory(false);Map<String,Long> sizes=new HashMap<>();long metadata=0;
        for(Map.Entry<String,JSONObject> item:holds.entrySet()){
            metadata+=file(item.getKey()).length();JSONArray list=item.getValue().getJSONArray("media");
            for(int i=0;i<list.length();i++){JSONObject entry=list.getJSONObject(i);sizes.put(entry.getString("id"),entry.getLong("size"));}
        }
        long total=0;for(long size:sizes.values())total+=size;
        return new JSONObject().put("revisions",holds.size()).put("media",sizes.size()).put("mediaBytes",total).put("metadataBytes",metadata).put("message",WARNING);
    }catch(Exception e){throw blocked(e);}}}
    void preserveDatabase(String metadata)throws IOException{
        if(metadata==null||metadata.isEmpty())return;
        preserve("database",metadata,null);
    }
    void preserveSnapshot(PeerSnapshot snapshot)throws IOException{preserve("snapshot",new String(snapshot.bytes,StandardCharsets.UTF_8),snapshot);}
    private void preserve(String kind,String metadata,PeerSnapshot snapshot)throws IOException{synchronized(TrashPurger.LOCK){try{
        Map<String,JSONObject> prior=inventory(true);String source=PeerWire.hash(metadata.getBytes(StandardCharsets.UTF_8));
        for(JSONObject old:prior.values())if(kind.equals(old.getString("kind"))&&source.equals(old.getString("sourceHash")))return;
        JSONObject data=new JSONObject(metadata);if(snapshot!=null)data=data.getJSONObject("data");LocalDatabase.validate(data.toString());
        Set<String> ids=PeerSnapshot.references(data.getJSONArray("records"));
        // Also include older embedded JSON objects and unknown history fields.
        Set<String> strings=TrashPurger.referenceStrings(data.getJSONArray("records"));
        for(String id:strings)if(PeerSnapshot.validMediaId(id)&&new File(home,"media/"+id).exists())ids.add(id);
        JSONArray media=new JSONArray();for(String id:ids){
            File original=new File(home,"media/"+id);JSONObject entry=PeerMedia.inspect(original);
            JSONObject expected=snapshot==null?null:snapshot.media.get(id);
            if(expected!=null&&(entry.getLong("size")!=expected.getLong("size")||!entry.getString("hash").equals(expected.getString("hash"))))throw new IOException("Originál se před založením ochrany změnil");
            String mime=prefs==null?"application/octet-stream":prefs.getString("mime-"+id,"application/octet-stream");
            String name=prefs==null?"Příloha":prefs.getString("name-"+id,"Příloha");
            if(!MediaStaging.metadata(mime,name))throw new IOException("Neplatná metadata originálu");
            media.put(entry.put("id",id).put("mime",expected==null?mime:expected.getString("mime")).put("name",expected==null?name:expected.getString("name")));
        }
        JSONObject revision=new JSONObject().put("format","cz.zamerovac.protected.revision").put("version",1).put("kind",kind).put("sourceHash",source).put("epoch",DatabaseRecovery.id(home)).put("metadata",metadata).put("media",media);
        byte[] bytes=revision.toString().getBytes(StandardCharsets.UTF_8);String hash=PeerWire.hash(bytes);
        // Reserve is a preflight only; every failed/short write is still verified.
        if(home.getUsableSpace()<bytes.length*3L+1024*1024)throw new IOException("Nedostatek místa pro ochranu původních dat");
        write(file(hash),bytes);hold(hash);Set<String> all=new TreeSet<>(prior.keySet());all.add(hash);saveCatalog(all);
    }catch(Exception e){throw blocked(e);}}}
    /** A missing pinned original must never be silently re-created under the same ID. */
    static void requireUnpinned(File original)throws IOException{
        File home=original.getParentFile().getParentFile();
        if(new ProtectedRevisions(home,null,null).pins().contains(original.getName()))throw new IOException("Příloha je chráněná. Původní identifikátor se nesmí přepsat ani znovu použít.");
    }
    /** Rollback is best effort: uncertainty leaves the original and its metadata intact. */
    static boolean rollback(File original){synchronized(TrashPurger.LOCK){try{
        requireUnpinned(original);File home=original.getParentFile().getParentFile();
        String saved=LocalDatabase.readForCas(home);
        if(!saved.isEmpty()&&TrashPurger.referenceStrings(new JSONObject(saved)).contains(original.getName()))return false;
        return !original.exists()||original.delete();
    }catch(Exception e){android.util.Log.w("Zamerovac","Rollback ponechal původní přílohu: "+original.getName());return false;}}}
}
