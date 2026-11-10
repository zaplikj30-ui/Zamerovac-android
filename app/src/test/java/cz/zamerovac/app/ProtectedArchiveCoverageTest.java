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

/** P1-34-B: complete byte-exact recovery evidence, never automatic DB promotion. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class ProtectedArchiveCoverageTest {
    File root,home,noBackup;
    private static final String OLD_EXACT="{ \"schema\":1, \"records\":[{\"id\":\"photo\","
        +"\"items\":[{\"measure\":\"1585,800001234567890\","
        +"\"laserMeasuredMm\":\"1585.800001234567890\","
        +"\"history\":{\"undo\":[\"1250,123456789\"],\"redo\":[\"0,000000000001\"]}}]}]}";

    @Before public void setup()throws Exception{
        root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),
            "protected-archive-b-").toFile();
        home=new File(root,"files");noBackup=new File(root,"no_backup");
        assertTrue(home.mkdir());assertTrue(noBackup.mkdir());
    }
    byte[] bytes(File f)throws Exception{return Files.readAllBytes(f.toPath());}
    File originalHold()throws Exception{
        File dir=new File(home,"protected-revisions");File[] files=dir.listFiles();
        assertNotNull(files);
        for(File f:files){
            if(!f.getName().matches("[a-f0-9]{64}\\.json"))continue;
            JSONObject hold=new JSONObject(new String(bytes(f),StandardCharsets.UTF_8));
            if(OLD_EXACT.equals(hold.getString("metadata")))return f;
        }
        fail("Historical exact dimension no longer preserved in a P1 hold");return null;
    }
    void rotatedHistory()throws Exception{
        LocalDatabase.write(home,noBackup,OLD_EXACT);
        LocalDatabase.write(home,noBackup,dimension("newer-1"));
        LocalDatabase.write(home,noBackup,dimension("newer-2"));
        assertFalse(new String(bytes(new File(home,"projects.json")),StandardCharsets.UTF_8)
            .contains("1585,800001234567890"));
        assertFalse(new String(bytes(new File(home,"projects.bak")),StandardCharsets.UTF_8)
            .contains("1585,800001234567890"));
        assertTrue(originalHold().isFile());
    }
    String dimension(String value)throws Exception{
        return new JSONObject().put("schema",1).put("records",new JSONArray().put(
            new JSONObject().put("id","photo").put("items",new JSONArray().put(
                new JSONObject().put("measure",value))))).toString();
    }
    JSONObject entry(JSONObject result,String path)throws Exception{
        JSONArray files=result.getJSONArray("files");
        for(int i=0;i<files.length();i++){
            JSONObject f=files.getJSONObject(i);
            if(path.equals(f.getString("path")))return f;
        }
        fail("Recovery archive omitted "+path);return null;
    }
    File archive(JSONObject result){return new File(noBackup,
        "recovery-protection-v1/snapshot-"+result.optString("id"));}
    void noCompleteArchive(){
        File folder=new File(noBackup,"recovery-protection-v1");
        File[] archives=folder.listFiles((dir,name)->name.startsWith("snapshot-"));
        if(archives!=null)for(File f:archives)assertFalse(new File(f,"COMPLETE").exists());
    }

    @Test public void exactOldRevisionAndBothCatalogsSurviveRotationVerifyAndSeparateRecoveryCopy()
            throws Exception{
        rotatedHistory();
        File hold=originalHold();byte[] exactHold=bytes(hold);
        File primary=new File(home,"projects.json");byte[] newDb=bytes(primary);
        File local=new File(home,"protected-revisions/catalog.json");
        File witness=new File(noBackup,"protected-revisions.json");
        byte[] localBytes=bytes(local),witnessBytes=bytes(witness);
        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(copy.getBoolean("complete"));
        assertTrue("Old metadata and catalogs must be a complete P1 archive",
            copy.getBoolean("sourceComplete"));
        JSONObject verified=RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
        assertTrue(verified.getBoolean("sourceComplete"));
        String relative="files/protected-revisions/"+hold.getName();
        assertEquals(PeerWire.hash(exactHold),entry(verified,relative).getString("sha256"));
        assertArrayEquals(exactHold,bytes(new File(archive(copy),"payload/"+relative)));
        assertArrayEquals(localBytes,bytes(new File(archive(copy),
            "payload/files/protected-revisions/catalog.json")));
        assertArrayEquals(witnessBytes,bytes(new File(archive(copy),
            "payload/no_backup/protected-revisions.json")));
        // Recovery requires an explicit new copy, never promotion over the new DB.
        JSONObject preserved=new JSONObject(new String(bytes(
            new File(archive(copy),"payload/"+relative)),StandardCharsets.UTF_8));
        File separatelyRestored=new File(root,"review-old-revision.json");
        Files.write(separatelyRestored,preserved.getString("metadata")
            .getBytes(StandardCharsets.UTF_8));
        assertArrayEquals(OLD_EXACT.getBytes(StandardCharsets.UTF_8),
            bytes(separatelyRestored));
        assertArrayEquals(newDb,bytes(primary));
        assertArrayEquals(exactHold,bytes(hold));
    }

    @Test public void missingWitnessOrCorruptCatalogCannotClaimCompleteP1Archive()throws Exception{
        rotatedHistory();
        File witness=new File(noBackup,"protected-revisions.json");
        byte[] original=bytes(witness);
        assertTrue(witness.delete());
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Missing P1 witness was claimed complete");}
        catch(IOException expected){}
        noCompleteArchive();
        Files.write(witness.toPath(),original);
        File catalog=new File(home,"protected-revisions/catalog.json");
        Files.write(catalog.toPath(),"{broken catalog".getBytes(StandardCharsets.UTF_8));
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Corrupt P1 catalog was claimed complete");}
        catch(IOException expected){}
        noCompleteArchive();
    }

    @Test public void brokenOrMissingImmutableHoldMustNotBeCertified()throws Exception{
        rotatedHistory();File hold=originalHold();
        Files.write(hold.toPath(),"{broken protected revision".getBytes(StandardCharsets.UTF_8));
        try{RecoveryProtectionArchive.create(home,noBackup);
            fail("Damaged hash-addressed hold was accepted");}
        catch(IOException expected){}
        noCompleteArchive();
    }

    @Test public void unconfirmedAtomicSidecarsAreCopiedByteExactlyButNotSourceComplete()
            throws Exception{
        rotatedHistory();
        File dir=new File(home,"protected-revisions");
        byte[] pending="{partial proposed revision".getBytes(StandardCharsets.UTF_8);
        File sidecar=new File(dir,"catalog.json.new");
        Files.write(sidecar.toPath(),pending);
        JSONObject copy=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(copy.getBoolean("complete")); // verified bytes, NOT a complete source
        assertFalse(copy.getBoolean("sourceComplete"));
        JSONObject rechecked=RecoveryProtectionArchive.verify(noBackup,copy.getString("id"));
        assertFalse(rechecked.getBoolean("sourceComplete"));
        assertArrayEquals(pending,bytes(new File(archive(copy),
            "payload/files/protected-revisions/catalog.json.new")));
        assertArrayEquals(pending,bytes(sidecar));
        assertArrayEquals(OLD_EXACT.getBytes(StandardCharsets.UTF_8),
            new JSONObject(new String(bytes(new File(archive(copy),
                "payload/files/protected-revisions/"+originalHold().getName())),
                StandardCharsets.UTF_8)).getString("metadata").getBytes(StandardCharsets.UTF_8));
    }

    @Test public void interruptedProtectedArchiveLeavesNoCompleteMarkerAndCanRetry()
            throws Exception{
        rotatedHistory();byte[] oldHold=bytes(originalHold());
        AtomicInteger steps=new AtomicInteger();
        try{RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(steps.incrementAndGet()==4)
                    throw new InterruptedIOException("synthetic interruption");});
            fail("Interrupted archive was certified");}
        catch(InterruptedIOException expected){}
        noCompleteArchive();
        JSONObject retry=RecoveryProtectionArchive.create(home,noBackup);
        assertTrue(retry.getBoolean("sourceComplete"));
        assertArrayEquals(oldHold,bytes(new File(archive(retry),
            "payload/files/protected-revisions/"+originalHold().getName())));
    }

    @Test public void changedHoldDuringCopyCannotPublishCompleteArchive()throws Exception{
        rotatedHistory();File hold=originalHold();
        byte[] old=bytes(hold);byte[] primary=bytes(new File(home,"projects.json"));
        AtomicInteger steps=new AtomicInteger();
        try{RecoveryProtectionArchive.create(home,noBackup,dir->Long.MAX_VALUE,
                ()->{if(steps.incrementAndGet()==3)
                    Files.write(hold.toPath(),"{modified during copy}".getBytes(StandardCharsets.UTF_8));});
            fail("Mutated P1 evidence was certified");}
        catch(IOException expected){}
        assertFalse(Arrays.equals(old,bytes(hold)));
        noCompleteArchive();
        assertArrayEquals(primary,bytes(new File(home,"projects.json")));
    }
}
