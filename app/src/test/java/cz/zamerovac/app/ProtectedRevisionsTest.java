package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

/** Real private files with synthetic disk/authority faults; no physical Android claims. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class ProtectedRevisionsTest {
    PeerTransferTest.Device device;ProtectedRevisions protection;SyncPeerRegistry peers;
    String peer,exact;byte[] photo={1,3,5,7},video={0,0,0,24,102,116,121,112};
    @Before public void setup()throws Exception{
        File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"protected-").toFile();
        device=new PeerTransferTest.Device(root,"phone");protection=new ProtectedRevisions(device,device.prefs);
        peers=new SyncPeerRegistry(device.noBackup);peer=UUID.randomUUID().toString();peers.approve(peer,PeerTlsTest.C,"Tablet");
        LocalDatabase.write(device,"{\"schema\":1,\"records\":[]}");
        File media=new File(device.home,"media");media.mkdirs();Files.write(new File(media,"original-photo").toPath(),photo);Files.write(new File(media,"original-video").toPath(),video);
        device.prefs.edit().putString("mime-original-photo","image/jpeg").putString("name-original-photo","Původní foto.jpg").commit();
        exact="{ \"schema\":1, \"records\":[{\"id\":\"photo\",\"kind\":\"photo\",\"deleted\":true,\"media\":[\"original-photo\"],\"items\":[{\"a\":{\"x\":0.125,\"y\":999.5},\"b\":{\"x\":1234.56789,\"y\":0.5},\"measure\":\"0,000000123456789\",\"laserMeasuredMm\":\"1585.800001234567890\",\"media\":[\"original-video\"],\"history\":{\"undo\":[\"1250,123456789\"],\"redo\":[\"0.000000000001\"]}}]}]}";
        LocalDatabase.write(device,exact);
    }
    List<JSONObject> holds()throws Exception{
        List<JSONObject> result=new ArrayList<>();File[] files=new File(device.home,"protected-revisions").listFiles();
        if(files!=null)for(File f:files)if(f.getName().matches("[a-f0-9]{64}\\.json"))result.add(new JSONObject(new String(Files.readAllBytes(f.toPath()),StandardCharsets.UTF_8)));
        return result;
    }
    void exactBytes(){try{assertArrayEquals(photo,Files.readAllBytes(new File(device.home,"media/original-photo").toPath()));assertArrayEquals(video,Files.readAllBytes(new File(device.home,"media/original-video").toPath()));}catch(IOException e){throw new AssertionError(e);}}
    void hasExactDatabase()throws Exception{for(JSONObject hold:holds())if("database".equals(hold.getString("kind"))&&exact.equals(hold.getString("metadata")))return;fail("Missing byte-exact JSON preimage, geometry/laser/history");}
    @Test public void ackSupersessionForgetAndRestartNeverReleaseOriginals()throws Exception{
        PeerOutbox outbox=new PeerOutbox(device,device.prefs,peers);PeerSnapshot snapshot=outbox.prepare(peer);
        JSONObject job=outbox.messages(peer).get(0);outbox.completed(peer,job);assertEquals(0,outbox.pending(peer));
        assertEquals(Set.of("original-photo","original-video"),new ProtectedRevisions(device,device.prefs).pins());
        String next=new JSONObject(exact).put("records",new JSONArray()).toString();LocalDatabase.write(device,next);hasExactDatabase();
        outbox.prepare(peer);outbox.discard(peer);peers.forget(peer);
        assertEquals(Set.of("original-photo","original-video"),new ProtectedRevisions(device,device.prefs).pins());
        boolean found=false;for(JSONObject hold:holds())if(snapshot.hash.equals(hold.getString("sourceHash"))){found=true;assertArrayEquals(snapshot.bytes,hold.getString("metadata").getBytes(StandardCharsets.UTF_8));}
        assertTrue(found);exactBytes();assertEquals(2,Objects.requireNonNull(new File(device.home,"media").list()).length);
    }
    @Test public void purgeAndPendingCleanupRetainPhotoVideoAndExactPreimage()throws Exception{
        JSONObject result=new TrashPurger(device,device.prefs).purge(exact,exact,new JSONArray().put("photo"),text->LocalDatabase.write(device,text));
        assertEquals(0,result.getJSONObject("data").getJSONArray("records").length());assertEquals(2,result.getInt("protected"));assertTrue(result.getString("warning").contains("Chráněné"));
        assertEquals(0,result.getInt("pending"));hasExactDatabase();exactBytes();
        Files.write(new File(device.home,"trash-cleanup.json").toPath(),"[\"original-photo\",\"original-video\"]".getBytes(StandardCharsets.UTF_8));
        String saved=LocalDatabase.readForCas(device);new TrashPurger(device,device.prefs).purge(saved,saved,new JSONArray(),text->LocalDatabase.write(device,text));exactBytes();hasExactDatabase();
    }
    @Test public void validOrphanRepairsCatalogUnionAfterRestart()throws Exception{
        protection.preserveDatabase(exact);File catalog=new File(device.home,"protected-revisions/catalog.json");
        Files.write(catalog.toPath(),"{\"format\":\"cz.zamerovac.protection.catalog\",\"version\":1,\"holds\":[]}".getBytes(StandardCharsets.UTF_8));
        assertEquals(2,new ProtectedRevisions(device,device.prefs).pins().size());
        assertTrue(new JSONObject(new String(Files.readAllBytes(catalog.toPath()),StandardCharsets.UTF_8)).getJSONArray("holds").length()>=2);hasExactDatabase();exactBytes();
    }
    @Test public void missingRegistryAndCorruptManifestFailClosed()throws Exception{
        protection.preserveDatabase(exact);List<JSONObject> saved=holds();assertFalse(saved.isEmpty());
        File folder=new File(device.home,"protected-revisions");File moved=new File(device.home,"saved-evidence");Files.move(folder.toPath(),moved.toPath());
        try{new ProtectedRevisions(device,device.prefs).pins();fail("Lost registry accepted");}catch(IOException expected){}
        Files.move(moved.toPath(),folder.toPath());File manifest=Arrays.stream(Objects.requireNonNull(folder.listFiles())).filter(f->f.getName().matches("[a-f0-9]{64}\\.json")).findFirst().get();
        Files.write(manifest.toPath(),new byte[]{0});
        try{new TrashPurger(device,device.prefs).purge(exact,exact,new JSONArray().put("photo"),text->fail("DB commit after corrupt registry"));fail("Corrupt registry accepted");}catch(IOException expected){}
        assertEquals(exact,LocalDatabase.readForCas(device));exactBytes();
        assertFalse(ProtectedRevisions.rollback(new File(device.home,"media/original-photo")));exactBytes();
    }
    @Test public void lowSpaceRejectsReplacementWithoutTouchingConfirmedBytes()throws Exception{
        File full=new File(device.home.getAbsolutePath()){@Override public long getUsableSpace(){return 0;}};
        String changed=new JSONObject(exact).put("records",new JSONArray()).toString();
        try{LocalDatabase.write(full,device.noBackup,changed);fail("Disk-full save accepted");}catch(IOException expected){assertTrue(expected.getMessage().contains("nedostatku místa"));}
        assertEquals(exact,LocalDatabase.readForCas(device));exactBytes();
        // A successful retry preserves the old precise state and publishes the new DB.
        LocalDatabase.write(device,changed);assertEquals(changed,LocalDatabase.readForCas(device));hasExactDatabase();exactBytes();
    }
    @Test public void catalogWriteFailureBlocksPublicationAndRepairsOnRetry()throws Exception{
        File witness=new File(device.home.getParentFile(),"no_backup/protected-revisions.json");assertTrue(witness.delete());assertTrue(witness.mkdir());
        try{new PeerOutbox(device,device.prefs,peers).prepare(peer);fail("Unconfirmed protection allowed transport");}catch(IOException expected){}
        assertEquals(0,new PeerOutbox(device,device.prefs,peers).pending(peer));assertEquals(exact,LocalDatabase.readForCas(device));exactBytes();
        assertTrue(witness.delete());new PeerOutbox(device,device.prefs,peers).prepare(peer);assertTrue(new PeerOutbox(device,device.prefs,peers).pending(peer)>0);exactBytes();
    }
    @Test public void recoveryAuthorityLossCannotReleasePinsOrAuthorizeRestore()throws Exception{
        protection.preserveDatabase(exact);Files.write(new File(device.home,"projects.json").toPath(),new byte[]{0});
        try{LocalDatabase.readForCas(device);fail("Corrupt DB authorized");}catch(IOException expected){}
        assertTrue(DatabaseRecovery.pending(device.home));assertEquals(2,new ProtectedRevisions(device,device.prefs).pins().size());
        assertFalse(ProtectedRevisions.rollback(new File(device.home,"media/original-video")));hasExactDatabase();exactBytes();
        try{LocalDatabase.write(device,exact);fail("Hold treated as recovery authority");}catch(IOException expected){}
    }
    @Test public void rollbackKeepsPinnedAndLiveButRemovesUnreferencedNewFile()throws Exception{
        protection.preserveDatabase(exact);assertFalse(ProtectedRevisions.rollback(new File(device.home,"media/original-photo")));
        File unowned=new File(device.home,"media/unowned-new");Files.write(unowned.toPath(),new byte[]{9});assertTrue(ProtectedRevisions.rollback(unowned));assertFalse(unowned.exists());exactBytes();
    }
    @Test public void missingPinnedIdCannotBeReusedByIngestOrPeerReceive()throws Exception{
        protection.preserveDatabase(exact);File original=new File(device.home,"media/original-photo");assertTrue(original.delete());
        File staged=MediaStaging.temporary(original.getParentFile(),original.getName());Files.write(staged.toPath(),new byte[]{8});
        try{MediaStaging.commit(staged,original.getName(),device.prefs,"image/jpeg","Other");fail("Pinned ID reused");}catch(IOException expected){}finally{staged.delete();}
        JSONObject expected=new JSONObject().put("size",photo.length).put("hash",PeerWire.hash(photo));
        try{PeerMedia.receive(original.getParentFile(),original.getName(),new ByteArrayInputStream(photo),expected);fail("Missing protected original silently replaced");}catch(IOException expected){}
        assertFalse(original.exists());assertEquals(2,protection.pins().size());
    }
}
