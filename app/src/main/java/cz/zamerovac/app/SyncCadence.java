package cz.zamerovac.app;

import android.content.*;
import android.os.SystemClock;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.function.LongSupplier;

/** Confirmed local scheduling/network preferences and a shared durable foreground/job attempt gate. */
final class SyncCadence {
    static final String[] MODES={"auto","15","30","60","manual"};private static final Object LOCK=new Object();
    static final class State {
        final String mode;final boolean enabled,wifiOnly;
        State(String mode,boolean enabled,boolean wifiOnly){this.mode=mode;this.enabled=enabled;this.wifiOnly=wifiOnly;}
        boolean automatic(){return enabled&&!"manual".equals(mode);}
        long cloud(boolean background){return "auto".equals(mode)?(background?900000:60000):"manual".equals(mode)?Long.MAX_VALUE:Long.parseLong(mode)*60000;}
        long local(){return "auto".equals(mode)?20000:"manual".equals(mode)?Long.MAX_VALUE:Long.parseLong(mode)*60000;}
    }
    private final AtomicFile file;private final SharedPreferences legacy;private final LongSupplier wall,elapsed;
    SyncCadence(Context context,SharedPreferences legacy){this(context.getNoBackupFilesDir(),legacy,System::currentTimeMillis,SystemClock::elapsedRealtime);}
    SyncCadence(File home,SharedPreferences legacy,LongSupplier wall,LongSupplier elapsed){file=new AtomicFile(new File(home,"sync-cadence-v1.json"));this.legacy=legacy;this.wall=wall;this.elapsed=elapsed;}
    private JSONObject load()throws Exception{
        File target=file.getBaseFile();if(!target.exists()&&!new File(target+".bak").exists())return new JSONObject().put("version",1).put("mode",legacy.getString("syncFrequency","auto")).put("enabled",legacy.getBoolean("autoSync",true)).put("wifiOnly",legacy.getBoolean("wifiOnly",false));
        if(target.length()>4096||new File(target+".bak").length()>4096)throw new IOException("Nastavení synchronizace je příliš velké");JSONObject data=JsonInput.object(file.readFully());state(data);if(data.has("attempt")){JSONObject attempt=data.getJSONObject("attempt");PeerSnapshot.integer(attempt,"wall",9007199254740991L);PeerSnapshot.integer(attempt,"elapsed",9007199254740991L);if(attempt.getString("store").length()>200)throw new IOException("Neplatné načasování synchronizace");}return data;
    }
    private static State state(JSONObject data)throws Exception{String mode=data.getString("mode");if(data.optInt("version")!=1||!Arrays.asList(MODES).contains(mode)||!(data.get("enabled") instanceof Boolean)||!(data.get("wifiOnly") instanceof Boolean))throw new IOException("Neplatná frekvence synchronizace");return new State(mode,data.getBoolean("enabled"),data.getBoolean("wifiOnly"));}
    private void write(JSONObject data)throws Exception{
        byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);File parent=file.getBaseFile().getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Nastavení synchronizace nelze připravit");FileOutputStream out=null;
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(bytes,file.readFully()))throw new IOException("Frekvence synchronizace nebyla potvrzena");}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    State read()throws Exception{synchronized(LOCK){return state(load());}}
    static JSONObject configure(Context context,SharedPreferences prefs,String text)throws Exception{
        if(text==null||text.length()>4096)throw new IOException("Neplatné nastavení synchronizace");JSONObject value=JsonInput.object(text.getBytes(StandardCharsets.UTF_8));
        if(!(value.opt("autoSync") instanceof Boolean)||!(value.opt("wifiOnly") instanceof Boolean))throw new IOException("Neplatné přepínače synchronizace");
        if(value.has("syncFrequency")&&!(value.opt("syncFrequency") instanceof String))throw new IOException("Neplatná frekvence synchronizace");String mode=value.has("syncFrequency")?value.getString("syncFrequency"):"auto";new SyncCadence(context,prefs).save(mode,value.getBoolean("autoSync"),value.getBoolean("wifiOnly"));return value.put("syncFrequency",mode);
    }
    void save(String mode,boolean enabled,boolean wifiOnly)throws Exception{synchronized(LOCK){JSONObject data=load();data.put("mode",mode).put("enabled",enabled).put("wifiOnly",wifiOnly);state(data);write(data);}}
    private long remaining(JSONObject data,String store,boolean background)throws Exception{
        State state=state(data);if(!state.automatic())return Long.MAX_VALUE;JSONObject attempt=data.optJSONObject("attempt");if(attempt==null||!store.equals(attempt.optString("store")))return 0;long nowWall=wall.getAsLong(),nowElapsed=elapsed.getAsLong(),previousWall=attempt.getLong("wall"),previousElapsed=attempt.getLong("elapsed");
        if(nowWall<previousWall&&nowElapsed<previousElapsed)return 0;long age=Math.max(nowWall>=previousWall?nowWall-previousWall:0,nowElapsed>=previousElapsed?nowElapsed-previousElapsed:0);return Math.max(0,state.cloud(background)-age);
    }
    boolean claimCloud(String store,boolean manual,boolean background)throws Exception{synchronized(LOCK){if(store==null||store.length()>200)throw new IOException("Neplatné úložiště časování");JSONObject data=load();if(!manual&&remaining(data,store,background)>0)return false;data.put("attempt",new JSONObject().put("store",store).put("wall",wall.getAsLong()).put("elapsed",elapsed.getAsLong()));write(data);return true;}}
    long nextCloud(String store)throws Exception{synchronized(LOCK){long remaining=remaining(load(),store,false);return Math.max(1000,Math.min(60000,remaining));}}
    static State current(Context context,SharedPreferences prefs){try{return new SyncCadence(context,prefs).read();}catch(Exception invalid){return new State("manual",false,true);}}
}
