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
        project.getJSONArray("records").getJSONObject(0)
            .put("media",new JSONArray().put("marker-photo"));
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
