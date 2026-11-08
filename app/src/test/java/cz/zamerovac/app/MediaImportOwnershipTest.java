package cz.zamerovac.app;

import android.content.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.IOException;
import java.util.UUID;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class MediaImportOwnershipTest {
    SharedPreferences prefs;
    @Before public void setup(){
        prefs=RuntimeEnvironment.getApplication().getSharedPreferences("n4-"+UUID.randomUUID(),0);
    }
    @Test public void receiptSurvivesRestartAndRejectsReassignment()throws Exception {
        MediaImportOwnership owner=new MediaImportOwnership(prefs);
        owner.reserve("photo-111","picker-one");
        assertEquals("picker-one",owner.owner("photo-111"));
        assertFalse(owner.isPublished("photo-111"));
        try{owner.reserve("photo-111","picker-two");fail("Reassigned receipt");}catch(IOException expected){}
        assertFalse(owner.published("photo-111","picker-two"));
        assertTrue(owner.published("photo-111","picker-one"));
        MediaImportOwnership restarted=new MediaImportOwnership(prefs);
        assertEquals("picker-one",restarted.owner("photo-111"));
        assertTrue(restarted.isPublished("photo-111"));
    }
    @Test public void invalidIdsOrFailedCommitCannotAuthorizeUnownedMedia()throws Exception {
        MediaImportOwnership owner=new MediaImportOwnership(prefs);
        for(String id:new String[]{"../outside","x",""})try{owner.reserve(id,"picker-one");fail("Invalid id");}catch(IOException expected){}
        try{owner.reserve("photo-222","bad/token");fail("Invalid token");}catch(IOException expected){}
        assertNull(owner.owner("photo-222"));
        SharedPreferences denied=mock(SharedPreferences.class);
        SharedPreferences.Editor editor=mock(SharedPreferences.Editor.class);
        when(denied.edit()).thenReturn(editor);
        when(editor.putString(anyString(),anyString())).thenReturn(editor);
        when(editor.commit()).thenReturn(false);
        try{new MediaImportOwnership(denied).reserve("photo-333","picker-one");fail("Unconfirmed receipt");}
        catch(IOException expected){}
        verify(editor).commit();
    }
    @Test public void abandonedRequestRemainsTrackedWithoutDeletingMedia()throws Exception {
        MediaImportOwnership owner=new MediaImportOwnership(prefs);
        owner.reserve("photo-444","picker-three");
        assertFalse(owner.published("photo-444","picker-other"));
        assertEquals("picker-three",new MediaImportOwnership(prefs).owner("photo-444"));
        assertFalse(owner.isPublished("photo-444"));
        assertTrue(prefs.contains("import-owner-photo-444"));
    }
}
