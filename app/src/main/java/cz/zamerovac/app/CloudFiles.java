package cz.zamerovac.app;
import org.json.*;
import java.io.*;
/** Bounded streaming and verified immutable publication, used only in the live sync namespace. */
final class CloudFiles {
 interface Source {InputStream open()throws Exception;}
 static String blob(String hash)throws IOException{if(!hash.matches("[a-f0-9]{64}"))throw new IOException("Neplatný blok synchronizace");return "sync/v2/blobs/"+hash;}
 static byte[] read(InputStream source,int limit)throws Exception{try(InputStream in=source;ByteArrayOutputStream out=new ByteArrayOutputStream()){if(limit<0)throw new IOException("Neplatný limit zprávy");byte[] block=new byte[65536];int n;while((n=in.read(block,0,(int)Math.min(block.length,(long)limit-out.size()+1)))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();if(n==0)throw new IOException("Poskytovatel nevrátil žádná data");if(n>limit-out.size())throw new IOException("Cloudová zpráva překračuje limit");out.write(block,0,n);}return out.toByteArray();}}
 static JSONObject copy(InputStream in,OutputStream out,long limit)throws Exception{if(limit<0)throw new IOException("Neplatný limit bloku");java.security.MessageDigest hash=ArchiveIntegrity.digest();long total=0;byte[] block=new byte[65536];int count;while((count=in.read(block,0,limit-total>=block.length?block.length:(int)(limit-total)+1))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();if(count==0)throw new IOException("Poskytovatel nevrátil žádná data");if(count>limit-total)throw new IOException("Cloudový blok překračuje deklarovanou velikost");total+=count;out.write(block,0,count);hash.update(block,0,count);}return ArchiveIntegrity.entry(total,hash.digest());}
 static void verify(ImmutableStore store,String path,String hash,long size)throws Exception{try(InputStream in=store.open(path)){JSONObject actual=copy(in,new OutputStream(){public void write(int b){}public void write(byte[] b,int off,int count){}},size);if(size!=actual.getLong("size")||!hash.equals(actual.getString("sha256")))throw new IOException("Cloudový blok není úplný nebo má nesprávný součet");}}
 static String find(SyncStore store,String hash,long size)throws Exception{
  String plain=blob(hash);try{verify(store,plain,hash,size);return plain;}catch(IOException absentOrIncomplete){}
  for(ImmutableStore.Entry entry:store.list("sync/v2/blobs")){if(entry.directory||!entry.name.matches(hash+"-[a-f0-9-]{36}"))continue;String path="sync/v2/blobs/"+entry.name;try{verify(store,path,hash,size);return path;}catch(IOException incomplete){}}
  throw new FileNotFoundException("Úplný ověřený cloudový blok chybí");
 }
 static String put(SyncStore store,String hash,long size,Source source)throws Exception{try{return find(store,hash,size);}catch(FileNotFoundException missing){}
  // An interrupted upload is an orphan. Retry under a fresh immutable name; never truncate an existing block.
  String path=store.uploadPath(blob(hash)+"-"+java.util.UUID.randomUUID(),hash,size);SyncStore.parts(path);
  try(InputStream in=source.open();OutputStream out=store.create(path)){JSONObject actual=copy(in,out,size);out.flush();if(actual.getLong("size")!=size||!hash.equals(actual.getString("sha256")))throw new IOException("Přenášený originál se změnil");ImmutableStore.complete(out);}verify(store,path,hash,size);return path;
 }
 static String publish(SyncStore store,String directory,String hash,JSONObject envelope)throws Exception{byte[] bytes=CloudProof.bytes(envelope);String path=directory+"/"+hash+"-"+java.util.UUID.randomUUID()+".json";try(OutputStream out=store.create(path)){out.write(bytes);out.flush();ImmutableStore.complete(out);}verify(store,path,PeerWire.hash(bytes),bytes.length);return path;}
}
