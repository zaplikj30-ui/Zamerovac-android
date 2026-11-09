package cz.zamerovac.app;

import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import static org.junit.Assert.*;

/** Negative and migration regressions for text-only databases with no media. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DatabaseInstallEvidenceTest {
    File home;
    @Before public void setup() throws Exception {
        home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "initialization-evidence-").toFile();
    }
    private String text(String measure) {
        return "{\"schema\":1,\"records\":[{\"id\":\"text-only\",\"items\":[{\"measure\":\""+
            measure+"\"}],\"media\":[]}]}";
    }
    private void rejectsReset() throws Exception {
        try { LocalDatabase.readForCas(home);fail("Lost initialized DB accepted as clean"); }
        catch(IOException expected) {}
        try { LocalDatabase.write(home,text("99,99"));fail("Lost initialized DB overwritten"); }
        catch(IOException expected) {}
        assertFalse(new File(home,"projects.json").exists());
    }
    @Test public void firstCleanTextOnlySaveCreatesDurableEvidence() throws Exception {
        assertEquals("",LocalDatabase.readForCas(home));
        String original=text("1585,800001234567890");
        LocalDatabase.write(home,original);
        assertTrue(DatabaseInstallEvidence.exists(home));
        DatabaseInstallEvidence.verify(home);
        assertEquals(original,LocalDatabase.readForCas(home));
    }
    @Test public void lostTextOnlyDatabaseAndJournalNeverBecomesFreshInstall() throws Exception {
        String exact=text("1585,800001234567890");
        LocalDatabase.write(home,exact);
        assertTrue(new File(home,"projects.json").delete());
        assertTrue(new File(home,"projects.recovery-v1.json").delete());
        assertFalse(new File(home,"projects.bak").exists());
        assertFalse(new File(home,"media").exists());
        rejectsReset();
        assertTrue(DatabaseInstallEvidence.exists(home));
        assertFalse(new File(home,"projects.json").exists());
    }
    @Test public void migratedLegacyPrimarySurvivesLaterLossAsEvidence() throws Exception {
        String legacy=text("0,0000000000000007");
        Files.write(new File(home,"projects.json").toPath(),legacy.getBytes(StandardCharsets.UTF_8));
        assertFalse(DatabaseInstallEvidence.exists(home));
        assertEquals(legacy,LocalDatabase.readForCas(home));
        assertTrue(DatabaseInstallEvidence.exists(home));
        assertTrue(new File(home,"projects.json").delete());
        rejectsReset();
    }
    @Test public void interruptedOrCorruptEvidenceMustNotAuthorizeReset() throws Exception {
        Files.write(new File(home,"projects.initialized-v1.new").toPath(),new byte[]{11,12,13});
        rejectsReset();
        assertArrayEquals(new byte[]{11,12,13},
            Files.readAllBytes(new File(home,"projects.initialized-v1.new").toPath()));
        assertTrue(new File(home,"projects.initialized-v1.new").delete());
        Files.write(new File(home,"projects.initialized-v1").toPath(),new byte[]{99});
        rejectsReset();
        try { DatabaseInstallEvidence.verify(home);fail("Corrupt marker verified"); }
        catch(IOException expected) {}
    }
    @Test public void unreadableMarkerNeverGetsSilentlyReplaced() throws Exception {
        assertTrue(new File(home,"projects.initialized-v1").mkdir());
        rejectsReset();
        try { DatabaseInstallEvidence.ensure(home);fail("Non-file marker replaced"); }
        catch(IOException expected) {}
        assertTrue(new File(home,"projects.initialized-v1").isDirectory());
    }
}
