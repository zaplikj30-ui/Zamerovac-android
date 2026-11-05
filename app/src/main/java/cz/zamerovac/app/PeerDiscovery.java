package cz.zamerovac.app;

import android.content.Context;
import android.net.*;
import android.net.nsd.*;
import android.os.*;
import org.json.*;
import java.io.IOException;
import java.net.*;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/** mDNS advertises only an ephemeral application service, never projects or stable installation IDs. */
final class PeerDiscovery implements AutoCloseable {
    static final String SERVICE="_zamerovac._tcp.";
    interface Events {void changed();void found(Endpoint endpoint);void problem(String message);}
    static final class Endpoint {
        final String key,name,route;final InetAddress host;final int port;
        Endpoint(String key,String name,String route,InetAddress host,int port){this.key=key;this.name=name;this.route=route;this.host=host;this.port=port;}
        JSONObject json()throws Exception{return new JSONObject().put("key",key).put("name",name).put("route",route);}
    }
    private final Context context;private final NsdManager manager;private final Handler main=new Handler(Looper.getMainLooper());private final Events events;
    private final Map<String,Endpoint> endpoints=new ConcurrentHashMap<>();private final ArrayDeque<NsdServiceInfo> resolving=new ArrayDeque<>();
    private NsdManager.DiscoveryListener discovery;private NsdManager.RegistrationListener registration;private boolean closed=true,resolvingOne;private String ownName="";
    PeerDiscovery(Context context,Events events){this.context=context;manager=(NsdManager)context.getSystemService(Context.NSD_SERVICE);this.events=events;}
    static boolean local(InetAddress host){if(host==null||host.isAnyLocalAddress()||host.isMulticastAddress()||host.isLoopbackAddress())return false;byte[] bytes=host.getAddress();return host.isSiteLocalAddress()||host.isLinkLocalAddress()||bytes.length==16&&(bytes[0]&0xfe)==0xfc;}
    List<Endpoint> snapshot(){return new ArrayList<>(endpoints.values());}
    Endpoint get(String key){return endpoints.get(key);}
    void start(int port){main.post(()->startMain(port));}
    private void startMain(int port){
        if(!closed)return;closed=false;if(manager==null){events.problem("Místní vyhledávání není dostupné. Zkus Wi-Fi Direct.");return;}
        ownName="Zamerovac-"+UUID.randomUUID().toString().substring(0,8);NsdServiceInfo service=new NsdServiceInfo();service.setServiceName(ownName);service.setServiceType(SERVICE);service.setPort(port);service.setAttribute("version","2");
        registration=new NsdManager.RegistrationListener(){public void onServiceRegistered(NsdServiceInfo info){ownName=info.getServiceName();}public void onRegistrationFailed(NsdServiceInfo info,int code){events.problem("Místní službu nelze oznámit ("+code+"). Zkus Wi-Fi Direct.");}public void onServiceUnregistered(NsdServiceInfo info){}public void onUnregistrationFailed(NsdServiceInfo info,int code){}};
        discovery=new NsdManager.DiscoveryListener(){public void onDiscoveryStarted(String type){}public void onDiscoveryStopped(String type){}public void onStartDiscoveryFailed(String type,int code){events.problem("Vyhledávání v místní Wi-Fi selhalo ("+code+").");}public void onStopDiscoveryFailed(String type,int code){}public void onServiceFound(NsdServiceInfo info){main.post(()->{if(closed||ownName.equals(info.getServiceName())||!SERVICE.replaceAll("[.]$", "").equals(info.getServiceType().replaceAll("[.]$", ""))||resolving.size()>=64)return;resolving.add(info);resolveNext();});}public void onServiceLost(NsdServiceInfo info){main.post(()->{endpoints.remove("lan:"+info.getServiceName());events.changed();});}};
        try{manager.registerService(service,NsdManager.PROTOCOL_DNS_SD,registration);manager.discoverServices(SERVICE,NsdManager.PROTOCOL_DNS_SD,discovery);}catch(Exception failure){events.problem("Místní Wi-Fi není dostupná: "+failure.getMessage());}
    }
    @SuppressWarnings("deprecation") private void resolveNext(){
        if(closed||resolvingOne||resolving.isEmpty())return;resolvingOne=true;NsdServiceInfo service=resolving.remove();
        try{manager.resolveService(service,new NsdManager.ResolveListener(){public void onResolveFailed(NsdServiceInfo info,int code){main.post(()->{resolvingOne=false;resolveNext();});}public void onServiceResolved(NsdServiceInfo info){main.post(()->{resolvingOne=false;if(!closed&&local(info.getHost())&&info.getPort()>0&&info.getPort()<=65535){String key="lan:"+info.getServiceName();Endpoint endpoint=new Endpoint(key,info.getServiceName().substring(0,Math.min(80,info.getServiceName().length())),"lan",info.getHost(),info.getPort());if(endpoints.size()<64||endpoints.containsKey(key)){endpoints.put(key,endpoint);events.changed();events.found(endpoint);}}resolveNext();});}});}catch(Exception failure){resolvingOne=false;resolveNext();}
    }
    /** Bind LAN sockets to Wi-Fi so a cellular default route is never used for local sync. */
    void bindWifi(Socket socket)throws Exception{
        ConnectivityManager connectivity=(ConnectivityManager)context.getSystemService(Context.CONNECTIVITY_SERVICE);if(connectivity==null)throw new IOException("Místní Wi-Fi není dostupná");
        for(Network network:connectivity.getAllNetworks()){NetworkCapabilities capabilities=connectivity.getNetworkCapabilities(network);if(capabilities!=null&&capabilities.hasTransport(NetworkCapabilities.TRANSPORT_WIFI)&&!capabilities.hasTransport(NetworkCapabilities.TRANSPORT_VPN)){network.bindSocket(socket);return;}}
        throw new IOException("Připoj zařízení ke stejné místní Wi-Fi nebo použij Wi-Fi Direct.");
    }
    @Override public void close(){main.post(()->{closed=true;endpoints.clear();resolving.clear();resolvingOne=false;try{if(manager!=null&&discovery!=null)manager.stopServiceDiscovery(discovery);}catch(Exception ignored){}try{if(manager!=null&&registration!=null)manager.unregisterService(registration);}catch(Exception ignored){}discovery=null;registration=null;events.changed();});}
}
