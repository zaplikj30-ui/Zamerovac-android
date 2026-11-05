package cz.zamerovac.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONException;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/** Bezpečná obnova vlastní ZIP zálohy Zaměřovače jako NOVÉ složky.
 * Existující záznamy a jejich identifikátory nemění.
 * Zachovává původní fotky i všechny editovatelné kóty/skici.
 */
final class BackupImporter {
    private static final long LIMIT=2L*1024*1024*1024;
    private static final int MAX_ENTRIES=20000;
    private static final int MAX_JSON=20*1024*1024;
    private BackupImporter() {}
    static Result importZip(Context ctx, Uri uri, JSONObject existing, SharedPreferences prefs)throws Exception {
        File tempDir=new File(ctx.getCacheDir(),"restore-"+UUID.randomUUID());
        if(!tempDir.mkdirs())throw new IOException("Nelze vytvořit dočasnou složku");
        try{return read(ctx,uri,existing,prefs,tempDir);}
        finally{deleteDir(tempDir);}
    }
    static final class Result {
        final JSONObject data; final int recordCount; final Set<String> createdMedia;
        Result(JSONObject d,int n,Set<String> files){data=d;recordCount=n;createdMedia=files;}
        void rollback(Context context,SharedPreferences prefs){SharedPreferences.Editor settings=prefs.edit();for(String id:createdMedia){new File(context.getFilesDir(),"media/"+id).delete();settings.remove("mime-"+id).remove("name-"+id);}settings.apply();}
    }
    private static Result read(Context context,Uri uri,JSONObject existing,SharedPreferences prefs,File tempDir)throws Exception{
        JSONObject meta=new JSONObject(),manifest=null,checksums=new JSONObject();Set<String> names=new HashSet<>();
        byte[] json=null;
        HashMap<String,File> incomingMedia=new HashMap<>();
        long total=0;int count=0;
        try(InputStream input=context.getContentResolver().openInputStream(uri)){
            if(input==null)throw new IOException("Soubor nelze otevřít");
            try(ZipInputStream zip=new ZipInputStream(input)){
                ZipEntry entry;byte[] buffer=new byte[64*1024];
                while((entry=zip.getNextEntry())!=null){
                    if(++count>MAX_ENTRIES)throw new IOException("Příliš mnoho souborů v záloze");
                    if(entry.isDirectory()){zip.closeEntry();continue;}
                    String name=entry.getName();
                    boolean jsonFile="projects.json".equals(name)||"media-meta.json".equals(name)||"manifest.json".equals(name);
                    String mediaId=name.startsWith("media/")?name.substring(6):"";
                    boolean mediaFile=name.matches("media/[a-zA-Z0-9_-]{3,120}");
                    if(!names.add(name))throw new IOException("Duplicitní soubor v záloze");
                    if(!jsonFile&&!mediaFile){int n;while((n=zip.read(buffer))!=-1){total+=n;if(total>LIMIT)throw new IOException("Záloha překračuje limit 2 GB");}zip.closeEntry();continue;}
                    ByteArrayOutputStream small=jsonFile?new ByteArrayOutputStream():null;
                    File dest=mediaFile?new File(tempDir,mediaId):null;
                    java.security.MessageDigest digest=ArchiveIntegrity.digest();long size=0;
                    try(OutputStream out=jsonFile?small:new FileOutputStream(dest)){
                        int n;long one=0;
                        while((n=zip.read(buffer))!=-1){
                            one+=n;total+=n;
                            if(total>LIMIT)throw new IOException("Záloha překračuje limit 2 GB");
                            if(jsonFile&&one>MAX_JSON)throw new IOException("Databáze v ZIP je příliš velká");
                            out.write(buffer,0,n);digest.update(buffer,0,n);size+=n;
                        }
                    }
                    if(!"manifest.json".equals(name))checksums.put(name,ArchiveIntegrity.entry(size,digest.digest()));
                    if("manifest.json".equals(name))manifest=new JSONObject(new String(small.toByteArray(),StandardCharsets.UTF_8));
                    if("projects.json".equals(name))json=small.toByteArray();
                    if("media-meta.json".equals(name))meta=new JSONObject(new String(small.toByteArray(),StandardCharsets.UTF_8));
                    if(mediaFile)incomingMedia.put(mediaId,dest);
                    zip.closeEntry();
                }
            }
        }
        if(json==null)throw new IOException("ZIP neobsahuje projects.json");
        JSONObject source=new JSONObject(new String(json,StandardCharsets.UTF_8));
        if(source.optInt("archiveFormatVersion")==2&&manifest==null)throw new IOException("V záloze chybí kontrolní manifest");
        if(manifest!=null)ArchiveIntegrity.verify(manifest,checksums);
        if(source.optInt("schema")!=1||existing.optInt("schema")!=1)throw new IOException("Nepodporovaný formát zálohy");
        JSONArray records=source.optJSONArray("records");
        if(records==null)throw new IOException("Záloha neobsahuje zakázky");
        String now=java.time.Instant.now().toString();
        String rootId=UUID.randomUUID().toString();
        JSONObject root=new JSONObject().put("id",rootId).put("kind","folder")
            .put("title",restoredTitle(records)+" – obnovená kopie "+new java.text.SimpleDateFormat("d. M. yyyy",Locale.forLanguageTag("cs-CZ")).format(new Date()))
            .put("parentId",JSONObject.NULL).put("createdAt",now).put("updatedAt",now)
            .put("rev",UUID.randomUUID().toString()).put("media",new JSONArray())
            .put("items",new JSONArray()).put("checks",new JSONArray()).put("text","").put("deleted",false);
        JSONObject result=new JSONObject(existing.toString());
        JSONArray target=result.optJSONArray("records");
        if(target==null){target=new JSONArray();result.put("records",target);}
        HashMap<String,String> recIds=new HashMap<>();
        HashMap<String,String> mediaIds=new HashMap<>();
        for(int i=0;i<records.length();i++){
            JSONObject rec=records.optJSONObject(i);
            if(rec==null||rec.optBoolean("deleted"))continue;
            String id=rec.optString("id");
            if(!id.isEmpty()){
                if(recIds.containsKey(id))throw new IOException("Záloha obsahuje duplicitní identifikátor zakázky");
                recIds.put(id,UUID.randomUUID().toString());
            }
        }
        ArrayList<JSONObject> newRecords=new ArrayList<>();
        for(int i=0;i<records.length();i++){
            JSONObject old=records.optJSONObject(i);
            if(old==null||old.optBoolean("deleted")||!recIds.containsKey(old.optString("id")))continue;
            JSONObject rec=new JSONObject(old.toString());
            rec.put("id",recIds.get(old.optString("id")));
            String oldParent=old.optString("parentId","");
            rec.put("parentId",recIds.getOrDefault(oldParent,rootId));
            rec.put("rev",UUID.randomUUID().toString());
            rec.put("updatedAt",now);rec.put("deleted",false);
            rewriteMedia(rec.optJSONArray("media"),mediaIds);
            rewriteItems(rec.optJSONArray("items"),mediaIds);
            JSONArray history=rec.optJSONArray("versionHistory");
            if(history!=null)for(int h=0;h<history.length();h++){JSONObject version=history.getJSONObject(h);String text=version.optString("items","[]");if(text.trim().startsWith("[")){JSONArray oldItems=new JSONArray(text);rewriteItems(oldItems,mediaIds);version.put("items",oldItems.toString());}}
            newRecords.add(rec);
        }
        if(newRecords.isEmpty())throw new IOException("Záloha neobsahuje platné záznamy");
        // Zkontrolujeme všechny soubory před změnou databáze.
        for(String id:mediaIds.keySet()){
            if(!incomingMedia.containsKey(id)||!incomingMedia.get(id).isFile())
                throw new IOException("V záloze chybí příloha "+id);
        }
        File mediaDir=new File(context.getFilesDir(),"media");
        if(!mediaDir.exists()&&!mediaDir.mkdirs())throw new IOException("Nelze vytvořit složku médií");
        SharedPreferences.Editor settings=prefs.edit();
        Set<String> created=new HashSet<>();
        try{for(Map.Entry<String,String> pair:mediaIds.entrySet()){
            File targetMedia=new File(mediaDir,pair.getValue());
            if(targetMedia.exists())throw new IOException("Kolize identifikátoru obnovené přílohy");created.add(pair.getValue());
            try(InputStream in=new FileInputStream(incomingMedia.get(pair.getKey()));
                FileOutputStream out=new FileOutputStream(targetMedia)){
                byte[] buf=new byte[64*1024];int n;
                while((n=in.read(buf))!=-1)out.write(buf,0,n);out.getFD().sync();
            }
            JSONObject info=meta.optJSONObject(pair.getKey());
            settings.putString("mime-"+pair.getValue(),info!=null?info.optString("mime","application/octet-stream"):"application/octet-stream");
            settings.putString("name-"+pair.getValue(),info!=null?info.optString("name","Příloha"):"Příloha");
        }
        }catch(Exception failure){for(String id:created)new File(mediaDir,id).delete();throw failure;}
        settings.apply();
        target.put(root);
        for(JSONObject rec:newRecords)target.put(rec);
        return new Result(result,newRecords.size(),created);
    }
    static String restoredTitle(JSONArray records){
        Set<String> ids=new HashSet<>();
        for(int i=0;i<records.length();i++){
            JSONObject r=records.optJSONObject(i);
            if(r!=null&&!r.optBoolean("deleted"))ids.add(r.optString("id"));
        }
        List<String> names=new ArrayList<>();
        for(int i=0;i<records.length();i++){
            JSONObject r=records.optJSONObject(i);
            if(r==null||r.optBoolean("deleted")||ids.contains(r.optString("parentId")))continue;
            String name=r.optString("title", "").trim();
            if(!name.isEmpty())names.add(name);
        }
        if(names.isEmpty())return "Záloha";
        String first=names.get(0);
        if(first.length()>100)first=first.substring(0,100);
        return first+(names.size()>1?" a další ("+names.size()+")":"");
    }
    private static void rewriteMedia(JSONArray media,Map<String,String> mapping)throws JSONException,IOException{
        if(media==null)return;
        for(int i=0;i<media.length();i++){
            String id=media.optString(i);
            if(!(media.opt(i) instanceof String)||!id.matches("[a-zA-Z0-9_-]{3,120}"))
                throw new IOException("Neplatný identifikátor přílohy v záloze");
            media.put(i,mapping.computeIfAbsent(id,k->UUID.randomUUID().toString()));
        }
    }
    private static void rewriteItems(JSONArray items,Map<String,String> mapping)throws JSONException,IOException{
        if(items==null)return;
        for(int i=0;i<items.length();i++){
            JSONObject item=items.optJSONObject(i);if(item==null)continue;
            rewriteMedia(item.optJSONArray("media"),mapping);
            rewriteMedia(item.optJSONArray("audioMedia"),mapping);
            rewriteItems(item.optJSONArray("detailItems"),mapping);
        }
    }
    private static void deleteDir(File dir){
        File[] contents=dir.listFiles();if(contents!=null)for(File f:contents)if(f.isDirectory())deleteDir(f);else f.delete();
        dir.delete();
    }
}
