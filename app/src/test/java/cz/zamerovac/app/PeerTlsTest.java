package cz.zamerovac.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import javax.net.ssl.*;
import java.io.*;
import java.net.*;
import java.security.*;
import java.security.cert.X509Certificate;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

/** Real JVM TLS sockets with public synthetic test-only keys; no Android radio or production keys. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerTlsTest {
 static final String A="11111111-1111-4111-8111-111111111111",B="22222222-2222-4222-8222-222222222222",C="33333333-3333-4333-8333-333333333333";
 File root;SyncTls a,b,rogue;SyncPeerRegistry ar,br;
 @Before public void setup()throws Exception{
  root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"peer-tls-").toFile();a=material("a");b=material("b");rogue=material("rogue");ar=new SyncPeerRegistry(new File(root,"a"));br=new SyncPeerRegistry(new File(root,"b"));
 }
 static SyncTls material(String fixture)throws Exception{
  try(InputStream in=PeerTlsTest.class.getClassLoader().getResourceAsStream("sync-tls-fixtures/"+fixture+".p12.b64")){
   assertNotNull(in);byte[] bytes=java.util.Base64.getMimeDecoder().decode(in.readAllBytes());KeyStore keys=KeyStore.getInstance("PKCS12");keys.load(new ByteArrayInputStream(bytes),"synthetic".toCharArray());return new SyncTls((PrivateKey)keys.getKey("peer","synthetic".toCharArray()),new X509Certificate[]{(X509Certificate)keys.getCertificate("peer")});
  }
 }
 static boolean contains(Throwable error,String message){if(String.valueOf(error.getMessage()).contains(message))return true;if(error.getCause()!=null&&contains(error.getCause(),message))return true;for(Throwable suppressed:error.getSuppressed())if(contains(suppressed,message))return true;return false;}
 interface Endpoint {void run(SSLSocket socket)throws Exception;}
 void sockets(SSLContext serverContext,SSLContext clientContext,Endpoint server,Endpoint client)throws Exception{
  ExecutorService workers=Executors.newSingleThreadExecutor();
  try(SSLServerSocket listener=(SSLServerSocket)serverContext.getServerSocketFactory().createServerSocket(0,4,InetAddress.getLoopbackAddress())){
   SyncTls.secure(listener);listener.setSoTimeout(5000);
   Future<?> result=workers.submit(()->{try(SSLSocket socket=(SSLSocket)listener.accept()){server.run(socket);}catch(Exception failure){throw new CompletionException(failure);}});
   Exception failure=null;try(SSLSocket socket=(SSLSocket)clientContext.getSocketFactory().createSocket(InetAddress.getLoopbackAddress(),listener.getLocalPort())){client.run(socket);}catch(Exception error){failure=error;}
   try{result.get(10,TimeUnit.SECONDS);}catch(ExecutionException error){if(failure==null)failure=(Exception)error.getCause();else failure.addSuppressed(error.getCause());}
   if(failure!=null)throw failure;
  }finally{workers.shutdownNow();}
 }
 @Test public void mutualApprovalBindsCertificatesBeforeExactEncryptedPayload()throws Exception{
  List<String> codes=Collections.synchronizedList(new ArrayList<>());AtomicInteger approved=new AtomicInteger();
  PeerHandshake.Approval accept=request->{codes.add(request.code);approved.incrementAndGet();return true;};
  sockets(a.context(ar,()->true),b.context(br,()->true),socket->{
   PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,A,"Synthetic A",a,ar,()->true,accept);assertEquals(B,peer.id);
   JSONObject incoming=PeerWire.read(new DataInputStream(socket.getInputStream()),PeerWire.MAX_JSON);assertEquals("1585,800001",incoming.getString("measure"));
   PeerWire.write(new DataOutputStream(socket.getOutputStream()),new JSONObject().put("type","receipt").put("measure",incoming.getString("measure")).put("text","žárovka"),PeerWire.MAX_JSON);
  },socket->{
   PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,B,"Synthetic B",b,br,()->true,accept);assertEquals(A,peer.id);
   PeerWire.write(new DataOutputStream(socket.getOutputStream()),new JSONObject().put("type","sample").put("measure","1585,800001"),PeerWire.MAX_JSON);
   JSONObject receipt=PeerWire.read(new DataInputStream(socket.getInputStream()),PeerWire.MAX_JSON);assertEquals("1585,800001",receipt.getString("measure"));assertEquals("žárovka",receipt.getString("text"));
  });
  assertEquals(2,approved.get());assertEquals(codes.get(0),codes.get(1));assertTrue(codes.get(0).matches("[a-f0-9]{64}"));assertTrue(ar.isTrusted(B,b.fingerprint()));assertTrue(br.isTrusted(A,a.fingerprint()));
 }
 @Test public void rejectedPairingSavesNeitherTrustBinding()throws Exception{
  try{sockets(a.context(ar,()->true),b.context(br,()->true),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->true,request->true),socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->true,request->false));fail("Rejected pairing completed");}catch(IOException expected){assertTrue(expected.toString(),contains(expected,"Párování nebylo potvrzeno"));}
  assertEquals(0,ar.snapshot().length());assertEquals(0,br.snapshot().length());
 }
 @Test public void pinnedReconnectDoesNotNeedAnotherApprovalAndUnknownCertificateIsDenied()throws Exception{
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");PeerHandshake.Approval unexpected=request->{throw new AssertionError("Known peer asked to pair again");};
  sockets(a.context(ar,()->false),b.context(br,()->false),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,unexpected),socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->false,unexpected));
  try{sockets(a.context(ar,()->false),rogue.context(br,()->false),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,unexpected),socket->PeerHandshake.negotiate(socket,B,"B",rogue,br,()->false,unexpected));fail("Unpinned certificate connected");}catch(Exception expected){assertTrue(expected.toString(),contains(expected,"Zařízení není spárované"));}
  assertEquals(b.fingerprint(),ar.snapshot().getJSONObject(B).getString("fingerprint"));
 }
 @Test public void oneSidedDurablePairingRequiresFreshComparisonOnBothScreens()throws Exception{
  ar.approve(B,b.fingerprint(),"B");AtomicInteger count=new AtomicInteger();List<String> codes=Collections.synchronizedList(new ArrayList<>());PeerHandshake.Approval accept=request->{count.incrementAndGet();codes.add(request.code);return true;};
  sockets(a.context(ar,()->true),b.context(br,()->true),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->true,accept),socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->true,accept));assertEquals(2,count.get());assertEquals(codes.get(0),codes.get(1));assertTrue(ar.isTrusted(B,b.fingerprint()));assertTrue(br.isTrusted(A,a.fingerprint()));
 }
 @Test public void certificateCannotClaimAnotherInstallIdentityEvenDuringPairing()throws Exception{
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");
  try{sockets(a.context(ar,()->true),b.context(br,()->true),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->true,request->true),socket->PeerHandshake.negotiate(socket,C,"Spoof",b,br,()->true,request->true));fail("Certificate spoofed another install ID");}catch(Exception expected){assertTrue(expected.toString(),contains(expected,"Certifikát patří jinému zařízení"));}
  assertFalse(ar.snapshot().has(C));assertTrue(ar.isTrusted(B,b.fingerprint()));
 }
 @Test public void revokedBindingAndOversizeFramesAreRejected()throws Exception{
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");ar.forget(B);assertFalse(ar.hasFingerprint(b.fingerprint()));
  try{sockets(a.context(ar,()->false),b.context(br,()->false),socket->PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,request->true),socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->false,request->true));fail("Revoked peer connected");}catch(Exception expected){assertTrue(expected.toString(),contains(expected,"Zařízení není spárované"));}
  for(int size:new int[]{-1,0,PeerWire.MAX_JSON+1,Integer.MAX_VALUE}){ByteArrayOutputStream bytes=new ByteArrayOutputStream();new DataOutputStream(bytes).writeInt(size);try{PeerWire.read(new DataInputStream(new ByteArrayInputStream(bytes.toByteArray())),PeerWire.MAX_JSON);fail("Invalid frame allocated");}catch(IOException expected){}}
 }
 @Test public void rememberedRouteMustAnswerWithExpectedPinnedIdentityBeforeAnyPayload()throws Exception{
  ar.approve(B,b.fingerprint(),"B");br.approve(A,a.fingerprint(),"A");AtomicInteger payloads=new AtomicInteger();PeerHandshake.Approval unexpected=request->{throw new AssertionError("Automatic route asked to pair");};
  sockets(a.context(ar,()->false),b.context(br,()->false),socket->{PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,unexpected,B);payloads.incrementAndGet();},socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->false,unexpected,A));assertEquals(1,payloads.get());payloads.set(0);
  try{sockets(a.context(ar,()->false),b.context(br,()->false),socket->{PeerHandshake.negotiate(socket,A,"A",a,ar,()->false,unexpected,C);payloads.incrementAndGet();},socket->PeerHandshake.negotiate(socket,B,"B",b,br,()->false,unexpected,A));fail("Wrong remembered identity received payload");}catch(Exception expected){assertTrue(expected.toString(),contains(expected,"odpovědělo jiné zařízení"));}
  assertEquals(0,payloads.get());assertFalse(ar.snapshot().has(C));assertTrue(ar.isTrusted(B,b.fingerprint()));
 }
}
