package cz.zamerovac.app;
import android.content.Context;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class CloudPublicationsTest {
 static final String A=PeerTlsTest.A,B=PeerTlsTest.B,H="a".repeat(64),S="b".repeat(64),R="c".repeat(64),PATH="sync/v2/blobs/"+H+"-33333333-3333-4333-8333-333333333333";
 File root;AtomicLong clock;CloudPublications journal;
 @Before public void setup()throws Exception{root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"publication-").toFile();clock=new AtomicLong(1000000);journal=new CloudPublications(root,A,"store",clock::get);}
 Map<String,ImmutableStore.Entry> available(long size){String name=PATH.substring(PATH.lastIndexOf('/')+1);return Collections.singletonMap(name,new ImmutableStore.Entry(name,false,size));}
 @Test public void verifiedReceiptSurvivesRestartButMissingChangedExpiredOrForeignStoreCannotReuseIt()throws Exception{
  assertNull(journal.fresh(H,100,"",available(100)));journal.published(H,100,PATH,"");CloudPublications reopen=new CloudPublications(root,A,"store",clock::get);assertEquals(PATH,reopen.fresh(H,100,"",available(100)));assertNull(reopen.fresh(H,100,"",Collections.emptyMap()));assertNull(reopen.fresh(H,100,"",available(99)));assertNull(new CloudPublications(root,A,"other",clock::get).fresh(H,100,"",available(100)));assertNull(new CloudPublications(root,B,"store",clock::get).fresh(H,100,"",available(100)));assertNull(reopen.fresh(H,100,R,available(100)));journal.published(H,100,PATH,R);assertEquals(PATH,reopen.fresh(H,100,R,available(100)));clock.addAndGet(CloudPublications.RECHECK_MS);assertNull(reopen.fresh(H,100,"",available(100)));clock.set(1);assertNull(reopen.fresh(H,100,"",available(100)));
 }
 @Test public void repairRequestUsesDurableCounterBackoffAndNeverTreatsPublicationAsDataAck()throws Exception{
  JSONObject first=journal.need(B,S,200,H,100);assertEquals(1,first.getLong("sequence"));assertFalse(first.getBoolean("sent"));assertFalse(first.getBoolean("committed"));assertEquals(first.getString("request"),new CloudPublications(root,A,"store",clock::get).need(B,S,200,H,100).getString("request"));journal.sent(B,S,H,1);assertTrue(journal.need(B,S,200,H,100).getBoolean("sent"));clock.addAndGet(CloudPublications.REQUEST_MS);JSONObject second=journal.need(B,S,200,H,100);assertEquals(2,second.getLong("sequence"));assertNotEquals(first.getString("request"),second.getString("request"));
  String name=S+"-33333333-3333-4333-8333-333333333333.json";journal.observe(B,name,S,H,2);assertEquals(2,journal.pending(B,S,H));assertTrue(journal.seen(B,name));journal.handled(B,S,H,2);assertEquals(0,journal.pending(B,S,H));journal.observe(B,S+"-44444444-4444-4444-8444-444444444444.json",S,H,1);assertEquals(0,journal.pending(B,S,H));assertEquals(2,journal.requested(B,S,H));
 }
 @Test public void failedAtomicReceiptCannotEnterCacheOrAdvanceRepair()throws Exception{
  journal.published(H,100,PATH,"");LedgerTestFault.block(root);try{journal.published(H,100,PATH,R);fail("Failed receipt acknowledged");}catch(IOException expected){}assertNull(journal.fresh(H,100,R,available(100)));assertNull(new CloudPublications(root,A,"store",clock::get).fresh(H,100,R,available(100)));assertEquals(PATH,journal.fresh(H,100,"",available(100)));LedgerTestFault.unblock(root);try{journal.handled(B,S,H,1);fail("Missing repair handled");}catch(IOException expected){}
 }
 @Test public void completeSnapshotPublicationIsScopedDurableExpiringAndStillNotADataAck()throws Exception{
  assertFalse(journal.snapshotPublished(B,S));journal.publishedSnapshot(B,S);assertTrue(new CloudPublications(root,A,"store",clock::get).snapshotPublished(B,S));assertFalse(new CloudPublications(root,A,"different",clock::get).snapshotPublished(B,S));assertFalse(new CloudPublications(root,B,"store",clock::get).snapshotPublished(A,S));assertFalse(journal.snapshotPublished(B,H));clock.addAndGet(CloudPublications.RECHECK_MS);assertFalse(journal.snapshotPublished(B,S));clock.set(1);assertFalse(journal.snapshotPublished(B,S));LedgerTestFault.block(root);try{journal.publishedSnapshot(B,H);fail("Unconfirmed snapshot publication cached");}catch(IOException expected){}assertFalse(journal.snapshotPublished(B,H));
 }
}
