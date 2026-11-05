package cz.zamerovac.app;
import org.junit.*;
import java.io.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.Assert.*;
/** Provider deliberately ignores interruption. Caller must still regain control; no customer files. */
public class ProviderIoTest {
 static void uninterruptible(CountDownLatch release){boolean interrupted=false;while(true)try{release.await();break;}catch(InterruptedException ignored){interrupted=true;}if(interrupted)Thread.currentThread().interrupt();}
 @Test public void timeoutReleasesCallerEvenWhenReadIgnoresInterruptAndCancellationBlocks()throws Exception{
  CountDownLatch release=new CountDownLatch(1),entered=new CountDownLatch(1),cancelled=new CountDownLatch(1);try(ProviderIo io=new ProviderIo(80,2)){
   InputStream raw=new InputStream(){public int read(){entered.countDown();uninterruptible(release);return 1;}@Override public int read(byte[] bytes){read();bytes[0]=1;return 1;}@Override public void close(){cancelled.countDown();uninterruptible(release);}};InputStream stream=io.input(raw);long start=System.nanoTime();try{stream.read(new byte[5]);fail("Unresponsive provider blocked indefinitely");}catch(IOException expected){assertTrue(expected.getMessage().contains("včas"));}assertTrue(entered.await(1,TimeUnit.SECONDS));assertTrue(TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-start)<2000);assertTrue(cancelled.await(1,TimeUnit.SECONDS));assertEquals(42,(int)io.call(()->42,null));try{stream.read();fail("Failed stream reused while previous read is still running");}catch(IOException expected){}release.countDown();stream.close();
  }finally{release.countDown();}
 }
 @Test public void timedOutWriterOwnsItsBytesAndCannotUseMutatedCallerBuffer()throws Exception{
  CountDownLatch release=new CountDownLatch(1),finished=new CountDownLatch(1);ByteArrayOutputStream saved=new ByteArrayOutputStream();try(ProviderIo io=new ProviderIo(80,2)){
   OutputStream raw=new OutputStream(){public void write(int b){}@Override public void write(byte[] bytes,int offset,int length){uninterruptible(release);saved.write(bytes,offset,length);finished.countDown();}};OutputStream stream=io.output(raw);byte[] caller={1,2,3,4};try{stream.write(caller);fail("Stalled writer reported success");}catch(IOException expected){assertTrue(expected.getMessage().contains("včas"));}java.util.Arrays.fill(caller,(byte)9);release.countDown();assertTrue(finished.await(1,TimeUnit.SECONDS));assertArrayEquals(new byte[]{1,2,3,4},saved.toByteArray());stream.close();
  }finally{release.countDown();}
 }
 @Test public void successfulStreamsAndLateResourceCleanupRespectByteAndCloseContracts()throws Exception{
  AtomicInteger closed=new AtomicInteger();try(ProviderIo io=new ProviderIo(1000,2)){
   try(InputStream input=io.input(new ByteArrayInputStream(new byte[]{0,(byte)255,2}))){assertEquals(0,input.read());assertEquals(255,input.read());byte[] tail=new byte[3];assertEquals(1,input.read(tail,1,2));assertEquals(2,tail[1]);assertEquals(-1,input.read());assertEquals(0,input.read(tail,0,0));}
   ByteArrayOutputStream saved=new ByteArrayOutputStream();try(OutputStream out=io.output(saved)){out.write(new byte[]{1,2,3},1,2);out.flush();}assertArrayEquals(new byte[]{2,3},saved.toByteArray());
  }
  CountDownLatch release=new CountDownLatch(1),cleaned=new CountDownLatch(1);try(ProviderIo io=new ProviderIo(80,2)){try{io.call(()->{uninterruptible(release);return (AutoCloseable)()->{closed.incrementAndGet();cleaned.countDown();};},null);fail("Late resource returned to caller");}catch(IOException expected){}release.countDown();assertTrue(cleaned.await(1,TimeUnit.SECONDS));assertEquals(1,closed.get());}finally{release.countDown();}
 }
}
