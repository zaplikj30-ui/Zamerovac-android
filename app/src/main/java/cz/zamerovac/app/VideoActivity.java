package cz.zamerovac.app;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.widget.*;
import java.io.File;

/** Local, seekable playback. Never rewrites or transcodes the imported original. */
public final class VideoActivity extends Activity {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private VideoView video;
    private TextView status;
    private boolean failed,paused,rendered,buffering;
    private int position;
    private Uri uri;
    private String mime;
    private final Runnable timeout=()->failPlayback("Video se nepodařilo načíst včas.");

    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        String id=getIntent().getStringExtra("mediaId");
        if(id==null||!id.matches("[a-zA-Z0-9_-]{3,120}")||
                !new File(new File(getFilesDir(),"media"),id).isFile()){finish();return;}
        uri=new Uri.Builder().scheme("content").authority(getPackageName()+".files").appendPath(id).build();
        mime=getSharedPreferences("zamerovac",0).getString("mime-"+id,"video/*");
        position=saved==null?0:saved.getInt("position",0);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
        layout.setBackgroundColor(Color.BLACK);
        video=new VideoView(this);layout.addView(video,new LinearLayout.LayoutParams(-1,0,1));
        status=new TextView(this);status.setTextColor(Color.WHITE);status.setGravity(Gravity.CENTER);
        status.setPadding(16,16,16,16);status.setText("Načítám video…");layout.addView(status);
        Button external=new Button(this);external.setText("Otevřít v jiném přehrávači");
        external.setOnClickListener(v->{
            video.pause();
            try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Otevřít video"));}
            catch(Exception e){status.setText("Pro tento formát není dostupný jiný přehrávač.");}
        });layout.addView(external);
        Button close=new Button(this);close.setText("Zavřít video");close.setOnClickListener(v->finish());layout.addView(close);
        setContentView(layout);
        MediaController controls=new MediaController(this);controls.setAnchorView(video);video.setMediaController(controls);
        video.setOnErrorListener((player,what,extra)->{failPlayback("Video nelze přehrát. Formát nebo kodek nemusí být podporován.");return true;});
        video.setOnPreparedListener(player->{
            if(failed)return;
            status.setText("Načítám video…");
            if(position>0)video.seekTo(position);
            if(!paused)video.start();
        });
        video.setOnCompletionListener(player->{handler.removeCallbacks(timeout);status.setText("Video skončilo.");});
        video.setOnInfoListener((player,what,extra)->{
            if(failed)return true;
            if(what==MediaPlayer.MEDIA_INFO_BUFFERING_START){buffering=true;status.setText("Načítám video…");armTimeout();}
            if(what==MediaPlayer.MEDIA_INFO_BUFFERING_END||what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START){
                if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)rendered=true;
                buffering=false;handler.removeCallbacks(timeout);status.setText("");
            }
            return false;
        });
        armTimeout();video.setVideoURI(uri);
    }
    private void armTimeout(){handler.removeCallbacks(timeout);if(!failed)handler.postDelayed(timeout,20000);}
    private void failPlayback(String message){
        if(failed)return;failed=true;handler.removeCallbacks(timeout);
        if(video!=null)video.stopPlayback();if(status!=null)status.setText(message);
    }
    @Override protected void onPause(){
        paused=true;if(video!=null){position=video.getCurrentPosition();video.pause();}
        handler.removeCallbacks(timeout);super.onPause();
    }
    @Override protected void onResume(){super.onResume();paused=false;if(video!=null&&!failed&&(!rendered||buffering))armTimeout();}
    @Override protected void onSaveInstanceState(Bundle saved){
        saved.putInt("position",video==null?position:video.getCurrentPosition());super.onSaveInstanceState(saved);
    }
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(video!=null)video.stopPlayback();super.onDestroy();}
}
