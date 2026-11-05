package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** Immutable storage capability shared by transport adapters. No replace/delete operation. */
interface ImmutableStore {
    interface Checkpoint {void check()throws IOException;}
    /** Staged adapters publish only after the caller verifies the complete source. close() only cleans up. */
    interface PendingOutput {void publish()throws IOException;}
    static void complete(OutputStream out)throws IOException{if(out instanceof PendingOutput)((PendingOutput)out).publish();}
    final class Entry {final String name;final boolean directory;final long size;Entry(String name,boolean directory,long size){this.name=name;this.directory=directory;this.size=size;}}
    InputStream open(String path)throws Exception;
    OutputStream create(String path)throws Exception;
    List<Entry> list(String directory)throws Exception;
}
