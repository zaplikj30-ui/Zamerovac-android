package cz.zamerovac.app;
import android.app.job.JobParameters;
import android.app.job.JobService;
import android.content.SharedPreferences;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.function.BooleanSupplier;

/** Android periodic best-effort sync; each scheduled attempt owns its cancellation and completion. */
public class SyncJob extends JobService {
    private static final class Attempt {final AtomicBoolean cancelled=new AtomicBoolean();volatile Thread worker;void cancel(){cancelled.set(true);if(worker!=null)worker.interrupt();}}
    private final java.util.concurrent.atomic.AtomicReference<Attempt> active=new java.util.concurrent.atomic.AtomicReference<>();
    @Override public boolean onStartJob(JobParameters params){
        Attempt attempt=new Attempt(),previous=active.getAndSet(attempt);if(previous!=null)previous.cancel();
        attempt.worker=new Thread(()->{boolean retry=false;try{SharedPreferences prefs=getSharedPreferences("zamerovac",MODE_PRIVATE);if(!attempt.cancelled.get()&&SyncCadence.current(this,prefs).automatic()&&new CloudStorage(this,prefs).configured("sync")&&claim(prefs))performSync(prefs,attempt.cancelled::get);}
        catch(Exception failure){retry=true;if(!attempt.cancelled.get())android.util.Log.w("Zamerovac","Scheduled sync failed",failure);}
        finally{active.compareAndSet(attempt,null);if(!attempt.cancelled.get())jobFinished(params,retry);}},"ScheduledSync");attempt.worker.start();return true;
    }
    boolean claim(SharedPreferences prefs)throws Exception{return new SyncCadence(this,prefs).claimCloud(new CloudStorage(this,prefs).key("sync"),false,true);}
    void performSync(SharedPreferences prefs,BooleanSupplier cancelled)throws Exception{
        CloudStorage storage=new CloudStorage(this,prefs);new SafSyncV2(this,prefs,storage.sync(false,cancelled),SyncTls.androidIdentity(),bytes->!cancelled.getAsBoolean()&&storage.allowed("sync",false,bytes)).sync();
    }
    @Override public boolean onStopJob(JobParameters params){Attempt attempt=active.get();if(attempt!=null)attempt.cancel();return true;}
    @Override public void onDestroy(){Attempt attempt=active.get();if(attempt!=null)attempt.cancel();super.onDestroy();}
}
