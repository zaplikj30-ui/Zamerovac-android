package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/** Complete immutable snapshot metadata. Actual media stay streamed and retain their logical IDs. */
final class PeerSnapshot {
    // Exact JSON integer range; provider quotas and free space are checked independently.
    static final long MAX_MEDIA=9007199254740991L;
    final JSONObject wire,data;final LinkedHashMap<String,JSONObject> media;final byte[] bytes;final String hash;
    final Map<String,long[]> localStats=new HashMap<>();
    private PeerSnapshot(JSONObject wire,byte[] bytes)throws Exception{
        this.wire=wire;this.data=wire.getJSONObject("data");this.bytes=bytes.clone();this.hash=PeerWire.hash(this.bytes);media=new LinkedHashMap<>();
        JSONArray entries=wire.getJSONArray("media");if(entries.length()>20000)throw new IOException("Příliš mnoho příloh v přenosu");
        for(int i=0;i<entries.length();i++){
            JSONObject entry=entries.getJSONObject(i);String id=entry.getString("id"),digest=entry.getString("hash"),mime=entry.getString("mime"),name=entry.getString("name");long size=integer(entry,"size",MAX_MEDIA);
            if(!validMediaId(id)||!digest.matches("[0-9a-f]{64}")||size==0||!validMime(mime)||name.length()>256||name.matches(".*[\\p{Cntrl}].*"))throw new IOException("Neplatná příloha v přenosu");
            if(media.put(id,entry)!=null)throw new IOException("Duplicitní příloha v přenosu");
        }
        Set<String> referenced=contentReferences(wire);if(!referenced.equals(media.keySet()))throw new IOException("Neúplný seznam příloh přenosu");
    }
    static Set<String> contentReferences(JSONObject wire)throws Exception{
        Set<String> ids=references(wire.getJSONObject("data").getJSONArray("records"));
        JSONArray history=wire.optJSONArray("recovery"),audio=wire.optJSONArray("detachedAudio");
        if(wire.getInt("version")==2&&(history!=null||audio!=null))throw new IOException("Starý manifest neprokazuje úplnost historie");
        if(history!=null){if(history.length()>20000)throw new IOException("Příliš mnoho historických revizí");Set<String> seen=new HashSet<>();
            for(int i=0;i<history.length();i++){JSONObject entry=history.getJSONObject(i);String text=entry.getString("metadata"),hash=entry.getString("hash");
                LocalDatabase.validate(text);if(!hash.equals(PeerWire.hash(text.getBytes(StandardCharsets.UTF_8)))||!seen.add(hash))throw new IOException("Neplatné přesné podklady historie");
                ids.addAll(references(new JSONObject(text).getJSONArray("records")));
            }
        }
        if(audio!=null){if(audio.length()>20000)throw new IOException("Příliš mnoho hlasových podkladů");for(int i=0;i<audio.length();i++){String id=audio.getString(i);if(!validMediaId(id))throw new IOException("Neplatný hlasový podklad");ids.add(id);}}
        return ids;
    }
    static boolean validMediaId(String id){return id!=null&&id.matches("[a-zA-Z0-9_-]{3,120}");}
    static boolean validMime(String mime){return mime!=null&&mime.length()<=160&&mime.matches("[a-zA-Z0-9!#$&^_.+-]+/[a-zA-Z0-9!#$&^_.+-]+");}
    static long integer(JSONObject object,String key,long maximum)throws Exception{
        Object raw=object.get(key);if(!(raw instanceof Number))throw new IOException("Neplatná číselná hodnota přenosu");double number=((Number)raw).doubleValue();if(!Double.isFinite(number)||number<0||number>maximum||number!=Math.floor(number))throw new IOException("Neplatná velikost přenosu");return ((Number)raw).longValue();
    }
    static Set<String> references(Object value)throws Exception{Set<String> refs=new TreeSet<>();collect(value,refs,0,true);return refs;}
    /** Cleanup only selects safe local paths; malformed legacy IDs must never block deleting valid candidates. */
    static Set<String> cleanupReferences(Object value)throws Exception{Set<String> refs=new TreeSet<>();collect(value,refs,0,false);return refs;}
    private static void collect(Object value,Set<String> refs,int depth,boolean strict)throws Exception{
        if(depth>100)throw new IOException("Příliš zanořená data přenosu");
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;for(Iterator<String> it=object.keys();it.hasNext();){String key=it.next();Object child=object.get(key);
            if("media".equals(key)||"audioMedia".equals(key)){if(!(child instanceof JSONArray)){if(strict)throw new IOException("Neplatný seznam příloh");continue;}JSONArray items=(JSONArray)child;for(int i=0;i<items.length();i++){Object id=items.get(i);if(!(id instanceof String)||!validMediaId((String)id)){if(strict)throw new IOException("Neplatný identifikátor přílohy");continue;}refs.add((String)id);}}
            else if("items".equals(key)&&child instanceof String&&((String)child).trim().startsWith("[")){JsonInput.check((String)child);collect(new JSONArray((String)child),refs,depth+1,strict);}
            else collect(child,refs,depth+1,strict);
        }}else if(value instanceof JSONArray){JSONArray values=(JSONArray)value;for(int i=0;i<values.length();i++)collect(values.get(i),refs,depth+1,strict);}
    }
    private static void numbers(Object value,int depth)throws Exception{
        if(depth>100)throw new IOException("Příliš zanořená data");
        if(value instanceof Number){double number=((Number)value).doubleValue();if(!Double.isFinite(number)||Math.abs(number)>9007199254740991L)throw new IOException("Číselné pole nelze přenést beze změny. Přesné hodnoty musejí být textové.");}
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;for(Iterator<String> it=object.keys();it.hasNext();)numbers(object.get(it.next()),depth+1);}
        else if(value instanceof JSONArray){JSONArray array=(JSONArray)value;for(int i=0;i<array.length();i++)numbers(array.get(i),depth+1);}
    }
    static PeerSnapshot parse(byte[] bytes,String sourceId)throws Exception{
        String text=JsonInput.decode(bytes);JsonInput.check(text);
        // JCS also rejects duplicate JSON keys. Do not feed a lenient parser first and lose them.
        new org.erdtman.jcs.JsonCanonicalizer(text);
        JSONObject wire=new JSONObject(text);JsonInput.unicode(wire);numbers(wire,0);
        if(wire.has("contentEncoding")&&!"identity-v1".equals(wire.getString("contentEncoding")))throw new IOException("Nepodporované kódování obsahu; je nutná kompatibilní verze aplikace");
        long version=integer(wire,"version",3);
        if(!"cz.zamerovac.sync.snapshot".equals(wire.optString("format"))||(version!=2&&version!=3)||!DeviceIdentity.valid(sourceId)||!sourceId.equals(wire.getString("sourceId")))throw new IOException("Neplatná, cizí nebo nepodporovaná synchronizační revize");
        if(wire.has("recoveryEpoch")&&(!(wire.get("recoveryEpoch") instanceof String)||
            !DeviceIdentity.valid(wire.getString("recoveryEpoch"))))
            throw new IOException("Neplatná identita období obnovy přenosu");
        JSONObject data=wire.getJSONObject("data");LocalDatabase.validate(data.toString());if(data.has("prefs"))throw new IOException("Nastavení zařízení nepatří do sdílené revize");return new PeerSnapshot(wire,bytes);
    }
    static PeerSnapshot capture(Context context,SharedPreferences prefs)throws Exception{return capture(context,prefs,()->{});}
    static PeerSnapshot capture(Context context,SharedPreferences prefs,ImmutableStore.Checkpoint checkpoint)throws Exception{return capture(context,prefs,checkpoint,false);}
    static PeerSnapshot captureRecovery(Context context,SharedPreferences prefs,ImmutableStore.Checkpoint checkpoint)throws Exception{return capture(context,prefs,checkpoint,true);}
    private static PeerSnapshot capture(Context context,SharedPreferences prefs,ImmutableStore.Checkpoint checkpoint,boolean recoveryOnly)throws Exception{
        checkpoint.check();
        String text=LocalDatabase.readForCas(context);JSONObject data=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(text);
        data.remove("prefs");data.remove("created");data.put("syncProtocol",2);numbers(data,0);
        JSONArray recovery=recoveryOnly?new ProtectedRevisions(context,prefs).databaseRevisions(data):new JSONArray();
        Set<String> detached=recoveryOnly?new PendingAudio(new File(context.getFilesDir(),"media"),prefs).synchronizable():new TreeSet<>();detached.removeAll(references(data.getJSONArray("records")));
        if(recoveryOnly&&recovery.length()==0&&detached.isEmpty())return null;
        if(recoveryOnly)data=new JSONObject().put("schema",1).put("records",new JSONArray()).put("syncProtocol",2);
        JSONObject envelope=new JSONObject().put("version",recovery.length()>0||!detached.isEmpty()?3:2).put("data",data);
        if(recoveryOnly)envelope.put("recoveryOnly",true).put("contentEncoding","identity-v1");
        if(recovery.length()>0)envelope.put("recovery",recovery);if(!detached.isEmpty())envelope.put("detachedAudio",new JSONArray(detached));
        JSONArray manifest=new JSONArray();File directory=new File(context.getFilesDir(),"media");
        for(String id:contentReferences(envelope)){
            File file=new File(directory,id);JSONObject verified=PeerMedia.inspect(file,checkpoint);
            String mime=prefs.getString("mime-"+id,"application/octet-stream");if(!validMime(mime))mime="application/octet-stream";
            String name=prefs.getString("name-"+id,"Příloha").replaceAll("[\\p{Cntrl}]","");if(name.length()>256)name=name.substring(0,Character.isHighSurrogate(name.charAt(255))?255:256);
            manifest.put(new JSONObject().put("id",id).put("hash",verified.getString("hash")).put("size",verified.getLong("size")).put("mime",mime).put("name",name));
        }
        checkpoint.check();JSONObject wire=envelope.put("format","cz.zamerovac.sync.snapshot").put("sourceId",DeviceIdentity.get(context.getNoBackupFilesDir())).put("media",manifest);
        // A locally recovered installation must never reuse the hash of an older
        // signed cloud ACK, even when restored project JSON is byte-identical.
        // Optional envelope field: persistent project schema and media IDs do not change.
        // Revalidate primary AND the independent no_backup witness after media
        // scanning. A vanished journal cannot silently emit the old signed ACK hash.
        String epoch=LocalDatabase.recoveryId(context);
        if(!epoch.isEmpty())wire.put("recoveryEpoch",epoch);
        byte[] bytes=CausalClock.canonical(wire).getBytes(StandardCharsets.UTF_8);if(bytes.length>PeerWire.MAX_JSON)throw new IOException("Metadata synchronizace jsou příliš velká");PeerSnapshot result=parse(bytes,wire.getString("sourceId"));for(String id:result.media.keySet()){File file=new File(directory,id);result.localStats.put(id,new long[]{file.length(),file.lastModified()});}return result;
    }
}
