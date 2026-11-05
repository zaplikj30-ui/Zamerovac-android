package cz.zamerovac.app;
import android.content.SharedPreferences;
import java.io.IOException;
import java.util.UUID;

/** Random installation identity. Never derives identity from a model, account or hardware identifier. */
final class DeviceIdentity {
    static boolean valid(String value){return value!=null&&value.matches("[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}");}
    static synchronized String get(SharedPreferences prefs)throws IOException{
        String id=prefs.getString("syncDeviceId",null);if(valid(id))return id;
        id=UUID.randomUUID().toString();if(!prefs.edit().putString("syncDeviceId",id).commit())throw new IOException("Nelze potvrdit identitu instalace");return id;
    }
}
