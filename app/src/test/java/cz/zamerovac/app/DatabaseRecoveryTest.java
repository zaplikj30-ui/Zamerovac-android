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
        for(String temporary:new String[]{"{partial",unconfirmed}){Files.write(new File(home,"projects.tmp").toPath(),temporary.getBytes(StandardCharsets.UTF_8));Files.write(new File(home,"projects.backup.tmp").toPath(),"{partial-backup".getBytes(StandardCharsets.UTF_8));assertEquals(confirmed,LocalDatabase.read(home));assertEquals(older,LocalDatabase.readFile(new File(home,"projects.bak")));assertEquals(temporary,Files.readString(new File(home,"projects.tmp").toPath()));}
        LocalDatabase.write(home,unconfirmed);assertEquals(unconfirmed,LocalDatabase.read(home));assertEquals(confirmed,LocalDatabase.readFile(new File(home,"projects.bak")));assertFalse(new File(home,"projects.tmp").exists());assertFalse(new File(home,"projects.backup.tmp").exists());
    }
    @Test public void restartResidueAfterBackupPublicationKeepsPrimaryAndFallbackDoesNotPromotePendingData()throws Exception{
        String confirmed=data("1585,800000000123456789"),pending=data("999,000000001");LocalDatabase.write(home,confirmed);Files.write(new File(home,"projects.bak").toPath(),confirmed.getBytes(StandardCharsets.UTF_8));Files.write(new File(home,"projects.tmp").toPath(),pending.getBytes(StandardCharsets.UTF_8));assertEquals(confirmed,LocalDatabase.read(home));assertTrue(new File(home,"projects.json").delete());assertEquals(confirmed,LocalDatabase.read(home));String epoch=LocalDatabase.recoveryId(home);assertTrue(DeviceIdentity.valid(epoch));assertEquals(confirmed,LocalDatabase.readFile(new File(home,"projects.bak")));assertEquals(pending,Files.readString(new File(home,"projects.tmp").toPath()));assertEquals(epoch,LocalDatabase.recoveryId(home));
    }
    @Test public void failedDatabaseStagingPreservesConfirmedPrimaryAndRecoveryCopy()throws Exception{
        String older=data("123,000000001"),confirmed=data("1585,800000123456789");LocalDatabase.write(home,older);LocalDatabase.write(home,confirmed);File blocked=new File(home,"projects.tmp");assertTrue(blocked.mkdir());Files.write(new File(blocked,"block").toPath(),new byte[]{1});try{LocalDatabase.write(home,data("999,000000001"));fail("Unconfirmed DB staging accepted");}catch(IOException expected){}assertEquals(confirmed,LocalDatabase.read(home));assertEquals(older,LocalDatabase.readFile(new File(home,"projects.bak")));assertTrue(new File(blocked,"block").exists());
    }

}
