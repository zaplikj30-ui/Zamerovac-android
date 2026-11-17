package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** History metadata is streamed as an immutable blob, not recursively embedded in each new snapshot. */
final class SyncRecoveryContent {
    final JSONArray revisions=new JSONArray();
    final Set<String> media=new TreeSet<>();
    static SyncRecoveryContent capture(Context context,SharedPreferences prefs,JSONObject current,ImmutableStore.Checkpoint checkpoint)throws Exception{
        SyncRecoveryContent result=new SyncRecoveryContent();File directory=new File(context.getFilesDir(),"media");
        new ProtectedRevisions(context,prefs).databaseRevisions(current,(hash,text,refs)->{
            checkpoint.check();byte[] bytes=text.getBytes(StandardCharsets.UTF_8);String id="revision-"+hash;
            JSONObject expected=new JSONObject().put("hash",hash).put("size",bytes.length);
            if(!PeerMedia.matches(new File(directory,id),expected,checkpoint))
                try(InputStream in=new ByteArrayInputStream(bytes)){PeerMedia.receive(directory,id,in,expected,checkpoint);}
            if(!prefs.edit().putString("mime-"+id,"application/json").putString("name-"+id,"Obnovitelná revize.json").commit())throw new IOException("Metadata historického podkladu nebyla potvrzena");
            result.revisions.put(new JSONObject().put("hash",hash).put("metadataId",id));result.media.addAll(refs);
        });return result;
    }
    static void preserve(PeerSnapshot snapshot,Context context,SharedPreferences prefs)throws Exception{
        JSONArray revisions=snapshot.wire.optJSONArray("recovery");if(revisions==null)return;
        for(int i=0;i<revisions.length();i++){
            JSONObject revision=revisions.getJSONObject(i);String text;
            if(revision.has("metadata"))text=revision.getString("metadata");
            else{
                String id=revision.getString("metadataId");JSONObject expected=snapshot.media.get(id);
                if(expected==null||expected.getLong("size")>LocalDatabase.MAX_BYTES)throw new IOException("Neplatný historický podklad");
                File file=new File(context.getFilesDir(),"media/"+id);if(Files.isSymbolicLink(file.toPath())||!file.isFile())throw new IOException("Nebezpečný historický podklad");
                byte[] bytes=CloudFiles.read(new FileInputStream(file),LocalDatabase.MAX_BYTES);
                if(bytes.length!=expected.getLong("size")||!revision.getString("hash").equals(PeerWire.hash(bytes)))throw new IOException("Historický podklad se před potvrzením změnil");text=JsonInput.decode(bytes);
            }
            LocalDatabase.validate(text);if(!revision.getString("hash").equals(PeerWire.hash(text.getBytes(StandardCharsets.UTF_8))))throw new IOException("Změněné přesné podklady historie");
            if(!snapshot.media.keySet().containsAll(PeerSnapshot.references(new JSONObject(text).getJSONArray("records"))))throw new IOException("Manifest vynechal historické originály");
            new ProtectedRevisions(context,prefs).preserveDatabase(text);
        }
    }
}
