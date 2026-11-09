package cz.zamerovac.app;
import java.io.*;
import java.util.*;
/** Recheck route, cancellation and network policy between provider chunks; always allow cleanup. */
final class GuardedSyncStore implements SyncStore {
 interface Guard extends ImmutableStore.Checkpoint {}
 private final SyncStore delegate;private final Guard guard,ackGuard;
 GuardedSyncStore(SyncStore delegate,Guard guard){this(delegate,guard,()->{});}
 GuardedSyncStore(SyncStore delegate,Guard guard,Guard ackGuard){this.delegate=delegate.checked(guard);this.guard=guard;this.ackGuard=ackGuard;}
 public String namespace(){return delegate.namespace();}
 public SyncStore checked(ImmutableStore.Checkpoint checkpoint){return new GuardedSyncStore(delegate,()->{guard.check();checkpoint.check();},ackGuard);}
 public List<Entry> list(String path)throws Exception{guard.check();return delegate.list(path);}
 public InputStream open(String path)throws Exception{guard.check();InputStream source=delegate.open(path);return new InputStream(){public int read()throws IOException{guard.check();return source.read();}public int read(byte[] bytes,int offset,int length)throws IOException{guard.check();return source.read(bytes,offset,length);}public void close()throws IOException{source.close();}};}
 private final class GuardedOutput extends OutputStream implements ImmutableStore.PendingOutput {
  final OutputStream target;final boolean isAck;
  GuardedOutput(OutputStream target,boolean isAck){this.target=target;this.isAck=isAck;}
  private void beforeWriteOrPublish()throws IOException{guard.check();if(isAck)ackGuard.check();}
  public void write(int value)throws IOException{beforeWriteOrPublish();target.write(value);}
  public void write(byte[] bytes,int offset,int length)throws IOException{beforeWriteOrPublish();target.write(bytes,offset,length);}
  public void flush()throws IOException{guard.check();target.flush();}
  // The last local permission check must be as close to the durable provider
  // publication as possible. Never hold the database lock during network I/O.
  public void publish()throws IOException{beforeWriteOrPublish();ImmutableStore.complete(target);}
  public void close()throws IOException{target.close();}
 }
 public OutputStream create(String path)throws Exception{
  guard.check();
  return new GuardedOutput(delegate.create(path),path!=null&&path.startsWith("sync/v2/acks/"));
 }
}
