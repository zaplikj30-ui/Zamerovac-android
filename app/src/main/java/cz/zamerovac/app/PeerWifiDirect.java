package cz.zamerovac.app;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.*;
import android.net.wifi.WpsInfo;
import android.net.wifi.p2p.*;
import android.os.*;
import org.json.*;
import java.net.*;
import java.util.*;

/** Generic Android Wi-Fi Direct. No Google Play Services or vendor APIs. TLS remains mandatory. */
final class PeerWifiDirect implements AutoCloseable {
    interface Events {void changed();void connected(PeerDiscovery.Endpoint endpoint);void problem(String message);}
    static final int PORT=42391;
    private final Context context;private final Events events;private final Handler main=new Handler(Looper.getMainLooper());
    private final WifiP2pManager manager;private WifiP2pManager.Channel channel;private BroadcastReceiver receiver;private volatile boolean opened;
    private final Map<String,WifiP2pDevice> devices=new HashMap<>();private final Map<String,String> addresses=new HashMap<>();
    private volatile PeerDiscovery.Endpoint groupOwner;
    PeerWifiDirect(Context context,Events events){this.context=context;this.events=events;manager=(WifiP2pManager)context.getSystemService(Context.WIFI_P2P_SERVICE);}
    boolean supported(){return manager!=null&&context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT);}
    boolean permitted(){String permission=Build.VERSION.SDK_INT>=33?Manifest.permission.NEARBY_WIFI_DEVICES:Manifest.permission.ACCESS_FINE_LOCATION;return context.checkSelfPermission(permission)==PackageManager.PERMISSION_GRANTED;}
    synchronized JSONArray snapshot()throws Exception{JSONArray result=new JSONArray();for(Map.Entry<String,WifiP2pDevice> entry:devices.entrySet()){String name=entry.getValue().deviceName;if(name==null||name.isEmpty())name="Android zařízení";name=name.replaceAll("[\\p{Cntrl}]","");result.put(new JSONObject().put("key",entry.getKey()).put("name",name.substring(0,Math.min(80,name.length()))).put("route","nearby"));}return result;}
    PeerDiscovery.Endpoint group(){return groupOwner;}
    void start(boolean discover){main.post(()->{if(!supported()){events.problem("Tento Android nepodporuje Wi-Fi Direct. Použij místní Wi-Fi.");return;}if(!permitted()){events.problem("Wi-Fi Direct vyžaduje oprávnění Zařízení v okolí; na starším Androidu polohu a zapnuté určování polohy.");return;}try{if(!opened){opened=true;channel=manager.initialize(context,Looper.getMainLooper(),()->{channel=null;events.problem("Spojení se službou Wi-Fi Direct bylo přerušeno. Zkus hledání znovu.");});receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent intent){String action=intent.getAction();if(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action))peers();if(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action))connection();if(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)&&intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE,-1)!=WifiP2pManager.WIFI_P2P_STATE_ENABLED)events.problem("Zapni Wi-Fi pro přímé propojení.");}};IntentFilter filter=new IntentFilter();filter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);filter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);filter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);if(Build.VERSION.SDK_INT>=33)context.registerReceiver(receiver,filter,Context.RECEIVER_EXPORTED);else context.registerReceiver(receiver,filter);connection();}if(discover&&channel!=null)manager.discoverPeers(channel,action("Hledání Wi-Fi Direct"));}catch(Exception failure){events.problem("Wi-Fi Direct: "+failure.getMessage());}});}
    private WifiP2pManager.ActionListener action(String operation){return new WifiP2pManager.ActionListener(){public void onSuccess(){}public void onFailure(int reason){events.problem(operation+" se nepodařilo ("+reason+"). Ověř oprávnění a zapnutou Wi-Fi; zůstává místní práce a fronta.");}};}
    private void peers(){if(channel==null||!permitted())return;try{manager.requestPeers(channel,list->{synchronized(this){Set<String> present=new HashSet<>();for(WifiP2pDevice device:list.getDeviceList()){if(devices.size()>=64&&!addresses.containsKey(device.deviceAddress))continue;String key=addresses.computeIfAbsent(device.deviceAddress,address->"nearby:"+UUID.randomUUID());devices.put(key,device);present.add(key);}devices.keySet().retainAll(present);addresses.values().removeIf(key->!present.contains(key));}events.changed();});}catch(Exception failure){events.problem("Zařízení v okolí nelze načíst: "+failure.getMessage());}}
    private void connection(){if(channel==null||!permitted())return;try{manager.requestConnectionInfo(channel,info->{groupOwner=null;if(info.groupFormed&&!info.isGroupOwner&&PeerDiscovery.local(info.groupOwnerAddress)){groupOwner=new PeerDiscovery.Endpoint("nearby:owner","Wi-Fi Direct","nearby",info.groupOwnerAddress,PORT);events.connected(groupOwner);}events.changed();});}catch(Exception failure){events.problem("Přímé spojení nelze ověřit: "+failure.getMessage());}}
    void connect(String key){main.post(()->{WifiP2pDevice device;synchronized(this){device=devices.get(key);}if(device==null||channel==null||!permitted()){events.problem("Zařízení už není dostupné nebo chybí oprávnění. Obnov hledání.");return;}WifiP2pConfig config=new WifiP2pConfig();config.deviceAddress=device.deviceAddress;config.wps.setup=WpsInfo.PBC;config.groupOwnerIntent=0;try{manager.connect(channel,config,action("Propojení Wi-Fi Direct"));}catch(Exception failure){events.problem("Přímé propojení: "+failure.getMessage());}});}
    /** Do not remove an existing Android group: it may be used by another application. */
    @Override public void close(){main.post(()->{opened=false;groupOwner=null;synchronized(this){devices.clear();addresses.clear();}try{if(receiver!=null)context.unregisterReceiver(receiver);}catch(Exception ignored){}receiver=null;try{if(channel!=null){manager.stopPeerDiscovery(channel,null);if(Build.VERSION.SDK_INT>=27)channel.close();}}catch(Exception ignored){}channel=null;events.changed();});}
}
