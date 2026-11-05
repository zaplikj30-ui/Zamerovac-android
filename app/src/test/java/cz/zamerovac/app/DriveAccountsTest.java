package cz.zamerovac.app;

import android.accounts.Account;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DriveAccountsTest {
    File home;DriveAccounts accounts;final Account a=new Account("synthetic-a@example.invalid","com.google"),b=new Account("synthetic-b@example.invalid","com.google");
    @Before public void setup()throws Exception{home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"drive-accounts-").toFile();accounts=new DriveAccounts(home);}
    @Test public void featuresKeepIndependentExplicitBindingsAndDisconnectDoesNotTouchTheOther()throws Exception{
        assertNull(accounts.account("sync"));assertNull(accounts.account("backup"));accounts.select("sync",a);accounts.select("backup",b);DriveAccounts reopened=new DriveAccounts(home);assertEquals(a,reopened.account("sync"));assertEquals(b,reopened.account("backup"));reopened.useSaf("sync");assertNull(accounts.account("sync"));assertEquals(b,accounts.account("backup"));assertFalse(accounts.snapshot().toString().contains("accessToken"));assertFalse(accounts.snapshot().toString().contains(DriveHttpTest.TOKEN));
    }
    @Test public void failedAtomicWriteCannotSelectAnUnconfirmedAccountEvenInLiveInstance()throws Exception{
        accounts.select("sync",a);File blocker=new File(home,"drive-accounts-v1.json.new");assertTrue(blocker.mkdir());Files.write(new File(blocker,"block").toPath(),new byte[]{1});try{accounts.select("sync",b);fail("Unconfirmed account became active");}catch(IOException expected){}assertEquals(a,accounts.account("sync"));assertEquals(a,new DriveAccounts(home).account("sync"));
    }
    @Test public void bindingStopsOldAccountAndInvalidInputOrCorruptStateDoesNotResetToEmpty()throws Exception{
        accounts.select("sync",a);ImmutableStore.Checkpoint binding=accounts.binding("sync",a);binding.check();accounts.select("sync",b);try{binding.check();fail("Old account continued");}catch(CloudScan.Deferred expected){}accounts.useSaf("sync");try{binding.check();fail("Disconnected account continued");}catch(CloudScan.Deferred expected){}
        for(String kind:new String[]{"","../sync","SYNC","backup2"})try{accounts.select(kind,a);fail("Invalid feature");}catch(IOException expected){}for(Account invalid:new Account[]{new Account("bad\nname\nagain","com.google"),new Account("bad\u2028name","com.google"),new Account("bad"+(char)0xd800,"com.google"),new Account("synthetic@example.invalid","other.type")})try{accounts.select("backup",invalid);fail("Invalid account");}catch(IOException expected){}
        Files.write(new File(home,"drive-accounts-v1.json").toPath(),"{}".getBytes(java.nio.charset.StandardCharsets.UTF_8));try{accounts.account("backup");fail("Corrupt account binding hidden");}catch(Exception expected){}assertEquals("{}",new String(Files.readAllBytes(new File(home,"drive-accounts-v1.json").toPath()),java.nio.charset.StandardCharsets.UTF_8));
    }
}
