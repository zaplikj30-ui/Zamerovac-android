package cz.zamerovac.app;
import android.accounts.Account;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CloudStorageTest {
    PeerTransferTest.Device device;CloudStorage storage;DriveStoresTest.Server server;boolean online=true,unmetered=true;String project="synthetic-project";int apis;
    final Account a=new Account("synthetic-a@example.invalid","com.google"),b=new Account("synthetic-b@example.invalid","com.google");
    @Before public void setup()throws Exception{
        File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"cloud-factory-").toFile();device=new PeerTransferTest.Device(root,"phone");server=new DriveStoresTest.Server();storage=new CloudStorage(device,device.prefs,new CloudStorage.Platform(){public boolean online(){return online;}public boolean unmetered(){return unmetered;}public String project(){return project;}public DriveApi api(Account account,ImmutableStore.Checkpoint binding,DriveHttp.Gate gate){apis++;return server.api(bytes->{binding.check();gate.check(bytes);});}});
    }
    @Test public void independentBackendsAndDisconnectNeverSilentlyFallBackToOldFolder()throws Exception{
        device.prefs.edit().putString("treeUri","content://synthetic/tree/old").putString("backupTreeUri","content://synthetic/tree/backup").commit();assertTrue(storage.sync(false,()->false) instanceof DocumentSyncStore);storage.accounts.select("sync",a);storage.accounts.select("backup",b);SyncStore old=storage.sync(false,()->false);assertTrue(old instanceof DriveSyncStore);assertTrue(storage.backup(false) instanceof DriveBackupStore);String oldKey=storage.key("sync");storage.accounts.disconnect("sync");assertFalse(storage.configured("sync"));assertTrue(storage.configured("backup"));assertNotEquals(oldKey,storage.key("sync"));assertEquals("content://synthetic/tree/old",device.prefs.getString("treeUri",null));try{storage.sync(false,()->false);fail("Disconnected backend silently used old SAF folder");}catch(IOException expected){}int before=server.calls;try{old.list("sync/v2/blobs");fail("Disconnected account continued");}catch(CloudScan.Deferred expected){}assertEquals(before,server.calls);storage.accounts.useSaf("sync");assertTrue(storage.sync(false,()->false) instanceof DocumentSyncStore);
    }
    @Test public void offlineMeteredWifiOnlyAndExplicitExceptionUseCurrentNetwork()throws Exception{
        storage.accounts.select("sync",a);storage.accounts.select("backup",a);online=false;assertFalse(storage.allowed("sync",true,1));assertFalse(storage.allowed("backup",true,1));online=true;unmetered=false;assertTrue(storage.allowed("sync",false,100));assertFalse(storage.allowed("sync",false,1024*1024+1));assertFalse(storage.allowed("backup",false,100));assertTrue(storage.allowed("backup",true,Long.MAX_VALUE));device.prefs.edit().putBoolean("wifiOnly",true).commit();assertFalse(storage.allowed("sync",false,1));assertTrue(storage.allowed("sync",true,Long.MAX_VALUE));unmetered=true;assertTrue(storage.allowed("sync",false,Long.MAX_VALUE));
        SyncStore store=storage.sync(false,()->false);unmetered=false;int calls=server.calls;try{store.list("sync/v2/blobs");fail("Network change ignored");}catch(CloudScan.Deferred expected){}assertEquals(calls,server.calls);
    }
    @Test public void accountProjectAndCancellationScopeCannotReuseOldStoreOrNamespace()throws Exception{
        storage.accounts.select("sync",a);AtomicBoolean cancelled=new AtomicBoolean();SyncStore first=storage.sync(false,cancelled::get);String initial=first.namespace();storage.accounts.select("sync",b);int before=server.calls;try{first.list("sync/v2/blobs");fail("Old account route used");}catch(CloudScan.Deferred expected){}assertEquals(before,server.calls);SyncStore second=storage.sync(false,cancelled::get);assertNotEquals(initial,second.namespace());cancelled.set(true);try{second.list("sync/v2/blobs");fail("Cancelled route used");}catch(CloudScan.Deferred expected){}project="different-project";cancelled.set(false);assertNotEquals(second.namespace(),storage.sync(false,cancelled::get).namespace());
    }
    @Test public void missingProjectDoesNotBecomeASafFallbackOrAuthorizeAnAccount()throws Exception{
        device.prefs.edit().putString("treeUri","content://synthetic/tree/old").commit();storage.accounts.select("sync",a);project="";try{storage.sync(false,()->false);fail("Unconfigured app pretended to connect");}catch(IOException expected){assertTrue(expected.getMessage().contains("nastavení"));}assertEquals(0,apis);assertEquals(a,storage.accounts.account("sync"));
    }
}
