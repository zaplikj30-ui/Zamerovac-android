package cz.zamerovac.app;

import android.Manifest;
import android.app.Activity;
import android.app.AlertDialog;
import android.app.job.JobInfo;
import android.app.job.JobScheduler;
import android.bluetooth.BluetoothAdapter;
import android.bluetooth.BluetoothDevice;
import android.bluetooth.BluetoothGatt;
import android.bluetooth.BluetoothGattCallback;
import android.bluetooth.BluetoothGattCharacteristic;
import android.bluetooth.BluetoothGattDescriptor;
import android.bluetooth.BluetoothGattService;
import android.bluetooth.BluetoothSocket;
import android.bluetooth.BluetoothManager;
import android.bluetooth.le.BluetoothLeScanner;
import android.bluetooth.le.ScanCallback;
import android.bluetooth.le.ScanResult;
import android.content.ComponentName;
import android.content.ContentValues;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Canvas;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Rect;
import android.graphics.RectF;
import android.media.ExifInterface;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.database.Cursor;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.MediaStore;
import android.util.Base64;
import android.webkit.JavascriptInterface;
import android.webkit.MimeTypeMap;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.media.MediaRecorder;
import android.print.PrintManager;
import android.view.WindowManager;
import android.view.View;
import android.view.WindowInsets;
import android.view.Gravity;
import android.widget.FrameLayout;
import android.widget.Toast;
import android.webkit.WebSettings;

import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONArray;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.HashSet;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int REQUEST_FILE=20,REQUEST_TREE=21,REQUEST_CAMERA=22,REQUEST_EXPORT=23,REQUEST_PERMISSIONS=24,REQUEST_ATTACH=25,REQUEST_CAMERA_PERMISSION=26,REQUEST_PHOTO_LOCATION=27,REQUEST_BACKUP=28,REQUEST_IMPORT_BACKUP=29,REQUEST_ISSUE_EXPORT=30,REQUEST_BLUETOOTH_PERMISSION=31;
    private WebView web;
    private FrameLayout root;
    private View statusFill;
    private long lastExitPress=0;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private String cameraId;
    private String pendingPhotoLocationId;
    private String exportBase64;
    private String pendingArchiveFolderId;
    private MediaRecorder recorder;
    private FileOutputStream activeUpload;
    private String activeUploadId;
    private SharedPreferences settings;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayList<BluetoothDevice> scanned =new ArrayList<>();
    private final Map<String,String> scannedNames=new HashMap<>();
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BoschClassicReader classic;
    private ScanCallback scanCallback;
    private BluetoothGattCharacteristic boschCommand;
    private volatile boolean boschStreamEnabled=false;
    private volatile boolean syncRunning=false;
    private String recordingId;
    private String pendingMediaType="media";
    private String pendingIssueZipId;

    @Override public void onCreate(Bundle saved){super.onCreate(saved);
        settings=getSharedPreferences("zamerovac",MODE_PRIVATE);
        // Android 15/16/17 draw behind system bars: inset the WebView explicitly.
        getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION);
        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        root=new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(37,38,40));
        web=new WebView(this);
        web.setBackgroundColor(Color.rgb(37,38,40));
        root.addView(web,new FrameLayout.LayoutParams(-1,-1));
        statusFill=new View(this);
        statusFill.setBackgroundColor(Color.rgb(51,43,64));
        FrameLayout.LayoutParams barParams=new FrameLayout.LayoutParams(-1,0,Gravity.TOP);
        root.addView(statusFill,barParams);
        setContentView(root);
        root.setOnApplyWindowInsetsListener((v,insets)->{
            int top,bottom;
            if(Build.VERSION.SDK_INT>=30){
                android.graphics.Insets sys=insets.getInsets(WindowInsets.Type.systemBars()|WindowInsets.Type.displayCutout());
                top=sys.top;bottom=sys.bottom;
            }else{top=insets.getSystemWindowInsetTop();bottom=insets.getSystemWindowInsetBottom();}
            FrameLayout.LayoutParams layout=(FrameLayout.LayoutParams)web.getLayoutParams();
            if(layout.topMargin!=top||layout.bottomMargin!=bottom){
                layout.topMargin=top;layout.bottomMargin=bottom;web.setLayoutParams(layout);
            }
            FrameLayout.LayoutParams bar=(FrameLayout.LayoutParams)statusFill.getLayoutParams();
            if(bar.height!=top){bar.height=top;statusFill.setLayoutParams(bar);}
            return insets;
        });
        root.requestApplyInsets();
        if(Build.VERSION.SDK_INT>=33){
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,()->handleAndroidBack());
        }
        WebSettings ws=web.getSettings();ws.setJavaScriptEnabled(true);ws.setDomStorageEnabled(true);ws.setDatabaseEnabled(true);
        ws.setAllowFileAccess(false);ws.setAllowContentAccess(true);ws.setMediaPlaybackRequiresUserGesture(false);
        web.addJavascriptInterface(new JsApi(),"Native");
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest req){
                Uri uri=req.getUrl();if(!"appassets.androidplatform.net".equals(uri.getHost()))return null;
                String path=uri.getPath();
                try{
                    if(path.startsWith("/app/")){
                        String name=path.substring(5);if(name.contains(".."))return null;
                        String mime=name.endsWith(".js")?"application/javascript":name.endsWith(".css")?"text/css":"text/html";
                        return new WebResourceResponse(mime,"UTF-8",getAssets().open(name));
                    }
                    if(path.startsWith("/media/")){
                        String id=path.substring(7);if(!validId(id))return null;
                        File f=mediaFile(id);if(!f.isFile())return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new java.io.ByteArrayInputStream(new byte[0]));
                        String mime=mediaMime(id);
                        String range=req.getRequestHeaders().get("Range");
                        if(range==null)range=req.getRequestHeaders().get("range");
                        if(range!=null&&range.startsWith("bytes=")){
                            try{
                                String[] requestRange=range.substring(6).split("-",2);
                                long start=Long.parseLong(requestRange[0].trim());
                                long end=requestRange.length>1&&!requestRange[1].trim().isEmpty()
                                    ?Long.parseLong(requestRange[1].trim()):f.length()-1;
                                end=Math.min(end,f.length()-1);
                                if(start>=0&&start<=end){
                                    final long bytes=end-start+1;
                                    FileInputStream fileInput=new FileInputStream(f);
                                    fileInput.getChannel().position(start);
                                    InputStream limited=new java.io.FilterInputStream(fileInput){
                                        long remaining=bytes;
                                        @Override public int read() throws IOException{
                                            if(remaining<=0)return -1;
                                            int v=super.read();if(v!=-1)remaining--;return v;
                                        }
                                        @Override public int read(byte[] buf,int off,int len)throws IOException{
                                            if(remaining<=0)return -1;
                                            int n=super.read(buf,off,(int)Math.min((long)len,remaining));
                                            if(n>0)remaining-=n;return n;
                                        }
                                    };
                                    Map<String,String> hdr=new HashMap<>();
                                    hdr.put("Accept-Ranges","bytes");
                                    hdr.put("Content-Range","bytes "+start+"-"+end+"/"+f.length());
                                    hdr.put("Content-Length",Long.toString(bytes));
                                    return new WebResourceResponse(mime,null,206,"Partial Content",hdr,limited);
                                }
                            }catch(Exception ignored){}
                        }
                        Map<String,String> hdr=new HashMap<>();
                        hdr.put("Accept-Ranges","bytes");
                        hdr.put("Content-Length",Long.toString(f.length()));
                        return new WebResourceResponse(mime,null,200,"OK",hdr,new FileInputStream(f));
                    }
                    if(path.startsWith("/thumb/")){
                        String id=path.substring(7);if(!validId(id))return null;
                        InputStream in=photoThumbnail(id);
                        if(in==null)return new WebResourceResponse("text/plain","UTF-8",404,"Not Found",new HashMap<>(),new java.io.ByteArrayInputStream(new byte[0]));
                        return new WebResourceResponse("image/jpeg",null,in);
                    }
                }catch(Exception e){android.util.Log.e("Zamerovac","Read resource",e);}return null;
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                try{Intent intent=params.createIntent();startActivityForResult(intent,REQUEST_FILE);return true;}catch(Exception e){fileCallback.onReceiveValue(null);fileCallback=null;error("Výběr souboru se nezdařil");return false;}
            }
        });
        web.loadUrl("https://appassets.androidplatform.net/app/index.html");
        if(settings.getString("treeUri",null)!=null&&settings.getBoolean("autoSync",true))scheduleSync();
    }
    private File mediaFile(String id){File d=new File(getFilesDir(),"media");if(!d.exists())d.mkdirs();return new File(d,id);}
    /**
     * Small on-disk thumbnails for the record browser.
     * Decode with sampling so browsing many high-resolution customer photos
     * does not repeatedly allocate their full-resolution bitmaps.
     * The media file itself is never modified.
     */
    private InputStream photoThumbnail(String id) throws IOException {
        File source=mediaFile(id);
        if(!source.isFile())return null;
        File dir=new File(getCacheDir(),"photo-thumbs");
        if(!dir.isDirectory()&&!dir.mkdirs())throw new IOException("Cannot create thumbnails cache");
        File cached=new File(dir,id+".jpg");
        if(!cached.isFile()||cached.lastModified()<source.lastModified()){
            BitmapFactory.Options bounds=new BitmapFactory.Options();
            bounds.inJustDecodeBounds=true;
            BitmapFactory.decodeFile(source.getAbsolutePath(),bounds);
            if(bounds.outWidth<=0||bounds.outHeight<=0)return null;
            int sample=1;
            while(Math.max(bounds.outWidth/sample,bounds.outHeight/sample)>512)sample*=2;
            BitmapFactory.Options options=new BitmapFactory.Options();
            options.inSampleSize=sample;
            options.inPreferredConfig=Bitmap.Config.RGB_565;
            Bitmap decoded=BitmapFactory.decodeFile(source.getAbsolutePath(),options);
            if(decoded==null)return null;
            Bitmap oriented=decoded,thumb=null;
            try {
                int orientation=ExifInterface.ORIENTATION_NORMAL;
                try {
                    orientation=new ExifInterface(source.getAbsolutePath()).getAttributeInt(
                        ExifInterface.TAG_ORIENTATION,ExifInterface.ORIENTATION_NORMAL);
                } catch(Exception e){android.util.Log.d("Zamerovac","Thumbnail EXIF unavailable",e);}
                int angle=orientation==ExifInterface.ORIENTATION_ROTATE_90?90:
                    orientation==ExifInterface.ORIENTATION_ROTATE_180?180:
                    orientation==ExifInterface.ORIENTATION_ROTATE_270?270:0;
                if(angle!=0){
                    Matrix matrix=new Matrix();matrix.postRotate(angle);
                    oriented=Bitmap.createBitmap(decoded,0,0,decoded.getWidth(),decoded.getHeight(),matrix,true);
                }
                int size=144;thumb=Bitmap.createBitmap(size,size,Bitmap.Config.RGB_565);
                Canvas canvas=new Canvas(thumb);
                Paint paint=new Paint(Paint.ANTI_ALIAS_FLAG|Paint.FILTER_BITMAP_FLAG);
                float side=Math.min(oriented.getWidth(),oriented.getHeight());
                Rect src=new Rect(
                    (int)((oriented.getWidth()-side)/2f),(int)((oriented.getHeight()-side)/2f),
                    (int)((oriented.getWidth()+side)/2f),(int)((oriented.getHeight()+side)/2f));
                canvas.drawBitmap(oriented,src,new RectF(0,0,size,size),paint);
                File tmp=new File(dir,id+".tmp");
                try(FileOutputStream out=new FileOutputStream(tmp)){
                    if(!thumb.compress(Bitmap.CompressFormat.JPEG,82,out))
                        throw new IOException("Cannot encode thumbnail");
                }
                if(!tmp.renameTo(cached)){
                    if(!cached.delete()||!tmp.renameTo(cached))
                        throw new IOException("Cannot save thumbnail");
                }
            } finally {
                if(thumb!=null)thumb.recycle();
                if(oriented!=decoded)oriented.recycle();
                decoded.recycle();
            }
        }
        return new FileInputStream(cached);
    }

    private boolean validId(String s){return s.matches("[a-zA-Z0-9_-]{3,120}");}
    private String mediaMime(String id){return settings.getString("mime-"+id,"application/octet-stream");}
    private void js(String code){runOnUiThread(()->web.evaluateJavascript(code,null));}
    private void jsCall(String fn,String jsonLiteral){js("window."+fn+"("+JSONObject.quote(jsonLiteral)+")");}
    private void laserStatus(String status,String name){
        try{jsCall("onLaserStatus",new JSONObject().put("status",status).put("name",name==null?"":name).toString());}
        catch(Exception ignored){}
    }
    private void error(String s){jsCall("onNativeError",s);}
    private void onSyncResult(String msg,JSONObject data){try{JSONObject result=new JSONObject().put("message",msg);if(data!=null)result.put("data",data);jsCall("onNativeSync",result.toString());}catch(Exception e){error(e.getMessage());}}
    @Override @SuppressWarnings("deprecation") public void onBackPressed(){handleAndroidBack();}
    private void handleAndroidBack(){
        if(web==null){finish();return;}
        web.evaluateJavascript("(window.handleAndroidBack?window.handleAndroidBack():'root')",result->{
            if(!"\"root\"".equals(result)){lastExitPress=0;return;}
            long now=android.os.SystemClock.elapsedRealtime();
            if(now-lastExitPress<2200){finish();return;}
            lastExitPress=now;
            Toast.makeText(this,"Ještě jednou Zpět pro ukončení",Toast.LENGTH_SHORT).show();
        });
    }
    private void selectCloud(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(i,REQUEST_TREE);}
    private void exportPng(String name,String b64){exportBase64=b64;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("image/png").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,REQUEST_EXPORT);}
    @Override public void onRequestPermissionsResult(int requestCode,String[] permissions,int[] grantResults){
        super.onRequestPermissionsResult(requestCode,permissions,grantResults);
        if(requestCode==REQUEST_PERMISSIONS){
            boolean audioRequest=false;
            for(String permission:permissions)if(Manifest.permission.RECORD_AUDIO.equals(permission))audioRequest=true;
            if(audioRequest){
                boolean granted=grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED;
                js(granted?"window.__audioPermissionRetry?.()":"window.__audioPermissionDenied?.()");
            }
        }
        if(requestCode==REQUEST_BLUETOOTH_PERMISSION){
            boolean granted=grantResults.length==permissions.length;
            for(int value:grantResults)granted &= value==PackageManager.PERMISSION_GRANTED;
            if(granted)handler.post(this::startScan);
            else{laserStatus("off","");error("Povol přístup k zařízením v okolí v nastavení Androidu");}
        }
        if(requestCode==REQUEST_CAMERA_PERMISSION){
            if(grantResults.length>0&&grantResults[0]==PackageManager.PERMISSION_GRANTED){
                handler.post(this::useCamera); // Continue the same camera action without a second tap.
            }else{
                error("Fotoaparát nemá povolení. Povol jej v nastavení aplikace.");
            }
        }
        if(requestCode==REQUEST_PHOTO_LOCATION){
            String id=pendingPhotoLocationId;
            pendingPhotoLocationId=null;
            boolean granted=false;
            for(int value:grantResults)if(value==PackageManager.PERMISSION_GRANTED)granted=true;
            if(id!=null){
                if(granted)resolvePhotoAddress(id);
                else notifyPhotoAddress(id,"");
            }
        }
    }
    private void useCamera(){
        if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.CAMERA},REQUEST_CAMERA_PERMISSION);return;}
        cameraId=UUID.randomUUID().toString();ContentValues vals=new ContentValues();vals.put(MediaStore.Images.Media.DISPLAY_NAME,"zamerovac-"+cameraId+".jpg");vals.put(MediaStore.Images.Media.MIME_TYPE,"image/jpeg");
        cameraOutput=getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI,vals);
        if(cameraOutput==null){error("Nepodařilo se vytvořit fotografii");return;}
        Intent i=new Intent(MediaStore.ACTION_IMAGE_CAPTURE);i.putExtra(MediaStore.EXTRA_OUTPUT,cameraOutput);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
        try{startActivityForResult(i,REQUEST_CAMERA);}catch(Exception ex){error("Fotoaparát se nepodařilo spustit: "+ex.getMessage());}
    }
    private void chooseAttachments(String type){
        pendingMediaType=type;
        Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.setType("*/*");intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true);
        if("media".equals(type))intent.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/*","video/*","audio/*","application/pdf"});
        try{startActivityForResult(intent,REQUEST_ATTACH);}catch(Exception e){error("Výběr souborů: "+e.getMessage());}
    }
    private void importUri(Uri uri)throws IOException{
        String id=UUID.randomUUID().toString();String mime=getContentResolver().getType(uri);
        if(mime==null)mime="application/octet-stream";
        String name="Příloha";
        try(Cursor c=getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){
            if(c!=null&&c.moveToFirst()&&!c.isNull(0))name=c.getString(0);
        }
        filePicked(uri,id,mime,name);
    }
    private void filePicked(Uri uri,String id,String mime,String name) throws IOException {
        filePicked(uri,id,mime,name,null);
    }
    private void filePicked(Uri uri,String id,String mime,String name,String photoTakenAt) throws IOException {
        try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(mediaFile(id))){if(in==null)throw new IOException("Cannot read file");copy(in,out);}
        settings.edit().putString("mime-"+id,mime).putString("name-"+id,name).apply();
        // Prefer the camera's EXIF capture timestamp over the return-from-camera time.
        // Not all Android camera applications provide the original timestamp.
        String takenAt=photoTakenAt==null?null:readCaptureDate(mediaFile(id),photoTakenAt);
        js("window.onNativeMedia("+JSONObject.quote(id)+","+JSONObject.quote(mime)+","+
            JSONObject.quote(name)+","+(takenAt==null?"null":JSONObject.quote(takenAt))+")");
    }
    private String readCaptureDate(File jpeg,String fallback){
        try{
            ExifInterface exif=new ExifInterface(jpeg.getAbsolutePath());
            String date=exif.getAttribute(ExifInterface.TAG_DATETIME_ORIGINAL);
            if(date==null||date.isEmpty())date=exif.getAttribute(ExifInterface.TAG_DATETIME);
            if(date!=null&&!date.isEmpty()){
                java.text.SimpleDateFormat format=
                    new java.text.SimpleDateFormat("yyyy:MM:dd HH:mm:ss",java.util.Locale.ROOT);
                format.setLenient(false);
                java.util.Date parsed=format.parse(date);
                if(parsed!=null)return java.time.Instant.ofEpochMilli(parsed.getTime()).toString();
            }
        }catch(Exception ignored){}
        return fallback;
    }
    private void notifyPhotoAddress(String id,String address){
        js("window.onNativePhotoAddress("+JSONObject.quote(id)+","+JSONObject.quote(address)+")");
    }
    private void resolvePhotoAddress(String id){
        PhotoAddressResolver.resolve(this,address->notifyPhotoAddress(id,address));
    }
    private void requestPhotoAddress(String id){
        boolean precise=checkSelfPermission(Manifest.permission.ACCESS_FINE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        boolean approx=checkSelfPermission(Manifest.permission.ACCESS_COARSE_LOCATION)==PackageManager.PERMISSION_GRANTED;
        if(precise||approx){resolvePhotoAddress(id);return;}
        pendingPhotoLocationId=id;
        requestPermissions(new String[]{Manifest.permission.ACCESS_FINE_LOCATION,
            Manifest.permission.ACCESS_COARSE_LOCATION},REQUEST_PHOTO_LOCATION);
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==REQUEST_FILE){if(fileCallback!=null){Uri[] resultUris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();resultUris=new Uri[n];for(int i=0;i<n;i++)resultUris[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)resultUris=new Uri[]{data.getData()};}fileCallback.onReceiveValue(resultUris);fileCallback=null;}return;}
        if(result!=RESULT_OK){if(request==REQUEST_BACKUP)pendingArchiveFolderId=null;if(request==REQUEST_ATTACH)js("window.onNativeMediaDone?.()");if(request==REQUEST_ISSUE_EXPORT)pendingIssueZipId=null;return;}
        if(request==REQUEST_ATTACH&&data!=null){int done=0;try{
            if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++){importUri(data.getClipData().getItemAt(i).getUri());done++;}}
            else if(data.getData()!=null){importUri(data.getData());done++;}
        }catch(Exception ex){error("Import souborů: "+ex.getMessage());}js("window.onNativeMediaDone?.()");return;}
        if(request==REQUEST_CAMERA&&cameraOutput!=null){
            String id=cameraId;
            try{
                String takenAt=java.time.Instant.now().toString();
                filePicked(cameraOutput,id,"image/jpeg","Foto "+System.currentTimeMillis()+".jpg",takenAt);
                requestPhotoAddress(id);
            }catch(Exception e){error("Fotografie: "+e.getMessage());}
            js("window.onNativeMediaDone?.()");
            return;
        }
        if(request==REQUEST_TREE&&data!=null&&data.getData()!=null){Uri uri=data.getData();try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);settings.edit().putString("treeUri",uri.toString()).apply();scheduleSync();syncCloud();}catch(Exception e){error("Nelze použít vybranou složku: "+e.getMessage());}return;}
        if(request==REQUEST_ISSUE_EXPORT){
            String id=pendingIssueZipId;pendingIssueZipId=null;
            if(id!=null&&data!=null&&data.getData()!=null){
                try(InputStream in=new FileInputStream(mediaFile(id));
                    OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){
                    if(out==null)throw new IOException("Nelze otevřít výstup");
                    copy(in,out);
                    js("window.onReportBundleSaved?.()");
                }catch(Exception ex){error("Uložení balíčku: "+ex.getMessage());}
            }
            return;
        }
        if(request==REQUEST_IMPORT_BACKUP&&data!=null&&data.getData()!=null){
            final Uri origin=data.getData();
            new Thread(()->{
                try{
                    String existingText=readDb();
                    JSONObject existing=existingText.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()).put("prefs",new JSONObject()):new JSONObject(existingText);
                    BackupImporter.Result restored=BackupImporter.importZip(this,origin,existing,settings);
                    writeDb(restored.data.toString());
                    onSyncResult("Obnoveno "+restored.recordCount+" záznamů jako nové zakázky",restored.data);
                }catch(Exception e){error("Obnova ZIP: "+e.getMessage());}
            },"ZamerovacRestore").start();
            return;
        }
        if(request==REQUEST_BACKUP&&data!=null&&data.getData()!=null){
            final Uri destination=data.getData();
            final String folderId=pendingArchiveFolderId;
            pendingArchiveFolderId=null;
            new Thread(()->{
                try(OutputStream stream=getContentResolver().openOutputStream(destination,"w")){
                    if(stream==null)throw new IOException("Nelze otevřít soubor");
                    exportArchive(stream,folderId);
                    onSyncResult("ZIP záloha zakázek a původních médií byla uložena",null);
                }catch(Exception e){error("Záloha ZIP: "+e.getMessage());}
            },"ZamerovacBackup").start();
            return;
        }
        if(request==REQUEST_EXPORT&&data!=null&&data.getData()!=null&&exportBase64!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){out.write(Base64.decode(exportBase64,Base64.DEFAULT));exportBase64=null;onSyncResult("Obrázek uložen",null);}catch(Exception e){error("Export: "+e.getMessage());}}
    }
    private void exportArchive(OutputStream destination,String folderId) throws IOException{
        String json=readDb();
        if(json.isEmpty())throw new IOException("Databáze je prázdná");
        JSONObject parsed;
        try{parsed=new JSONObject(json);if(parsed.optInt("schema")!=1)throw new IOException("Nepodporovaná verze dat");}
        catch(JSONException e){throw new IOException("Poškozená databáze",e);}
        Set<String> mediaIds=new HashSet<>();
        JSONArray records=parsed.optJSONArray("records");
        if(folderId!=null){
            if(records==null)throw new IOException("Složka neexistuje");
            Set<String> included=new HashSet<>();
            boolean found=false;
            for(int i=0;i<records.length();i++){
                JSONObject r=records.optJSONObject(i);
                if(r!=null&&folderId.equals(r.optString("id"))&&"folder".equals(r.optString("kind"))&&!r.optBoolean("deleted")){
                    included.add(folderId);found=true;break;
                }
            }
            if(!found)throw new IOException("Vybraná složka neexistuje");
            boolean expanded=true;
            while(expanded){
                expanded=false;
                for(int i=0;i<records.length();i++){
                    JSONObject r=records.optJSONObject(i);
                    if(r!=null&&!r.optBoolean("deleted")&&included.contains(r.optString("parentId"))&&included.add(r.optString("id")))
                        expanded=true;
                }
            }
            JSONArray subset=new JSONArray();
            for(int i=0;i<records.length();i++){
                JSONObject r=records.optJSONObject(i);
                if(r!=null&&included.contains(r.optString("id")))subset.put(r);
            }
            try{parsed.put("records",subset);}catch(JSONException ex){throw new IOException("Nedá se připravit export složky",ex);}
            records=subset;json=parsed.toString();
        }
        if(records!=null)for(int i=0;i<records.length();i++){
            JSONObject record=records.optJSONObject(i);
            if(record!=null)collectMediaIds(record,mediaIds);
        }
        try(ZipOutputStream zip=new ZipOutputStream(destination)){
            zip.putNextEntry(new ZipEntry("projects.json"));
            zip.write(json.getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            JSONObject metadata=new JSONObject();
            for(String id:mediaIds){
                if(!validId(id))continue;
                try{metadata.put(id,new JSONObject().put("mime",mediaMime(id))
                    .put("name",settings.getString("name-"+id,"Příloha")));}catch(Exception ignored){}
            }
            zip.putNextEntry(new ZipEntry("media-meta.json"));
            zip.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for(String id:mediaIds){
                if(!validId(id))continue;
                File media=mediaFile(id);if(!media.isFile())continue;
                zip.putNextEntry(new ZipEntry("media/"+id));
                try(InputStream in=new FileInputStream(media)){copy(in,zip);}
                zip.closeEntry();
            }
        }
    }

    /** Local feedback ZIP, including only explicitly captured screenshots and attached videos. */
    private String createIssueZip(String json) throws IOException, JSONException {
        JSONObject root=new JSONObject(json);
        JSONArray reports=root.optJSONArray("reports");
        if(reports==null||reports.length()==0)throw new IOException("Nejsou vybrány žádné připomínky");
        String id=UUID.randomUUID().toString();
        File target=mediaFile(id);
        try(ZipOutputStream zip=new ZipOutputStream(new FileOutputStream(target))){
            zip.putNextEntry(new ZipEntry("pripominky.json"));
            zip.write(root.toString(2).getBytes(StandardCharsets.UTF_8));
            zip.closeEntry();
            for(int i=0;i<reports.length();i++){
                JSONObject report=reports.optJSONObject(i);
                if(report==null)continue;
                String screenshot=report.optString("annotatedId","");
                if(!validId(screenshot)||!mediaFile(screenshot).isFile())
                    screenshot=report.optString("screenshotId","");
                if(validId(screenshot)&&mediaFile(screenshot).isFile())
                    zipIssueFile(zip,mediaFile(screenshot),
                        String.format(java.util.Locale.ROOT,"obrazky/pripominka-%03d.png",i+1));
                JSONArray videos=report.optJSONArray("videos");
                if(videos==null)continue;
                for(int j=0;j<videos.length();j++){
                    JSONObject item=videos.optJSONObject(j);
                    String video=item==null?videos.optString(j,""):item.optString("id","");
                    if(!validId(video)||!mediaFile(video).isFile())continue;
                    String mime=mediaMime(video);
                    String extension=mime.contains("webm")?"webm":mime.contains("quicktime")?"mov":"mp4";
                    zipIssueFile(zip,mediaFile(video),String.format(java.util.Locale.ROOT,
                        "videa/pripominka-%03d-%02d.%s",i+1,j+1,extension));
                }
            }
        }catch(Exception ex){target.delete();throw ex;}
        settings.edit().putString("mime-"+id,"application/zip")
            .putString("name-"+id,"Zamerovac-pripominky.zip").apply();
        return id;
    }
    private void zipIssueFile(ZipOutputStream zip,File input,String name)throws IOException {
        zip.putNextEntry(new ZipEntry(name));
        try(InputStream in=new FileInputStream(input)){copy(in,zip);}
        zip.closeEntry();
    }
    private void sendIssueBundle(String text,boolean saveToFile){
        new Thread(()->{
            try{
                String id=createIssueZip(text);
                runOnUiThread(()->{
                    try{
                        if(saveToFile){
                            pendingIssueZipId=id;
                            Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT);
                            intent.addCategory(Intent.CATEGORY_OPENABLE);
                            intent.setType("application/zip");
                            intent.putExtra(Intent.EXTRA_TITLE,"Zamerovac-pripominky.zip");
                            startActivityForResult(intent,REQUEST_ISSUE_EXPORT);
                        }else{
                            Uri uri=new Uri.Builder().scheme("content")
                                .authority(getPackageName()+".files").appendPath(id).build();
                            Intent intent=new Intent(Intent.ACTION_SEND);
                            intent.setType("application/zip");
                            intent.putExtra(Intent.EXTRA_SUBJECT,"Zaměřovač – připomínky");
                            intent.putExtra(Intent.EXTRA_STREAM,uri);
                            intent.setClipData(android.content.ClipData.newRawUri("Připomínky",uri));
                            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                            startActivity(Intent.createChooser(intent,"Sdílet připomínky"));
                        }
                    }catch(Exception ex){error("Sdílení připomínek: "+ex.getMessage());}
                });
            }catch(Exception ex){error("Balíček připomínek: "+ex.getMessage());}
        },"ZamerovacIssueBundle").start();
    }
    private void collectMediaIds(JSONObject record,Set<String> ids){
        JSONArray media=record.optJSONArray("media");
        if(media!=null)for(int i=0;i<media.length();i++)ids.add(media.optString(i));
        collectNestedMedia(record.optJSONArray("items"),ids);
    }
    private void collectNestedMedia(JSONArray items,Set<String> ids){
        if(items==null)return;
        for(int i=0;i<items.length();i++){
            JSONObject item=items.optJSONObject(i);if(item==null)continue;
            JSONArray media=item.optJSONArray("media");
            if(media!=null)for(int j=0;j<media.length();j++)ids.add(media.optString(j));
            collectNestedMedia(item.optJSONArray("detailItems"),ids);
        }
    }
    private static void copy(InputStream a,OutputStream b) throws IOException{byte[] buf=new byte[64*1024];int n;while((n=a.read(buf))!=-1)b.write(buf,0,n);}
    public final class JsApi{
        // Read the actual installed package version (including -test for preview).
        // Version is generated by Gradle/GitHub run number, never manually set in UI.
        @JavascriptInterface public String getAppVersion(){
            try {
                return getPackageManager().getPackageInfo(getPackageName(),0).versionName;
            } catch(Exception e){
                return "nezjištěna";
            }
        }
        @JavascriptInterface public String loadData(){try{return readDb();}catch(Exception e){return "";}}
        @JavascriptInterface public void saveData(String text){try{JSONObject j=new JSONObject(text);if(j.optInt("schema")!=1)throw new Exception("Unsupported schema");writeDb(text);}catch(Exception e){error("Uložení: "+e.getMessage());}}
        @JavascriptInterface public void beginMedia(String id,String mime,String name){try{if(!validId(id))return;closeUpload();activeUpload=new FileOutputStream(mediaFile(id));activeUploadId=id;settings.edit().putString("mime-"+id,mime).putString("name-"+id,name).apply();}catch(Exception e){error(e.toString());}}
        @JavascriptInterface public void appendMedia(String id,String chunk){try{if(activeUpload!=null&&id.equals(activeUploadId))activeUpload.write(Base64.decode(chunk,Base64.DEFAULT));}catch(Exception e){error(e.toString());}}
        @JavascriptInterface public void finishMedia(String id){if(id.equals(activeUploadId))closeUpload();}
        @JavascriptInterface public void takePhoto(){runOnUiThread(()->useCamera());}
        @JavascriptInterface public void selectFiles(String type){runOnUiThread(()->chooseAttachments(type));}
        @JavascriptInterface public void selectCloudFolder(){runOnUiThread(()->selectCloud());}
        @JavascriptInterface public void syncCloud(){MainActivity.this.syncCloud();}
        @JavascriptInterface public void exportPng(String name,String b64){runOnUiThread(()->exportPng(name,b64));}
        @JavascriptInterface public void printPdf(){runOnUiThread(()->{PrintManager manager=(PrintManager)getSystemService(PRINT_SERVICE);manager.print("Zaměření",web.createPrintDocumentAdapter("Zaměření"),null);});}
        @JavascriptInterface public void openMedia(String id){runOnUiThread(()->{try{Uri uri=new Uri.Builder().scheme("content").authority(getPackageName()+".files").appendPath(id).build();Intent i=new Intent(Intent.ACTION_VIEW).setDataAndType(uri,mediaMime(id)).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);startActivity(Intent.createChooser(i,"Otevřít přílohu"));}catch(Exception e){error("Pro tento formát není dostupný prohlížeč");}});}
        @JavascriptInterface public void configure(String json){try{JSONObject p=new JSONObject(json);settings.edit().putBoolean("wifiOnly",p.optBoolean("wifiOnly",false)).putBoolean("autoSync",p.optBoolean("autoSync",true)).apply();runOnUiThread(()->{if(p.optBoolean("keepAwake"))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);int flags=View.SYSTEM_UI_FLAG_LAYOUT_STABLE|View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN|View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;if(p.optBoolean("fullscreen"))flags|=View.SYSTEM_UI_FLAG_FULLSCREEN|View.SYSTEM_UI_FLAG_HIDE_NAVIGATION|View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY;getWindow().getDecorView().setSystemUiVisibility(flags);root.requestApplyInsets();});scheduleSync();}catch(Exception e){error(e.getMessage());}}
        @JavascriptInterface public boolean startAudio(String id){if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){runOnUiThread(()->requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQUEST_PERMISSIONS));return false;}
            try{recordingId=id;recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setOutputFile(mediaFile(id).getAbsolutePath());recorder.prepare();recorder.start();settings.edit().putString("mime-"+id,"audio/mp4").putString("name-"+id,"Hlasová poznámka.m4a").apply();return true;}catch(Exception e){error("Mikrofon: "+e.getMessage());return false;}}
        @JavascriptInterface public void stopAudio(){try{if(recorder!=null){recorder.stop();recorder.reset();recorder.release();recorder=null;}}catch(Exception e){error("Nahrávání: "+e.getMessage());}}
        @JavascriptInterface public void searchAddress(String q){
            new Thread(()->{
                try{jsCall("onAddressCandidates",AddressLookup.find(q));}
                catch(Exception ex){error("Vyhledávání adres: "+ex.getMessage());}
            },"AddressRUIAN").start();
        }
        @JavascriptInterface public void connectLaser(){runOnUiThread(()->startScan());}
        @JavascriptInterface public void triggerLaser(){runOnUiThread(()->sendExperimentalLaserTrigger());}
        @JavascriptInterface public void setAccent(String color){
            if(color==null||!color.matches("#[0-9a-fA-F]{6}"))return;
            runOnUiThread(()->{try{statusFill.setBackgroundColor(Color.rgb(51,43,64));}catch(Exception ignored){}});
        }
        /**
         * Capture the compositor output, NOT WebView.draw(Canvas).
         * WebView.draw misses hardware-accelerated canvases: the user then sees a
         * mostly black photo in the feedback screenshot despite visible annotations.
         * PixelCopy (API 26+) captures the actual displayed window pixels.
         */
        @JavascriptInterface public void captureReportScreenshot(){
            runOnUiThread(()->{
                try{
                    int width=web.getWidth(),height=web.getHeight();
                    if(width<1||height<1||((long)width)*height>18000000L)
                        throw new IOException("Neplatné rozměry obrazovky");
                    int[] coords=new int[2];
                    web.getLocationInWindow(coords);
                    Rect source=new Rect(coords[0],coords[1],
                        coords[0]+width,coords[1]+height);
                    Bitmap bitmap=Bitmap.createBitmap(width,height,Bitmap.Config.ARGB_8888);
                    android.view.PixelCopy.request(getWindow(),source,bitmap,result->{
                        try{
                            if(result!=android.view.PixelCopy.SUCCESS)
                                throw new IOException("Nepodařilo se zachytit obraz ("+result+")");
                            String id=UUID.randomUUID().toString();
                            try(FileOutputStream out=new FileOutputStream(mediaFile(id))){
                                if(!bitmap.compress(Bitmap.CompressFormat.PNG,100,out))
                                    throw new IOException("Snímek se nepodařilo uložit");
                            }
                            settings.edit().putString("mime-"+id,"image/png")
                                .putString("name-"+id,"obrazovka-zamerovac.png").apply();
                            js("window.onReportScreenshot("+JSONObject.quote(id)+")");
                        }catch(Exception ex){
                            error("Snímek obrazovky: "+ex.getMessage());
                            js("window.onReportScreenshot(null)");
                        }finally{bitmap.recycle();}
                    },handler);
                }catch(Exception ex){
                    error("Snímek obrazovky: "+ex.getMessage());
                    js("window.onReportScreenshot(null)");
                }
            });
        }
        @JavascriptInterface public void shareIssueBundle(String json){sendIssueBundle(json,false);}
        @JavascriptInterface public void saveIssueBundle(String json){sendIssueBundle(json,true);}
        @JavascriptInterface public void shareText(String title,String content){
            runOnUiThread(()->{
                Intent send=new Intent(Intent.ACTION_SEND).setType("text/plain");
                send.putExtra(Intent.EXTRA_SUBJECT,title==null?"Zaměřovač":title);
                send.putExtra(Intent.EXTRA_TEXT,content==null?"":content);
                startActivity(Intent.createChooser(send,"Sdílet diagnostiku"));
            });
        }
        @JavascriptInterface public void importBackup(){
            runOnUiThread(()->{
                Intent intent=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/zip").addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try{startActivityForResult(intent,REQUEST_IMPORT_BACKUP);}
                catch(Exception e){error("Obnova zálohy: "+e.getMessage());}
            });
        }
        @JavascriptInterface public void exportBackup(){
            runOnUiThread(()->{
                pendingArchiveFolderId=null;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/zip").putExtra(Intent.EXTRA_TITLE,"Zamerovac-zaloha.zip");
                try{startActivityForResult(intent,REQUEST_BACKUP);}catch(Exception e){error("Záloha: "+e.getMessage());}
            });
        }
        @JavascriptInterface public void exportFolder(String folderId){
            if(folderId==null||!folderId.matches("[a-zA-Z0-9_-]{1,100}")){error("Neplatná složka");return;}
            runOnUiThread(()->{
                pendingArchiveFolderId=folderId;
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/zip").putExtra(Intent.EXTRA_TITLE,"Zamerovac-slozka.zip");
                try{startActivityForResult(intent,REQUEST_BACKUP);}
                catch(Exception e){pendingArchiveFolderId=null;error("Export složky: "+e.getMessage());}
            });
        }
    }
    private void closeUpload(){try{if(activeUpload!=null)activeUpload.close();}catch(Exception ignored){}activeUpload=null;activeUploadId=null;}
    private String readDb() throws IOException {
        File db=new File(getFilesDir(),"projects.json");if(!db.isFile())return "";
        try{return readValidJson(db);}
        catch(Exception primary){
            File backup=new File(getFilesDir(),"projects.bak");
            if(!backup.isFile())throw new IOException("Databáze není čitelná",primary);
            String data=readValidJson(backup);
            android.util.Log.w("Zamerovac","Recovered last valid local backup",primary);
            return data;
        }
    }
    private String readValidJson(File file) throws IOException {
        try(InputStream in=new FileInputStream(file)){
            java.io.ByteArrayOutputStream o=new java.io.ByteArrayOutputStream();copy(in,o);
            String data=o.toString("UTF-8");
            try{if(new JSONObject(data).optInt("schema")!=1)throw new IOException("Unsupported schema");}
            catch(JSONException e){throw new IOException("Invalid JSON",e);}
            return data;
        }
    }
    private synchronized void writeDb(String data) throws IOException {
        File next=new File(getFilesDir(),"projects.tmp"),dest=new File(getFilesDir(),"projects.json");
        File backup=new File(getFilesDir(),"projects.bak");
        try(FileOutputStream out=new FileOutputStream(next)){
            out.write(data.getBytes(StandardCharsets.UTF_8));out.getFD().sync();
        }
        if(dest.isFile())java.nio.file.Files.copy(dest.toPath(),backup.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        try{java.nio.file.Files.move(next.toPath(),dest.toPath(),
                java.nio.file.StandardCopyOption.ATOMIC_MOVE,java.nio.file.StandardCopyOption.REPLACE_EXISTING);}
        catch(java.nio.file.AtomicMoveNotSupportedException e){
            java.nio.file.Files.move(next.toPath(),dest.toPath(),java.nio.file.StandardCopyOption.REPLACE_EXISTING);
        }
    }
    private void syncCloud(){if(syncRunning){onSyncResult("Synchronizace již probíhá",null);return;}syncRunning=true;new Thread(()->{try{SyncEngine.Result result=new SyncEngine(this,settings).sync();onSyncResult(result.message,result.data);}catch(Exception e){error("Synchronizace: "+e.getMessage());}finally{syncRunning=false;}},"DriveSync").start();}
    private void scheduleSync(){try{JobScheduler jobs=(JobScheduler)getSystemService(JOB_SCHEDULER_SERVICE);JobInfo j=new JobInfo.Builder(14,new ComponentName(this,SyncJob.class)).setPeriodic(15*60*1000L).setRequiredNetworkType(settings.getBoolean("wifiOnly",false)?JobInfo.NETWORK_TYPE_UNMETERED:JobInfo.NETWORK_TYPE_ANY).setPersisted(true).build();if(settings.getString("treeUri",null)!=null&&settings.getBoolean("autoSync",true))jobs.schedule(j);else jobs.cancel(14);}catch(Exception e){android.util.Log.w("Zamerovac","Background job",e);}}
    @Override public void onResume(){super.onResume();if(settings!=null&&settings.getBoolean("autoSync",true)&&settings.getString("treeUri",null)!=null)handler.postDelayed(()->syncCloud(),1400);}
    @Override protected void onDestroy(){closeUpload();stopLaserScan();if(gatt!=null)gatt.close();if(classic!=null)classic.close();if(recorder!=null){recorder.release();recorder=null;}if(web!=null)web.destroy();super.onDestroy();}


    // The GLM 100-25 C is Bluetooth LE. Show ALL nearby LE advertisements (like
    // ImageMeter), preferring Bosch entries but not hiding unknown device names.
    private void stopLaserScan(){
        if(scanner!=null&&scanCallback!=null){
            try{scanner.stopScan(scanCallback);}catch(Exception ignored){}
            scanCallback=null;
        }
    }
    private void startScan(){
        if(Build.VERSION.SDK_INT>=31&&
           (checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED||
            checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)){
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},
                REQUEST_BLUETOOTH_PERMISSION);
            laserStatus("connecting","čekám na povolení Bluetooth");
            return;
        }
        BluetoothManager manager=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter=manager==null?null:manager.getAdapter();
        if(adapter==null||!adapter.isEnabled()){
            error("Zapni Bluetooth telefonu a měřiče Bosch");
            laserStatus("off","");
            return;
        }
        stopLaserScan();
        scanner=adapter.getBluetoothLeScanner();
        if(scanner==null){error("Bluetooth LE není dostupné");laserStatus("off","");return;}
        scanned.clear();
        scannedNames.clear();
        laserStatus("connecting","vyhledávání zařízení");
        scanCallback=new ScanCallback(){
            @Override public void onScanResult(int type,ScanResult result){
                BluetoothDevice device=result.getDevice();
                if(device==null)return;
                String advertised=result.getScanRecord()==null?null:result.getScanRecord().getDeviceName();
                runOnUiThread(()->{
                    if(!scanned.contains(device))scanned.add(device);
                    if(advertised!=null&&!advertised.trim().isEmpty()){
                        String prior=scannedNames.get(device.getAddress());
                        if(prior==null||advertised.length()>prior.length())
                            scannedNames.put(device.getAddress(),advertised);
                    }
                });
            }
            @Override public void onScanFailed(int code){
                runOnUiThread(()->{stopLaserScan();laserStatus("off","");error("Vyhledávání Bluetooth se nezdařilo ("+code+")");});
            }
        };
        try{
            scanner.startScan(scanCallback);
            handler.postDelayed(()->{
                if(scanCallback==null)return; // scan cancelled or failed
                stopLaserScan();
                ArrayList<BluetoothDevice> devices=new ArrayList<>(scanned);
                java.util.Set<String> leAddresses=new java.util.HashSet<>();
                for(BluetoothDevice found:scanned)leAddresses.add(found.getAddress());
                // Show paired Classic devices too, as ImageMeter does, but never
                // confuse a paired-only device with a current LE advertisement.
                try{
                    for(BluetoothDevice paired:adapter.getBondedDevices()){
                        if(!devices.contains(paired))devices.add(paired);
                    }
                }catch(Exception exception){android.util.Log.w("Zamerovac","Paired Bluetooth list",exception);}
                devices.sort((a,b)->{
                    String aa=String.valueOf(scannedNames.containsKey(a.getAddress())?scannedNames.get(a.getAddress()):a.getName()).toUpperCase(java.util.Locale.ROOT);
                    String bb=String.valueOf(scannedNames.containsKey(b.getAddress())?scannedNames.get(b.getAddress()):b.getName()).toUpperCase(java.util.Locale.ROOT);
                    boolean x=aa.contains("BOSCH")||aa.contains("GLM");
                    boolean y=bb.contains("BOSCH")||bb.contains("GLM");
                    return x==y?aa.compareTo(bb):(x?-1:1);
                });
                if(devices.isEmpty()){
                    laserStatus("off","");
                    error("Nenašel jsem žádné LE zařízení. Zapni Bluetooth na laseru a vypni spojení v ImageMeteru.");
                    return;
                }
                String[] labels=new String[devices.size()];
                for(int i=0;i<devices.size();i++){
                    BluetoothDevice d=devices.get(i);
                    String name=scannedNames.containsKey(d.getAddress())?
                            scannedNames.get(d.getAddress()):d.getName();
                    labels[i]=(name==null||name.trim().isEmpty()?"Neznámé zařízení":name)
                            +" · "+d.getAddress()+(leAddresses.contains(d.getAddress())?"":" (spárované)");
                }
                laserStatus("off","");
                new AlertDialog.Builder(this)
                    .setTitle("Bluetooth zařízení – Bosch GLM vyber nahoře")
                    .setItems(labels,(dialog,index)->{
                        BluetoothDevice d=devices.get(index);
                        if(leAddresses.contains(d.getAddress()))connectGatt(d);
                        else{
                            String n=String.valueOf(d.getName()).toUpperCase(java.util.Locale.ROOT).replace(" ","");
                            if((n.contains("GLM50C")||n.contains("GLM100C"))&&!n.contains("100-25"))
                                connectClassicBosch(d);
                            else error("Zařízení je jen spárované. Zapni laser a zkus nové vyhledávání Bluetooth LE.");
                        }
                    })
                    .setNegativeButton("Zrušit",(dialog,index)->laserStatus("off",""))
                    .show();
            },7000);
        }catch(Exception exception){
            stopLaserScan();
            laserStatus("off","");
            error("Bluetooth vyhledávání: "+exception.getMessage());
        }
    }
    // Backward-compatible Bosch Classic connection for older GLM 50C/100C.
    private void connectClassicBosch(BluetoothDevice device){
        try{
            if(gatt!=null){gatt.disconnect();gatt.close();gatt=null;}
            if(classic!=null)classic.close();
            String name=device.getName();
            classic=new BoschClassicReader(device,
                value->js("window.onLaserValue("+JSONObject.quote(value)+","+JSONObject.quote("mm")+")"),
                this::error,status->laserStatus(status,name));
            laserStatus("connecting",name);
            classic.start();
        }catch(Exception ex){laserStatus("off","");error("Bosch Classic: "+ex.getMessage());}
    }
    // Only invoked after the user has enabled the experiment AND tapped it.
    // The Bosch BLE command is not yet proven for GLM 100-25 C; never retry.
    private void sendExperimentalLaserTrigger(){
        if(!boschStreamEnabled||gatt==null||boschCommand==null){
            error("Dálková spoušť: nejdřív připoj laser Bosch");return;
        }
        if(Build.VERSION.SDK_INT>=31&&
           checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){
            error("Dálková spoušť: chybí oprávnění Bluetooth");return;
        }
        int properties=boschCommand.getProperties();
        if((properties&(BluetoothGattCharacteristic.PROPERTY_WRITE|
                        BluetoothGattCharacteristic.PROPERTY_WRITE_NO_RESPONSE))==0){
            error("Dálková spoušť: laser nepodporuje zápis příkazů");return;
        }
        boschCommand.setWriteType(
            (properties&BluetoothGattCharacteristic.PROPERTY_WRITE)!=0?
            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT:
            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
        boschCommand.setValue(BoschBleProtocol.REMOTE_TRIGGER);
        try{
            if(gatt.writeCharacteristic(boschCommand)){
                js("window.onExperimentalLaserTrigger?.('sent')");
            }else error("Dálková spoušť: příkaz se nepodařilo odeslat");
        }catch(Exception ex){error("Dálková spoušť: "+ex.getMessage());}
    }
    private void connectGatt(BluetoothDevice device){
        try{
            stopLaserScan();
            if(classic!=null){classic.close();classic=null;}
            if(gatt!=null){gatt.disconnect();gatt.close();gatt=null;}
            boschCommand=null;
            boschStreamEnabled=false;
            String name=scannedNames.containsKey(device.getAddress())?
                    scannedNames.get(device.getAddress()):device.getName();
            if(name==null||name.isEmpty())name="Bosch";
            final String deviceName=name;
            laserStatus("connecting",deviceName);
            gatt=device.connectGatt(this,false,new BluetoothGattCallback(){
                @Override public void onConnectionStateChange(BluetoothGatt connection,int status,int newState){
                    if(status!=BluetoothGatt.GATT_SUCCESS){
                        laserStatus("off",deviceName);
                        error("Spojení Bluetooth selhalo ("+status+"). Zkus měřič znovu.");
                        connection.close();
                        return;
                    }
                    if(newState==android.bluetooth.BluetoothProfile.STATE_CONNECTED){
                        laserStatus("connecting",deviceName+" – hledám měření");
                        if(!connection.discoverServices()){
                            laserStatus("off",deviceName);
                            error("Laser neumožnil načíst služby Bluetooth");
                        }
                    }else if(newState==android.bluetooth.BluetoothProfile.STATE_DISCONNECTED){
                        boschStreamEnabled=false;
                        laserStatus("off",deviceName);
                        connection.close();
                    }
                }
                @Override public void onServicesDiscovered(BluetoothGatt connection,int status){
                    if(status!=BluetoothGatt.GATT_SUCCESS){
                        laserStatus("off",deviceName);
                        error("Nepodařilo se načíst služby laseru");
                        return;
                    }
                    BluetoothGattService service=connection.getService(BoschBleProtocol.SERVICE_UUID);
                    BluetoothGattCharacteristic characteristic=service==null?null:
                        service.getCharacteristic(BoschBleProtocol.MEASUREMENT_UUID);
                    if(characteristic==null){
                        laserStatus("off",deviceName);
                        error("Zařízení nemá očekávaný protokol Bosch GLM LE. Vyber GLM 100-25 C.");
                        connection.disconnect();
                        return;
                    }
                    boschCommand=characteristic;
                    int flags=characteristic.getProperties();
                    boolean indications=(flags&BluetoothGattCharacteristic.PROPERTY_INDICATE)!=0;
                    boolean notifications=(flags&BluetoothGattCharacteristic.PROPERTY_NOTIFY)!=0;
                    if(!indications&&!notifications||!connection.setCharacteristicNotification(characteristic,true)){
                        laserStatus("off",deviceName);
                        error("Nepodařilo se zapnout příjem měření");
                        connection.disconnect();
                        return;
                    }
                    BluetoothGattDescriptor cccd=characteristic.getDescriptor(BoschBleProtocol.CCCD_UUID);
                    if(cccd==null){
                        laserStatus("off",deviceName);
                        error("Laser neobsahuje kanál pro potvrzení měření (CCCD)");
                        connection.disconnect();
                        return;
                    }
                    cccd.setValue(indications?BluetoothGattDescriptor.ENABLE_INDICATION_VALUE:
                        BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);
                    if(!connection.writeDescriptor(cccd)){
                        laserStatus("off",deviceName);
                        error("Nepodařilo se povolit oznámení z laseru");
                        connection.disconnect();
                    }
                }
                @Override public void onDescriptorWrite(BluetoothGatt connection,
                        BluetoothGattDescriptor descriptor,int status){
                    if(!BoschBleProtocol.CCCD_UUID.equals(descriptor.getUuid()))return;
                    if(status!=BluetoothGatt.GATT_SUCCESS){
                        laserStatus("off",deviceName);
                        error("Laser nepotvrdil přihlášení k měření ("+status+")");
                        connection.disconnect();
                        return;
                    }
                    BluetoothGattCharacteristic characteristic=boschCommand;
                    if(characteristic==null)return;
                    characteristic.setWriteType(
                        (characteristic.getProperties()&BluetoothGattCharacteristic.PROPERTY_WRITE)!=0?
                            BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT:
                            BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE);
                    characteristic.setValue(BoschBleProtocol.START_STREAM);
                    if(!connection.writeCharacteristic(characteristic)){
                        laserStatus("off",deviceName);
                        error("Nelze zapnout přenos Bosch měření");
                        connection.disconnect();
                    }else if(characteristic.getWriteType()==BluetoothGattCharacteristic.WRITE_TYPE_NO_RESPONSE){
                        boschStreamEnabled=true;
                        laserStatus("connected",deviceName);
                    }
                }
                @Override public void onCharacteristicWrite(BluetoothGatt connection,
                        BluetoothGattCharacteristic characteristic,int status){
                    if(!BoschBleProtocol.MEASUREMENT_UUID.equals(characteristic.getUuid()))return;
                    if(java.util.Arrays.equals(characteristic.getValue(),BoschBleProtocol.REMOTE_TRIGGER)){
                        if(status!=BluetoothGatt.GATT_SUCCESS)
                            error("Laser nepotvrdil dálkovou spoušť ("+status+")");
                        return;
                    }
                    if(status==BluetoothGatt.GATT_SUCCESS){
                        boschStreamEnabled=true;
                        laserStatus("connected",deviceName);
                    }else{
                        laserStatus("off",deviceName);
                        error("Laser odmítl aktivaci přenosu ("+status+")");
                        connection.disconnect();
                    }
                }
                @Override public void onCharacteristicChanged(BluetoothGatt connection,
                        BluetoothGattCharacteristic characteristic){
                    if(!BoschBleProtocol.MEASUREMENT_UUID.equals(characteristic.getUuid()))return;
                    String mm=BoschBleProtocol.millimetersText(characteristic.getValue());
                    if(mm==null)return;
                    boschStreamEnabled=true;
                    laserStatus("receiving",deviceName);
                    js("window.onLaserValue("+JSONObject.quote(mm)+","+JSONObject.quote("mm")+")");
                }
            });
        }catch(Exception exception){
            laserStatus("off","");
            error("Připojení laseru: "+exception.getMessage());
        }
    }

}
