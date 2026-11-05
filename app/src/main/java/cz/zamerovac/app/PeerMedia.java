package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.nio.file.*;
import java.security.MessageDigest;
import java.util.*;

/** Verified streaming to a temporary local file; never overwrite an existing original. */
final class PeerMedia {
    static JSONObject inspect(File file)throws Exception{return inspect(file,()->{});}
    static JSONObject inspect(File file,ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        if(!file.isFile()||Files.isSymbolicLink(file.toPath())||file.length()<1||file.length()>PeerSnapshot.MAX_MEDIA)throw new IOException("Chybí nebo je neplatná příloha: "+file.getName());
        long size=file.length(),modified=file.lastModified();JSONObject digest;try(FileInputStream in=new FileInputStream(file)){InputStream checked=new FilterInputStream(in){@Override public int read(byte[] bytes,int offset,int length)throws IOException{checkpoint.check();if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Kontrola přílohy byla přerušena");return super.read(bytes,offset,Math.min(65536,length));}};digest=ArchiveIntegrity.copy(checked,new OutputStream(){public void write(int b){}public void write(byte[] b,int off,int length){}});in.getFD().sync();}
        checkpoint.check();if(file.length()!=size||file.lastModified()!=modified||digest.getLong("size")!=size)throw new IOException("Příloha se během kontroly změnila");return new JSONObject().put("hash",digest.getString("sha256")).put("size",size);
    }
    static boolean matches(File file,JSONObject expected)throws Exception{return matches(file,expected,()->{});}
    static boolean matches(File file,JSONObject expected,ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        if(Files.isSymbolicLink(file.toPath()))throw new IOException("Příloha nesmí být symbolický odkaz");if(!file.exists())return false;JSONObject actual=inspect(file,checkpoint);if(actual.getLong("size")!=expected.getLong("size")||!actual.getString("hash").equals(expected.getString("hash")))throw new IOException("Obsah stejného identifikátoru přílohy se liší. Obě původní kopie zůstaly zachované.");return true;
    }
    static void send(File file,OutputStream destination,JSONObject expected)throws Exception{
        if(!file.isFile()||Files.isSymbolicLink(file.toPath()))throw new IOException("Příloha není dostupná");long size=PeerSnapshot.integer(expected,"size",PeerSnapshot.MAX_MEDIA);if(size<1||file.length()!=size)throw new IOException("Velikost přílohy se změnila");
        MessageDigest hash=ArchiveIntegrity.digest();byte[] block=new byte[65536];long remaining=size;
        try(InputStream in=new FileInputStream(file)){
            while(remaining>0){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Přenos byl přerušen");int n=in.read(block,0,(int)Math.min(block.length,remaining));if(n<0)throw new EOFException("Příloha není úplná");destination.write(block,0,n);hash.update(block,0,n);remaining-=n;}
            if(in.read()!=-1||!ArchiveIntegrity.hex(hash.digest()).equals(expected.getString("hash")))throw new IOException("Kontrola odesílané přílohy selhala");
        }
        destination.flush();
    }
    static void receive(File directory,String id,InputStream source,JSONObject expected)throws Exception{receive(directory,id,source,expected,()->{});}
    static void receive(File directory,String id,InputStream source,JSONObject expected,ImmutableStore.Checkpoint checkpoint)throws Exception{
        checkpoint.check();
        if(!PeerSnapshot.validMediaId(id))throw new IOException("Neplatná cílová příloha");if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Nelze připravit úložiště příloh");
        long size=PeerSnapshot.integer(expected,"size",PeerSnapshot.MAX_MEDIA);if(size<1)throw new IOException("Prázdná příloha");File destination=new File(directory,id),temporary=new File(directory,".peer-v2-"+UUID.randomUUID()+".tmp");MessageDigest hash=ArchiveIntegrity.digest();byte[] block=new byte[65536];long remaining=size;
        try{
            try(FileOutputStream out=new FileOutputStream(temporary)){
                while(remaining>0){checkpoint.check();if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Přenos byl přerušen");int n=source.read(block,0,(int)Math.min(block.length,remaining));if(n<0)throw new EOFException("Přerušená příloha se neoznačí jako hotová");if(n==0)throw new IOException("Přenos přílohy nepostupuje");out.write(block,0,n);hash.update(block,0,n);remaining-=n;}
                if(!ArchiveIntegrity.hex(hash.digest()).equals(expected.getString("hash")))throw new IOException("Kontrola přijaté přílohy selhala");out.getFD().sync();
            }
            checkpoint.check();boolean existing=matches(destination,expected,checkpoint);long existingSize=destination.length(),existingModified=destination.lastModified();
            synchronized(TrashPurger.LOCK){if(existing){if(!destination.isFile()||Files.isSymbolicLink(destination.toPath())||destination.length()!=existingSize||destination.lastModified()!=existingModified)throw new IOException("Příloha se před potvrzením změnila");return;}if(destination.exists()||Files.isSymbolicLink(destination.toPath()))throw new IOException("Příloha vznikla souběžně. Opakuj přenos.");try{Files.move(temporary.toPath(),destination.toPath(),StandardCopyOption.ATOMIC_MOVE);}catch(AtomicMoveNotSupportedException unsupported){Files.move(temporary.toPath(),destination.toPath());}}
        }finally{temporary.delete();}
    }
}
