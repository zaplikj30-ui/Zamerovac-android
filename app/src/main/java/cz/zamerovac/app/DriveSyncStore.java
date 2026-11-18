package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** Only the live sync namespace is available to the synchronizer. */
final class DriveSyncStore implements SyncStore {
    private final DriveObjectStore objects;
    DriveSyncStore(DriveObjectStore objects){this.objects=objects;}
    public String namespace(){return objects.namespace;}
    public String uploadPath(String proposed,String hash,long size)throws Exception{return new DriveResumableUpload(objects.api,objects.staging.getParentFile(),objects.namespace).pendingPath(proposed,hash,size);}
    public SyncStore checked(ImmutableStore.Checkpoint checkpoint){return new DriveSyncStore(objects.checked(checkpoint));}
    public InputStream open(String path)throws Exception{SyncStore.parts(path);return objects.open(path);}
    public OutputStream create(String path)throws Exception{SyncStore.parts(path);return objects.create(path);}
    public List<Entry> list(String path)throws Exception{SyncStore.parts(path);return objects.list(path);}
}
