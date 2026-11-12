package cz.zamerovac.app;

import android.content.Context;
import android.database.sqlite.SQLiteDatabase;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

/** Real SQLite/filesystem faults; these do not claim atomicity with an external provider. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncConsistencyTest {
    static String queue(int revision) { return "{\"version\":2,\"revision\":"+revision+",\"jobs\":[]}"; }
    static void text(File file,String value)throws IOException { Files.write(file.toPath(),value.getBytes(StandardCharsets.UTF_8)); }
    File home;
    @Before public void setup()throws Exception {
        home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"sync-consistency-").toFile();
    }
    @Test public void newlyAppearingLegacyQueueMustAbortCutoverAndSurviveRestart()throws Exception {
        File legacy=new File(home,"sync-queue-v2.json");
        try(SyncLedger ignored=SyncLedger.open(home,point->{if("legacy-copied".equals(point))text(legacy,queue(7));})) {
            fail("Migration silently replaced a newly appearing queue with an empty ledger");
        } catch(IOException expected) { assertTrue(legacy.isFile()); }
        assertEquals(queue(7),SyncLedgerTest.readText(legacy.toPath()));
        try(SyncLedger reopened=SyncLedger.open(home)) { assertEquals(queue(7),reopened.queue()); }
    }
    @Test public void newlyAppearingBackupMustAbortCutoverWithoutLosingEitherVersion()throws Exception {
        File legacy=new File(home,"sync-queue-v2.json"),backup=new File(legacy+".bak");text(legacy,queue(7));
        try(SyncLedger ignored=SyncLedger.open(home,point->{if("before-cutover".equals(point))text(backup,queue(6));})) {
            fail("Migration ignored a newly appearing AtomicFile backup");
        } catch(IOException expected) { assertTrue(backup.isFile()); }
        assertEquals(queue(7),SyncLedgerTest.readText(legacy.toPath()));assertEquals(queue(6),SyncLedgerTest.readText(backup.toPath()));
        try(SyncLedger reopened=SyncLedger.open(home)) { assertEquals(queue(6),reopened.queue()); }
    }
    @Test public void lazyDocumentCutoverAlsoChecksAbsentSourcesAndKeepsSqlAuthorityOnRetry()throws Exception {
        File source=new File(home,"sync-inbox-v2-synthetic.json");String legacy="{\"sequence\":7}",newer="{\"sequence\":8}";
        try(SyncLedger ledger=SyncLedger.open(home,point->{if("before-document-cutover".equals(point))text(source,legacy);})) {
            try { ledger.legacyDocument(source,"{}");fail("Lazy cutover ignored a newly appearing source"); }
            catch(IOException expected) { assertEquals(legacy,SyncLedgerTest.readText(source.toPath())); }
        }
        try(SyncLedger reopened=SyncLedger.open(home)) {
            assertEquals(legacy,reopened.legacyDocument(source,"{}"));reopened.saveDocument(source,new JSONObject(newer));
        }
        try(SyncLedger reopened=SyncLedger.open(home)) { assertEquals(newer,reopened.legacyDocument(source,"{}")); }
        assertEquals(legacy,SyncLedgerTest.readText(source.toPath()));
    }
    @Test public void changedInventoryBytesCannotFalselyRemoveTheContentRequirement()throws Exception {
        Context c=RuntimeEnvironment.getApplication();String saved="{\"schema\":1,\"records\":[]}";LocalDatabase.write(c,saved);
        String target;
        try(SyncLedger ledger=SyncLedger.open(home)) { target=ledger.target("saf","synthetic-space",PeerTlsTest.B);ledger.contentInventory(target,"error"); }
        // Simulate semantic corruption that SQLite quick_check cannot detect: value changes, its hash does not.
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(home,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)) {
            db.execSQL("UPDATE documents SET value='none' WHERE name=?",new Object[]{"content:"+target});
        }
        try(SyncLedger reopened=SyncLedger.open(home)) {
            try { reopened.status(saved,"");fail("Unchecked content bytes falsely became not-required"); }
            catch(IOException expected) { assertEquals(saved,LocalDatabase.readForCas(c)); }
        }
    }
    private void snapshotChange(boolean recovery)throws Exception {
        Context c=RuntimeEnvironment.getApplication();String old="{\"schema\":1,\"records\":[{\"id\":\"precise\",\"measure\":\"1585,800001234567890\",\"unit\":\"in\"}]}";
        String newer="{\"schema\":1,\"records\":[{\"id\":\"precise\",\"measure\":\"999,000000000000001\",\"unit\":\"in\"}]}";
        LocalDatabase.write(c,old);AtomicInteger checkpoints=new AtomicInteger();
        try {
            PeerSnapshot.capture(c,c.getSharedPreferences("coherent-snapshot",0),()->{
                // No media: these are the two existing capture checkpoints surrounding metadata preparation.
                if(checkpoints.incrementAndGet()==2) {
                    if(recovery) {
                        // Explicit test-only recovery fixture, not a production restore API or automatic repair.
                        text(new File(c.getFilesDir(),"projects.json"),"broken");
                        try { LocalDatabase.readForCas(c);fail("Damaged primary regained authority"); } catch(IOException blocked) {}
                        text(new File(c.getFilesDir(),"projects.json"),newer);DatabaseRecovery.healthy(c.getFilesDir(),false);
                    } else LocalDatabase.write(c,newer);
                }
            });
            fail(recovery?"Pre-recovery JSON was stamped with a new recovery epoch":"Capture returned obsolete JSON after a concurrent commit");
        } catch(IOException expected) { assertEquals(newer,LocalDatabase.readForCas(c)); }
        assertEquals(2,checkpoints.get());
        PeerSnapshot fresh=PeerSnapshot.capture(c,c.getSharedPreferences("coherent-snapshot",0));
        assertEquals("999,000000000000001",fresh.data.getJSONArray("records").getJSONObject(0).getString("measure"));
        assertEquals(DatabaseRecovery.id(c.getFilesDir()),fresh.wire.optString("recoveryEpoch",""));
    }
    @Test public void concurrentCommitCannotBeHiddenInsideSnapshotCapture()throws Exception { snapshotChange(false); }
    @Test public void preRecoveryJsonCannotAcquireTheNewEpochDuringCapture()throws Exception { snapshotChange(true); }
    @Test public void directPrimaryChangeCannotBypassTheProcessGenerationCheck()throws Exception {
        Context c=RuntimeEnvironment.getApplication();String old="{\"schema\":1,\"records\":[]}",newer="{\"schema\":1,\"records\":[{\"id\":\"newer\",\"measure\":\"0,000000000123456789\"}]}";
        LocalDatabase.write(c,old);long generation=LocalDatabase.generation(c.getFilesDir());AtomicInteger checkpoints=new AtomicInteger();
        try {
            PeerSnapshot.capture(c,c.getSharedPreferences("raw-change",0),()->{if(checkpoints.incrementAndGet()==2)text(new File(c.getFilesDir(),"projects.json"),newer);});
            fail("Raw valid primary replacement was hidden by unchanged process generation");
        } catch(IOException expected) { assertEquals(newer,LocalDatabase.readForCas(c)); }
        assertEquals(generation,LocalDatabase.generation(c.getFilesDir()));
        assertEquals("0,000000000123456789",PeerSnapshot.capture(c,c.getSharedPreferences("raw-change",0)).data.getJSONArray("records").getJSONObject(0).getString("measure"));
    }
}
