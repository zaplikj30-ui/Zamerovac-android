package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
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
