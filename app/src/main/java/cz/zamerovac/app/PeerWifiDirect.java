package cz.zamerovac.app;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.wifi.WpsInfo;
import android.net.wifi.p2p.*;
import android.os.*;
import org.json.*;
import java.util.*;
import java.net.*;
import java.util.function.LongSupplier;

/** Generic Android Wi-Fi Direct. Routing hints never replace pinned TLS authentication. */
final class PeerWifiDirect implements AutoCloseable {
    interface Events {
        void changed();void connected(PeerDiscovery.Endpoint endpoint);void problem(String message);
        default Map<String,String> trustedRoutes()throws Exception{return Collections.emptyMap();}
    }
    static final int PORT=42391;
    private final Context context;private final Events events;private final Handler main=new Handler(Looper.getMainLooper());
    private final WifiP2pManager manager;private final LongSupplier clock;
    private WifiP2pManager.Channel channel;private BroadcastReceiver receiver;
    private volatile boolean closed;private boolean opened,formed,automatic;private long generation,connectionRevision,nextDiscovery,connectingUntil;
    private String requestedPeer;
    private final Map<String,WifiP2pDevice> devices=new HashMap<>();private final Map<String,String> addresses=new HashMap<>();
    private volatile PeerDiscovery.Endpoint groupOwner;private volatile String groupInterface;
    PeerWifiDirect(Context context,Events events){this(context,events,(WifiP2pManager)context.getSystemService(Context.WIFI_P2P_SERVICE),SystemClock::elapsedRealtime);}
    PeerWifiDirect(Context context,Events events,WifiP2pManager manager,LongSupplier clock){this.context=context;this.events=events;this.manager=manager;this.clock=clock;}
    static boolean validAddress(String address){if(address==null||!address.matches("(?i)[0-9a-f]{2}(:[0-9a-f]{2}){5}"))return false;return (Integer.parseInt(address.substring(0,2),16)&1)==0&&!address.equalsIgnoreCase("00:00:00:00:00:00")&&!address.equalsIgnoreCase("02:00:00:00:00:00");}
    boolean supported(){return manager!=null&&context.getPackageManager().hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT);}
    boolean permitted(){String permission=Build.VERSION.SDK_INT>=33?Manifest.permission.NEARBY_WIFI_DEVICES:Manifest.permission.ACCESS_FINE_LOCATION;return context.checkSelfPermission(permission)==PackageManager.PERMISSION_GRANTED;}
    synchronized JSONArray snapshot()throws Exception{JSONArray result=new JSONArray();for(Map.Entry<String,WifiP2pDevice> entry:devices.entrySet()){String name=entry.getValue().deviceName;if(name==null||name.isEmpty())name="Android zařízení";name=name.replaceAll("[\\p{Cntrl}]","");result.put(new JSONObject().put("key",entry.getKey()).put("name",name.substring(0,Math.min(80,name.length()))).put("route","nearby"));}return result;}
    PeerDiscovery.Endpoint group(){return groupOwner;}
    /** Match the socket's local address to Android's actual group interface, never a guessed subnet or radio name. */
    boolean incoming(Socket socket){try{String name=groupInterface;if(closed||name==null||name.isEmpty())return false;NetworkInterface network=NetworkInterface.getByName(name);return network!=null&&Collections.list(network.getInetAddresses()).contains(socket.getLocalAddress());}catch(Exception unavailable){return false;}}
    void start(boolean discover){main.post(()->{if(closed)return;if(discover)automatic=false;startMain(discover);});}
    private void startMain(boolean discover){
        if(closed)return;
        if(!supported()){events.problem("Tento Android nepodporuje Wi-Fi Direct. Použij místní Wi-Fi.");return;}
        if(!permitted()){events.problem("Wi-Fi Direct vyžaduje oprávnění Zařízení v okolí; na starším Androidu polohu a zapnuté určování polohy.");return;}
        try{
            if(!opened||channel==null){
                disposeChannel();opened=true;long token=++generation;
                channel=manager.initialize(context,Looper.getMainLooper(),()->{if(closed||token!=generation)return;groupOwner=null;groupInterface=null;formed=false;opened=false;channel=null;events.problem("Spojení se službou Wi-Fi Direct bylo přerušeno. Aplikace zkusí obnovit známou cestu.");});
                if(channel==null){opened=false;events.problem("Služba Wi-Fi Direct není dostupná.");return;}
                receiver=new BroadcastReceiver(){@Override public void onReceive(Context c,Intent intent){if(closed||token!=generation||!opened)return;String action=intent.getAction();if(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION.equals(action))peers();if(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION.equals(action))connection();if(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION.equals(action)){if(intent.getIntExtra(WifiP2pManager.EXTRA_WIFI_STATE,-1)!=WifiP2pManager.WIFI_P2P_STATE_ENABLED){formed=false;groupOwner=null;groupInterface=null;events.problem("Zapni Wi-Fi pro přímé propojení.");}else{nextDiscovery=0;connection();}}}};
                IntentFilter filter=new IntentFilter();filter.addAction(WifiP2pManager.WIFI_P2P_PEERS_CHANGED_ACTION);filter.addAction(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION);filter.addAction(WifiP2pManager.WIFI_P2P_STATE_CHANGED_ACTION);
                if(Build.VERSION.SDK_INT>=33)context.registerReceiver(receiver,filter,Context.RECEIVER_EXPORTED);else context.registerReceiver(receiver,filter);
                connection();
            }
            if(discover&&channel!=null)discover();
        }catch(Exception failure){events.problem("Wi-Fi Direct: "+failure.getMessage());}
    }
    /** Foreground, permission-preserving retries; never pairs or connects an unknown address. */
    void automatic(boolean enabled){main.post(()->{
        if(closed)return;automatic=enabled;if(!enabled||!supported()||!permitted())return;
        try{if(events.trustedRoutes().isEmpty())return;if(!opened||channel==null)startMain(false);long now=clock.getAsLong();if(channel==null||formed||now<connectingUntil||now<nextDiscovery)return;nextDiscovery=now+60000;discover();}
        catch(Exception failure){events.problem("Známou přímou cestu nelze obnovit: "+failure.getMessage());}
    });}
    private void discover(){long token=generation;manager.discoverPeers(channel,new WifiP2pManager.ActionListener(){public void onSuccess(){if(!closed&&token==generation&&opened)peers();}public void onFailure(int reason){if(!closed&&token==generation&&opened)events.problem("Hledání Wi-Fi Direct se nepodařilo ("+reason+"). Změny zůstávají ve frontě.");}});}
    private void peers(){if(channel==null||!permitted())return;long token=generation;try{manager.requestPeers(channel,list->{
        if(closed||token!=generation||!opened)return;
        synchronized(this){Set<String> present=new HashSet<>();for(WifiP2pDevice device:list.getDeviceList()){if(!validAddress(device.deviceAddress)||devices.size()>=64&&!addresses.containsKey(device.deviceAddress.toLowerCase(Locale.ROOT)))continue;String address=device.deviceAddress.toLowerCase(Locale.ROOT),key=addresses.computeIfAbsent(address,value->"nearby:"+UUID.randomUUID());devices.put(key,device);present.add(key);}devices.keySet().retainAll(present);addresses.values().removeIf(key->!present.contains(key));}
        events.changed();reconnectKnown();
    });}catch(Exception failure){events.problem("Zařízení v okolí nelze načíst: "+failure.getMessage());}}
    private void reconnectKnown(){if(!automatic||formed||clock.getAsLong()<connectingUntil)return;try{
        Map<String,String> known=events.trustedRoutes();List<String> candidates=new ArrayList<>(known.keySet());Collections.sort(candidates);
        for(String address:candidates){String key; synchronized(this){key=addresses.get(address);}if(key!=null){connectMain(key,known.get(address));return;}}
    }catch(Exception failure){events.problem("Známé zařízení nelze připojit: "+failure.getMessage());}}
    private void connection(){if(channel==null||!permitted())return;long token=generation,revision=++connectionRevision;try{manager.requestConnectionInfo(channel,info->{
        if(closed||token!=generation||revision!=connectionRevision||!opened)return;groupOwner=null;groupInterface=null;boolean previouslyFormed=formed;formed=info.groupFormed;if(previouslyFormed&&!formed){requestedPeer=null;connectingUntil=0;}
        if(info.groupFormed){
            try{manager.requestGroupInfo(channel,group->{if(closed||token!=generation||revision!=connectionRevision||!opened||!formed)return;try{
                groupInterface=group==null?null:group.getInterface();
                if(!info.isGroupOwner&&PeerDiscovery.local(info.groupOwnerAddress)){String address=group!=null&&group.getOwner()!=null?group.getOwner().deviceAddress:null;
                if(!validAddress(address))address=null;else address=address.toLowerCase(Locale.ROOT);
                String expected=requestedPeer;if(expected==null&&address!=null)expected=events.trustedRoutes().get(address);
                groupOwner=new PeerDiscovery.Endpoint("nearby:owner","Wi-Fi Direct","nearby",info.groupOwnerAddress,PORT,expected,address);
                connectingUntil=0;events.connected(groupOwner);}events.changed();
            }catch(Exception failure){events.problem("Identitu přímé cesty nelze načíst: "+failure.getMessage());}});}catch(Exception failure){events.problem("Přímou skupinu nelze ověřit: "+failure.getMessage());}
        }
        events.changed();
    });}catch(Exception failure){events.problem("Přímé spojení nelze ověřit: "+failure.getMessage());}}
    void connect(String key){main.post(()->connectMain(key,null));}
    private void connectMain(String key,String expected){
        if(closed)return;
        WifiP2pDevice device;synchronized(this){device=devices.get(key);}if(device==null||channel==null||!permitted()){events.problem("Zařízení už není dostupné nebo chybí oprávnění. Obnov hledání.");return;}
        requestedPeer=expected;connectingUntil=clock.getAsLong()+45000;
        WifiP2pConfig config=new WifiP2pConfig();config.deviceAddress=device.deviceAddress;config.wps.setup=WpsInfo.PBC;config.groupOwnerIntent=0;long token=generation;
        try{manager.connect(channel,config,new WifiP2pManager.ActionListener(){public void onSuccess(){}public void onFailure(int reason){if(closed||token!=generation||!opened)return;requestedPeer=null;connectingUntil=clock.getAsLong()+15000;events.problem("Propojení Wi-Fi Direct se nepodařilo ("+reason+"). Fronta počká na další pokus.");}});}catch(Exception failure){requestedPeer=null;connectingUntil=clock.getAsLong()+15000;events.problem("Přímé propojení: "+failure.getMessage());}
    }
    private void disposeChannel(){try{if(receiver!=null)context.unregisterReceiver(receiver);}catch(Exception ignored){}receiver=null;try{if(channel!=null){manager.stopPeerDiscovery(channel,null);if(Build.VERSION.SDK_INT>=27)channel.close();}}catch(Exception ignored){}channel=null;}
    /** Do not remove an existing Android group: it may be used by another application. */
    @Override public void close(){closed=true;main.post(()->{++generation;opened=false;automatic=false;formed=false;groupOwner=null;groupInterface=null;requestedPeer=null;connectingUntil=0;nextDiscovery=0;synchronized(this){devices.clear();addresses.clear();}disposeChannel();events.changed();});}
}
