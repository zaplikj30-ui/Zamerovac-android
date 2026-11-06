package cz.zamerovac.app;
import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.Config;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;

/** Generated preview configuration and actual native account state, not a Google account acceptance test. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DriveRegistrationTest {
 @Test public void generatedPreviewMatchesPublicRegistrationAndKeepsAuthorizationScopeNarrow()throws Exception{
  Properties registered=new Properties();try(InputStream in=getClass().getClassLoader().getResourceAsStream("drive-preview.properties")){assertNotNull(in);registered.load(in);}
  assertEquals("cz.zamerovac.app.preview",BuildConfig.APPLICATION_ID);assertEquals(registered.getProperty("applicationId"),BuildConfig.APPLICATION_ID);assertEquals(registered.getProperty("projectId"),BuildConfig.DRIVE_CLOUD_PROJECT);assertEquals("zamerovac-android",BuildConfig.DRIVE_CLOUD_PROJECT);assertTrue(DriveAuthorization.projectConfigured());DriveAuthorization.configured();assertEquals("https://www.googleapis.com/auth/drive.appdata",DriveAuthorization.SCOPE);
 }
 @Test public void invalidPublicProjectIdsCannotActivateAuthorization()throws Exception{
  for(String value:new String[]{null,"","short","123456","Uppercase-project","-starts-with","ends-with-","space project","project/escape","a".repeat(31),"project\nother"})assertFalse(String.valueOf(value),DriveAuthorization.validProjectId(value));assertTrue(DriveAuthorization.validProjectId("a12345"));assertTrue(DriveAuthorization.validProjectId("a".repeat(30)));
 }
 @Test public void nativeUiRecognizesRegistrationWithoutPretendingAnAccountOrChangingDatabase()throws Exception{
  ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup();MainActivity activity=controller.get();try{String before=LocalDatabase.read(activity.getFilesDir());MainActivity.JsApi bridge=activity.new JsApi();JSONObject view=new JSONObject(bridge.driveAccountState());assertTrue(view.getBoolean("projectConfigured"));for(String kind:new String[]{"sync","backup"}){assertFalse("drive".equals(view.getJSONObject(kind).getString("backend")));assertFalse(view.getJSONObject(kind).has("account"));}assertFalse(view.toString().contains("accessToken"));assertEquals(before,LocalDatabase.read(activity.getFilesDir()));}finally{controller.pause().stop().destroy();}
 }
}
