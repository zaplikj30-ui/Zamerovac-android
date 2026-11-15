package cz.zamerovac.app;

import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.OpenableColumns;
import java.io.*;
import java.util.function.BooleanSupplier;

/** Provider calls and media copies run on the caller's bounded ingest worker, never the UI thread. */
final class MediaIngest {
    static final class Metadata {final String mime,name;Metadata(String mime,String name){this.mime=mime;this.name=name;}}
    private final Context context;private final SharedPreferences prefs;private final ProviderIo io;private final BooleanSupplier cancelled;
    MediaIngest(Context context,SharedPreferences prefs,BooleanSupplier cancelled){this(context,prefs,cancelled,ProviderIo.SHARED);}
    MediaIngest(Context context,SharedPreferences prefs,BooleanSupplier cancelled,ProviderIo io){this.context=context;this.prefs=prefs;this.cancelled=cancelled;this.io=io;}
    private void live()throws IOException{if(cancelled.getAsBoolean()||Thread.currentThread().isInterrupted())throw new InterruptedIOException("Přidávání přílohy bylo přerušeno");}
    private void source(Uri uri)throws IOException{if(uri==null||!"content".equals(uri.getScheme())||uri.getAuthority()==null||!uri.getAuthority().matches("(?:[0-9]{1,10}@)?[a-zA-Z0-9_.-]+"))throw new IOException("Nepovolený zdroj přílohy");}
    Metadata metadata(Uri uri)throws Exception{
        source(uri);live();android.os.CancellationSignal signal=new android.os.CancellationSignal();
        return io.call(()->{String mime=context.getContentResolver().getType(uri),name="Příloha";if(mime==null)mime="application/octet-stream";else mime=mime.toLowerCase(java.util.Locale.ROOT);
            try(Cursor cursor=context.getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null,signal)){if(cursor!=null&&cursor.moveToFirst()&&!cursor.isNull(0))name=cursor.getString(0);}
            if(!MediaStaging.metadata(mime,name))throw new IOException("Neplatný typ nebo název přílohy");return new Metadata(mime,name);
        },signal::cancel);
    }
    File copy(Uri uri,String id,String mime,String name)throws Exception{
        source(uri);live();if(!MediaStaging.metadata(mime,name))throw new IOException("Neplatná metadata přílohy");File temporary=MediaStaging.temporary(new File(context.getFilesDir(),"media"),id);
        try{
            InputStream source=io.call(()->context.getContentResolver().openInputStream(uri),null);if(source==null)throw new IOException("Přílohu nelze číst");
            try(InputStream in=io.input(source);FileOutputStream out=new FileOutputStream(temporary)){long total=0;byte[] block=new byte[65536];int count;while((count=in.read(block))!=-1){live();total+=count;if(total>MediaStaging.LIMIT)throw new IOException("Příloha překračuje bezpečný číselný rozsah formátu");out.write(block,0,count);}out.getFD().sync();}
            live();MediaStaging.commit(temporary,id,prefs,mime,name);return new File(temporary.getParentFile(),id);
        }finally{temporary.delete();}
    }
}
