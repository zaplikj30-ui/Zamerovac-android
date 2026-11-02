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
import android.webkit.WebSettings;

import org.json.JSONException;
import org.json.JSONObject;

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
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class MainActivity extends Activity {
    private static final int REQUEST_FILE=20,REQUEST_TREE=21,REQUEST_CAMERA=22,REQUEST_EXPORT=23,REQUEST_PERMISSIONS=24,REQUEST_ATTACH=25;
    private WebView web;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraOutput;
    private String cameraId;
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
        getWindow().setStatusBarColor(Color.rgb(112,135,29));
        getWindow().setNavigationBarColor(Color.rgb(20,21,22));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(37,38,40));setContentView(web);
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
                        return new WebResourceResponse(mediaMime(id),null,new FileInputStream(f));
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
    private boolean validId(String s){return s.matches("[a-zA-Z0-9_-]{3,120}");}
    private String mediaMime(String id){return settings.getString("mime-"+id,"application/octet-stream");}
    private void js(String code){runOnUiThread(()->web.evaluateJavascript(code,null));}
    private void jsCall(String fn,String jsonLiteral){js("window."+fn+"("+JSONObject.quote(jsonLiteral)+")");}
    private void error(String s){jsCall("onNativeError",s);}
    private void onSyncResult(String msg,JSONObject data){try{JSONObject result=new JSONObject().put("message",msg);if(data!=null)result.put("data",data);jsCall("onNativeSync",result.toString());}catch(Exception e){error(e.getMessage());}}
    @Override public void onBackPressed(){web.evaluateJavascript("(function(){let m=document.getElementById('modal');if(m&&!m.hidden){m.hidden=true;return}let s=document.getElementById('settingsPanel');if(s&&!s.hidden){s.hidden=true;return}if(typeof screen!=='undefined'&&screen==='editor')exitEditor();else if(typeof screen!=='undefined'&&screen==='note')saveNote();else if(typeof currentFolder!=='undefined'&&currentFolder){currentFolder=recById(currentFolder)?.parentId||null;showFolder()}else showFolder()})()",null);}
    private void selectCloud(){Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT_TREE);i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION);startActivityForResult(i,REQUEST_TREE);}
    private void exportPng(String name,String b64){exportBase64=b64;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("image/png").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,name);startActivityForResult(i,REQUEST_EXPORT);}
    private void useCamera(){
        if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.CAMERA)!=PackageManager.PERMISSION_GRANTED){requestPermissions(new String[]{Manifest.permission.CAMERA},REQUEST_PERMISSIONS);error("Povol fotoaparát a zkus to znovu");return;}
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
        try(InputStream in=getContentResolver().openInputStream(uri);OutputStream out=new FileOutputStream(mediaFile(id))){if(in==null)throw new IOException("Cannot read file");copy(in,out);}
        settings.edit().putString("mime-"+id,mime).putString("name-"+id,name).apply();
        js("window.onNativeMedia("+JSONObject.quote(id)+","+JSONObject.quote(mime)+","+JSONObject.quote(name)+")");
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);
        if(request==REQUEST_FILE){if(fileCallback!=null){Uri[] resultUris=null;if(result==RESULT_OK&&data!=null){if(data.getClipData()!=null){int n=data.getClipData().getItemCount();resultUris=new Uri[n];for(int i=0;i<n;i++)resultUris[i]=data.getClipData().getItemAt(i).getUri();}else if(data.getData()!=null)resultUris=new Uri[]{data.getData()};}fileCallback.onReceiveValue(resultUris);fileCallback=null;}return;}
        if(result!=RESULT_OK){if(request==REQUEST_ATTACH)js("window.onNativeMediaDone?.()");return;}
        if(request==REQUEST_ATTACH&&data!=null){int done=0;try{
            if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++){importUri(data.getClipData().getItemAt(i).getUri());done++;}}
            else if(data.getData()!=null){importUri(data.getData());done++;}
        }catch(Exception ex){error("Import souborů: "+ex.getMessage());}js("window.onNativeMediaDone?.()");return;}
        if(request==REQUEST_CAMERA&&cameraOutput!=null){try{filePicked(cameraOutput,cameraId,"image/jpeg","Foto "+System.currentTimeMillis()+".jpg");}catch(Exception e){error(e.toString());}js("window.onNativeMediaDone?.()");return;}
        if(request==REQUEST_TREE&&data!=null&&data.getData()!=null){Uri uri=data.getData();try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_WRITE_URI_PERMISSION);settings.edit().putString("treeUri",uri.toString()).apply();scheduleSync();syncCloud();}catch(Exception e){error("Nelze použít vybranou složku: "+e.getMessage());}return;}
        if(request==REQUEST_EXPORT&&data!=null&&data.getData()!=null&&exportBase64!=null){try(OutputStream out=getContentResolver().openOutputStream(data.getData(),"w")){out.write(Base64.decode(exportBase64,Base64.DEFAULT));exportBase64=null;onSyncResult("Obrázek uložen",null);}catch(Exception e){error("Export: "+e.getMessage());}}
    }
    private static void copy(InputStream a,OutputStream b) throws IOException{byte[] buf=new byte[64*1024];int n;while((n=a.read(buf))!=-1)b.write(buf,0,n);}
    public final class JsApi{
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
        @JavascriptInterface public void configure(String json){try{JSONObject p=new JSONObject(json);settings.edit().putBoolean("wifiOnly",p.optBoolean("wifiOnly",false)).putBoolean("autoSync",p.optBoolean("autoSync",true)).apply();runOnUiThread(()->{if(p.optBoolean("keepAwake"))getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);else getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);if(p.optBoolean("fullscreen"))getWindow().getDecorView().setSystemUiVisibility(4|1024);else getWindow().getDecorView().setSystemUiVisibility(0);});scheduleSync();}catch(Exception e){error(e.getMessage());}}
        @JavascriptInterface public boolean startAudio(String id){if(Build.VERSION.SDK_INT>=23&&checkSelfPermission(Manifest.permission.RECORD_AUDIO)!=PackageManager.PERMISSION_GRANTED){runOnUiThread(()->requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO},REQUEST_PERMISSIONS));error("Povol mikrofon a spusť záznam znovu");return false;}
            try{recordingId=id;recorder=new MediaRecorder();recorder.setAudioSource(MediaRecorder.AudioSource.MIC);recorder.setOutputFormat(MediaRecorder.OutputFormat.MPEG_4);recorder.setAudioEncoder(MediaRecorder.AudioEncoder.AAC);recorder.setOutputFile(mediaFile(id).getAbsolutePath());recorder.prepare();recorder.start();settings.edit().putString("mime-"+id,"audio/mp4").putString("name-"+id,"Hlasová poznámka.m4a").apply();return true;}catch(Exception e){error("Mikrofon: "+e.getMessage());return false;}}
        @JavascriptInterface public void stopAudio(){try{if(recorder!=null){recorder.stop();recorder.reset();recorder.release();recorder=null;}}catch(Exception e){error("Nahrávání: "+e.getMessage());}}
        @JavascriptInterface public void connectLaser(){runOnUiThread(()->showLaserChoices());}
    }
    private void closeUpload(){try{if(activeUpload!=null)activeUpload.close();}catch(Exception ignored){}activeUpload=null;activeUploadId=null;}
    private String readDb() throws IOException {File db=new File(getFilesDir(),"projects.json");if(!db.isFile())return "";try(InputStream in=new FileInputStream(db)){java.io.ByteArrayOutputStream o=new java.io.ByteArrayOutputStream();copy(in,o);return o.toString("UTF-8");}}
    private synchronized void writeDb(String data) throws IOException {File next=new File(getFilesDir(),"projects.tmp"),dest=new File(getFilesDir(),"projects.json");try(FileOutputStream out=new FileOutputStream(next)){out.write(data.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}if(!next.renameTo(dest))throw new IOException("Cannot replace local database");}
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
                value->js("window.onLaserValue("+JSONObject.quote(value)+","+JSONObject.quote("mm")+")"),this::error);
            classic.start();
        }).setNegativeButton("Zrušit",null).show();
    }
    private void startScan(){if(Build.VERSION.SDK_INT>=31&&(checkSelfPermission(Manifest.permission.BLUETOOTH_SCAN)!=PackageManager.PERMISSION_GRANTED||checkSelfPermission(Manifest.permission.BLUETOOTH_CONNECT)!=PackageManager.PERMISSION_GRANTED)){requestPermissions(new String[]{Manifest.permission.BLUETOOTH_SCAN,Manifest.permission.BLUETOOTH_CONNECT},REQUEST_PERMISSIONS);error("Povol Bluetooth a vyber měřič znovu");return;}
        BluetoothManager m=(BluetoothManager)getSystemService(BLUETOOTH_SERVICE);BluetoothAdapter adapter=m.getAdapter();if(adapter==null||!adapter.isEnabled()){new AlertDialog.Builder(this).setMessage("Zapni Bluetooth v telefonu a zkus připojení znovu.").setPositiveButton("OK",null).show();return;}
        scanner=adapter.getBluetoothLeScanner();if(scanner==null){error("Bluetooth BLE není dostupné");return;}scanned.clear();scanCallback=new ScanCallback(){@Override public void onScanResult(int callbackType,ScanResult result){BluetoothDevice d=result.getDevice();if(!scanned.contains(d))scanned.add(d);}};try{scanner.startScan(scanCallback);handler.postDelayed(()->{try{scanner.stopScan(scanCallback);}catch(Exception ignored){}ArrayList<BluetoothDevice> list=new ArrayList<>(scanned);if(list.isEmpty()){error("Nebylo nalezeno žádné BLE zařízení");return;}String[] names=new String[list.size()];for(int i=0;i<list.size();i++){BluetoothDevice d=list.get(i);String name=d.getName();names[i]=(name==null||name.isEmpty()?"Neznámé zařízení":name)+" · "+d.getAddress();}new AlertDialog.Builder(this).setTitle("Vyber laser Bosch").setItems(names,(dlg,i)->connectGatt(list.get(i))).setNegativeButton("Zrušit",null).show();},7000);}catch(SecurityException ex){error("Bluetooth oprávnění: "+ex.getMessage());}}
    private void connectGatt(BluetoothDevice device){try{if(gatt!=null)gatt.close();gatt=device.connectGatt(this,false,new BluetoothGattCallback(){
        @Override public void onConnectionStateChange(BluetoothGatt g,int status,int newState){if(newState==2){g.discoverServices();jsCall("onNativeError","Bluetooth připojeno; ověřujeme protokol měřiče");}else if(newState==0)error("Bluetooth odpojeno");}
        @Override public void onServicesDiscovered(BluetoothGatt g,int status){for(BluetoothGattService srv:g.getServices())for(BluetoothGattCharacteristic ch:srv.getCharacteristics())if((ch.getProperties()&BluetoothGattCharacteristic.PROPERTY_NOTIFY)!=0){try{g.setCharacteristicNotification(ch,true);for(BluetoothGattDescriptor d:ch.getDescriptors()){if(d.getUuid().toString().equals("00002902-0000-1000-8000-00805f9b34fb")){d.setValue(BluetoothGattDescriptor.ENABLE_NOTIFICATION_VALUE);g.writeDescriptor(d);}}}catch(Exception ignored){}}}
        @Override public void onCharacteristicChanged(BluetoothGatt g,BluetoothGattCharacteristic ch){processReading(ch.getValue());}
    });}catch(Exception e){error("Nelze připojit laser: "+e.getMessage());}}
    private void processReading(byte[] bytes){if(bytes==null)return;String raw=new String(bytes,StandardCharsets.US_ASCII).trim();Matcher m=Pattern.compile("([-+]?[0-9]+(?:[.,][0-9]+)?)\\s*(mm|cm|m|in)?",Pattern.CASE_INSENSITIVE).matcher(raw);
        if(!m.find()||m.group(0).trim().length()<2)return;try{String value=m.group(1).replace(',','.');String unit=m.group(2)==null?"mm":m.group(2);js("window.onLaserValue("+JSONObject.quote(value)+","+JSONObject.quote(unit)+")");}catch(Exception ignored){}
    }
}
