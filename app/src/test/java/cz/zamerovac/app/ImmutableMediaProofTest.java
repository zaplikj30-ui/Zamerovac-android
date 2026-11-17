package cz.zamerovac.app;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.concurrent.atomic.AtomicInteger;
import static org.junit.Assert.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class ImmutableMediaProofTest {
    @Test public void sameSizeAndRestoredMtimeCannotReuseAChangedOriginalProof()throws Exception{
        File root=Files.createTempDirectory(RuntimeEnvironment.getApplication().getCacheDir().toPath(),"immutable-proof-").toFile(),file=new File(root,"photo");Files.write(file.toPath(),new byte[]{1,3,5});FileTime time=Files.getLastModifiedTime(file.toPath());AtomicInteger hashes=new AtomicInteger();ImmutableMediaProof.Hash hash=f->{hashes.incrementAndGet();return PeerMedia.inspect(f);};
        String original=ImmutableMediaProof.inspect(file,hash).getString("hash");assertEquals(original,ImmutableMediaProof.inspect(file,hash).getString("hash"));assertEquals("Linux high-resolution inode/ctime proof avoids rereading immutable bytes on a metadata-only save",1,hashes.get());
        Files.write(file.toPath(),new byte[]{2,4,6});Files.setLastModifiedTime(file.toPath(),time);assertNotEquals(original,ImmutableMediaProof.inspect(file,hash).getString("hash"));assertEquals(2,hashes.get());
        Files.delete(file.toPath());Files.write(file.toPath(),new byte[]{7,9,11});Files.setLastModifiedTime(file.toPath(),time);assertNotEquals(original,ImmutableMediaProof.inspect(file,hash).getString("hash"));assertEquals(3,hashes.get());
    }
}
