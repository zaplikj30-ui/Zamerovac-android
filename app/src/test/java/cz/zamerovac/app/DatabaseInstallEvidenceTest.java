package cz.zamerovac.app;

import org.junit.*;
import org.json.JSONObject;
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
            new String(Files.readAllBytes(new File(noBackup,"sync-peers-v2.json").toPath()),StandardCharsets.UTF_8)).getString("localRecovery"));
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
        catch(UnsupportedOperationException|java.nio.file.FileSystemException unsupported){
            org.junit.Assume.assumeTrue("Symlinky nejsou na této platformě podporovány",false);
            return;
        }
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

    @Test public void recoveredSnapshotUsesNewHashAndRejectsOldCloudAckIdentity()throws Exception{
        String original=text("1585,800001234567890");
        LocalDatabase.write(home,noBackup,original);
        android.content.Context ctx=new android.content.ContextWrapper(RuntimeEnvironment.getApplication()){
            @Override public File getFilesDir(){return home;}
            @Override public File getNoBackupFilesDir(){return noBackup;}
            @Override public android.content.Context getApplicationContext(){return this;}
        };
        android.content.SharedPreferences prefs=ctx.getSharedPreferences(
            "recovery-hash-"+home.getName(),android.content.Context.MODE_PRIVATE);
        PeerSnapshot before=PeerSnapshot.capture(ctx,prefs);
        assertFalse(before.wire.has("recoveryEpoch"));
        assertTrue(new File(home,"projects.json").delete());
        try{LocalDatabase.readForCas(ctx);fail("Missing DB was accepted");}
        catch(IOException expected){}
        String epoch=DatabaseRecovery.id(home);
        assertTrue(DeviceIdentity.valid(epoch));
        assertTrue(DatabaseRecovery.pending(home));
        // TEST-ONLY stand-in for a future explicit, verified manual promotion:
        // real recovery UI/transaction is intentionally NOT implemented here.
        Files.write(new File(home,"projects.json").toPath(),original.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(home,false);
        PeerSnapshot after=PeerSnapshot.capture(ctx,prefs);
        assertEquals(epoch,after.wire.getString("recoveryEpoch"));
        assertNotEquals(before.hash,after.hash);
        assertEquals(CausalClock.canonical(before.data),CausalClock.canonical(after.data));
        assertEquals("1585,800001234567890",after.data.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals(after.hash,PeerSnapshot.capture(ctx,prefs).hash);
        String own=DeviceIdentity.get(noBackup);
        assertEquals(after.hash,PeerSnapshot.parse(after.bytes,own).hash);
        org.json.JSONObject invalid=new org.json.JSONObject(after.wire.toString())
            .put("recoveryEpoch","untrusted-epoch");
        try{PeerSnapshot.parse(CausalClock.canonical(invalid).getBytes(StandardCharsets.UTF_8),own);
            fail("Invalid recovery period accepted");}
        catch(IOException expected){}
    }

    private android.content.Context syntheticContext(){
        return new android.content.ContextWrapper(RuntimeEnvironment.getApplication()){
            @Override public File getFilesDir(){return home;}
            @Override public File getNoBackupFilesDir(){return noBackup;}
            @Override public android.content.Context getApplicationContext(){return this;}
        };
    }
    @Test public void temporaryUnreadablePrimaryRetriesWithoutRotatingEpoch()throws Exception{
        String exact=text("1585,800001234567890");
        LocalDatabase.write(home,noBackup,exact);
        LocalDatabase.write(home,noBackup,exact); // create a valid older backup too
        assertTrue(new File(home,"projects.bak").isFile());
        File primary=new File(home,"projects.json"),parked=new File(home,"protected-original");
        byte[] bytes=Files.readAllBytes(primary.toPath());
        String before=DatabaseRecovery.id(home);
        assertTrue(primary.renameTo(parked));
        assertTrue(primary.mkdir()); // deterministic non-regular inaccessible path
        try{LocalDatabase.readForCas(home,noBackup);fail("Unreadable primary was accepted");}
        catch(IOException expected){}
        try{LocalDatabase.read(home,noBackup);fail("Fallback silently accepted inaccessible primary");}
        catch(IOException expected){}
        assertEquals(before,DatabaseRecovery.id(home));
        assertFalse(DatabaseRecovery.pending(home));
        assertTrue(primary.delete());
        assertTrue(parked.renameTo(primary));
        assertArrayEquals(bytes,Files.readAllBytes(primary.toPath()));
        assertEquals(exact,LocalDatabase.readForCas(home,noBackup));
        assertEquals(before,DatabaseRecovery.id(home));
    }
    @Test public void staleOutboxIsRetainedButCannotBeReacknowledged()throws Exception{
        android.content.Context ctx=syntheticContext();
        String peer=java.util.UUID.randomUUID().toString();
        String exact=text("1250,000000000007");
        LocalDatabase.write(ctx,exact);
        android.content.SharedPreferences prefs=ctx.getSharedPreferences(
            "stale-outbox-"+home.getName(),android.content.Context.MODE_PRIVATE);
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        registry.approve(peer,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Peer");
        PeerOutbox local=new PeerOutbox(ctx,prefs,registry);
        PeerSnapshot before=local.prepare(peer);
        JSONObject oldJob=local.messages(peer).get(0);
        File original=new File(noBackup,"sync-v2-outbox/"+before.hash+".json");
        byte[] bytes=Files.readAllBytes(original.toPath());
        String id=oldJob.getString("id");
        assertEquals(1,local.pending(peer));
        assertTrue(new File(home,"projects.json").delete());
        try{LocalDatabase.readForCas(ctx);fail("Missing primary accepted");}
        catch(IOException expected){}
        String epoch=DatabaseRecovery.id(home);
        assertTrue(DeviceIdentity.valid(epoch));
        // Synthetic stand-in for the FUTURE explicit verified recovery transaction.
        Files.write(new File(home,"projects.json").toPath(),exact.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(home,false);
        try{local.completed(peer,oldJob);fail("Late ACK erased the original outbox");}
        catch(IOException expected){}
        assertEquals("",registry.lastAck(peer));
        assertArrayEquals(bytes,Files.readAllBytes(original.toPath()));
        PeerSnapshot current=local.prepare(peer);
        assertNotEquals(before.hash,current.hash);
        assertEquals(1,local.quarantinedCount(peer));
        assertEquals(1,local.messages(peer).size());
        assertEquals(current.hash,local.messages(peer).get(0).getString("hash"));
        JSONObject archived=new JSONObject(local.queue.read()).getJSONArray("recoveryQuarantine").getJSONObject(0);
        assertEquals(id,archived.getString("id"));
        PeerOutbox restarted=new PeerOutbox(ctx,prefs,new SyncPeerRegistry(noBackup));
        assertEquals(1,restarted.quarantinedCount(peer));
        try{restarted.completed(peer,oldJob);fail("Archived ACK accepted after restart");}
        catch(IOException expected){}
        assertArrayEquals(bytes,Files.readAllBytes(original.toPath()));
        restarted.completed(peer,restarted.messages(peer).get(0));
        assertEquals(current.hash,registry.lastAck(peer));
        assertEquals(1,restarted.quarantinedCount(peer));
        assertEquals(0,restarted.pending(peer));
        assertArrayEquals(bytes,Files.readAllBytes(original.toPath()));
        // Legacy writers must not accidentally omit the quarantined evidence.
        JSONObject update=new JSONObject(restarted.queue.read());
        long revision=update.getLong("revision");
        update.remove("recoveryQuarantine");update.put("revision",revision+1);
        assertTrue(restarted.queue.save(revision,update.toString()));
        assertEquals(1,restarted.quarantinedCount(peer));
    }

    @Test public void delayedBlobAckKeepsExactOriginalAndArchivedSnapshot()throws Exception{
        android.content.Context ctx=syntheticContext();
        String peer=java.util.UUID.randomUUID().toString();
        android.content.SharedPreferences prefs=ctx.getSharedPreferences(
            "recovery-media-"+home.getName(),android.content.Context.MODE_PRIVATE);
        String empty="{\"schema\":1,\"records\":[]}";
        LocalDatabase.write(ctx,empty);
        File mediaDir=new File(home,"media");assertTrue(mediaDir.mkdirs());
        File original=new File(mediaDir,"original-photo");
        byte[] photo=new byte[]{1,5,8,13,21,34,55,89};
        Files.write(original.toPath(),photo);
        String exact="1585,800001234567890";
        JSONObject record=new JSONObject().put("id","photo-project")
            .put("items",new org.json.JSONArray().put(
                new JSONObject().put("measure",exact)))
            .put("media",new org.json.JSONArray().put("original-photo"));
        String db=new JSONObject().put("schema",1).put("records",
            new org.json.JSONArray().put(record)).toString();
        LocalDatabase.write(ctx,db);
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        registry.approve(peer,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Test peer");
        PeerOutbox outbox=new PeerOutbox(ctx,prefs,registry);
        PeerSnapshot old=outbox.prepare(peer);
        JSONObject blobJob=null;
        org.json.JSONArray jobs=new JSONObject(outbox.queue.read()).getJSONArray("jobs");
        for(int i=0;i<jobs.length();i++){
            JSONObject candidate=jobs.getJSONObject(i);
            if("blob".equals(candidate.getString("kind")))blobJob=candidate;
        }
        assertNotNull(blobJob);
        File source=new File(noBackup,"sync-v2-outbox/"+old.hash+".json");
        byte[] snapshotBytes=Files.readAllBytes(source.toPath());
        assertTrue(new File(home,"projects.json").delete());
        try{LocalDatabase.readForCas(ctx);fail("Missing DB was accepted");}
        catch(IOException expected){}
        Files.write(new File(home,"projects.json").toPath(),db.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(home,false);
        JSONObject attempted=blobJob;
        try{outbox.acknowledge(attempted.getString("id"),
            attempted.getString("hash"),attempted.getLong("size"),false);
            fail("Late blob ACK deleted original transfer evidence");}
        catch(IOException expected){}
        assertEquals(2,outbox.pending(peer));
        assertArrayEquals(snapshotBytes,Files.readAllBytes(source.toPath()));
        assertArrayEquals(photo,Files.readAllBytes(original.toPath()));
        outbox.prepare(peer);
        assertEquals(2,outbox.quarantinedCount(peer));
        assertArrayEquals(snapshotBytes,Files.readAllBytes(source.toPath()));
        assertArrayEquals(photo,Files.readAllBytes(original.toPath()));
        assertEquals(exact,new JSONObject(LocalDatabase.readForCas(ctx))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void approvedPairingWithoutAnyProjectCanInitializeButNeverResetAfterFirstSave()throws Exception{
        android.content.Context ctx=syntheticContext();
        assertFalse(new File(home,"projects.json").exists());
        assertFalse(DatabaseInstallEvidence.exists(home,noBackup));
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        String peer=java.util.UUID.randomUUID().toString();
        registry.approve(peer,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Paired first");
        assertFalse("A new pairing is not proof of a deleted project",
            DatabaseInstallEvidence.legacySyncTraces(noBackup));
        assertEquals("",LocalDatabase.readForCas(ctx));
        String original=text("1585,800001234567890");
        LocalDatabase.write(ctx,original);
        DatabaseInstallEvidence.verify(home,noBackup);
        JSONObject peers=new JSONObject(new String(
            Files.readAllBytes(new File(noBackup,"sync-peers-v2.json").toPath()),StandardCharsets.UTF_8));
        assertEquals(Boolean.TRUE,peers.get("databaseEverInitialized"));
        assertEquals(original,LocalDatabase.readForCas(ctx));
        // Simulate selective loss of all primary initialization traces, leaving
        // the real no_backup registry that was paired BEFORE database creation.
        byte[] exact=Files.readAllBytes(new File(home,"projects.json").toPath());
        assertTrue(new File(home,"projects.json").delete());
        assertTrue(new File(home,"projects.recovery-v1.json").delete());
        assertTrue(new File(home,"zamerovac-install-state-v1.marker").delete());
        assertTrue(new File(noBackup,"zamerovac-install-state-v1.marker").delete());
        assertFalse(new File(home,"projects.bak").exists());
        assertTrue("The monotonic peer receipt survives full marker loss",
            DatabaseInstallEvidence.legacySyncTraces(noBackup));
        try{LocalDatabase.readForCas(ctx);fail("Lost projects reset after pairing");}
        catch(IOException expected){}
        try{LocalDatabase.write(ctx,text("999,00"));fail("Missing projects overwritten");}
        catch(IOException expected){}
        assertEquals("Paired first",registry.snapshot().getJSONObject(peer).getString("name"));
        assertArrayEquals("Original exact JSON bytes must be captured unchanged",
            original.getBytes(StandardCharsets.UTF_8),exact);
        assertFalse(new File(home,"projects.json").exists());
    }

    @Test public void unmarkedLegacyPairingRemainsFailClosedWithoutPrimary()throws Exception{
        android.content.Context ctx=syntheticContext();
        File saved=new File(noBackup,"sync-peers-v2.json");
        String peer=java.util.UUID.randomUUID().toString();
        new SyncPeerRegistry(noBackup).approve(peer,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Old pairing");
        JSONObject old=new JSONObject(new String(Files.readAllBytes(saved.toPath()),StandardCharsets.UTF_8));
        old.remove("databaseEverInitialized"); // old app versions did not record a pairing-only state
        Files.write(saved.toPath(),old.toString().getBytes(StandardCharsets.UTF_8));
        assertTrue(DatabaseInstallEvidence.legacySyncTraces(noBackup));
        try{LocalDatabase.readForCas(ctx);fail("Ambiguous legacy pairing accepted as new installation");}
        catch(IOException expected){}
        assertFalse(new File(home,"projects.json").exists());
    }

    /**
     * R9 regression: a surviving no_backup/localRecovery receipt MUST NOT
     * permit reuse of a pre-recovery signed ACK when only the recovery journal
     * disappears. This test intentionally goes RED on the original code.
     */
    @Test public void r9MissingRecoveryJournalCannotReacceptPreRecoveryAckOrOverwritePhoto()throws Exception{
        android.content.Context ctx=syntheticContext();
        android.content.SharedPreferences prefs=ctx.getSharedPreferences(
            "r9-journal-loss-"+home.getName(),android.content.Context.MODE_PRIVATE);
        String peer=java.util.UUID.randomUUID().toString();
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        registry.approve(peer,"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","Peer R9");
        // Seed a real empty primary BEFORE original media arrives: orphaned
        // files with no primary are correctly treated as ambiguous data loss.
        LocalDatabase.write(ctx,"{\"schema\":1,\"records\":[]}");
        File mediaDir=new File(home,"media");
        assertTrue(mediaDir.mkdirs());
        byte[] photo=new byte[]{8,13,21,34,55,89,7,1};
        File photoFile=new File(mediaDir,"photo-r9");
        Files.write(photoFile.toPath(),photo);
        String measure="1585,800001234567890";
        String original=new JSONObject().put("schema",1)
            .put("records",new org.json.JSONArray().put(
                new JSONObject().put("id","exact-r9")
                    .put("media",new org.json.JSONArray().put("photo-r9"))
                    .put("items",new org.json.JSONArray().put(
                        new JSONObject().put("measure",measure)))))
            .toString();
        LocalDatabase.write(ctx,original);
        PeerOutbox initialOutbox=new PeerOutbox(ctx,prefs,registry);
        PeerSnapshot before=initialOutbox.prepare(peer);
        JSONObject oldQueuedJob=initialOutbox.messages(peer).get(0);
        File originalOutbox=new File(noBackup,"sync-v2-outbox/"+before.hash+".json");
        byte[] originalTransfer=Files.readAllBytes(originalOutbox.toPath());
        assertTrue(initialOutbox.pending(peer)>0);
        registry.acknowledged(peer,before.hash);
        assertEquals(before.hash,registry.lastAck(peer));

        File primary=new File(home,"projects.json");
        byte[] exact=Files.readAllBytes(primary.toPath());
        assertTrue(primary.delete());
        try{LocalDatabase.readForCas(ctx);fail("Missing primary was allowed");}
        catch(IOException expected){}
        String recoveryEpoch=DatabaseRecovery.id(home);
        assertTrue(DeviceIdentity.valid(recoveryEpoch));
        assertEquals("",registry.lastAck(peer));
        assertEquals(recoveryEpoch,new JSONObject(new String(Files.readAllBytes(
            new File(noBackup,"sync-peers-v2.json").toPath()),StandardCharsets.UTF_8))
            .getString("localRecovery"));

        // Simulate the future EXPLICIT verified promotion. Do not implement it
        // or bypass the real missing-journal guard in production.
        Files.write(primary.toPath(),exact);
        DatabaseRecovery.healthy(home,false);
        PeerSnapshot recovered=PeerSnapshot.capture(ctx,prefs);
        assertNotEquals(before.hash,recovered.hash);
        assertEquals(recoveryEpoch,recovered.wire.getString("recoveryEpoch"));
        JSONObject oldWire=new JSONObject(recovered.wire.toString());
        oldWire.remove("recoveryEpoch");
        assertEquals("Without the epoch, the same snapshot would match the OLD ACK",
            before.hash,PeerWire.hash(CausalClock.canonical(oldWire).getBytes(StandardCharsets.UTF_8)));

        File journal=new File(home,"projects.recovery-v1.json");
        assertTrue(journal.isFile());
        assertTrue(journal.delete());
        File journalBak=new File(home,"projects.recovery-v1.json.bak");
        if(journalBak.exists())assertTrue(journalBak.delete());
        assertFalse(DatabaseRecovery.exists(home));
        // Fresh object approximates a process restart. Only no_backup remembers
        // the epoch, so no implicit new empty-epoch snapshot is legal.
        android.content.Context restarted=syntheticContext();
        try{LocalDatabase.readForCas(restarted);fail("R9: CAS accepted missing recovery epoch");}
        catch(IOException expected){}
        try{LocalDatabase.read(restarted);fail("R9: read accepted missing recovery epoch");}
        catch(IOException expected){}
        try{PeerSnapshot.capture(restarted,prefs);fail("R9: replayable old cloud hash emitted");}
        catch(IOException expected){}
        try{LocalDatabase.write(restarted,text("999,999999999"));
            fail("R9: missing recovery epoch permitted an overwrite");}
        catch(IOException expected){}
        PeerOutbox restartedOutbox=new PeerOutbox(restarted,prefs,new SyncPeerRegistry(noBackup));
        try{restartedOutbox.completed(peer,oldQueuedJob);
            fail("R9: stale metadata ACK accepted after recovery journal loss");}
        catch(IOException expected){}
        try{restartedOutbox.prepare(peer);
            fail("R9: old ACK may be re-acknowledged by new outbox");}
        catch(IOException expected){}
        assertTrue("Original queue was deleted on rejected ACK",restartedOutbox.pending(peer)>0);
        assertArrayEquals(originalTransfer,Files.readAllBytes(originalOutbox.toPath()));
        assertArrayEquals(exact,Files.readAllBytes(primary.toPath()));
        assertArrayEquals(photo,Files.readAllBytes(photoFile.toPath()));
        assertEquals("",new SyncPeerRegistry(noBackup).lastAck(peer));
        assertEquals(recoveryEpoch,new JSONObject(new String(Files.readAllBytes(
            new File(noBackup,"sync-peers-v2.json").toPath()),StandardCharsets.UTF_8))
            .getString("localRecovery"));
        assertFalse("Recovery journal must not be silently regenerated",
            DatabaseRecovery.exists(home));
    }

    @Test public void r9MismatchedRecoveryJournalIsRejectedWithoutMutatingOriginal()throws Exception{
        android.content.Context ctx=syntheticContext();
        String original=text("0,0000000000000007");
        LocalDatabase.write(ctx,original);
        File primary=new File(home,"projects.json");
        assertTrue(primary.delete());
        try{LocalDatabase.readForCas(ctx);fail("Missing primary allowed");}
        catch(IOException expected){}
        String epoch=DatabaseRecovery.id(home);
        assertTrue(DeviceIdentity.valid(epoch));
        Files.write(primary.toPath(),original.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(home,false);
        assertEquals(original,LocalDatabase.readForCas(ctx));
        // A different but syntactically valid epoch cannot silently supersede
        // the durable independent recovery witness in no_backup.
        String forged=java.util.UUID.randomUUID().toString();
        assertNotEquals(epoch,forged);
        File journal=new File(home,"projects.recovery-v1.json");
        File journalBak=new File(home,"projects.recovery-v1.json.bak");
        if(journalBak.exists())assertTrue(journalBak.delete());
        Files.write(journal.toPath(),new JSONObject()
            .put("version",1).put("epoch",forged).put("recovering",false)
            .toString().getBytes(StandardCharsets.UTF_8));
        byte[] journalBytes=Files.readAllBytes(journal.toPath());
        byte[] sourceBytes=Files.readAllBytes(primary.toPath());
        try{LocalDatabase.readForCas(ctx);fail("R9: mismatched journal epoch accepted");}
        catch(IOException expected){}
        try{LocalDatabase.read(ctx);fail("R9: mismatched journal allowed diagnostics as trusted");}
        catch(IOException expected){}
        assertArrayEquals(sourceBytes,Files.readAllBytes(primary.toPath()));
        assertArrayEquals(journalBytes,Files.readAllBytes(journal.toPath()));
        assertEquals(epoch,new JSONObject(new String(Files.readAllBytes(
            new File(noBackup,"sync-peers-v2.json").toPath()),StandardCharsets.UTF_8))
            .getString("localRecovery"));
    }

    /**
     * R10: while a previous same-epoch immutable snapshot is temporarily
     * inaccessible, its metadata and photo jobs must remain durable and
     * un-ACKable. Restoring the exact bytes and reopening the queue resumes
     * both peers without duplicate IDs, false ACKs or lost dimensions/media.
     */
    @Test public void r10TemporaryQueuedSnapshotReadErrorRecoversAfterRestartWithoutFalseAck()throws Exception{
        android.content.Context ctx=syntheticContext();
        android.content.SharedPreferences prefs=ctx.getSharedPreferences(
            "r10-transient-"+home.getName(),android.content.Context.MODE_PRIVATE);
        String firstPeer=java.util.UUID.randomUUID().toString();
        String secondPeer=java.util.UUID.randomUUID().toString();
        SyncPeerRegistry registry=new SyncPeerRegistry(noBackup);
        registry.approve(firstPeer,
            "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","R10 TLS");
        registry.approve(secondPeer,
            "bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb","R10 cloud");

        String empty="{\"schema\":1,\"records\":[]}";
        LocalDatabase.write(ctx,empty);
        File primary=new File(home,"projects.json");
        assertTrue(primary.delete());
        try{LocalDatabase.readForCas(ctx);fail("Loss did not start recovery");}
        catch(IOException expected){}
        String epoch=DatabaseRecovery.id(home);
        assertTrue(DeviceIdentity.valid(epoch));
        assertEquals(epoch,new JSONObject(new String(
            Files.readAllBytes(new File(noBackup,"sync-peers-v2.json").toPath()),
            StandardCharsets.UTF_8)).getString("localRecovery"));
        Files.write(primary.toPath(),empty.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(home,false); // test-only explicit promotion stand-in

        File mediaDir=new File(home,"media");assertTrue(mediaDir.mkdirs());
        byte[] photo=new byte[]{1,3,5,8,13,21,34,55,89};
        File originalPhoto=new File(mediaDir,"r10-photo");
        Files.write(originalPhoto.toPath(),photo);
        String oldMeasure="1585,800001234567890",newMeasure="1585,800001234567891";
        JSONObject record=new JSONObject().put("id","r10-project")
            .put("media",new org.json.JSONArray().put("r10-photo"))
            .put("items",new org.json.JSONArray().put(
                new JSONObject().put("measure",oldMeasure)
                    .put("laserMeasuredMm","1585.800001234567890")));
        JSONObject oldData=new JSONObject().put("schema",1)
            .put("records",new org.json.JSONArray().put(record));
        LocalDatabase.write(ctx,oldData.toString());
        PeerOutbox prepared=new PeerOutbox(ctx,prefs,registry);
        PeerSnapshot older=prepared.prepare(firstPeer);
        assertEquals(epoch,older.wire.getString("recoveryEpoch"));
        assertEquals(older.hash,prepared.prepare(secondPeer).hash);
        JSONObject originalMetadata=prepared.messages(firstPeer).get(0);
        String source=originalMetadata.getString("sourceRef");
        assertEquals(older.hash,source);
        File immutable=new File(noBackup,"sync-v2-outbox/"+source+".json");
        byte[] immutableBytes=Files.readAllBytes(immutable.toPath());
        assertArrayEquals(older.bytes,immutableBytes);
        JSONObject newerData=new JSONObject(oldData.toString());
        newerData.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).put("measure",newMeasure);
        LocalDatabase.write(ctx,newerData.toString());

        // Deterministic, exactly one attempt with queuedSnapshot's original
        // read path unavailable. The immutable bytes are merely parked; no
        // data is modified or deleted, and restoration simulates I/O recovery.
        File parked=new File(immutable.getParentFile(),source+".temporarily-unreadable");
        assertTrue(immutable.renameTo(parked));
        String newHash;
        try{
            PeerSnapshot newer=prepared.prepare(firstPeer);
            newHash=newer.hash;
            assertNotEquals(older.hash,newHash);
            assertEquals(epoch,newer.wire.getString("recoveryEpoch"));
            assertEquals(newHash,prepared.prepare(secondPeer).hash);
            assertEquals(0,prepared.quarantinedCount(firstPeer));
            assertEquals(0,prepared.quarantinedCount(secondPeer));
            assertEquals(6,prepared.pending(firstPeer)); // two project metadata/photo pairs plus the history metadata/photo pair
            assertEquals(6,prepared.pending(secondPeer));
            // Unknown old bytes cannot be used by either sender or its ACK.
            java.util.List<JSONObject> safe=prepared.messages(firstPeer);
            assertEquals(2,safe.size());assertTrue(prepared.load(safe.get(1)).wire.getBoolean("recoveryOnly"));
            assertEquals(newHash,safe.get(0).getString("hash"));
            try{prepared.completed(firstPeer,originalMetadata);
                fail("Unverifiable historical queued metadata was ACKed");}
            catch(IOException expected){}
            assertEquals("",registry.lastAck(firstPeer));
            assertEquals("",registry.lastAck(secondPeer));
            assertArrayEquals(immutableBytes,Files.readAllBytes(parked.toPath()));
            assertArrayEquals(photo,Files.readAllBytes(originalPhoto.toPath()));
        }finally{
            assertTrue("Original immutable source must be restorable",parked.renameTo(immutable));
        }

        PeerOutbox reopened=new PeerOutbox(syntheticContext(),prefs,new SyncPeerRegistry(noBackup));
        assertEquals(newHash,reopened.prepare(firstPeer).hash);
        assertEquals(newHash,reopened.prepare(secondPeer).hash);
        assertEquals(0,reopened.quarantinedCount(firstPeer));
        assertEquals(0,reopened.quarantinedCount(secondPeer));
        assertArrayEquals(immutableBytes,Files.readAllBytes(immutable.toPath()));
        assertEquals(oldMeasure,older.data.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals(newMeasure,new JSONObject(LocalDatabase.readForCas(ctx))
            .getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertArrayEquals(photo,Files.readAllBytes(originalPhoto.toPath()));

        // Both sender paths use this same persisted outbox. Verify every
        // metadata/blob job and its ID before actual protected ACK/cleanup.
        JSONObject persisted=new JSONObject(reopened.queue.read());
        org.json.JSONArray jobs=persisted.getJSONArray("jobs");
        java.util.Set<String> ids=new java.util.HashSet<>();
        for(int i=0;i<jobs.length();i++)
            assertTrue("Duplicate active job ID",ids.add(jobs.getJSONObject(i).getString("id")));
        assertEquals(12,ids.size());
        for(String peer:new String[]{firstPeer,secondPeer}){
            java.util.List<JSONObject> metadata=reopened.messages(peer);
            assertEquals(3,metadata.size());assertTrue(reopened.load(metadata.get(2)).wire.getBoolean("recoveryOnly"));
            assertEquals(older.hash,metadata.get(0).getString("hash"));
            assertEquals(newHash,metadata.get(1).getString("hash"));
            org.json.JSONArray active=new JSONObject(reopened.queue.read()).getJSONArray("jobs");
            int confirmedPhotos=0;
            for(int i=0;i<active.length();i++){
                JSONObject job=active.getJSONObject(i);
                if(!peer.equals(job.getString("peer"))||!"blob".equals(job.getString("kind")))continue;
                assertTrue(reopened.acknowledge(job.getString("id"),job.getString("hash"),
                    job.getLong("size"),false));
                confirmedPhotos++;
            }
            assertEquals(3,confirmedPhotos);
            for(JSONObject job:metadata)reopened.completed(peer,job);
            assertEquals(newHash,registry.lastAck(peer));
            assertEquals(0,reopened.pending(peer));
            assertEquals(0,reopened.quarantinedCount(peer));
            assertArrayEquals(photo,Files.readAllBytes(originalPhoto.toPath()));
            assertEquals(newMeasure,new JSONObject(LocalDatabase.readForCas(ctx))
                .getJSONArray("records").getJSONObject(0)
                .getJSONArray("items").getJSONObject(0).getString("measure"));
        }
        assertEquals(epoch,DatabaseRecovery.id(home));
        assertEquals(0,reopened.pending(firstPeer));
        assertEquals(0,reopened.pending(secondPeer));
    }
}
