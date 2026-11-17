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

/** Read-only B16 diagnostics: inventory is NOT an authorization to restore. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class RecoveryInventoryTest {
    File home,noBackup;
    @Before public void setup()throws Exception{
        File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "recovery-inventory-").toFile();
        home=new File(root,"files");
        noBackup=new File(root,"no_backup");
        assertTrue(home.mkdirs());assertTrue(noBackup.mkdirs());
    }
    JSONObject db(String value)throws Exception{
        return new JSONObject().put("schema",1).put("records",new JSONArray()
            .put(new JSONObject().put("id","text-only").put("items",new JSONArray()
                .put(new JSONObject().put("measure",value)))));
    }
    JSONObject find(JSONArray array,String path)throws Exception{
        for(int i=0;i<array.length();i++){
            JSONObject row=array.getJSONObject(i);
            if(path.equals(row.getString("path")))return row;
        }
        fail("Missing inventory row "+path);return null;
    }
    byte[] bytes(File file)throws Exception{return Files.readAllBytes(file.toPath());}
    void photo(String id,byte[] original)throws Exception{
        File dir=new File(home,"media");
        if(!dir.exists())assertTrue(dir.mkdir());
        Files.write(new File(dir,id).toPath(),original);
    }

    @Test public void validPrimaryBackupDeletedRecordsHistoryAndExactMediaAreReadOnly()throws Exception{
        String old="1250,00000000001",precise="1585,800001234567890";
        LocalDatabase.write(home,noBackup,db(old).toString());
        byte[] original=new byte[]{1,3,5,8,13,21,34,55,89};
        photo("original-photo",original);photo("trashed-photo",new byte[]{9,8,7});
        photo("history-photo",new byte[]{6,5,4});
        JSONObject live=db(precise);
        JSONObject record=live.getJSONArray("records").getJSONObject(0);
        record.put("media",new JSONArray().put("original-photo"));
        record.put("history",new JSONObject().put("previous",
            new JSONObject().put("media",new JSONArray().put("history-photo"))));
        live.getJSONArray("records").put(new JSONObject().put("id","deleted-record")
            .put("deleted",true).put("media",new JSONArray().put("trashed-photo")));
        live.put("trashPurgedIds",new JSONArray().put("already-purged"));
        live.put("syncTombstones",new JSONObject().put("already-purged",
            new JSONObject().put(UUID.randomUUID().toString(),1)));
        LocalDatabase.write(home,noBackup,live.toString());
        File primary=new File(home,"projects.json");
        File backup=new File(home,"projects.bak");
        File journal=new File(home,"projects.recovery-v1.json");
        byte[] primaryBefore=bytes(primary),backupBefore=bytes(backup),journalBefore=bytes(journal);
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        assertTrue(report.getBoolean("readOnly"));
        assertFalse(report.getBoolean("safeToPromote"));
        assertFalse(report.getBoolean("coherentSnapshot"));
        assertEquals("IN_MEMORY_NOT_RECOVERABLE_FROM_FILES",report.getString("undoRedo"));
        JSONObject current=find(report.getJSONArray("candidates"),"files/projects.json");
        assertEquals("VALID",current.getString("state"));
        assertEquals(PeerWire.hash(primaryBefore),current.getString("sha256"));
        assertEquals(primaryBefore.length,current.getLong("size"));
        assertEquals(2,current.getInt("records"));
        assertEquals(1,current.getInt("deletedRecords"));
        assertEquals(1,current.getInt("embeddedHistoryRecords"));
        assertEquals(1,current.getInt("purgedRecordIds"));
        assertEquals(1,current.getInt("syncTombstones"));
        assertEquals(3,current.getJSONArray("mediaReferences").length());
        assertEquals(0,current.getInt("missingMedia"));
        JSONObject previous=find(report.getJSONArray("candidates"),"files/projects.bak");
        assertEquals("VALID",previous.getString("state"));
        assertEquals(PeerWire.hash(backupBefore),previous.getString("sha256"));
        assertEquals(3,report.getJSONArray("media").length());
        JSONObject originalRow=find(report.getJSONArray("media"),"files/media/original-photo");
        assertEquals("PRESENT",originalRow.getString("state"));
        assertEquals(PeerWire.hash(original),originalRow.getString("sha256"));
        assertTrue(originalRow.getBoolean("referenced"));
        assertArrayEquals(primaryBefore,bytes(primary));
        assertArrayEquals(backupBefore,bytes(backup));
        assertArrayEquals(journalBefore,bytes(journal));
        assertArrayEquals(original,bytes(new File(home,"media/original-photo")));
        assertEquals(precise,new JSONObject(new String(bytes(primary),StandardCharsets.UTF_8))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void corruptedPrimaryIsFlaggedWhileOldBackupIsNeverPromoted()throws Exception{
        String old="1111,00000001",newer="2222,00000002";
        LocalDatabase.write(home,noBackup,db(old).toString());
        LocalDatabase.write(home,noBackup,db(newer).toString());
        File primary=new File(home,"projects.json"),backup=new File(home,"projects.bak");
        byte[] broken="{broken".getBytes(StandardCharsets.UTF_8);
        Files.write(primary.toPath(),broken);
        byte[] backupBefore=bytes(backup);
        File journal=new File(home,"projects.recovery-v1.json");
        byte[] journalBefore=bytes(journal);
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        assertEquals("CORRUPT",find(report.getJSONArray("candidates"),"files/projects.json")
            .getString("state"));
        JSONObject older=find(report.getJSONArray("candidates"),"files/projects.bak");
        assertEquals("VALID",older.getString("state"));
        assertEquals(PeerWire.hash(backupBefore),older.getString("sha256"));
        assertFalse(report.getBoolean("safeToPromote"));
        assertArrayEquals(broken,bytes(primary));
        assertArrayEquals(backupBefore,bytes(backup));
        assertArrayEquals(journalBefore,bytes(journal));
        assertEquals("",DatabaseRecovery.id(home));
    }

    @Test public void missingReferencedPhotoIsIncompleteNotAValidRestorableSnapshot()throws Exception{
        JSONObject data=db("1585,800001234567890");
        data.getJSONArray("records").getJSONObject(0)
            .put("media",new JSONArray().put("missing-original"));
        File primary=new File(home,"projects.json");
        Files.write(primary.toPath(),data.toString().getBytes(StandardCharsets.UTF_8));
        byte[] before=bytes(primary);
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        JSONObject candidate=find(report.getJSONArray("candidates"),"files/projects.json");
        assertEquals("INCOMPLETE",candidate.getString("state"));
        assertEquals(1,candidate.getInt("missingMedia"));
        assertFalse(candidate.getBoolean("complete"));
        assertEquals("MISSING_OR_UNSAFE",find(report.getJSONArray("media"),
            "files/media/missing-original").getString("state"));
        assertFalse(report.getBoolean("safeToPromote"));
        assertArrayEquals(before,bytes(primary));
        assertFalse(new File(home,"media").exists());
        assertFalse(new File(home,"projects.recovery-v1.json").exists());
    }

    @Test public void textOnlyProjectsDoNotRequireInventedMediaOrLostUndoHistory()throws Exception{
        String exact="0,0000000000000007";
        LocalDatabase.write(home,noBackup,db(exact).toString());
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        JSONObject current=find(report.getJSONArray("candidates"),"files/projects.json");
        assertEquals("VALID",current.getString("state"));
        assertTrue(current.getBoolean("complete"));
        assertEquals(0,current.getJSONArray("mediaReferences").length());
        assertEquals(0,report.getJSONArray("media").length());
        assertEquals("IN_MEMORY_NOT_RECOVERABLE_FROM_FILES",report.getString("undoRedo"));
        assertEquals("NOT_SCANNED_PROVIDER",report.getString("externalBackupHistory"));
        assertFalse(report.getBoolean("safeToPromote"));
        assertEquals(exact,new JSONObject(LocalDatabase.readForCas(home,noBackup))
            .getJSONArray("records").getJSONObject(0).getJSONArray("items")
            .getJSONObject(0).getString("measure"));
    }

    @Test public void orphanedOriginalMediaAreListedWithoutCreatingAnyDatabase()throws Exception{
        byte[] photo=new byte[]{44,55,66,77,88};
        photo("orphan-original",photo);
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        assertEquals("MISSING",find(report.getJSONArray("candidates"),
            "files/projects.json").getString("state"));
        assertEquals(0,report.getInt("validatedCandidateFiles"));
        JSONObject item=find(report.getJSONArray("media"),"files/media/orphan-original");
        assertEquals("PRESENT",item.getString("state"));
        assertFalse(item.getBoolean("referenced"));
        assertEquals(PeerWire.hash(photo),item.getString("sha256"));
        assertArrayEquals(photo,bytes(new File(home,"media/orphan-original")));
        assertFalse(new File(home,"projects.json").exists());
        assertFalse(new File(home,"projects.recovery-v1.json").exists());
    }

    @Test public void malformedJournalAndPendingTrashAreReportedWithoutRepair()throws Exception{
        LocalDatabase.write(home,noBackup,db("1,00000001").toString());
        File journal=new File(home,"projects.recovery-v1.json");
        Files.write(journal.toPath(),"{}".getBytes(StandardCharsets.UTF_8));
        File pending=new File(home,"trash-cleanup.json");
        byte[] cleanup=new JSONArray().put("old-photo").put("other-photo")
            .toString().getBytes(StandardCharsets.UTF_8);
        Files.write(pending.toPath(),cleanup);
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        assertEquals("CORRUPT",find(report.getJSONArray("evidence"),
            "files/projects.recovery-v1.json").getString("state"));
        JSONObject trash=find(report.getJSONArray("evidence"),"files/trash-cleanup.json");
        assertEquals("PRESENT",trash.getString("state"));
        assertEquals(2,trash.getInt("pendingTrashMedia"));
        assertEquals(PeerWire.hash(cleanup),trash.getString("sha256"));
        assertArrayEquals("{}".getBytes(StandardCharsets.UTF_8),bytes(journal));
        assertArrayEquals(cleanup,bytes(pending));
        assertFalse(report.getBoolean("safeToPromote"));
    }

    @Test public void symlinkCannotEscapePrivateMediaDirectory()throws Exception{
        JSONObject data=db("123,4");
        data.getJSONArray("records").getJSONObject(0)
            .put("media",new JSONArray().put("linked-photo"));
        File primary=new File(home,"projects.json");
        Files.write(primary.toPath(),data.toString().getBytes(StandardCharsets.UTF_8));
        File target=new File(home.getParentFile(),"outside-secret");
        byte[] privateBytes=new byte[]{1,2,3,4,5};
        Files.write(target.toPath(),privateBytes);
        File dir=new File(home,"media");assertTrue(dir.mkdir());
        File link=new File(dir,"linked-photo");
        try{Files.createSymbolicLink(link.toPath(),target.toPath());}
        catch(UnsupportedOperationException|IOException|SecurityException unsupported){
            Assume.assumeNoException(unsupported);return;
        }
        JSONObject report=RecoveryInventory.inspect(home,noBackup);
        assertEquals("UNSAFE",find(report.getJSONArray("media"),
            "files/media/linked-photo").getString("state"));
        assertEquals("INCOMPLETE",find(report.getJSONArray("candidates"),
            "files/projects.json").getString("state"));
        assertArrayEquals(privateBytes,bytes(target));
    }
}
