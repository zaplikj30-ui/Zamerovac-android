package cz.zamerovac.app;

import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;

/** Official Drive resumable sessions. The server's queried Range, never a saved offset, resumes I/O. */
final class DriveResumableUpload {
    private static final java.util.concurrent.ConcurrentHashMap<String,Object> UPLOADS=new java.util.concurrent.ConcurrentHashMap<>();
    private final DriveApi api;
    private final File home;
    private final String scope;
    DriveResumableUpload(DriveApi api,File home,String scope){this.api=api;this.home=home;this.scope=scope;}
    private String id(String path,String hash){String logical=path.startsWith("sync/v2/blobs/")?"sync/v2/blobs/"+hash:path;return PeerWire.hash((scope+"\n"+logical+"\n"+hash).getBytes(StandardCharsets.UTF_8));}
    String pendingPath(String proposed,String hash,long size)throws Exception{
        try(SyncLedger ledger=SyncLedger.open(home)){
            JSONObject old=ledger.transfer(id(proposed,hash));if(old==null)return proposed;
            String path=old.getString("path");DriveApi.path(path);
            if(old.getLong("size")!=size||!old.getString("hash").equals(hash)||!path.startsWith("sync/v2/blobs/"+hash))throw new IOException("Relace nepatří tomuto obsahu");return path;
        }
    }
    private static long offset(String range,long size)throws IOException{
        if(range==null)return 0;
        if(!range.matches("bytes=0-[0-9]{1,16}"))throw new IOException("Disk vrátil neplatný rozsah");
        try{long end=Long.parseLong(range.substring(8));if(end>=size)throw new IOException("Disk potvrdil rozsah mimo soubor");return end+1;}
        catch(NumberFormatException invalid){throw new IOException("Disk vrátil neplatný rozsah");}
    }
    private DriveApi.ObjectFile verify(DriveApi.ObjectFile file,String path,String hash,long size)throws Exception{
        if(!file.path.equals(path)||file.size!=size)throw new IOException("Disk nepotvrdil úplný soubor");
        try(InputStream in=api.open(file)){
            JSONObject actual=CloudFiles.copy(in,new OutputStream(){public void write(int b){}public void write(byte[] b,int o,int n){}},size);
            if(size!=actual.getLong("size")||!hash.equals(actual.getString("sha256")))throw new IOException("Serverové bajty Disku neodpovídají originálu");
        }return file;
    }
    DriveApi.ObjectFile upload(String requestedPath,File source)throws Exception{
        synchronized(UPLOADS.computeIfAbsent(home.getCanonicalPath()+"/"+scope+"/"+requestedPath,key->new Object())){return uploadLocked(requestedPath,source);}
    }
    private DriveApi.ObjectFile uploadLocked(String requestedPath,File source)throws Exception{
        DriveApi.path(requestedPath);JSONObject sourceProof=PeerMedia.inspect(source);
        String hash=sourceProof.getString("hash");long size=sourceProof.getLong("size");
        // Logical blob identity survives the random physical filename chosen after a lost response.
        String id=id(requestedPath,hash);
        String target,path=requestedPath,session="";long at=0;
        try(SyncLedger ledger=SyncLedger.open(home)){
            target=ledger.target("drive",scope,"");JSONObject old=ledger.transfer(id);
            if(old!=null){
                if(!target.equals(old.getString("target"))||!hash.equals(old.getString("hash"))||size!=old.getLong("size"))throw new IOException("Relace patří jinému zdroji");
                path=old.getString("path");DriveApi.path(path);session=old.getString("session");
                DriveHttp.endpoint(session);
                if(!session.startsWith(DriveApi.UPLOAD+"?"))throw new IOException("Nepovolená uložená relace Disku");
            }
        }
        if(!session.isEmpty()){
            try(DriveHttp.Response response=api.http.request("PUT",session,DriveApi.headers("Content-Range","bytes */"+size),new byte[0],DriveApi.JSON_LIMIT)){
                if(response.status==200||response.status==201){DriveApi.ObjectFile result=verify(DriveApi.object(DriveApi.json(response)),path,hash,size);finish(id);return result;}
                if(response.status==404||response.status==410){
                    // A final response may have been lost. Inspect every existing physical object.
                    for(DriveApi.ObjectFile candidate:api.exact(path))try{DriveApi.ObjectFile result=verify(candidate,path,hash,size);finish(id);return result;}catch(IOException incomplete){/* Keep ambiguous copies. */}
                    session="";at=0;
                }else{response.success(308);at=offset(response.header("Range"),size);}
            }
        }
        if(session.isEmpty()){
            byte[] metadata=new JSONObject().put("name",path).put("mimeType","application/octet-stream").put("parents",new JSONArray().put("appDataFolder")).toString().getBytes(StandardCharsets.UTF_8);
            try(DriveHttp.Response response=api.http.request("POST",DriveApi.UPLOAD+"?uploadType=resumable&fields="+DriveApi.encoded("id,name,size,mimeType"),DriveApi.headers("Content-Type","application/json; charset=UTF-8","X-Upload-Content-Type","application/octet-stream","X-Upload-Content-Length",String.valueOf(size)),metadata,DriveApi.JSON_LIMIT)){
                response.success(200,201);session=response.header("Location");DriveHttp.endpoint(session);
                if(!session.startsWith(DriveApi.UPLOAD+"?"))throw new IOException("Nepovolená relace Disku");
            }
            save(id,target,hash,size,session,0,path); // Durable before the first content byte.
        }
        try(FileInputStream input=new FileInputStream(source)){
            input.getChannel().position(at);byte[] buffer=new byte[DriveApi.CHUNK];
            while(at<size){
                int count=(int)Math.min(buffer.length,size-at),read=0;
                while(read<count){int n=input.read(buffer,read,count-read);if(n<=0)throw new EOFException("Zdroj nahrávání se změnil");read+=n;}
                long end=at+count;byte[] chunk=count==buffer.length?buffer:Arrays.copyOf(buffer,count);
                try(DriveHttp.Response response=api.http.request("PUT",session,DriveApi.headers("Content-Type","application/octet-stream","Content-Range","bytes "+at+"-"+(end-1)+"/"+size),chunk,DriveApi.JSON_LIMIT)){
                    if(response.status==200||response.status==201){
                        if(end!=size)throw new IOException("Disk předčasně ukončil nahrávání");
                        DriveApi.ObjectFile result=verify(DriveApi.object(DriveApi.json(response)),path,hash,size);finish(id);return result;
                    }
                    response.success(308);long confirmed=offset(response.header("Range"),size);
                    if(confirmed!=end)throw new IOException("Disk nepotvrdil právě přenesený blok");
                    at=confirmed;save(id,target,hash,size,session,at,path);
                }
            }
        }
        throw new IOException("Disk nepotvrdil dokončení souboru");
    }
    private void save(String id,String target,String hash,long size,String session,long at,String path)throws Exception{try(SyncLedger ledger=SyncLedger.open(home)){ledger.transfer(id,target,hash,size,session,at,path);}}
    private void finish(String id)throws Exception{try(SyncLedger ledger=SyncLedger.open(home)){ledger.finishTransfer(id);}}
}
