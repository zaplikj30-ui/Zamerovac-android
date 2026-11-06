package cz.zamerovac.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerMediaCheckpointTest {
 private File directory,file;private byte[] bytes;private JSONObject expected;
 @Before public void setup()throws Exception{directory=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"media-priority-").toFile();file=new File(directory,"original-file");bytes=new byte[1024*1024];new Random(34).nextBytes(bytes);Files.write(file.toPath(),bytes);expected=PeerMedia.inspect(file);}
 @Test public void localHashYieldsBetweenBlocksAndNeverChangesOriginal()throws Exception{
  AtomicInteger checkpoints=new AtomicInteger();try{PeerMedia.inspect(file,()->{assertFalse(Thread.holdsLock(TrashPurger.LOCK));if(checkpoints.incrementAndGet()==5)throw new CloudScan.Deferred();});fail("Local hash ignored direct priority");}catch(CloudScan.Deferred expected){}assertEquals(5,checkpoints.get());assertArrayEquals(bytes,Files.readAllBytes(file.toPath()));assertEquals(expected.getString("hash"),PeerMedia.inspect(file).getString("hash"));
 }
 @Test public void duplicateVerificationRunsOutsideDatabaseLockAndRetainsExactOriginal()throws Exception{
  AtomicInteger checks=new AtomicInteger();PeerMedia.receive(directory,"original-file",new ByteArrayInputStream(bytes),expected,()->{assertFalse("Large verification holds DB lock",Thread.holdsLock(TrashPurger.LOCK));checks.incrementAndGet();});assertTrue(checks.get()>30);assertArrayEquals(bytes,Files.readAllBytes(file.toPath()));assertEquals(1,directory.list().length);
 }
 @Test public void cancelledTransferAndZeroProgressLeaveNoPartialDestination()throws Exception{
  AtomicInteger checks=new AtomicInteger();try{PeerMedia.receive(directory,"new-file",new ByteArrayInputStream(bytes),expected,()->{if(checks.incrementAndGet()==4)throw new CloudScan.Deferred();});fail("Cancelled copy committed");}catch(CloudScan.Deferred expected){}assertFalse(new File(directory,"new-file").exists());InputStream stalled=new InputStream(){public int read(){return 0;}public int read(byte[] b,int off,int len){return 0;}};try{PeerMedia.receive(directory,"new-file",stalled,expected);fail("Zero progress accepted");}catch(IOException expected){}assertEquals(1,directory.list().length);assertArrayEquals(bytes,Files.readAllBytes(file.toPath()));
 }
 @Test public void simultaneousDifferentOriginalIsNeverReplacedByVerifiedTemporaryFile()throws Exception{
  File other=new File(directory,"new-file");byte[] foreign=new byte[]{9,8,7,6};AtomicBoolean created=new AtomicBoolean();try{PeerMedia.receive(directory,"new-file",new ByteArrayInputStream(bytes),expected,()->{if(created.compareAndSet(false,true))Files.write(other.toPath(),foreign);});fail("Concurrent original replaced");}catch(IOException expected){}assertArrayEquals(foreign,Files.readAllBytes(other.toPath()));assertArrayEquals(bytes,Files.readAllBytes(file.toPath()));assertEquals(2,directory.list().length);
 }
}
