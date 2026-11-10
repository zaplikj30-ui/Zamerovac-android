package cz.zamerovac.app;

import android.content.SharedPreferences;
import java.io.*;
import java.nio.file.Files;
import java.util.UUID;

/** A private incomplete file is never exposed under a final media identifier. */
final class MediaStaging {
    static final long LIMIT=2L*1024*1024*1024;
    static boolean metadata(String mime,String name){if(!PeerSnapshot.validMime(mime)||name==null||name.length()>256||name.chars().anyMatch(Character::isISOControl))return false;try{JsonInput.unicode(name);return true;}catch(Exception invalid){return false;}}
    static File temporary(File directory,String id)throws IOException{
        if(id==null||!id.matches("[a-zA-Z0-9_-]{3,120}"))throw new IOException("Neplatný identifikátor přílohy");
        if(!directory.isDirectory()&&!directory.mkdirs())throw new IOException("Nelze vytvořit úložiště příloh");
        synchronized(TrashPurger.LOCK){if(new File(directory,id).exists())throw new IOException("Existující originál se nesmí přepsat");File temporary=new File(directory,".capture-"+id+"-"+UUID.randomUUID()+".tmp");if(!temporary.createNewFile())throw new IOException("Nelze připravit přílohu");return temporary;}
    }
    static void commit(File temporary,String id,SharedPreferences prefs,String mime,String name)throws Exception{
        if(id==null||!id.matches("[a-zA-Z0-9_-]{3,120}")||temporary==null||!temporary.isFile()||temporary.length()<1||temporary.length()>LIMIT||!metadata(mime,name))throw new IOException("Příloha není úplná nebo má neplatná metadata");
        try(RandomAccessFile file=new RandomAccessFile(temporary,"rw")){file.getFD().sync();}
        File target=new File(temporary.getParentFile(),id);
        synchronized(TrashPurger.LOCK){
            if(target.exists())throw new IOException("Existující originál se nesmí přepsat");
            ProtectedRevisions.requireUnpinned(target);
            // Same-directory move; all app publishers check and commit under the shared local lock.
            Files.move(temporary.toPath(),target.toPath());
            boolean committed=false;try{committed=prefs.edit().putString("mime-"+id,mime).putString("name-"+id,name).commit();if(!committed)throw new IOException("Metadata přílohy nebyla potvrzena");}finally{if(!committed&&!ProtectedRevisions.rollback(target))android.util.Log.w("Zamerovac","Unreferenced failed media remains private");}
        }
    }
}
