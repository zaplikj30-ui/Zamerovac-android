package cz.zamerovac.app;

import android.content.SharedPreferences;
import java.io.IOException;

/** N4-A: crash-resilient owner receipt for provider imports; no unlinking or data schema changes. */
final class MediaImportOwnership {
    private static final String PREFIX="import-owner-";
    private final SharedPreferences prefs;
    MediaImportOwnership(SharedPreferences prefs){this.prefs=prefs;}
    private static boolean valid(String value){return value!=null&&value.matches("[a-zA-Z0-9_-]{3,120}");}
    private static String key(String id){return PREFIX+id;}
    void reserve(String id,String token)throws IOException {
        if(!valid(id)||!valid(token))throw new IOException("Neplatný vlastník importu");
        synchronized(TrashPurger.LOCK){
            if(prefs.contains(key(id)))throw new IOException("Import již má vlastníka");
            if(!prefs.edit().putString(key(id),"reserved:"+token).commit())
                throw new IOException("Vlastníka přílohy nelze bezpečně potvrdit");
        }
    }
    // Failure here retains the reserved intent; the actual original is never removed.
    boolean published(String id,String token){
        if(!valid(id)||!valid(token))return false;
        synchronized(TrashPurger.LOCK){
            String state=prefs.getString(key(id),null);
            if(!("reserved:"+token).equals(state)&&!("published:"+token).equals(state))return false;
            return prefs.edit().putString(key(id),"published:"+token).commit();
        }
    }
    String owner(String id){
        if(!valid(id))return null;
        String state=prefs.getString(key(id),null);
        if(state==null)return null;
        if(state.startsWith("reserved:"))return state.substring(9);
        if(state.startsWith("published:"))return state.substring(10);
        return null;
    }
    boolean isPublished(String id){return valid(id)&&prefs.getString(key(id),"").startsWith("published:");}
}
