package cz.zamerovac.app;

import android.content.Context;
import android.os.PowerManager;

/** CPU protection only while actual authenticated transfers run; bounded if callbacks stop. */
final class TransferPower implements AutoCloseable {
    private final PowerManager.WakeLock lock;private boolean closed;
    TransferPower(Context context){PowerManager manager=(PowerManager)context.getSystemService(Context.POWER_SERVICE);lock=manager==null?null:manager.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK,"Zamerovac:device-transfer");if(lock!=null)lock.setReferenceCounted(false);}
    synchronized void active(boolean active){if(lock==null)return;try{if(active&&!closed)lock.acquire(90000);else if(lock.isHeld())lock.release();}catch(SecurityException failure){android.util.Log.w("Zamerovac","Transfer power unavailable",failure);}}
    @Override public synchronized void close(){closed=true;active(false);}
}
