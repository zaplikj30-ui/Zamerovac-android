package cz.zamerovac.app;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.util.UUID;

/** One deterministic conflict representation for native sync and stale WebView save reconciliation. */
final class SyncConflicts {
    static JSONObject normal(JSONObject local,JSONObject remote)throws Exception{
        String id=local.getString("id");if(!id.equals(remote.getString("id")))throw new java.io.IOException("Konflikt má odlišná původní ID");boolean first=CausalClock.canonical(local).compareTo(CausalClock.canonical(remote))<=0;JSONObject record=new JSONObject((first?remote:local).toString());String hash=PeerWire.hash(CausalClock.canonical(new JSONObject().put("id",id).put("record",record)).getBytes(StandardCharsets.UTF_8));
        record.put("id","conflict-"+hash).put("conflictOf",id).put("conflictSource","revision:"+hash).put("conflict",true).put("title",record.optString("title","Položka")+" (konflikt synchronizace)");return new JSONObject().put("winner",first?"local":"remote").put("copy",record);
    }
    static JSONObject purged(String id,JSONObject record,JSONObject tombstone)throws Exception{
        CausalClock.validate(tombstone);String source="purge:"+id+":"+CausalClock.canonical(record);return new JSONObject(record.toString()).put("id",UUID.nameUUIDFromBytes(source.getBytes(StandardCharsets.UTF_8)).toString()).put("conflictOf",id).put("conflictSource",source).put("conflict",true).put("title",record.optString("title","Položka")+" (změna po vysypání koše)").put("syncClock",CausalClock.merge(CausalClock.clock(record),tombstone));
    }
    static JSONObject input(String text)throws Exception{JsonInput.check(text);JSONObject record=new JSONObject(text);LocalDatabase.validate(new JSONObject().put("schema",1).put("records",new JSONArray().put(record)).toString());return record;}
}
