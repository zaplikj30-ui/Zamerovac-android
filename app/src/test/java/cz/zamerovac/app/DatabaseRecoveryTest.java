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

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DatabaseRecoveryTest {
    File home;
    @Before public void setup()throws Exception{home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"db-recovery-").toFile();}
    String data(String value)throws Exception{return new JSONObject().put("schema",1).put("records",new JSONArray().put(new JSONObject().put("id","synthetic").put("measure",value))).toString();}
    void corrupt()throws Exception{Files.write(new File(home,"projects.json").toPath(),"synthetic corrupt primary".getBytes(StandardCharsets.UTF_8));}
    @Test public void fallbackRotatesDurablyOnceAndNeverOverwritesEitherOriginal()throws Exception{
        String old=data("123,000000123456"),fresh=data("999,0000001");LocalDatabase.write(home,old);LocalDatabase.write(home,fresh);assertEquals("",LocalDatabase.recoveryId(home));long before=LocalDatabase.generation(home);corrupt();byte[] damaged=Files.readAllBytes(new File(home,"projects.json").toPath());
        assertEquals(old,LocalDatabase.read(home));String epoch=LocalDatabase.recoveryId(home);assertTrue(DeviceIdentity.valid(epoch));assertEquals(before+1,LocalDatabase.generation(home));assertEquals(epoch,LocalDatabase.recoveryId(home));assertEquals(epoch,DatabaseRecovery.id(home));assertArrayEquals(damaged,Files.readAllBytes(new File(home,"projects.json").toPath()));assertEquals(old,LocalDatabase.readFile(new File(home,"projects.bak")));
        LocalDatabase.write(home,fresh);assertEquals(epoch,LocalDatabase.recoveryId(home));corrupt();assertEquals(old,LocalDatabase.read(home));assertNotEquals(epoch,LocalDatabase.recoveryId(home));
    }
    @Test public void orphanOriginalNeverAuthorizesImplicitFreshDatabase()throws Exception{
        File media=new File(home,"media");assertTrue(media.mkdir());
        File original=new File(media,"original-photo");
        byte[] untouched=new byte[]{17,23,42,99};Files.write(original.toPath(),untouched);
        // Loss of projects.json AND its recovery journal is indistinguishable
        // from a pre-database media stage; reject both rather than erase data.
        assertFalse(new File(home,"projects.json").exists());
        try{LocalDatabase.write(home,data("0,000000000001"));fail("Media-only state was reset as a new install");}
        catch(IOException expected){}
        assertFalse(new File(home,"projects.json").exists());
        assertFalse(DatabaseRecovery.exists(home));
        assertArrayEquals(untouched,Files.readAllBytes(original.toPath()));
        assertTrue(original.delete());assertTrue(media.delete());
        // A file (not a directory) at the media path must also fail closed.
        Files.write(media.toPath(),new byte[]{5,6,7});
        try{LocalDatabase.write(home,data("42,0001"));fail("Blocked media path treated as an empty directory");}
        catch(IOException expected){}
        assertArrayEquals(new byte[]{5,6,7},Files.readAllBytes(media.toPath()));
        assertFalse(new File(home,"projects.json").exists());
        assertTrue(media.delete());
        // A truly clean first launch must still create an initialized database.
        File clean=Files.createTempDirectory(home.toPath(),"clean-install-").toFile();
        // MainActivity creates an empty media directory before the first save.
        File photoDir=new File(clean,"media");assertTrue(photoDir.mkdir());
        String initial=data("1585,800001234567890");
        LocalDatabase.write(clean,initial);assertEquals(initial,LocalDatabase.readForCas(clean));
        assertTrue(DatabaseRecovery.exists(clean));
        File photo=new File(photoDir,"original-photo");
        Files.write(photo.toPath(),untouched);
        assertTrue(new File(clean,"projects.json").delete());
        assertTrue(new File(clean,"projects.recovery-v1.json").delete());
        assertFalse(new File(clean,"projects.bak").exists());
        try{LocalDatabase.write(clean,data("999,000001"));fail("Lost initialized DB silently replaced");}
        catch(IOException expected){}
        assertFalse(new File(clean,"projects.json").exists());
        assertArrayEquals(untouched,Files.readAllBytes(photo.toPath()));
    }
    @Test public void failedRecoveryJournalCannotReturnOlderDataAsConfirmed()throws Exception{
        LocalDatabase.write(home,data("1,000001"));LocalDatabase.write(home,data("2,000002"));corrupt();File blocker=new File(home,"projects.recovery-v1.json.new");assertTrue(blocker.mkdir());Files.write(new File(blocker,"block").toPath(),new byte[]{1});
        try{LocalDatabase.read(home);fail("Fallback without durable invalidation accepted");}catch(IOException expected){}assertEquals("",DatabaseRecovery.id(home));assertEquals(data("1,000001"),LocalDatabase.readFile(new File(home,"projects.bak")));assertTrue(new File(blocker,"block").delete());assertTrue(blocker.delete());assertEquals(data("1,000001"),LocalDatabase.read(home));assertTrue(DeviceIdentity.valid(LocalDatabase.recoveryId(home)));
    }
    @Test public void deletedDatabaseInvalidatesReceiptsAndMalformedJournalFailsClosed()throws Exception{
        LocalDatabase.write(home,data("1585,800001"));assertTrue(new File(home,"projects.json").delete());assertEquals("",LocalDatabase.read(home));String epoch=LocalDatabase.recoveryId(home);assertTrue(DeviceIdentity.valid(epoch));assertEquals(epoch,LocalDatabase.recoveryId(home));
        LocalDatabase.write(home,data("0,000000001"));Files.write(new File(home,"projects.recovery-v1.json").toPath(),"{}".getBytes(StandardCharsets.UTF_8));try{LocalDatabase.read(home);fail("Malformed recovery state ignored");}catch(IOException expected){}assertEquals(data("0,000000001"),LocalDatabase.readFile(new File(home,"projects.json")));
    }
    @Test public void partialAndCompleteUnconfirmedTemporaryFilesNeverReplaceConfirmedDatabaseOnRead()throws Exception{
        String older=data("123,000000001"),confirmed=data("1585,800000123456789"),unconfirmed=data("999,999999999999999");LocalDatabase.write(home,older);LocalDatabase.write(home,confirmed);
        for(String temporary:new String[]{"{partial",unconfirmed}){Files.write(new File(home,"projects.tmp").toPath(),temporary.getBytes(StandardCharsets.UTF_8));Files.write(new File(home,"projects.backup.tmp").toPath(),"{partial-backup".getBytes(StandardCharsets.UTF_8));assertEquals(confirmed,LocalDatabase.read(home));assertEquals(older,LocalDatabase.readFile(new File(home,"projects.bak")));assertEquals(temporary,new String(Files.readAllBytes(new File(home,"projects.tmp").toPath()),StandardCharsets.UTF_8));}
        LocalDatabase.write(home,unconfirmed);assertEquals(unconfirmed,LocalDatabase.read(home));assertEquals(confirmed,LocalDatabase.readFile(new File(home,"projects.bak")));assertFalse(new File(home,"projects.tmp").exists());assertFalse(new File(home,"projects.backup.tmp").exists());
    }
    @Test public void restartResidueAfterBackupPublicationKeepsPrimaryAndFallbackDoesNotPromotePendingData()throws Exception{
        String confirmed=data("1585,800000000123456789"),pending=data("999,000000001");LocalDatabase.write(home,confirmed);Files.write(new File(home,"projects.bak").toPath(),confirmed.getBytes(StandardCharsets.UTF_8));Files.write(new File(home,"projects.tmp").toPath(),pending.getBytes(StandardCharsets.UTF_8));assertEquals(confirmed,LocalDatabase.read(home));assertTrue(new File(home,"projects.json").delete());assertEquals(confirmed,LocalDatabase.read(home));String epoch=LocalDatabase.recoveryId(home);assertTrue(DeviceIdentity.valid(epoch));assertEquals(confirmed,LocalDatabase.readFile(new File(home,"projects.bak")));assertEquals(pending,new String(Files.readAllBytes(new File(home,"projects.tmp").toPath()),StandardCharsets.UTF_8));assertEquals(epoch,LocalDatabase.recoveryId(home));
    }
    @Test public void failedDatabaseStagingPreservesConfirmedPrimaryAndRecoveryCopy()throws Exception{
        String older=data("123,000000001"),confirmed=data("1585,800000123456789");LocalDatabase.write(home,older);LocalDatabase.write(home,confirmed);File blocked=new File(home,"projects.tmp");assertTrue(blocked.mkdir());Files.write(new File(blocked,"block").toPath(),new byte[]{1});try{LocalDatabase.write(home,data("999,000000001"));fail("Unconfirmed DB staging accepted");}catch(IOException expected){}assertEquals(confirmed,LocalDatabase.read(home));assertEquals(older,LocalDatabase.readFile(new File(home,"projects.bak")));assertTrue(new File(blocked,"block").exists());
    }

}
