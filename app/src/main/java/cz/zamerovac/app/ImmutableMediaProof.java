package cz.zamerovac.app;

import org.json.JSONObject;
import java.io.*;
import java.nio.file.*;
import java.nio.file.attribute.*;
import java.util.*;
import java.util.concurrent.TimeUnit;

/** P1 metadata-save cache only. Ingest and every actual transfer still hash the complete source. */
final class ImmutableMediaProof {
    interface Hash {JSONObject inspect(File file)throws Exception;}
    private static final Map<String,Entry> CACHE=new LinkedHashMap<String,Entry>(128,.75f,true){protected boolean removeEldestEntry(Map.Entry<String,ImmutableMediaProof.Entry> e){return size()>1024;}};
    private static final class Stamp {
        final Object inode;final long size;final FileTime modified,changed;
        Stamp(BasicFileAttributes a,FileTime changed){inode=a.fileKey();size=a.size();modified=a.lastModifiedTime();this.changed=changed;}
        boolean same(Stamp other){return other!=null&&Objects.equals(inode,other.inode)&&size==other.size&&modified.equals(other.modified)&&changed.equals(other.changed);}
    }
    private static final class Entry {final Stamp stamp;final String proof;Entry(Stamp stamp,JSONObject proof){this.stamp=stamp;this.proof=proof.toString();}}
    private static Stamp stamp(File file)throws IOException{
        BasicFileAttributes attrs=Files.readAttributes(file.toPath(),BasicFileAttributes.class,LinkOption.NOFOLLOW_LINKS);
        if(!attrs.isRegularFile()||attrs.isSymbolicLink())throw new IOException("Nebezpečný originál");
        try {
            Object value=Files.getAttribute(file.toPath(),"unix:ctime",LinkOption.NOFOLLOW_LINKS);
            if(!(value instanceof FileTime)||attrs.fileKey()==null)return null;
            FileTime changed=(FileTime)value;
            // Do not cache on providers with only coarse, second-resolution change timestamps.
            if(changed.to(TimeUnit.NANOSECONDS)%1_000_000_000L==0)return null;
            return new Stamp(attrs,changed);
        }catch(UnsupportedOperationException|IllegalArgumentException unsupported){return null;}
    }
    static JSONObject inspect(File file)throws Exception{return inspect(file,PeerMedia::inspect);}
    static JSONObject inspect(File file,Hash hash)throws Exception{
        synchronized(TrashPurger.LOCK){
            String key=file.getAbsolutePath();Stamp before=stamp(file);Entry old=CACHE.get(key);
            if(before!=null&&old!=null&&old.stamp.same(before))return new JSONObject(old.proof);
            JSONObject proof=hash.inspect(file);Stamp after=stamp(file);
            if(before!=null&&!before.same(after))throw new IOException("Originál se během kontroly změnil");
            if(after!=null)CACHE.put(key,new Entry(after,proof));else CACHE.remove(key);
            return new JSONObject(proof.toString());
        }
    }
}
