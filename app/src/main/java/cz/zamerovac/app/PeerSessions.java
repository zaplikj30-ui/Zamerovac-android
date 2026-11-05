package cz.zamerovac.app;
import javax.net.ssl.SSLSocket;
import java.io.IOException;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicReference;

/** Arbitration only after mutual TLS: nearby wins over LAN, then both ends use the same initiator tie-break. */
final class PeerSessions {
    static final class Lease {
        final SSLSocket socket;final String route;final boolean preferred;
        Lease(SSLSocket socket,String route,boolean preferred){this.socket=socket;this.route=route;this.preferred=preferred;}
    }
    private final ConcurrentHashMap<String,Lease> active=new ConcurrentHashMap<>();
    private static int priority(String route){return "nearby".equals(route)?0:1;}
    Lease admit(String peer,SSLSocket socket,String route,boolean preferred){
        Lease candidate=new Lease(socket,"nearby".equals(route)?"nearby":"lan",preferred);AtomicReference<Lease> admitted=new AtomicReference<>();
        active.compute(peer,(key,previous)->{if(previous==null||priority(candidate.route)<priority(previous.route)||candidate.route.equals(previous.route)&&candidate.preferred&&!previous.preferred){if(previous!=null)try{previous.socket.close();}catch(IOException ignored){}admitted.set(candidate);return candidate;}return previous;});return admitted.get();
    }
    Lease get(String peer){return active.get(peer);}
    boolean contains(String peer){return active.containsKey(peer);}
    boolean empty(){return active.isEmpty();}
    void remove(String peer,Lease lease){active.remove(peer,lease);}
}
