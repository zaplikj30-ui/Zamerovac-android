package cz.zamerovac.app;

import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Local recovery era, never a causal clock or a transferred project field. Caller holds the DB lock. */
final class DatabaseRecovery {
    private static AtomicFile file(File home){return new AtomicFile(new File(home,"projects.recovery-v1.json"));}
    static boolean exists(File home){File target=file(home).getBaseFile();return target.exists()||new File(target+".bak").exists();}
    private static JSONObject load(File home)throws IOException{
        AtomicFile file=file(home);if(!exists(home))return null;
        if(file.getBaseFile().length()>4096||new File(file.getBaseFile()+".bak").length()>4096)throw new IOException("Evidence obnovy je příliš velká");
        try{JSONObject state=JsonInput.object(file.readFully());Object epoch=state.get("epoch");if(state.optInt("version")!=1||!(epoch instanceof String)||!((String)epoch).isEmpty()&&!DeviceIdentity.valid((String)epoch)||!(state.get("recovering") instanceof Boolean))throw new IOException("Neplatná evidence obnovy");return state;}catch(JSONException invalid){throw new IOException("Evidenci obnovy nelze načíst",invalid);}
    }
    private static void save(File home,JSONObject state)throws IOException{
        AtomicFile file=file(home);byte[] bytes=state.toString().getBytes(StandardCharsets.UTF_8);FileOutputStream out=null;
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(bytes,file.readFully()))throw new IOException("Evidence obnovy nebyla potvrzena");}catch(IOException failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    static String id(File home)throws IOException{synchronized(TrashPurger.LOCK){JSONObject state=load(home);return state==null?"":state.optString("epoch");}}
    static boolean recovered(File home)throws IOException{
        JSONObject state=load(home);if(state!=null&&state.optBoolean("recovering"))return false;
        try{save(home,new JSONObject().put("version",1).put("epoch",UUID.randomUUID().toString()).put("recovering",true));return true;}catch(JSONException invalid){throw new IOException(invalid);}
    }
    /** Re-arm BEFORE replacing the primary, including when the following database write fails. */
    static void healthy(File home,boolean initialize)throws IOException{
        JSONObject state=load(home);if(state==null&&!initialize||state!=null&&!state.optBoolean("recovering"))return;
        try{if(state==null)state=new JSONObject().put("version",1).put("epoch","");state.put("recovering",false);save(home,state);}catch(JSONException invalid){throw new IOException(invalid);}
    }
}
