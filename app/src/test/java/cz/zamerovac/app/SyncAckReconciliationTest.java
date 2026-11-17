package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;
import static org.junit.Assert.*;

/** Additional end-to-end RED diagnostics. A preserved source is not a repaired ACK contract. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncAckReconciliationTest {
    SafSyncV2Test f;
    @Before public void setup()throws Exception { f=new SafSyncV2Test();f.setup(); }
    private void restartBoth()throws Exception {
        File root=f.a.home.getParentFile().getParentFile();
        f.a=new PeerTransferTest.Device(root,"a");f.b=new PeerTransferTest.Device(root,"b");
        f.ar=new SyncPeerRegistry(f.a.noBackup);f.br=new SyncPeerRegistry(f.b.noBackup);
        // Reload the same synthetic persisted key material, not a newly paired identity.
        f.ai=PeerTlsTest.material("a");f.bi=PeerTlsTest.material("b");
        assertEquals(f.aid,DeviceIdentity.get(f.a.noBackup));assertEquals(f.bid,DeviceIdentity.get(f.b.noBackup));
    }
    private JSONObject record(JSONObject db)throws Exception { return db.getJSONArray("records").getJSONObject(0); }
    private JSONObject dimension(JSONObject db)throws Exception { return record(db).getJSONArray("items").getJSONObject(0); }
    private void tls()throws Exception {
        PeerDataStore source=new PeerDataStore(f.a,f.a.prefs,f.ar,null),receiver=new PeerDataStore(f.b,f.b.prefs,f.br,null);
        new PeerTlsTest().sockets(f.bi.context(f.br,()->false),f.ai.context(f.ar,()->false),socket->{
            PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,f.bid,"B",f.bi,f.br,()->false,request->false);
            new PeerTransfer(receiver,null).exchange(socket,peer,false);
        },socket->{
            PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,f.aid,"A",f.ai,f.ar,()->false,request->false);
            new PeerTransfer(source,null).exchange(socket,peer,true);
        });
    }
    private void lateAckRestartAndRecovery(boolean staged)throws Exception {
        f.canonicalFiles(3,4000);
        for(int i=0;i<3;i++)assertTrue(f.a.prefs.edit().putString("mime-original-"+i,new String[]{"image/jpeg","video/mp4","audio/mp4"}[i]).commit());
        dimension(f.original).put("points",new JSONArray().put(new JSONObject().put("x",12.125).put("y",23.875)))
            .put("laserMeasuredMm","1585.800001234567890");
        record(f.original).put("history",new JSONArray().put(new JSONObject().put("measure","1250,000000000123456789").put("unit","in")));
        LocalDatabase.write(f.a,f.original.toString());
        PendingAudio audio=new PendingAudio(new File(f.a.home,"media"),f.a.prefs);
        JSONObject voice=audio.begin("voice-detached");byte[] voiceBytes={1,9,8,5,80,0,1};
        Files.write(audio.temporary(voice).toPath(),voiceBytes);audio.complete(voice);audio.abandon(voice);
        String exactSource=LocalDatabase.readForCas(f.a);byte[][] originals=new byte[3][];
        for(int i=0;i<3;i++)originals[i]=Files.readAllBytes(new File(f.a.home,"media/original-"+i).toPath());
        PeerSnapshot snapshot=PeerSnapshot.capture(f.a,f.a.prefs);
        f.sync(f.a,f.ai,false).sync();JSONObject job=new PeerOutbox(f.a,f.a.prefs,f.ar).messages(f.bid).get(0);
        SafSyncV2Test.LateAckProviderStore fault=new SafSyncV2Test.LateAckProviderStore(f.store.root,f.b,staged);
        try { f.engine(f.b,f.bi,fault,false).sync(); } catch(IOException blocked) {}
        assertTrue("Fault must run inside the actual provider operation",fault.injected);
        assertTrue(DatabaseRecovery.pending(f.b.home));String epoch=DatabaseRecovery.id(f.b.home);
        assertArrayEquals(new byte[]{0},Files.readAllBytes(new File(f.b.home,"projects.json").toPath()));
        String directory="sync/v2/acks/"+f.aid+"/"+f.bid;JSONObject late=null;
        for(ImmutableStore.Entry entry:f.store.list(directory)) {
            JSONObject candidate=CloudProof.read(f.store.open(directory+"/"+entry.name),PeerWire.MAX_HELLO);
            JSONObject body=CloudProof.verify(candidate,f.bi.certificate(),CloudProof.ACK,f.bid,f.aid);
            if(snapshot.hash.equals(body.getString("hash")))late=candidate;
        }
        // Publication may eventually be prevented by a cooperating provider. Keep testing restart/retry either way.
        if(late!=null)for(int i=0;i<2;i++)CloudFiles.publish(f.store,directory,snapshot.hash,late);
        restartBoth();
        try { f.sync(f.b,f.bi,false).sync();fail("Restart bypassed pending receiver recovery"); } catch(IOException blocked) {}
        assertEquals(epoch,DatabaseRecovery.id(f.b.home));
        f.sync(f.a,f.ai,false).sync();
        PeerOutbox sender=new PeerOutbox(f.a,f.a.prefs,f.ar);
        boolean falselyRetired=sender.pendingProjects(f.bid)==0&&snapshot.hash.equals(f.ar.lastAck(f.bid));
        if(falselyRetired) {
            try { sender.completed(f.bid,job);fail("Duplicate completion accepted without a queued job"); } catch(IOException rejected) {}
        }
        assertEquals(exactSource,LocalDatabase.readForCas(f.a));
        assertTrue(new ProtectedRevisions(f.a,f.a.prefs).hasSnapshot(snapshot.hash));
        for(int i=0;i<3;i++) {
            assertArrayEquals(originals[i],Files.readAllBytes(new File(f.a.home,"media/original-"+i).toPath()));
            assertArrayEquals(originals[i],Files.readAllBytes(new File(f.b.home,"media/original-"+i).toPath()));
        }
        assertArrayEquals(voiceBytes,Files.readAllBytes(new File(f.a.home,"media/voice-detached").toPath()));
        // A verified recovery signal invalidates old receipts durably, including after another object restart.
        f.ar.recovered(f.bid,epoch);restartBoth();assertFalse(f.ar.cloudAckAllowed(f.bid));assertEquals("",f.ar.lastAck(f.bid));
        JSONObject newerSource=new JSONObject(exactSource);dimension(newerSource).put("measure","999,000000000000001");
        record(newerSource).put("syncClock",new JSONObject().put(f.aid,2));LocalDatabase.write(f.a,newerSource.toString());
        assertTrue(f.sync(f.a,f.ai,false).sync().pending);assertTrue(new PeerOutbox(f.a,f.a.prefs,f.ar).pendingProjects(f.bid)>0);
        // Only model the already-authorized restore boundary; there is no production automatic restore API.
        Files.write(new File(f.b.home,"projects.json").toPath(),exactSource.getBytes(StandardCharsets.UTF_8));
        DatabaseRecovery.healthy(f.b.home,false);assertEquals(exactSource,LocalDatabase.readForCas(f.b));
        JSONObject newerReceiver=new JSONObject(exactSource);dimension(newerReceiver).put("measure","888,000000000000001");
        record(newerReceiver).put("syncClock",new JSONObject().put(f.aid,3).put(f.bid,1));LocalDatabase.write(f.b,newerReceiver.toString());
        // Real TLS retry into a newer durable receiver must reconcile, never roll it back to either older revision.
        for(int i=0;i<3;i++)tls();
        for(PeerTransferTest.Device device:new PeerTransferTest.Device[]{f.a,f.b}) {
            JSONObject actual=new JSONObject(LocalDatabase.readForCas(device));
            assertEquals("888,000000000000001",dimension(actual).getString("measure"));assertEquals("mm",dimension(actual).getString("unit"));
            assertEquals("1585.800001234567890",dimension(actual).getString("laserMeasuredMm"));
            assertEquals("[{\"x\":12.125,\"y\":23.875}]",dimension(actual).getJSONArray("points").toString());
            assertEquals("1250,000000000123456789",record(actual).getJSONArray("history").getJSONObject(0).getString("measure"));
            for(int i=0;i<3;i++)assertArrayEquals(originals[i],Files.readAllBytes(new File(device.home,"media/original-"+i).toPath()));
            assertArrayEquals(voiceBytes,Files.readAllBytes(new File(device.home,"media/voice-detached").toPath()));
        }
        assertTrue(new ProtectedRevisions(f.a,f.a.prefs).hasSnapshot(snapshot.hash));
        assertFalse("TLS does not silently clear the durable historical cloud-ACK barrier",new SyncPeerRegistry(f.a.noBackup).cloudAckAllowed(f.bid));
        System.out.println("ACK_COUNTEREXAMPLE staged="+staged+" late="+(late!=null)+" falselyRetired="+falselyRetired+
            " restartBoth=verified simulatedRestore=true newerRevision=preserved photoVideoAudio=exact realTlsRetry=verified");
        // This final safety assertion deliberately remains RED until the end-to-end contract is actually repaired.
        assertFalse("Historical cloud ACK retired the working intent while receiver authority was lost",falselyRetired);
    }
    @Test public void driveLateDuplicateAckRestartBothAndRetryMustNotFalselyFinish()throws Exception { lateAckRestartAndRecovery(true); }
    @Test public void safLateDuplicateAckRestartBothAndRetryMustNotFalselyFinish()throws Exception { lateAckRestartAndRecovery(false); }
}
