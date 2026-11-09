package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.nio.file.attribute.FileTime;
import org.mockito.MockedStatic;
import static org.mockito.Mockito.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

/** B16 stage 2: preserve source bytes, not a license to restore or ACK. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class RecoveryProtectionArchiveTest {
    File home,noBackup,root;
    @Before public void setup()throws Exception {
        root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "recovery-copy-").toFile();
        home=new File(root,"files");noBackup=new File(root,"no_backup");
        assertTrue(home.mkdirs());assertTrue(noBackup.mkdirs());
    }
    JSONObject db(String exact)throws Exception {
        return new JSONObject().put("schema",1).put("records",new JSONArray()
            .put(new JSONObject().put("id","synthetic").put("items",new JSONArray()
                .put(new JSONObject().put("measure",exact)))));
    }
    byte[] read(File file)throws Exception{return Files.readAllBytes(file.toPath());}
    JSONObject entry(JSONArray files,String path)throws Exception{
        for(int i=0;i<files.length();i++){
            JSONObject f=files.getJSONObject(i);
            if(path.equals(f.getString("path")))return f;
        }
        fail("Missing archived path "+path);return null;
    }
    File archive(JSONObject result){
        return new File(noBackup,"recovery-protection-v1/snapshot-"+result.optString("id"));
    }
    int completedCount(){
        File root=new File(noBackup,"recovery-protection-v1");
        File[] files=root.listFiles((dir,name)->name.startsWith("snapshot-"));
        return files==null?0:files.length;
    }
    void media(String id,byte[] bytes)throws Exception{
        File dir=new File(home,"media");if(!dir.exists())assertTrue(dir.mkdir());
        Files.write(new File(dir,id).toPath(),bytes);
    }

    /** A valid marker is 64 lowercase SHA-256 hex bytes plus LF; protect live sources. */
    JSONObject completeMarkerFixture(String exact,byte[] photo)throws Exception{
        JSONObject project=db(exact);
        JSONObject record=project.getJSONArray("records").getJSONObject(0);
        record.put("media",new JSONArray().put("marker-photo"));
        record.put("history",new JSONObject().put("revisions",new JSONArray()
            .put(new JSONObject().put("note","history-exact")
                .put("media",new JSONArray().put("marker-photo")))));
        LocalDatabase.write(home,noBackup,project.toString());
        media("marker-photo",photo);
        JSONObject created=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(RecoveryProtectionArchive.verify(noBackup,created.getString("id"))
            .getBoolean("complete"));
        assertFalse(created.getBoolean("canPromote"));
        return created;
    }

    void assertMarkerRejectionKeepsOriginals(JSONObject copy,byte[] primary,byte[] photo,
                                              String exact)throws Exception{
        try{RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
            fail("Bad COMPLETE certified archive");}
        catch(IOException expected){}
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Bad COMPLETE was reused or silently repaired");}
        catch(IOException expected){}
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(photo,read(new File(home,"media/marker-photo")));
        assertEquals(exact,new JSONObject(new String(read(new File(home,"projects.json")),
            StandardCharsets.UTF_8)).getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertArrayEquals(primary,read(new File(archive(copy),"payload/files/projects.json")));
        assertArrayEquals(photo,read(new File(archive(copy),"payload/files/media/marker-photo")));
        assertFalse(new File(noBackup,"recovery-protection-v1").isFile());
    }

    @Test public void oversizedCompleteMarkerIsRejectedBeforeOpenAndPreservesSources()throws Exception{
        String exact="1585,800001234567890";
        byte[] photo={0,2,4,8,16,32};
        JSONObject copy=completeMarkerFixture(exact,photo);
        byte[] primary=read(new File(home,"projects.json"));
        Path complete=new File(archive(copy),"COMPLETE").toPath();
        byte[] oversized=new byte[4096];Arrays.fill(oversized,(byte)'x');
        byte[] valid=(copy.getString("id")+"\n").getBytes(StandardCharsets.US_ASCII);
        System.arraycopy(valid,0,oversized,0,valid.length);
        Files.write(complete,oversized);
        // Rejection must happen on file size, not after allocating/reading all bytes.
        try(MockedStatic<Files> watched=mockStatic(Files.class,CALLS_REAL_METHODS)){
            try{RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
                fail("Oversized COMPLETE was certified");}
            catch(IOException expected){}
            watched.verify(()->Files.newInputStream(complete,LinkOption.NOFOLLOW_LINKS),never());
        }
        assertMarkerRejectionKeepsOriginals(copy,primary,photo,exact);
    }

    @Test public void corruptedCompleteMarkerWithCorrectLengthIsRejected()throws Exception{
        String exact="0,0000000000000007";
        byte[] photo={1,3,5,7,9};
        JSONObject copy=completeMarkerFixture(exact,photo);
        byte[] primary=read(new File(home,"projects.json"));
        Path complete=new File(archive(copy),"COMPLETE").toPath();
        byte[] damaged=(copy.getString("id")+"!").getBytes(StandardCharsets.US_ASCII);
        assertEquals(65,damaged.length);
        Files.write(complete,damaged);
        assertMarkerRejectionKeepsOriginals(copy,primary,photo,exact);
        Files.write(complete,Arrays.copyOf(damaged,64)); // Truncated marker is invalid too.
        assertMarkerRejectionKeepsOriginals(copy,primary,photo,exact);
        byte[] different=(copy.getString("id").replace('a','b')+"\n")
            .getBytes(StandardCharsets.US_ASCII);
        if(Arrays.equals(different,(copy.getString("id")+"\n")
            .getBytes(StandardCharsets.US_ASCII)))different[0]=(byte)(different[0]=='0'?'1':'0');
        Files.write(complete,different);
        assertMarkerRejectionKeepsOriginals(copy,primary,photo,exact);
    }

    @Test public void completeGrowingAfterFirstReadIsBoundedToOneExtraByte()throws Exception{
        String exact="999,00000000000000001";
        byte[] photo={21,34,55,89};
        JSONObject copy=completeMarkerFixture(exact,photo);
        byte[] primary=read(new File(home,"projects.json"));
        Path complete=new File(archive(copy),"COMPLETE").toPath();
        AtomicInteger readBytes=new AtomicInteger();
        boolean[] grew={false};
        byte[] appended=new byte[2048];Arrays.fill(appended,(byte)'X');
        try(MockedStatic<Files> watched=mockStatic(Files.class,CALLS_REAL_METHODS)){
            watched.when(()->Files.newInputStream(any(Path.class),any(OpenOption[].class)))
                .thenAnswer(call->{
                    Path opened=call.getArgument(0);
                    InputStream original=(InputStream)call.callRealMethod();
                    if(!complete.equals(opened))return original;
                    return new FilterInputStream(original){
                        private void track(int amount)throws IOException{
                            if(amount<=0)return;
                            readBytes.addAndGet(amount);
                            if(!grew[0]){
                                grew[0]=true;
                                // Deterministic growth while the real stream is open.
                                Files.write(complete,appended,StandardOpenOption.APPEND);
                            }
                        }
                        @Override public int read(byte[] b,int off,int len)throws IOException{
                            int n=in.read(b,off,len);track(n);return n;
                        }
                        @Override public int read()throws IOException{
                            int n=in.read();if(n!=-1)track(1);return n;
                        }
                    };
                });
            try{RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
                fail("Marker that grew during reading was accepted");}
            catch(IOException expected){}
        }
        assertTrue("Growth hook must run during marker reading",grew[0]);
        assertTrue("Reader allocated or consumed more than 66 marker bytes",
            readBytes.get()>0&&readBytes.get()<=66);
        assertEquals(65+appended.length,Files.size(complete));
        assertMarkerRejectionKeepsOriginals(copy,primary,photo,exact);
    }

    /**
     * Recreate a real file change *between* the authenticated first read and the
     * second manifest read. The forged source metadata is valid JSON but its
     * bytes do not hash to the snapshot's immutable ID.
     */
    void assertSecondManifestReadCannotSupplyUnauthenticatedMetadata(boolean interrupted)
            throws Exception{
        String exact="1585,800001234567890";
        byte[] photo={1,3,5,7,9,11};
        JSONObject snapshot=completeMarkerFixture(exact,photo);
        File copy=archive(snapshot);
        File manifestFile=new File(copy,"manifest.json");
        Path manifestPath=manifestFile.toPath();
        byte[] originalManifest=read(manifestFile);
        JSONObject authenticated=JsonInput.object(originalManifest);
        assertEquals(snapshot.getString("id"),PeerWire.hash(originalManifest));
        JSONObject forged=JsonInput.object(originalManifest);
        forged.put("sourceComplete",!authenticated.optBoolean("sourceComplete"));
        forged.put("files",new JSONArray());
        forged.put("missing",new JSONArray().put(new JSONObject()
            .put("path","files/media/forged-missing")
            .put("reason","MISSING_OR_UNSAFE")));
        byte[] forgedManifest=forged.toString().getBytes(StandardCharsets.UTF_8);
        assertNotEquals("Tampered JSON must not match the immutable snapshot ID",
            snapshot.getString("id"),PeerWire.hash(forgedManifest));
        assertNotEquals(authenticated.optBoolean("sourceComplete"),
            forged.optBoolean("sourceComplete"));

        File marker=new File(copy,"COMPLETE");
        if(interrupted)assertTrue("Simulate crash before completing archive",marker.delete());
        else assertTrue(marker.isFile());

        byte[] primaryBefore=read(new File(home,"projects.json"));
        byte[] archivedDb=read(new File(copy,"payload/files/projects.json"));
        byte[] archivedPhoto=read(new File(copy,"payload/files/media/marker-photo"));
        assertArrayEquals(primaryBefore,archivedDb);
        assertArrayEquals(photo,archivedPhoto);
        AtomicInteger opens=new AtomicInteger();
        boolean[] actuallyTampered={false};
        try{
            try(MockedStatic<Files> mocked=mockStatic(Files.class,CALLS_REAL_METHODS)){
                mocked.when(()->Files.newInputStream(any(Path.class),any(OpenOption[].class)))
                    .thenAnswer(call->{
                        Path opened=call.getArgument(0);
                        if(manifestPath.equals(opened)){
                            int number=opens.incrementAndGet();
                            if(number==2){
                                // After the first authenticated manifest, the
                                // second read sees valid JSON with forged metadata.
                                Files.write(manifestPath,forgedManifest);
                                actuallyTampered[0]=true;
                            }else if(interrupted&&number==3){
                                // An attacker can swap it back before finish()
                                // verifies archived bytes again. The old code
                                // would then finish an archive based on a forged
                                // intermediate manifest without rejecting.
                                Files.write(manifestPath,originalManifest);
                            }
                        }
                        return call.callRealMethod();
                    });
                try{
                    if(interrupted)RecoveryProtectionArchive.create(home,noBackup);
                    else RecoveryProtectionArchive.verify(noBackup,snapshot.getString("id"));
                    fail("Accepted sourceComplete/files/missing from a forged second manifest");
                }catch(IOException expected){
                    assertNotNull(expected.getMessage());
                }
            }
        }finally{
            // Leave the historical archive byte-for-byte intact even after
            // this intentionally destructive test-only race injection.
            Files.write(manifestPath,originalManifest);
        }
        assertTrue("The second read must really be replaced",actuallyTampered[0]);
        assertEquals("The test must inject into precisely the second manifest read",
            2,opens.get());
        assertArrayEquals(originalManifest,read(manifestFile));
        assertArrayEquals(primaryBefore,read(new File(home,"projects.json")));
        assertArrayEquals(archivedDb,read(new File(copy,"payload/files/projects.json")));
        assertArrayEquals(photo,read(new File(home,"media/marker-photo")));
        assertArrayEquals(archivedPhoto,read(new File(copy,"payload/files/media/marker-photo")));
        JSONObject db=new JSONObject(new String(primaryBefore,StandardCharsets.UTF_8));
        assertEquals(exact,db.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("history-exact",db.getJSONArray("records").getJSONObject(0)
            .getJSONObject("history").getJSONArray("revisions")
            .getJSONObject(0).getString("note"));
        assertEquals(1,completedCount());
        assertEquals("Failure must not certify a previously incomplete archive",
            !interrupted,marker.exists());
        if(interrupted){
            try{
                RecoveryProtectionArchive.verify(noBackup,snapshot.getString("id"));
                fail("Unfinished archive became complete after a rejected forged manifest");
            }catch(IOException expected){}
        }else{
            JSONObject reopened=RecoveryProtectionArchive.verify(noBackup,snapshot.getString("id"));
            assertTrue(reopened.getBoolean("complete"));
            assertFalse(reopened.getBoolean("canPromote"));
        }
    }

    @Test public void forgedSecondManifestCannotChangeConfirmedArchiveMetadata()
            throws Exception{
        assertSecondManifestReadCannotSupplyUnauthenticatedMetadata(false);
    }

    @Test public void forgedSecondManifestCannotFinalizeInterruptedArchive()
            throws Exception{
        assertSecondManifestReadCannotSupplyUnauthenticatedMetadata(true);
    }

    @Test public void validManifestMetadataSurvivesVerifyReuseAndInterruptedFinalization()
            throws Exception{
        String exact="1585,800001234567890";
        byte[] photo={1,3,5,7,9,11};
        JSONObject copy=completeMarkerFixture(exact,photo);
        File saved=archive(copy);
        byte[] originalManifest=read(new File(saved,"manifest.json"));
        JSONObject signed=JsonInput.object(originalManifest);
        JSONArray originalFiles=signed.getJSONArray("files");
        JSONObject reopened=RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
        assertTrue(reopened.getBoolean("complete"));
        assertFalse(reopened.getBoolean("canPromote"));
        assertEquals(signed.getBoolean("sourceComplete"),reopened.getBoolean("sourceComplete"));
        assertEquals(originalFiles.length(),reopened.getJSONArray("files").length());
        assertEquals(signed.getJSONArray("missing").length(),reopened.getJSONArray("missing").length());
        for(int i=0;i<originalFiles.length();i++){
            JSONObject before=originalFiles.getJSONObject(i);
            JSONObject after=reopened.getJSONArray("files").getJSONObject(i);
            assertEquals(before.getString("path"),after.getString("path"));
            assertEquals(before.getString("sha256"),after.getString("sha256"));
            assertEquals(before.getLong("size"),after.getLong("size"));
        }
        JSONObject reused=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(reused.getBoolean("reused"));
        assertTrue(reused.getBoolean("complete"));
        assertFalse(reused.getBoolean("canPromote"));
        assertEquals(originalFiles.length(),reused.getJSONArray("files").length());
        assertTrue(new File(saved,"COMPLETE").delete());
        JSONObject finished=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(finished.getBoolean("reused"));
        assertTrue(finished.getBoolean("complete"));
        assertFalse(finished.getBoolean("canPromote"));
        assertEquals(originalFiles.length(),finished.getJSONArray("files").length());
        assertArrayEquals(originalManifest,read(new File(saved,"manifest.json")));
        assertArrayEquals(photo,read(new File(saved,"payload/files/media/marker-photo")));
        assertArrayEquals(photo,read(new File(home,"media/marker-photo")));
        JSONObject stored=new JSONObject(new String(read(new File(home,"projects.json")),
            StandardCharsets.UTF_8));
        assertEquals(exact,stored.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("history-exact",stored.getJSONArray("records").getJSONObject(0)
            .getJSONObject("history").getJSONArray("revisions")
            .getJSONObject(0).getString("note"));
        assertEquals(1,completedCount());
    }

    private static final String REUSE_EXACT="1585,800001234567890";
    private static final byte[] REUSE_PHOTO={1,3,5,7,9,11};

    /** Only synthetic source files; no restoration or sync acknowledgement. */
    JSONObject reuseFixture()throws Exception{
        JSONObject project=db(REUSE_EXACT);
        JSONObject record=project.getJSONArray("records").getJSONObject(0);
        record.put("media",new JSONArray().put("reuse-photo"));
        record.put("history",new JSONObject().put("revisions",new JSONArray()
            .put(new JSONObject().put("note","durable-undo")
                .put("media",new JSONArray().put("reuse-photo")))));
        LocalDatabase.write(home,noBackup,project.toString());
        media("reuse-photo",REUSE_PHOTO);
        File prefs=new File(root,"shared_prefs");
        assertTrue(prefs.mkdir());
        Files.write(new File(prefs,"zamerovac.xml").toPath(),
            "<map><string name=\"photo\">initial</string></map>"
                .getBytes(StandardCharsets.UTF_8));
        JSONObject archived=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(archived.getBoolean("complete"));
        assertFalse(archived.getBoolean("canPromote"));
        return archived;
    }

    interface ReuseEdit{void apply()throws IOException;}
    /** Inject after the initial source fingerprint and the existing archive verification. */
    void rejectReuseOnSourceDrift(JSONObject old,ReuseEdit edit,boolean markerExpected)
            throws Exception{
        AtomicInteger checkpoints=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,()->{
                if(checkpoints.incrementAndGet()==2)edit.apply();
            });
            fail("Existing snapshot was reused after sources changed");
        }catch(IOException expected){}
        assertEquals("Source mutation must happen inside reuse, after archive verification",
            2,checkpoints.get());
        assertEquals(markerExpected,new File(archive(old),"COMPLETE").exists());
        assertEquals(1,completedCount());
        if(markerExpected){
            JSONObject independent=RecoveryProtectionArchive.verify(noBackup,old.getString("id"));
            assertTrue(independent.getBoolean("complete"));
            assertFalse(independent.getBoolean("canPromote"));
        }else{
            try{
                RecoveryProtectionArchive.verify(noBackup,old.getString("id"));
                fail("Unconfirmed copy was accidentally promoted");
            }catch(IOException expected){}
        }
        assertArrayEquals(REUSE_PHOTO,
            read(new File(archive(old),"payload/files/media/reuse-photo")));
        JSONObject oldDb=new JSONObject(new String(
            read(new File(archive(old),"payload/files/projects.json")),StandardCharsets.UTF_8));
        assertEquals(REUSE_EXACT,oldDb.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("durable-undo",oldDb.getJSONArray("records").getJSONObject(0)
            .getJSONObject("history").getJSONArray("revisions")
            .getJSONObject(0).getString("note"));
    }

    @Test public void existingConfirmedArchiveRejectsPreciseDimensionChangedDuringReuse()
            throws Exception{
        JSONObject old=reuseFixture();
        File primary=new File(home,"projects.json");
        JSONObject modified=new JSONObject(new String(read(primary),StandardCharsets.UTF_8));
        modified.getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).put("measure","9999,000000000987654321");
        byte[] newDb=modified.toString().getBytes(StandardCharsets.UTF_8);
        rejectReuseOnSourceDrift(old,()->Files.write(primary.toPath(),newDb),true);
        assertArrayEquals(newDb,read(primary));
        assertEquals("9999,000000000987654321",
            new JSONObject(new String(read(primary),StandardCharsets.UTF_8))
                .getJSONArray("records").getJSONObject(0).getJSONArray("items")
                .getJSONObject(0).getString("measure"));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
    }

    @Test public void existingArchiveRejectsPhotoMutationInsideMarkerVerification()
            throws Exception{
        JSONObject old=reuseFixture();
        Path marker=new File(archive(old),"COMPLETE").toPath();
        File original=new File(home,"media/reuse-photo");
        byte[] updated={12,10,8,6,4,2};
        byte[] primary=read(new File(home,"projects.json"));
        boolean[] injected={false};
        try(MockedStatic<Files> mocked=mockStatic(Files.class,CALLS_REAL_METHODS)){
            mocked.when(()->Files.newInputStream(any(Path.class),any(OpenOption[].class)))
                .thenAnswer(call->{
                    Path opened=call.getArgument(0);
                    InputStream in=(InputStream)call.callRealMethod();
                    if(marker.equals(opened)&&!injected[0]){
                        Files.write(original.toPath(),updated);
                        injected[0]=true; // after initial source scan, while verifying archive
                    }
                    return in;
                });
            try{
                RecoveryProtectionArchive.create(home,noBackup);
                fail("Live photo changed during verify but stale archive was reused");
            }catch(IOException expected){}
        }
        assertTrue("Marker read must trigger a real-time source change",injected[0]);
        assertArrayEquals(updated,read(original));
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(REUSE_PHOTO,read(new File(archive(old),
            "payload/files/media/reuse-photo")));
        assertTrue(RecoveryProtectionArchive.verify(noBackup,old.getString("id"))
            .getBoolean("complete"));
    }

    @Test public void existingConfirmedArchiveRejectsSameLengthPhotoMutationDuringReuse()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        byte[] newPhoto={11,9,7,5,3,1};
        assertEquals(REUSE_PHOTO.length,newPhoto.length);
        File live=new File(home,"media/reuse-photo");
        rejectReuseOnSourceDrift(old,()->Files.write(live.toPath(),newPhoto),true);
        assertArrayEquals(newPhoto,read(live));
        assertArrayEquals(primary,read(new File(home,"projects.json")));
    }

    @Test public void existingConfirmedArchiveRejectsChangedPrefsOnly()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        File prefs=new File(root,"shared_prefs/zamerovac.xml");
        File pending=new File(noBackup,"sync-queue-v2.json.bak");
        assertFalse("Test must not include queue sidecar changes",pending.exists());
        byte[] changed="<map><string name=\"photo\">updated</string></map>"
            .getBytes(StandardCharsets.UTF_8);
        rejectReuseOnSourceDrift(old,()->Files.write(prefs.toPath(),changed),true);
        assertArrayEquals(changed,read(prefs));
        assertFalse(pending.exists());
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
        assertArrayEquals(primary,read(new File(archive(old),"payload/files/projects.json")));
        assertFalse(RecoveryProtectionArchive.verify(noBackup,old.getString("id"))
            .getBoolean("canPromote"));
    }

    @Test public void existingConfirmedArchiveRejectsNewAtomicSidecarOnly()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        File prefs=new File(root,"shared_prefs/zamerovac.xml");
        byte[] prefsBefore=read(prefs);
        File pending=new File(noBackup,"sync-queue-v2.json.bak");
        assertFalse("Sidecar must be initially absent",pending.exists());
        byte[] queued="{\"version\":2,\"revision\":7,\"jobs\":[],\"recoveryQuarantine\":[]}"
            .getBytes(StandardCharsets.UTF_8);
        rejectReuseOnSourceDrift(old,()->Files.write(pending.toPath(),queued),true);
        assertArrayEquals(queued,read(pending));
        assertArrayEquals(prefsBefore,read(prefs));
        assertArrayEquals(prefsBefore,
            read(new File(archive(old),"payload/shared_prefs/zamerovac.xml")));
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
        assertArrayEquals(primary,read(new File(archive(old),"payload/files/projects.json")));
        assertFalse(new File(archive(old),"payload/no_backup/sync-queue-v2.json.bak").exists());
        assertFalse(RecoveryProtectionArchive.verify(noBackup,old.getString("id"))
            .getBoolean("canPromote"));
    }

    @Test public void existingConfirmedArchiveRejectsDisappearingOriginalPhoto()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        File original=new File(home,"media/reuse-photo");
        File moved=new File(root,"moved-original-photo");
        rejectReuseOnSourceDrift(old,()->Files.move(original.toPath(),moved.toPath()),true);
        assertFalse(original.exists());
        assertArrayEquals(REUSE_PHOTO,read(moved));
        assertArrayEquals(primary,read(new File(home,"projects.json")));
    }

    @Test public void existingConfirmedArchiveRejectsUnsafeNewSidecarSymlink()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        Path sidecar=new File(noBackup,"sync-queue-v2.json.bak").toPath();
        Path target=new File(home,"projects.json").toPath();
        rejectReuseOnSourceDrift(old,()->Files.createSymbolicLink(sidecar,target),true);
        assertTrue(Files.isSymbolicLink(sidecar));
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
    }

    @Test public void interruptedBeforeCompleteRejectsSourceChangeWithoutPublishingMarker()
            throws Exception{
        JSONObject old=reuseFixture();
        File complete=new File(archive(old),"COMPLETE");
        assertTrue(complete.delete()); // simulates crash after directory rename
        byte[] primary=read(new File(home,"projects.json"));
        File original=new File(home,"media/reuse-photo");
        byte[] changed={2,4,6,8,10,12};
        rejectReuseOnSourceDrift(old,()->Files.write(original.toPath(),changed),false);
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(changed,read(original));
        assertFalse("A stale archive was marked complete",complete.exists());
    }

    @Test public void interruptedArchiveRejectsDriftAfterMarkerButKeepsArchivedEvidence()
            throws Exception{
        JSONObject old=reuseFixture();
        File marker=new File(archive(old),"COMPLETE");
        assertTrue(marker.delete());
        File primary=new File(home,"projects.json");
        byte[] original=read(primary);
        File prefs=new File(root,"shared_prefs/zamerovac.xml");
        byte[] changed="<map><string name=\"photo\">late-update</string></map>"
            .getBytes(StandardCharsets.UTF_8);
        AtomicInteger checkpoints=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,()->{
                if(checkpoints.incrementAndGet()==3)Files.write(prefs.toPath(),changed);
            });
            fail("Late source mutation was reported as a current archive reuse");
        }catch(IOException expected){}
        assertEquals(3,checkpoints.get());
        // The marker certifies the independent OLD archived bytes, never live freshness.
        assertTrue(marker.exists());
        assertTrue(RecoveryProtectionArchive.verify(noBackup,old.getString("id"))
            .getBoolean("complete"));
        assertArrayEquals(changed,read(prefs));
        assertArrayEquals(original,read(primary));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
        assertArrayEquals(REUSE_PHOTO,read(new File(archive(old),
            "payload/files/media/reuse-photo")));
    }

    @Test public void unreadableLivePhotoDuringSecondInventoryFailsClosedWithoutSourceMutation()
            throws Exception{
        JSONObject old=reuseFixture();
        Path live=new File(home,"media/reuse-photo").toPath();
        byte[] primaryBefore=read(new File(home,"projects.json"));
        byte[] prefsBefore=read(new File(root,"shared_prefs/zamerovac.xml"));
        byte[] photoBefore=read(live.toFile());
        byte[] archivedDb=read(new File(archive(old),"payload/files/projects.json"));
        byte[] archivedPhoto=read(new File(archive(old),"payload/files/media/reuse-photo"));
        byte[] archivedPrefs=read(new File(archive(old),"payload/shared_prefs/zamerovac.xml"));
        assertArrayEquals(REUSE_PHOTO,photoBefore);

        AtomicInteger checkpoints=new AtomicInteger();
        AtomicInteger firstScanReads=new AtomicInteger();
        AtomicInteger injectedFailures=new AtomicInteger();
        try(MockedStatic<Files> mocked=mockStatic(Files.class,CALLS_REAL_METHODS)){
            mocked.when(()->Files.newInputStream(any(Path.class),any(OpenOption[].class)))
                .thenAnswer(call->{
                    Path opened=call.getArgument(0);
                    if(live.equals(opened)){
                        if(checkpoints.get()==2){
                            injectedFailures.incrementAndGet();
                            throw new IOException("Synthetic read failure in second live inventory");
                        }
                        firstScanReads.incrementAndGet();
                    }
                    return call.callRealMethod();
                });
            try{
                RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                    ()->{checkpoints.incrementAndGet();});
                fail("Unreadable live photo in the second scan was reused");
            }catch(IOException expected){
                assertTrue("Must reject this live photo, not an unrelated error",
                    expected.getMessage().contains("files/media/reuse-photo"));
            }
        }
        assertEquals("Injection must happen after verification and before reused=true",
            2,checkpoints.get());
        assertTrue("The first inventory must have read the same live photo",
            firstScanReads.get()>0);
        assertEquals("Only the second inventory must receive the synthetic I/O error",
            1,injectedFailures.get());

        assertEquals(1,completedCount());
        assertArrayEquals(primaryBefore,read(new File(home,"projects.json")));
        assertArrayEquals(photoBefore,read(live.toFile()));
        assertArrayEquals(prefsBefore,read(new File(root,"shared_prefs/zamerovac.xml")));
        assertArrayEquals(archivedDb,read(new File(archive(old),"payload/files/projects.json")));
        assertArrayEquals(archivedPhoto,
            read(new File(archive(old),"payload/files/media/reuse-photo")));
        assertArrayEquals(archivedPrefs,
            read(new File(archive(old),"payload/shared_prefs/zamerovac.xml")));
        JSONObject stored=new JSONObject(new String(primaryBefore,StandardCharsets.UTF_8));
        assertEquals(REUSE_EXACT,stored.getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
        assertEquals("durable-undo",stored.getJSONArray("records").getJSONObject(0)
            .getJSONObject("history").getJSONArray("revisions")
            .getJSONObject(0).getString("note"));
        JSONObject verified=RecoveryProtectionArchive.verify(noBackup,old.getString("id"));
        assertTrue(verified.getBoolean("complete"));
        assertFalse(verified.getBoolean("canPromote"));
    }

    @Test public void unmodifiedSourcesReuseConfirmedAndSafelyFinishUnconfirmed()
            throws Exception{
        JSONObject old=reuseFixture();
        byte[] primary=read(new File(home,"projects.json"));
        JSONObject again=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(again.getBoolean("reused"));
        assertTrue(again.getBoolean("complete"));
        assertFalse(again.getBoolean("canPromote"));
        assertEquals(old.getString("id"),again.getString("id"));
        File marker=new File(archive(old),"COMPLETE");
        assertTrue(marker.delete());
        JSONObject resumed=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(resumed.getBoolean("reused"));
        assertTrue(resumed.getBoolean("complete"));
        assertFalse(resumed.getBoolean("canPromote"));
        assertEquals(old.getString("id"),resumed.getString("id"));
        assertEquals(1,completedCount());
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(REUSE_PHOTO,read(new File(home,"media/reuse-photo")));
    }

    @Test public void snapshotKeepsExactDimensionsOldBackupTrashJournalMediaPrefsAndOutbox()throws Exception{
        String first="1250,000000001",exact="1585,800001234567890";
        LocalDatabase.write(home,noBackup,db(first).toString());
        byte[] photo=new byte[]{0,1,2,3,5,8,13,21,34,55,89};
        byte[] trash=new byte[]{101,102,103},history=new byte[]{11,12,13};
        media("original-photo",photo);media("trash-photo",trash);media("history-photo",history);
        JSONObject next=db(exact);
        JSONObject record=next.getJSONArray("records").getJSONObject(0);
        record.put("media",new JSONArray().put("original-photo"));
        record.put("history",new JSONObject().put("revisions",new JSONArray()
            .put(new JSONObject().put("media",new JSONArray().put("history-photo")))));
        next.getJSONArray("records").put(new JSONObject().put("id","in-trash")
            .put("deleted",true).put("media",new JSONArray().put("trash-photo")));
        next.put("trashPurgedIds",new JSONArray().put("previously-purged"));
        next.put("syncTombstones",new JSONObject().put("previously-purged",
            new JSONObject().put(UUID.randomUUID().toString(),1)));
        LocalDatabase.write(home,noBackup,next.toString());
        Files.write(new File(home,"trash-cleanup.json").toPath(),
            "[\"trash-photo\"]".getBytes(StandardCharsets.UTF_8));
        File shared=new File(root,"shared_prefs");assertTrue(shared.mkdir());
        byte[] settings="<map><string name=\"mime-original-photo\">image/jpeg</string></map>"
            .getBytes(StandardCharsets.UTF_8);
        Files.write(new File(shared,"zamerovac.xml").toPath(),settings);
        File outbox=new File(noBackup,"sync-v2-outbox");assertTrue(outbox.mkdir());
        byte[] queued="{\"unchanged\":\"queued-revision\"}".getBytes(StandardCharsets.UTF_8);
        String immutableHash=PeerWire.hash(queued);
        Files.write(new File(outbox,immutableHash+".json").toPath(),queued);
        File primary=new File(home,"projects.json"),oldBackup=new File(home,"projects.bak"),
            journal=new File(home,"projects.recovery-v1.json");
        byte[] primaryBefore=read(primary),backupBefore=read(oldBackup),
            journalBefore=read(journal);
        JSONObject result=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(result.getBoolean("complete"));
        assertTrue(result.getBoolean("sourceComplete"));
        assertFalse(result.getBoolean("canPromote"));
        assertFalse(result.getBoolean("reused"));
        assertEquals(1,completedCount());
        File protectedCopy=archive(result);
        assertTrue(new File(protectedCopy,"COMPLETE").isFile());
        assertArrayEquals(primaryBefore,read(new File(protectedCopy,"payload/files/projects.json")));
        assertArrayEquals(backupBefore,read(new File(protectedCopy,"payload/files/projects.bak")));
        assertArrayEquals(journalBefore,read(new File(protectedCopy,
            "payload/files/projects.recovery-v1.json")));
        assertArrayEquals(photo,read(new File(protectedCopy,"payload/files/media/original-photo")));
        assertArrayEquals(trash,read(new File(protectedCopy,"payload/files/media/trash-photo")));
        assertArrayEquals(history,read(new File(protectedCopy,"payload/files/media/history-photo")));
        assertArrayEquals(settings,read(new File(protectedCopy,"payload/shared_prefs/zamerovac.xml")));
        assertArrayEquals(queued,read(new File(protectedCopy,
            "payload/no_backup/sync-v2-outbox/"+immutableHash+".json")));
        JSONObject manifest=new JSONObject(new String(read(new File(protectedCopy,"manifest.json")),
            StandardCharsets.UTF_8));
        assertEquals(PeerWire.hash(photo),entry(manifest.getJSONArray("files"),
            "files/media/original-photo").getString("sha256"));
        assertEquals(primaryBefore.length,entry(manifest.getJSONArray("files"),
            "files/projects.json").getLong("size"));
        assertEquals(PeerWire.hash(settings),entry(manifest.getJSONArray("files"),
            "shared_prefs/zamerovac.xml").getString("sha256"));
        JSONObject reopened=RecoveryProtectionArchive.verify(noBackup,result.getString("id"));
        assertTrue(reopened.getBoolean("complete"));
        assertEquals(result.getString("id"),reopened.getString("id"));
        JSONObject twice=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(twice.getBoolean("reused"));assertEquals(1,completedCount());
        assertArrayEquals(primaryBefore,read(primary));
        assertArrayEquals(backupBefore,read(oldBackup));
        assertArrayEquals(journalBefore,read(journal));
        assertArrayEquals(photo,read(new File(home,"media/original-photo")));
        assertEquals(exact,new JSONObject(new String(read(primary),StandardCharsets.UTF_8))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void atomicFileSidecarsAreArchivedByteForByteWithoutPromotingThem()throws Exception{
        String exact="1585,800001234567890";
        LocalDatabase.write(home,noBackup,db(exact).toString());
        byte[] primary=read(new File(home,"projects.json"));
        Map<String,byte[]> sidecars=new LinkedHashMap<>();
        sidecars.put("no_backup/sync-queue-v2.json.bak",
            "{\"version\":2,\"revision\":7,\"jobs\":[],\"recoveryQuarantine\":[]}".getBytes(StandardCharsets.UTF_8));
        sidecars.put("no_backup/sync-queue-v2.json.new","{\"jobs\":[".getBytes(StandardCharsets.UTF_8));
        sidecars.put("no_backup/sync-peers-v2.json.new","{\"ack\":".getBytes(StandardCharsets.UTF_8));
        sidecars.put("files/trash-cleanup.json.new","[\"pending-photo\"]".getBytes(StandardCharsets.UTF_8));
        sidecars.put("files/projects.bak.bak",db("1250,000000001").toString().getBytes(StandardCharsets.UTF_8));
        sidecars.put("files/projects.bak.new",db("1360,000000001").toString().getBytes(StandardCharsets.UTF_8));
        for(Map.Entry<String,byte[]> sidecar:sidecars.entrySet())
            Files.write(new File(root,sidecar.getKey()).toPath(),sidecar.getValue());
        File queue=new File(noBackup,"sync-queue-v2.json");
        assertFalse(queue.exists());

        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        JSONObject verified=RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
        assertTrue(verified.getBoolean("complete"));
        for(Map.Entry<String,byte[]> sidecar:sidecars.entrySet()){
            String path=sidecar.getKey();
            byte[] bytes=sidecar.getValue();
            JSONObject row=entry(verified.getJSONArray("files"),path);
            assertEquals(PeerWire.hash(bytes),row.getString("sha256"));
            assertEquals(path.endsWith(".new")?"UNCONFIRMED":"PRESENT",row.getString("state"));
            assertArrayEquals(bytes,read(new File(archive(copy),"payload/"+path)));
            assertArrayEquals(bytes,read(new File(root,path)));
        }
        assertFalse(verified.getBoolean("sourceComplete"));
        assertFalse(verified.getBoolean("canPromote"));
        assertFalse(queue.exists());
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertEquals(exact,new JSONObject(new String(primary,StandardCharsets.UTF_8))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void symbolicLinkInAtomicFileSidecarCannotBeCertified()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        Path original=new File(home,"projects.json").toPath();
        byte[] primary=Files.readAllBytes(original);
        Path sidecar=new File(noBackup,"sync-queue-v2.json.bak").toPath();
        Files.createSymbolicLink(sidecar,original);

        try{
            RecoveryProtectionArchive.create(home,noBackup);
            fail("Symbolic link in an AtomicFile sidecar was certified");
        }catch(IOException expected){
            assertTrue(expected.getMessage().contains("no_backup/sync-queue-v2.json.bak"));
        }
        assertEquals(0,completedCount());
        assertTrue(Files.isSymbolicLink(sidecar));
        assertArrayEquals(primary,Files.readAllBytes(original));
    }

    @Test public void damagedPrimaryIsPreservedAsEvidenceNeverReplacedByOldBackup()throws Exception{
        LocalDatabase.write(home,noBackup,db("111,00001").toString());
        LocalDatabase.write(home,noBackup,db("999,00002").toString());
        File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
        byte[] corrupt="{broken-primary".getBytes(StandardCharsets.UTF_8);
        Files.write(primary.toPath(),corrupt);
        byte[] backupBefore=read(backup);
        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(copy.getBoolean("complete"));
        assertFalse(copy.getBoolean("sourceComplete"));
        assertFalse(copy.getBoolean("canPromote"));
        JSONObject m=new JSONObject(new String(read(new File(archive(copy),"manifest.json")),
            StandardCharsets.UTF_8));
        assertEquals("CORRUPT",entry(m.getJSONArray("files"),
            "files/projects.json").getString("state"));
        assertArrayEquals(corrupt,read(new File(archive(copy),"payload/files/projects.json")));
        assertArrayEquals(backupBefore,read(new File(archive(copy),"payload/files/projects.bak")));
        assertArrayEquals(corrupt,read(primary));
        assertArrayEquals(backupBefore,read(backup));
    }

    @Test public void absentPhotoAndTextOnlyOrOrphanMediaHaveTruthfulCompleteness()throws Exception{
        JSONObject data=db("1585,800001234567890");
        data.getJSONArray("records").getJSONObject(0)
            .put("media",new JSONArray().put("missing-photo"));
        LocalDatabase.write(home,noBackup,data.toString());
        JSONObject partial=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(partial.getBoolean("complete")); // copy of AVAILABLE originals is complete
        assertFalse(partial.getBoolean("sourceComplete"));
        assertFalse(partial.getBoolean("canPromote"));
        assertEquals("files/media/missing-photo",partial.getJSONArray("missing")
            .getJSONObject(0).getString("path"));
        assertFalse(new File(archive(partial),"payload/files/media/missing-photo").exists());
        assertFalse(new File(home,"media/missing-photo").exists());
        File separate=Files.createTempDirectory(root.toPath(),"text-only-").toFile();
        File simpleHome=new File(separate,"files"),simpleBackup=new File(separate,"no_backup");
        assertTrue(simpleHome.mkdir());assertTrue(simpleBackup.mkdir());
        String exact="0,0000000000000007";
        LocalDatabase.write(simpleHome,simpleBackup,db(exact).toString());
        JSONObject textCopy=RecoveryProtectionArchive.create(simpleHome,simpleBackup);
        assertTrue(textCopy.getBoolean("sourceComplete"));
        assertEquals(0,textCopy.getJSONArray("missing").length());
        assertArrayEquals(read(new File(simpleHome,"projects.json")),
            read(new File(new File(simpleBackup,
                "recovery-protection-v1/snapshot-"+textCopy.getString("id")),
                "payload/files/projects.json")));
        File orphanHome=new File(root,"orphan-files"),orphanBackup=new File(root,"orphan-no_backup");
        assertTrue(orphanHome.mkdir());assertTrue(orphanBackup.mkdir());
        File dir=new File(orphanHome,"media");assertTrue(dir.mkdir());
        byte[] lostPhoto=new byte[]{7,0,5,1,9,8};
        Files.write(new File(dir,"unlinked-photo").toPath(),lostPhoto);
        JSONObject orphan=RecoveryProtectionArchive.create(orphanHome,orphanBackup);
        assertTrue(orphan.getBoolean("complete"));
        assertFalse(orphan.getBoolean("sourceComplete"));
        assertFalse(new File(orphanHome,"projects.json").exists());
        assertArrayEquals(lostPhoto,read(new File(orphanBackup,
            "recovery-protection-v1/snapshot-"+orphan.getString("id")+
            "/payload/files/media/unlinked-photo")));
    }

    @Test public void lowStorageFailsBeforeStagingAndNeverChangesPrimary()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        File primary=new File(home,"projects.json");
        byte[] before=read(primary);
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->0,()->{});
            fail("Insufficient storage published a recovery copy");
        }catch(IOException expected){}
        assertEquals(0,completedCount());
        assertArrayEquals(before,read(primary));
        assertFalse(new File(noBackup,"recovery-protection-v1").exists());
    }

    @Test public void interruptedStageIsNeverCompleteAndRetryAfterRestartIsIdempotent()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        media("original-photo",new byte[]{1,2,3,4,5,6,7});
        AtomicInteger steps=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(steps.incrementAndGet()>=4)
                    throw new InterruptedIOException("test process interruption");});
            fail("Interrupted archive was committed");
        }catch(InterruptedIOException expected){}
        assertEquals(0,completedCount());
        File archiveRoot=new File(noBackup,"recovery-protection-v1");
        File[] stages=archiveRoot.listFiles((d,name)->name.startsWith(".staging-"));
        assertNotNull(stages);assertTrue(stages.length>=1);
        for(File stage:stages)assertFalse(new File(stage,"COMPLETE").exists());
        JSONObject first=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(first.getBoolean("complete"));
        JSONObject retry=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(retry.getBoolean("reused"));
        assertEquals(first.getString("id"),retry.getString("id"));
        assertEquals(1,completedCount());
        assertTrue(RecoveryProtectionArchive.verify(noBackup,first.getString("id"))
            .getBoolean("complete"));
    }

    @Test public void changingSourceDuringCopyFailsWithoutPublishingArchive()throws Exception{
        LocalDatabase.write(home,noBackup,db("111,000000001").toString());
        File primary=new File(home,"projects.json");
        byte[] old=read(primary),newer=db("999,999999999").toString()
            .getBytes(StandardCharsets.UTF_8);
        AtomicInteger ticks=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(ticks.incrementAndGet()==3)
                    Files.write(primary.toPath(),newer);});
            fail("Modified original produced a complete copy");
        }catch(IOException expected){}
        assertEquals(0,completedCount());
        assertArrayEquals(newer,read(primary)); // changed ONLY by fault injection
        assertFalse(Arrays.equals(old,read(primary)));
    }

    @Test public void disappearingOriginalFailsInsteadOfInventingIt()throws Exception{
        LocalDatabase.write(home,noBackup,db("123,00001").toString());
        File media=new File(home,"media");assertTrue(media.mkdir());
        File original=new File(media,"original-photo");
        Files.write(original.toPath(),new byte[]{1,2,3,4,5});
        AtomicInteger ticks=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(ticks.incrementAndGet()==3)
                    Files.delete(original.toPath());});
            fail("Disappearing source was accepted");
        }catch(IOException expected){}
        assertEquals(0,completedCount());
        assertArrayEquals(db("123,00001").toString().getBytes(StandardCharsets.UTF_8),
            read(new File(home,"projects.json")));
    }

    @Test public void symlinkOutsideAppIsNeverCopiedAndTamperedArchiveCannotVerify()throws Exception{
        LocalDatabase.write(home,noBackup,db("1250,000001").toString());
        File dir=new File(home,"media");assertTrue(dir.mkdir());
        File secret=new File(root,"outside.txt");Files.write(secret.toPath(),new byte[]{8,7,6});
        File symlink=new File(dir,"linked-photo");
        try{Files.createSymbolicLink(symlink.toPath(),secret.toPath());}
        catch(IOException|UnsupportedOperationException|SecurityException unsupported){
            Assume.assumeNoException(unsupported);return;
        }
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Unsafe symlink copied to archive");}
        catch(IOException expected){}
        assertEquals(0,completedCount());
        assertArrayEquals(new byte[]{8,7,6},read(secret));
        assertTrue(symlink.delete());
        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        File archivedDb=new File(archive(copy),"payload/files/projects.json");
        Files.write(archivedDb.toPath(),"{\"tampered\":true}".getBytes(StandardCharsets.UTF_8));
        try{RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
            fail("Corrupted archived bytes passed verification");}
        catch(IOException expected){}
        assertEquals("1250,000001",new JSONObject(LocalDatabase.readForCas(home,noBackup))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void archivedMediaDirectorySymlinkToIdenticalLiveOriginalIsRejected()throws Exception{
        String exact="1585,800001234567890";
        LocalDatabase.write(home,noBackup,db(exact).toString());
        byte[] photo=new byte[]{0,1,2,3,5,8,13,21};
        media("original-photo",photo);
        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(RecoveryProtectionArchive.verify(noBackup,copy.getString("id"))
            .getBoolean("complete"));
        File archivedMedia=new File(archive(copy),"payload/files/media");
        File savedMedia=new File(root,"saved-archived-media");
        Files.move(archivedMedia.toPath(),savedMedia.toPath());
        try{Files.createSymbolicLink(archivedMedia.toPath(),new File(home,"media").toPath());}
        catch(IOException|UnsupportedOperationException|SecurityException unsupported){
            Assume.assumeNoException(unsupported);return;
        }
        // The leaf is regular and both size and SHA match: only the ancestor is unsafe.
        assertArrayEquals(photo,read(new File(archivedMedia,"original-photo")));
        assertEquals(PeerWire.hash(photo),PeerWire.hash(read(new File(archivedMedia,"original-photo"))));
        assertEquals(photo.length,Files.size(new File(archivedMedia,"original-photo").toPath()));
        try{RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
            fail("Archive referring to live original media was certified complete");}
        catch(IOException expected){}
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Unsafe existing archive was reused");}
        catch(IOException expected){}
        assertArrayEquals(photo,read(new File(home,"media/original-photo")));
        assertArrayEquals(photo,read(new File(savedMedia,"original-photo")));
        assertEquals(exact,new JSONObject(LocalDatabase.readForCas(home,noBackup))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void mediaDirectorySwappedToSymlinkDuringCopyIsNeverConfirmed()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        byte[] photo=new byte[]{3,1,4,1,5,9};
        media("original-photo",photo);
        // Probe symlink support before beginning fault injection.
        Path probe=new File(root,"link-probe").toPath();
        try{Files.createSymbolicLink(probe,new File(home,"media").toPath());}
        catch(IOException|UnsupportedOperationException|SecurityException unsupported){
            Assume.assumeNoException(unsupported);return;
        }
        Files.delete(probe);
        boolean[] swapped={false};
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,()->{
                File archiveRoot=new File(noBackup,"recovery-protection-v1");
                File[] stages=archiveRoot.listFiles((d,n)->n.startsWith(".staging-"));
                if(swapped[0]||stages==null)return;
                for(File stage:stages){
                    File media=new File(stage,"payload/files/media");
                    if(!new File(media,"original-photo").exists())continue;
                    Files.move(media.toPath(),new File(root,"interrupted-media").toPath());
                    Files.createSymbolicLink(media.toPath(),new File(home,"media").toPath());
                    swapped[0]=true;return;
                }
            });
            fail("Directory swap during copying was accepted");
        }catch(IOException expected){}
        assertTrue("Fault injection must run",swapped[0]);
        assertEquals(0,completedCount());
        assertArrayEquals(photo,read(new File(home,"media/original-photo")));
        File[] stages=new File(noBackup,"recovery-protection-v1")
            .listFiles((d,n)->n.startsWith(".staging-"));
        assertNotNull(stages);
        for(File stage:stages)assertFalse(new File(stage,"COMPLETE").exists());
    }

    /** Simulate Android's Unix provider without changing production code or source bytes. */
    MockedStatic<Files> androidAttributes(boolean missingKey,AtomicInteger reads){
        MockedStatic<Files> files=mockStatic(Files.class,CALLS_REAL_METHODS);
        files.when(()->Files.readAttributes(any(Path.class),eq(BasicFileAttributes.class),
            any(LinkOption[].class))).thenAnswer(call->{
                BasicFileAttributes actual=(BasicFileAttributes)call.callRealMethod();
                if(!actual.isDirectory())return actual;
                reads.incrementAndGet();
                return new BasicFileAttributes(){
                    public FileTime lastModifiedTime(){return actual.lastModifiedTime();}
                    public FileTime lastAccessTime(){return actual.lastAccessTime();}
                    public FileTime creationTime(){return actual.lastModifiedTime();}
                    public boolean isRegularFile(){return actual.isRegularFile();}
                    public boolean isDirectory(){return actual.isDirectory();}
                    public boolean isSymbolicLink(){return actual.isSymbolicLink();}
                    public boolean isOther(){return actual.isOther();}
                    public long size(){return actual.size();}
                    public Object fileKey(){return missingKey?null:actual.fileKey();}
                };
            });
        return files;
    }

    @Test public void androidCreationTimeFallbackAllowsExactArchiveVerifyAndReuse()throws Exception{
        String exact="1585,800001234567890";
        LocalDatabase.write(home,noBackup,db(exact).toString());
        byte[] primary=read(new File(home,"projects.json")),photo={0,1,2,3,5,8,13};
        media("original-photo",photo);
        AtomicInteger reads=new AtomicInteger();
        boolean[] changed={false};
        try(MockedStatic<Files> ignored=androidAttributes(false,reads)){
            JSONObject copy=RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,()->{
                File[] stages=new File(noBackup,"recovery-protection-v1")
                    .listFiles((d,n)->n.startsWith(".staging-"));
                if(changed[0]||stages==null)return;
                for(File stage:stages){
                    if(!new File(stage,"manifest.json").isFile())continue;
                    // This checkpoint runs after stageChain captured no_backup's identity.
                    BasicFileAttributes before=Files.readAttributes(noBackup.toPath(),
                        BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    Files.createDirectory(new File(noBackup,"unrelated-child").toPath());
                    // Force a distinct mtime even on filesystems with coarse timestamp resolution.
                    Files.setLastModifiedTime(noBackup.toPath(),
                        FileTime.fromMillis(before.lastModifiedTime().toMillis()+2000));
                    BasicFileAttributes after=Files.readAttributes(noBackup.toPath(),
                        BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                    assertEquals(before.fileKey(),after.fileKey());
                    assertEquals(after.lastModifiedTime(),after.creationTime());
                    assertNotEquals(before.creationTime(),after.creationTime());
                    changed[0]=true;
                }
            });
            assertTrue(changed[0]);assertTrue(reads.get()>0);
            assertTrue(copy.getBoolean("complete"));assertFalse(copy.getBoolean("reused"));
            assertTrue(RecoveryProtectionArchive.verify(noBackup,copy.getString("id"))
                .getBoolean("complete"));
            assertTrue(RecoveryProtectionArchive.create(home,noBackup).getBoolean("reused"));
            assertEquals(1,completedCount());
            assertArrayEquals(primary,read(new File(archive(copy),"payload/files/projects.json")));
            assertArrayEquals(photo,read(new File(archive(copy),"payload/files/media/original-photo")));
        }
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(photo,read(new File(home,"media/original-photo")));
        assertEquals(exact,new JSONObject(LocalDatabase.readForCas(home,noBackup))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void androidFallbackStillRejectsRealDirectoryReplacementDuringCopy()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        byte[] primary=read(new File(home,"projects.json")),photo={3,1,4,1,5,9};
        media("original-photo",photo);
        boolean[] swapped={false};
        try(MockedStatic<Files> ignored=androidAttributes(false,new AtomicInteger())){
            try{
                RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,()->{
                    File[] stages=new File(noBackup,"recovery-protection-v1")
                        .listFiles((d,n)->n.startsWith(".staging-"));
                    if(swapped[0]||stages==null)return;
                    for(File stage:stages){
                        Path media=new File(stage,"payload/files/media").toPath();
                        Path archivedPhoto=media.resolve("original-photo");
                        if(!Files.exists(archivedPhoto)||Files.size(archivedPhoto)!=photo.length)continue;
                        BasicFileAttributes before=Files.readAttributes(media,
                            BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                        Files.move(media,new File(root,"replaced-media").toPath());
                        Files.createDirectory(media);
                        Files.write(media.resolve("original-photo"),photo);
                        Files.setLastModifiedTime(media,before.lastModifiedTime());
                        BasicFileAttributes after=Files.readAttributes(media,
                            BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
                        assertNotEquals(before.fileKey(),after.fileKey());
                        assertEquals(before.creationTime(),after.creationTime());
                        swapped[0]=true;return;
                    }
                });
                fail("A different inode with identical bytes and timestamps was accepted");
            }catch(IOException expected){}
        }
        assertTrue("Fault injection must run",swapped[0]);
        assertEquals(0,completedCount());
        for(File stage:new File(noBackup,"recovery-protection-v1").listFiles())
            assertFalse(new File(stage,"COMPLETE").exists());
        assertArrayEquals(primary,read(new File(home,"projects.json")));
        assertArrayEquals(photo,read(new File(home,"media/original-photo")));
        assertArrayEquals(photo,read(new File(root,"replaced-media/original-photo")));
    }

    @Test public void androidFallbackWithoutFileKeyRemainsFailClosed()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        byte[] primary=read(new File(home,"projects.json"));
        AtomicInteger reads=new AtomicInteger();
        try(MockedStatic<Files> ignored=androidAttributes(true,reads)){
            try{RecoveryProtectionArchive.create(home,noBackup);
                fail("Unverifiable directory identity was accepted");}
            catch(IOException expected){}
        }
        assertTrue(reads.get()>0);assertEquals(0,completedCount());
        assertArrayEquals(primary,read(new File(home,"projects.json")));
    }

    @Test public void androidFallbackStillRejectsSymlinkAncestorOnVerifyAndReuse()throws Exception{
        try(MockedStatic<Files> ignored=androidAttributes(false,new AtomicInteger())){
            archivedMediaDirectorySymlinkToIdenticalLiveOriginalIsRejected();
        }
    }

    @Test public void androidFallbackStillRejectsSymlinkSwapDuringCopy()throws Exception{
        try(MockedStatic<Files> ignored=androidAttributes(false,new AtomicInteger())){
            mediaDirectorySwappedToSymlinkDuringCopyIsNeverConfirmed();
        }
    }

    @Test public void crashAfterAtomicArchiveRenameBeforeMarkerCanBeSafelyFinalized()throws Exception{
        LocalDatabase.write(home,noBackup,db("1585,800001234567890").toString());
        JSONObject completed=RecoveryProtectionArchive.create(home,noBackup);
        File copy=archive(completed);
        byte[] saved=read(new File(copy,"payload/files/projects.json"));
        // Test-only simulation of a process dying after publishing the directory
        // but before its durable COMPLETE marker was committed.
        assertTrue(new File(copy,"COMPLETE").delete());
        try{RecoveryProtectionArchive.verify(noBackup,completed.getString("id"));
            fail("Uncommitted directory appeared as complete");}
        catch(IOException expected){}
        JSONObject resumed=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(resumed.getBoolean("complete"));
        assertTrue(resumed.getBoolean("reused"));
        assertEquals(completed.getString("id"),resumed.getString("id"));
        assertEquals(1,completedCount());
        assertArrayEquals(saved,read(new File(copy,"payload/files/projects.json")));
        assertTrue(RecoveryProtectionArchive.verify(noBackup,resumed.getString("id"))
            .getBoolean("complete"));
    }

    @Test public void storageExhaustedMidWriteLeavesOnlyUncommittedStagingEvidence()throws Exception{
        LocalDatabase.write(home,noBackup,db("999,00000001").toString());
        File primary=new File(home,"projects.json");
        byte[] before=read(primary);
        AtomicInteger calls=new AtomicInteger();
        try{
            RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(calls.incrementAndGet()>=4)
                    throw new IOException("ENOSPC simulated while writing");});
            fail("Unverified partial stage was committed");
        }catch(IOException expected){}
        assertEquals(0,completedCount());
        File dir=new File(noBackup,"recovery-protection-v1");
        File[] staged=dir.listFiles((parent,name)->name.startsWith(".staging-"));
        assertNotNull(staged);assertTrue(staged.length>0);
        for(File partial:staged)assertFalse(new File(partial,"COMPLETE").exists());
        assertArrayEquals(before,read(primary));
        JSONObject resumed=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(resumed.getBoolean("complete"));
        assertEquals(1,completedCount());
    }
}
