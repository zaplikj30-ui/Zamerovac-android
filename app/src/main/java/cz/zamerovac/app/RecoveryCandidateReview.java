package cz.zamerovac.app;

import java.io.File;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * Stage 3A: read-only candidate assessment, never a source of write authority.
 * This initial fail-closed implementation is kept intentionally RED by tests
 * until the non-mutating validation contract has been implemented.
 */
final class RecoveryCandidateReview {
    interface Checkpoint {void afterInventory()throws Exception;}
    private RecoveryCandidateReview(){}

    static JSONObject inspect(File home,File noBackup,String archivedId)throws Exception{
        return inspect(home,noBackup,archivedId,()->{});
    }
    static JSONObject inspect(File home,File noBackup,String archivedId,
                              Checkpoint checkpoint)throws Exception{
        JSONObject inventory=RecoveryInventory.inspect(home,noBackup);
        checkpoint.afterInventory();
        JSONArray candidates=new JSONArray();
        JSONArray existing=inventory.getJSONArray("candidates");
        for(int i=0;i<existing.length();i++){
            JSONObject item=existing.getJSONObject(i);
            candidates.put(new JSONObject().put("path",item.getString("path"))
                .put("decision","BLOCKED").put("reason","NOT_EVALUATED"));
        }
        return new JSONObject().put("format","cz.zamerovac.recovery.candidate-review")
            .put("version",1).put("readOnly",true).put("safeToPromote",false)
            .put("coherentSnapshot",false).put("candidates",candidates)
            .put("archive",new JSONObject().put("status","NOT_EVALUATED"));
    }
}
