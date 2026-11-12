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
 @Test public void cachedAndReopenedInboxInvalidateEveryReceiptAfterDatabaseFallback()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"inbox-recovery-").toFile(),home=new File(root,"files");
  assertTrue(home.mkdir());
  String empty="{\"schema\":1,\"records\":[]}";
  String fresh="{\"schema\":1,\"records\":[{\"id\":\"new\",\"measure\":\"1585,800001\",\"media\":[\"original-photo\"]}]}";
  LocalDatabase.write(home,empty);
  File media=new File(home,"media");assertTrue(media.mkdir());
  byte[] photo=new byte[]{1,5,8,5,80,0,1,37};
  Files.write(new File(media,"original-photo").toPath(),photo);
  LocalDatabase.write(home,fresh);
  byte[] backup=Files.readAllBytes(new File(home,"projects.bak").toPath());
  assertEquals(empty,new String(backup,java.nio.charset.StandardCharsets.UTF_8));
  CloudInbox inbox=new CloudInbox(root,A,"store",home),reopened=new CloudInbox(root,A,"store",home);
  inbox.committed(B,NAME,H,123);inbox.acknowledged(B,NAME);
  assertTrue(inbox.get(B,NAME).getBoolean("acked"));
  assertTrue(reopened.get(B,NAME).getBoolean("acked"));
  File primary=new File(home,"projects.json");
  Files.write(primary.toPath(),new byte[]{0});
  assertEquals("Only diagnostic fallback is readable; never write authority",empty,LocalDatabase.read(home));
  assertTrue(DatabaseRecovery.pending(home));
  String epoch=DatabaseRecovery.id(home);
  assertNull("Cached old receipt invalidated",inbox.get(B,NAME));
  assertNull("Previously opened instance invalidated",reopened.get(B,NAME));
  assertNull("Restarted instance invalidated",new CloudInbox(root,A,"store",home).get(B,NAME));
  try{LocalDatabase.readForCas(home);fail("Recovery fallback granted CAS authority");}
  catch(IOException expected){}
  try{LocalDatabase.write(home,fresh);fail("Recovery silently promoted old source");}
  catch(IOException expected){}
  try{inbox.acknowledged(B,NAME);fail("Old acknowledgement was revived");}
  catch(IOException expected){}
  assertArrayEquals(new byte[]{0},Files.readAllBytes(primary.toPath()));
  assertArrayEquals("Original recovery copy must stay byte exact",backup,
      Files.readAllBytes(new File(home,"projects.bak").toPath()));
  assertArrayEquals(photo,Files.readAllBytes(new File(media,"original-photo").toPath()));
  assertEquals(epoch,DatabaseRecovery.id(home));
  assertTrue(DatabaseRecovery.pending(home));
  assertNull(inbox.get(B,NAME));
  assertNull(new CloudInbox(root,A,"store",home).get(B,NAME));
 }
 @Test public void supersededLocalIntentCannotBecomeRemoteAcknowledgementAndRecoveryInvalidatesIt()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"inbox-obsolete-").toFile(),home=new File(root,"files");assertTrue(home.mkdir());String empty="{\"schema\":1,\"records\":[]}",fresh="{\"schema\":1,\"records\":[{\"id\":\"new\"}]}";LocalDatabase.write(home,empty);LocalDatabase.write(home,fresh);CloudInbox inbox=new CloudInbox(root,A,"store",home);synchronized(TrashPurger.LOCK){inbox.superseded(B,NAME,H,123);}JSONObject entry=inbox.get(B,NAME);assertTrue(entry.getBoolean("obsolete"));assertFalse(entry.getBoolean("acked"));try{inbox.acknowledged(B,NAME);fail("Skipped files falsely acknowledged");}catch(IOException expected){}assertTrue(new CloudInbox(root,A,"store",home).get(B,NAME).getBoolean("obsolete"));Files.write(new File(home,"projects.json").toPath(),new byte[]{0});assertEquals(empty,LocalDatabase.read(home));assertNull(inbox.get(B,NAME));
 }
}
