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

/** Non-destructive audio journal. Every operation, including read/repair, owns the local I/O lock.
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
    private JSONObject read(String token) throws Exception {
        File file=entryFile(token);
        safe(ledger,file.getName()+".bak");safe(ledger,file.getName()+".new");
        for(String suffix:new String[]{"",".bak",".new"}){File part=new File(file+suffix);if(part.exists()&&(!part.isFile()||part.length()>16384))throw new IOException("Invalid audio journal size");}
        // A .new is unconfirmed evidence. AtomicFile.openRead may discard it when a
        // base exists; leave it intact and require review instead of silently losing it.
        if(new File(file+".new").exists())throw new IOException("Unconfirmed audio journal write");
        byte[] bytes=new AtomicFile(file).readFully();
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
        JSONObject digest=PeerMedia.inspect(file);
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
    private Set<String> tokens() throws IOException {
        directory(ledger);Set<String> result=new TreeSet<>();File[] files=ledger.listFiles();
        if(files==null)throw new IOException("Cannot list audio journal");
        for(File f:files){String n=f.getName();if(!n.matches("[a-f0-9-]{36}\\.json(\\.bak|\\.new)?"))throw new IOException("Unknown audio journal evidence");result.add(n.substring(0,36));}
        return result;
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
        if(durable==null)return null;LocalDatabase.validate(durable);JSONObject db=new JSONObject(durable);List<String[]> result=new ArrayList<>();JSONArray records=db.getJSONArray("records");
        for(int i=0;i<records.length();i++){JSONObject r=records.getJSONObject(i);if(r.optBoolean("deleted"))continue;
            if("note".equals(r.optString("kind"))&&contains(r.optJSONArray("media"),id))result.add(new String[]{r.getString("id"),""});
            bindings(r.optJSONArray("items"),id,r.getString("id"),result);
        }
        return result.size()==1?result.get(0):null;
    }
    JSONArray recover(String durable) throws Exception {
        synchronized(TrashPurger.LOCK){
            Set<String> tokens=tokens();Set<String> knownIds=new HashSet<>();File[] files=media.listFiles();if(files==null&&media.exists())throw new IOException("Cannot list audio originals");
            if(files!=null)for(File f:files){Matcher m=TEMP.matcher(f.getName());if(m.matches()){tokens.add(m.group(2));knownIds.add(m.group(1));}}
            JSONArray result=new JSONArray();
            for(String token:tokens){
                if(ACTIVE.contains(token))continue;
                JSONObject e;
                try{e=read(token);}catch(Exception invalid){result.put(new JSONObject().put("token",token).put("state","needs-review").put("available",false));continue;}
                knownIds.add(e.getString("id"));
                boolean available=false;
                if(e.getBoolean("completed")){
                    try{resume(e);available=true;}catch(Exception error){/* KEEP both source and evidence. */}
                }
                String state="needs-review";String[] bound=available?binding(durable,e.getString("id")):null;
                if(bound!=null)state="bound";else if(available)state="pending";
                if(!state.equals(e.getString("state"))||bound!=null&&(!bound[0].equals(e.optString("record"))||!bound[1].equals(e.optString("note")))){
                    JSONObject next=new JSONObject(e.toString()).put("state",state);
                    if(bound!=null)next.put("record",bound[0]).put("note",bound[1]);
                    try{write(next);e=next;}catch(Exception failure){state="needs-review";}
                }
                if(!"bound".equals(state))result.put(new JSONObject().put("token",token).put("id",e.getString("id")).put("state",state).put("available",available).put("createdAt",e.getLong("createdAt")));
            }
            if(files!=null)for(File f:files)if(f.getName().startsWith(".capture-")&&f.getName().endsWith(".tmp"))
                result.put(new JSONObject().put("token","staging-"+f.getName()).put("state","needs-review").put("available",false));
            // Legacy audio or unreferenced files with missing metadata are uncertain evidence.
            Set<String> references=durable==null?Collections.emptySet():PeerSnapshot.cleanupReferences(new JSONObject(durable).getJSONArray("records"));
            if(files!=null)for(File f:files)if(validId(f.getName())&&!knownIds.contains(f.getName())){
                String mime=prefs.getString("mime-"+f.getName(),"");
                if((mime.startsWith("audio/")&&binding(durable,f.getName())==null)||(mime.isEmpty()&&!references.contains(f.getName())))
                    result.put(new JSONObject().put("id",f.getName()).put("token","legacy-"+f.getName()).put("state","needs-review").put("available",false));
            }
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
            if(!durable.equals(expected))return false;String[] bound=binding(durable,id);
            if(bound==null||!bound[0].equals(record)||!bound[1].equals(note))return false;
            recover(durable);
            for(String token:tokens()){JSONObject e=read(token);if(id.equals(e.getString("id")))return "bound".equals(e.getString("state"));}
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
            if(token==null||!token.matches("[a-f0-9-]{36}")||ACTIVE.contains(token))throw new IOException("Audio not available for inspection");
            directory(media);File[] files=media.listFiles();if(files==null)throw new IOException("Cannot list audio originals");
            for(File file:files){Matcher m=TEMP.matcher(file.getName());if(m.matches()&&token.equals(m.group(2))){File checked=safe(media,file.getName());if(!checked.isFile()||checked.length()>MediaStaging.LIMIT)throw new IOException("Invalid retained original");return checked;}}
            throw new IOException("Retained original not found");
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
                for(String token:tokens())if(id.equals(read(token).getString("id")))return true;
                File[] files=media.listFiles();if(files!=null)for(File file:files){Matcher m=TEMP.matcher(file.getName());if(m.matches()&&id.equals(m.group(1)))return true;if(file.getName().startsWith(".capture-"+id+"-"))return true;}
                return false;
            }catch(Exception uncertainty){return true;}
        }
    }
}
