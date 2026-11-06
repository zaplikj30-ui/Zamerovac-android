package cz.zamerovac.app;
import android.content.Context;
import android.net.*;
/** Conservative policy for an unknown/cloud DocumentsProvider; local document stores work offline. */
final class BackupNetwork {
    static boolean local(String uri){if(uri==null)return false;String authority=Uri.parse(uri).getAuthority();return "com.android.externalstorage.documents".equals(authority)||"com.android.providers.downloads.documents".equals(authority)||"com.android.providers.media.documents".equals(authority);}
    static boolean allowed(Context context,String uri,boolean explicit){if(explicit||local(uri))return true;ConnectivityManager network=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);if(network==null)return false;NetworkCapabilities capabilities=network.getNetworkCapabilities(network.getActiveNetwork());return capabilities!=null&&capabilities.hasCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);}
}
