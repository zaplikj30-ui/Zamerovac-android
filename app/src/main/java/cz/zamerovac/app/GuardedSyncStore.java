package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** Recheck route, cancellation and network policy between provider chunks; always allow cleanup. */
final class GuardedSyncStore implements SyncStore {
 interface Guard {void check()throws IOException;}
 private final SyncStore delegate;private final Guard guard;
 GuardedSyncStore(SyncStore delegate,Guard guard){this.delegate=delegate;this.guard=guard;}
 public String namespace(){return delegate.namespace();}
 public List<Entry> list(String path)throws Exception{guard.check();return delegate.list(path);}
 public InputStream open(String path)throws Exception{guard.check();InputStream source=delegate.open(path);return new InputStream(){public int read()throws IOException{guard.check();return source.read();}public int read(byte[] bytes,int offset,int length)throws IOException{guard.check();return source.read(bytes,offset,length);}public void close()throws IOException{source.close();}};}
 public OutputStream create(String path)throws Exception{guard.check();OutputStream target=delegate.create(path);return new OutputStream(){public void write(int value)throws IOException{guard.check();target.write(value);}public void write(byte[] bytes,int offset,int length)throws IOException{guard.check();target.write(bytes,offset,length);}public void flush()throws IOException{guard.check();target.flush();}public void close()throws IOException{target.close();}};}
}
