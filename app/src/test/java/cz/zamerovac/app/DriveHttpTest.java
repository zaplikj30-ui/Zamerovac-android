package cz.zamerovac.app;

import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.*;
import java.security.cert.Certificate;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

/** Exercises the real HTTPS boundary using a controlled connection, never a Google account. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=26)
public class DriveHttpTest {
    static final String TOKEN="synthetic-access-token",URL=DriveApi.ROOT+"?spaces=appDataFolder";
    static class Connection extends HttpsURLConnection {
        int code=200,disconnects,readBytes;long declared=-1;byte[] response=new byte[0];final Map<String,String> headers=new HashMap<>();final ByteArrayOutputStream sent=new ByteArrayOutputStream();
        Connection(java.net.URL url){super(url);}
        @Override public int getResponseCode()throws IOException{return code;}
        @Override public String getHeaderField(String key){return headers.get(key);}
        @Override public long getContentLengthLong(){return declared;}
        @Override public InputStream getInputStream(){return new FilterInputStream(new ByteArrayInputStream(response)){@Override public int read(byte[] bytes,int offset,int length)throws IOException{int count=in.read(bytes,offset,length);if(count>0)readBytes+=count;return count;}};}
        @Override public InputStream getErrorStream(){return getInputStream();}
        @Override public OutputStream getOutputStream(){return sent;}
        @Override public void disconnect(){disconnects++;}
        @Override public boolean usingProxy(){return false;}
        @Override public void connect(){}
        @Override public String getCipherSuite(){return "synthetic";}
        @Override public Certificate[] getLocalCertificates(){return null;}
        @Override public Certificate[] getServerCertificates(){return null;}
    }
    static class Tokens implements DriveHttp.Credentials {int requests,rejections;public String token(){requests++;return TOKEN;}public void rejected(String token){assertEquals(TOKEN,token);rejections++;}}
    @Test public void restrictedEndpointsHeadersAndDeniedPolicyNeverOpenAConnection()throws Exception{
        for(String endpoint:new String[]{"http://www.googleapis.com/drive/v3/files","https://www.googleapis.com.evil.invalid/drive/v3/files","https://evil.invalid/drive/v3/files","https://user@www.googleapis.com/drive/v3/files","https://www.googleapis.com:444/drive/v3/files","https://www.googleapis.com/drive/v3/files#fragment","https://www.googleapis.com/other","https://www.googleapis.com/drive/v3/files?x=a\nb\nc"})try{DriveHttp.endpoint(endpoint);fail(endpoint);}catch(IOException expected){}
        Tokens tokens=new Tokens();AtomicInteger opened=new AtomicInteger();DriveHttp denied=new DriveHttp(tokens,bytes->{throw new IOException("synthetic denied");},url->{opened.incrementAndGet();return new Connection(url);});try{denied.request("GET",URL,Collections.emptyMap(),null,10);fail("Denied request opened");}catch(IOException expected){}assertEquals(0,tokens.requests);assertEquals(0,opened.get());
        DriveHttp http=new DriveHttp(tokens,bytes->{},url->{opened.incrementAndGet();return new Connection(url);});try{http.request("GET",URL,Collections.singletonMap("X-Test","a\nb\nc"),null,10);fail("Multiple newlines accepted");}catch(IOException expected){}assertEquals(0,opened.get());
    }
    @Test public void tokenIsOnlyAHeaderAndRedirectsCannotForwardIt()throws Exception{
        Tokens tokens=new Tokens();Connection connection=new Connection(new URL(URL));connection.code=302;connection.headers.put("Location","https://evil.invalid/capture");AtomicInteger opened=new AtomicInteger();DriveHttp http=new DriveHttp(tokens,bytes->{},url->{opened.incrementAndGet();assertFalse(url.toString().contains(TOKEN));return connection;});
        try(DriveHttp.Response response=http.request("GET",URL,Collections.emptyMap(),null,100)){assertFalse(connection.getInstanceFollowRedirects());assertFalse(connection.getUseCaches());assertEquals(15000,connection.getConnectTimeout());assertEquals(30000,connection.getReadTimeout());assertEquals("identity",connection.getRequestProperty("Accept-Encoding"));assertEquals("Bearer "+TOKEN,connection.getRequestProperty("Authorization"));try{response.success(200);fail("Redirect followed");}catch(DriveHttp.Failure expected){assertEquals(302,expected.status);assertFalse(expected.getMessage().contains(TOKEN));}}assertEquals(1,opened.get());assertTrue(connection.disconnects>0);
    }
    @Test public void unknownLengthReadsOnlyLimitPlusOneAndDynamicPolicyStopsBeforeNextRead()throws Exception{
        Connection connection=new Connection(new URL(URL));connection.response=new byte[100000];AtomicBoolean allowed=new AtomicBoolean(true);DriveHttp http=new DriveHttp(new Tokens(),bytes->{if(!allowed.get())throw new IOException("synthetic policy changed");},url->connection);
        try(DriveHttp.Response response=http.request("GET",URL,Collections.emptyMap(),null,17)){try{response.body.read(new byte[65536]);fail("Oversized response accepted");}catch(IOException expected){}assertEquals(18,connection.readBytes);}assertTrue(connection.disconnects>0);
        Connection next=new Connection(new URL(URL));next.response=new byte[20];DriveHttp second=new DriveHttp(new Tokens(),bytes->{if(!allowed.get())throw new IOException("synthetic policy changed");},url->next);try(DriveHttp.Response response=second.request("GET",URL,Collections.emptyMap(),null,20)){assertEquals(1,response.body.read(new byte[1]));allowed.set(false);try{response.body.read();fail("Read after policy change");}catch(IOException expected){}assertEquals(1,next.readBytes);}
    }
    @Test public void uploadPolicyIsCheckedBetween64KiBBlocksAnd401InvalidatesTokenOnce()throws Exception{
        Connection connection=new Connection(new URL(DriveApi.UPLOAD));DriveHttp http=new DriveHttp(new Tokens(),bytes->{if(bytes>100000)throw new IOException("synthetic metered cap");},url->connection);try{http.request("PUT",DriveApi.UPLOAD+"?upload_id=synthetic",Collections.emptyMap(),new byte[262144],100);fail("Upload ignored cap");}catch(IOException expected){}assertEquals(65536,connection.sent.size());assertTrue(connection.disconnects>0);
        Tokens tokens=new Tokens();Connection rejected=new Connection(new URL(URL));rejected.code=401;rejected.response=TOKEN.getBytes(java.nio.charset.StandardCharsets.UTF_8);DriveHttp denied=new DriveHttp(tokens,bytes->{},url->rejected);try(DriveHttp.Response response=denied.request("GET",URL,Collections.emptyMap(),null,100)){try{response.success(200);fail("401 accepted");}catch(DriveHttp.Failure expected){assertEquals(401,expected.status);assertFalse(expected.getMessage().contains(TOKEN));assertFalse(expected.retryable);}}assertEquals(1,tokens.rejections);assertEquals(0,rejected.readBytes);
    }
}
