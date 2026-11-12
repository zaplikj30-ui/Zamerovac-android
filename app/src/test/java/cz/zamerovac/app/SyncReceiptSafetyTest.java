package cz.zamerovac.app;

import android.database.sqlite.SQLiteDatabase;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.FileTime;
import java.util.*;
import static org.junit.Assert.*;

/** Product acceptance: durable obligations, real SQL rollback, actual verified bytes and authenticated inventory semantics. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncReceiptSafetyTest {
    PeerTransferTest f;PeerOutbox outbox;PeerSnapshot source;JSONObject job;byte[] original;String exact;
    @Before public void setup()throws Exception { seed(); }
    void seed()throws Exception {
        f=new PeerTransferTest();f.setup();JSONObject record=f.record("precise",f.aid,"1585,800001234567890");
        f.media(f.a,record,1);f.save(f.a,f.db(record));f.save(f.b,f.db());
        exact=LocalDatabase.readForCas(f.a);original=Files.readAllBytes(new File(f.a.home,"media/media-0").toPath());
        outbox=f.as.outbox;outbox.destination("saf","content://synthetic/tree/one");source=outbox.prepare(f.bid);job=outbox.messages(f.bid).get(0);
    }
    String target()throws Exception { return job.getString("target"); }
    String state()throws Exception { try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){return ledger.state(target(),source.hash);} }
    void quiet()throws Exception { outbox.completed(f.bid,job);assertEquals("transport-receipt",state()); }
    void exactSource()throws Exception {
        assertArrayEquals(source.bytes,outbox.retainedSource(target(),source.hash).bytes);
        assertArrayEquals(original,Files.readAllBytes(new File(f.a.home,"media/media-0").toPath()));
        assertTrue(new ProtectedRevisions(f.a,f.a.prefs).hasSnapshot(source.hash));
    }
    PeerHandshake.Peer peer(boolean capable)throws Exception { return new PeerHandshake.Peer(f.bid,"B",f.tls.b.fingerprint(),true,capable); }
    PeerSnapshot receiver(String value,int clock)throws Exception {
        JSONObject data=new JSONObject(exact);JSONObject record=data.getJSONArray("records").getJSONObject(0);
        record.put("syncClock",new JSONObject().put(f.aid,clock));record.getJSONArray("items").getJSONObject(0).put("measure",value);
        new File(f.b.home,"media").mkdirs();Files.write(new File(f.b.home,"media/media-0").toPath(),original);f.save(f.b,data);
        return PeerSnapshot.capture(f.b,f.b.prefs);
    }
    @Test public void quietReceiptRestartAndDuplicateKeepExactPerTargetSourceAndUnknownHealth()throws Exception {
        quiet();String queue=outbox.queue.read();assertTrue(outbox.pendingProjects(f.bid)>0);assertEquals(0,outbox.activeProjects(f.bid));
        outbox=new PeerOutbox(f.a,f.a.prefs,new SyncPeerRegistry(f.a.noBackup));outbox.destination("saf","content://synthetic/tree/one");
        outbox.completed(f.bid,job);assertEquals(queue,outbox.queue.read());exactSource();
        try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){
            JSONObject d=ledger.descriptor(target(),source.hash);assertEquals(source.hash,d.getString("sourceRef"));assertEquals(f.bid,d.getJSONObject("binding").getString("peer"));
            JSONArray rows=ledger.status(exact,"").getJSONArray("targets");for(int i=0;i<rows.length();i++)assertEquals("UNKNOWN",rows.getJSONObject(i).getString("receiverState"));
        }
    }
    @Test public void everyReceiptTransactionFaultRollsBackQuietingAndSurvivesReopen()throws Exception {
        for(String point:new String[]{"before-queue-write","after-queue-write","before-receipt-write","after-receipt-write","before-receipt-commit"}){
            seed();String before=outbox.queue.read();JSONObject next=new JSONObject(before).put("revision",new JSONObject(before).getLong("revision")+1).put("jobs",new JSONArray());
            try(SyncLedger ledger=SyncLedger.open(f.a.noBackup,at->{if(at.equals(point))throw new IOException("synthetic power-cut/ENOSPC "+point);})){
                JSONObject binding=ledger.descriptor(target(),source.hash).getJSONObject("binding");
                try { ledger.saveQueue(new JSONObject(before).getLong("revision"),next.toString(),l->l.receipt(target(),source,binding,job.getString("id")));fail(point); }
                catch(IOException expected) { assertTrue(expected.getMessage().contains(point)); }
            }
            assertEquals(before,new SyncQueueStore(f.a.noBackup).read());assertEquals("waiting",state());exactSource();quiet();exactSource();
        }
    }
    @Test public void actualSqlDiskFullCannotQuietTheActiveIntent()throws Exception {
        String before=outbox.queue.read();LedgerTestFault.block(f.a.noBackup);
        try { outbox.completed(f.bid,job);fail("Failed SQL commit retired jobs"); } catch(Exception expected) {}
        finally { LedgerTestFault.unblock(f.a.noBackup); }
        assertEquals(before,outbox.queue.read());assertEquals("waiting",state());exactSource();quiet();
    }
    @Test public void corruptedSourceCannotBeOverwrittenOrAcknowledged()throws Exception {
        File file=new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json");byte[] bad={0,8,8};Files.write(file.toPath(),bad);String before=outbox.queue.read();
        try { outbox.completed(f.bid,job);fail("Corrupted source accepted"); } catch(Exception expected) {}
        assertEquals(before,outbox.queue.read());assertArrayEquals(bad,Files.readAllBytes(file.toPath()));assertEquals("waiting",state());
        try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){assertArrayEquals(source.bytes,ledger.revision(source.hash,f.aid).bytes);}
    }
    @Test public void corruptedSqlSourceAndManifestNeverBecomeReceiptEvidence()throws Exception {
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(f.a.noBackup,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
            db.execSQL("UPDATE revision_media SET hash=? WHERE revision=?",new Object[]{"0".repeat(64),source.hash});
        }
        String before=outbox.queue.read();try { outbox.completed(f.bid,job);fail("Corrupted SQL manifest accepted"); } catch(Exception expected) {}
        assertEquals(before,outbox.queue.read());assertEquals("waiting",state());assertArrayEquals(source.bytes,Files.readAllBytes(new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json").toPath()));
    }
    @Test public void accountAndSafUriChangesCannotConsumeAnOldTargetAck()throws Exception {
        for(String kind:new String[]{"drive","saf"}){
            seed();outbox.destination(kind,"account-or-uri-one");source=outbox.prepare(f.bid);job=outbox.messages(f.bid).get(0);String before=outbox.queue.read();
            outbox.destination(kind,"account-or-uri-two");outbox.prepare(f.bid);String prepared=outbox.queue.read();
            try { outbox.completed(f.bid,job);fail("Old target completed new namespace"); } catch(IOException expected) {}
            assertEquals(prepared,outbox.queue.read());assertEquals(before,prepared);
            assertNotEquals(job.getString("target"),outbox.messages(f.bid).get(0).getString("target"));assertEquals("waiting",state());exactSource();
        }
    }
    @Test public void changedPairingOrRecoveryEpochCannotCompleteTheOriginalJob()throws Exception {
        for(boolean rePair:new boolean[]{true,false}){
            seed();String before=outbox.queue.read();if(rePair){f.ar.forget(f.bid);f.ar.approve(f.bid,f.tls.rogue.fingerprint(),"Replacement");}
            else f.ar.recovered(f.bid,UUID.randomUUID().toString());
            try { outbox.completed(f.bid,job);fail("Changed receiver identity consumed old ACK"); } catch(IOException expected) {}
            assertEquals(before,outbox.queue.read());assertEquals("waiting",state());exactSource();
        }
    }
    @Test public void localAuthorityLossCannotRetireTheIntentAfterRestart()throws Exception {
        String before=outbox.queue.read();Files.write(new File(f.a.home,"projects.json").toPath(),new byte[]{0});
        outbox=new PeerOutbox(f.a,f.a.prefs,new SyncPeerRegistry(f.a.noBackup));outbox.destination("saf","content://synthetic/tree/one");
        try { outbox.completed(f.bid,job);fail("Lost authority consumed receipt"); } catch(IOException expected) {}
        assertTrue(DatabaseRecovery.pending(f.a.home));assertEquals(before,outbox.queue.read());assertEquals("waiting",state());
        assertArrayEquals(source.bytes,outbox.retainedSource(target(),source.hash).bytes);
    }
    @Test public void actualNewerInventoryVerifiesCoverageWithoutRollingBackAndStillReportsUnknownNow()throws Exception {
        quiet();PeerSnapshot observed=receiver("999,000000000000001",3);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(true));
        outbox.reconcile(peer(true),List.of(proof),"");assertEquals("verified-checkpoint",state());
        assertEquals("999,000000000000001",new JSONObject(LocalDatabase.readForCas(f.a)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
        exactSource();assertEquals(0,outbox.pendingProjects(f.bid));
        try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){assertEquals("UNKNOWN",ledger.status(LocalDatabase.readForCas(f.a),"").getJSONArray("targets").getJSONObject(0).getString("receiverState"));}
    }
    @Test public void legacyReceiptCannotBePromotedToAnInventoryCheckpoint()throws Exception {
        quiet();PeerSnapshot observed=receiver("1585,800001234567890",1);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(false));
        try { outbox.reconcile(peer(false),List.of(proof),"");fail("Legacy ACK became verified current inventory"); } catch(IOException expected) {}
        assertEquals("transport-receipt",state());exactSource();
    }
    @Test public void missingOrChangedMediaCannotProduceOrReuseVerifiedInventory()throws Exception {
        quiet();PeerSnapshot observed=receiver("1585,800001234567890",1);File media=new File(f.a.home,"media/media-0");Files.delete(media.toPath());
        try { f.as.applyInventory(observed,peer(true));fail("Missing bytes verified from manifest"); } catch(IOException expected) {}
        Files.write(media.toPath(),original);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(true));FileTime time=Files.getLastModifiedTime(media.toPath());byte[] changed=original.clone();changed[0]^=1;Files.write(media.toPath(),changed);Files.setLastModifiedTime(media.toPath(),time);
        try { outbox.reconcile(peer(true),List.of(proof),"");fail("Restored mtime hid changed bytes"); } catch(IOException expected) {}
        assertEquals("transport-receipt",state());assertArrayEquals(original,Files.readAllBytes(new File(f.b.home,"media/media-0").toPath()));
    }
    @Test public void incomparableCausalRevisionDoesNotVerifyTheReceipt()throws Exception {
        quiet();JSONObject data=new JSONObject(exact);data.getJSONArray("records").getJSONObject(0).put("syncClock",new JSONObject().put(f.bid,1)).getJSONArray("items").getJSONObject(0).put("measure","777,000000000000001");
        new File(f.b.home,"media").mkdirs();Files.write(new File(f.b.home,"media/media-0").toPath(),original);f.save(f.b,data);PeerSnapshot observed=PeerSnapshot.capture(f.b,f.b.prefs);
        outbox.reconcile(peer(true),List.of(f.as.applyInventory(observed,peer(true))),"");assertEquals("transport-receipt",state());
        String saved=LocalDatabase.readForCas(f.a);assertTrue(saved.contains("1585,800001234567890"));assertTrue(saved.contains("777,000000000000001"));exactSource();
    }
    @Test public void corruptedTargetIdentityIsRejectedBeforeUsingItsReceipt()throws Exception {
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(f.a.noBackup,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
            db.execSQL("UPDATE targets SET scope='wrong' WHERE id=?",new Object[]{target()});
        }
        String before=outbox.queue.read();try { outbox.completed(f.bid,job);fail("Corrupted target used for receipt"); } catch(IOException expected) {}
        assertEquals(before,outbox.queue.read());assertArrayEquals(original,Files.readAllBytes(new File(f.a.home,"media/media-0").toPath()));
    }
    @Test public void cachedCurrentSnapshotCannotAdvertiseOldJsonAfterValidExternalReplacement()throws Exception {
        outbox.prepare(f.bid);outbox.prepare(f.bid); // Warm past initial P1 adoption; the immutable content inventory is now stable.
        long generation=LocalDatabase.generation(f.a.home);JSONObject newer=new JSONObject(exact);newer.getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).put("measure","444,000000000000001");
        Files.write(new File(f.a.home,"projects.json").toPath(),newer.toString().getBytes(StandardCharsets.UTF_8));assertEquals(generation,LocalDatabase.generation(f.a.home));
        assertEquals("444,000000000000001",outbox.prepare(f.bid).data.getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));
    }
    @Test public void registryFailureAfterSqlCommitCannotStrandHistoryOrLoseTheIntent()throws Exception {
        File blocker=new File(f.a.noBackup,"sync-peers-v2.json.new");assertTrue(blocker.mkdir());File child=new File(blocker,"fault");Files.write(child.toPath(),new byte[]{1});
        try { outbox.completed(f.bid,job);fail("Synthetic post-commit registry fault not reached"); } catch(IOException expected) {}
        assertTrue(child.delete());assertTrue(blocker.delete());
        outbox=new PeerOutbox(f.a,f.a.prefs,new SyncPeerRegistry(f.a.noBackup));outbox.destination("saf","content://synthetic/tree/one");
        assertEquals("transport-receipt",state());assertEquals(0,outbox.activeProjects(f.bid));assertEquals("",new SyncPeerRegistry(f.a.noBackup).lastAck(f.bid));
        assertTrue("History progress must use the durable per-target receipt, not a lost global timestamp",outbox.workingReceipt(f.bid));exactSource();
    }
    @Test public void verifiedInventoryCannotBeMutatedIntoDifferentCausalCoverage()throws Exception {
        quiet();PeerSnapshot observed=receiver("1585,800001234567890",1);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(true));
        proof.snapshot.data.getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).put("measure","forged-after-verification");
        try { outbox.reconcile(peer(true),List.of(proof),"");fail("Mutable manifest became checkpoint evidence"); } catch(IOException expected) {}
        assertEquals("transport-receipt",state());exactSource();
    }
    @Test public void wrongEpochCannotReuseAnOtherwiseVerifiedInventory()throws Exception {
        quiet();PeerSnapshot observed=receiver("1585,800001234567890",1);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(true));
        try { outbox.reconcile(peer(true),List.of(proof),UUID.randomUUID().toString());fail("Old inventory was relabelled with a fresh epoch"); } catch(IOException expected) {}
        assertEquals("transport-receipt",state());exactSource();
    }
    @Test public void restoringOlderWorkingBytesDoesNotRearmTheOldLocalEpoch()throws Exception {
        Files.write(new File(f.a.home,"projects.json").toPath(),new byte[]{0});try { LocalDatabase.readForCas(f.a);fail(); } catch(IOException expected) {}
        String epoch=DatabaseRecovery.id(f.a.home);assertFalse(epoch.isEmpty());
        // Explicit test-only restore boundary, never a production automatic recovery path.
        Files.write(new File(f.a.home,"projects.json").toPath(),exact.getBytes(StandardCharsets.UTF_8));DatabaseRecovery.healthy(f.a.home,false);
        PeerSnapshot fresh=outbox.prepare(f.bid);assertNotEquals(source.hash,fresh.hash);assertEquals(epoch,fresh.wire.getString("recoveryEpoch"));
        String before=outbox.queue.read();try { outbox.completed(f.bid,job);fail("Old local epoch ACK consumed restored work"); } catch(IOException expected) {}
        assertEquals(before,outbox.queue.read());assertTrue(outbox.quarantinedCount(f.bid)>0);exactSource();
    }
    @Test public void orphanedSqlDeliveryCannotPassQuickCheckOrRecreateLostEvidenceSilently()throws Exception {
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(f.a.noBackup,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
            db.execSQL("PRAGMA foreign_keys=OFF");db.execSQL("DELETE FROM revisions WHERE hash=?",new Object[]{source.hash});
        }
        try(SyncLedger ignored=SyncLedger.open(f.a.noBackup)){fail("SQLite quick_check accepted a delivery whose source row was lost");}catch(IOException expected){}
        assertArrayEquals(source.bytes,Files.readAllBytes(new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json").toPath()));
    }
    @Test public void knownReceiverEpochCannotBeVerifiedByAnOlderAuthenticatedInventory()throws Exception {
        quiet();f.ar.recovered(f.bid,UUID.randomUUID().toString());source=outbox.prepare(f.bid);job=outbox.messages(f.bid).get(0);quiet();
        PeerSnapshot observed=receiver("1585,800001234567890",1);PeerDataStore.VerifiedInventory proof=f.as.applyInventory(observed,peer(true));
        try { outbox.reconcile(peer(true),List.of(proof),"");fail("An old receiver epoch verified the new target binding"); } catch(IOException expected) {}
        assertEquals("transport-receipt",state());exactSource();
    }
    @Test public void corruptedSqlSnapshotBytesCannotBeReplacedSilentlyDuringReceipt()throws Exception {
        try(SQLiteDatabase db=SQLiteDatabase.openDatabase(new File(f.a.noBackup,"sync-ledger-v1.sqlite").getPath(),null,SQLiteDatabase.OPEN_READWRITE)){
            db.execSQL("UPDATE revisions SET bytes=? WHERE hash=?",new Object[]{new byte[]{0},source.hash});
        }
        String before=outbox.queue.read();try { outbox.completed(f.bid,job);fail("Corrupt SQL bytes replaced with an unproved receipt"); } catch(IOException expected) {}
        assertEquals(before,outbox.queue.read());assertArrayEquals(source.bytes,Files.readAllBytes(new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json").toPath()));
    }
    @Test public void liveInventoryCannotReuseTheQuietMetadataCacheAsProofOfCurrentMedia()throws Exception {
        quiet();outbox.prepare(f.bid);outbox.prepare(f.bid);File media=new File(f.a.home,"media/media-0");FileTime time=Files.getLastModifiedTime(media.toPath());
        byte[] bad=original.clone();bad[0]^=1;Files.write(media.toPath(),bad);Files.setLastModifiedTime(media.toPath(),time);
        try { outbox.prepareInventory(f.bid);fail("A cached media hash was advertised as a fresh inventory"); } catch(IOException expected) {}
        assertArrayEquals(bad,Files.readAllBytes(media.toPath()));assertEquals("transport-receipt",state());
    }
    @Test public void aMissingNewReceiptSourceCannotBeSilentlyReplacedByItsSqlEvidence()throws Exception {
        quiet();File file=new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json");assertTrue(file.delete());
        try { outbox.retainedSource(target(),source.hash);fail("New missing source acquired fallback authority"); } catch(IOException expected) {}
        try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){assertArrayEquals(source.bytes,ledger.revision(source.hash,f.aid).bytes);}
        assertFalse(file.exists());assertEquals(exact,LocalDatabase.readForCas(f.a));assertTrue(new ProtectedRevisions(f.a,f.a.prefs).hasSnapshot(source.hash));
    }
    @Test public void onlyVerifiedLegacyQuietReceiptsCanReadSqlSourceAndNeverConsumeSidecars()throws Exception {
        quiet();try(SyncLedger ledger=SyncLedger.open(f.a.noBackup)){ledger.state(target(),source.hash,"transport-ack","old version receipt");}
        File file=new File(f.a.noBackup,"sync-v2-outbox/"+source.hash+".json");assertTrue(file.delete());File sidecar=new File(file+".new");byte[] evidence={8,8,0};Files.write(sidecar.toPath(),evidence);
        try { outbox.retainedSource(target(),source.hash);fail("Ambiguous legacy sidecar bypassed source verification"); } catch(IOException expected) {}
        assertArrayEquals(evidence,Files.readAllBytes(sidecar.toPath()));assertTrue(sidecar.delete());
        String before=outbox.queue.read();assertArrayEquals(source.bytes,outbox.retainedSource(target(),source.hash).bytes);assertEquals(before,outbox.queue.read());assertFalse(file.exists());
    }
}
