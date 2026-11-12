package cz.zamerovac.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CloudScanTest {
 static final String A=PeerTlsTest.A,B=PeerTlsTest.B;
 static String name(int index){return "0".repeat(64)+"-"+String.format(java.util.Locale.ROOT,"%08x-0000-4000-8000-%012x",index,index)+".json";}
 @Test public void roundRobinSurvivesRestartWithoutTrustingOrDiscardingMessage()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"scan-").toFile();CloudScan first=new CloudScan(root,A,"store");List<ImmutableStore.Entry> entries=new ArrayList<>();for(int i=0;i<80;i++)entries.add(new ImmutableStore.Entry(name(i),false,100));Collections.reverse(entries);List<ImmutableStore.Entry> ordered=first.ordered("messages/A/B",entries);assertEquals(name(0),ordered.get(0).name);first.advance("messages/A/B",name(31));CloudScan reopened=new CloudScan(root,A,"store");assertEquals(name(32),reopened.ordered("messages/A/B",entries).get(0).name);assertEquals(name(0),reopened.ordered("other-scope",entries).get(0).name);assertEquals(name(0),new CloudScan(root,A,"other-store").ordered("messages/A/B",entries).get(0).name);assertEquals(name(0),new CloudScan(root,B,"store").ordered("messages/A/B",entries).get(0).name);
  reopened.advance("messages/A/B",name(79));assertEquals(name(0),first.ordered("messages/A/B",entries).get(0).name);List<ImmutableStore.Entry> peers=Arrays.asList(new ImmutableStore.Entry(A,false,0),new ImmutableStore.Entry(B,false,0));first.advance("peers",A);assertEquals(B,reopened.ordered("peers",peers).get(0).name);
 }
 @Test public void failedCursorWriteDoesNotAdvanceCachedStateOrAcceptUnsafePosition()throws Exception{
  File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"scan-failure-").toFile();CloudScan scan=new CloudScan(root,A,"store");scan.advance("scope",name(0));LedgerTestFault.block(root);try{scan.advance("scope",name(1));fail("Failed position write acknowledged");}catch(IOException expected){}List<ImmutableStore.Entry> entries=Arrays.asList(new ImmutableStore.Entry(name(0),false,1),new ImmutableStore.Entry(name(1),false,1),new ImmutableStore.Entry(name(2),false,1));assertEquals(name(1),scan.ordered("scope",entries).get(0).name);assertEquals(name(1),new CloudScan(root,A,"store").ordered("scope",entries).get(0).name);for(String invalid:new String[]{"../other","arbitrary.json","bad-id"})try{scan.advance("scope",invalid);fail("Unsafe cursor position accepted");}catch(IOException expected){}LedgerTestFault.unblock(root);
 }
}
