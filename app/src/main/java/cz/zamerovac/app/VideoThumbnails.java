package cz.zamerovac.app;

import android.graphics.*;
import android.media.MediaMetadataRetriever;
import android.os.Build;
import java.io.*;
import java.util.UUID;
import java.util.concurrent.*;

/** Bounded background decoding. A broken codec cannot hold the database/purge lock. */
final class VideoThumbnails implements AutoCloseable {
    private final java.util.function.Supplier<MediaMetadataRetriever> decoder;
    private final long waitMillis;
    VideoThumbnails(){this(MediaMetadataRetriever::new,5000);}
    VideoThumbnails(java.util.function.Supplier<MediaMetadataRetriever> decoder,long waitMillis){this.decoder=decoder;this.waitMillis=waitMillis;}
    private final ThreadPoolExecutor workers=new ThreadPoolExecutor(1,2,30,TimeUnit.SECONDS,
        new ArrayBlockingQueue<>(4),task->{Thread thread=new Thread(task,"VideoThumbnail");thread.setDaemon(true);return thread;});
    InputStream open(File source,File directory)throws IOException {
        if(!source.isFile())return null;
        File cached=new File(directory,source.getName()+".jpg"),failed=new File(directory,source.getName()+".failed");
        if(cached.isFile()&&cached.lastModified()>=source.lastModified())return new FileInputStream(cached);
        if(failed.isFile()&&failed.lastModified()>=source.lastModified())return null;
        try{
            Future<File> job=workers.submit(()->generate(source,directory,cached,failed));
            File ready=job.get(waitMillis,TimeUnit.MILLISECONDS);
            return ready==null?null:new FileInputStream(ready);
        }catch(InterruptedException ex){Thread.currentThread().interrupt();return null;}
        catch(ExecutionException|TimeoutException|RejectedExecutionException ex){return null;}
    }
    private File generate(File source,File directory,File cached,File failed)throws IOException {
        if(!directory.isDirectory()&&!directory.mkdirs()&&!directory.isDirectory())return null;
        long modified=source.lastModified();
        MediaMetadataRetriever retriever=decoder.get();Bitmap frame=null,thumb=null;
        File temporary=new File(directory,source.getName()+"-"+UUID.randomUUID()+".tmp");
        boolean success=false,unsupported=false;
        try{
            retriever.setDataSource(source.getAbsolutePath());
            if(Build.VERSION.SDK_INT>=27)frame=retriever.getScaledFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC,288,288);
            else{
                // API 26 cannot sample a frame. Decline huge/unknown dimensions safely.
                int w=Integer.parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH));
                int h=Integer.parseInt(retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT));
                if(w<=0||h<=0||(long)w*h>4000000){unsupported=true;return null;}
                frame=retriever.getFrameAtTime(0,MediaMetadataRetriever.OPTION_CLOSEST_SYNC);
            }
            if(frame==null){unsupported=true;return null;}
            thumb=Bitmap.createBitmap(144,144,Bitmap.Config.RGB_565);
            float side=Math.min(frame.getWidth(),frame.getHeight());
            Rect crop=new Rect((int)((frame.getWidth()-side)/2),(int)((frame.getHeight()-side)/2),
                (int)((frame.getWidth()+side)/2),(int)((frame.getHeight()+side)/2));
            new Canvas(thumb).drawBitmap(frame,crop,new RectF(0,0,144,144),new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG));
            try(OutputStream out=new FileOutputStream(temporary)){if(!thumb.compress(Bitmap.CompressFormat.JPEG,82,out))return null;}
            synchronized(TrashPurger.LOCK){
                if(Thread.currentThread().isInterrupted()||!source.isFile()||source.lastModified()!=modified)return null;
                java.nio.file.Files.move(temporary.toPath(),cached.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
                failed.delete();success=true;return cached;
            }
        }catch(RuntimeException ex){unsupported=true;return null;}
        finally{
            if(thumb!=null)thumb.recycle();if(frame!=null)frame.recycle();
            try{retriever.release();}catch(Exception ignored){}
            temporary.delete();
            if(!success&&unsupported&&!Thread.currentThread().isInterrupted())synchronized(TrashPurger.LOCK){
                if(source.isFile()&&source.lastModified()==modified){
                    try{failed.createNewFile();failed.setLastModified(modified);}catch(IOException ignored){}
                }
            }
        }
    }
    @Override public void close(){workers.shutdownNow();}
}
