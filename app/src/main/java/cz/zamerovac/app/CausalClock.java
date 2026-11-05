package cz.zamerovac.app;
import org.json.*;
import java.io.IOException;
import java.util.*;

/** Protocol v2 revision counters, bounded to exact JavaScript integers. */
final class CausalClock {
    static void validate(JSONObject clock)throws Exception{
        if(clock==null||clock.length()>1024)throw new IOException("Neplatná synchronizační revize");
        for(Iterator<String> it=clock.keys();it.hasNext();){String key=it.next();Object value=clock.get(key);
            if(!DeviceIdentity.valid(key)||!(value instanceof Number))throw new IOException("Neplatná synchronizační revize");
            double number=((Number)value).doubleValue();if(!Double.isFinite(number)||number<1||number>9007199254740991L||number!=Math.floor(number))throw new IOException("Neplatný čítač revize");
        }
    }
    static JSONObject clock(JSONObject record)throws Exception{
        if(!record.has("syncClock"))return new JSONObject();JSONObject result=record.optJSONObject("syncClock");validate(result);return result;
    }
    static String compare(JSONObject a,JSONObject b)throws Exception{
        validate(a);validate(b);boolean less=false,greater=false;Set<String> keys=new HashSet<>();a.keys().forEachRemaining(keys::add);b.keys().forEachRemaining(keys::add);
        for(String key:keys){long x=a.optLong(key,0),y=b.optLong(key,0);less|=x<y;greater|=x>y;}
        return less&&greater?"concurrent":less?"before":greater?"after":"equal";
    }
    static JSONObject merge(JSONObject a,JSONObject b)throws Exception{
        validate(a);validate(b);JSONObject result=new JSONObject(a.toString());for(Iterator<String> it=b.keys();it.hasNext();){String key=it.next();result.put(key,Math.max(a.optLong(key,0),b.getLong(key)));}validate(result);return result;
    }
    static JSONObject advance(JSONObject value,String device)throws Exception{
        validate(value);if(!DeviceIdentity.valid(device))throw new IOException("Neplatná identita zařízení");JSONObject next=new JSONObject(value.toString());long count=next.optLong(device,0);if(count>=9007199254740991L)throw new IOException("Vyčerpaný čítač revizí");next.put(device,count+1);validate(next);return next;
    }
    static JSONObject tombstones(JSONObject a,JSONObject b)throws Exception{
        JSONObject result=a==null?new JSONObject():new JSONObject(a.toString());if(b!=null)for(Iterator<String> it=b.keys();it.hasNext();){String id=it.next();JSONObject other=b.getJSONObject(id);result.put(id,merge(result.optJSONObject(id)==null?new JSONObject():result.getJSONObject(id),other));}return result;
    }
    static String canonical(Object value)throws Exception{
        if(value==null||value==JSONObject.NULL)return "null";
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;ArrayList<String> keys=new ArrayList<>();object.keys().forEachRemaining(keys::add);Collections.sort(keys);ArrayList<String> items=new ArrayList<>();for(String key:keys)items.add(JSONObject.quote(key)+":"+canonical(object.get(key)));return "{"+String.join(",",items)+"}";}
        if(value instanceof JSONArray){ArrayList<String> items=new ArrayList<>();JSONArray array=(JSONArray)value;for(int i=0;i<array.length();i++)items.add(canonical(array.get(i)));return "["+String.join(",",items)+"]";}
        return value instanceof String?JSONObject.quote((String)value):value.toString();
    }
}
