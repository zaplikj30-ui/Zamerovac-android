package cz.zamerovac.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerMediaLargeTest {
    @Test public void threeGiBInterruptedHalfwayRestartsWholeFileAndPreservesHealthyNeighbour()throws Exception{
        File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"large-peer-").toFile(),source=new File(root,"original-video"),destination=new File(root,"media");destination.mkdir();
        long size=3L*1024*1024*1024;
        try(RandomAccessFile file=new RandomAccessFile(source,"rw")){file.setLength(size);file.seek(size-4);file.write(new byte[]{7,11,13,17});}
        JSONObject proof=PeerMedia.inspect(source);assertEquals(size,proof.getLong("size"));File healthy=new File(destination,"healthy-photo");Files.write(healthy.toPath(),new byte[]{1,2,3,5,8});
        try(InputStream raw=new FileInputStream(source)){
            InputStream interrupted=new FilterInputStream(raw){long left=size/2;public int read(byte[] b,int o,int n)throws IOException{if(left==0)return -1;int actual=super.read(b,o,(int)Math.min(n,left));if(actual>0)left-=actual;return actual;}};
            try{PeerMedia.receive(destination,"large-video",interrupted,proof);fail("Partial file was published");}catch(EOFException expected){}
        }
        assertFalse(new File(destination,"large-video").exists());assertEquals(1,destination.listFiles().length);assertArrayEquals(new byte[]{1,2,3,5,8},Files.readAllBytes(healthy.toPath()));
        final long[] received={0};
        try(InputStream raw=new FileInputStream(source)){
            PeerMedia.receive(destination,"large-video",new FilterInputStream(raw){public int read(byte[] b,int o,int n)throws IOException{assertTrue("Bounded read buffer",n<=65536);int actual=super.read(b,o,n);if(actual>0)received[0]+=actual;return actual;}},proof);
        }
        assertEquals("LAN retry must start at byte zero",size,received[0]);JSONObject stored=PeerMedia.inspect(new File(destination,"large-video"));assertEquals(proof.getString("hash"),stored.getString("hash"));assertEquals(size,stored.getLong("size"));
        final long[] sent={0};PeerMedia.send(source,new OutputStream(){public void write(int b){sent[0]++;}public void write(byte[] b,int o,int n){assertTrue(n<=65536);sent[0]+=n;}},proof);assertEquals(size,sent[0]);
        assertTrue("The file is larger than the entire test heap",size>Runtime.getRuntime().maxMemory());assertArrayEquals(new byte[]{1,2,3,5,8},Files.readAllBytes(healthy.toPath()));
        System.out.println("PEER_MEDIA_3GIB_RETRY_FROM_ZERO SHA256="+stored.getString("hash")+" HEAP_LIMIT="+Runtime.getRuntime().maxMemory());
    }
}
