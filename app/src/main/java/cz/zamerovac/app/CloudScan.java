package cz.zamerovac.app;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
/** A private scan cursor is a work hint, never proof of receipt or permission to clear an outbox. */
final class CloudScan {
 static final class Deferred extends IOException {Deferred(){super("Další část cloudových zpráv čeká na následující pokus");}}
 private static final Object LOCK=new Object();private static final Map<String,Long> GENERATIONS=new HashMap<>();
 private final AtomicFile file;private final String owner,namespace;private JSONObject cached;private long generation=-1;
 CloudScan(File noBackup,String owner,String namespace)throws Exception{if(!DeviceIdentity.valid(owner))throw new IOException("Neplatná identita procházení");this.owner=owner;this.namespace=PeerWire.hash(namespace.getBytes(StandardCharsets.UTF_8));file=new AtomicFile(new File(noBackup,"sync-scan-v2-"+owner+"-"+this.namespace+".json"));}
 private JSONObject load()throws Exception{
  long current=GENERATIONS.getOrDefault(file.getBaseFile().getAbsolutePath(),0L);if(cached!=null&&generation==current)return cached;
  File target=file.getBaseFile();if(!target.exists()&&!new File(target+".bak").exists())return new JSONObject().put("version",2).put("owner",owner).put("namespace",namespace).put("positions",new JSONObject());
  if(target.length()>PeerWire.MAX_JSON||new File(target+".bak").length()>PeerWire.MAX_JSON)throw new IOException("Index procházení je příliš velký");JSONObject data=JsonInput.object(file.readFully());if(data.optInt("version")!=2||!owner.equals(data.optString("owner"))||!namespace.equals(data.optString("namespace"))||data.getJSONObject("positions").length()>100000)throw new IOException("Neplatný index procházení");cached=data;generation=current;return data;
 }
 private String key(String scope){return PeerWire.hash(scope.getBytes(StandardCharsets.UTF_8));}
 List<ImmutableStore.Entry> ordered(String scope,List<ImmutableStore.Entry> source)throws Exception{synchronized(LOCK){if(source.size()>100000)throw new IOException("Příliš mnoho cloudových položek");List<ImmutableStore.Entry> sorted=new ArrayList<>(source);sorted.sort(Comparator.comparing(entry->entry.name));String after=load().getJSONObject("positions").optString(key(scope),"");int pivot=0;while(pivot<sorted.size()&&sorted.get(pivot).name.compareTo(after)<=0)pivot++;if(pivot==sorted.size())pivot=0;List<ImmutableStore.Entry> result=new ArrayList<>(sorted.size());result.addAll(sorted.subList(pivot,sorted.size()));result.addAll(sorted.subList(0,pivot));return result;}}
 void advance(String scope,String name)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(name)&&!name.matches("[a-f0-9]{64}-[a-f0-9-]{36}\\.json"))throw new IOException("Neplatná pozice procházení");JSONObject original=load();String key=key(scope);if(name.equals(original.getJSONObject("positions").optString(key)))return;JSONObject data=new JSONObject(original.toString());data.getJSONObject("positions").put(key,name);byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);if(bytes.length>PeerWire.MAX_JSON||data.getJSONObject("positions").length()>100000)throw new IOException("Index procházení je plný");FileOutputStream out=null;try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(bytes,file.readFully()))throw new IOException("Pozice procházení nebyla potvrzena");long current=GENERATIONS.getOrDefault(file.getBaseFile().getAbsolutePath(),0L)+1;GENERATIONS.put(file.getBaseFile().getAbsolutePath(),current);cached=data;generation=current;}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}}}
}
