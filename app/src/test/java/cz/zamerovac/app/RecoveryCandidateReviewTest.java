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
import static org.junit.Assert.*;

/** Stage 3A must only examine candidates; all mutation is test fixture setup. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class RecoveryCandidateReviewTest {
    File root,home,noBackup;
    final String exact="1585,800001234567890",older="1250,000000000000001";
    final byte[] photo={11,22,33,44,55,66,77,88,99};

    @Before public void setup()throws Exception{
        root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "stage3a-readonly-").toFile();
        home=new File(root,"files");noBackup=new File(root,"no_backup");
        assertTrue(home.mkdirs());assertTrue(noBackup.mkdirs());
    }
    JSONObject db(String measure,boolean withPhoto)throws Exception{
        JSONObject record=new JSONObject().put("id","photo-1").put("type","photo")
            .put("items",new JSONArray().put(new JSONObject().put("type","dimension")
                .put("measure",measure).put("unit","mm")));
        if(withPhoto)record.put("media",new JSONArray().put("original-photo"));
        return new JSONObject().put("schema",1).put("records",new JSONArray().put(record));
    }
    void saved(JSONObject document)throws Exception{
        LocalDatabase.write(home,noBackup,document.toString());
    }
    void media()throws Exception{
        File dir=new File(home,"media");if(!dir.exists())assertTrue(dir.mkdir());
        Files.write(new File(dir,"original-photo").toPath(),photo);
    }
    JSONObject row(JSONObject report,String path)throws Exception{
        JSONArray candidates=report.getJSONArray("candidates");
        for(int i=0;i<candidates.length();i++){
            JSONObject candidate=candidates.getJSONObject(i);
            if(path.equals(candidate.getString("path")))return candidate;
        }
        fail("Candidate missing: "+path);return null;
    }
    byte[] bytes(File file)throws Exception{return Files.readAllBytes(file.toPath());}
    SortedMap<String,byte[]> preserved()throws Exception{
        SortedMap<String,byte[]> seen=new TreeMap<>();
        try(java.util.stream.Stream<Path> paths=Files.walk(root.toPath())){
            for(Path path:(Iterable<Path>)paths::iterator)
                if(Files.isRegularFile(path,LinkOption.NOFOLLOW_LINKS))
                    seen.put(root.toPath().relativize(path).toString(),Files.readAllBytes(path));
                else if(Files.isDirectory(path,LinkOption.NOFOLLOW_LINKS))
                    seen.put(root.toPath().relativize(path).toString(),new byte[]{68});
                else if(Files.isSymbolicLink(path))
                    seen.put(root.toPath().relativize(path).toString(),
                        ("LINK:"+Files.readSymbolicLink(path)).getBytes(StandardCharsets.UTF_8));
        }
        return seen;
    }
    void identical(SortedMap<String,byte[]> before)throws Exception{
        SortedMap<String,byte[]> now=preserved();
        assertEquals("Stage3A created/deleted a persistent source",before.keySet(),now.keySet());
        for(String path:before.keySet())
            assertArrayEquals("Stage3A modified "+path,before.get(path),now.get(path));
    }
    void noPromotion(JSONObject result)throws Exception{
        assertTrue(result.getBoolean("readOnly"));
        assertFalse(result.getBoolean("safeToPromote"));
        assertFalse(result.getBoolean("coherentSnapshot"));
        assertEquals("cz.zamerovac.recovery.candidate-review",result.getString("format"));
    }

    @Test public void healthyCurrentCandidateWithExactMediaHistoryAndTombstonesIsOnlyChecked()throws Exception{
        saved(db(older,false));media();
        JSONObject current=db(exact,true);
        current.getJSONArray("records").getJSONObject(0)
            .put("history",new JSONObject().put("previous",new JSONObject()
                .put("media",new JSONArray().put("original-photo"))));
        current.put("trashPurgedIds",new JSONArray().put("already-purged"));
        current.put("syncTombstones",new JSONObject().put("already-purged",
            new JSONObject().put(UUID.randomUUID().toString(),1)));
        saved(current);
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        JSONObject primary=row(review,"files/projects.json");
        assertEquals("CHECKED_READ_ONLY",primary.getString("decision"));
        assertEquals(PeerWire.hash(before.get("files"+File.separator+"projects.json")),
            primary.getString("sha256"));
        assertEquals("BLOCKED",row(review,"files/projects.bak").getString("decision"));
        identical(before);
        assertEquals(exact,new JSONObject(new String(bytes(new File(home,"projects.json")),
            StandardCharsets.UTF_8)).getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
    }

    @Test public void missingOriginalMediaIsBlockedNotInvented()throws Exception{
        saved(db(exact,true));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
        assertFalse(new File(home,"media/original-photo").exists());
    }

    @Test public void verifiedExistingArchiveIsReadOnlyEvidenceNotPromotion()throws Exception{
        saved(db(older,false));media();saved(db(exact,true));
        JSONObject archive=RecoveryProtectionArchive.create(home,noBackup);
        String id=archive.getString("id");
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,id);
        noPromotion(review);
        assertEquals("VERIFIED_READ_ONLY",review.getJSONObject("archive").getString("status"));
        assertEquals("CHECKED_READ_ONLY",row(review,"files/projects.json").getString("decision"));
        assertFalse(review.getJSONObject("archive").getBoolean("canPromote"));
        identical(before);
    }

    @Test public void archivedOldDatabaseNeverCertifiesNewerMeasurements()throws Exception{
        saved(db(older,false));media();saved(db(older,true));
        JSONObject archive=RecoveryProtectionArchive.create(home,noBackup);
        saved(db(exact,true));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,archive.getString("id"));
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        assertEquals("BLOCKED",row(review,"files/projects.bak").getString("decision"));
        identical(before);
        assertEquals(exact,new JSONObject(LocalDatabase.readForCas(home,noBackup))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void sameSizeChangedMediaCannotUseOldArchive()throws Exception{
        saved(db(older,false));media();saved(db(exact,true));
        String id=RecoveryProtectionArchive.create(home,noBackup).getString("id");
        byte[] different=photo.clone();different[0]^=0x55;
        Files.write(new File(home,"media/original-photo").toPath(),different);
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,id);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
        assertArrayEquals(different,bytes(new File(home,"media/original-photo")));
    }

    @Test public void olderBackupCannotOverrideNewerDimensionAndTombstone()throws Exception{
        saved(db(older,false));media();saved(db(older,true));
        JSONObject newest=db(exact,true);
        newest.put("trashPurgedIds",new JSONArray().put("deleted-1"));
        newest.put("syncTombstones",new JSONObject().put("deleted-1",
            new JSONObject().put(UUID.randomUUID().toString(),42)));
        saved(newest);
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.bak").getString("decision"));
        assertEquals("CHECKED_READ_ONLY",row(review,"files/projects.json").getString("decision"));
        identical(before);
    }

    @Test public void damagedPrimaryCannotImplicitlyAuthorizeHealthyBackup()throws Exception{
        saved(db(older,false));saved(db(exact,false));
        Files.write(new File(home,"projects.json").toPath(),new byte[]{0});
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        assertEquals("BLOCKED",row(review,"files/projects.bak").getString("decision"));
        assertFalse("Read-only assessment cannot initialize recovery journal",
            DatabaseRecovery.pending(home));
        identical(before);
    }

    @Test public void malformedSchemaIsBlockedWithoutRepair()throws Exception{
        saved(db(exact,false));
        Files.write(new File(home,"projects.json").toPath(),
            "{\"schema\":999,\"records\":[]}".getBytes(StandardCharsets.UTF_8));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
    }

    @Test public void secondReadAndRestartDoNotChangeAnyEvidenceOrPeerQueue()throws Exception{
        saved(db(older,false));media();saved(db(exact,true));
        File queue=new File(noBackup,"sync-queue-v2.json");
        Files.write(queue.toPath(),"{\"version\":2,\"jobs\":[]}".getBytes(StandardCharsets.UTF_8));
        SortedMap<String,byte[]> before=preserved();
        JSONObject first=RecoveryCandidateReview.inspect(home,noBackup,null);
        JSONObject second=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(first);noPromotion(second);
        assertEquals("CHECKED_READ_ONLY",row(first,"files/projects.json").getString("decision"));
        assertEquals("CHECKED_READ_ONLY",row(second,"files/projects.json").getString("decision"));
        identical(before);
    }

    @Test public void sourceChangedDuringScanIsBlockedWithoutFurtherWrites()throws Exception{
        saved(db(exact,false));
        File primary=new File(home,"projects.json");
        byte[] changed=db("9999,00000000001",false).toString().getBytes(StandardCharsets.UTF_8);
        SortedMap<String,byte[]> before=preserved();
        final boolean[] injected={false};
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null,()->{
            injected[0]=true;Files.write(primary.toPath(),changed);
        });
        assertTrue(injected[0]);noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        assertArrayEquals(changed,bytes(primary));
        for(Map.Entry<String,byte[]> entry:before.entrySet()){
            if(entry.getKey().equals("files"+File.separator+"projects.json"))continue;
            assertArrayEquals(entry.getValue(),preserved().get(entry.getKey()));
        }
    }

    @Test public void sameSizeMediaModifiedDuringScanIsBlocked()throws Exception{
        saved(db(older,false));media();saved(db(exact,true));
        File original=new File(home,"media/original-photo");
        byte[] changed=photo.clone();changed[4]=(byte)(changed[4]+1);
        final boolean[] injected={false};
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null,()->{
            injected[0]=true;Files.write(original.toPath(),changed);
        });
        assertTrue(injected[0]);noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        assertArrayEquals(changed,bytes(original));
    }
    private JSONObject recoveryJournal(String epoch,boolean pending)throws Exception{
        return new JSONObject().put("version",1).put("epoch",epoch).put("recovering",pending);
    }
    private void writeJournal(String filename,JSONObject contents)throws Exception{
        Files.write(new File(home,filename).toPath(),
            contents.toString().getBytes(StandardCharsets.UTF_8));
    }

    @Test public void legacyJournalBakAloneMustRemainByteExactAndUnknown()throws Exception{
        saved(db(exact,false));
        // Fixture setup only: LocalDatabase.write may initialize the base journal.
        // To model a legacy .bak alone, remove it BEFORE the protected snapshot.
        Files.deleteIfExists(new File(home,"projects.recovery-v1.json").toPath());
        writeJournal("projects.recovery-v1.json.bak",
            recoveryJournal(UUID.randomUUID().toString(),true));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("UNKNOWN",review.getString("recoveryJournalStatus"));
        assertFalse(review.getBoolean("installationEvidenceVerified"));
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
        assertFalse(new File(home,"projects.recovery-v1.json").exists());
    }

    @Test public void journalBaseAndNewMustNotDiscardUnfinishedBytes()throws Exception{
        saved(db(exact,false));
        writeJournal("projects.recovery-v1.json",recoveryJournal("",false));
        writeJournal("projects.recovery-v1.json.new",
            recoveryJournal(UUID.randomUUID().toString(),true));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("UNKNOWN",review.getString("recoveryJournalStatus"));
        assertFalse(review.getBoolean("installationEvidenceVerified"));
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
        assertTrue(new File(home,"projects.recovery-v1.json.new").isFile());
    }

    @Test public void invalidJournalWithoutSideEffectsMustBeBlocked()throws Exception{
        saved(db(exact,false));
        Files.write(new File(home,"projects.recovery-v1.json").toPath(),new byte[]{1,2,3});
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("UNKNOWN",review.getString("recoveryJournalStatus"));
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
    }

    @Test public void validJournalReadsEpochWithoutMutatingAnyEvidence()throws Exception{
        saved(db(exact,false));
        String epoch=UUID.randomUUID().toString();
        writeJournal("projects.recovery-v1.json",recoveryJournal(epoch,true));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("VERIFIED_READ_ONLY",review.getString("recoveryJournalStatus"));
        assertEquals(epoch,review.getString("recoveryEpoch"));
        assertTrue(review.getBoolean("recoveryPending"));
        identical(before);
    }

    @Test public void byteIdenticalUnconfirmedTmpNeverReceivesCheckedReadOnly()throws Exception{
        saved(db(exact,false));
        for(String name:new String[]{"projects.tmp","projects.backup.tmp"})
            Files.copy(new File(home,"projects.json").toPath(),new File(home,name).toPath());
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("CHECKED_READ_ONLY",row(review,"files/projects.json").getString("decision"));
        for(String name:new String[]{"projects.tmp","projects.backup.tmp"}){
            JSONObject tmp=row(review,"files/"+name);
            assertEquals("BLOCKED",tmp.getString("decision"));
            assertTrue(tmp.optBoolean("unconfirmed"));
        }
        identical(before);
    }

    @Test public void olderHigherTombstoneClockBlocksLowerNewerValue()throws Exception{
        String device=UUID.randomUUID().toString();
        JSONObject old=db(older,false).put("syncTombstones",new JSONObject()
            .put("deleted-1",new JSONObject().put(device,42)));
        JSONObject current=db(exact,false).put("syncTombstones",new JSONObject()
            .put("deleted-1",new JSONObject().put(device,41)));
        saved(old);saved(current);
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("BLOCKED",row(review,"files/projects.json").getString("decision"));
        identical(before);
        assertEquals(exact,new JSONObject(new String(bytes(new File(home,"projects.json")),
            StandardCharsets.UTF_8)).getJSONArray("records").getJSONObject(0)
            .getJSONArray("items").getJSONObject(0).getString("measure"));
    }

    @Test public void newerDominatingTombstoneClockStillAllowsReadOnlyCheck()throws Exception{
        String device=UUID.randomUUID().toString();
        saved(db(older,false).put("syncTombstones",new JSONObject()
            .put("deleted-1",new JSONObject().put(device,41))));
        saved(db(exact,false).put("syncTombstones",new JSONObject()
            .put("deleted-1",new JSONObject().put(device,42))));
        SortedMap<String,byte[]> before=preserved();
        JSONObject review=RecoveryCandidateReview.inspect(home,noBackup,null);
        noPromotion(review);
        assertEquals("CHECKED_READ_ONLY",row(review,"files/projects.json").getString("decision"));
        identical(before);
    }

}
