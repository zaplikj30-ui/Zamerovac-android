package cz.zamerovac.app;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Explicitly approved device-to-certificate bindings, outside Android Auto Backup. */
final class SyncPeerRegistry {
    private static final Object LOCK=new Object();private final File target;
    SyncPeerRegistry(File noBackup){target=new File(noBackup,"sync-peers-v2.json");}
    private JSONObject load()throws Exception{
        AtomicFile file=new AtomicFile(target);if(!target.exists()&&!new File(target+".bak").exists())return new JSONObject().put("version",2).put("peers",new JSONObject());
        if(target.length()>1024*1024||new File(target+".bak").length()>1024*1024)throw new IOException("Seznam zařízení je příliš velký");JSONObject data=JsonInput.object(file.readFully());
        if(data.optInt("version")!=2||data.optJSONObject("peers")==null||data.getJSONObject("peers").length()>1024)throw new IOException("Neplatný seznam spárovaných zařízení");
        JSONObject peers=data.getJSONObject("peers");Set<String> fingerprints=new HashSet<>();for(Iterator<String> it=peers.keys();it.hasNext();){String id=it.next();JSONObject peer=peers.getJSONObject(id);if(!DeviceIdentity.valid(id)||!peer.getString("fingerprint").matches("[0-9a-f]{64}")||!fingerprints.add(peer.getString("fingerprint")))throw new IOException("Neplatná identita spárovaného zařízení");}
        return data;
    }
    private void write(JSONObject data)throws Exception{
        if(!target.getParentFile().isDirectory()&&!target.getParentFile().mkdirs())throw new IOException("Nelze uložit párování");
        AtomicFile file=new AtomicFile(target);FileOutputStream out=null;byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(file.readFully(),bytes))throw new IOException("Párování nebylo potvrzeno");}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    boolean hasFingerprint(String fingerprint)throws Exception{synchronized(LOCK){JSONObject peers=load().getJSONObject("peers");for(Iterator<String> it=peers.keys();it.hasNext();)if(fingerprint.equals(peers.getJSONObject(it.next()).getString("fingerprint")))return true;return false;}}
    boolean isTrusted(String id,String fingerprint)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(id)||!fingerprint.matches("[0-9a-f]{64}"))throw new IOException("Neplatná identita zařízení");JSONObject peers=load().getJSONObject("peers");JSONObject known=peers.optJSONObject(id);if(known!=null&&!fingerprint.equals(known.getString("fingerprint")))throw new IOException("Identita zařízení se změnila. Nejdříve odeber staré párování.");for(Iterator<String> it=peers.keys();it.hasNext();){String other=it.next();if(!other.equals(id)&&fingerprint.equals(peers.getJSONObject(other).getString("fingerprint")))throw new IOException("Certifikát patří jinému zařízení");}return known!=null;}}
    void approve(String id,String fingerprint,String name)throws Exception{synchronized(LOCK){if(isTrusted(id,fingerprint))return;JSONObject data=load(),peers=data.getJSONObject("peers");if(peers.length()>=1024)throw new IOException("Seznam zařízení je plný");if(name==null||name.length()>80||name.matches(".*[\\p{Cntrl}].*"))throw new IOException("Neplatný název zařízení");peers.put(id,new JSONObject().put("fingerprint",fingerprint).put("name",name).put("pairedAt",java.time.Instant.now().toString()));write(data);}}
    void forget(String id)throws Exception{synchronized(LOCK){if(!DeviceIdentity.valid(id))throw new IOException("Neplatná identita zařízení");JSONObject data=load();data.getJSONObject("peers").remove(id);write(data);}}
    JSONObject snapshot()throws Exception{synchronized(LOCK){return new JSONObject(load().getJSONObject("peers").toString());}}
}
