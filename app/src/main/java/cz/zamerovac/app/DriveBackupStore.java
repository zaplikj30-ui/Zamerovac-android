package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** History has a separate capability and remains usable without pairing or live synchronization. */
final class DriveBackupStore implements BackupStore {
    private final DriveObjectStore objects;
    DriveBackupStore(DriveObjectStore objects){this.objects=objects;}
    public InputStream open(String path)throws Exception{BackupStore.parts(path);return objects.open(path);}
    public OutputStream create(String path)throws Exception{BackupStore.parts(path);return objects.create(path);}
    public List<Entry> list(String path)throws Exception{BackupStore.parts(path);return objects.list(path);}
}
