package cz.zamerovac.app;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Durable CAS for the v2 queue. Does not start a transport or authenticate a peer. */
final class SyncQueueStore {
    private static final Object LOCK=new Object();private final File target;
    SyncQueueStore(File home){target=new File(home,"sync-queue-v2.json");}
    private static long integer(JSONObject object,String key,long maximum)throws Exception{Object raw=object.get(key);if(!(raw instanceof Number))throw new IOException("Neplatný čítač fronty");double value=((Number)raw).doubleValue();if(!Double.isFinite(value)||value<0||value>maximum||value!=Math.floor(value))throw new IOException("Neplatný čítač fronty");return ((Number)raw).longValue();}
    private static void validate(JSONObject queue)throws Exception{
        if(queue.optInt("version")!=2||!queue.has("revision")||integer(queue,"revision",9007199254740991L)<0)throw new IOException("Neplatná fronta synchronizace");
        JSONArray jobs=queue.getJSONArray("jobs");if(jobs.length()>100000)throw new IOException("Příliš mnoho přenosů");Set<String> ids=new HashSet<>();
        for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);String id=job.getString("id");if(!id.matches("[0-9a-f]{64}")||!ids.add(id)||!job.getString("hash").matches("[0-9a-f]{64}")||!DeviceIdentity.valid(job.getString("peer"))||!Arrays.asList("metadata","blob").contains(job.getString("kind"))||integer(job,"size",2L*1024*1024*1024)<0||integer(job,"attempts",9007199254740991L)<0||integer(job,"nextAttempt",9007199254740991L)<0)throw new IOException("Neplatný čekající přenos");}
    }
    String read()throws Exception{synchronized(LOCK){AtomicFile file=new AtomicFile(target);if(!target.exists()&&!new File(target+".bak").exists())return "{\"version\":2,\"revision\":0,\"jobs\":[]}";if(target.length()>20L*1024*1024||new File(target+".bak").length()>20L*1024*1024)throw new IOException("Fronta je příliš velká");byte[] bytes=file.readFully();JSONObject data=JsonInput.object(bytes);validate(data);return JsonInput.decode(bytes);}}
    boolean save(long expected,String text)throws Exception{synchronized(LOCK){JsonInput.check(text);JSONObject next=new JSONObject(text);validate(next);JSONObject current=new JSONObject(read());if(current.getLong("revision")!=expected)return false;if(next.getLong("revision")!=expected+1)throw new IOException("Neplatný krok fronty");
        AtomicFile file=new AtomicFile(target);FileOutputStream out=null;try{out=file.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();file.finishWrite(out);out=null;if(!read().equals(text))throw new IOException("Zápis fronty nebyl potvrzen");return true;}catch(Exception error){if(out!=null)file.failWrite(out);throw error;}
    }}
}
