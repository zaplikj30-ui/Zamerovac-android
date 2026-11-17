package cz.zamerovac.app;

import org.json.*;
import java.io.*;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Drive v3 app-data objects, complete paginated listings and create-only resumable uploads. */
final class DriveApi {
    static final String ROOT="https://www.googleapis.com/drive/v3/files",UPLOAD="https://www.googleapis.com/upload/drive/v3/files";
    static final int PAGE=100,JSON_LIMIT=256*1024,CHUNK=256*1024;
    static final class ObjectFile {final String id,path;final long size;ObjectFile(String id,String path,long size){this.id=id;this.path=path;this.size=size;}}
    final DriveHttp http;
    DriveApi(DriveHttp http){this.http=http;}
    static String encoded(String value){try{return URLEncoder.encode(value,"UTF-8");}catch(UnsupportedEncodingException impossible){throw new AssertionError(impossible);}}
    static Map<String,String> headers(String... fields){Map<String,String> result=new HashMap<>();for(int i=0;i<fields.length;i+=2)result.put(fields[i],fields[i+1]);return result;}
    static void path(String path)throws IOException{if(path!=null&&path.startsWith("sync/"))SyncStore.parts(path);else BackupStore.parts(path);}
    static ObjectFile object(JSONObject object)throws Exception{
        String id=object.getString("id"),path=object.getString("name"),size=object.getString("size");path(path);if(!id.matches("[A-Za-z0-9_-]{1,200}")||!size.matches("0|[1-9][0-9]{0,15}")||Long.parseLong(size)>PeerSnapshot.MAX_MEDIA||!"application/octet-stream".equals(object.getString("mimeType")))throw new IOException("Disk vrátil neplatný datový blok");return new ObjectFile(id,path,Long.parseLong(size));
    }
    static JSONObject json(DriveHttp.Response response)throws Exception{return JsonInput.object(CloudFiles.read(response.body,JSON_LIMIT));}
    List<ObjectFile> list(String directory)throws Exception{path(directory);return query("name contains '"+directory+"/'",directory+"/",false);}
    List<ObjectFile> exact(String path)throws Exception{path(path);return query("name = '"+path+"'",path,true);}
    private List<ObjectFile> query(String condition,String wanted,boolean exact)throws Exception{
        List<ObjectFile> result=new ArrayList<>();Set<String> tokens=new HashSet<>(),ids=new HashSet<>();String token="";
        do{
            String address=ROOT+"?spaces=appDataFolder&pageSize="+PAGE+"&fields="+encoded("nextPageToken,incompleteSearch,files(id,name,size,mimeType)")+"&q="+encoded("'appDataFolder' in parents and trashed = false and ("+condition+")")+(token.isEmpty()?"":"&pageToken="+encoded(token));
            try(DriveHttp.Response response=http.request("GET",address,Collections.emptyMap(),null,JSON_LIMIT)){
                response.success(200);JSONObject page=json(response);if(page.optBoolean("incompleteSearch"))throw new IOException("Disk nevrátil úplný seznam");JSONArray files=page.getJSONArray("files");if(files.length()>PAGE)throw new IOException("Disk překročil velikost stránky");
                for(int i=0;i<files.length();i++){ObjectFile file=object(files.getJSONObject(i));if(!(exact?file.path.equals(wanted):file.path.startsWith(wanted)))continue;if(!ids.add(file.id))throw new IOException("Disk opakuje položku seznamu");if(result.size()>=100000)throw new IOException("Na Disku je příliš mnoho položek");result.add(file);}
                if(page.has("nextPageToken")&&!(page.get("nextPageToken") instanceof String))throw new IOException("Neplatná další stránka Disku");token=page.optString("nextPageToken");if(token.length()>4096||!token.isEmpty()&&(!tokens.add(token)||tokens.size()>1000))throw new IOException("Disk opakuje stránkování");
            }
        }while(!token.isEmpty());return result;
    }
    InputStream open(ObjectFile file)throws IOException{
        if(file==null||!file.id.matches("[A-Za-z0-9_-]{1,200}")||file.size<0||file.size>PeerSnapshot.MAX_MEDIA)throw new IOException("Neplatný soubor Disku");DriveHttp.Response response=http.request("GET",ROOT+"/"+file.id+"?alt=media",Collections.emptyMap(),null,file.size);
        try{response.success(200);return response.body;}catch(IOException failure){response.close();throw failure;}
    }
    ObjectFile upload(String path,InputStream input,long size)throws Exception{
        path(path);if(size<1||size>PeerSnapshot.MAX_MEDIA)throw new IOException("Neplatná velikost bloku Disku");String session;
        byte[] metadata=new JSONObject().put("name",path).put("mimeType","application/octet-stream").put("parents",new JSONArray().put("appDataFolder")).toString().getBytes(StandardCharsets.UTF_8);
        try(DriveHttp.Response response=http.request("POST",UPLOAD+"?uploadType=resumable&fields="+encoded("id,name,size,mimeType"),headers("Content-Type","application/json; charset=UTF-8","X-Upload-Content-Type","application/octet-stream","X-Upload-Content-Length",String.valueOf(size)),metadata,JSON_LIMIT)){
            response.success(200,201);session=response.header("Location");DriveHttp.endpoint(session);if(!session.startsWith(UPLOAD+"?"))throw new IOException("Neplatná relace nahrávání Disku");
        }
        long offset=0;byte[] buffer=new byte[CHUNK];
        while(offset<size){
            int wanted=(int)Math.min(CHUNK,size-offset),read=0;while(read<wanted){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException();int count=input.read(buffer,read,wanted-read);if(count<0)throw new EOFException("Zdroj bloku Disku je neúplný");if(count==0)throw new IOException("Zdroj bloku Disku nevrátil žádná data");read+=count;}long end=offset+wanted;if(end==size&&input.read()!=-1)throw new IOException("Zdroj bloku Disku je delší než manifest");
            byte[] chunk=wanted==CHUNK?buffer:Arrays.copyOf(buffer,wanted);
            try(DriveHttp.Response response=http.request("PUT",session,headers("Content-Type","application/octet-stream","Content-Range","bytes "+offset+"-"+(end-1)+"/"+size),chunk,JSON_LIMIT)){
                if(end<size){response.success(308);if(!("bytes=0-"+(end-1)).equals(response.header("Range")))throw new IOException("Disk nepotvrdil celý blok nahrávání");}
                else{response.success(200,201);ObjectFile created=object(json(response));if(!created.path.equals(path)||created.size!=size)throw new IOException("Disk nepotvrdil úplné nové médium");return created;}
            }
            offset=end;
        }
        throw new IOException("Disk nepotvrdil dokončení nahrávání");
    }
}
