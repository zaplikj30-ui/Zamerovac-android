package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DriveResumableUploadTest {
    File home,source;byte[] bytes;String hash,path;
    static final String SESSION=DriveApi.UPLOAD+"?upload_id=synthetic-private-session";
    @Before public void setup()throws Exception{
        home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"resume-").toFile();source=new File(home,"original-video");
        bytes=new byte[DriveApi.CHUNK+137];new Random(16).nextBytes(bytes);Files.write(source.toPath(),bytes);hash=PeerWire.hash(bytes);path="sync/v2/blobs/"+hash+"-11111111-1111-4111-8111-111111111111";
    }
    @Test public void processRestartQueriesServerAndSendsOnlyVerifiedSuffix()throws Exception{
        DriveApiTest.Script first=new DriveApiTest.Script();first.reply(200,null).headers.put("Location",SESSION);first.reply(308,null).headers.put("Range","bytes=0-"+(DriveApi.CHUNK-1));
        try{new DriveResumableUpload(first.api(),home,"account").upload(path,source);fail("Lost connection acknowledged");}catch(IOException expected){}
        assertArrayEquals(bytes,Files.readAllBytes(source.toPath()));
        DriveApiTest.Script second=new DriveApiTest.Script();second.reply(308,null).headers.put("Range","bytes=0-"+(DriveApi.CHUNK-1));second.reply(201,DriveApiTest.object("complete",path,bytes.length));second.reply(200,null).response=bytes;
        DriveResumableUpload resumed=new DriveResumableUpload(second.api(),home,"account");
        assertEquals(path,resumed.pendingPath("sync/v2/blobs/"+hash+"-22222222-2222-4222-8222-222222222222",hash,bytes.length));
        assertEquals("complete",resumed.upload(path,source).id);
        assertEquals("bytes */"+bytes.length,second.requests.get(0).getRequestProperty("Content-Range"));assertEquals(0,second.requests.get(0).sent.size());
        assertEquals("bytes "+DriveApi.CHUNK+"-"+(bytes.length-1)+"/"+bytes.length,second.requests.get(1).getRequestProperty("Content-Range"));
        assertArrayEquals(Arrays.copyOfRange(bytes,DriveApi.CHUNK,bytes.length),second.requests.get(1).sent.toByteArray());assertEquals(3,second.requests.size());
    }
    @Test public void successWithoutServerBytesDoesNotFinishAndLostFinalResponseIsReconciled()throws Exception{
        bytes=new byte[]{7,1,9};Files.write(source.toPath(),bytes);hash=PeerWire.hash(bytes);path="sync/v2/blobs/"+hash;
        DriveApiTest.Script first=new DriveApiTest.Script();first.reply(200,null).headers.put("Location",SESSION);first.reply(201,DriveApiTest.object("created",path,3));first.reply(404,null);
        try{new DriveResumableUpload(first.api(),home,"account").upload(path,source);fail("False success accepted");}catch(IOException expected){}
        DriveApiTest.Script retry=new DriveApiTest.Script();retry.reply(404,null);retry.reply(200,new JSONObject().put("files",new JSONArray().put(DriveApiTest.object("incomplete",path,3)).put(DriveApiTest.object("complete",path,3))));retry.reply(200,null).response=new byte[]{1};retry.reply(200,null).response=bytes;
        assertEquals("complete",new DriveResumableUpload(retry.api(),home,"account").upload(path,source).id);assertEquals(4,retry.requests.size());assertArrayEquals(bytes,Files.readAllBytes(source.toPath()));
    }
    @Test public void expiryRestartsAndQuotaAuthAndRateErrorsPreserveOriginalAndSession()throws Exception{
        for(int status:new int[]{401,403,429,503}){
            File local=new File(home,"error-"+status);local.mkdir();DriveApiTest.Script first=new DriveApiTest.Script();first.reply(200,null).headers.put("Location",SESSION);first.reply(status,null);
            try{new DriveResumableUpload(first.api(),local,"account").upload(path,source);fail();}catch(DriveHttp.Failure expected){assertEquals(status,expected.status);}
            DriveApiTest.Script expired=new DriveApiTest.Script();expired.reply(410,null);expired.reply(200,new JSONObject().put("files",new JSONArray()));expired.reply(200,null).headers.put("Location",SESSION);expired.reply(308,null).headers.put("Range","bytes=0-"+(DriveApi.CHUNK-1));expired.reply(201,DriveApiTest.object("new",path,bytes.length));expired.reply(200,null).response=bytes;
            assertEquals("new",new DriveResumableUpload(expired.api(),local,"account").upload(path,source).id);assertArrayEquals(bytes,Files.readAllBytes(source.toPath()));
        }
    }
    @Test public void impossibleServerRangeOrEndpointCannotSendContent()throws Exception{
        for(String range:new String[]{"bytes=1-10","bytes=0-9999999999999999","garbage"}){
            File local=new File(home,"range-"+UUID.randomUUID());local.mkdir();DriveApiTest.Script first=new DriveApiTest.Script();first.reply(200,null).headers.put("Location",SESSION);first.reply(503,null);
            try{new DriveResumableUpload(first.api(),local,"account").upload(path,source);fail();}catch(IOException expected){}
            DriveApiTest.Script retry=new DriveApiTest.Script();retry.reply(308,null).headers.put("Range",range);
            try{new DriveResumableUpload(retry.api(),local,"account").upload(path,source);fail();}catch(IOException expected){}assertEquals(1,retry.requests.size());assertEquals(0,retry.requests.get(0).sent.size());
        }
    }
}
