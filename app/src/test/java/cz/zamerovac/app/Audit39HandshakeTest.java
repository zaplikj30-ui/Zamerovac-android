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
 @Test public void forgetInvalidatesNewPairingAndFreshExplicitPairingStillWorks()throws Exception{
  java.util.concurrent.atomic.AtomicBoolean revoked=new java.util.concurrent.atomic.AtomicBoolean();
  try{sockets(a.context(ar,()->true),b.context(br,()->true),
   socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->true,request->{new SyncPeerRegistry(new File(root,"a")).forget(B);revoked.set(true);return true;}),
   socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->true,request->true));fail("Revoked pending approval must fail");
  }catch(Exception safelyRefused){}
  assertTrue(revoked.get());assertFalse(ar.isTrusted(B,b.fingerprint()));
  sockets(a.context(ar,()->true),b.context(br,()->true),
   socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->true,request->true),
   socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->true,request->true));
  assertTrue(ar.isTrusted(B,b.fingerprint()));
 }
 @Test public void revocationBetweenCommitAndFinalPeerConfirmationAbortsHandshake()throws Exception{
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");
  java.util.concurrent.atomic.AtomicBoolean completed=new java.util.concurrent.atomic.AtomicBoolean(),revoked=new java.util.concurrent.atomic.AtomicBoolean();
  try{sockets(a.context(ar,()->false),b.context(br,()->false),
   socket->{PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,request->{throw new AssertionError();});completed.set(true);},
   socket->{SyncTls.secure(socket);socket.startHandshake();DataInputStream in=new DataInputStream(socket.getInputStream());DataOutputStream out=new DataOutputStream(socket.getOutputStream());PeerWire.read(in,PeerWire.MAX_HELLO);
    PeerWire.write(out,new JSONObject().put("type","hello").put("version",2).put("id",B).put("name","B").put("nonce",PeerWire.nonce()).put("paired",true),PeerWire.MAX_HELLO);
    PeerWire.read(in,PeerWire.MAX_HELLO);PeerWire.write(out,new JSONObject().put("type","approval").put("accepted",true),PeerWire.MAX_HELLO);assertEquals("committed",PeerWire.read(in,PeerWire.MAX_HELLO).getString("type"));
    ar.forget(B);revoked.set(true);PeerWire.write(out,new JSONObject().put("type","committed").put("accepted",true),PeerWire.MAX_HELLO);
   });}catch(Exception safelyRefused){}
  assertTrue(revoked.get());assertFalse(completed.get());assertFalse(ar.isTrusted(B,b.fingerprint()));
 }
 @Test public void forgetIsNotDroppedWhenAllTransferWorkersAreBusy()throws Exception{
  android.content.Context context=org.robolectric.RuntimeEnvironment.getApplication();
  SyncPeerRegistry registry=new SyncPeerRegistry(context.getNoBackupFilesDir());registry.approve(B,b.fingerprint(),"B");
  PeerCoordinator coordinator=new PeerCoordinator(context,context.getSharedPreferences("audit39-workers",0),new PeerCoordinator.Events(){public void state(JSONObject s){}public void pairing(JSONObject r){}public void saved(JSONObject d,String route){}});
  java.util.concurrent.ThreadPoolExecutor workers=org.robolectric.util.ReflectionHelpers.getField(coordinator,"workers");
  java.util.concurrent.CountDownLatch entered=new java.util.concurrent.CountDownLatch(4),release=new java.util.concurrent.CountDownLatch(1);
  try{
   for(int i=0;i<4;i++)workers.execute(()->{entered.countDown();ProviderIoTest.uninterruptible(release);});assertTrue(entered.await(3,java.util.concurrent.TimeUnit.SECONDS));
   coordinator.forget(B);
   java.util.concurrent.ExecutorService controls=org.robolectric.util.ReflectionHelpers.getField(coordinator,"controls");controls.submit(()->{}).get(3,java.util.concurrent.TimeUnit.SECONDS);
   assertFalse("Busy data workers dropped explicit revocation",registry.isTrusted(B,b.fingerprint()));
  }finally{release.countDown();coordinator.close();}
 }
}
