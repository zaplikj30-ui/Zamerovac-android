package cz.zamerovac.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;
import java.io.*;
import java.util.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class GuardedSyncStoreTest {
 @Test public void cancelledRouteStopsNextChunkButAlwaysClosesOwnedResources()throws Exception{
  AtomicBoolean allowed=new AtomicBoolean(true),readClosed=new AtomicBoolean(),writeClosed=new AtomicBoolean();AtomicInteger listed=new AtomicInteger();ByteArrayInputStream bytes=new ByteArrayInputStream(new byte[100000]);ByteArrayOutputStream written=new ByteArrayOutputStream();SyncStore backing=new SyncStore(){public String namespace(){return "synthetic";}public List<Entry> list(String path){listed.incrementAndGet();return Collections.emptyList();}public InputStream open(String path){return new FilterInputStream(bytes){public void close(){readClosed.set(true);}};}public OutputStream create(String path){return new FilterOutputStream(written){public void close(){writeClosed.set(true);}};}};GuardedSyncStore store=new GuardedSyncStore(backing,()->{if(!allowed.get())throw new IOException("synthetic route stopped");});InputStream in=store.open("source");OutputStream out=store.create("target");byte[] block=new byte[65536];assertEquals(65536,in.read(block));out.write(block);allowed.set(false);
  try{in.read(block);fail("Cancelled read continued");}catch(IOException expected){}try{out.write(block);fail("Cancelled write continued");}catch(IOException expected){}try{store.list("directory");fail("Cancelled provider listed");}catch(IOException expected){}assertEquals(0,listed.get());assertEquals(34464,bytes.available());assertEquals(65536,written.size());in.close();out.close();assertTrue(readClosed.get());assertTrue(writeClosed.get());assertEquals("synthetic",store.namespace());
 }
}
