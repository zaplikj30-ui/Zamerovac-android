package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import java.io.*;
import java.util.*;

/** Local data boundary used by every authenticated direct session. No network operation holds the DB lock. */
final class PeerDataStore {
    final Context context;final SharedPreferences prefs;final PeerOutbox outbox;final SyncPeerRegistry peers;
    interface Change {void saved(JSONObject data,String transport)throws Exception;}
    private final Change listener;
    PeerDataStore(Context context,SharedPreferences prefs,SyncPeerRegistry peers,Change listener){this.context=context;this.prefs=prefs;this.peers=peers;outbox=new PeerOutbox(context,prefs,peers);this.listener=listener;}
    void trusted(PeerHandshake.Peer peer)throws Exception{if(!peers.isTrusted(peer.id,peer.fingerprint))throw new IOException("Párování bylo odebráno");}
    JSONArray needed(PeerSnapshot snapshot,PeerHandshake.Peer peer)throws Exception{
        trusted(peer);JSONArray needed=new JSONArray();for(JSONObject media:snapshot.media.values())if(!PeerMedia.matches(new File(outbox.mediaDirectory,media.getString("id")),media))needed.put(media.getString("id"));return needed;
    }
    void receive(String id,InputStream input,JSONObject media,PeerHandshake.Peer peer)throws Exception{trusted(peer);PeerMedia.receive(outbox.mediaDirectory,id,input,media);trusted(peer);}
    JSONObject apply(PeerSnapshot snapshot,PeerHandshake.Peer peer)throws Exception{
        trusted(peer);
        // Recheck even files confirmed earlier: the user may have purged a record during a slow transfer.
        Map<String,long[]> verified=new HashMap<>();for(JSONObject media:snapshot.media.values()){File file=new File(outbox.mediaDirectory,media.getString("id"));if(!PeerMedia.matches(file,media))throw new IOException("Před potvrzením chybí příloha");verified.put(media.getString("id"),new long[]{file.length(),file.lastModified()});}
        JSONObject saved;boolean changed;
        synchronized(TrashPurger.LOCK){
            trusted(peer);for(Map.Entry<String,long[]> entry:verified.entrySet()){File file=new File(outbox.mediaDirectory,entry.getKey());if(!file.isFile()||java.nio.file.Files.isSymbolicLink(file.toPath())||file.length()!=entry.getValue()[0]||file.lastModified()!=entry.getValue()[1])throw new IOException("Příloha se před potvrzením změnila. Přenos zůstává čekající.");}String text=LocalDatabase.read(context.getFilesDir());JSONObject current=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()).put("prefs",new JSONObject()):new JSONObject(text);
            saved=new SyncEngine(context,prefs).mergePeer(current,snapshot.data);changed=!CausalClock.canonical(current).equals(CausalClock.canonical(saved));
            SharedPreferences.Editor metadata=prefs.edit();for(JSONObject media:snapshot.media.values()){String id=media.getString("id");metadata.putString("mime-"+id,media.getString("mime")).putString("name-"+id,media.getString("name"));}
            if(!metadata.commit())throw new IOException("Metadata příloh nebyla potvrzena");if(changed)LocalDatabase.write(context.getFilesDir(),saved.toString());
        }
        if(changed&&listener!=null)listener.saved(saved,"direct");return saved;
    }
}
