package cz.zamerovac.app;

import android.util.AtomicFile;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;

/**
 * Independent, durable proof of earlier database initialization.
 * The second copy is kept outside Android Auto Backup in no_backup.
 * Neither marker authorizes automatic restoration of a damaged database.
 */
final class DatabaseInstallEvidence {
    private static final String NAME="zamerovac-install-state-v1.marker";
    private static final byte[] MAGIC="zamerovac-database-initialized-v1\n".getBytes(StandardCharsets.US_ASCII);
    private static final String[] SYNC_TRACES={
        "sync-peers-v2.json","sync-v2-outbox","sync-queue-v2.json",
        "sync-inbox-v2-","sync-scan-v2-","sync-publications-v2-"
    };

    private static File marker(File dir){return new File(dir,NAME);}
    /** A positive absence is different from permission/I/O uncertainty. */
    private static BasicFileAttributes attributes(File file)throws IOException{
        try{return Files.readAttributes(file.toPath(),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);}
        catch(NoSuchFileException absent){return null;}
    }
    private static boolean directory(File dir)throws IOException{
        BasicFileAttributes attrs=attributes(dir);
        if(attrs==null)return false;
        if(!attrs.isDirectory()||attrs.isSymbolicLink())throw new IOException("Nepřístupný adresář evidence inicializace");
        return true;
    }
    private static boolean located(File file)throws IOException{
        BasicFileAttributes attrs=attributes(file);
        if(attrs==null)return false;
        if(!attrs.isRegularFile()||attrs.isSymbolicLink()||attrs.size()!=MAGIC.length)
            throw new IOException("Neplatná velikost nebo typ evidence inicializace");
        return true;
    }
    static boolean exists(File home)throws IOException{return exists(home,null);}
    static boolean exists(File home,File noBackup)throws IOException{
        // Do NOT short-circuit before checking inaccessible second directory.
        boolean homeSeen=found(home);
        boolean noBackupSeen=noBackup!=null&&found(noBackup);
        return homeSeen||noBackupSeen;
    }
    private static boolean found(File dir)throws IOException{
        if(!directory(dir))return false;
        File base=marker(dir);
        boolean a=located(base),b=located(new File(base+".bak")),n=located(new File(base+".new"));
        return a||b||n;
    }
    private static void checkBytes(File path)throws IOException{
        // Exact bounded read: never AtomicFile.readFully() on untrusted lengths.
        try(InputStream in=Files.newInputStream(path.toPath(),LinkOption.NOFOLLOW_LINKS)){
            for(byte expected:MAGIC)if(in.read()!=(expected&0xff))
                throw new IOException("Evidence inicializace je poškozená");
            if(in.read()!=-1)throw new IOException("Evidence inicializace je příliš velká");
        }
    }
    private static void verifyOne(File dir)throws IOException{
        if(!directory(dir))throw new IOException("Adresář evidence chybí");
        File base=marker(dir),backup=new File(base+".bak"),unfinished=new File(base+".new");
        boolean a=located(base),b=located(backup),n=located(unfinished);
        if(n)throw new IOException("Nedokončený zápis evidence inicializace");
        if(!a&&!b)throw new IOException("Chybí evidence inicializace");
        if(a)checkBytes(base);
        if(b)checkBytes(backup);
    }
    static void verify(File home)throws IOException{verifyOne(home);}
    static void verify(File home,File noBackup)throws IOException{
        verifyOne(home);
        if(noBackup!=null)verifyOne(noBackup);
    }
    private static void create(File dir)throws IOException{
        if(!directory(dir)){
            if(!dir.mkdirs()&&!directory(dir))
                throw new IOException("Adresář evidence nelze vytvořit");
        }
        if(found(dir))throw new IOException("Evidence se mezitím změnila");
        AtomicFile atomic=new AtomicFile(marker(dir));
        FileOutputStream out=null;
        try{
            out=atomic.startWrite();out.write(MAGIC);out.getFD().sync();
            atomic.finishWrite(out);out=null;verifyOne(dir);
        }catch(IOException failure){if(out!=null)atomic.failWrite(out);throw failure;}
    }
    static void ensure(File home)throws IOException{ensure(home,null);}
    static void ensure(File home,File noBackup)throws IOException{
        boolean first=found(home),second=noBackup!=null&&found(noBackup);
        // A corrupt survivor cannot be overwritten with a fresh marker.
        if(first)verifyOne(home);
        if(second)verifyOne(noBackup);
        // Outside Auto Backup first: survives selective deletion of files/.
        if(noBackup!=null&&!second)create(noBackup);
        if(!first)create(home);
        verify(home,noBackup);
    }
    /**
     * Legacy installations may have sync receipts but no B16 marker yet.
     * Identity alone is not evidence: a clean install creates it before DB.
     */
    static boolean legacySyncTraces(File noBackup)throws IOException{
        if(noBackup==null||!directory(noBackup))return false;
        File[] files=noBackup.listFiles();
        if(files==null)throw new IOException("Doklady synchronizace nelze prověřit");
        for(File entry:files){
            String name=entry.getName();
            for(String prefix:SYNC_TRACES)
                if(name.equals(prefix)||name.startsWith(prefix+".")||
                    (prefix.endsWith("-")&&name.startsWith(prefix)))
                    return true;
        }
        return false;
    }
}
