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
}
