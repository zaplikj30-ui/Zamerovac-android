package cz.zamerovac.app;
import android.content.Context;
import java.util.concurrent.*;
import java.util.concurrent.locks.ReentrantLock;
final class PeerGates {
 private static final ConcurrentHashMap<String,ReentrantLock> GATES=new ConcurrentHashMap<>();
 private static final ConcurrentHashMap<String,Long> DIRECT=new ConcurrentHashMap<>();
 private static String key(Context context,String peer){return context.getNoBackupFilesDir().getAbsolutePath()+"/"+peer;}
 static ReentrantLock get(Context context,String peer){return GATES.computeIfAbsent(key(context,peer),ignored->new ReentrantLock());}
 static void direct(Context context,String peer){DIRECT.put(key(context,peer),System.nanoTime());}
 static boolean recentlyDirect(Context context,String peer){Long last=DIRECT.get(key(context,peer));return last!=null&&System.nanoTime()-last<TimeUnit.SECONDS.toNanos(30);}
}
