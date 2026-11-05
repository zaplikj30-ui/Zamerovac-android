package cz.zamerovac.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;

/** User-enabled connected-device foreground service. No project data in its notification. */
public class DirectSyncService extends Service {
    static final String STOP="cz.zamerovac.app.STOP_DIRECT_SYNC",CHANNEL="zamerovac-device-sync-v2";
    static final int NOTIFICATION=42391;
    private boolean foreground;
    static void start(Context context){context.startForegroundService(new Intent(context,DirectSyncService.class));}
    static void stop(Context context){context.stopService(new Intent(context,DirectSyncService.class));PeerRuntime.get(context).ready();PeerRuntime.get(context).stop();}
    @Override public void onCreate(){super.onCreate();}
    @Override public int onStartCommand(Intent intent,int flags,int startId){
        android.content.SharedPreferences prefs=getSharedPreferences("zamerovac",MODE_PRIVATE);
        if(intent!=null&&STOP.equals(intent.getAction())){
            if(!prefs.edit().putBoolean("directSyncEnabled",false).commit())android.util.Log.w("Zamerovac","Cannot persist disabled device sync");
            PeerRuntime.get(this).ready();PeerRuntime.get(this).stop();stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;stopSelf();return START_NOT_STICKY;
        }
        if(!prefs.getBoolean("directSyncEnabled",false)){stopSelf();return START_NOT_STICKY;}
        try{
            if(!foreground){NotificationManager manager=getSystemService(NotificationManager.class);NotificationChannel channel=new NotificationChannel(CHANNEL,"Propojení zařízení",NotificationManager.IMPORTANCE_LOW);channel.setDescription("Místní synchronizace mezi spárovanými zařízeními");channel.setShowBadge(false);manager.createNotificationChannel(channel);
                PendingIntent open=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                PendingIntent stop=PendingIntent.getService(this,1,new Intent(this,DirectSyncService.class).setAction(STOP),PendingIntent.FLAG_UPDATE_CURRENT|PendingIntent.FLAG_IMMUTABLE);
                Notification notification=new Notification.Builder(this,CHANNEL).setSmallIcon(android.R.drawable.stat_notify_sync).setContentTitle("Zaměřovač – propojení zařízení").setContentText("Čeká na spárovaná zařízení nebo přenáší změny.").setContentIntent(open).setOngoing(true).setOnlyAlertOnce(true).setVisibility(Notification.VISIBILITY_PRIVATE).addAction(new Notification.Action.Builder(android.R.drawable.ic_menu_close_clear_cancel,"Vypnout místní přenos",stop).build()).build();
                if(Build.VERSION.SDK_INT>=34)startForeground(NOTIFICATION,notification,ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE);else startForeground(NOTIFICATION,notification);foreground=true;
            }
            PeerRuntime.get(this).ready();PeerRuntime.get(this).coordinator().start();return START_STICKY;
        }catch(Exception failure){android.util.Log.w("Zamerovac","Background device sync unavailable",failure);PeerRuntime.get(this).stop();PeerRuntime.get(this).problem("Android nepovolil přenos na pozadí. Zakázky a fronta zůstávají uložené; zkus místní přenos znovu.");stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;stopSelf();return START_NOT_STICKY;}
    }
    @Override public IBinder onBind(Intent intent){return null;}
    @Override public void onDestroy(){PeerRuntime.get(this).stop();if(foreground)stopForeground(STOP_FOREGROUND_REMOVE);foreground=false;super.onDestroy();}
}
