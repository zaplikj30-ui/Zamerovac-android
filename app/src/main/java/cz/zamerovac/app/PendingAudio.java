package cz.zamerovac.app;

import android.content.SharedPreferences;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.channels.FileChannel;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;
import java.util.regex.*;

/** Non-destructive audio journal. Inventory, repair and binding own the local I/O lock.
 * Explicit copies stream outside that lock, checking retained source identity and size.
 * Each capture has its own AtomicFile: damage to one entry cannot hide the others. Audio files
 * are never deleted here. Unknown/corrupt evidence stays on disk and is reported, not reset.
 */
final class PendingAudio {
    interface Checkpoint { void check(String step) throws IOException; }
    private final File media, ledger;
    private final SharedPreferences prefs;
    private final Checkpoint checkpoint;
    private static final Set<String> ACTIVE = new HashSet<>();
    private static final Pattern TEMP = Pattern.compile("\\.audio-([a-zA-Z0-9_-]{3,120})--([a-f0-9-]{36})\\.tmp");
    private static final String NAME = "Hlasová poznámka.m4a";
    PendingAudio(File media, SharedPreferences prefs) { this(media,prefs,step->{}); }
    PendingAudio(File media, SharedPreferences prefs, Checkpoint checkpoint) {
        this.media=media.getAbsoluteFile();this.ledger=new File(this.media.getParentFile(),"pending-audio-v1");
        this.prefs=prefs;this.checkpoint=checkpoint;
    }
    static boolean validId(String id) { return id!=null&&id.matches("[a-zA-Z0-9_-]{3,120}"); }
    private static void directory(File dir) throws IOException {
        Path path=dir.toPath().toAbsolutePath();
        for(Path p=path;p!=null;p=p.getParent())if(Files.isSymbolicLink(p))throw new IOException("Unsafe audio directory");
        if(!dir.isDirectory()){
            if(!dir.mkdirs())throw new IOException("Audio directory unavailable");
            if(dir.getParentFile()!=null)syncDirectory(dir.getParentFile());
        }
    }
    private File safe(File dir,String name) throws IOException {
        directory(dir);
        if(name==null||name.contains("/")||name.contains("\\")||name.equals(".")||name.equals(".."))throw new IOException("Unsafe audio path");
        File file=new File(dir,name);
        if(Files.isSymbolicLink(file.toPath())||!file.getCanonicalFile().getParentFile().equals(dir.getCanonicalFile()))throw new IOException("Unsafe audio link");
        return file;
    }
    private File entryFile(String token) throws IOException {
        if(token==null||!token.matches("[a-f0-9-]{36}"))throw new IOException("Invalid capture token");
        return safe(ledger,token+".json");
    }
    private static void syncDirectory(File dir) throws IOException {
        // Linux/Android internal filesystem. Unsupported directory sync is an error, never a PASS.
        try(FileChannel channel=FileChannel.open(dir.toPath(),StandardOpenOption.READ)){channel.force(true);}
    }
    private static String hash(byte[] bytes) throws Exception {
        return ArchiveIntegrity.hex(MessageDigest.getInstance("SHA-256").digest(bytes));
    }
    private JSONObject read(String token) throws Exception {return read(token,true);}
    private JSONObject read(String token,boolean repair) throws Exception {
        File file=entryFile(token);
        safe(ledger,file.getName()+".bak");safe(ledger,file.getName()+".new");
        for(String suffix:new String[]{"",".bak",".new"}){File part=new File(file+suffix);if(part.exists()&&(!part.isFile()||part.length()>16384))throw new IOException("Invalid audio journal size");}
        // A .new is unconfirmed evidence. AtomicFile.openRead may discard it when a
        // base exists; leave it intact and require review instead of silently losing it.
        if(new File(file+".new").exists())throw new IOException("Unconfirmed audio journal write");
        byte[] bytes=repair?new AtomicFile(file).readFully():Files.readAllBytes(new File(file+".bak").isFile()?new File(file+".bak").toPath():file.toPath());
        if(bytes.length>16384)throw new IOException("Invalid audio journal size");
        JSONObject envelope=new JSONObject(JsonInput.decode(bytes));
        String payload=envelope.getString("payload");
        if(!hash(payload.getBytes(StandardCharsets.UTF_8)).equals(envelope.getString("sha256")))throw new IOException("Audio journal checksum mismatch");
        JsonInput.check(payload);JSONObject e=new JSONObject(payload);
        if(e.getInt("version")!=1||!token.equals(e.getString("token"))||!validId(e.getString("id")))throw new IOException("Unsupported audio journal");
        Matcher temp=TEMP.matcher(e.getString("temporary"));
        if(!temp.matches()||!temp.group(1).equals(e.getString("id"))||!temp.group(2).equals(token))throw new IOException("Invalid audio journal path");
        if(!Arrays.asList("recording","pending","bound","needs-review").contains(e.getString("state")))throw new IOException("Invalid audio state");
        if(e.getLong("createdAt")<0)throw new IOException("Invalid capture time");
        if(e.getBoolean("completed")&&(e.getLong("size")<1||e.getLong("size")>MediaStaging.LIMIT||!e.getString("hash").matches("[a-f0-9]{64}")))throw new IOException("Invalid completed audio evidence");
        return e;
    }
    private void write(JSONObject entry) throws Exception {
        String token=entry.getString("token");File target=entryFile(token);
        safe(ledger,target.getName()+".bak");safe(ledger,target.getName()+".new");
        String payload=entry.toString();byte[] bytes=new JSONObject().put("payload",payload).put("sha256",hash(payload.getBytes(StandardCharsets.UTF_8))).toString().getBytes(StandardCharsets.UTF_8);
        checkpoint.check("before-ledger");
        AtomicFile atomic=new AtomicFile(target);FileOutputStream out=null;
        try {
            out=atomic.startWrite();out.write(bytes);checkpoint.check("ledger-sync");out.getFD().sync();
            atomic.finishWrite(out);out=null;syncDirectory(ledger);
            if(!Arrays.equals(atomic.readFully(),bytes))throw new IOException("Audio journal write not confirmed");
        } catch(Exception error) { if(out!=null)atomic.failWrite(out);throw error; }
        checkpoint.check("after-ledger");
    }
    JSONObject begin(String id) throws Exception {
        synchronized(TrashPurger.LOCK){
            if(!validId(id))throw new IOException("Invalid audio ID");
            File target=safe(media,id);
            if(target.exists())throw new IOException("Existing audio must not be replaced");
            // Reserve IDs across capture instances as well as restarts and uncertain sessions.
            File[] previous=media.listFiles();if(previous==null)throw new IOException("Cannot inspect audio storage");
            for(File f:previous){Matcher m=TEMP.matcher(f.getName());if(m.matches()&&id.equals(m.group(1)))throw new IOException("Audio ID already reserved");}
            String token=UUID.randomUUID().toString(),name=".audio-"+id+"--"+token+".tmp";
            File evidence=entryFile(token);
            if(evidence.exists()||new File(evidence+".bak").exists()||new File(evidence+".new").exists())throw new IOException("Capture token collision");
            JSONObject e=new JSONObject().put("version",1).put("token",token).put("id",id).put("temporary",name)
                .put("state","recording").put("completed",false).put("createdAt",System.currentTimeMillis());
            // A file created before a failed journal write is discoverable by its reserved name.
            if(!safe(media,name).createNewFile())throw new IOException("Cannot reserve capture");
            syncDirectory(media);write(e);ACTIVE.add(token);return e;
        }
    }
    File temporary(JSONObject entry) throws Exception {return safe(media,entry.getString("temporary"));}
    void abandon(JSONObject entry) {
        if(entry==null)return;
        synchronized(TrashPurger.LOCK){
            ACTIVE.remove(entry.optString("token"));
            try {JSONObject e=read(entry.getString("token"));if(!e.getBoolean("completed")){e.put("state","needs-review");write(e);}}catch(Exception ignored){/* KEEP; discovery reports the uncertainty. */}
        }
    }
    void complete(JSONObject entry) throws Exception {
        synchronized(TrashPurger.LOCK){
            File file=temporary(entry);
            checkpoint.check("audio-sync");
            if(!file.isFile()||file.length()<1||file.length()>MediaStaging.LIMIT)throw new IOException("Incomplete audio");
            try(RandomAccessFile out=new RandomAccessFile(file,"rw")){out.getFD().sync();}
            JSONObject digest=PeerMedia.inspect(file);
            entry.put("size",digest.getLong("size")).put("hash",digest.getString("hash")).put("completed",true).put("state","pending");
            write(entry); // Must be verified BEFORE publication. Failure leaves the source untouched.
            checkpoint.check("after-complete");publish(entry);
        }
    }
    private boolean matches(File file,JSONObject e) throws Exception {
        if(!file.isFile())return false;
        checkpoint.check("hash-media");JSONObject digest=PeerMedia.inspect(file);
        return digest.getLong("size")==e.getLong("size")&&digest.getString("hash").equals(e.getString("hash"));
    }
    private void publish(JSONObject e) throws Exception {
        File source=temporary(e),target=safe(media,e.getString("id"));
        if(target.exists()){
            // Both copies exist => collision, even if identical. Do not adopt someone else's ID.
            if(source.exists()||!matches(target,e))throw new IOException("Audio publication collision");
        }else{
            if(!matches(source,e))throw new IOException("Audio original failed verification");
            checkpoint.check("before-move");
            // Same-filesystem atomic hard-link publication is CREATE_NEW (rename ATOMIC_MOVE may
            // silently overwrite on Linux). Keep the source link permanently in this no-GC phase.
            MediaStaging.publishAudio(source,target);syncDirectory(media);
            checkpoint.check("after-move");
        }
        if(!matches(target,e))throw new IOException("Published audio changed");
        checkpoint.check("before-metadata");
        if(!prefs.edit().putString("mime-"+e.getString("id"),"audio/mp4").putString("name-"+e.getString("id"),NAME).commit())throw new IOException("Audio metadata not confirmed");
        checkpoint.check("after-metadata");
    }
    private boolean ownPublished(JSONObject e) throws Exception {
        File source=temporary(e),target=safe(media,e.getString("id"));
        return source.exists()&&target.exists()&&Files.isSameFile(source.toPath(),target.toPath())&&matches(target,e);
    }
    private void resume(JSONObject e) throws Exception {
        if(!ownPublished(e)){publish(e);return;}
        // SharedPreferences updates its in-memory map even when commit() returns false.
        // Reading the same values is not proof of a durable write; explicitly retry commit.
        if(!prefs.edit().putString("mime-"+e.getString("id"),"audio/mp4").putString("name-"+e.getString("id"),NAME).commit())throw new IOException("Audio metadata not confirmed");
    }
    /** Listing failures quarantine automatic repair, never the independently discoverable originals. */
    private static final class Inventory {
        final Set<String> tokens=new TreeSet<>(),ambiguous=new HashSet<>();
        final Map<String,JSONObject> entries=new TreeMap<>();
        final Map<String,List<File>> sources=new TreeMap<>();
        final List<File> mediaFiles=new ArrayList<>();
        boolean uncertain;
    }
    private Inventory inventory() {
        Inventory found=new Inventory();
        try{
            directory(ledger);File[] files=ledger.listFiles();if(files==null)throw new IOException("Cannot list audio journal");
            for(File file:files){String name=file.getName();
                if(name.matches("[a-f0-9-]{36}\\.json(\\.bak|\\.new)?"))found.tokens.add(name.substring(0,36));
                else found.uncertain=true; // Preserve unknown evidence, including directories/links.
            }
        }catch(Exception unreadable){found.uncertain=true;}
        try{
            directory(media);File[] files=media.listFiles();if(files==null)throw new IOException("Cannot list audio originals");
            Arrays.sort(files,Comparator.comparing(File::getName));Collections.addAll(found.mediaFiles,files);
            for(File file:files){Matcher m=TEMP.matcher(file.getName());if(m.matches()){
                String token=m.group(2);found.tokens.add(token);found.sources.computeIfAbsent(token,k->new ArrayList<>()).add(file);
                if(Files.isSymbolicLink(file.toPath())||!file.isFile())found.uncertain=true;
            }else if(file.getName().startsWith(".audio-"))found.uncertain=true;}
        }catch(Exception unreadable){found.uncertain=true;}
        Map<String,Set<String>> owners=new HashMap<>();
        for(String token:found.tokens){
            try{JSONObject e=read(token,false);found.entries.put(token,e);owners.computeIfAbsent(e.getString("id"),k->new HashSet<>()).add(token);}
            catch(Exception invalid){found.uncertain=true;}
            List<File> sources=found.sources.getOrDefault(token,Collections.emptyList());
            for(File file:sources){Matcher m=TEMP.matcher(file.getName());m.matches();owners.computeIfAbsent(m.group(1),k->new HashSet<>()).add(token);}
            if(sources.size()>1||found.entries.containsKey(token)&&sources.size()==1&&!sources.get(0).getName().equals(found.entries.get(token).optString("temporary")))found.ambiguous.add(token);
        }
        for(Set<String> tokens:owners.values())if(tokens.size()>1)found.ambiguous.addAll(tokens);
        if(!found.ambiguous.isEmpty())found.uncertain=true;
        return found;
    }
    /** Exact current direct binding only; history/trash/backup references never authorize binding or deletion. */
    private static void bindings(JSONArray items,String id,String record,List<String[]> result) throws Exception {
        if(items==null)return;
        for(int i=0;i<items.length();i++){
            JSONObject note=items.optJSONObject(i);if(note==null||note.optBoolean("deleted"))continue;
            if(contains(note.optJSONArray("media"),id)&&contains(note.optJSONArray("audioMedia"),id)&&!note.optString("id").isEmpty())result.add(new String[]{record,note.getString("id")});
            bindings(note.optJSONArray("detailItems"),id,record,result);
        }
    }
    private static boolean contains(JSONArray a,String id){if(a!=null)for(int i=0;i<a.length();i++)if(id.equals(a.optString(i)))return true;return false;}
    private static String[] binding(String durable,String id) throws Exception {
        if(durable==null)return null;LocalDatabase.validate(durable);return binding(new JSONObject(durable),id);
    }
    private static String[] binding(JSONObject db,String id) throws Exception {
        if(db==null)return null;List<String[]> result=new ArrayList<>();JSONArray records=db.getJSONArray("records");
        for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);if(r.optBoolean("deleted"))continue;
            if("note".equals(r.optString("kind"))&&contains(r.optJSONArray("media"),id))result.add(new String[]{r.getString("id"),""});
            bindings(r.optJSONArray("items"),id,r.getString("id"),result);
        }
        return result.size()==1?result.get(0):null;
    }
    private JSONObject reviewSource(File file,String token) throws Exception {
        JSONObject row=new JSONObject().put("state","needs-review").put("available",false).put("attachable",false);
        Matcher m=TEMP.matcher(file.getName());if(m.matches())row.put("id",m.group(1));
        try{File checked=safe(media,file.getName());if(checked.isFile()&&checked.length()<=MediaStaging.LIMIT)row.put("token",token);}catch(IOException unsafe){}
        return row;
    }
    private boolean verifiedFinal(JSONObject e) throws Exception {
        File source=temporary(e),target=safe(media,e.getString("id"));
        if(source.exists()&&!Files.isSameFile(source.toPath(),target.toPath()))return false;
        return matches(target,e);
    }
    JSONArray recover(String durable) throws Exception {
        synchronized(TrashPurger.LOCK){
            Inventory found=inventory();Set<String> knownIds=new HashSet<>();
            for(List<File> files:found.sources.values())for(File file:files){Matcher m=TEMP.matcher(file.getName());m.matches();knownIds.add(m.group(1));}
            JSONObject database=null;Set<String> references=Collections.emptySet();boolean projectUncertain=false;
            if(durable!=null)try{LocalDatabase.validate(durable);database=new JSONObject(durable);references=PeerSnapshot.cleanupReferences(database.getJSONArray("records"));}
            catch(Exception invalid){database=null;projectUncertain=true;}
            boolean automatic=!found.uncertain&&!projectUncertain;
            JSONArray result=new JSONArray();
            for(String token:found.tokens){
                if(ACTIVE.contains(token))continue;
                JSONObject e=found.entries.get(token);
                List<File> sources=found.sources.getOrDefault(token,Collections.emptyList());
                if(e==null||found.ambiguous.contains(token)){
                    for(File file:sources){JSONObject row=reviewSource(file,"source-"+file.getName());if(row.has("token"))result.put(row);}
                    // A missing reservation must not hide the last valid published original.
                    if(e!=null){knownIds.add(e.getString("id"));try{if(!new File(media,e.getString("temporary")).exists()&&matches(safe(media,e.getString("id")),e))
                        result.put(new JSONObject().put("id",e.getString("id")).put("token","legacy-"+e.getString("id")).put("state","needs-review").put("available",true).put("attachable",false));}catch(Exception ignored){}}
                    continue;
                }
                knownIds.add(e.getString("id"));boolean available=false;
                if(e.getBoolean("completed"))try{
                    if(automatic){e=read(token);resume(e);available=true;}
                    else available=verifiedFinal(e); // No publication, metadata writes or binding while quarantined.
                }catch(Exception error){/* KEEP; a failed item must not abort its neighbours. */}
                String state="needs-review";String[] bound=available&&automatic?binding(database,e.getString("id")):null;
                if(bound!=null)state="bound";else if(available)state="pending";
                if(automatic&&(!state.equals(e.getString("state"))||bound!=null&&(!bound[0].equals(e.optString("record"))||!bound[1].equals(e.optString("note"))))){
                    JSONObject next=new JSONObject(e.toString()).put("state",state);
                    if(bound!=null)next.put("record",bound[0]).put("note",bound[1]);
                    try{write(next);e=next;}catch(Exception failure){state="needs-review";}
                }
                if(!"bound".equals(state)){
                    JSONObject row=new JSONObject().put("id",e.getString("id")).put("state",state).put("available",available).put("attachable",available&&automatic).put("createdAt",e.getLong("createdAt"));
                    try{original(token);row.put("token",token);}catch(Exception missing){}
                    result.put(row);
                }
            }
            for(File f:found.mediaFiles)if(f.getName().startsWith(".capture-")&&f.getName().endsWith(".tmp"))result.put(reviewSource(f,"staging-"+f.getName()));
            Set<String> exportable=new HashSet<>();for(int i=0;i<result.length();i++){JSONObject row=result.getJSONObject(i);if(row.has("token")&&row.has("id"))exportable.add(row.getString("id"));}
            for(File f:found.mediaFiles)if(validId(f.getName())&&(!knownIds.contains(f.getName())||!exportable.contains(f.getName()))){
                try{String mime=prefs.getString("mime-"+f.getName(),"");
                    if((knownIds.contains(f.getName())&&!exportable.contains(f.getName())&&found.uncertain)||(mime.startsWith("audio/")&&(found.uncertain||projectUncertain||binding(database,f.getName())==null))||(mime.isEmpty()&&!references.contains(f.getName())))
                        result.put(reviewSource(f,"legacy-"+f.getName()).put("id",f.getName()));
                }catch(Exception invalid){result.put(reviewSource(f,"legacy-"+f.getName()).put("id",f.getName()));}
            }
            if(found.uncertain||projectUncertain)result.put(new JSONObject().put("issue","journal-uncertain").put("state","needs-review").put("available",false).put("attachable",false));
            return result;
        }
    }
    /** Called with the actual primary snapshot under LOCK. No fallback backup may claim bound. */
    JSONArray recoverPrimary() throws Exception {
        synchronized(TrashPurger.LOCK){String durable=null;try{File primary=safe(media.getParentFile(),"projects.json");durable=LocalDatabase.readFile(primary);syncDirectory(media.getParentFile());}catch(IOException ignored){durable=null;}return recover(durable);}
    }
    boolean confirm(String expected,String record,String note,String id) throws Exception {
        synchronized(TrashPurger.LOCK){
            String durable=LocalDatabase.readFile(safe(media.getParentFile(),"projects.json"));syncDirectory(media.getParentFile());
            if(!durable.equals(expected))return false;PeerSnapshot.cleanupReferences(new JSONObject(durable).getJSONArray("records"));String[] bound=binding(durable,id);
            if(bound==null||!bound[0].equals(record)||!bound[1].equals(note))return false;
            Inventory found=inventory();if(found.uncertain)return false;
            for(JSONObject e:found.entries.values())if(id.equals(e.getString("id"))){
                // Confirm only this identity. Unrelated media must not be rehashed N times for N IDs.
                if(!e.getBoolean("completed"))return false;resume(e);
                if(!"bound".equals(e.getString("state"))||!record.equals(e.optString("record"))||!note.equals(e.optString("note")))
                    write(new JSONObject(e.toString()).put("state","bound").put("record",record).put("note",note));
                return true;
            }
            return false;
        }
    }
    /** User-requested export of the retained original, including incomplete/corrupt-ledger cases. */
    File original(String token) throws Exception {
        synchronized(TrashPurger.LOCK){
            if(token!=null&&token.startsWith("staging-")&&token.substring(8).matches("\\.capture-[a-zA-Z0-9_-]{3,120}-[a-f0-9-]{36}\\.tmp")){
                File file=safe(media,token.substring(8));if(!file.isFile()||file.length()>MediaStaging.LIMIT)throw new IOException("Invalid staged original");return file;
            }
            if(token!=null&&token.startsWith("legacy-")&&validId(token.substring(7))){
                File file=safe(media,token.substring(7));if(!file.isFile()||file.length()>MediaStaging.LIMIT)throw new IOException("Invalid legacy original");return file;
            }
            if(token!=null&&token.startsWith("source-")){
                String name=token.substring(7);Matcher m=TEMP.matcher(name);
                if(!m.matches()||ACTIVE.contains(m.group(2)))throw new IOException("Invalid retained source");
                File file=safe(media,name);if(!file.isFile()||file.length()>MediaStaging.LIMIT)throw new IOException("Invalid retained source");return file;
            }
            if(token==null||!token.matches("[a-f0-9-]{36}")||ACTIVE.contains(token))throw new IOException("Audio not available for inspection");
            // A valid ledger identifies the intended file; never choose the first duplicate token.
            JSONObject e=null;try{e=read(token,false);}catch(Exception invalid){}
            if(e!=null){try{File source=temporary(e);if(source.isFile()&&source.length()<=MediaStaging.LIMIT)return source;}catch(IOException unsafe){/* The independently verified final may still be the last valid copy. */}
                File target=safe(media,e.getString("id"));if(e.getBoolean("completed")&&matches(target,e))return target;
            }else{
                directory(media);File[] files=media.listFiles();if(files==null)throw new IOException("Cannot list audio originals");File only=null;
                for(File file:files){Matcher m=TEMP.matcher(file.getName());if(m.matches()&&token.equals(m.group(2))){if(only!=null)throw new IOException("Ambiguous capture token");only=file;}}
                if(only!=null){File checked=safe(media,only.getName());if(checked.isFile()&&checked.length()<=MediaStaging.LIMIT)return checked;}
            }
            throw new IOException("Retained original not found");
        }
    }
    /** Copy a bounded, stable original. Failures never alter the source. */
    interface CopyDestination { OutputStream open() throws IOException; }
    JSONObject copyOriginal(String token,OutputStream output) throws Exception {return copyOriginal(token,()->output);}
    JSONObject copyOriginal(String token,CopyDestination destination) throws Exception {
        File file=original(token);
        java.nio.file.attribute.BasicFileAttributes before=Files.readAttributes(file.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!before.isRegularFile()||before.isSymbolicLink()||before.size()>MediaStaging.LIMIT||before.fileKey()==null)
            throw new IOException("Unverifiable retained source");
        MessageDigest digest=MessageDigest.getInstance("SHA-256");
        long remaining=before.size();byte[] block=new byte[65536];
        try(FileInputStream input=new FileInputStream(file)){
            if(input.getChannel().size()!=before.size())throw new IOException("Retained source changed before copy");
            // Open the source BEFORE a caller-selected destination can be truncated.
            try(OutputStream output=destination.open()){
                if(output==null)throw new IOException("Export destination unavailable");
                while(remaining>0){
                    checkpoint.check("export-read");
                    int n=input.read(block,0,(int)Math.min(block.length,remaining));
                    if(n<0)throw new EOFException("Retained source truncated");
                    if(n==0)throw new IOException("Retained copy stalled");
                    output.write(block,0,n);digest.update(block,0,n);remaining-=n;
                }
                if(input.read()!=-1)throw new IOException("Retained source grew");
                java.nio.file.attribute.BasicFileAttributes after=Files.readAttributes(file.toPath(),java.nio.file.attribute.BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                if(!after.isRegularFile()||after.isSymbolicLink()||!before.fileKey().equals(after.fileKey())||before.size()!=after.size()||!before.lastModifiedTime().equals(after.lastModifiedTime()))
                    throw new IOException("Retained source changed during copy");
                output.flush();
                return new JSONObject().put("size",before.size()).put("sha256",ArchiveIntegrity.hex(digest.digest()));
            } // A failed close also prevents a success acknowledgement.
        }
    }
    Set<String> referencedAudio(Object value) throws Exception {
        Set<String> result=new HashSet<>();referencedAudio(value,result,0);return result;
    }
    private void referencedAudio(Object value,Set<String> result,int depth) throws Exception {
        if(depth>100)throw new IOException("Uncertain audio reference graph");
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;
            JSONArray audio=object.optJSONArray("audioMedia");if(audio!=null)for(int i=0;i<audio.length();i++)if(validId(audio.optString(i)))result.add(audio.getString(i));
            JSONArray files=object.optJSONArray("media");String kind=object.optString("kind");
            if(files!=null&&(kind.equals("audio")||kind.equals("note")))for(int i=0;i<files.length();i++){
                String id=files.optString(i),mime=prefs.getString("mime-"+id,"");
                if(validId(id)&&(kind.equals("audio")||mime.isEmpty()||mime.startsWith("audio/")))result.add(id);
            }
            for(Iterator<String> it=object.keys();it.hasNext();)referencedAudio(object.get(it.next()),result,depth+1);
        }else if(value instanceof JSONArray){JSONArray values=(JSONArray)value;for(int i=0;i<values.length();i++)referencedAudio(values.get(i),result,depth+1);
        }else if(value instanceof String){String text=((String)value).trim();
            if(text.startsWith("[")||text.startsWith("{")){JsonInput.check(text);referencedAudio(text.startsWith("[")?new JSONArray(text):new JSONObject(text),result,depth+1);}
        }
    }
    /** Retention guard for existing trash cleanup. Unreadable evidence protects every candidate. */
    boolean protects(String id) {
        synchronized(TrashPurger.LOCK){
            try{
                String mime=prefs.getString("mime-"+id,"");
                if(mime.startsWith("audio/"))return true;
                Inventory found=inventory();if(found.uncertain)return true;
                for(JSONObject e:found.entries.values())if(id.equals(e.getString("id")))return true;
                File[] files=media.listFiles();if(files!=null)for(File file:files){Matcher m=TEMP.matcher(file.getName());if(m.matches()&&id.equals(m.group(1)))return true;if(file.getName().startsWith(".capture-"+id+"-"))return true;}
                return false;
            }catch(Exception uncertainty){return true;}
        }
    }
}
