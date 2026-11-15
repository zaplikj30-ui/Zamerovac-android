package cz.zamerovac.app;

import java.io.*;

/** Provider capabilities are explicit. No provider is assumed atomic with the local database. */
interface SyncStorageAdapter {
    String kind();
    String scope();
    ImmutableStore objects();
    boolean resumableUpload();
    default boolean atomicPublication(){return false;}
    default boolean changeCursor(){return false;}
    default void confirm(String path,String hash,long size)throws Exception {CloudFiles.verify(objects(),path,hash,size);}
    static SyncStorageAdapter of(SyncStore store){
        return new SyncStorageAdapter(){
            public String kind(){return store instanceof DriveSyncStore?"drive":"saf";}
            public String scope(){return store.namespace();}
            public ImmutableStore objects(){return store;}
            public boolean resumableUpload(){return store instanceof DriveSyncStore;}
        };
    }
}
