package cz.zamerovac.app;
import java.io.*;
import java.util.*;

/** Backup-only capability: no overwrite or delete operation exists in this interface. */
interface BackupStore extends ImmutableStore {
    static String[] parts(String path)throws IOException{if(path==null||!path.matches("backups/v2(?:/[a-zA-Z0-9_.-]+)*")||path.contains("..")||path.length()>400)throw new IOException("Neplatná cesta zálohy");return path.split("/");}
}
