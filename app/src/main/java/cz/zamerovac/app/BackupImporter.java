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
    private BackupImporter() {}
    /** Prepare/copy outside the DB lock; append to the latest state only at the durable commit. */
    static Result restoreZip(Context ctx,Uri uri,SharedPreferences prefs)throws Exception {
        return restoreZip(ctx,uri,prefs,ProviderIo.SHARED);
    }
    static Result restoreZip(Context ctx,Uri uri,SharedPreferences prefs,ProviderIo io)throws Exception {
        Result staged=importZip(ctx,uri,new JSONObject().put("schema",1).put("records",new JSONArray()),prefs,io);
        try{
            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Obnova byla zrušena");
            synchronized(TrashPurger.LOCK){
                if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Obnova byla zrušena");
                String text=LocalDatabase.read(ctx.getFilesDir());
                JSONObject latest=text.isEmpty()?new JSONObject().put("schema",1).put("records",new JSONArray()):new JSONObject(text);
                Result result=staged.appendTo(latest);
                LocalDatabase.write(ctx.getFilesDir(),result.data.toString());return result;
            }
        }catch(Exception failure){staged.rollback(ctx,prefs);throw failure;}
    }
    static Result importZip(Context ctx, Uri uri, JSONObject existing, SharedPreferences prefs)throws Exception {
        return importZip(ctx,uri,existing,prefs,ProviderIo.SHARED);
    }
    private static Result importZip(Context ctx,Uri uri,JSONObject existing,SharedPreferences prefs,ProviderIo io)throws Exception {
        File tempDir=new File(ctx.getCacheDir(),"restore-"+UUID.randomUUID());
        if(!tempDir.mkdirs())throw new IOException("Nelze vytvořit dočasnou složku");
        try{return read(ctx,uri,existing,prefs,tempDir,io);}
        finally{deleteDir(tempDir);}
    }
    static final class Result {
        final JSONObject data; final int recordCount; final Set<String> createdMedia;
        Result(JSONObject d,int n,Set<String> files){data=d;recordCount=n;createdMedia=files;}
        Result appendTo(JSONObject latest)throws Exception{
            JSONObject merged=new JSONObject(latest.toString());JSONArray records=merged.getJSONArray("records"),added=data.getJSONArray("records");
            for(int i=0;i<added.length();i++)records.put(added.getJSONObject(i));
            LocalDatabase.validate(merged.toString());return new Result(merged,recordCount,createdMedia);
        }
        void rollback(Context context,SharedPreferences prefs){SharedPreferences.Editor settings=prefs.edit();for(String id:createdMedia){new File(context.getFilesDir(),"media/"+id).delete();settings.remove("mime-"+id).remove("name-"+id);}settings.apply();}
    }
    private static Result read(Context context,Uri uri,JSONObject existing,SharedPreferences prefs,File tempDir,ProviderIo io)throws Exception{
        JSONObject meta=new JSONObject(),manifest=null,checksums=new JSONObject();Set<String> names=new HashSet<>();
        byte[] json=null;
        HashMap<String,File> incomingMedia=new HashMap<>();
        long total=0;int count=0;
        InputStream opened=io.call(()->context.getContentResolver().openInputStream(uri),null);
        if(opened==null)throw new IOException("Soubor nelze otevřít");
        try(InputStream input=io.input(opened)){
            try(ZipInputStream zip=new ZipInputStream(input)){
                ZipEntry entry;byte[] buffer=new byte[64*1024];
                while((entry=zip.getNextEntry())!=null){
                    ArchiveLimits.entries(++count);
                    String name=entry.getName();
                    boolean jsonFile="projects.json".equals(name)||"media-meta.json".equals(name)||"manifest.json".equals(name);
                    String mediaId=name.startsWith("media/")?name.substring(6):"";
                    boolean mediaFile=name.matches("media/[a-zA-Z0-9_-]{3,120}");
                    if(!names.add(name))throw new IOException("Duplicitní soubor v záloze");
                    if(!jsonFile&&!mediaFile){int n;while((n=zip.read(buffer))!=-1){total=ArchiveLimits.add(total,n);}zip.closeEntry();continue;}
                    ByteArrayOutputStream small=jsonFile?new ByteArrayOutputStream():null;
                    File dest=mediaFile?new File(tempDir,mediaId):null;
                    java.security.MessageDigest digest=ArchiveIntegrity.digest();long size=0;
                    try(OutputStream out=jsonFile?small:new FileOutputStream(dest)){
                        int n;long one=0;
                        while((n=zip.read(buffer))!=-1){
                            if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Obnova byla zrušena");
                            one+=n;total=ArchiveLimits.add(total,n);
                            if(jsonFile)ArchiveLimits.json(one);
                            out.write(buffer,0,n);digest.update(buffer,0,n);size+=n;
                        }
                    }
                    if(!"manifest.json".equals(name))checksums.put(name,ArchiveIntegrity.entry(size,digest.digest()));
                    if("manifest.json".equals(name))manifest=JsonInput.object(small.toByteArray());
                    if("projects.json".equals(name))json=small.toByteArray();
                    if("media-meta.json".equals(name))meta=JsonInput.object(small.toByteArray());
                    if(mediaFile)incomingMedia.put(mediaId,dest);
                    zip.closeEntry();
                }
            }
        }
        if(json==null)throw new IOException("ZIP neobsahuje projects.json");
        String sourceText=JsonInput.decode(json);LocalDatabase.validate(sourceText);JSONObject source=new JSONObject(sourceText);
        if(source.optInt("archiveFormatVersion")==2&&manifest==null)throw new IOException("V záloze chybí kontrolní manifest");
        if(manifest!=null)ArchiveIntegrity.verify(manifest,checksums);
        return restoreVerified(context,existing,prefs,source,meta,incomingMedia);
    }
    /** Network and integrity checks are completed by the caller before acquiring the local commit lock. */
    static Result restoreVerified(Context context,JSONObject existing,SharedPreferences prefs,JSONObject source,JSONObject meta,Map<String,File> incomingMedia)throws Exception{
        LocalDatabase.validate(source.toString());LocalDatabase.validate(existing.toString());
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
            rewriteAll(rec,mediaIds,0);
            rec.put("syncClock",CausalClock.advance(new JSONObject(),DeviceIdentity.get(context.getNoBackupFilesDir())));
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
                while((n=in.read(buf))!=-1){if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Obnova byla zrušena");out.write(buf,0,n);}out.getFD().sync();
            }
            JSONObject info=meta.optJSONObject(pair.getKey());
            settings.putString("mime-"+pair.getValue(),info!=null?info.optString("mime","application/octet-stream"):"application/octet-stream");
            settings.putString("name-"+pair.getValue(),info!=null?info.optString("name","Příloha"):"Příloha");
        }
        }catch(Exception failure){for(String id:created)new File(mediaDir,id).delete();throw failure;}
        if(!settings.commit()){for(String id:created)new File(mediaDir,id).delete();throw new IOException("Metadata obnovy nebyla potvrzena");}
        root.put("syncClock",CausalClock.advance(new JSONObject(),DeviceIdentity.get(context.getNoBackupFilesDir())));
        target.put(root);
        for(JSONObject rec:newRecords)target.put(rec);
        FolderHierarchy.repair(target);
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
    private static void rewriteAll(Object value,Map<String,String> mapping,int depth)throws Exception{
        if(depth>100)throw new IOException("Příliš zanořená obnova");
        if(value instanceof JSONObject){JSONObject object=(JSONObject)value;for(Iterator<String> it=object.keys();it.hasNext();){String key=it.next();Object child=object.get(key);
            if("media".equals(key)||"audioMedia".equals(key)){if(!(child instanceof JSONArray))throw new IOException("Neplatný seznam příloh v záloze");rewriteMedia((JSONArray)child,mapping);}
            else if("items".equals(key)&&child instanceof String&&((String)child).trim().startsWith("[")){JsonInput.check((String)child);JSONArray items=new JSONArray((String)child);rewriteAll(items,mapping,depth+1);object.put(key,items.toString());}
            else rewriteAll(child,mapping,depth+1);
        }}else if(value instanceof JSONArray){JSONArray array=(JSONArray)value;for(int i=0;i<array.length();i++)rewriteAll(array.get(i),mapping,depth+1);}
    }
    private static void deleteDir(File dir){
        File[] contents=dir.listFiles();if(contents!=null)for(File f:contents)if(f.isDirectory())deleteDir(f);else f.delete();
        dir.delete();
    }
}
