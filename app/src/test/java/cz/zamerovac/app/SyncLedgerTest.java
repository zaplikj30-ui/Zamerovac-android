package cz.zamerovac.app;

import android.content.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.util.*;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class SyncLedgerTest {
    File home;
    static void writeText(Path path,String text)throws IOException{Files.write(path,text.getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    static String readText(Path path)throws IOException{return new String(Files.readAllBytes(path),java.nio.charset.StandardCharsets.UTF_8);}
    @Before public void setup()throws Exception {home=Files.createTempDirectory(RuntimeEnvironment.getApplication().getFilesDir().toPath(),"ledger-").toFile();}
    @Test public void copyVerifyCutoverPreservesLegacyBytesAndCasSurvivesRestart()throws Exception{
        String legacy="{ \"version\":2, \"revision\":7, \"jobs\":[] }";
        File source=new File(home,"sync-queue-v2.json");writeText(source.toPath(),legacy);
        SyncQueueStore queue=new SyncQueueStore(home);assertEquals(legacy,queue.read());
        String next="{\"version\":2,\"revision\":8,\"jobs\":[]}";assertTrue(queue.save(7,next));assertFalse(queue.save(7,next));
        assertEquals(next,new SyncQueueStore(home).read());assertEquals(legacy,readText(source.toPath()));
    }
    @Test public void everyMigrationCrashIsRestartableWithoutPromotingOldQueue()throws Exception{
        for(String point:new String[]{"witness-prepared","legacy-copied","before-cutover","after-cutover","before-active-witness"}){
            File directory=new File(home,point);directory.mkdirs();File source=new File(directory,"sync-queue-v2.json");writeText(source.toPath(),SyncLedger.EMPTY_QUEUE);
            try(SyncLedger ignored=SyncLedger.open(directory,at->{if(at.equals(point))throw new IOException("synthetic crash "+point);})){fail("Fault not reached");}catch(IOException expected){assertTrue(expected.getMessage().contains("synthetic crash"));}
            try(SyncLedger ledger=SyncLedger.open(directory)){assertEquals(SyncLedger.EMPTY_QUEUE,ledger.queue());assertTrue(ledger.saveQueue(0,"{\"version\":2,\"revision\":1,\"jobs\":[]}"));}
            try(SyncLedger ledger=SyncLedger.open(directory)){assertEquals(1,new JSONObject(ledger.queue()).getInt("revision"));}
            assertEquals(SyncLedger.EMPTY_QUEUE,readText(source.toPath()));
        }
    }
    @Test public void shortWriteOrEnospcRollsBackOnlyLedgerTransaction()throws Exception{
        for(String point:new String[]{"before-queue-write","after-queue-write"}){
            try(SyncLedger ledger=SyncLedger.open(home,at->{if(at.equals(point))throw new IOException("synthetic ENOSPC");})){
                try{ledger.saveQueue(0,"{\"version\":2,\"revision\":1,\"jobs\":[]}");fail();}catch(IOException expected){}
            }
            try(SyncLedger ledger=SyncLedger.open(home)){assertEquals(SyncLedger.EMPTY_QUEUE,ledger.queue());}
        }
    }
    @Test public void databaseLossNeverReimportsOlderJsonOrResetsEvidence()throws Exception{
        File source=new File(home,"sync-queue-v2.json");writeText(source.toPath(),SyncLedger.EMPTY_QUEUE);
        try(SyncLedger ledger=SyncLedger.open(home)){assertTrue(ledger.saveQueue(0,"{\"version\":2,\"revision\":1,\"jobs\":[]}"));}
        File database=new File(home,"sync-ledger-v1.sqlite");byte[] saved=Files.readAllBytes(database.toPath());Files.delete(database.toPath());
        try(SyncLedger ignored=SyncLedger.open(home)){fail("Lost authority was reset");}catch(IOException expected){}
        assertFalse(database.exists());assertEquals(SyncLedger.EMPTY_QUEUE,readText(source.toPath()));Files.write(database.toPath(),saved);
        try(SyncLedger ledger=SyncLedger.open(home)){assertEquals(1,new JSONObject(ledger.queue()).getInt("revision"));}
    }
    @Test public void corruptLedgerIsKeptForRecoveryAndCannotReadOldJson()throws Exception{
        try(SyncLedger ignored=SyncLedger.open(home)){}
        File database=new File(home,"sync-ledger-v1.sqlite");byte[] corrupt={1,3,7,9,0};Files.write(database.toPath(),corrupt);
        try(SyncLedger ignored=SyncLedger.open(home)){fail();}catch(Exception expected){}
        assertArrayEquals(corrupt,Files.readAllBytes(database.toPath()));
    }
    @Test public void independentTargetsNeverInheritReceiptsOrExportSessions()throws Exception{
        Context context=RuntimeEnvironment.getApplication();LocalDatabase.write(context,"{\"schema\":1,\"records\":[]}");
        PeerSnapshot snapshot=PeerSnapshot.capture(context,context.getSharedPreferences("ledger",0));
        try(SyncLedger ledger=SyncLedger.open(home)){
            String one=ledger.target("drive","account-one","peer"),two=ledger.target("drive","account-two","peer"),tls=ledger.target("tls","paired-device","peer");
            for(String target:new String[]{one,two,tls})ledger.prepare(target,snapshot);
            ledger.state(one,snapshot.hash,"transport-ack","signed receipt");assertEquals("waiting",ledger.state(two,snapshot.hash));assertEquals("waiting",ledger.state(tls,snapshot.hash));
            String id=PeerWire.hash(new byte[]{1});ledger.transfer(id,one,snapshot.hash,123,"https://www.googleapis.com/upload/drive/v3/files?upload_id=secret-session",0);
            assertFalse(ledger.portable().toString().contains("secret-session"));
        }
        try(SyncLedger ledger=SyncLedger.open(home)){assertEquals(123,ledger.transfer(PeerWire.hash(new byte[]{1})).getLong("size"));}
    }
    @Test public void backupAndNewSidecarsArePreservedWithoutReadSideRename()throws Exception{
        File base=new File(home,"sync-queue-v2.json"),bak=new File(base+".bak"),pending=new File(base+".new");
        writeText(base.toPath(),"{\"version\":2,\"revision\":1,\"jobs\":[]}");writeText(bak.toPath(),SyncLedger.EMPTY_QUEUE);writeText(pending.toPath(),"partial");
        try(SyncLedger ledger=SyncLedger.open(home)){assertEquals(SyncLedger.EMPTY_QUEUE,ledger.queue());}
        assertEquals("partial",readText(pending.toPath()));assertEquals(SyncLedger.EMPTY_QUEUE,readText(bak.toPath()));assertTrue(base.exists());
    }
}
