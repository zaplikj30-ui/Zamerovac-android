package cz.zamerovac.app;
import java.io.*;
import java.util.*;

/** Backup-only capability: no overwrite or delete operation exists in this interface. */
interface BackupStore {
    final class Entry {final String name;final boolean directory;final long size;Entry(String name,boolean directory,long size){this.name=name;this.directory=directory;this.size=size;}}
    InputStream open(String path)throws Exception;
    OutputStream create(String path)throws Exception;
    List<Entry> list(String directory)throws Exception;
    static String[] parts(String path)throws IOException{if(path==null||!path.matches("backups/v2(?:/[a-zA-Z0-9_.-]+)*")||path.contains("..")||path.length()>400)throw new IOException("Neplatná cesta zálohy");return path.split("/");}
}
