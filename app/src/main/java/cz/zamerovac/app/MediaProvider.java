package cz.zamerovac.app;
import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.File;
import java.io.FileNotFoundException;

/** Read-only provider for sharing user-imported media with Android viewers. */
public class MediaProvider extends ContentProvider {
    private String id(Uri uri){String s=uri.getLastPathSegment();return s!=null&&s.matches("[a-zA-Z0-9_-]{3,120}")?s:null;}
    @Override public boolean onCreate(){return true;}
    @Override public String getType(Uri uri){String id=id(uri);return id==null?null:getContext().getSharedPreferences("zamerovac",0).getString("mime-"+id,"application/octet-stream");}
    @Override public ParcelFileDescriptor openFile(Uri uri,String mode)throws FileNotFoundException{
        String id=id(uri);if(id==null||!"r".equals(mode))throw new FileNotFoundException();
        return ParcelFileDescriptor.open(new File(new File(getContext().getFilesDir(),"media"),id),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public Cursor query(Uri uri,String[] projection,String selection,String[] args,String order){
        String id=id(uri);if(id==null)return null;
        File f=new File(new File(getContext().getFilesDir(),"media"),id);
        String[] columns=projection==null?new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE}:projection;
        MatrixCursor c=new MatrixCursor(columns);Object[] row=new Object[columns.length];
        String name=getContext().getSharedPreferences("zamerovac",0).getString("name-"+id,id);
        for(int i=0;i<columns.length;i++){if(OpenableColumns.DISPLAY_NAME.equals(columns[i]))row[i]=name;else if(OpenableColumns.SIZE.equals(columns[i]))row[i]=f.length();}
        c.addRow(row);return c;
    }
    @Override public Uri insert(Uri u,ContentValues v){throw new UnsupportedOperationException();}
    @Override public int delete(Uri u,String s,String[] a){throw new UnsupportedOperationException();}
    @Override public int update(Uri u,ContentValues v,String s,String[] a){throw new UnsupportedOperationException();}
}
