package cz.zamerovac.app;

import android.accounts.Account;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Explicit per-feature account binding outside Auto Backup. No access/refresh token is stored here. */
final class DriveAccounts {
    private static final Object LOCK=new Object();private final AtomicFile file;
    DriveAccounts(File noBackup){file=new AtomicFile(new File(noBackup,"drive-accounts-v1.json"));}
    static void kind(String kind)throws IOException{if(!"sync".equals(kind)&&!"backup".equals(kind))throw new IOException("Neplatná funkce Disku");}
    static boolean valid(String name){if(name==null||!name.matches("[^\\p{Cntrl}\\p{Z}\\s]{1,320}"))return false;try{JsonInput.unicode(name);return true;}catch(Exception invalid){return false;}}
    private JSONObject empty()throws JSONException{return new JSONObject().put("version",1).put("sync",new JSONObject().put("backend","saf").put("revision",0)).put("backup",new JSONObject().put("backend","saf").put("revision",0));}
    private JSONObject load()throws Exception{
        File target=file.getBaseFile();if(!target.exists()&&!new File(target+".bak").exists())return empty();if(target.length()>4096||new File(target+".bak").length()>4096)throw new IOException("Nastavení účtů je příliš velké");JSONObject data=JsonInput.object(file.readFully());if(data.optInt("version")!=1)throw new IOException("Neplatné nastavení účtů Disku");
        for(String kind:new String[]{"sync","backup"}){JSONObject row=data.getJSONObject(kind);String backend=row.getString("backend");revision(row);if(!"saf".equals(backend)&&!"drive".equals(backend)&&!"none".equals(backend)||"drive".equals(backend)&&!valid(row.getString("account")))throw new IOException("Neplatná vazba účtu Disku");}return data;
    }
    private void save(JSONObject data)throws Exception{
        File parent=file.getBaseFile().getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Účet Disku nelze připravit");byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);FileOutputStream out=null;
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(bytes,file.readFully()))throw new IOException("Účet Disku nebyl potvrzen");}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    Account account(String kind)throws Exception{synchronized(LOCK){kind(kind);JSONObject row=load().getJSONObject(kind);return "drive".equals(row.getString("backend"))?new Account(row.getString("account"),"com.google"):null;}}
    String backend(String kind)throws Exception{synchronized(LOCK){kind(kind);return load().getJSONObject(kind).getString("backend");}}
    private static long revision(JSONObject row)throws Exception{return row.has("revision")?PeerSnapshot.integer(row,"revision",9007199254740991L):0;}
    long revision(String kind)throws Exception{synchronized(LOCK){kind(kind);return revision(load().getJSONObject(kind));}}
    private void change(String kind,JSONObject row,long expected)throws Exception{synchronized(LOCK){kind(kind);JSONObject data=load();long current=revision(data.getJSONObject(kind));if(expected>=0&&expected!=current)throw new IOException("Úložiště se mezitím změnilo. Zopakuj výběr účtu nebo složky.");if(current>=9007199254740991L)throw new IOException("Vyčerpané pořadí nastavení účtu");row.put("revision",current+1);data.put(kind,row);save(data);}}
    void select(String kind,Account account)throws Exception{select(kind,account,-1);}
    void select(String kind,Account account,long expected)throws Exception{if(account==null||!"com.google".equals(account.type)||!valid(account.name))throw new IOException("Neplatný Google účet");change(kind,new JSONObject().put("backend","drive").put("account",account.name),expected);}
    void useSaf(String kind)throws Exception{useSaf(kind,-1);}
    void useSaf(String kind,long expected)throws Exception{change(kind,new JSONObject().put("backend","saf"),expected);}
    void disconnect(String kind)throws Exception{change(kind,new JSONObject().put("backend","none"),-1);}

    ImmutableStore.Checkpoint binding(String kind,Account expected)throws IOException{kind(kind);return ()->{try{Account current=account(kind);if(current==null||!current.equals(expected))throw new CloudScan.Deferred();}catch(IOException failure){throw failure;}catch(Exception failure){throw new IOException("Nastavení účtu nelze ověřit");}};}
    JSONObject snapshot()throws Exception{synchronized(LOCK){return new JSONObject(load().toString());}}
}
