package cz.zamerovac.app;

import android.content.SharedPreferences;
import android.media.MediaRecorder;
import java.io.*;

/** Recorder lifecycle is independent of the database lock; only a complete recording is published. */
final class AudioCapture implements AutoCloseable {
    interface Recorder {void start(File output)throws Exception;void stop()throws Exception;void release();}
    interface Factory {Recorder create()throws Exception;}
    private final Factory factory;
    private Recorder recorder;private org.json.JSONObject entry;private final PendingAudio pending;private volatile boolean active;
    AudioCapture(File directory,SharedPreferences prefs){this(directory,prefs,()->new Recorder(){
        final MediaRecorder nativeRecorder=new MediaRecorder();
        public void start(File output)throws Exception{nativeRecorder.setAudioSource(MediaRecorder.AudioSource.MIC);nativeRecorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);nativeRecorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);nativeRecorder.setOutputFile(output.getAbsolutePath());nativeRecorder.prepare();nativeRecorder.start();}
        public void stop(){nativeRecorder.stop();}
        public void release(){nativeRecorder.release();}
    });}
    AudioCapture(File directory,SharedPreferences prefs,Factory factory){this(directory,prefs,factory,new PendingAudio(directory,prefs));}
    AudioCapture(File directory,SharedPreferences prefs,Factory factory,PendingAudio pending){this.factory=factory;this.pending=pending;}
    boolean active(){return active;}
    synchronized boolean start(String requested)throws Exception{
        if(active)return false;active=true;
        try{entry=pending.begin(requested);recorder=factory.create();recorder.start(pending.temporary(entry));return true;}
        catch(Exception failure){close();throw failure;}
    }
    synchronized boolean stop()throws Exception{
        if(!active||recorder==null)return false;
        try{recorder.stop();release();pending.complete(entry);return true;}
        finally{close();}
    }
    private void release(){Recorder previous=recorder;recorder=null;if(previous!=null)try{previous.release();}catch(Exception ignored){}}
    @Override public synchronized void close(){release();pending.abandon(entry);entry=null;active=false;}
}
