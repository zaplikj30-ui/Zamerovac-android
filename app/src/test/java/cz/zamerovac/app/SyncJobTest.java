package cz.zamerovac.app;
import android.app.job.JobParameters;
import android.content.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ServiceController;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.function.BooleanSupplier;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncJobTest {
 public static class Holding extends SyncJob {
  final List<BooleanSupplier> cancellations=new CopyOnWriteArrayList<>();final List<Thread> workers=new CopyOnWriteArrayList<>();final CountDownLatch first=new CountDownLatch(1),second=new CountDownLatch(1),releaseFirst=new CountDownLatch(1),releaseSecond=new CountDownLatch(1);boolean fail,hold=true;
  @Override void performSync(SharedPreferences prefs,BooleanSupplier cancelled)throws Exception{int index=cancellations.size();cancellations.add(cancelled);workers.add(Thread.currentThread());(index==0?first:second).countDown();if(fail)throw new IOException("synthetic scheduled failure");if(hold){CountDownLatch release=index==0?releaseFirst:releaseSecond;while(true)try{release.await();return;}catch(InterruptedException ignored){/* A provider may ignore interruption; cancellation still belongs to this attempt. */}}}
 }
 @Before public void prefs(){RuntimeEnvironment.getApplication().getSharedPreferences("zamerovac",0).edit().clear().putString("treeUri","content://synthetic/tree/root").putBoolean("autoSync",true).commit();}
 @Test public void oldCancelledWorkerCannotClearOrCompleteNewAttempt()throws Exception{
  ServiceController<Holding> controller=Robolectric.buildService(Holding.class).create();Holding service=controller.get();try{assertTrue(service.onStartJob(mock(JobParameters.class)));assertTrue(service.first.await(2,TimeUnit.SECONDS));assertTrue(service.onStopJob(mock(JobParameters.class)));assertTrue(service.cancellations.get(0).getAsBoolean());assertFalse(Shadows.shadowOf(service).getIsJobFinished());assertTrue(service.onStartJob(mock(JobParameters.class)));assertTrue(service.second.await(2,TimeUnit.SECONDS));AtomicReference<?> active=ReflectionHelpers.getField(service,"active");Object second=active.get();service.releaseFirst.countDown();service.workers.get(0).join(2000);assertFalse(service.workers.get(0).isAlive());assertSame(second,active.get());assertFalse(service.cancellations.get(1).getAsBoolean());assertFalse(Shadows.shadowOf(service).getIsJobFinished());service.onStopJob(mock(JobParameters.class));assertTrue(service.cancellations.get(1).getAsBoolean());service.releaseSecond.countDown();service.workers.get(1).join(2000);assertFalse(Shadows.shadowOf(service).getIsJobFinished());}
  finally{service.releaseFirst.countDown();service.releaseSecond.countDown();controller.destroy();}
 }
 @Test public void successfulAndFailedUncancelledAttemptsReportCorrectRetry()throws Exception{
  for(boolean fail:new boolean[]{false,true}){ServiceController<Holding> controller=Robolectric.buildService(Holding.class).create();Holding service=controller.get();service.hold=false;service.fail=fail;try{service.onStartJob(mock(JobParameters.class));assertTrue(service.first.await(2,TimeUnit.SECONDS));service.workers.get(0).join(2000);assertTrue(Shadows.shadowOf(service).getIsJobFinished());assertEquals(fail,Shadows.shadowOf(service).getIsRescheduleNeeded());}finally{controller.destroy();}}
 }
 @Test public void disabledAutoSyncNeverCallsEngine()throws Exception{
  RuntimeEnvironment.getApplication().getSharedPreferences("zamerovac",0).edit().putBoolean("autoSync",false).commit();ServiceController<Holding> controller=Robolectric.buildService(Holding.class).create();Holding service=controller.get();try{service.onStartJob(mock(JobParameters.class));long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);while(!Shadows.shadowOf(service).getIsJobFinished()&&System.nanoTime()<deadline)Thread.sleep(10);assertTrue(Shadows.shadowOf(service).getIsJobFinished());assertTrue(service.cancellations.isEmpty());assertFalse(Shadows.shadowOf(service).getIsRescheduleNeeded());}finally{controller.destroy();}
 }
}
