package cz.zamerovac.app;

import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import android.app.Application;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.widget.*;
import android.media.MediaPlayer;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.zip.*;
import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.android.controller.ActivityController;
import org.robolectric.annotation.*;
import org.robolectric.shadows.ShadowVideoView;
import org.robolectric.util.ReflectionHelpers;

@RunWith(RobolectricTestRunner.class)
@Config(sdk=35)
@LooperMode(LooperMode.Mode.PAUSED)
public class VideoReviewTest {
    // Routing/storage fixture only, not evidence of hardware codec playback.
    private final byte[] original={0,0,0,12,'f','t','y','p','i','s','o','m'};
    private Application app;
    @Before public void setup(){app=RuntimeEnvironment.getApplication();}
    private File video(String id)throws Exception {
        File directory=new File(app.getFilesDir(),"media");directory.mkdirs();File file=new File(directory,id);
        java.nio.file.Files.write(file.toPath(),original);return file;
    }
    private Intent intent(String id){return new Intent(app,VideoActivity.class).putExtra("mediaId",id);}
    private static <T> T field(Object object,String name){return ReflectionHelpers.getField(object,name);}
    private boolean fullscreen(VideoActivity activity){return (activity.getWindow().getAttributes().flags&WindowManager.LayoutParams.FLAG_FULLSCREEN)!=0;}
    private void toggle(VideoActivity activity){((LinearLayout)field(activity,"controls")).getChildAt(0).performClick();}

    @Test public void legacyAndRestoredVideoWithoutMimeUseInternalPlayer()throws Exception {
        File source=video("legacy-video");
        JSONObject legacy=new JSONObject("{\"schema\":1,\"records\":[{\"id\":\"video-record\",\"kind\":\"video\",\"title\":\"Staré video\",\"media\":[\"legacy-video\"]}]}");
        File zip=File.createTempFile("legacy-video-",".zip",app.getCacheDir());
        try(ZipOutputStream out=new ZipOutputStream(new FileOutputStream(zip))){
            out.putNextEntry(new ZipEntry("projects.json"));out.write(legacy.toString().getBytes(StandardCharsets.UTF_8));out.closeEntry();
            out.putNextEntry(new ZipEntry("media/legacy-video"));out.write(original);out.closeEntry();
            // Deliberately no media-meta.json or MIME entry.
        }
        String before=legacy.toString();
        BackupImporter.Result restored=BackupImporter.importZip(app,Uri.fromFile(zip),new JSONObject("{\"schema\":1,\"records\":[]}"),app.getSharedPreferences("zamerovac",0));
        JSONObject copy=restored.data.getJSONArray("records").getJSONObject(1);
        assertEquals("video",copy.getString("kind"));String copiedId=copy.getJSONArray("media").getString(0);
        assertNotEquals("legacy-video",copiedId);assertEquals(before,legacy.toString());
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();
            for(String id:new String[]{"legacy-video",copiedId}){
                assertFalse(activity.new JsApi().getMediaMime(id).startsWith("video/"));
                activity.new JsApi().openVideo(id);
                Intent opened=Shadows.shadowOf(activity).getNextStartedActivity();
                assertEquals(VideoActivity.class.getName(),opened.getComponent().getClassName());assertEquals(id,opened.getStringExtra("mediaId"));
            }
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(source.toPath()));
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(new File(app.getFilesDir(),"media/"+copiedId).toPath()));
    }
    @Test public void explicitVideoEntryRejectsInvalidMissingAndEscapingFiles()throws Exception {
        File outside=new File(app.getFilesDir(),"project-data");java.nio.file.Files.write(outside.toPath(),original);
        File directory=new File(app.getFilesDir(),"media");directory.mkdirs();new File(directory,"directory-only").mkdirs();
        java.nio.file.Files.createSymbolicLink(new File(directory,"escaped-video").toPath(),outside.toPath());
        try(ActivityController<MainActivity> controller=Robolectric.buildActivity(MainActivity.class).setup()){
            MainActivity activity=controller.get();
            for(String id:new String[]{null,"","../project-data","content://other/file","missing-video","directory-only","escaped-video"}){
                activity.new JsApi().openVideo(id);assertNull(Shadows.shadowOf(activity).getNextStartedActivity());
                try(ActivityController<VideoActivity> player=Robolectric.buildActivity(VideoActivity.class,intent(id)).create()){
                    assertTrue(player.get().isFinishing());
                }
            }
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(outside.toPath()));
    }
    @Test public void fullscreenAndBackReusePlayerAndPreservePosition()throws Exception {
        File file=video("fullscreen-video");
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).setup()){
            VideoActivity activity=controller.get();VideoView player=field(activity,"video");
            Shadows.shadowOf(player).getOnPreparedListener().onPrepared(mock(MediaPlayer.class));
            player.seekTo(17239);player.pause();
            toggle(activity);assertTrue(fullscreen(activity));assertSame(player,field(activity,"video"));assertEquals(17239,player.getCurrentPosition());assertFalse(player.isPlaying());
            assertEquals(View.GONE,((View)field(activity,"controls")).getVisibility());assertEquals(View.GONE,((View)field(activity,"status")).getVisibility());
            assertEquals(View.VISIBLE,((View)field(activity,"leaveFullscreen")).getVisibility());
            ((View)field(activity,"leaveFullscreen")).performClick();assertFalse(fullscreen(activity));assertEquals(17239,player.getCurrentPosition());
            toggle(activity);activity.onBackPressed();assertFalse(fullscreen(activity));assertFalse(activity.isFinishing());
            activity.onBackPressed();assertTrue(activity.isFinishing());
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(file.toPath()));
    }
    @Test public void recreationPreservesFullscreenSeekAndPlayPauseState()throws Exception {
        File file=video("rotation-video");
        for(boolean playing:new boolean[]{true,false}){
            Bundle state=new Bundle();
            try(ActivityController<VideoActivity> old=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).setup()){
                VideoActivity activity=old.get();VideoView player=field(activity,"video");
                Shadows.shadowOf(player).getOnPreparedListener().onPrepared(mock(MediaPlayer.class));player.seekTo(28451);
                if(!playing)player.pause();toggle(activity);old.pause();
                player.seekTo(0); // A stopped/released surface may no longer report its old position.
                old.saveInstanceState(state).stop();
            }
            assertEquals(28451,state.getInt("position"));assertEquals(playing,state.getBoolean("playing"));
            try(ActivityController<VideoActivity> next=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).create(state).start().resume().visible()){
                VideoActivity activity=next.get();assertTrue(fullscreen(activity));
                VideoView player=field(activity,"video");ShadowVideoView shadow=Shadows.shadowOf(player);
                shadow.getOnPreparedListener().onPrepared(mock(MediaPlayer.class));
                assertEquals(28451,player.getCurrentPosition());assertEquals(playing,player.isPlaying());
                ((View)field(activity,"leaveFullscreen")).performClick();assertEquals(28451,player.getCurrentPosition());
            }
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(file.toPath()));
    }
    @Test public void rotationBeforePreparationDoesNotLosePendingSeek()throws Exception {
        File file=video("pending-video");Bundle incoming=new Bundle();incoming.putInt("position",19123);incoming.putBoolean("fullscreen",true);incoming.putBoolean("playing",false);
        Bundle outgoing=new Bundle();
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).create(incoming).start().resume()){
            controller.pause().saveInstanceState(outgoing).stop();
        }
        assertEquals(19123,outgoing.getInt("position"));assertTrue(outgoing.getBoolean("fullscreen"));assertFalse(outgoing.getBoolean("playing"));
    }
    @Test @Config(sdk=26) public void legacyFullscreenHidesNavigationAndRestoresSystemBars()throws Exception {
        File file=video("legacy-screen-video");
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).setup()){
            VideoActivity activity=controller.get();toggle(activity);
            int flags=activity.getWindow().getDecorView().getSystemUiVisibility();
            assertTrue((flags&View.SYSTEM_UI_FLAG_FULLSCREEN)!=0);assertTrue((flags&View.SYSTEM_UI_FLAG_HIDE_NAVIGATION)!=0);assertTrue((flags&View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY)!=0);
            activity.onBackPressed();flags=activity.getWindow().getDecorView().getSystemUiVisibility();
            assertEquals(0,flags&(View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY));
        }
    }
    @Test public void fullscreenErrorKeepsVisibleMessageAndEscape()throws Exception {
        File file=video("broken-video");
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).setup()){
            VideoActivity activity=controller.get();toggle(activity);VideoView player=field(activity,"video");
            assertTrue(Shadows.shadowOf(player).getOnErrorListener().onError(null,1,0));
            assertEquals(View.VISIBLE,((View)field(activity,"status")).getVisibility());assertEquals(View.VISIBLE,((View)field(activity,"leaveFullscreen")).getVisibility());
            ((View)field(activity,"leaveFullscreen")).performClick();assertFalse(fullscreen(activity));assertEquals(View.VISIBLE,((View)field(activity,"controls")).getVisibility());
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(file.toPath()));
    }
    @Test public void rotatingBothWaysRecreatesFullscreenWithExactPosition()throws Exception {
        File file=video("orientation-video");
        try(ActivityController<VideoActivity> controller=Robolectric.buildActivity(VideoActivity.class,intent(file.getName())).setup()){
            VideoActivity activity=controller.get();VideoView player=field(activity,"video");
            Shadows.shadowOf(player).getOnPreparedListener().onPrepared(mock(MediaPlayer.class));player.seekTo(36517);player.pause();toggle(activity);
            for(int orientation:new int[]{android.content.res.Configuration.ORIENTATION_LANDSCAPE,android.content.res.Configuration.ORIENTATION_PORTRAIT}){
                android.content.res.Configuration configuration=new android.content.res.Configuration(activity.getResources().getConfiguration());
                configuration.orientation=orientation;configuration.screenWidthDp=orientation==2?960:600;configuration.screenHeightDp=orientation==2?600:960;
                controller.configurationChange(configuration);activity=controller.get();player=field(activity,"video");
                if(!(boolean)VideoReviewTest.<Boolean>field(activity,"prepared"))Shadows.shadowOf(player).getOnPreparedListener().onPrepared(mock(MediaPlayer.class));
                assertTrue(fullscreen(activity));assertEquals(36517,player.getCurrentPosition());assertFalse(player.isPlaying());
            }
        }
        assertArrayEquals(original,java.nio.file.Files.readAllBytes(file.toPath()));
    }

}
