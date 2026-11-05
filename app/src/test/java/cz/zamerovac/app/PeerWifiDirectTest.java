package cz.zamerovac.app;

import android.Manifest;
import android.content.*;
import android.content.pm.PackageManager;
import android.net.wifi.p2p.*;
import android.os.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import org.mockito.ArgumentCaptor;
import java.io.*;
import java.net.*;
import java.nio.file.Files;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real adapter callbacks, mocked Android radio. No claim of physical Wi-Fi negotiation. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerWifiDirectTest {
 static final String ADDRESS="12:34:56:78:90:ab",OTHER="16:34:56:78:90:cd",B=PeerTlsTest.B;
 WifiP2pManager manager;WifiP2pManager.Channel channel;Context context;PeerWifiDirect direct;
 AtomicBoolean permission;AtomicLong clock;Map<String,String> routes;List<PeerDiscovery.Endpoint> connected;List<String> problems;List<WifiP2pDevice> devices;
 WifiP2pInfo info;WifiP2pGroup group;WifiP2pManager.ChannelListener channelLost;
 @Before public void setup()throws Exception{
  manager=mock(WifiP2pManager.class);channel=mock(WifiP2pManager.Channel.class);PackageManager packages=mock(PackageManager.class);when(packages.hasSystemFeature(PackageManager.FEATURE_WIFI_DIRECT)).thenReturn(true);permission=new AtomicBoolean(true);clock=new AtomicLong(1000);routes=new HashMap<>();connected=new ArrayList<>();problems=new ArrayList<>();devices=new ArrayList<>();info=new WifiP2pInfo();group=mock(WifiP2pGroup.class);when(group.getOwner()).thenReturn(device(ADDRESS));
  context=new ContextWrapper(RuntimeEnvironment.getApplication()){@Override public PackageManager getPackageManager(){return packages;}@Override public int checkSelfPermission(String name){return permission.get()?PackageManager.PERMISSION_GRANTED:PackageManager.PERMISSION_DENIED;}};
  when(manager.initialize(any(),any(),any())).thenAnswer(call->{channelLost=call.getArgument(2);return channel;});
  doAnswer(call->{((WifiP2pManager.ActionListener)call.getArgument(1)).onSuccess();return null;}).when(manager).discoverPeers(any(),any());
  doAnswer(call->{WifiP2pDeviceList list=mock(WifiP2pDeviceList.class);when(list.getDeviceList()).thenReturn(new ArrayList<>(devices));((WifiP2pManager.PeerListListener)call.getArgument(1)).onPeersAvailable(list);return null;}).when(manager).requestPeers(any(),any());
  doAnswer(call->{((WifiP2pManager.ConnectionInfoListener)call.getArgument(1)).onConnectionInfoAvailable(info);return null;}).when(manager).requestConnectionInfo(any(),any());
  doAnswer(call->{((WifiP2pManager.GroupInfoListener)call.getArgument(1)).onGroupInfoAvailable(group);return null;}).when(manager).requestGroupInfo(any(),any());
  direct=new PeerWifiDirect(context,new PeerWifiDirect.Events(){public void changed(){}public void connected(PeerDiscovery.Endpoint endpoint){connected.add(endpoint);}public void problem(String message){problems.add(message);}public Map<String,String> trustedRoutes(){return new HashMap<>(routes);}},manager,clock::get);
 }
 @After public void cleanup(){direct.close();idle();}
 static WifiP2pDevice device(String address){WifiP2pDevice d=new WifiP2pDevice();d.deviceAddress=address;d.deviceName="Synthetic device";return d;}
 void idle(){Shadows.shadowOf(Looper.getMainLooper()).idle();}
 void automatic(boolean enabled){direct.automatic(enabled);idle();}
 void connection(){BroadcastReceiver receiver=ReflectionHelpers.getField(direct,"receiver");assertNotNull(receiver);receiver.onReceive(context,new Intent(WifiP2pManager.WIFI_P2P_CONNECTION_CHANGED_ACTION));idle();}
 @Test public void automaticRecreatesKnownRouteAndKeepsExpectedIdentityOutOfUi()throws Exception{
  routes.put(ADDRESS,B);devices.add(device(OTHER));devices.add(device(ADDRESS.toUpperCase(Locale.ROOT)));automatic(true);
  ArgumentCaptor<WifiP2pConfig> config=ArgumentCaptor.forClass(WifiP2pConfig.class);verify(manager).connect(eq(channel),config.capture(),any());assertEquals(ADDRESS.toUpperCase(Locale.ROOT),config.getValue().deviceAddress);
  assertFalse(direct.snapshot().toString().contains(ADDRESS));assertFalse(direct.snapshot().toString().contains(B));
  info.groupFormed=true;info.isGroupOwner=false;info.groupOwnerAddress=InetAddress.getByName("192.168.49.1");connection();assertEquals(1,connected.size());PeerDiscovery.Endpoint endpoint=connected.get(0);assertEquals(B,endpoint.expectedPeer);assertEquals(ADDRESS,endpoint.nearbyAddress);assertFalse(endpoint.json().toString().contains(ADDRESS));assertFalse(endpoint.json().toString().contains(B));
  connection();assertEquals(B,connected.get(1).expectedPeer);automatic(true);verify(manager,times(1)).discoverPeers(any(),any());verify(manager,never()).removeGroup(any(),any());
 }
 @Test public void noUnknownPermissionlessDisabledOrRevokedAutoConnections()throws Exception{
  devices.add(device(OTHER));automatic(true);verify(manager,never()).initialize(any(),any(),any());
  routes.put(ADDRESS,B);permission.set(false);automatic(true);verify(manager,never()).discoverPeers(any(),any());permission.set(true);automatic(false);verify(manager,never()).discoverPeers(any(),any());
  automatic(true);verify(manager,times(1)).discoverPeers(any(),any());verify(manager,never()).connect(any(),any(),any());routes.clear();clock.addAndGet(61000);automatic(true);verify(manager,times(1)).discoverPeers(any(),any());assertTrue(connected.isEmpty());
 }
 @Test public void lostGroupRetriesAreBoundedAndBusyRadioRetainsPendingState()throws Exception{
  routes.put(ADDRESS,B);devices.add(device(ADDRESS));doAnswer(call->{((WifiP2pManager.ActionListener)call.getArgument(2)).onFailure(WifiP2pManager.BUSY);return null;}).when(manager).connect(any(),any(),any());automatic(true);
  for(int i=0;i<5;i++){clock.addAndGet(10000);automatic(true);}verify(manager,times(1)).connect(any(),any(),any());assertNull(direct.group());assertFalse(problems.isEmpty());assertTrue(problems.get(0).contains("Fronta"));
  clock.addAndGet(10001);automatic(true);verify(manager,times(2)).connect(any(),any(),any());
  info.groupFormed=true;info.isGroupOwner=true;connection();clock.addAndGet(61000);automatic(true);verify(manager,times(2)).discoverPeers(any(),any());
  info.groupFormed=false;connection();automatic(true);verify(manager,times(3)).discoverPeers(any(),any());verify(manager,times(3)).connect(any(),any(),any());
 }
 @Test public void lateGroupReplyAfterDisconnectAndCloseCannotPublishEndpoint()throws Exception{
  direct.start(false);idle();List<WifiP2pManager.GroupInfoListener> replies=new ArrayList<>();doAnswer(call->{replies.add(call.getArgument(1));return null;}).when(manager).requestGroupInfo(any(),any());
  info.groupFormed=true;info.groupOwnerAddress=InetAddress.getByName("192.168.49.1");connection();assertEquals(1,replies.size());info.groupFormed=false;connection();replies.get(0).onGroupInfoAvailable(group);assertTrue(connected.isEmpty());assertNull(direct.group());
  info.groupFormed=true;connection();direct.close();idle();replies.get(1).onGroupInfoAvailable(group);assertTrue(connected.isEmpty());assertNull(direct.group());
  clearInvocations(manager);automatic(true);direct.start(true);idle();verifyNoInteractions(manager);
 }
 @Test public void channelLossReinitializesAndOldPeerCallbackCannotConnect()throws Exception{
  routes.put(ADDRESS,B);devices.add(device(ADDRESS));List<WifiP2pManager.PeerListListener> replies=new ArrayList<>();doAnswer(call->{replies.add(call.getArgument(1));return null;}).when(manager).requestPeers(any(),any());automatic(true);assertEquals(1,replies.size());channelLost.onChannelDisconnected();clock.addAndGet(61000);automatic(true);verify(manager,times(2)).initialize(any(),any(),any());
  WifiP2pDeviceList list=mock(WifiP2pDeviceList.class);when(list.getDeviceList()).thenReturn(devices);replies.get(0).onPeersAvailable(list);verify(manager,never()).connect(any(),any(),any());replies.get(1).onPeersAvailable(list);verify(manager).connect(any(),any(),any());
 }
 @Test public void onlyAuthenticatedRouteIsDurableAndForgettingRemovesIt()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"nearby-route-").toFile();SyncPeerRegistry registry=new SyncPeerRegistry(root);String fingerprint="a".repeat(64);
  try{registry.rememberNearby(B,fingerprint,ADDRESS);fail("Unknown device acquired a route");}catch(IOException expected){}registry.approve(B,fingerprint,"Synthetic B");registry.rememberNearby(B,fingerprint,ADDRESS.toUpperCase(Locale.ROOT));assertEquals(B,new SyncPeerRegistry(root).nearbyRoutes().get(ADDRESS));
  try{registry.rememberNearby(B,"b".repeat(64),OTHER);fail("Foreign certificate changed route");}catch(IOException expected){}assertFalse(registry.nearbyRoutes().containsKey(OTHER));registry.forget(B);assertTrue(new SyncPeerRegistry(root).nearbyRoutes().isEmpty());
  for(String bad:new String[]{null,"","../peer","00:00:00:00:00:00","02:00:00:00:00:00","ff:ff:ff:ff:ff:ff","13:34:56:78:90:ab"})assertFalse(PeerWifiDirect.validAddress(bad));
 }
}
