package cz.zamerovac.app;

import android.app.*;
import android.content.*;
import android.content.pm.ServiceInfo;
import android.os.*;
import android.webkit.WebView;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.*;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import org.robolectric.shadows.ShadowService;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real Android service/activity lifecycle; transfer/radio are tested separately with TLS sockets. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DirectSyncServiceTest {
 Context context;PeerRuntime runtime;PeerCoordinator coordinator;AtomicReference<PeerCoordinator.Events> events;
 @Before public void setup()throws Exception{
  context=RuntimeEnvironment.getApplication();context.getSharedPreferences("zamerovac",0).edit().clear().commit();coordinator=mock(PeerCoordinator.class);when(coordinator.snapshot()).thenAnswer(call->new JSONObject().put("enabled",true).put("active",false));events=new AtomicReference<>();runtime=new PeerRuntime(context,(app,prefs,callbacks)->{assertSame(context,app);events.set(callbacks);return coordinator;});ReflectionHelpers.setStaticField(PeerRuntime.class,"shared",runtime);
 }
 @After public void cleanup(){runtime.stop();ReflectionHelpers.setStaticField(PeerRuntime.class,"shared",null);}
 String data(String value){return "{\"schema\":1,\"records\":[{\"id\":\"synthetic-note\",\"kind\":\"note\",\"text\":\""+value+"\"}]}";}
 void enabled(){context.getSharedPreferences("zamerovac",0).edit().putBoolean("directSyncEnabled",true).commit();}
 @Test public void serviceOwnsOneCoordinatorAndPrivateNotificationWithExplicitStop()throws Exception{
  enabled();LocalDatabase.write(context.getFilesDir(),data("1585,800001"));String original=LocalDatabase.read(context.getFilesDir());SyncQueueStore queue=new SyncQueueStore(context.getNoBackupFilesDir());String pending="{\"version\":2,\"revision\":1,\"jobs\":[{\"id\":\""+"a".repeat(64)+"\",\"hash\":\""+"b".repeat(64)+"\",\"peer\":\""+PeerTlsTest.B+"\",\"kind\":\"blob\",\"size\":123,\"attempts\":1,\"nextAttempt\":0}]}";assertTrue(queue.save(0,pending));
  ServiceController<DirectSyncService> controller=Robolectric.buildService(DirectSyncService.class).create();DirectSyncService service=controller.get();assertEquals(Service.START_STICKY,service.onStartCommand(new Intent(context,DirectSyncService.class),0,1));ShadowService shadow=Shadows.shadowOf(service);Notification notification=shadow.getLastForegroundNotification();assertNotNull(notification);assertEquals(ServiceInfo.FOREGROUND_SERVICE_TYPE_CONNECTED_DEVICE,service.getForegroundServiceType());assertEquals(Notification.VISIBILITY_PRIVATE,notification.visibility);assertFalse(notification.extras.toString().contains("1585"));assertEquals(DirectSyncService.NOTIFICATION,shadow.getLastForegroundNotificationId());assertTrue(notification.actions[0].actionIntent.isImmutable());
  assertEquals(Service.START_STICKY,service.onStartCommand(null,0,2));verify(coordinator,times(2)).start();
  Intent stop=Shadows.shadowOf(notification.actions[0].actionIntent).getSavedIntent();assertEquals(DirectSyncService.STOP,stop.getAction());assertEquals(Service.START_NOT_STICKY,service.onStartCommand(stop,0,3));assertFalse(context.getSharedPreferences("zamerovac",0).getBoolean("directSyncEnabled",true));assertTrue(shadow.isStoppedBySelf());assertNull(shadow.getLastForegroundNotification());verify(coordinator).close();assertEquals(original,LocalDatabase.read(context.getFilesDir()));assertEquals(pending,new SyncQueueStore(context.getNoBackupFilesDir()).read());controller.destroy();
 }
 @Test public void disabledOrDeniedServiceNeverPretendsTransferStartedAndKeepsData()throws Exception{
  LocalDatabase.write(context.getFilesDir(),data("uložená verze"));String original=LocalDatabase.read(context.getFilesDir());ServiceController<DirectSyncService> controller=Robolectric.buildService(DirectSyncService.class).create();DirectSyncService service=controller.get();assertEquals(Service.START_NOT_STICKY,service.onStartCommand(null,0,1));assertTrue(Shadows.shadowOf(service).isStoppedBySelf());verify(coordinator,never()).start();controller.destroy();
  enabled();controller=Robolectric.buildService(DirectSyncService.class).create();service=controller.get();Shadows.shadowOf(service).setThrowInStartForeground(new SecurityException("synthetic FGS denied"));assertEquals(Service.START_NOT_STICKY,service.onStartCommand(null,0,2));verify(coordinator,never()).start();assertFalse(runtime.snapshot().getBoolean("active"));assertTrue(runtime.snapshot().getString("problem").contains("fronta"));assertEquals(original,LocalDatabase.read(context.getFilesDir()));controller.destroy();assertTrue(runtime.snapshot().getString("problem").contains("fronta"));
 }
 @Test public void activityStopDetachesUiCancelsPairingAndPreservesServiceCoordinator()throws Exception{
  ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();MainActivity.JsApi api=activity.new JsApi();api.directSyncState();PeerCoordinator.Events first=events.get();assertNotNull(first);controller.pause().stop();verify(coordinator,atLeastOnce()).stopPairing();verify(coordinator,never()).close();
  WebView web=ReflectionHelpers.getField(activity,"web");first.saved(new JSONObject(data("background")),"direct");assertSame(coordinator,runtime.coordinator());controller.restart().start().resume();api.directSyncState();assertSame(first,events.get());controller.pause().stop().destroy();verify(coordinator,never()).close();
 }
 @Test public void failedOrDetachedUiDoesNotPreventOtherObserverOrDurableCommit()throws Exception{
  runtime.coordinator();PeerCoordinator.Events broken=mock(PeerCoordinator.Events.class),good=mock(PeerCoordinator.Events.class);doThrow(new IllegalStateException("synthetic destroyed UI")).when(broken).saved(any(),anyString());runtime.observe(broken);runtime.observe(good);JSONObject data=new JSONObject(data("1585,800001"));events.get().saved(data,"direct");verify(good).saved(any(),eq("direct"));runtime.unobserve(broken);runtime.unobserve(good);clearInvocations(broken,good);events.get().saved(data,"direct");verifyNoInteractions(broken,good);verify(coordinator,never()).close();
 }
 @Test public void resumeReadsConfirmedBackgroundDataWithoutReplayingStaleScreen()throws Exception{
  LocalDatabase.write(context.getFilesDir(),data("původní"));ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();MainActivity.JsApi api=activity.new JsApi();assertTrue(api.loadData().contains("původní"));WebView web=ReflectionHelpers.getField(activity,"web");web.getWebViewClient().onPageFinished(web,"https://appassets.androidplatform.net/app/index.html");controller.pause().stop();
  String confirmed=data("1585,800001");LocalDatabase.write(context.getFilesDir(),confirmed);controller.restart().start().resume();long deadline=System.nanoTime()+java.util.concurrent.TimeUnit.SECONDS.toNanos(5);String callback="";
  while(System.nanoTime()<deadline){Shadows.shadowOf(Looper.getMainLooper()).idle();callback=Shadows.shadowOf(web).getLastEvaluatedJavascript();if(callback!=null&&callback.contains("1585,800001"))break;Thread.sleep(10);}
  assertNotNull(callback);assertTrue(callback,callback.contains("1585,800001"));assertTrue(callback.contains("onNativeSync"));assertEquals(confirmed,LocalDatabase.read(context.getFilesDir()));controller.pause().stop().destroy();
 }
 @Test public void transferWakeLockIsBoundedReleasedAndCannotRestartAfterClose()throws Exception{
  TransferPower power=new TransferPower(context);PowerManager.WakeLock lock=ReflectionHelpers.getField(power,"lock");assertFalse(lock.isHeld());power.active(true);assertTrue(lock.isHeld());power.active(false);assertFalse(lock.isHeld());power.active(true);power.close();assertFalse(lock.isHeld());power.active(true);assertFalse(lock.isHeld());
 }
}
