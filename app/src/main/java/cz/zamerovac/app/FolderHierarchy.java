package cz.zamerovac.app;
import org.json.*;
import java.util.*;

/** Deterministic cycle repair shared by merge/restore; payloads and clocks remain exact. */
final class FolderHierarchy {
    static boolean sameIntent(JSONObject repaired,JSONObject original)throws Exception{
        JSONObject marker=repaired.optJSONObject("hierarchyConflict");
        if(marker==null||!repaired.isNull("parentId")||!(marker.opt("parentId") instanceof String))return false;
        JSONObject intent=new JSONObject(repaired.toString());intent.remove("hierarchyConflict");intent.put("parentId",marker.getString("parentId"));
        return CausalClock.canonical(intent).equals(CausalClock.canonical(original));
    }
    static void repair(JSONArray records)throws Exception{
        Map<String,Integer> positions=new HashMap<>();for(int i=0;i<records.length();i++)positions.put(records.getJSONObject(i).getString("id"),i);
        Set<String> done=new HashSet<>();List<String> ids=new ArrayList<>(positions.keySet());Collections.sort(ids);
        for(String start:ids){
            List<String> path=new ArrayList<>();Map<String,Integer> seen=new HashMap<>();String at=start;
            while(positions.containsKey(at)&&!done.contains(at)){
                if(seen.containsKey(at)){
                    String cut=Collections.min(path.subList(seen.get(at),path.size()));int index=positions.get(cut);
                    JSONObject record=new JSONObject(records.getJSONObject(index).toString());
                    record.put("hierarchyConflict",new JSONObject().put("parentId",record.get("parentId"))).put("parentId",JSONObject.NULL);
                    records.put(index,record);break;
                }
                seen.put(at,path.size());path.add(at);at=records.getJSONObject(positions.get(at)).optString("parentId","");
            }
            done.addAll(path);
        }
    }
}
