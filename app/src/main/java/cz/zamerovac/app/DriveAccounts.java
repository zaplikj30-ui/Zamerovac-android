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
    private JSONObject empty()throws JSONException{return new JSONObject().put("version",1).put("sync",new JSONObject().put("backend","saf")).put("backup",new JSONObject().put("backend","saf"));}
    private JSONObject load()throws Exception{
        File target=file.getBaseFile();if(!target.exists()&&!new File(target+".bak").exists())return empty();if(target.length()>4096||new File(target+".bak").length()>4096)throw new IOException("Nastavení účtů je příliš velké");JSONObject data=JsonInput.object(file.readFully());if(data.optInt("version")!=1)throw new IOException("Neplatné nastavení účtů Disku");
        for(String kind:new String[]{"sync","backup"}){JSONObject row=data.getJSONObject(kind);String backend=row.getString("backend");if(!"saf".equals(backend)&&!"drive".equals(backend)||"drive".equals(backend)&&!valid(row.getString("account")))throw new IOException("Neplatná vazba účtu Disku");}return data;
    }
    private void save(JSONObject data)throws Exception{
        File parent=file.getBaseFile().getParentFile();if(!parent.isDirectory()&&!parent.mkdirs())throw new IOException("Účet Disku nelze připravit");byte[] bytes=data.toString().getBytes(StandardCharsets.UTF_8);FileOutputStream out=null;
        try{out=file.startWrite();out.write(bytes);out.getFD().sync();file.finishWrite(out);out=null;if(!Arrays.equals(bytes,file.readFully()))throw new IOException("Účet Disku nebyl potvrzen");}catch(Exception failure){if(out!=null)file.failWrite(out);throw failure;}
    }
    Account account(String kind)throws Exception{synchronized(LOCK){kind(kind);JSONObject row=load().getJSONObject(kind);return "drive".equals(row.getString("backend"))?new Account(row.getString("account"),"com.google"):null;}}
    void select(String kind,Account account)throws Exception{synchronized(LOCK){kind(kind);if(account==null||!"com.google".equals(account.type)||!valid(account.name))throw new IOException("Neplatný Google účet");JSONObject data=load();data.put(kind,new JSONObject().put("backend","drive").put("account",account.name));save(data);}}
    void useSaf(String kind)throws Exception{synchronized(LOCK){kind(kind);JSONObject data=load();data.put(kind,new JSONObject().put("backend","saf"));save(data);}}
    ImmutableStore.Checkpoint binding(String kind,Account expected)throws IOException{kind(kind);return ()->{try{Account current=account(kind);if(current==null||!current.equals(expected))throw new CloudScan.Deferred();}catch(IOException failure){throw failure;}catch(Exception failure){throw new IOException("Nastavení účtu nelze ověřit");}};}
    JSONObject snapshot()throws Exception{synchronized(LOCK){return new JSONObject(load().toString());}}
}
