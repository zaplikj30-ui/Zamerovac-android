package cz.zamerovac.app;

import android.content.*;
import android.os.*;
import org.json.*;
import javax.net.ssl.*;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import java.util.concurrent.locks.ReentrantLock;

/** Foreground coordinator. Every route shares one peer gate and the same durable outbox. */
final class PeerCoordinator implements AutoCloseable {
    interface Events {void state(JSONObject state);void pairing(JSONObject request);void saved(JSONObject data,String transport)throws Exception;}
    private final Context context;private final SharedPreferences prefs;private final Events events;
    private final SyncPeerRegistry registry;private final PeerDataStore data;private final String id;
    private final ScheduledExecutorService ticker=Executors.newSingleThreadScheduledExecutor();
    private final ThreadPoolExecutor workers=new ThreadPoolExecutor(0,4,30,TimeUnit.SECONDS,new SynchronousQueue<>(),new ThreadPoolExecutor.AbortPolicy());
    private final Set<Socket> sockets=ConcurrentHashMap.newKeySet();private final Set<String> connecting=ConcurrentHashMap.newKeySet();
    private ReentrantLock gate(String peer){return PeerGates.get(context,peer);}
    private final Map<String,Session> sessions=new ConcurrentHashMap<>();
    private final Map<String,JSONObject> states=new ConcurrentHashMap<>();private final Map<String,String> endpoints=new ConcurrentHashMap<>();
    private final Map<String,Long> attempted=new ConcurrentHashMap<>();private final AtomicReference<Approval> approval=new AtomicReference<>();
    private final PeerDiscovery lan;private final PeerWifiDirect nearby;private volatile boolean closed;private volatile long pairingUntil;
    private volatile SSLServerSocket server;private volatile SyncTls tls;private volatile String problem="";private volatile boolean started;
    private volatile long preparedGeneration=-1;
    private static final class Approval {final PeerHandshake.Request request;final CompletableFuture<Boolean> answer=new CompletableFuture<>();Approval(PeerHandshake.Request request){this.request=request;}}
    private static final class Session {final SSLSocket socket;final boolean preferred;Session(SSLSocket socket,boolean preferred){this.socket=socket;this.preferred=preferred;}}
    PeerCoordinator(Context context,SharedPreferences prefs,Events events)throws Exception{
        this.context=context;this.prefs=prefs;this.events=events;id=DeviceIdentity.get(context.getNoBackupFilesDir());registry=new SyncPeerRegistry(context.getNoBackupFilesDir());data=new PeerDataStore(context,prefs,registry,events::saved);
        lan=new PeerDiscovery(context,new PeerDiscovery.Events(){public void changed(){publish();}public void found(PeerDiscovery.Endpoint endpoint){if(!isPairing())connect(endpoint,false);}public void problem(String message){problem=message;publish();}});
        nearby=new PeerWifiDirect(context,new PeerWifiDirect.Events(){public void changed(){publish();}public void connected(PeerDiscovery.Endpoint endpoint){connect(endpoint,true);}public void problem(String message){problem=message;publish();}});
    }
    boolean isPairing(){return !closed&&SystemClock.elapsedRealtime()<pairingUntil;}
    void start(){if(started||closed)return;started=true;submit(()->{
        try{tls=SyncTls.androidIdentity();SSLContext ssl=tls.context(registry,this::isPairing);SSLServerSocket listener=(SSLServerSocket)ssl.getServerSocketFactory().createServerSocket();listener.setReuseAddress(true);listener.bind(new InetSocketAddress(PeerWifiDirect.PORT),4);SyncTls.secure(listener);server=listener;
            if(closed){listener.close();return;}lan.start(listener.getLocalPort());if(nearby.permitted())nearby.start(false);
            Thread accept=new Thread(()->accept(listener),"ZamerovacLocalTLS");accept.setDaemon(true);accept.start();ticker.scheduleWithFixedDelay(this::tick,0,10,TimeUnit.SECONDS);publish();
        }catch(Exception failure){fail(null,failure);}});
    }
    private interface Work {void run()throws Exception;}
    private void submit(Work work){if(closed)return;try{workers.execute(()->{try{work.run();}catch(Exception failure){fail(null,failure);}});}catch(RejectedExecutionException busy){/* Bounded work: next tick retries without allocating unbounded threads. */}}
    private void accept(SSLServerSocket listener){while(!closed)try{SSLSocket socket=(SSLSocket)listener.accept();if(!PeerDiscovery.local(socket.getInetAddress())){socket.close();continue;}sockets.add(socket);try{workers.execute(()->session(socket,false,null));}catch(RejectedExecutionException busy){sockets.remove(socket);socket.close();}}catch(IOException failure){if(!closed){fail(null,failure);break;}}}
    void pair(){if(closed)return;pairingUntil=SystemClock.elapsedRealtime()+120000;problem="";start();publish();}
    void stopPairing(){pairingUntil=0;Approval pending=approval.getAndSet(null);if(pending!=null)pending.answer.complete(false);publish();}
    void scanNearby(){pair();nearby.start(true);}
    void choose(String key){if(closed||key==null||key.length()>180)return;if(key.startsWith("nearby:")){if(!isPairing()){problem="Nejdříve zapni párování na obou zařízeních.";publish();return;}nearby.connect(key);return;}PeerDiscovery.Endpoint endpoint=lan.get(key);if(endpoint==null){problem="Zařízení už není dostupné. Obnov hledání.";publish();return;}connect(endpoint,true);}
    void answer(String sessionId,boolean accept){Approval pending=approval.get();if(pending!=null&&pending.request.sessionId.equals(sessionId))pending.answer.complete(accept&&isPairing());}
    private boolean approve(PeerHandshake.Request request)throws Exception{
        if(!isPairing())return false;Approval pending=new Approval(request);if(!approval.compareAndSet(null,pending))throw new IOException("Jiné párování právě čeká na potvrzení.");
        try{events.pairing(request.json());publish();long remaining=pairingUntil-SystemClock.elapsedRealtime();return remaining>0&&pending.answer.get(remaining,TimeUnit.MILLISECONDS)&&isPairing();}
        catch(TimeoutException timeout){throw new IOException("Čas na párování vypršel. Na obou zařízeních spusť párování znovu.");}
        finally{approval.compareAndSet(pending,null);publish();}
    }
    private void connect(PeerDiscovery.Endpoint endpoint,boolean explicit){
        if(closed||tls==null||!PeerDiscovery.local(endpoint.host))return;long now=SystemClock.elapsedRealtime();if(!explicit&&now-attempted.getOrDefault(endpoint.key,-60000L)<20000)return;if(!connecting.add(endpoint.key))return;attempted.put(endpoint.key,now);
        try{workers.execute(()->{Socket raw=new Socket();SSLSocket socket=null;try{sockets.add(raw);if("lan".equals(endpoint.route))lan.bindWifi(raw);raw.connect(new InetSocketAddress(endpoint.host,endpoint.port),7000);raw.setSoTimeout(15000);socket=(SSLSocket)tls.context(registry,this::isPairing).getSocketFactory().createSocket(raw,endpoint.host.getHostAddress(),endpoint.port,true);sockets.remove(raw);sockets.add(socket);session(socket,true,endpoint.key);}catch(Exception failure){if(explicit)fail(null,failure);}finally{connecting.remove(endpoint.key);sockets.remove(raw);try{raw.close();}catch(IOException ignored){}if(socket!=null){sockets.remove(socket);try{socket.close();}catch(IOException ignored){}}}});}catch(RejectedExecutionException busy){connecting.remove(endpoint.key);}
    }
    private void session(SSLSocket socket,boolean initiator,String endpoint){
        String peerId=null;Session session=null;ReentrantLock gate=null;boolean acquired=false;long beforeGeneration=LocalDatabase.generation(context.getFilesDir());
        try{
            if(closed)return;PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,id,"Android · "+safeModel(),tls,registry,this::isPairing,this::approve);peerId=peer.id;if(endpoint!=null)endpoints.put(endpoint,peer.id);
            Session candidate=new Session(socket,initiator==(id.compareTo(peer.id)<0));AtomicBoolean admitted=new AtomicBoolean();
            sessions.compute(peer.id,(key,previous)->{if(previous==null||candidate.preferred&&!previous.preferred){if(previous!=null)try{previous.socket.close();}catch(IOException ignored){}admitted.set(true);return candidate;}return previous;});
            if(!admitted.get())return;session=candidate;gate=gate(peer.id);acquired=gate.tryLock(20,TimeUnit.SECONDS);if(!acquired||closed||sessions.get(peer.id)!=session)throw new IOException("Jiná relace zařízení ještě dokončuje zápis. Změny zůstávají ve frontě.");
            PeerGates.direct(context,peer.id);status(peer.id,"connected",0,0,"");new PeerTransfer(data,(key,phase,done,total)->{PeerGates.direct(context,key);status(key,phase,done,total,"");}).exchange(socket,peer,initiator);
            if(beforeGeneration!=LocalDatabase.generation(context.getFilesDir()))preparedGeneration=-1;
            if(isPairing())stopPairing();publish();
        }catch(Exception failure){if(!closed)fail(peerId,failure);}finally{if(acquired)gate.unlock();if(peerId!=null&&session!=null)sessions.remove(peerId,session);sockets.remove(socket);try{socket.close();}catch(IOException ignored){}}
    }
    private String safeModel(){String model=Build.MODEL==null?"zařízení":Build.MODEL;model=model.replaceAll("[\\p{Cntrl}]","");return model.substring(0,Math.min(60,model.length()));}
    private void tick(){if(closed)return;try{
        if(approval.get()!=null&&!isPairing())stopPairing();long generation=LocalDatabase.generation(context.getFilesDir());boolean all=true;
        if(generation!=preparedGeneration){JSONObject peers=registry.snapshot();for(Iterator<String> it=peers.keys();it.hasNext();){String peer=it.next();ReentrantLock gate=gate(peer);if(sessions.containsKey(peer)||!gate.tryLock()){all=false;continue;}try{data.outbox.prepare(peer);if(data.outbox.pending(peer)>0)status(peer,"waiting",0,data.outbox.pending(peer),"");}catch(Exception failure){all=false;fail(peer,failure);}finally{gate.unlock();}}if(all)preparedGeneration=generation;}
        PeerDiscovery.Endpoint direct=nearby.group();if(direct!=null&&(isPairing()||prefs.getBoolean("autoSync",true)))connect(direct,false);
        if(!isPairing()&&prefs.getBoolean("autoSync",true)){for(PeerDiscovery.Endpoint endpoint:lan.snapshot())if(!connecting.contains(endpoint.key)){String peer=endpoints.get(endpoint.key);if(peer==null||!sessions.containsKey(peer))connect(endpoint,false);}}
        publish();
    }catch(Exception failure){fail(null,failure);}}
    boolean activeTransfer(){return !sessions.isEmpty();}
    void refresh(){if(!closed)try{ticker.execute(this::publish);}catch(RejectedExecutionException ignored){}}
    void retry(){preparedGeneration=-1;attempted.clear();submit(()->{tick();PeerDiscovery.Endpoint owner=nearby.group();if(owner!=null)connect(owner,true);for(PeerDiscovery.Endpoint endpoint:lan.snapshot())connect(endpoint,true);});}
    void forget(String peer){submit(()->{if(!DeviceIdentity.valid(peer))throw new IOException("Neplatné zařízení");registry.forget(peer);data.outbox.discard(peer);Session current=sessions.get(peer);if(current!=null)current.socket.close();Approval pending=approval.get();if(pending!=null&&peer.equals(pending.request.peerId))pending.answer.complete(false);states.remove(peer);endpoints.values().removeIf(value->peer.equals(value));publish();});}
    private void status(String peer,String phase,int done,int total,String error)throws Exception{if("connected".equals(phase)||"done".equals(phase))problem="";states.put(peer,new JSONObject().put("phase",phase).put("completed",done).put("total",total).put("error",error));publish();}
    private void fail(String peer,Exception failure){String message=failure.getMessage();if(message==null)message=failure.getClass().getSimpleName();if(message.length()>220)message=message.substring(0,220);problem=message;if(peer!=null)try{status(peer,"error",0,0,message);}catch(Exception ignored){}publish();}
    JSONObject snapshot()throws Exception{
        JSONArray candidates=new JSONArray();for(PeerDiscovery.Endpoint endpoint:lan.snapshot())candidates.put(endpoint.json());JSONArray direct=nearby.snapshot();for(int i=0;i<direct.length();i++)candidates.put(direct.get(i));
        JSONObject peers=registry.snapshot();for(Iterator<String> it=peers.keys();it.hasNext();){String peer=it.next();JSONObject state=states.get(peer);peers.getJSONObject(peer).put("state",state==null?new JSONObject().put("phase","waiting"):new JSONObject(state.toString())).put("pending",data.outbox.pending(peer));}
        Approval pending=approval.get();return new JSONObject().put("enabled",prefs.getBoolean("directSyncEnabled",false)).put("active",server!=null&&!server.isClosed()&&!closed).put("pairing",isPairing()).put("pairingSeconds",Math.max(0,(pairingUntil-SystemClock.elapsedRealtime())/1000)).put("wifiDirectSupported",nearby.supported()).put("wifiDirectPermission",nearby.permitted()).put("problem",problem).put("peers",peers).put("candidates",candidates).put("approval",pending==null?JSONObject.NULL:pending.request.json());
    }
    void publish(){if(closed)return;try{events.state(snapshot());}catch(Exception failure){android.util.Log.w("Zamerovac","Local sync state unavailable",failure);}}
    @Override public void close(){if(closed)return;stopPairing();closed=true;lan.close();nearby.close();ticker.shutdownNow();workers.shutdownNow();for(Socket socket:sockets)try{socket.close();}catch(IOException ignored){}sockets.clear();SSLServerSocket listener=server;if(listener!=null)try{listener.close();}catch(IOException ignored){}server=null;}
}
