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
        if(queue.optInt("version")!=2||!queue.has("revision")||
            integer(queue,"revision",9007199254740991L)<0)
            throw new IOException("Neplatná fronta synchronizace");
        JSONArray jobs=queue.getJSONArray("jobs");
        JSONArray quarantine=queue.optJSONArray("recoveryQuarantine");
        if(queue.has("recoveryQuarantine")&&quarantine==null)
            throw new IOException("Poškozená karanténa synchronizačních dokladů");
        int total=jobs.length()+(quarantine==null?0:quarantine.length());
        if(total>100000)throw new IOException("Příliš mnoho uložených přenosů");
        Set<String> ids=new HashSet<>();
        for(JSONArray section:new JSONArray[]{jobs,quarantine}){
            if(section==null)continue;
            for(int i=0;i<section.length();i++){
                JSONObject job=section.getJSONObject(i);
                String id=job.getString("id");
                if(!id.matches("[0-9a-f]{64}")||!ids.add(id)||
                    !job.getString("hash").matches("[0-9a-f]{64}")||
                    !DeviceIdentity.valid(job.getString("peer"))||
                    !Arrays.asList("metadata","blob").contains(job.getString("kind"))||
                    integer(job,"size",2L*1024*1024*1024)<0||
                    integer(job,"attempts",9007199254740991L)<0||
                    integer(job,"nextAttempt",9007199254740991L)<0)
                    throw new IOException("Neplatný uložený přenos");
                if(section==quarantine&&!DeviceIdentity.valid(job.optString("quarantinedAtEpoch","")))
                    throw new IOException("Neplatné období karantény");
            }
        }
    }
    /** A UI/legacy queue writer cannot erase archived recovery evidence. */
    private static void preserveQuarantine(JSONObject previous,JSONObject next)throws Exception{
        JSONArray old=previous.optJSONArray("recoveryQuarantine");
        if(old==null||old.length()==0)return;
        JSONArray incoming=next.optJSONArray("recoveryQuarantine");
        if(incoming==null){next.put("recoveryQuarantine",new JSONArray(old.toString()));return;}
        Map<String,String> retained=new HashMap<>();
        for(int i=0;i<incoming.length();i++){
            JSONObject row=incoming.getJSONObject(i);
            retained.put(row.getString("id"),CausalClock.canonical(row));
        }
        for(int i=0;i<old.length();i++){
            JSONObject row=old.getJSONObject(i);
            if(!CausalClock.canonical(row).equals(retained.get(row.getString("id"))))
                throw new IOException("Dřívější synchronizační doklady nelze odstranit ani změnit");
        }
    }
    String read()throws Exception{synchronized(LOCK){AtomicFile file=new AtomicFile(target);if(!target.exists()&&!new File(target+".bak").exists())return "{\"version\":2,\"revision\":0,\"jobs\":[]}";if(target.length()>20L*1024*1024||new File(target+".bak").length()>20L*1024*1024)throw new IOException("Fronta je příliš velká");byte[] bytes=file.readFully();JSONObject data=JsonInput.object(bytes);validate(data);return JsonInput.decode(bytes);}}
    boolean save(long expected,String text)throws Exception{
        synchronized(LOCK){
            JsonInput.check(text);
            JSONObject next=new JSONObject(text);
            validate(next);
            JSONObject current=new JSONObject(read());
            if(current.getLong("revision")!=expected)return false;
            if(next.getLong("revision")!=expected+1)
                throw new IOException("Neplatný krok fronty");
            preserveQuarantine(current,next);
            validate(next);
            String committed=next.toString();
            byte[] bytes=committed.getBytes(StandardCharsets.UTF_8);
            if(bytes.length>20L*1024*1024)throw new IOException("Fronta je příliš velká");
            AtomicFile file=new AtomicFile(target);
            FileOutputStream out=null;
            try{
                out=file.startWrite();
                out.write(bytes);out.getFD().sync();
                file.finishWrite(out);out=null;
                if(!read().equals(committed))
                    throw new IOException("Zápis fronty nebyl potvrzen");
                return true;
            }catch(Exception error){
                if(out!=null)file.failWrite(out);
                throw error;
            }
        }
    }

}
