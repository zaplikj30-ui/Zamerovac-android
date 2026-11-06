package cz.zamerovac.app;
import android.content.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncCadenceTest {
 private Context context;private SharedPreferences prefs;private File home;private SyncCadence cadence;private final AtomicLong wall=new AtomicLong(100000000),elapsed=new AtomicLong(1000000);
 @Before public void setup()throws Exception{context=RuntimeEnvironment.getApplication();prefs=context.getSharedPreferences("cadence-test",0);prefs.edit().clear().commit();home=Files.createTempDirectory(context.getCacheDir().toPath(),"cadence-").toFile();cadence=reopen();}
 private SyncCadence reopen(){return new SyncCadence(home,prefs,wall::get,elapsed::get);}
 @Test public void defaultAndLegacySettingsKeepTheirMeaning()throws Exception{
  SyncCadence.State value=cadence.read();assertEquals("auto",value.mode);assertTrue(value.automatic());assertEquals(20000,value.local());assertEquals(60000,value.cloud(false));assertEquals(900000,value.cloud(true));prefs.edit().putBoolean("autoSync",false).putBoolean("wifiOnly",true).commit();assertFalse(cadence.read().automatic());assertTrue(cadence.read().wifiOnly);assertFalse(cadence.claimCloud("store",false,false));assertTrue(cadence.claimCloud("store",true,false));
 }
 @Test public void explicitIntervalsAreExactInForegroundAndJobAndSurviveReopen()throws Exception{
  for(String mode:new String[]{"15","30","60"}){cadence.save(mode,true,true);SyncCadence.State state=reopen().read();long interval=Long.parseLong(mode)*60000;assertEquals(interval,state.local());assertEquals(interval,state.cloud(false));assertEquals(interval,state.cloud(true));String store="store-"+mode;assertTrue(cadence.claimCloud(store,false,false));assertFalse(reopen().claimCloud(store,false,true));wall.addAndGet(interval-1);elapsed.addAndGet(interval-1);assertFalse(cadence.claimCloud(store,false,false));wall.incrementAndGet();elapsed.incrementAndGet();assertTrue(reopen().claimCloud(store,false,true));}
 }
 @Test public void foregroundAndJobShareDurableAttemptAndAccountSwitchDoesNotWaitForOldStore()throws Exception{
  cadence.save("auto",true,false);assertTrue(cadence.claimCloud("one",false,true));wall.addAndGet(60000);elapsed.addAndGet(60000);assertTrue(reopen().claimCloud("one",false,false));assertFalse(reopen().claimCloud("one",false,true));assertTrue(reopen().claimCloud("two",false,true));assertFalse(cadence.claimCloud("two",false,false));assertTrue(cadence.claimCloud("two",true,false));
 }
 @Test public void manualAndDisabledModesNeverClaimAutomaticallyButExplicitRetryWorks()throws Exception{
  for(boolean enabled:new boolean[]{false,true}){cadence.save("manual",enabled,false);assertFalse(reopen().read().automatic());assertFalse(cadence.claimCloud("store",false,false));assertFalse(cadence.claimCloud("store",false,true));assertTrue(cadence.claimCloud("store",true,false));}
  cadence.save("30",false,true);assertFalse(cadence.claimCloud("new",false,true));cadence.save("30",true,true);assertTrue(cadence.claimCloud("new",false,true));
 }
 @Test public void clockRollbackRebootAndLongWaitCannotStrandQueue()throws Exception{
  cadence.save("15",true,false);assertTrue(cadence.claimCloud("store",false,false));wall.set(1);elapsed.addAndGet(900000);assertTrue(cadence.claimCloud("store",false,false));wall.set(0);elapsed.set(0);assertTrue(cadence.claimCloud("store",false,true));wall.set(900000);assertTrue(cadence.claimCloud("store",false,true));
 }
 @Test public void twoEnginesCannotBothClaimTheSameAutomaticAttempt()throws Exception{
  cadence.save("15",true,false);CountDownLatch start=new CountDownLatch(1);AtomicInteger claims=new AtomicInteger();ExecutorService pool=Executors.newFixedThreadPool(2);try{Callable<Void> work=()->{start.await();if(reopen().claimCloud("same",false,false))claims.incrementAndGet();return null;};Future<Void> one=pool.submit(work),two=pool.submit(work);start.countDown();one.get(2,TimeUnit.SECONDS);two.get(2,TimeUnit.SECONDS);assertEquals(1,claims.get());}finally{pool.shutdownNow();}
 }
 @Test public void failedWriteCannotActivateUnconfirmedModeOrConsumeAttempt()throws Exception{
  cadence.save("30",true,false);File block=new File(home,"sync-cadence-v1.json.new");assertTrue(block.mkdir());Files.write(new File(block,"block").toPath(),new byte[]{1});try{cadence.save("manual",false,true);fail("Unconfirmed settings accepted");}catch(IOException expected){}assertEquals("30",reopen().read().mode);assertFalse(reopen().read().wifiOnly);try{cadence.claimCloud("store",false,false);fail("Unconfirmed claim accepted");}catch(IOException expected){}new File(block,"block").delete();block.delete();assertTrue(reopen().claimCloud("store",false,false));
 }
 @Test public void invalidInputAndCorruptJournalFailClosedWithoutChangingDatabase()throws Exception{
  cadence.save("15",true,true);for(String mode:new String[]{"", "0","1","120","Auto", "<script>"}){try{cadence.save(mode,true,false);fail("Invalid mode accepted");}catch(IOException expected){}assertEquals("15",cadence.read().mode);}
  SharedPreferences nativePrefs=context.getSharedPreferences("zamerovac",0);String before=LocalDatabase.read(context.getFilesDir());for(String text:new String[]{"{}","{\"autoSync\":\"true\",\"wifiOnly\":false}","{\"autoSync\":true,\"wifiOnly\":false,\"syncFrequency\":15}","x".repeat(4097)}){try{SyncCadence.configure(context,nativePrefs,text);fail("Invalid configure accepted");}catch(Exception expected){}}
  File corrupt=new File(context.getNoBackupFilesDir(),"sync-cadence-v1.json");Files.write(corrupt.toPath(),"{broken".getBytes(java.nio.charset.StandardCharsets.UTF_8));assertFalse(SyncCadence.current(context,nativePrefs).automatic());assertTrue(SyncCadence.current(context,nativePrefs).wifiOnly);assertEquals(before,LocalDatabase.read(context.getFilesDir()));
 }
}
