package cz.zamerovac.app;

import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/**
 * Durable, independent first-install evidence (not the backup/recovery epoch).
 * Kept outside projects.json/projects.bak and the recovery journal. A failed or
 * interrupted marker write must block initialization, never authorize a reset.
 *
 * Older installs migrate only after a validated primary database was observed.
 * Total deletion of every app-local trace cannot be distinguished from reinstall.
 */
final class DatabaseInstallEvidence {
    private static final byte[] MAGIC =
        "zamerovac-database-initialized-v1\n".getBytes(StandardCharsets.US_ASCII);
    private static File path(File home) { return new File(home, "zamerovac-install-state-v1.marker"); }
    private static AtomicFile atomic(File home) { return new AtomicFile(path(home)); }
    private static boolean present(File file) {
        return Files.exists(file.toPath(), LinkOption.NOFOLLOW_LINKS);
    }
    static boolean exists(File home) {
        File file=path(home);
        return present(file)||present(new File(file+".bak"))||present(new File(file+".new"));
    }
    static void verify(File home) throws IOException {
        if(!exists(home))throw new IOException("Chybí evidence inicializace");
        File file=path(home);
        for(File candidate:new File[]{file,new File(file+".bak"),new File(file+".new")}) {
            if(present(candidate)&&Files.isSymbolicLink(candidate.toPath()))
                throw new IOException("Nebezpečný odkaz v evidenci inicializace");
        }
        byte[] bytes=atomic(home).readFully();
        if(!Arrays.equals(bytes,MAGIC))
            throw new IOException("Evidence inicializace je neúplná nebo poškozená");
    }
    static void ensure(File home) throws IOException {
        if(exists(home)){verify(home);return;}
        AtomicFile file=atomic(home);
        FileOutputStream out=null;
        try {
            out=file.startWrite();
            out.write(MAGIC);
            out.getFD().sync();
            file.finishWrite(out);
            out=null;
            verify(home);
        } catch(IOException failure) {
            if(out!=null)file.failWrite(out);
            throw failure;
        }
    }
}
