package cz.zamerovac.app;
import android.accounts.*;
import android.app.*;
import android.content.*;
import android.os.*;
import com.google.android.gms.auth.api.identity.*;
import com.google.android.gms.tasks.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Actual Android lifecycle/SDK task types, controlled picker/Google client. No Google account. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DriveAccountFlowTest {
    ActivityController<Activity> controller;Activity activity;DriveAccounts accounts;AuthorizationClient client;DriveAccountFlow flow;final List<String> events=new ArrayList<>();
    final Account a=new Account("synthetic-a@example.invalid","com.google"),b=new Account("synthetic-b@example.invalid","com.google");
    @Before public void setup()throws Exception{controller=Robolectric.buildActivity(Activity.class).setup();activity=controller.get();accounts=new DriveAccounts(Files.createTempDirectory(activity.getCacheDir().toPath(),"drive-flow-").toFile());client=mock(AuthorizationClient.class);flow=make(activity);}
    @After public void close(){flow.close();controller.pause().stop().destroy();}
    DriveAccountFlow make(Activity owner){return new DriveAccountFlow(owner,accounts,(kind,message)->events.add(kind+":"+message),new DriveAccountFlow.Platform(){public AuthorizationClient client(){return client;}public Intent picker(){return new Intent("synthetic.PICK_ACCOUNT").setPackage(owner.getPackageName());}});}
    AuthorizationResult grant(){AuthorizationResult result=mock(AuthorizationResult.class);when(result.getAccessToken()).thenReturn(DriveHttpTest.TOKEN);when(result.getGrantedScopes()).thenReturn(Collections.singletonList(DriveAuthorization.SCOPE));return result;}
    AuthorizationResult consent(){AuthorizationResult result=grant();when(result.hasResolution()).thenReturn(true);when(result.getPendingIntent()).thenReturn(PendingIntent.getActivity(activity,123,new Intent(activity,Activity.class),PendingIntent.FLAG_IMMUTABLE));return result;}
    Intent picked(Account account){return new Intent().putExtra(AccountManager.KEY_ACCOUNT_NAME,account.name).putExtra(AccountManager.KEY_ACCOUNT_TYPE,account.type);}
    void idle(){Shadows.shadowOf(Looper.getMainLooper()).idle();}
    @Test public void explicitPickerAndVerifiedGrantOnlySelectTheTargetFeature()throws Exception{
        accounts.select("backup",b);AuthorizationResult approved=grant();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(approved));flow.begin("sync");assertEquals(DriveAccountFlow.PICK,Shadows.shadowOf(activity).getNextStartedActivityForResult().requestCode);flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(a));flow.resume();idle();assertEquals(a,accounts.account("sync"));assertEquals(b,accounts.account("backup"));assertFalse(flow.busy());assertEquals(1,events.size());verify(client,times(1)).authorize(any());assertFalse(events.get(0).contains(DriveHttpTest.TOKEN));
    }
    @Test public void cancelOrMissingScopePreserveExistingAccountAndNeverSaveAToken()throws Exception{
        accounts.select("sync",a);flow.begin("sync");flow.result(DriveAccountFlow.PICK,Activity.RESULT_CANCELED,null);assertEquals(a,accounts.account("sync"));verify(client,never()).authorize(any());AuthorizationResult missing=grant();when(missing.getGrantedScopes()).thenReturn(Collections.emptyList());when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(missing));flow.begin("sync");flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(b));idle();assertEquals(a,accounts.account("sync"));assertFalse(flow.busy());assertFalse(accounts.snapshot().toString().contains(DriveHttpTest.TOKEN));
    }
    @Test public void consentSurvivesRecreationWithNoTokenInSavedState()throws Exception{
        AuthorizationResult permission=consent(),approved=grant();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(permission));flow.begin("sync");flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(a));idle();Bundle saved=new Bundle();flow.save(saved);assertEquals("consent",saved.getString("drive-stage"));assertFalse(saved.toString().contains(DriveHttpTest.TOKEN));assertNull(accounts.account("sync"));flow.close();controller.pause().stop().destroy();controller=Robolectric.buildActivity(Activity.class).setup();activity=controller.get();when(client.getAuthorizationResultFromIntent(any(Intent.class))).thenReturn(approved);DriveAccountFlow restored=make(activity);restored.restore(saved);restored.result(DriveAccountFlow.CONSENT,Activity.RESULT_OK,new Intent());assertEquals(a,accounts.account("sync"));assertFalse(restored.busy());restored.close();
    }
    @Test public void stoppedAuthorizationIgnoresLateCallbackAndResumesOnlyOnce()throws Exception{
        TaskCompletionSource<AuthorizationResult> pending=new TaskCompletionSource<>();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(pending.getTask());flow.begin("sync");flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(a));flow.resume();verify(client,times(1)).authorize(any());flow.suspend();pending.setResult(grant());idle();assertNull(accounts.account("sync"));AuthorizationResult approved=grant();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(approved));flow.resume();flow.resume();idle();verify(client,times(2)).authorize(any());assertEquals(a,accounts.account("sync"));
    }
    @Test public void oldConsentCannotOverwriteNewerAccountEvenAfterSwitchingBack()throws Exception{
        accounts.select("sync",a);AuthorizationResult permission=consent(),approved=grant();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(permission));when(client.getAuthorizationResultFromIntent(any(Intent.class))).thenReturn(approved);flow.begin("sync");flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(b));idle();accounts.select("sync",b);accounts.select("sync",a);long revision=accounts.revision("sync");flow.result(DriveAccountFlow.CONSENT,Activity.RESULT_OK,new Intent());assertEquals(a,accounts.account("sync"));assertEquals(revision,accounts.revision("sync"));assertTrue(events.get(events.size()-1).contains("mezitím"));
    }
    @Test public void failedAccountCommitAndInvalidRestoredFlowCannotActivateASelection()throws Exception{
        accounts.select("sync",a);AuthorizationResult approved=grant();when(client.authorize(any(AuthorizationRequest.class))).thenReturn(Tasks.forResult(approved));flow.begin("sync");android.util.AtomicFile atomic=org.robolectric.util.ReflectionHelpers.getField(accounts,"file");File target=atomic.getBaseFile();assertNotNull(target);File blocker=new File(target+".new");assertTrue(blocker.mkdir());Files.write(new File(blocker,"block").toPath(),new byte[]{1});flow.result(DriveAccountFlow.PICK,Activity.RESULT_OK,picked(b));idle();assertEquals(a,accounts.account("sync"));assertFalse(flow.busy());Bundle invalid=new Bundle();invalid.putString("drive-kind","sync");invalid.putString("drive-stage","consent");invalid.putString("drive-session","../invalid");flow.restore(invalid);assertFalse(flow.busy());assertFalse(flow.result(999,Activity.RESULT_OK,new Intent()));
    }
}
