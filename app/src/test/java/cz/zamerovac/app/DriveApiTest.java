package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import static org.junit.Assert.*;

/** Real REST serialization, pagination, byte limits and upload state machine, with synthetic replies. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=26)
public class DriveApiTest {
    static final String PATH="sync/v2/blobs/"+"a".repeat(64),SESSION=DriveApi.UPLOAD+"?uploadType=resumable&upload_id=synthetic";
    static JSONObject object(String id,String path,long size)throws Exception{return new JSONObject().put("id",id).put("name",path).put("size",String.valueOf(size)).put("mimeType","application/octet-stream");}
    static class Script implements DriveHttp.Connections {
        final Deque<DriveHttpTest.Connection> replies=new ArrayDeque<>();final List<DriveHttpTest.Connection> requests=new ArrayList<>();
        DriveHttpTest.Connection reply(int status,JSONObject body)throws Exception{DriveHttpTest.Connection connection=new DriveHttpTest.Connection(new URL(DriveApi.ROOT));connection.code=status;connection.response=body==null?new byte[0]:body.toString().getBytes(StandardCharsets.UTF_8);replies.add(connection);return connection;}
        public javax.net.ssl.HttpsURLConnection open(URL url)throws IOException{if(replies.isEmpty())throw new IOException("Unexpected request "+url);DriveHttpTest.Connection planned=replies.remove();DriveHttpTest.Connection connection=new DriveHttpTest.Connection(url);connection.code=planned.code;connection.response=planned.response;connection.headers.putAll(planned.headers);requests.add(connection);return connection;}
        DriveApi api(){return new DriveApi(new DriveHttp(new DriveHttpTest.Tokens(),bytes->{},this));}
    }
    @Test public void completePaginationIncludesEmptyPagesAndCarriesOpaqueTokens()throws Exception{
        Script script=new Script();script.reply(200,new JSONObject().put("files",new JSONArray().put(object("file_1",PATH,123))).put("nextPageToken","opaque +/= one"));script.reply(200,new JSONObject().put("files",new JSONArray()).put("nextPageToken","opaque two"));script.reply(200,new JSONObject().put("files",new JSONArray().put(object("file_2",PATH+"-second",456))));List<DriveApi.ObjectFile> files=script.api().list("sync/v2/blobs");assertEquals(2,files.size());assertEquals(456,files.get(1).size);assertEquals(3,script.requests.size());String second=URLDecoder.decode(script.requests.get(1).getURL().getQuery(),"UTF-8");assertTrue(second.contains("pageToken=opaque +/= one"));assertTrue(second.contains("spaces=appDataFolder"));assertTrue(second.contains("nextPageToken,incompleteSearch,files(id,name,size,mimeType)"));
    }
    @Test public void incompleteCyclicMalformedAndFailedListingsCannotLookLikeEmptyStorage()throws Exception{
        for(JSONObject invalid:new JSONObject[]{new JSONObject().put("files",new JSONArray()).put("incompleteSearch",true),new JSONObject().put("files",new JSONArray()).put("nextPageToken",17),new JSONObject().put("files",new JSONArray().put(object("../escape",PATH,1))),new JSONObject().put("files",new JSONArray().put(object("file_1",PATH,PeerSnapshot.MAX_MEDIA+1)))}){Script script=new Script();script.reply(200,invalid);try{script.api().list("sync/v2/blobs");fail("Invalid listing accepted");}catch(IOException expected){}}
        Script cycle=new Script();for(int i=0;i<2;i++)cycle.reply(200,new JSONObject().put("files",new JSONArray()).put("nextPageToken","same"));try{cycle.api().list("backups/v2/blobs");fail("Pagination cycle accepted");}catch(IOException expected){assertEquals(2,cycle.requests.size());}
        for(int status:new int[]{401,403,404,429,503}){Script failed=new Script();failed.reply(status,null);try{failed.api().list("sync/v2/blobs");fail("HTTP failure became absence");}catch(DriveHttp.Failure expected){assertEquals(status,expected.status);}}
    }
    @Test public void createOnlyUploadUsesExact256KiBChunksAndChecksServerProgress()throws Exception{
        int size=DriveApi.CHUNK*2+17;byte[] bytes=new byte[size];new Random(5).nextBytes(bytes);Script script=new Script();script.reply(200,null).headers.put("Location",SESSION);for(int end:new int[]{DriveApi.CHUNK,DriveApi.CHUNK*2})script.reply(308,null).headers.put("Range","bytes=0-"+(end-1));script.reply(201,object("created_1",PATH,size));DriveApi.ObjectFile result=script.api().upload(PATH,new ByteArrayInputStream(bytes),size);assertEquals("created_1",result.id);assertEquals(4,script.requests.size());assertEquals("POST",script.requests.get(0).getRequestMethod());JSONObject metadata=new JSONObject(script.requests.get(0).sent.toString("UTF-8"));assertEquals(PATH,metadata.getString("name"));assertEquals("appDataFolder",metadata.getJSONArray("parents").getString(0));ByteArrayOutputStream received=new ByteArrayOutputStream();for(int i=1;i<4;i++){DriveHttpTest.Connection connection=script.requests.get(i);assertEquals("PUT",connection.getRequestMethod());assertTrue(connection.getURL().toString().contains("upload_id=synthetic"));int start=(i-1)*DriveApi.CHUNK,end=Math.min(size,i*DriveApi.CHUNK);assertEquals("bytes "+start+"-"+(end-1)+"/"+size,connection.getRequestProperty("Content-Range"));received.write(connection.sent.toByteArray());}assertArrayEquals(bytes,received.toByteArray());
    }
    @Test public void hostileSessionPartialSourceWrongRangeAndPrematureFinalDoNotComplete()throws Exception{
        for(String location:new String[]{"https://evil.invalid/upload?upload_id=x",DriveApi.ROOT+"/existing",DriveApi.UPLOAD+"?upload_id=x#fragment"}){Script script=new Script();script.reply(200,null).headers.put("Location",location);try{script.api().upload(PATH,new ByteArrayInputStream(new byte[]{1}),1);fail("Invalid upload location");}catch(IOException expected){}assertEquals(1,script.requests.size());}
        for(byte[] source:new byte[][]{new byte[2],new byte[4]}){Script script=new Script();script.reply(200,null).headers.put("Location",SESSION);try{script.api().upload(PATH,new ByteArrayInputStream(source),3);fail("Wrong source length completed");}catch(IOException expected){}assertEquals(1,script.requests.size());}
        for(int status:new int[]{200,308}){Script script=new Script();script.reply(200,null).headers.put("Location",SESSION);script.reply(status,status==200?object("premature",PATH,DriveApi.CHUNK+1):null).headers.put("Range","bytes=0-17");try{script.api().upload(PATH,new ByteArrayInputStream(new byte[DriveApi.CHUNK+1]),DriveApi.CHUNK+1);fail("Partial range/premature completion accepted");}catch(IOException expected){}assertEquals(2,script.requests.size());}
    }
    @Test public void openStreamsOnlyDeclaredObjectBytesAndNeverUsesArbitraryIds()throws Exception{
        Script script=new Script();script.reply(200,null).response=new byte[]{1,2,3,4};try(InputStream input=script.api().open(new DriveApi.ObjectFile("file_1",PATH,3))){try{CloudFiles.read(input,10);fail("Long object read accepted");}catch(IOException expected){}}assertEquals(4,script.requests.get(0).readBytes);assertTrue(script.requests.get(0).disconnects>0);assertEquals(DriveApi.ROOT+"/file_1?alt=media",script.requests.get(0).getURL().toString());try{script.api().open(new DriveApi.ObjectFile("../escape",PATH,3));fail("Arbitrary file id accepted");}catch(IOException expected){}
    }
}
