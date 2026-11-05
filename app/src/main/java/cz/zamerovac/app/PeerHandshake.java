package cz.zamerovac.app;
import javax.net.ssl.*;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.util.*;
import java.util.function.BooleanSupplier;

/** Full SHA-256 comparison on BOTH devices, followed by mutual durable approval. */
final class PeerHandshake {
    interface Approval {boolean approve(Request request)throws Exception;}
    static final class Request {
        final String sessionId=UUID.randomUUID().toString(),peerId,name,code;
        Request(String peerId,String name,String code){this.peerId=peerId;this.name=name;this.code=code;}
        JSONObject json()throws Exception{return new JSONObject().put("sessionId",sessionId).put("peerId",peerId).put("name",name).put("code",code);}
    }
    static final class Peer {final String id,name,fingerprint;Peer(String id,String name,String fingerprint){this.id=id;this.name=name;this.fingerprint=fingerprint;}}
    static Peer negotiate(SSLSocket socket,String localId,String localName,SyncTls identity,SyncPeerRegistry registry,BooleanSupplier pairing,Approval approval)throws Exception{
        return negotiate(socket,localId,localName,identity,registry,pairing,approval,null);
    }
    static Peer negotiate(SSLSocket socket,String localId,String localName,SyncTls identity,SyncPeerRegistry registry,BooleanSupplier pairing,Approval approval,String expectedPeer)throws Exception{
        if(expectedPeer!=null&&!DeviceIdentity.valid(expectedPeer))throw new IOException("Neplatná očekávaná identita zařízení");
        if(!DeviceIdentity.valid(localId))throw new IOException("Neplatná místní identita");socket.setSoTimeout(15000);SyncTls.secure(socket);socket.startHandshake();
        DataInputStream in=new DataInputStream(socket.getInputStream());DataOutputStream out=new DataOutputStream(socket.getOutputStream());String localNonce=PeerWire.nonce();String fingerprint=SyncTls.fingerprint((X509Certificate)socket.getSession().getPeerCertificates()[0]);
        JSONObject hello=new JSONObject().put("type","hello").put("version",2).put("id",localId).put("name",localName).put("nonce",localNonce).put("paired",registry.hasFingerprint(fingerprint));
        PeerWire.write(out,hello,PeerWire.MAX_HELLO);JSONObject remote=PeerWire.read(in,PeerWire.MAX_HELLO);
        if(!"hello".equals(remote.optString("type"))||!(remote.opt("version") instanceof Number)||remote.getDouble("version")!=2)throw new IOException("Nekompatibilní verze synchronizačního protokolu");
        String id=remote.getString("id"),name=remote.getString("name"),nonce=remote.getString("nonce");
        if(!DeviceIdentity.valid(id)||localId.equals(id)||name.length()>80||name.matches(".*[\\p{Cntrl}].*")||!nonce.matches("[0-9a-f]{64}"))throw new IOException("Neplatná identita protistrany");
        if(expectedPeer!=null&&!expectedPeer.equals(id))throw new IOException("Na uložené přímé cestě odpovědělo jiné zařízení. Zakázky nebyly přeneseny.");
        boolean known=registry.isTrusted(id,fingerprint);
        JSONArray endpoints=new JSONArray();JSONObject a=new JSONObject().put("id",localId).put("fingerprint",identity.fingerprint()).put("nonce",localNonce),b=new JSONObject().put("id",id).put("fingerprint",fingerprint).put("nonce",nonce);
        if(localId.compareTo(id)<0){endpoints.put(a);endpoints.put(b);}else{endpoints.put(b);endpoints.put(a);}
        String code=PeerWire.hash(("cz.zamerovac.pair.v2\n"+CausalClock.canonical(endpoints)).getBytes(StandardCharsets.UTF_8));
        boolean needsApproval=!known||!Boolean.TRUE.equals(remote.opt("paired"));boolean accepted=!needsApproval;
        if(needsApproval){if(!pairing.getAsBoolean())throw new IOException("Párování není zapnuté");accepted=approval.approve(new Request(id,name,code));}
        PeerWire.write(out,new JSONObject().put("type","approval").put("accepted",accepted),PeerWire.MAX_HELLO);socket.setSoTimeout(130000);
        JSONObject other=PeerWire.read(in,PeerWire.MAX_HELLO);if(!"approval".equals(other.optString("type"))||!Boolean.TRUE.equals(other.opt("accepted"))||!accepted)throw new IOException("Párování nebylo potvrzeno na obou zařízeních");
        registry.approve(id,fingerprint,name);registry.rememberCertificate(id,(X509Certificate)socket.getSession().getPeerCertificates()[0]);
        PeerWire.write(out,new JSONObject().put("type","committed").put("accepted",true),PeerWire.MAX_HELLO);
        JSONObject committed=PeerWire.read(in,PeerWire.MAX_HELLO);if(!"committed".equals(committed.optString("type"))||!Boolean.TRUE.equals(committed.opt("accepted")))throw new IOException("Protistrana nepotvrdila uložení párování");
        socket.setSoTimeout(15000);return new Peer(id,name,fingerprint);
    }
}
