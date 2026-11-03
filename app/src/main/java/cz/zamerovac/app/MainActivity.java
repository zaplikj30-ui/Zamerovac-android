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
    private static final int REQUEST_FILE=20,REQUEST_TREE=21,REQUEST_CAMERA=22,REQUEST_EXPORT=23,REQUEST_PERMISSIONS=24,REQUEST_ATTACH=25,REQUEST_CAMERA_PERMISSION=26,REQUEST_PHOTO_LOCATION=27,REQUEST_BACKUP=28,REQUEST_IMPORT_BACKUP=29;
    private WebView web;
    private FrameLayout root;
    private View statusFill;
    private long lastExitPress=0;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private String cameraId;
    private String pendingPhotoLocationId;
    private String exportBase64;
    private MediaRecorder recorder;
    private FileOutputStream activeUpload;
    private String activeUploadId;
    private SharedPreferences settings;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final ArrayList<BluetoothDevice> scanned =new ArrayList<>();
    private BluetoothLeScanner scanner;
    private BluetoothGatt gatt;
    private BoschClassicReader classic;
    private ScanCallback scanCallback;
    private volatile boolean syncRunning=false;
    private String recordingId;
    private String pendingMediaType="media";

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
        if(result!=RESULT_OK){if(request==REQUEST_ATTACH)js("window.onNativeMediaDone?.()");return;}
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
        if(request==REQUEST_IMPORT_BACKUP&&data!=null&&data.getData()!=null){
            final Uri origin=data.getData();
            new Thread(()->{
                try{
                    JSONObject existing=new JSONObject(readDb());
                    BackupImporter.Result result=BackupImporter.importZip(this,origin,existing,settings);
                    writeDb(result.data.toString());
                    onSyncResult("Obnoveno "+result.recordCount+" záznamů jako nové zakázky",result.data);
                }catch(Exception e){error("Obnova ZIP: "+e.getMessage());}
            },"ZamerovacRestore").start();
            return;
        }
        if(request==REQUEST_BACKUP&&data!=null&&data.getData()!=null){
            final Uri destination=data.getData();
            new Thread(()->{
                try(OutputStream stream=getContentResolver().openOutputStream(destination,"w")){
                    if(stream==null)throw new IOException("Nelze otevřít soubor");
                    exportArchive(stream);
                    onSyncResult("ZIP záloha zakázek a původních médií byla uložena",null);
                }catch(Exception e){error("Záloha ZIP: "+e.getMessage());}
            },"ZamerovacBackup").start();
            return;
        }
        if(request==REQUEST_EXPORT&&data!=null&&data.getData()!=null&&exportBase64!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){out.write(Base64.decode(exportBase64,Base64.DEFAULT));exportBase64=null;onSyncResult("Obrázek uložen",null);}catch(Exception e){error("Export: "+e.getMessage());}}
    }
    private void exportArchive(OutputStream destination) throws IOException{
        final String json=readDb();
        if(json.isEmpty())throw new IOException("Databáze je prázdná");
        JSONObject parsed;
        try{parsed=new JSONObject(json);if(parsed.optInt("schema")!=1)throw new IOException("Nepodporovaná verze dat");}
        catch(JSONException e){throw new IOException("Poškozená databáze",e);}
        Set<String> mediaIds=new HashSet<>();
        JSONArray records=parsed.optJSONArray("records");
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
        @JavascriptInterface public boolean startAudio(String id){if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){runOnUiThread(()->requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQUEST_PERMISSIONS));error("Povol mikrofon a spusť záznam znovu");return false;}
            try{recordingId=id;recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setOutputFile(mediaFile(id).getAbsolutePath());recorder.prepare();recorder.start();settings.edit().putString("mime-"+id,"audio/mp4").putString("name-"+id,"Hlasová poznámka.m4a").apply();return true;}catch(Exception e){error("Mikrofon: "+e.getMessage());return false;}}
        @JavascriptInterface public void stopAudio(){try{if(recorder!=null){recorder.stop();recorder.reset();recorder.release();recorder=null;}}catch(Exception e){error("Nahrávání: "+e.getMessage());}}
        @JavascriptInterface public void searchAddress(String q){
            new Thread(()->{
                try{jsCall("onAddressCandidates",AddressLookup.find(q));}
                catch(Exception ex){error("Vyhledávání adres: "+ex.getMessage());}
            },"AddressRUIAN").start();
        }
        @JavascriptInterface public void connectLaser(){runOnUiThread(()->showLaserChoices());}
        @JavascriptInterface public void setAccent(String color){
            if(color==null||!color.matches("#[0-9a-fA-F]{6}"))return;
            runOnUiThread(()->{try{statusFill.setBackgroundColor(Color.rgb(51,43,64));}catch(Exception ignored){}});
        }
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
                Intent intent=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("application/zip").putExtra(Intent.EXTRA_TITLE,"Zamerovac-zaloha.zip");
                try{startActivityForResult(intent,REQUEST_BACKUP);}catch(Exception e){error("Záloha: "+e.getMessage());}
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
    @Override protected void onDestroy(){closeUpload();if(gatt!=null)gatt.close();if(classic!=null)classic.close();if(recorder!=null){recorder.release();recorder=null;}if(web!=null)web.destroy();super.onDestroy();}

    private void showLaserChoices(){
        new AlertDialog.Builder(this).setTitle("Připojení laseru Bosch")
        .setItems(new String[]{"Spárovaný GLM 50C / GLM 100C (Bluetooth Classic)","Vyhledat novější Bluetooth LE měřič"},
            (dialog,which)->{if(which==0)pickPairedClassic();else startScan();})
        .setNegativeButton("Zrušit",null).show();
    }
    private void pickPairedClassic(){
        if(Build.VERSION.SDK_INT>=31&&checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED){
            requestPermissions(new String[]{Manifest.permission.BLUETOOTH_CONNECT},REQUEST_PERMISSIONS);error("Povol Bluetooth a zopakuj připojení");return;
        }
        BluetoothManager mgr=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);
        BluetoothAdapter adapter=mgr==null?null:mgr.getAdapter();
        if(adapter==null||!adapter.isEnabled()){error("Zapni Bluetooth");return;}
        java.util.Set<BluetoothDevice> bonded=adapter.getBondedDevices();
        if(bonded==null||bonded.isEmpty()){error("Nejprve spáruj laser v nastavení Bluetooth telefonu");return;}
        ArrayList<BluetoothDevice> devices=new ArrayList<>(bonded);
        String[] labels=new String[devices.size()];for(int i=0;i<devices.size();i++){
            String name=devices.get(i).getName();labels[i]=(name==null?"Zařízení":name)+" · "+devices.get(i).getAddress();
        }
        new AlertDialog.Builder(this).setTitle("Vyber spárovaný laser").setItems(labels,(dlg,n)->{
            if(classic!=null)classic.close();classic=new BoschClassicReader(devices.get(n),
                value->js("window.onLaserValue("+JSONObject.quote(value)+","+JSONObject.quote("mm")+")"),
                this::error,status->laserStatus(status,devices.get(n).getName()));
            laserStatus("connecting",devices.get(n).getName());
            classic.start();
        }).setNegativeButton("Zrušit",null).show();
    }
    private void startScan(){if(Build.VERSION.SDK_INT>=31&&(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)){requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},REQUEST_PERMISSIONS);error("Povol Bluetooth a vyber měřič znovu");return;}
        BluetoothManager m=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);BluetoothAdapter adapter=m.getAdapter();if(adapter==null||!adapter.isEnabled()){new AlertDialog.Builder(this).setMessage("Zapni Bluetooth v telefonu a zkus připojení znovu.").setPositiveButton("OK",null).show();return;}
        scanner=adapter.getBluetoothLeScanner();if(scanner==null){error("Bluetooth BLE není dostupné");return;}scanned.clear();scanCallback=new ScanCallback(){@Override public void onScanResult(int callbackType,ScanResult result){BluetoothDevice d=result.getDevice();if(!scanned.contains(d))scanned.add(d);}};try{scanner.startScan(scanCallback);handler.postDelayed(()->{try{scanner.stopScan(scanCallback);}catch(Exception ignored){}ArrayList<BluetoothDevice> list=new ArrayList<>(scanned);if(list.isEmpty()){error("Nebylo nalezeno žádné BLE zařízení");return;}String[] names=new String[list.size()];for(int i=0;i<list.size();i++){BluetoothDevice d=list.get(i);String name=d.getName();names[i]=(name==null||name.isEmpty()?"Neznámé zařízení":name)+" · "+d.getAddress();}new AlertDialog.Builder(this).setTitle("Vyber laser Bosch").setItems(names,(dlg,i)->connectGatt(list.get(i))).setNegativeButton("Zrušit",null).show();},7000);}catch(SecurityException ex){error("Bluetooth oprávnění: "+ex.getMessage());}}
    private void connectGatt(BluetoothDevice device){try{if(gatt!=null)gatt.close();laserStatus("connecting",device.getName());gatt=device.connectGatt(this,false,new BluetoothGattCallback(){
        @Override public void onConnectionStateChange(BluetoothGatt g,int status,int newState){if(newState==2){laserStatus("connected",device.getName());g.discoverServices();}else if(newState==0){laserStatus("off",device.getName());error("Bluetooth odpojeno");}}
        @Override public void onServicesDiscovered(BluetoothGatt g,int status){for(BluetoothGattService srv:g.getServices())for(BluetoothGattCharacteristic ch:srv.getCharacteristics())if((ch.getProperties()&BluetoothGattCharacteristic.PROPERTY_NOTIFY)!=0){try{g.setCharacteristicNotification(ch,true);for(BluetoothGattDescriptor d:ch.getDescriptors()){if(d.getUuid().toString().equals("00002902-0000-1000-8000-00805f9b34fb")){d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);g.writeDescriptor(d);}}}catch(Exception ignored){}}}
        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic ch){processReading(ch.getValue());}
    });}catch(Exception e){error("Nelze připojit laser: "+e.getMessage());}}
    private void processReading(byte[] bytes){if(bytes==null)return;String raw=new String(bytes,StandardCharsets.US_ASCII).trim();Matcher m=Pattern.compile("([-+]?[0-9]+(?:[.,][0-9]+)?)\\s*(mm|cm|m|in)?",Pattern.CASE_INSENSITIVE).matcher(raw);
        if(!m.find()||m.group(0).trim().length()<2)return;try{String value=m.group(1).replace(',','.');String unit=m.group(2)==null?"mm":m.group(2);js("window.onLaserValue("+JSONObject.quote(value)+","+JSONObject.quote(unit)+")");}catch(Exception ignored){}
    }
}
