package cz.zamerovac.app;
import android.content.*;
import android.database.MatrixCursor;
import android.net.*;
import android.provider.DocumentsContract.Document;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import java.io.*;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class DocumentBackupStoreTest {
 static final String TREE="content://synthetic.documents/tree/root";
 @Test public void nullOrDeniedProviderIsNeverConsideredAnEmptySuccessfulHistory()throws Exception{
  Context context=mock(Context.class);ContentResolver resolver=mock(ContentResolver.class);when(context.getContentResolver()).thenReturn(resolver);DocumentBackupStore store=new DocumentBackupStore(context,TREE);
  try{store.list("backups/v2/devices");fail("Null cursor accepted as empty");}catch(IOException expected){assertTrue(expected.getMessage().contains("nevrátil"));}
  when(resolver.query(any(Uri.class),any(String[].class),isNull(),isNull(),isNull())).thenThrow(new SecurityException("synthetic permission revoked"));try{store.list("backups/v2/devices");fail("Revoked provider accepted");}catch(SecurityException expected){assertEquals("synthetic permission revoked",expected.getMessage());}
  verify(resolver,never()).openOutputStream(any(Uri.class),anyString());
 }
 @Test public void duplicateProviderNamesAndUnsafeNamespaceCannotSelectAnOverwriteTarget()throws Exception{
  Context context=mock(Context.class);ContentResolver resolver=mock(ContentResolver.class);when(context.getContentResolver()).thenReturn(resolver);MatrixCursor cursor=new MatrixCursor(new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE});cursor.addRow(new Object[]{"first","Zamerovac-zalohy",Document.MIME_TYPE_DIR,0});cursor.addRow(new Object[]{"second","Zamerovac-zalohy",Document.MIME_TYPE_DIR,0});when(resolver.query(any(Uri.class),any(String[].class),isNull(),isNull(),isNull())).thenReturn(cursor);DocumentBackupStore store=new DocumentBackupStore(context,TREE);
  try{store.create("backups/v2/blobs/"+"a".repeat(64));fail("Ambiguous provider target written");}catch(IOException expected){assertTrue(expected.getMessage().contains("nejednoznačné"));}
  for(String path:new String[]{"sync/v2/projects.json","backups/v2/../projects.json","/backups/v2/secret"})try{store.open(path);fail("Unsafe path accepted");}catch(IOException expected){}verify(resolver,never()).openOutputStream(any(Uri.class),anyString());
 }
 @Test public void cloudProviderNeedsUnmeteredNetworkOrOneExplicitException()throws Exception{
  Context context=mock(Context.class);String local="content://com.android.externalstorage.documents/tree/primary";assertTrue(BackupNetwork.allowed(context,local,false));assertFalse(BackupNetwork.allowed(context,TREE,false));assertTrue(BackupNetwork.allowed(context,TREE,true));ConnectivityManager network=mock(ConnectivityManager.class);Network active=mock(Network.class);when(context.getSystemService(Context.CONNECTIVITY_SERVICE)).thenReturn(network);when(network.getActiveNetwork()).thenReturn(active);NetworkCapabilities capabilities=new NetworkCapabilities();when(network.getNetworkCapabilities(active)).thenReturn(capabilities);assertFalse(BackupNetwork.allowed(context,TREE,false));capabilities.addCapability(NetworkCapabilities.NET_CAPABILITY_NOT_METERED);assertTrue(BackupNetwork.allowed(context,TREE,false));
 }
}
