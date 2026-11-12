package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import static org.junit.Assert.*;

/** Simulated negotiated legacy capability over real TLS; this is not an old installed APK. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerLegacyCompatibilityTest {
    private PeerHandshake.Peer legacy(PeerHandshake.Peer peer){return new PeerHandshake.Peer(peer.id,peer.name,peer.fingerprint,false);}
    @Test public void legacyCapabilityTransfersCurrentV2AndKeepsUnsupportedHistoryPending()throws Exception{
        PeerTransferTest f=new PeerTransferTest();f.setup();JSONObject old=f.record("photo",f.aid,"100,000001");f.media(f.a,old,1);f.save(f.a,f.db(old));JSONObject current=new JSONObject(old.toString()).put("syncClock",new JSONObject().put(f.aid,2));current.getJSONArray("items").getJSONObject(0).put("measure","200,000002");f.save(f.a,f.db(current));
        // The first exchange may queue the reconciled current snapshot; a reconnect confirms it.
        for(int round=0;round<2;round++)f.tls.sockets(f.tls.b.context(f.br,()->false),f.tls.a.context(f.ar,()->false),socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,f.bid,"Simulated old tablet",f.tls.b,f.br,()->false,request->false);new PeerTransfer(f.bs,null).exchange(socket,legacy(peer),false);},socket->{PeerHandshake.Peer peer=PeerHandshake.negotiate(socket,f.aid,"Phone",f.tls.a,f.ar,()->false,request->false);new PeerTransfer(f.as,null).exchange(socket,legacy(peer),true);});
        assertEquals("200,000002",new JSONObject(LocalDatabase.readForCas(f.b)).getJSONArray("records").getJSONObject(0).getJSONArray("items").getJSONObject(0).getString("measure"));assertEquals(0,f.as.outbox.activeProjects(f.bid));assertTrue("Legacy transport receipt is not an inventory checkpoint",f.as.outbox.pendingProjects(f.bid)>0);assertTrue(f.as.outbox.waitingForCheckpoint(f.bid));assertTrue("Unsupported history remains durably pending",f.as.outbox.pending(f.bid)>0);
        File[] holds=new File(f.b.home,"protected-revisions").listFiles(file->file.getName().matches("[a-f0-9]{64}\\.json"));assertNotNull(holds);for(File hold:holds)assertFalse("A legacy recipient must not be sent v3 historical content",new String(Files.readAllBytes(hold.toPath()),StandardCharsets.UTF_8).contains("100,000001"));
        assertArrayEquals(Files.readAllBytes(new File(f.a.home,"media/media-0").toPath()),Files.readAllBytes(new File(f.b.home,"media/media-0").toPath()));
    }
}
