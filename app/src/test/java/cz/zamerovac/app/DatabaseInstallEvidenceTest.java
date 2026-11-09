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
    File home,noBackup;
    @Before public void setup() throws Exception {
        home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "initialization-evidence-").toFile();
        noBackup=new File(home.getParentFile(),"no_backup-"+home.getName());
        assertTrue(noBackup.mkdirs());
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
        Files.write(new File(home,"zamerovac-install-state-v1.marker.new").toPath(),new byte[]{11,12,13});
        rejectsReset();
        assertArrayEquals(new byte[]{11,12,13},
            Files.readAllBytes(new File(home,"zamerovac-install-state-v1.marker.new").toPath()));
        assertTrue(new File(home,"zamerovac-install-state-v1.marker.new").delete());
        Files.write(new File(home,"zamerovac-install-state-v1.marker").toPath(),new byte[]{99});
        rejectsReset();
        try { DatabaseInstallEvidence.verify(home);fail("Corrupt marker verified"); }
        catch(IOException expected) {}
    }
    @Test public void unreadableMarkerNeverGetsSilentlyReplaced() throws Exception {
        assertTrue(new File(home,"zamerovac-install-state-v1.marker").mkdir());
        rejectsReset();
        try { DatabaseInstallEvidence.ensure(home);fail("Non-file marker replaced"); }
        catch(IOException expected) {}
        assertTrue(new File(home,"zamerovac-install-state-v1.marker").isDirectory());
    }

    private void refusesState(String value)throws Exception{
        try{LocalDatabase.readForCas(home,noBackup);fail("Ambiguous state authorized a reset: "+value);}
        catch(IOException expected){}
        try{LocalDatabase.write(home,noBackup,text("999,0000"));fail("Ambiguous state overwritten data: "+value);}
        catch(IOException expected){}
    }
    @Test public void redundantNoBackupEvidenceSurvivesSelectiveFilesLossAndRestart()throws Exception{
        String original=text("1585,800001234567890");
        LocalDatabase.write(home,noBackup,original);
        DatabaseInstallEvidence.verify(home,noBackup);
        assertEquals(original,LocalDatabase.readForCas(home,noBackup));
        assertTrue(new File(home,"projects.json").delete());
        assertTrue(new File(home,"projects.recovery-v1.json").delete());
        assertTrue(new File(home,"zamerovac-install-state-v1.marker").delete());
        assertFalse(new File(home,"projects.bak").exists());
        refusesState("no_backup marker only");
        // Independent file objects approximate a fresh process reading persisted evidence.
        assertTrue(DatabaseRecovery.pending(new File(home.getAbsolutePath())));
        String first=DatabaseRecovery.id(new File(home.getAbsolutePath()));
        assertTrue(DeviceIdentity.valid(first));
        refusesState("repeat after restart");
        assertEquals(first,DatabaseRecovery.id(new File(home.getAbsolutePath())));
        assertFalse(new File(home,"projects.json").exists());
    }
    @Test public void legacyPrimaryMigratesToBothLocationsWithoutChangingExactData()throws Exception{
        String original=text("0,0000000000000007");
        byte[] expected=original.getBytes(StandardCharsets.UTF_8);
        Files.write(new File(home,"projects.json").toPath(),expected);
        assertEquals(original,LocalDatabase.readForCas(home,noBackup));
        DatabaseInstallEvidence.verify(home,noBackup);
        assertArrayEquals(expected,Files.readAllBytes(new File(home,"projects.json").toPath()));
        assertTrue(new File(home,"projects.json").delete());
        assertTrue(new File(home,"zamerovac-install-state-v1.marker").delete());
        refusesState("migrated backup marker survives");
    }
    @Test public void legacySyncReceiptsAlonePreventNewBlankDatabaseAndRetireOldAck()throws Exception{
        String original=text("1250,000000000000001");
        Files.write(new File(home,"projects.json").toPath(),original.getBytes(StandardCharsets.UTF_8));
        String peerId=java.util.UUID.randomUUID().toString();
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        registry.approve(peerId,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Test peer");
        registry.acknowledged(peerId,"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb");
        assertEquals("bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",registry.lastAck(peerId));
        assertTrue(new File(home,"projects.json").delete());
        assertFalse(DatabaseInstallEvidence.exists(home,noBackup));
        refusesState("only legacy sync receipts survive");
        assertEquals("",new SyncPeerRegistry(noBackup).lastAck(peerId));
        assertTrue(DeviceIdentity.valid(DatabaseRecovery.id(home)));
        assertEquals(DatabaseRecovery.id(home),new JSONObject(
            Files.readString(new File(noBackup,"sync-peers-v2.json").toPath())).getString("localRecovery"));
        assertTrue(DatabaseRecovery.pending(home));
    }
    @Test public void firstInstallWithIdentityAloneIsStillClean()throws Exception{
        String identity=DeviceIdentity.get(noBackup);
        assertTrue(DeviceIdentity.valid(identity));
        assertFalse(DatabaseInstallEvidence.legacySyncTraces(noBackup));
        String original=text("1234,000000000012345");
        LocalDatabase.write(home,noBackup,original);
        assertEquals(original,LocalDatabase.readForCas(home,noBackup));
        DatabaseInstallEvidence.verify(home,noBackup);
    }
    @Test public void oversizedBaseBackupAndNewMarkersAreAlwaysRejected()throws Exception{
        String name="zamerovac-install-state-v1.marker";
        for(String suffix:new String[]{"",".bak",".new"}){
            File candidate=new File(home,name+suffix);
            Files.write(candidate.toPath(),new byte[1024*1024]);
            refusesState("oversized "+suffix);
            assertEquals(1024L*1024L,candidate.length());
            assertTrue(candidate.delete());
            File journal=new File(home,"projects.recovery-v1.json");
            if(journal.exists())assertTrue(journal.delete());
        }
    }
    @Test public void interruptedAtomicWriteIsDetectedWithoutDestroyingValidPrimary()throws Exception{
        String original=text("9876,0000000009");
        LocalDatabase.write(home,noBackup,original);
        byte[] preserved=Files.readAllBytes(new File(home,"projects.json").toPath());
        android.util.AtomicFile atomic=new android.util.AtomicFile(
            new File(noBackup,"zamerovac-install-state-v1.marker"));
        FileOutputStream stream=atomic.startWrite();
        stream.write(new byte[]{10,11,12});
        stream.getFD().sync();
        stream.close(); // simulate crash before finishWrite / failWrite
        try{LocalDatabase.readForCas(home,noBackup);fail("Unfinished marker was accepted");}
        catch(IOException expected){}
        assertArrayEquals(preserved,Files.readAllBytes(new File(home,"projects.json").toPath()));
        // The test removes only its synthetic unfinished marker.
        File unfinished=new File(noBackup,"zamerovac-install-state-v1.marker.new");
        assertTrue(unfinished.exists());assertTrue(unfinished.delete());
        assertEquals(original,LocalDatabase.readForCas(home,noBackup));
    }
    @Test public void malformedSurvivorOrUnusableMarkerCannotBeSilentlyRepaired()throws Exception{
        String original=text("111,000000000123");
        LocalDatabase.write(home,noBackup,original);
        File corrupted=new File(noBackup,"zamerovac-install-state-v1.marker");
        Files.write(corrupted.toPath(),new byte[]{66});
        try{LocalDatabase.readForCas(home,noBackup);fail("Corrupt no_backup marker ignored");}
        catch(IOException expected){}
        assertEquals(1,corrupted.length());
        assertEquals(original,LocalDatabase.readFile(new File(home,"projects.json")));
    }
    @Test public void symlinkEvidenceIsNeverInterpretedAsAbsent()throws Exception{
        File target=new File(home,"missing-target");
        File marker=new File(home,"zamerovac-install-state-v1.marker");
        try{Files.createSymbolicLink(marker.toPath(),target.toPath());}
        catch(UnsupportedOperationException|java.nio.file.FileSystemException unsupported){return;}
        refusesState("symlink");
        assertTrue(Files.isSymbolicLink(marker.toPath()));
    }
    @Test public void corruptedPrimaryWithValidOldBackupLeavesBytesAndRequiresRecoveryEpoch()throws Exception{
        String first=text("0,00000000001"),last=text("1585,800001234567890");
        LocalDatabase.write(home,noBackup,first);
        LocalDatabase.write(home,noBackup,last);
        Files.write(new File(home,"projects.json").toPath(),new byte[]{1,2,3,4});
        byte[] corrupt=Files.readAllBytes(new File(home,"projects.json").toPath());
        byte[] previous=Files.readAllBytes(new File(home,"projects.bak").toPath());
        try{LocalDatabase.readForCas(home,noBackup);fail("Corrupt primary accepted");}
        catch(IOException expected){}
        assertTrue(DatabaseRecovery.pending(home));
        String epoch=DatabaseRecovery.id(home);assertTrue(DeviceIdentity.valid(epoch));
        try{LocalDatabase.readForCas(home,noBackup);fail("Recovered stale backup automatically");}
        catch(IOException expected){}
        assertEquals(epoch,DatabaseRecovery.id(home));
        assertArrayEquals(corrupt,Files.readAllBytes(new File(home,"projects.json").toPath()));
        assertArrayEquals(previous,Files.readAllBytes(new File(home,"projects.bak").toPath()));
    }
}
