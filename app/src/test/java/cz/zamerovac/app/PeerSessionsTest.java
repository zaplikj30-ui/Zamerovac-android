package cz.zamerovac.app;
import javax.net.ssl.SSLSocket;
import org.junit.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
public class PeerSessionsTest {
 @Test public void authenticatedNearbySupersedesEitherLanDirectionButLanCannotDisplaceNearby()throws Exception{
  for(boolean direction:new boolean[]{false,true}){PeerSessions sessions=new PeerSessions();SSLSocket lan=mock(SSLSocket.class),nearby=mock(SSLSocket.class),late=mock(SSLSocket.class);PeerSessions.Lease first=sessions.admit("peer",lan,"lan",direction);PeerSessions.Lease preferred=sessions.admit("peer",nearby,"nearby",!direction);assertNotNull(preferred);verify(lan).close();assertNull(sessions.admit("peer",late,"lan",true));assertSame(preferred,sessions.get("peer"));sessions.remove("peer",first);assertSame(preferred,sessions.get("peer"));verify(nearby,never()).close();sessions.remove("peer",preferred);assertTrue(sessions.empty());assertNotNull(sessions.admit("peer",late,"lan",true));}
 }
 @Test public void sameRouteTieUsesInitiatorPreferenceAndDifferentPeersStayIndependent()throws Exception{
  PeerSessions sessions=new PeerSessions();SSLSocket other=mock(SSLSocket.class),first=mock(SSLSocket.class),winner=mock(SSLSocket.class);PeerSessions.Lease unrelated=sessions.admit("other",other,"nearby",false);assertNotNull(sessions.admit("peer",first,"nearby",false));PeerSessions.Lease preferred=sessions.admit("peer",winner,"nearby",true);assertNotNull(preferred);verify(first).close();assertNull(sessions.admit("peer",mock(SSLSocket.class),"nearby",false));assertNull(sessions.admit("peer",mock(SSLSocket.class),"nearby",true));assertSame(unrelated,sessions.get("other"));assertSame(preferred,sessions.get("peer"));
 }
 @Test public void simultaneousRoutesConvergeOnOneNearbyLeaseWithoutStaleRemoval()throws Exception{
  PeerSessions sessions=new PeerSessions();ExecutorService pool=Executors.newFixedThreadPool(4);CountDownLatch start=new CountDownLatch(1);List<Future<PeerSessions.Lease>> attempts=new ArrayList<>();try{for(int i=0;i<16;i++){final int index=i;attempts.add(pool.submit(()->{start.await();return sessions.admit("peer",mock(SSLSocket.class),index%3==0?"nearby":"lan",index%2==0);}));}start.countDown();List<PeerSessions.Lease> admitted=new ArrayList<>();for(Future<PeerSessions.Lease> attempt:attempts){PeerSessions.Lease lease=attempt.get(10,TimeUnit.SECONDS);if(lease!=null)admitted.add(lease);}PeerSessions.Lease winner=sessions.get("peer");assertEquals("nearby",winner.route);assertTrue(winner.preferred);for(PeerSessions.Lease old:admitted)if(old!=winner)sessions.remove("peer",old);assertSame(winner,sessions.get("peer"));}finally{pool.shutdownNow();}
 }
}
