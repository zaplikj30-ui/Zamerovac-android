package cz.zamerovac.app;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncCanonicalTest {
 @Test public void javaAndEcmaScriptHaveIdenticalCanonicalBytesAndJobIds()throws Exception{
  JSONObject fixture;try(InputStream in=getClass().getClassLoader().getResourceAsStream("sync-canonical-v2.json")){assertNotNull(in);fixture=JsonInput.object(in.readAllBytes());}
  String canonical=CausalClock.canonical(fixture.getJSONObject("input"));assertEquals(fixture.getString("canonical"),canonical);assertEquals(fixture.getString("hash"),PeerWire.hash(canonical.getBytes(StandardCharsets.UTF_8)));JSONObject job=fixture.getJSONObject("job");assertEquals(fixture.getString("jobId"),PeerOutbox.jobId(job.getString("peer"),job.getString("kind"),job.getString("hash"),job.getString("sourceRef"),null));assertEquals("1e+23",CausalClock.canonical(1e23));assertEquals("0",CausalClock.canonical(-0.0));assertEquals("\"žárovka\"",CausalClock.canonical("žárovka"));
 }
 @Test public void conflictCopyMatchesEcmaScriptAndDoesNotDependOnMergeOrder()throws Exception{
  JSONObject fixture;try(InputStream in=getClass().getClassLoader().getResourceAsStream("sync-canonical-v2.json")){fixture=JsonInput.object(in.readAllBytes()).getJSONObject("conflict");}JSONObject a=fixture.getJSONObject("a"),b=fixture.getJSONObject("b"),normal=SyncConflicts.normal(a,b),reverse=SyncConflicts.normal(b,a);assertEquals(CausalClock.canonical(fixture.getJSONObject("expected")),CausalClock.canonical(normal));assertEquals(CausalClock.canonical(normal.getJSONObject("copy")),CausalClock.canonical(reverse.getJSONObject("copy")));assertNotEquals(normal.getString("winner"),reverse.getString("winner"));
 }
 @Test public void invalidUnicodeIsRejectedInsteadOfSilentlyChangingBytes()throws Exception{
  for(String invalid:new String[]{"\ud800","\udc00","abc\ud800x"})try{CausalClock.canonical(new JSONObject().put("text",invalid));fail("Invalid Unicode accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("Unicode"));}
 }
}
