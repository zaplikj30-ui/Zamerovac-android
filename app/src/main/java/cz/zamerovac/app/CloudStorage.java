package cz.zamerovac.app;

import android.accounts.Account;
import android.content.*;
import android.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.function.BooleanSupplier;

/** Backend/account selection and current network policy, shared by UI and scheduled jobs. */
final class CloudStorage {
    interface Platform {
        boolean online();boolean unmetered();String project();
        DriveApi api(Account account,ImmutableStore.Checkpoint binding,DriveHttp.Gate gate)throws Exception;
    }
    private final Context context;private final SharedPreferences prefs;final DriveAccounts accounts;private final Platform platform;
    CloudStorage(Context context,SharedPreferences prefs){this(context,prefs,new Platform(){
        private NetworkCapabilities network(){ConnectivityManager manager=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);return manager==null?null:manager.getNetworkCapabilities(manager.getActiveNetwork());}
        public boolean online(){NetworkCapabilities network=network();return network!=null&&network.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET)&&network.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);}
        public boolean unmetered(){NetworkCapabilities network=network();return network!=null&&network.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);}
        public String project(){return BuildConfig.DRIVE_CLOUD_PROJECT;}
        public DriveApi api(Account account,ImmutableStore.Checkpoint binding,DriveHttp.Gate gate)throws Exception{return new DriveApi(new DriveHttp(new DriveAuthorization(context,account,binding),bytes->{binding.check();gate.check(bytes);}));}
    });}
    CloudStorage(Context context,SharedPreferences prefs,Platform platform){this.context=context;this.prefs=prefs;this.platform=platform;accounts=new DriveAccounts(context.getNoBackupFilesDir());}
    private String tree(String kind){return prefs.getString("sync".equals(kind)?"treeUri":"backupTreeUri",null);}
    boolean configured(String kind)throws Exception{String backend=accounts.backend(kind);return "drive".equals(backend)?accounts.account(kind)!=null:"saf".equals(backend)&&tree(kind)!=null;}
    String key(String kind)throws Exception{String backend=accounts.backend(kind);Account account=accounts.account(kind);String value=account==null?String.valueOf(tree(kind)):platform.project()+"/"+account.name;return backend+":"+PeerWire.hash(value.getBytes(StandardCharsets.UTF_8));}
    boolean offline(String kind){try{return "drive".equals(accounts.backend(kind))&&!platform.online();}catch(Exception invalid){return false;}}
    boolean allowed(String kind,boolean explicit,long bytes){try{
        if(!configured(kind))return false;if(!"drive".equals(accounts.backend(kind)))return BackupNetwork.allowed(context,tree(kind),explicit)||"sync".equals(kind)&&!prefs.getBoolean("wifiOnly",false)&&bytes<=1024*1024;
        if(!platform.online())return false;return explicit||platform.unmetered()||"sync".equals(kind)&&!prefs.getBoolean("wifiOnly",false)&&bytes<=1024*1024;
    }catch(Exception invalid){return false;}}
    private DriveObjectStore drive(String kind,boolean explicit,BooleanSupplier cancelled)throws Exception{
        Account account=accounts.account(kind);if(account==null)throw new IOException("Nejdříve připoj účet Disku");if(platform.project().isEmpty())throw new IOException("Připojení Disku čeká na dokončení nastavení aplikace");ImmutableStore.Checkpoint selected=accounts.binding(kind,account);ImmutableStore.Checkpoint binding=()->{if(cancelled.getAsBoolean()||Thread.currentThread().isInterrupted())throw new CloudScan.Deferred();selected.check();};
        DriveHttp.Gate gate=bytes->{binding.check();if(!allowed(kind,explicit,bytes))throw new CloudScan.Deferred();};return new DriveObjectStore(platform.api(account,binding,gate),context.getCacheDir(),platform.project()+"/"+account.name);
    }
    SyncStore sync(boolean explicit,BooleanSupplier cancelled)throws Exception{if(!configured("sync"))throw new IOException("Vyber úložiště synchronizace");return "drive".equals(accounts.backend("sync"))?new DriveSyncStore(drive("sync",explicit,cancelled)):new DocumentSyncStore(context,tree("sync"));}
    BackupStore backup(boolean explicit)throws Exception{if(!configured("backup"))throw new IOException("Vyber úložiště historických záloh");return "drive".equals(accounts.backend("backup"))?new DriveBackupStore(drive("backup",explicit,()->false)):new DocumentBackupStore(context,tree("backup"));}
}
