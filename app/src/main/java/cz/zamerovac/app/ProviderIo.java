package cz.zamerovac.app;
import java.io.*;
import java.util.Arrays;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicBoolean;

/** Bound an unresponsive DocumentsProvider without holding a peer/DB gate forever. */
final class ProviderIo implements AutoCloseable {
    static final ProviderIo SHARED=new ProviderIo(30000,4);
    private final long timeout;private final ThreadPoolExecutor workers,cleanup;
    ProviderIo(long timeout,int capacity){this.timeout=timeout;workers=pool("ProviderIO",capacity);cleanup=pool("ProviderCancel",2);}
    private static ThreadPoolExecutor pool(String label,int capacity){ThreadPoolExecutor pool=new ThreadPoolExecutor(capacity,capacity,30,TimeUnit.SECONDS,new ArrayBlockingQueue<>(capacity*2),work->{Thread thread=new Thread(work,label);thread.setDaemon(true);return thread;},new ThreadPoolExecutor.AbortPolicy());pool.allowCoreThreadTimeOut(true);return pool;}
    private static void dispose(Object resource){if(resource instanceof AutoCloseable)try{((AutoCloseable)resource).close();}catch(Exception ignored){}}
    private void clean(Runnable task){try{cleanup.execute(task);}catch(RejectedExecutionException busy){/* Bounded even if the provider's cancellation itself blocks. */}}
    <T>T call(Callable<T> work,Runnable cancel)throws Exception{
        AtomicBoolean abandoned=new AtomicBoolean();java.util.concurrent.atomic.AtomicReference<T> owned=new java.util.concurrent.atomic.AtomicReference<>();Future<T> future;
        try{future=workers.submit(()->{T value=work.call();owned.set(value);if(abandoned.get()){dispose(owned.getAndSet(null));throw new InterruptedIOException("Opožděná odpověď poskytovatele byla zahozena");}return value;});}
        catch(RejectedExecutionException busy){throw new IOException("Poskytovatel stále nereaguje. Místní práce zůstává dostupná; přenos zůstává čekající.",busy);}
        try{T value=future.get(timeout,TimeUnit.MILLISECONDS);owned.set(null);return value;}
        catch(TimeoutException|InterruptedException stalled){abandoned.set(true);future.cancel(true);workers.purge();T value=owned.getAndSet(null);if(value!=null)clean(()->dispose(value));if(cancel!=null)clean(cancel);if(stalled instanceof InterruptedException)Thread.currentThread().interrupt();throw new IOException("Poskytovatel úložiště včas neodpověděl. Operace nebyla potvrzena; zkus ji znovu po obnovení spojení.",stalled);}
        catch(ExecutionException failure){Throwable cause=failure.getCause();if(cause instanceof Exception)throw (Exception)cause;if(cause instanceof Error)throw (Error)cause;throw new IOException(cause);}
    }
    private IOException failure(Exception failure){return failure instanceof IOException?(IOException)failure:new IOException(failure.getMessage(),failure);}
    InputStream input(InputStream source){return new InputStream(){private boolean closed,failed;
        @Override public int read()throws IOException{byte[] one=new byte[1];return read(one,0,1)==-1?-1:one[0]&255;}
        @Override public int read(byte[] target,int offset,int length)throws IOException{
            if(offset<0||length<0||offset>target.length-length)throw new IndexOutOfBoundsException();if(length==0)return 0;if(closed||failed)throw new IOException("Čtení poskytovatele již není aktivní");final int requested=Math.min(length,65536);
            try{byte[] result=call(()->{byte[] block=new byte[requested];int count=source.read(block);if(count==0)throw new IOException("Poskytovatel nevrátil žádná data");return count<0?null:count==block.length?block:Arrays.copyOf(block,count);},()->dispose(source));if(result==null)return -1;System.arraycopy(result,0,target,offset,result.length);return result.length;}catch(Exception error){failed=true;throw failure(error);}
        }
        @Override public void close()throws IOException{if(closed)return;closed=true;try{call(()->{source.close();return null;},()->dispose(source));}catch(Exception error){clean(()->dispose(source));throw failure(error);}}
    };}
    OutputStream output(OutputStream destination){return new OutputStream(){private boolean closed,failed;
        @Override public void write(int value)throws IOException{write(new byte[]{(byte)value},0,1);}
        @Override public void write(byte[] bytes,int offset,int length)throws IOException{
            if(offset<0||length<0||offset>bytes.length-length)throw new IndexOutOfBoundsException();if(closed||failed)throw new IOException("Zápis poskytovatele již není aktivní");
            while(length>0){int count=Math.min(length,65536);byte[] owned=Arrays.copyOfRange(bytes,offset,offset+count);try{call(()->{destination.write(owned);return null;},()->dispose(destination));}catch(Exception error){failed=true;throw failure(error);}offset+=count;length-=count;}
        }
        @Override public void flush()throws IOException{if(closed||failed)throw new IOException("Zápis poskytovatele již není aktivní");try{call(()->{destination.flush();return null;},()->dispose(destination));}catch(Exception error){failed=true;throw failure(error);}}
        @Override public void close()throws IOException{if(closed)return;closed=true;try{call(()->{destination.close();return null;},()->dispose(destination));}catch(Exception error){clean(()->dispose(destination));throw failure(error);}}
    };}
    @Override public void close(){workers.shutdownNow();cleanup.shutdownNow();}
}
