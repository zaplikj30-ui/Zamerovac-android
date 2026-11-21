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
    // App-owned hold files are immutable. Cache only verified summaries, never
    // full historical JSON; any inode/size/mtime or AtomicFile residue change
    // forces a fresh bounded read and hash verification. Restart rebuilds it.
    private static final LinkedHashMap<String,CachedHold> VERIFIED=new LinkedHashMap<>(16,0.75f,true);
    /**
     * #221: a verified *media coverage* cache, not a new recovery authority.
     * Every entry is derived from immutable on-disk holds and both catalogs.
     * A restarted process or any changed file identity falls back to full
     * verification. Destructive operations never use this shortcut.
     *
     * Normal edits use projects.json + projects.bak (1+1); pending peer
     * snapshots and legacy protected holds continue to be retained.
     */
    private static final LinkedHashMap<String,MediaCoverage> MEDIA_COVERAGE =
        new LinkedHashMap<>(8,0.75f,true);
    private static final class FileStamp {
        final long size;
        final java.nio.file.attribute.FileTime modified;
        final Object key;
        FileStamp(File file,boolean directory)throws IOException{
            java.nio.file.attribute.BasicFileAttributes a=Files.readAttributes(
                file.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
            if(a.isSymbolicLink()||(directory?!a.isDirectory():!a.isRegularFile()))
                throw new IOException("Neověřená identita úložiště");
            size=a.size();modified=a.lastModifiedTime();key=a.fileKey();
        }
        boolean same(File file,boolean directory){
            try{
                FileStamp now=new FileStamp(file,directory);
                return size==now.size&&modified.equals(now.modified)&&Objects.equals(key,now.key);
            }catch(IOException missingOrUnsafe){return false;}
        }
    }
    private static final class MediaCoverage {
        final Set<String> media;
        final FileStamp catalog,witness,directory;
        final Map<String,FileStamp> originals;
        MediaCoverage(Set<String> media,FileStamp catalog,FileStamp witness,
                      FileStamp directory,Map<String,FileStamp> originals){
            this.media=Collections.unmodifiableSet(new TreeSet<>(media));
            this.catalog=catalog;this.witness=witness;this.directory=directory;
            this.originals=originals;
        }
        boolean matches(ProtectedRevisions protection,Set<String> ids){
            if(!media.equals(ids)||!catalog.same(new File(protection.directory,"catalog.json"),false)
                    ||!witness.same(protection.witness,false)
                    ||!directory.same(protection.directory,true))return false;
            for(Map.Entry<String,FileStamp> e:originals.entrySet())
                if(!e.getValue().same(new File(protection.home,"media/"+e.getKey()),false))
                    return false;
            return true;
        }
    }

    // Current debug Native bridge invocation only: count history scans without IDs.
    // [revisionCount, verifiedCacheHits, verifiedCacheMisses, originalChecks]
    private static final ThreadLocal<int[]> DEBUG_COUNTS=new ThreadLocal<>();
    static void beginDebugCounts(){if(BuildConfig.DEBUG)DEBUG_COUNTS.set(new int[4]);}
    static int[] takeDebugCounts(){int[] result=DEBUG_COUNTS.get();DEBUG_COUNTS.remove();return result;}
    private static void countDebug(int index){if(!BuildConfig.DEBUG)return;int[] result=DEBUG_COUNTS.get();if(result!=null)result[index]++;}
    private static final class CachedHold {
        final java.nio.file.attribute.BasicFileAttributes attributes;final JSONObject summary;
        CachedHold(java.nio.file.attribute.BasicFileAttributes attributes,JSONObject summary){this.attributes=attributes;this.summary=summary;}
        boolean matches(java.nio.file.attribute.BasicFileAttributes next){return attributes.size()==next.size()&&attributes.lastModifiedTime().equals(next.lastModifiedTime())&&Objects.equals(attributes.fileKey(),next.fileKey());}
    }
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
        if(!target.getParentFile().isDirectory()){
            if(!target.getParentFile().mkdirs())throw new IOException("Nelze připravit ochranu dat");
            syncDirectory(target.getParentFile().getParentFile());
        }
        AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;
        try{out=atomic.startWrite();out.write(bytes);out.getFD().sync();atomic.finishWrite(out);out=null;
            if(!Arrays.equals(bytes,read(target)))throw new IOException("Ochrana dat nebyla potvrzena");
            syncDirectory(target.getParentFile());
        }catch(IOException failure){if(out!=null)atomic.failWrite(out);throw failure;}
    }
    private static void syncDirectory(File dir)throws IOException{
        if(!dir.isDirectory()||Files.isSymbolicLink(dir.toPath()))throw new IOException("Neplatný adresář ochrany");
        try(java.nio.channels.FileChannel channel=java.nio.channels.FileChannel.open(dir.toPath(),StandardOpenOption.READ)){channel.force(true);}
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
    static boolean evidence(File home)throws IOException{
        File witness=new File(new File(home.getParentFile(),"no_backup"),"protected-revisions.json");
        for(File path:new File[]{new File(home,"protected-revisions"),witness,new File(witness+".bak"),new File(witness+".new")}){
            try{Files.readAttributes(path.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);return true;}
            catch(NoSuchFileException absent){}
        }return false;
    }
    private JSONObject hold(String hash,boolean forceVerify)throws Exception{
        File path=file(hash);safe(path);
        safe(new File(path+".bak"));safe(new File(path+".new"));
        java.nio.file.attribute.BasicFileAttributes attrs=null;
        try{attrs=Files.readAttributes(path.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}catch(NoSuchFileException absent){}
        CachedHold known=VERIFIED.get(path.getAbsolutePath());
        if(!forceVerify&&attrs!=null&&known!=null&&known.matches(attrs)&&!new File(path+".bak").exists()&&!new File(path+".new").exists()){countDebug(1);return known.summary;}
        countDebug(2);
        File pending=new File(path+".new");boolean staged=!exists(path)&&pending.exists();byte[] bytes;
        if(staged){safe(pending);if(pending.length()>3L*LocalDatabase.MAX_BYTES)throw new IOException("Příliš velký nedokončený hold");bytes=Files.readAllBytes(pending.toPath());}
        else bytes=read(path);
        if(!hash.equals(PeerWire.hash(bytes)))throw new IOException("Poškozená chráněná revize");
        String text=JsonInput.decode(bytes,3*LocalDatabase.MAX_BYTES);JsonInput.check(text,3*LocalDatabase.MAX_BYTES);JSONObject hold=new JSONObject(text);
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
            long size=PeerSnapshot.integer(entry,"size",PeerSnapshot.MAX_MEDIA);boolean missing="MISSING".equals(entry.optString("state"));
            if(missing&&"snapshot".equals(hold.getString("kind")))throw new IOException("Přenosová ochrana nesmí předstírat úplnost");
            boolean digest=entry.getString("hash").matches("[a-f0-9]{64}");
            if(!PeerSnapshot.validMediaId(id)||!ids.add(id)||!(digest&&size>0||missing&&size==0&&entry.getString("hash").isEmpty())||!PeerSnapshot.validMime(entry.getString("mime"))||entry.getString("name").length()>256)throw new IOException("Poškozený pin originálu");
        }
        Set<String> required="snapshot".equals(hold.getString("kind"))?PeerSnapshot.references(data.getJSONArray("records")):PeerSnapshot.cleanupReferences(data.getJSONArray("records"));
        if(!ids.containsAll(required))throw new IOException("Neúplná ochrana příloh");
        if(staged)write(path,bytes); // finish a fully verified interrupted local hold, never a DB promotion
        hold.remove("metadata");JSONObject lookup=new JSONObject();for(int i=0;i<media.length();i++){JSONObject entry=media.getJSONObject(i);lookup.put(entry.getString("id"),entry);}hold.put("_ids",lookup);
        attrs=Files.readAttributes(path.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        // Sorted inventory scans churn a small LRU when history exceeds its
        // capacity. Keep room for typical histories, and bound retained media
        // summaries separately. Larger holds still receive full verification.
        if(media.length()<=256){
            VERIFIED.put(path.getAbsolutePath(),new CachedHold(attrs,hold));
            while(VERIFIED.size()>128)VERIFIED.remove(VERIFIED.keySet().iterator().next());
        }else VERIFIED.remove(path.getAbsolutePath());
        return hold;
    }
    /** Repair the union after a crash between the two catalog commits.
     * An orphan valid hold adds protection; a missing/corrupt indexed hold blocks cleanup.
     * No historical manifest is ever pruned, even after epoch/namespace changes.
     */
    private Map<String,JSONObject> inventory(boolean repair)throws Exception{return inventory(repair,false);}
    // Fast metadata cache for routine immutable-history scans; destructive
    // operations explicitly bypass it and verify every hold's bytes.
    private Map<String,JSONObject> inventory(boolean repair,boolean forceVerify)throws Exception{
        if(BuildConfig.DEBUG)android.os.Trace.beginSection("Z195-revision-inventory");
        try{
        if(Files.isSymbolicLink(home.toPath())||Files.isSymbolicLink(new File(home,"media").toPath())||Files.isSymbolicLink(directory.toPath())||directory.exists()&&!directory.isDirectory()||Files.isSymbolicLink(witness.getParentFile().toPath()))throw new IOException("Neplatné úložiště ochrany");
        File index=new File(directory,"catalog.json");Set<String> local=catalog(index),other=catalog(witness),ids=new TreeSet<>(local);ids.addAll(other);
        File[] files=directory.listFiles();if(files==null&&directory.exists())throw new IOException("Registr ochrany nelze načíst");
        // Both missing catalogs cannot distinguish first-write interruption
        // from selective loss of older holds. Do not invent an empty registry.
        if(files!=null&&files.length>0&&!exists(index)&&!exists(witness))throw new IOException("Oba doklady ochrany chybí; původní data vyžadují ruční prověření");
        if(files!=null)for(File f:files){
            safe(f);
            String name=f.getName();
            if(name.matches("[a-f0-9]{64}\\.json(\\.bak|\\.new)?"))ids.add(name.substring(0,64));
            else if(!name.matches("catalog\\.json(\\.bak|\\.new)?"))throw new IOException("Neznámý soubor ochrany");
        }
        if(BuildConfig.DEBUG){int[] debug=DEBUG_COUNTS.get();if(debug!=null)debug[0]=ids.size();}
        Map<String,JSONObject> result=new TreeMap<>();for(String id:ids)result.put(id,hold(id,forceVerify));
        if(repair&&!ids.isEmpty()&&(!local.equals(ids)||!other.equals(ids)))saveCatalog(ids);
        return result;
        }finally{if(BuildConfig.DEBUG)android.os.Trace.endSection();}
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
    /** Rehash all hold files before irreversible cleanup. A metadata-only
     * fingerprint is not proof against an in-place modification with restored
     * size/mtime/inode. Keep routine save/drawing scans fast.
     */
    Set<String> pinsForCleanup()throws IOException{synchronized(TrashPurger.LOCK){try{
        Set<String> ids=new TreeSet<>();for(JSONObject hold:inventory(true,true).values()){
            JSONArray list=hold.getJSONArray("media");
            for(int i=0;i<list.length();i++)ids.add(list.getJSONObject(i).getString("id"));
        }return ids;
    }catch(Exception e){throw blocked(e);}}}
    boolean hasSnapshot(String source)throws IOException{synchronized(TrashPurger.LOCK){try{
        for(JSONObject hold:inventory(true).values())if("snapshot".equals(hold.getString("kind"))&&source.equals(hold.getString("sourceHash")))return true;
        return false;
    }catch(Exception e){throw blocked(e);}}}
    private boolean pinned(String id)throws IOException{synchronized(TrashPurger.LOCK){try{
        for(JSONObject hold:inventory(true,true).values())if(hold.getJSONObject("_ids").has(id))return true;
        return false;
    }catch(Exception e){throw blocked(e);}}}
    JSONObject status()throws IOException{synchronized(TrashPurger.LOCK){try{
        Map<String,JSONObject> holds=inventory(false);Map<String,Long> sizes=new HashMap<>();long metadata=0;int incomplete=0;
        for(Map.Entry<String,JSONObject> item:holds.entrySet()){
            if(!item.getValue().optBoolean("sourceComplete",true))incomplete++;
            metadata+=file(item.getKey()).length();JSONArray list=item.getValue().getJSONArray("media");
            for(int i=0;i<list.length();i++){JSONObject entry=list.getJSONObject(i);File original=new File(home,"media/"+entry.getString("id"));sizes.put(entry.getString("id"),original.isFile()?original.length():0);}
        }
        long total=0;int missing=0;for(long size:sizes.values()){total+=size;if(size==0)missing++;}
        return new JSONObject().put("revisions",holds.size()).put("incomplete",incomplete).put("missingMedia",missing).put("media",sizes.size()).put("mediaBytes",total).put("metadataBytes",metadata).put("message",WARNING+(incomplete>0||missing>0?" Některé podklady nemají všechny přílohy; jejich přesná metadata zůstávají důkazem, nikoli úplnou zálohou.":""));
    }catch(Exception e){throw blocked(e);}}}
    void preserveDatabase(String metadata)throws IOException{
        if(metadata==null||metadata.isEmpty())return;
        preserve("database",metadata,null);
    }
    void preserveSnapshot(PeerSnapshot snapshot)throws IOException{preserve("snapshot",new String(snapshot.bytes,StandardCharsets.UTF_8),snapshot);}
    /** Exact preimages from the ONE P1 registry; no new retention policy or automatic release. */
    interface RevisionConsumer {void add(String hash,String metadata,Set<String> media)throws Exception;}
    void databaseRevisions(JSONObject current,RevisionConsumer consumer)throws Exception{synchronized(TrashPurger.LOCK){
        Set<String> seen=new HashSet<>();String currentCanonical=CausalClock.canonical(current);
        for(Map.Entry<String,JSONObject> item:inventory(false).entrySet()){
            JSONObject summary=item.getValue();if(!"database".equals(summary.getString("kind")))continue;
            byte[] held=read(file(item.getKey()));if(!item.getKey().equals(PeerWire.hash(held)))throw new IOException("Chráněná historie se změnila");
            JSONObject full=new JSONObject(JsonInput.decode(held,3*LocalDatabase.MAX_BYTES));
            String text=full.getString("metadata");JSONObject data=new JSONObject(text);
            // Empty bootstrap and the present state are already carried by the main snapshot.
            if(data.getJSONArray("records").length()==0&&!data.has("syncTombstones"))continue;
            data.remove("prefs");data.remove("created");data.put("syncProtocol",2);
            if(CausalClock.canonical(data).equals(currentCanonical))continue;
            String hash=PeerWire.hash(text.getBytes(StandardCharsets.UTF_8));
            Set<String> media=new TreeSet<>();JSONArray refs=full.getJSONArray("media");for(int i=0;i<refs.length();i++)media.add(refs.getJSONObject(i).getString("id"));
            if(seen.add(hash))consumer.add(hash,text,media);
        }
    }}
    private void historicalReferences(Object value,Set<String> ids,int depth)throws Exception{
        if(depth>100)throw new IOException("Příliš zanořená historie ochrany");
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;for(Iterator<String> it=object.keys();it.hasNext();)historicalReferences(object.get(it.next()),ids,depth+1);}
        else if(value instanceof JSONArray){JSONArray list=(JSONArray)value;for(int i=0;i<list.length();i++)historicalReferences(list.get(i),ids,depth+1);}
        else if(value instanceof String){
            String text=(String)value;
            if(PeerSnapshot.validMediaId(text)&&new File(home,"media/"+text).exists())ids.add(text);
            String trimmed=text.trim();if(!trimmed.startsWith("[")&&!trimmed.startsWith("{"))return;
            Object parsed;
            try{JsonInput.check(text);parsed=trimmed.startsWith("[")?new JSONArray(text):new JSONObject(text);}
            catch(JSONException|IOException freeText){
                // A normal note may start with an unfinished brace. Keep all
                // existing originals in this uncertain case; never reject or
                // silently reinterpret the user's exact text as a broken note.
                File media=new File(home,"media");File[] files=media.listFiles();
                if(files==null&&media.exists())throw new IOException("Přílohy nelze prověřit");
                if(files!=null)for(File f:files)if(PeerSnapshot.validMediaId(f.getName()))ids.add(f.getName());
                return;
            }
            ids.addAll(PeerSnapshot.cleanupReferences(parsed));historicalReferences(parsed,ids,depth+1);
        }
    }
    private void preserve(String kind,String metadata,PeerSnapshot snapshot)throws IOException{synchronized(TrashPurger.LOCK){try{
        Map<String,JSONObject> prior=inventory(true);String source=PeerWire.hash(metadata.getBytes(StandardCharsets.UTF_8));
        // Reusing an existing protection preimage must reverify that exact
        // hold's bytes. Otherwise a forged unchanged size/mtime/fileKey could
        // let a stale cached summary silently skip durable protection.
        // Hash only the matching hold, not all historical holds on each save.
        for(Map.Entry<String,JSONObject> previous:prior.entrySet()){
            JSONObject old=previous.getValue();
            if(kind.equals(old.getString("kind"))&&source.equals(old.getString("sourceHash"))){
                hold(previous.getKey(),true); // fail closed on corrupt identical preimage
                return;
            }
        }
        JSONObject data=new JSONObject(metadata);if(snapshot!=null)data=data.getJSONObject("data");LocalDatabase.validate(data.toString());
        Set<String> ids=snapshot==null?PeerSnapshot.cleanupReferences(data.getJSONArray("records")):new TreeSet<>(snapshot.media.keySet());
        // Also include older embedded JSON objects and unknown history fields.
        historicalReferences(data.getJSONArray("records"),ids,0);
        boolean complete=true;JSONArray media=new JSONArray();for(String id:ids){
            File original=new File(home,"media/"+id);boolean missing=snapshot==null&&Files.notExists(original.toPath(),LinkOption.NOFOLLOW_LINKS);
            JSONObject entry;
            if(missing){
                complete=false;entry=new JSONObject().put("hash","").put("size",0).put("state","MISSING");
                for(JSONObject old:prior.values()){
                    JSONObject known=old.getJSONObject("_ids").optJSONObject(id);
                    if(known!=null&&!known.getString("hash").isEmpty()){entry.put("hash",known.getString("hash")).put("size",known.getLong("size"));break;}
                }
            }else{countDebug(3);entry=ImmutableMediaProof.inspect(original).put("state","VERIFIED");}
            for(JSONObject old:prior.values()){
                JSONObject pinned=old.getJSONObject("_ids").optJSONObject(id);
                if(pinned!=null&&!pinned.getString("hash").isEmpty()&&!missing&&(pinned.getLong("size")!=entry.getLong("size")||!pinned.getString("hash").equals(entry.getString("hash"))))
                    throw new IOException("Chráněný originál má jiný obsah. Původní revize zůstává chráněná; operace byla zastavena.");
            }
            JSONObject expected=snapshot==null?null:snapshot.media.get(id);
            if(expected!=null&&(entry.getLong("size")!=expected.getLong("size")||!entry.getString("hash").equals(expected.getString("hash"))))throw new IOException("Originál se před založením ochrany změnil");
            String mime=prefs==null?"application/octet-stream":prefs.getString("mime-"+id,"application/octet-stream");
            String name=prefs==null?"Příloha":prefs.getString("name-"+id,"Příloha");
            if(!MediaStaging.metadata(mime,name))throw new IOException("Neplatná metadata originálu");
            media.put(entry.put("id",id).put("mime",expected==null?mime:expected.getString("mime")).put("name",expected==null?name:expected.getString("name")));
        }
        if(new File(home,"media").isDirectory())syncDirectory(new File(home,"media"));
        JSONObject revision=new JSONObject().put("format","cz.zamerovac.protected.revision").put("version",1).put("kind",kind).put("sourceHash",source).put("epoch",DatabaseRecovery.id(home)).put("metadata",metadata).put("media",media).put("sourceComplete",complete);
        byte[] bytes=revision.toString().getBytes(StandardCharsets.UTF_8);String hash=PeerWire.hash(bytes);
        // Reserve is a preflight only; every failed/short write is still verified.
        if(home.getUsableSpace()<bytes.length*3L+1024*1024)throw new IOException("Nedostatek místa pro ochranu původních dat");
        write(file(hash),bytes);hold(hash,false);Set<String> all=new TreeSet<>(prior.keySet());all.add(hash);saveCatalog(all);
    }catch(Exception e){throw blocked(e);}}}

    /** Fail-closed check for an ordinary media-stable save. This does not
     * release ANY old hold, does not approve a sync ACK, and never weakens
     * the destructive full-hash inventory used by purge/restore/media ingest.
     * Caller holds TrashPurger.LOCK and has already validated all DB strings.
     */
    boolean canUseOnePlusOne(String confirmed,String previous,String proposed){
        if(confirmed==null||confirmed.isEmpty()||proposed==null||previous==null)
            return false; // first write or missing backup: establish full evidence
        try{
            // Reject ambiguous input before comparing any media references.
            // JS snapshots contain exact decimal strings; canonicalization
            // checks syntax/duplicate keys but is NOT persisted.
            new org.erdtman.jcs.JsonCanonicalizer(confirmed);
            new org.erdtman.jcs.JsonCanonicalizer(previous);
            new org.erdtman.jcs.JsonCanonicalizer(proposed);
            Set<String> oldRefs=referencedOriginals(confirmed);
            if(!oldRefs.equals(referencedOriginals(previous))
                    ||!oldRefs.equals(referencedOriginals(proposed)))return false;
            // Deleted records/tombstones need their exact prior state protected.
            JSONObject before=new JSONObject(confirmed),after=new JSONObject(proposed);
            if(!CausalClock.canonical(before.opt("syncTombstones"))
                    .equals(CausalClock.canonical(after.opt("syncTombstones")))
                ||!CausalClock.canonical(before.opt("trashPurgedIds"))
                    .equals(CausalClock.canonical(after.opt("trashPurgedIds"))))
                return false;
            String key=home.getAbsolutePath();
            MediaCoverage cached=MEDIA_COVERAGE.get(key);
            if(cached!=null&&cached.matches(this,oldRefs))return true;

            Map<String,JSONObject> holds=inventory(true);
            if(holds.isEmpty())return false; // missing P1 initialization
            Map<String,JSONObject> pins=new TreeMap<>();
            for(JSONObject hold:holds.values()){
                JSONObject listed=hold.getJSONObject("_ids");
                for(Iterator<String> it=listed.keys();it.hasNext();){
                    String id=it.next();JSONObject entry=listed.getJSONObject(id);
                    if(entry.getString("hash").isEmpty())continue; // not a proof
                    JSONObject prior=pins.putIfAbsent(id,entry);
                    if(prior!=null&&(!prior.getString("hash").equals(entry.getString("hash"))
                            ||prior.getLong("size")!=entry.getLong("size")))
                        return false; // contradictory historical original pins
                }
            }
            Map<String,FileStamp> originals=new TreeMap<>();
            for(String id:oldRefs){
                JSONObject pin=pins.get(id);
                if(pin==null)return false;
                File source=new File(home,"media/"+id);
                FileStamp stamp=new FileStamp(source,false);
                JSONObject proof=ImmutableMediaProof.inspect(source);
                if(proof.getLong("size")!=pin.getLong("size")
                        ||!proof.getString("hash").equals(pin.getString("hash")))
                    return false;
                originals.put(id,stamp);
            }
            MediaCoverage verified=new MediaCoverage(oldRefs,
                new FileStamp(new File(directory,"catalog.json"),false),
                new FileStamp(witness,false),new FileStamp(directory,true),originals);
            MEDIA_COVERAGE.put(key,verified);
            while(MEDIA_COVERAGE.size()>4)
                MEDIA_COVERAGE.remove(MEDIA_COVERAGE.keySet().iterator().next());
            return true;
        }catch(Exception uncertain){
            MEDIA_COVERAGE.remove(home.getAbsolutePath());
            return false;
        }
    }

    private Set<String> referencedOriginals(String text)throws Exception {
        JSONObject db=new JSONObject(text);
        JSONArray records=db.getJSONArray("records");
        Set<String> ids=PeerSnapshot.cleanupReferences(records);
        historicalReferences(records,ids,0);
        return ids;
    }

    static void forgetMediaCoverage(File home){
        MEDIA_COVERAGE.remove(home.getAbsolutePath());
    }

    /** A missing pinned original must never be silently re-created under the same ID. */
    static void requireUnpinned(File original)throws IOException{
        File home=original.getParentFile().getParentFile();
        if(new ProtectedRevisions(home,null,null).pinned(original.getName()))throw new IOException("Příloha je chráněná. Původní identifikátor se nesmí přepsat ani znovu použít.");
    }
    /** A verified incoming stream may repair a missing original only when every
     * durable pin proves exactly those bytes. This grants no database authority.
     */
    static void verifyRestoration(File original,JSONObject expected)throws IOException{synchronized(TrashPurger.LOCK){
        ProtectedRevisions protection=new ProtectedRevisions(original.getParentFile().getParentFile(),null,null);
        try{
            for(JSONObject hold:protection.inventory(true,true).values()){
                JSONObject pin=hold.getJSONObject("_ids").optJSONObject(original.getName());if(pin==null)continue;
                if(pin.getString("hash").isEmpty()||!pin.getString("hash").equals(expected.getString("hash"))||pin.getLong("size")!=expected.getLong("size"))
                    throw new IOException("Přijímaná příloha neodpovídá chráněnému originálu; obnova byla zastavena.");
            }
        }catch(Exception e){throw protection.blocked(e);}
    }}
    /** Rollback is best effort: uncertainty leaves the original and its metadata intact. */
    static boolean rollback(File original){synchronized(TrashPurger.LOCK){try{
        requireUnpinned(original);File home=original.getParentFile().getParentFile();
        String saved=LocalDatabase.readForCas(home);
        if(!saved.isEmpty()&&TrashPurger.referenceStrings(new JSONObject(saved)).contains(original.getName()))return false;
        return !original.exists()||original.delete();
    }catch(Exception e){android.util.Log.w("Zamerovac","Rollback ponechal původní přílohu: "+original.getName());return false;}}}
}
