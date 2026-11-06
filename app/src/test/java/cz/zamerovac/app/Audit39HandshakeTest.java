package cz.zamerovac.app;
import org.json.*;
import org.junit.Test;
import java.io.*;
import static org.junit.Assert.*;

/** Uses existing public synthetic certificates and real JVM mutual TLS sockets. */
public class Audit39HandshakeTest extends PeerTlsTest {
 @Test public void revokedDuringKnownHandshakeMustNotBeReapproved()throws Exception {
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");
  java.util.concurrent.atomic.AtomicBoolean revoked=new java.util.concurrent.atomic.AtomicBoolean();
  try{sockets(a.context(ar,()->false),b.context(br,()->false),
   socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,request->{throw new AssertionError("Pairing is disabled");}),
   socket->{
    SyncTls.secure(socket);socket.startHandshake();DataInputStream in=new DataInputStream(socket.getInputStream());DataOutputStream out=new DataOutputStream(socket.getOutputStream());
    PeerWire.read(in,PeerWire.MAX_HELLO);
    PeerWire.write(out,new JSONObject().put("type","hello").put("version",2).put("id",B).put("name","B").put("nonce",PeerWire.nonce()).put("paired",true),PeerWire.MAX_HELLO);
    assertTrue(PeerWire.read(in,PeerWire.MAX_HELLO).getBoolean("accepted"));
    ar.forget(B);assertFalse(ar.isTrusted(B,b.fingerprint()));revoked.set(true);
    PeerWire.write(out,new JSONObject().put("type","approval").put("accepted",true),PeerWire.MAX_HELLO);
    PeerWire.write(out,new JSONObject().put("type","committed").put("accepted",true),PeerWire.MAX_HELLO);
    PeerWire.read(in,PeerWire.MAX_HELLO);
   });}catch(Exception safelyRefused){/* A fixed implementation may abort the connection. */}
  assertTrue("Fixture must reach revocation after known-peer approval",revoked.get());
  assertFalse("Handshake silently restored explicitly revoked trust while pairing was disabled",ar.isTrusted(B,b.fingerprint()));
 }
}
