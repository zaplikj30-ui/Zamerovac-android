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
    JSONArray needed(PeerSnapshot snapshot,PeerHandshake.Peer peer)throws Exception{return needed(snapshot,peer,()->{});}
    JSONArray needed(PeerSnapshot snapshot,PeerHandshake.Peer peer,ImmutableStore.Checkpoint checkpoint)throws Exception{
        trusted(peer);JSONArray needed=new JSONArray();for(JSONObject media:snapshot.media.values())if(!PeerMedia.matches(new File(outbox.mediaDirectory,media.getString("id")),media,checkpoint))needed.put(media.getString("id"));return needed;
    }
    void receive(String id,InputStream input,JSONObject media,PeerHandshake.Peer peer)throws Exception{receive(id,input,media,peer,()->{});}
    void receive(String id,InputStream input,JSONObject media,PeerHandshake.Peer peer,ImmutableStore.Checkpoint checkpoint)throws Exception{
        trusted(peer);checkpoint.check();
        // Before receiving the first media on a clean device, persist a real DB
        // baseline. Otherwise an interrupted transfer leaves orphaned media with
        // no primary DB and is indistinguishable from an initialized DB loss.
        synchronized(TrashPurger.LOCK){
            String baseline=LocalDatabase.readForCas(context);
            if(baseline.isEmpty())
                LocalDatabase.write(context,"{\"schema\":1,\"records\":[]}");
        }
        PeerMedia.receive(outbox.mediaDirectory,id,input,media,checkpoint);trusted(peer);
    }
    interface LocalReceipt {void save()throws Exception;}
    /** Retire an older intent only when a verified durable newer local state no longer needs its absent files. No network here. */
    boolean superseded(PeerSnapshot incoming,PeerHandshake.Peer peer,JSONArray needed,LocalReceipt receipt)throws Exception{return superseded(incoming,peer,needed,receipt,()->{});}
    boolean superseded(PeerSnapshot incoming,PeerHandshake.Peer peer,JSONArray needed,LocalReceipt receipt,ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        if(needed.length()==0)return false;trusted(peer);long generation;
        synchronized(TrashPurger.LOCK){String text=LocalDatabase.readForCas(context);JSONObject current=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(text);if(!PeerOutbox.dominates(current,incoming.data))return false;Set<String> refs=PeerSnapshot.references(current.getJSONArray("records"));for(int i=0;i<needed.length();i++)if(refs.contains(needed.getString(i)))return false;generation=LocalDatabase.generation(context.getFilesDir());}
        // Hash current originals only after the cheap causal/reference checks prove retirement is possible.
        PeerSnapshot local=PeerSnapshot.capture(context,prefs,checkpoint);if(!PeerOutbox.dominates(local.data,incoming.data))return false;
        for(int i=0;i<needed.length();i++)if(local.media.containsKey(needed.getString(i)))return false;
        synchronized(TrashPurger.LOCK){trusted(peer);LocalDatabase.readForCas(context);if(generation!=LocalDatabase.generation(context.getFilesDir()))return false;
            for(Map.Entry<String,long[]> entry:local.localStats.entrySet()){File file=new File(outbox.mediaDirectory,entry.getKey());if(!file.isFile()||java.nio.file.Files.isSymbolicLink(file.toPath())||file.length()!=entry.getValue()[0]||file.lastModified()!=entry.getValue()[1])return false;}
            receipt.save();return true;
        }
    }
    JSONObject apply(PeerSnapshot snapshot,PeerHandshake.Peer peer)throws Exception{return apply(snapshot,peer,()->{});}
    JSONObject apply(PeerSnapshot snapshot,PeerHandshake.Peer peer,ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        trusted(peer);
        // Recheck even files confirmed earlier: the user may have purged a record during a slow transfer.
        Map<String,long[]> verified=new HashMap<>();for(JSONObject media:snapshot.media.values()){File file=new File(outbox.mediaDirectory,media.getString("id"));if(!PeerMedia.matches(file,media,checkpoint))throw new IOException("Před potvrzením chybí příloha");verified.put(media.getString("id"),new long[]{file.length(),file.lastModified()});}
        JSONObject saved;boolean changed;
        synchronized(TrashPurger.LOCK){
            trusted(peer);for(Map.Entry<String,long[]> entry:verified.entrySet()){File file=new File(outbox.mediaDirectory,entry.getKey());if(!file.isFile()||java.nio.file.Files.isSymbolicLink(file.toPath())||file.length()!=entry.getValue()[0]||file.lastModified()!=entry.getValue()[1])throw new IOException("Příloha se před potvrzením změnila. Přenos zůstává čekající.");}String text=LocalDatabase.readForCas(context);JSONObject current=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()).put("prefs",new JSONObject()):new JSONObject(text);
            saved=new SyncEngine(context,prefs).mergePeer(current,snapshot.data);changed=!CausalClock.canonical(current).equals(CausalClock.canonical(saved));
            SharedPreferences.Editor metadata=prefs.edit();for(JSONObject media:snapshot.media.values()){String id=media.getString("id");metadata.putString("mime-"+id,media.getString("mime")).putString("name-"+id,media.getString("name"));}
            // Commit exact projects before metadata: disk-full must not publish
            // new labels for media that are not yet referenced in the DB.
            // A metadata failure after DB commit remains unacknowledged, and
            // a deterministic retry can finish it without duplicating records.
            if(changed)LocalDatabase.write(context,saved.toString());
            if(!metadata.commit())throw new IOException("Metadata příloh nebyla potvrzena");
        }
        if(changed&&listener!=null)listener.saved(saved,"direct");return saved;
    }
}
