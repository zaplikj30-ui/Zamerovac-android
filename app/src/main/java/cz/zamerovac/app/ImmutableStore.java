package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** Immutable storage capability shared by transport adapters. No replace/delete operation. */
interface ImmutableStore {
    final class Entry {final String name;final boolean directory;final long size;Entry(String name,boolean directory,long size){this.name=name;this.directory=directory;this.size=size;}}
    InputStream open(String path)throws Exception;
    OutputStream create(String path)throws Exception;
    List<Entry> list(String directory)throws Exception;
}
