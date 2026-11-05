package cz.zamerovac.app;
import android.app.job.JobParameters;
import android.app.job.JobService;
import android.content.SharedPreferences;

/** Android periodic best-effort sync; the operating system decides exact run time. */
public class SyncJob extends JobService {
    private volatile boolean cancelled;
    @Override public boolean onStartJob(JobParameters params){
        cancelled=false;
        new Thread(()->{boolean retry=false;try{
            SharedPreferences prefs=getSharedPreferences("zamerovac",MODE_PRIVATE);
            if(!cancelled&&prefs.getString("treeUri",null)!=null)new SafSyncV2(this,prefs,new DocumentSyncStore(this,prefs.getString("treeUri",null)),SyncTls.androidIdentity(),bytes->BackupNetwork.allowed(this,prefs.getString("treeUri",null),false)||!prefs.getBoolean("wifiOnly",false)&&bytes<=1024*1024).sync();
        }catch(Exception ex){retry=true;android.util.Log.w("Zamerovac","Scheduled sync failed",ex);}
        finally{jobFinished(params,retry&&!cancelled);}},"ScheduledSync").start();
        return true;
    }
    @Override public boolean onStopJob(JobParameters params){cancelled=true;return true;}
}
