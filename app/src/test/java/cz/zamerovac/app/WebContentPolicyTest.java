package cz.zamerovac.app;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.webkit.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import org.robolectric.util.ReflectionHelpers;
import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class WebContentPolicyTest {
 MainActivity activity;WebView web;WebViewClient client;
 @Before public void setup(){activity=Robolectric.buildActivity(MainActivity.class).setup().get();web=ReflectionHelpers.getField(activity,"web");client=web.getWebViewClient();}
 WebResourceRequest request(String url,boolean main,boolean gesture){WebResourceRequest request=mock(WebResourceRequest.class);when(request.getUrl()).thenReturn(Uri.parse(url));when(request.isForMainFrame()).thenReturn(main);when(request.hasGesture()).thenReturn(gesture);when(request.getRequestHeaders()).thenReturn(Collections.emptyMap());return request;}
 @Test public void exactPackagedDocumentIsTheOnlyAllowedInPlaceNavigation()throws Exception{
  assertFalse(client.shouldOverrideUrlLoading(web,request("https://appassets.androidplatform.net/app/index.html",true,false)));
  for(String url:new String[]{"https://evil.invalid/","https://appassets.androidplatform.net.evil.invalid/app/index.html","https://appassets.androidplatform.net:444/app/index.html","https://appassets.androidplatform.net:bad/app/index.html","https://user@appassets.androidplatform.net/app/index.html","http://appassets.androidplatform.net/app/index.html","https://appassets.androidplatform.net/media/synthetic","data:text/html,unsafe","javascript:void(0)","file:///sdcard/customer.html","content://synthetic/unsafe"}){
   assertTrue(url,client.shouldOverrideUrlLoading(web,request(url,true,false)));assertTrue(url,client.shouldOverrideUrlLoading(web,url));assertTrue(url,client.shouldOverrideUrlLoading(web,request(url,false,true)));
  }
  assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
 }
 @Test public void requestsCannotFallThroughToRemoteNetworkOrExecutableMedia()throws Exception{
  for(String url:new String[]{"https://evil.invalid/frame","file:///etc/passwd","content://foreign/doc","https://appassets.androidplatform.net/app/../projects.json"}){WebResourceResponse response=client.shouldInterceptRequest(web,request(url,false,false));assertNotNull(response);assertTrue(response.getStatusCode()>=400);assertEquals(-1,response.getData().read());}
  WebResourceResponse app=client.shouldInterceptRequest(web,request("https://appassets.androidplatform.net/app/index.html",true,false));assertEquals(200,app.getStatusCode());assertEquals(WebContentPolicy.APP_CSP,app.getResponseHeaders().get("Content-Security-Policy"));assertTrue(app.getResponseHeaders().get("Content-Security-Policy").contains("script-src https://appassets.androidplatform.net/app/"));assertEquals("nosniff",app.getResponseHeaders().get("X-Content-Type-Options"));app.getData().close();
  File media=new File(activity.getFilesDir(),"media/synthetic-script");media.getParentFile().mkdirs();try(OutputStream out=new FileOutputStream(media)){out.write("window.Native.loadData()".getBytes(java.nio.charset.StandardCharsets.UTF_8));}activity.getSharedPreferences("zamerovac",0).edit().putString("mime-synthetic-script","application/javascript").commit();WebResourceResponse script=client.shouldInterceptRequest(web,request("https://appassets.androidplatform.net/media/synthetic-script",false,false));assertEquals("application/octet-stream",script.getMimeType());assertTrue(script.getResponseHeaders().get("Content-Security-Policy").contains("script-src 'none'"));assertEquals("nosniff",script.getResponseHeaders().get("X-Content-Type-Options"));script.getData().close();
 }
 @Test public void clickedExternalUrlOpensBrowserAndPopupNeverReceivesNativeBridge()throws Exception{
  WebResourceRequest link=request("https://example.invalid/help",true,true);assertTrue(client.shouldOverrideUrlLoading(web,link));Intent opened=Shadows.shadowOf(activity).getNextStartedActivity();assertNotNull(opened);assertEquals(Intent.ACTION_VIEW,opened.getAction());assertEquals(link.getUrl(),opened.getData());assertTrue(opened.hasCategory(Intent.CATEGORY_BROWSABLE));
  WebChromeClient chrome=web.getWebChromeClient();assertFalse(chrome.onCreateWindow(web,false,false,Message.obtain()));AtomicReference<WebView> popup=new AtomicReference<>();WebView.WebViewTransport transport=mock(WebView.WebViewTransport.class);doAnswer(call->{popup.set(call.getArgument(0));return null;}).when(transport).setWebView(any(WebView.class));Message result=Message.obtain(new Handler(Looper.getMainLooper()));result.obj=transport;assertTrue(chrome.onCreateWindow(web,false,true,result));WebView separate=popup.get();assertNotNull(separate);assertFalse(separate.getSettings().getJavaScriptEnabled());assertNull(Shadows.shadowOf(separate).getJavascriptInterface("Native"));assertTrue(separate.getWebViewClient().shouldOverrideUrlLoading(separate,request("https://example.invalid/popup",true,true)));assertNotNull(Shadows.shadowOf(activity).getNextStartedActivity());Shadows.shadowOf(Looper.getMainLooper()).idle();
 }
}
