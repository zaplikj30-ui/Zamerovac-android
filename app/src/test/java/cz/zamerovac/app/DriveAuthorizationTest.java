package cz.zamerovac.app;

import android.accounts.Account;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.common.api.*;
import com.google.android.gms.tasks.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.mockito.ArgumentCaptor;
import java.io.*;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Real Google SDK request/task types, controlled AuthorizationClient; no real account or consent. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DriveAuthorizationTest {
    final Account account=new Account("synthetic@example.invalid","com.google");AuthorizationClient client;AtomicLong clock;DriveAuthorization auth;
    AuthorizationResult grant(String token){AuthorizationResult result=mock(AuthorizationResult.class);when(result.getAccessToken()).thenReturn(token);when(result.getGrantedScopes()).thenReturn(Collections.singletonList(DriveAuthorization.SCOPE));return result;}
    @Before public void setup()throws Exception{client=mock(AuthorizationClient.class);when(client.clearToken(any(ClearTokenRequest.class))).thenReturn(Tasks.forResult(null));clock=new AtomicLong(100000);auth=new DriveAuthorization(client,account,()->{},clock::get);}
    String token(DriveAuthorization auth)throws Exception{ExecutorService worker=Executors.newSingleThreadExecutor();try{return worker.submit(auth::token).get(5,TimeUnit.SECONDS);}catch(ExecutionException failure){throw (Exception)failure.getCause();}finally{worker.shutdownNow();}}
    @Test public void sdkRequestPinsSelectedAccountAndOnlyAppDataScope()throws Exception{
        when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(grant(DriveHttpTest.TOKEN)));assertEquals(DriveHttpTest.TOKEN,token(auth));ArgumentCaptor<AuthorizationRequest> request=ArgumentCaptor.forClass(AuthorizationRequest.class);verify(client).authorize(request.capture());assertEquals(account,request.getValue().getAccount());assertEquals(Collections.singletonList(new Scope(DriveAuthorization.SCOPE)),request.getValue().getRequestedScopes());assertFalse(request.getValue().getRequestedScopes().contains(new Scope("https://www.googleapis.com/auth/drive")));
    }
    @Test public void memoryCacheExpiresAnd401InvalidatesOnlyTheRejectedToken()throws Exception{
        when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(grant("synthetic-first")),Tasks.forResult(grant("synthetic-second")),Tasks.forResult(grant("synthetic-third")));assertEquals("synthetic-first",token(auth));assertEquals("synthetic-first",token(auth));verify(client,times(1)).authorize(any());clock.addAndGet(5*60*1000L);assertEquals("synthetic-second",token(auth));auth.rejected("synthetic-first");assertEquals("synthetic-second",token(auth));auth.rejected("synthetic-second");assertEquals("synthetic-third",token(auth));verify(client,times(3)).authorize(any());ArgumentCaptor<ClearTokenRequest> clear=ArgumentCaptor.forClass(ClearTokenRequest.class);verify(client,times(2)).clearToken(clear.capture());assertEquals("synthetic-first",clear.getAllValues().get(0).getToken());assertEquals("synthetic-second",clear.getAllValues().get(1).getToken());
    }
    @Test public void consentMissingScopeAndDeveloperFailureNeverReturnATokenOrExposeServerText()throws Exception{
        AuthorizationResult consent=grant(DriveHttpTest.TOKEN);when(consent.hasResolution()).thenReturn(true);when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(consent));try{token(auth);fail("Consent was bypassed");}catch(DriveAuthorization.NeedsConsent expected){}
        AuthorizationResult missing=grant(DriveHttpTest.TOKEN);when(missing.getGrantedScopes()).thenReturn(Collections.emptyList());when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(missing));try{token(auth);fail("Missing scope accepted");}catch(IOException expected){assertFalse(expected.getMessage().contains(DriveHttpTest.TOKEN));}
        when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forException(new ApiException(new Status(10,DriveHttpTest.TOKEN))));try{token(auth);fail("Developer error accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("registrace"));assertFalse(expected.toString().contains(DriveHttpTest.TOKEN));assertNull(expected.getCause());}
    }
    @Test public void accountChangeDuringAuthorizationPreventsCachingAndMainThreadCannotBlock()throws Exception{
        AtomicBoolean bound=new AtomicBoolean(true);auth=new DriveAuthorization(client,account,()->{if(!bound.get())throw new CloudScan.Deferred();},clock::get);TaskCompletionSource<AuthorizationResult> pending=new TaskCompletionSource<>();CountDownLatch requested=new CountDownLatch(1);when(client.authorize(any(AuthorizationRequest.class))).thenAnswer(call->{requested.countDown();return pending.getTask();});ExecutorService worker=Executors.newSingleThreadExecutor();try{Future<String> first=worker.submit(auth::token);assertTrue(requested.await(2,TimeUnit.SECONDS));bound.set(false);pending.setResult(grant(DriveHttpTest.TOKEN));try{first.get(2,TimeUnit.SECONDS);fail("Old account cached");}catch(ExecutionException expected){assertTrue(expected.getCause() instanceof CloudScan.Deferred);}}finally{worker.shutdownNow();}
        bound.set(true);when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(grant("new-synthetic-token")));assertEquals("new-synthetic-token",token(auth));verify(client,times(2)).authorize(any());DriveAuthorization uncached=new DriveAuthorization(client,account,()->{},clock::get);try{uncached.token();fail("UI thread blocked");}catch(IOException expected){assertTrue(expected.getMessage().contains("obrazovku"));}
    }
    @Test public void interruptionAbandonsAuthorizationWithoutReturningAResult()throws Exception{
        TaskCompletionSource<AuthorizationResult> pending=new TaskCompletionSource<>();CountDownLatch requested=new CountDownLatch(1);when(client.authorize(any(AuthorizationRequest.class))).thenAnswer(call->{requested.countDown();return pending.getTask();});AtomicReference<Throwable> failure=new AtomicReference<>();AtomicBoolean interrupted=new AtomicBoolean();Thread thread=new Thread(()->{try{auth.token();}catch(Throwable problem){failure.set(problem);interrupted.set(Thread.currentThread().isInterrupted());}});thread.start();assertTrue(requested.await(2,TimeUnit.SECONDS));thread.interrupt();thread.join(2000);assertFalse(thread.isAlive());assertTrue(failure.get() instanceof InterruptedIOException);assertTrue(interrupted.get());
    }
}
