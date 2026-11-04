package cz.zamerovac.app;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.*;
import java.io.File;
import java.io.IOException;

/** Local, seekable playback. Never rewrites or transcodes the imported original. */
public final class VideoActivity extends Activity {
    private final Handler handler=new Handler(Looper.getMainLooper());
    private VideoView video;
    private TextView status;
    private LinearLayout controls;
    private FrameLayout root;
    private Button leaveFullscreen;
    private boolean failed,paused,prepared,rendered,buffering,fullscreen,playWhenPrepared=true;
    private int position;
    private Uri uri;
    private String mime;
    private final Runnable timeout=()->failPlayback("Video se nepodařilo načíst včas.");

    /** No caller-provided path/URI and no symlink escaping the app's media directory. */
    static File localMedia(Context context,String id)throws IOException {
        if(id==null||!id.matches("[a-zA-Z0-9_-]{3,120}"))throw new IOException("Neplatný soubor");
        File directory=new File(context.getFilesDir(),"media").getCanonicalFile();
        File file=new File(directory,id).getCanonicalFile();
        if(!directory.equals(file.getParentFile())||!file.isFile())throw new IOException("Chybí soubor");
        return file;
    }
    @Override public void onCreate(Bundle saved){
        super.onCreate(saved);
        String id=getIntent().getStringExtra("mediaId");
        try{localMedia(this,id);}catch(IOException ex){finish();return;}
        uri=new Uri.Builder().scheme("content").authority(getPackageName()+".files").appendPath(id).build();
        mime=getSharedPreferences("zamerovac",0).getString("mime-"+id,"video/*");
        if(!mime.startsWith("video/"))mime="video/*"; // A chooser hint, never a metadata write.
        position=saved==null?0:Math.max(0,saved.getInt("position",0));
        playWhenPrepared=saved==null||saved.getBoolean("playing",true);
        root=new FrameLayout(this);root.setBackgroundColor(Color.BLACK);
        LinearLayout layout=new LinearLayout(this);layout.setOrientation(LinearLayout.VERTICAL);
        root.addView(layout,new FrameLayout.LayoutParams(-1,-1));
        video=new VideoView(this){
            @Override public void start(){
                playWhenPrepared=true;
                if(!failed&&!rendered){status.setText("Načítám video…");armTimeout();}
                super.start();
            }
            @Override public void pause(){playWhenPrepared=false;super.pause();}
        };
        LinearLayout.LayoutParams videoSpace=new LinearLayout.LayoutParams(-1,0,1);videoSpace.gravity=Gravity.CENTER;
        layout.addView(video,videoSpace);
        status=new TextView(this);status.setTextColor(Color.WHITE);status.setGravity(Gravity.CENTER);
        status.setPadding(16,16,16,16);status.setText("Načítám video…");layout.addView(status);
        controls=new LinearLayout(this);controls.setOrientation(LinearLayout.VERTICAL);layout.addView(controls);
        Button enterFullscreen=new Button(this);enterFullscreen.setText("Celá obrazovka");
        enterFullscreen.setContentDescription("Přehrát video na celé obrazovce");
        enterFullscreen.setOnClickListener(v->setFullscreen(true));controls.addView(enterFullscreen);
        Button external=new Button(this);external.setText("Otevřít v jiném přehrávači");
        external.setOnClickListener(v->{
            video.pause();
            try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mime)
                .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION),"Otevřít video"));}
            catch(Exception e){status.setText("Pro tento formát není dostupný jiný přehrávač.");}
        });controls.addView(external);
        Button close=new Button(this);close.setText("Zavřít video");close.setOnClickListener(v->finish());controls.addView(close);
        leaveFullscreen=new Button(this);leaveFullscreen.setText("⤢ Zpět");
        leaveFullscreen.setContentDescription("Zpět z celé obrazovky");leaveFullscreen.setMinHeight(dp(48));
        leaveFullscreen.setOnClickListener(v->setFullscreen(false));
        root.addView(leaveFullscreen,new FrameLayout.LayoutParams(-2,-2,Gravity.TOP|Gravity.RIGHT));
        root.setOnApplyWindowInsetsListener((view,insets)->{
            int left,top,right,bottom;
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets bars=insets.getInsetsIgnoringVisibility(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                left=bars.left;top=bars.top;right=bars.right;bottom=bars.bottom;
            }else{left=insets.getStableInsetLeft();top=insets.getStableInsetTop();right=insets.getStableInsetRight();bottom=insets.getStableInsetBottom();}
            root.setPadding(fullscreen?0:left,fullscreen?0:top,fullscreen?0:right,fullscreen?0:bottom);
            FrameLayout.LayoutParams exit=(FrameLayout.LayoutParams)leaveFullscreen.getLayoutParams();
            exit.topMargin=top+dp(8);exit.rightMargin=right+dp(8);leaveFullscreen.setLayoutParams(exit);
            return insets;
        });
        setContentView(root);
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
            android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        setFullscreen(saved!=null&&saved.getBoolean("fullscreen",false));
        MediaController playback=new MediaController(this);playback.setAnchorView(video);video.setMediaController(playback);
        video.setOnErrorListener((player,what,extra)->{failPlayback("Video nelze přehrát. Formát nebo kodek nemusí být podporován.");return true;});
        video.setOnPreparedListener(player->{
            if(failed)return;
            prepared=true;handler.removeCallbacks(timeout);status.setText("Video připraveno.");
            if(position>0)video.seekTo(position);
            if(!paused&&playWhenPrepared)video.start();
        });
        video.setOnCompletionListener(player->{if(!failed){playWhenPrepared=false;handler.removeCallbacks(timeout);status.setText("Video skončilo.");}});
        video.setOnInfoListener((player,what,extra)->{
            if(failed)return true;
            if(what==MediaPlayer.MEDIA_INFO_BUFFERING_START){if(!buffering)armTimeout();buffering=true;status.setText("Načítám video…");}
            if(what==MediaPlayer.MEDIA_INFO_BUFFERING_END||what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START){
                if(what==MediaPlayer.MEDIA_INFO_VIDEO_RENDERING_START)rendered=true;
                buffering=false;handler.removeCallbacks(timeout);status.setText("");
            }
            return false;
        });
        armTimeout();video.setVideoURI(uri);
    }
    private int dp(int value){return Math.round(value*getResources().getDisplayMetrics().density);}
    private void setFullscreen(boolean enabled){
        fullscreen=enabled;controls.setVisibility(enabled?View.GONE:View.VISIBLE);
        status.setVisibility(enabled&&!failed?View.GONE:View.VISIBLE);
        leaveFullscreen.setVisibility(enabled?View.VISIBLE:View.GONE);
        applySystemBars();root.requestApplyInsets(); // Reuse the same VideoView and decoder.
    }
    @SuppressWarnings("deprecation") private void applySystemBars(){
        int layout=View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;
        if(fullscreen)getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if(Build.VERSION.SDK_INT>=30){
            getWindow().setDecorFitsSystemWindows(false);
            WindowInsetsController bars=getWindow().getInsetsController();
            if(bars!=null){
                bars.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                if(fullscreen)bars.hide(WindowInsets.Type.systemBars());else bars.show(WindowInsets.Type.systemBars());
            }
        }else getWindow().getDecorView().setSystemUiVisibility(layout|(fullscreen?
            View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY:0));
    }
    private void handleBack(){if(fullscreen)setFullscreen(false);else finish();}
    @Override @SuppressWarnings("deprecation") public void onBackPressed(){handleBack();}
    @Override public void onWindowFocusChanged(boolean focused){super.onWindowFocusChanged(focused);if(focused&&root!=null)applySystemBars();}
    private void armTimeout(){handler.removeCallbacks(timeout);if(!failed&&!paused)handler.postDelayed(timeout,20000);}
    private void failPlayback(String message){
        if(failed)return;failed=true;handler.removeCallbacks(timeout);
        if(video!=null)video.stopPlayback();if(status!=null){status.setVisibility(View.VISIBLE);status.setText(message);}
    }
    @Override protected void onPause(){
        paused=true;if(video!=null){
            if(prepared)position=video.getCurrentPosition();
            boolean playing=playWhenPrepared;video.pause();playWhenPrepared=playing;
        }
        handler.removeCallbacks(timeout);super.onPause();
    }
    @Override protected void onResume(){super.onResume();paused=false;if(video!=null&&!failed&&(!prepared||buffering))armTimeout();}
    @Override protected void onSaveInstanceState(Bundle saved){
        saved.putInt("position",video==null||!prepared||paused?position:video.getCurrentPosition());
        saved.putBoolean("fullscreen",fullscreen);saved.putBoolean("playing",playWhenPrepared);super.onSaveInstanceState(saved);
    }
    @Override protected void onDestroy(){handler.removeCallbacksAndMessages(null);if(video!=null)video.stopPlayback();super.onDestroy();}
}
