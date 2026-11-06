package cz.zamerovac.app;
import android.accounts.Account;
import android.content.*;
import android.net.Uri;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class MainCloudSelectionTest {
    @Test public void confirmedFrequencyControlsActualJobAndManualCancelsItWithoutChangingRecords()throws Exception{
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();try{SharedPreferences prefs=activity.getSharedPreferences("zamerovac",0);prefs.edit().putString("treeUri","content://synthetic/tree/root").commit();MainActivity.JsApi bridge=activity.new JsApi();String before=LocalDatabase.read(activity.getFilesDir());android.app.job.JobScheduler jobs=(android.app.job.JobScheduler)activity.getSystemService(Context.JOB_SCHEDULER_SERVICE);
        assertTrue(bridge.configure("{\"autoSync\":true,\"wifiOnly\":true,\"syncFrequency\":\"30\"}"));assertEquals(1800000,jobs.getPendingJob(14).getIntervalMillis());assertEquals(android.app.job.JobInfo.NETWORK_TYPE_UNMETERED,jobs.getPendingJob(14).getNetworkType());assertEquals("30",new SyncCadence(activity,prefs).read().mode);
        assertTrue(bridge.configure("{\"autoSync\":false,\"wifiOnly\":true,\"syncFrequency\":\"manual\"}"));assertNull(jobs.getPendingJob(14));assertFalse(SyncCadence.current(activity,prefs).automatic());assertEquals(before,LocalDatabase.read(activity.getFilesDir()));}finally{controller.pause().stop().destroy();}
    }
    @Test public void failedNativeFrequencyChangeCannotReplaceConfirmedJobOrPreferences()throws Exception{
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();try{SharedPreferences prefs=activity.getSharedPreferences("zamerovac",0);prefs.edit().putString("treeUri","content://synthetic/tree/root").commit();MainActivity.JsApi bridge=activity.new JsApi();assertTrue(bridge.configure("{\"autoSync\":true,\"wifiOnly\":false,\"syncFrequency\":\"15\"}"));java.io.File blocker=new java.io.File(activity.getNoBackupFilesDir(),"sync-cadence-v1.json.new");assertTrue(blocker.mkdir());java.nio.file.Files.write(new java.io.File(blocker,"block").toPath(),new byte[]{1});assertFalse(bridge.configure("{\"autoSync\":false,\"wifiOnly\":true,\"syncFrequency\":\"manual\"}"));assertEquals("15",new SyncCadence(activity,prefs).read().mode);assertTrue(prefs.getBoolean("autoSync",false));assertFalse(prefs.getBoolean("wifiOnly",true));android.app.job.JobScheduler jobs=(android.app.job.JobScheduler)activity.getSystemService(Context.JOB_SCHEDULER_SERVICE);assertEquals(900000,jobs.getPendingJob(14).getIntervalMillis());}finally{controller.pause().stop().destroy();}
    }
    @Test public void staleSystemPickerCannotOverwriteARecentlySelectedDriveAccount()throws Exception{
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();try{SharedPreferences prefs=activity.getSharedPreferences("zamerovac",0);prefs.edit().putString("treeUri","content://synthetic/tree/original").commit();DriveAccounts accounts=new DriveAccounts(activity.getNoBackupFilesDir());long before=accounts.revision("sync");ReflectionHelpers.setField(activity,"cloudTreeRevision",before);Account newer=new Account("newer@example.invalid","com.google");accounts.select("sync",newer);activity.onActivityResult(21,MainActivity.RESULT_OK,new Intent().setData(Uri.parse("content://synthetic/tree/stale")));assertEquals("content://synthetic/tree/original",prefs.getString("treeUri",null));assertEquals(newer,accounts.account("sync"));for(String invalid:new String[]{"file:///tmp/foreign","content://synthetic/document/not-a-tree"}){ReflectionHelpers.setField(activity,"cloudTreeRevision",accounts.revision("sync"));activity.onActivityResult(21,MainActivity.RESULT_OK,new Intent().setData(Uri.parse(invalid)));assertEquals("content://synthetic/tree/original",prefs.getString("treeUri",null));assertEquals(newer,accounts.account("sync"));}}finally{controller.pause().stop().destroy();}
    }
    @Test public void nativeDisconnectStopsOnlyItsFeatureAndSnapshotNeverExposesTokens()throws Exception{
        ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();try{SharedPreferences prefs=activity.getSharedPreferences("zamerovac",0);prefs.edit().putString("treeUri","content://synthetic/tree/original").commit();DriveAccounts accounts=new DriveAccounts(activity.getNoBackupFilesDir());Account sync=new Account("sync@example.invalid","com.google"),backup=new Account("backup@example.invalid","com.google");accounts.select("sync",sync);accounts.select("backup",backup);String before=LocalDatabase.read(activity.getFilesDir());MainActivity.JsApi bridge=activity.new JsApi();JSONObject state=new JSONObject(bridge.driveAccountState());assertEquals("sync@example.invalid",state.getJSONObject("sync").getString("account"));assertFalse(state.toString().contains("accessToken"));assertFalse(state.toString().contains(DriveHttpTest.TOKEN));bridge.driveAccountControl("sync","disconnect");Shadows.shadowOf(android.os.Looper.getMainLooper()).idle();assertEquals("none",accounts.backend("sync"));assertEquals(backup,accounts.account("backup"));assertFalse(new CloudStorage(activity,prefs).configured("sync"));assertEquals(before,LocalDatabase.read(activity.getFilesDir()));}finally{controller.pause().stop().destroy();}
    }
}
