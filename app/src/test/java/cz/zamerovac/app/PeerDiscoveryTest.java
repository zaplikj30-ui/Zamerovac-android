package cz.zamerovac.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.net.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerDiscoveryTest {
 @Test public void localRoutesRejectInternetLoopbackMulticastAndWildcard()throws Exception{
  for(String address:new String[]{"192.168.49.1","10.0.0.1","172.16.0.5","fe80::1","fd12::1234"})assertTrue(address,PeerDiscovery.local(InetAddress.getByName(address)));
  for(String address:new String[]{"127.0.0.1","0.0.0.0","8.8.8.8","224.0.0.251","::1","::","ff02::fb","2001:4860:4860::8888"})assertFalse(address,PeerDiscovery.local(InetAddress.getByName(address)));assertFalse(PeerDiscovery.local(null));
 }
 @Test public void missingRadioSupportAndPermissionDoNotInventConnectedDevices()throws Exception{
  PeerWifiDirect direct=new PeerWifiDirect(RuntimeEnvironment.getApplication(),new PeerWifiDirect.Events(){public void changed(){}public void connected(PeerDiscovery.Endpoint endpoint){fail("Unsupported radio reported a connection");}public void problem(String message){}});assertFalse(direct.permitted());assertEquals(0,direct.snapshot().length());assertNull(direct.group());direct.close();
 }
}
