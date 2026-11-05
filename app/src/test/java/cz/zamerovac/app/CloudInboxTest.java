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
public class CloudInboxTest {
 static final String A=PeerTlsTest.A,B=PeerTlsTest.B,H="a".repeat(64),NAME=H+"-33333333-3333-4333-8333-333333333333.json";
 @Test public void committedReceiptSurvivesReopenAndIsScopedToInstallationAndStore()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"inbox-").toFile();CloudInbox first=new CloudInbox(root,A,"store-one"),stale=new CloudInbox(root,A,"store-one");assertNull(stale.get(B,NAME));first.committed(B,NAME,H,123);assertFalse(stale.get(B,NAME).getBoolean("acked"));first.acknowledged(B,NAME);assertTrue(stale.get(B,NAME).getBoolean("acked"));assertTrue(new CloudInbox(root,A,"store-one").get(B,NAME).getBoolean("acked"));assertNull(new CloudInbox(root,A,"store-two").get(B,NAME));assertNull(new CloudInbox(root,B,"store-one").get(A,NAME));
 }
 @Test public void failedReceiptWriteCannotTurnUnacknowledgedCommitIntoCachedSuccess()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"inbox-fail-").toFile();CloudInbox inbox=new CloudInbox(root,A,"store");inbox.committed(B,NAME,H,123);File primary=root.listFiles(file->file.getName().endsWith(".json"))[0],blocker=new File(primary+".new");blocker.mkdirs();Files.write(new File(blocker,"block").toPath(),new byte[]{1});try{inbox.acknowledged(B,NAME);fail("Receipt write failure hidden");}catch(IOException expected){}assertFalse(inbox.get(B,NAME).getBoolean("acked"));assertFalse(new CloudInbox(root,A,"store").get(B,NAME).getBoolean("acked"));new File(blocker,"block").delete();blocker.delete();
 }
 @Test public void missingCommitAndChangedImmutableMessageCannotBeAcknowledged()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"inbox-invalid-").toFile();CloudInbox inbox=new CloudInbox(root,A,"store");try{inbox.acknowledged(B,NAME);fail("No commit was acknowledged");}catch(IOException expected){}inbox.committed(B,NAME,H,123);try{inbox.committed(B,NAME,H,124);fail("Changed immutable receipt accepted");}catch(IOException expected){}assertEquals(123,inbox.get(B,NAME).getLong("size"));
 }
}
