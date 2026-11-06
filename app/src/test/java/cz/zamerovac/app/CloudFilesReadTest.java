package cz.zamerovac.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CloudFilesReadTest {
 static class Counted extends ByteArrayInputStream {int read;boolean closed;Counted(byte[] bytes){super(bytes);}@Override public synchronized int read(byte[] bytes,int offset,int length){int count=super.read(bytes,offset,length);if(count>0)read+=count;return count;}@Override public void close(){closed=true;}}
 @Test public void oversizedControlFrameReadsOnlyDeclaredLimitPlusOneAndCloses()throws Exception{
  Counted source=new Counted(new byte[100000]);try{CloudFiles.read(source,4096);fail("Oversized message accepted");}catch(IOException expected){}assertEquals(4097,source.read);assertTrue(source.closed);
 }
 @Test public void exactMessageAndBlobKeepEveryByteAndHash()throws Exception{
  byte[] bytes=new byte[65536+100];new Random(42).nextBytes(bytes);Counted source=new Counted(bytes);assertArrayEquals(bytes,CloudFiles.read(source,bytes.length));assertTrue(source.closed);ByteArrayOutputStream out=new ByteArrayOutputStream();org.json.JSONObject actual=CloudFiles.copy(new ByteArrayInputStream(bytes),out,bytes.length);assertArrayEquals(bytes,out.toByteArray());assertEquals(bytes.length,actual.getLong("size"));assertEquals(PeerWire.hash(bytes),actual.getString("sha256"));
 }
 @Test public void oversizedBlobCannotCopyTrailingBytesOrReadOneWholeExtraBlock()throws Exception{
  Counted source=new Counted(new byte[100000]);ByteArrayOutputStream out=new ByteArrayOutputStream();try{CloudFiles.copy(source,out,65536);fail("Trailing payload accepted");}catch(IOException expected){}assertEquals(65537,source.read);assertEquals(65536,out.size());
 }
 @Test public void zeroProgressInvalidLimitsAndInterruptNeverSpinOrAcknowledge()throws Exception{
  InputStream stalled=new InputStream(){public int read(){return 0;}public int read(byte[] bytes,int offset,int length){return 0;}};try{CloudFiles.read(stalled,100);fail("Zero progress accepted");}catch(IOException expected){}try{CloudFiles.copy(stalled,new ByteArrayOutputStream(),100);fail("Zero progress copied");}catch(IOException expected){}try{CloudFiles.read(new ByteArrayInputStream(new byte[0]),-1);fail("Negative limit accepted");}catch(IOException expected){}try{Thread.currentThread().interrupt();CloudFiles.read(new ByteArrayInputStream(new byte[]{1}),100);fail("Interrupted frame accepted");}catch(InterruptedIOException expected){}finally{Thread.interrupted();}
 }
}
