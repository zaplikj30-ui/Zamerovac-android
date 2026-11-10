package cz.zamerovac.app;

import android.content.ContentResolver;
import android.content.Context;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Local-first, record-wise cloud sync using Android's Storage Access Framework.
 * The storage provider is user-selected; Google Drive is supported when its
 * DocumentsProvider offers a writable folder. No Google account secrets in app.
 */
public class SyncEngine {
    public static final class Result {
        public final String message;
        public final JSONObject data;
        Result(String msg, JSONObject json) { message=msg;data=json; }
    }
    private final Context context;
    private final ContentResolver resolver;
    private final SharedPreferences prefs;
    private final File home, mediaDir;
    private final Uri tree;

    public SyncEngine(Context c, SharedPreferences p) {
        context=c.getApplicationContext(); resolver=context.getContentResolver(); prefs=p;
        home=context.getFilesDir();mediaDir=new File(home,"media");
        mediaDir.mkdirs();String s=p.getString("treeUri",null); tree=s==null?null:Uri.parse(s);
    }
    private static String slurp(InputStream in) throws Exception {
        ByteArrayOutputStream b=new ByteArrayOutputStream();byte[] block=new byte[65536];int n;
        while((n=in.read(block))!=-1){if(b.size()+n>20*1024*1024)throw new java.io.IOException("Cloudová databáze je příliš velká");b.write(block,0,n);}
        return JsonInput.decode(b.toByteArray());
    }
    private String loadLocal() throws Exception {return LocalDatabase.readForCas(context);}
    private void saveLocal(String text) throws Exception {LocalDatabase.write(context,text);}
    private JSONObject parse(String text) throws Exception {
        if(text==null||text.isEmpty())return new JSONObject().put("schema",1).put("records",new JSONArray()).put("prefs",new JSONObject());
        LocalDatabase.validate(text);JSONObject o=new JSONObject(text);
        return o;
    }
    private Map<String,String> baseline(){Map<String,String> m=new HashMap<>();try{
        JSONObject j=new JSONObject(prefs.getString("syncBase","{}"));for(java.util.Iterator<String> it=j.keys();it.hasNext();){String k=it.next();m.put(k,j.optString(k));}
        }catch(Exception ignored){}return m;}
    private String nextBaseline="{}";
    JSONObject mergePeer(JSONObject local,JSONObject remote)throws Exception{LocalDatabase.validate(local.toString());LocalDatabase.validate(remote.toString());return merge(local,remote,java.util.Collections.emptyMap());}
    private JSONObject merge(JSONObject local,JSONObject remote)throws Exception{return merge(local,remote,baseline());}
    private JSONObject merge(JSONObject local,JSONObject remote,Map<String,String> base)throws Exception{
        Map<String,JSONObject> l=new HashMap<>(), r=new HashMap<>();
        JSONArray a=local.optJSONArray("records"), b=remote.optJSONArray("records");
        if(a!=null)for(int i=0;i<a.length();i++){JSONObject rec=a.optJSONObject(i);if(rec!=null&&rec.has("id"))l.put(rec.getString("id"),rec);}
        if(b!=null)for(int i=0;i<b.length();i++){JSONObject rec=b.optJSONObject(i);if(rec!=null&&rec.has("id"))r.put(rec.getString("id"),rec);}
        Set<String> purged=TrashPurger.purgedIds(local);purged.addAll(TrashPurger.purgedIds(remote));
        Set<String> all=new HashSet<>();all.addAll(l.keySet());all.addAll(r.keySet());
        JSONObject tombstones=CausalClock.tombstones(local.optJSONObject("syncTombstones"),remote.optJSONObject("syncTombstones"));
        for(String id:purged)if(!tombstones.has(id))tombstones.put(id,new JSONObject());
        Set<String> generatedConflicts=new HashSet<>(),knownConflictSources=new HashSet<>();for(JSONObject record:l.values())if(record.has("conflictSource"))knownConflictSources.add(record.optString("conflictSource"));for(JSONObject record:r.values())if(record.has("conflictSource"))knownConflictSources.add(record.optString("conflictSource"));
        JSONArray merged=new JSONArray();JSONObject nextBase=new JSONObject();
        // Deterministic order keeps generated JSON stable.
        ArrayList<String> sorted=new ArrayList<>(all);java.util.Collections.sort(sorted);
        for(String id: sorted){JSONObject lv=l.get(id),rv=r.get(id), chosen;
            if(tombstones.has(id)){
                for(JSONObject record:new JSONObject[]{lv,rv})if(record!=null&&!record.optBoolean("deleted")){
                    JSONObject clock=CausalClock.clock(record);String relation=CausalClock.compare(clock,tombstones.getJSONObject(id));
                    if(clock.length()==0||"after".equals(relation)||"concurrent".equals(relation)){
                        JSONObject copy=SyncConflicts.purged(id,record,tombstones.getJSONObject(id));String copyId=copy.getString("id"),source=copy.getString("conflictSource");
                        if(!knownConflictSources.contains(source)&&!tombstones.has(copyId)&&!l.containsKey(copyId)&&!r.containsKey(copyId)&&generatedConflicts.add(copyId))merged.put(copy);
                    }
                }
                continue;
            }
            if(purged.contains(id)){
                if(lv!=null&&lv.optBoolean("deleted"))lv=null;
                if(rv!=null&&rv.optBoolean("deleted"))rv=null;
                if(lv==null&&rv==null)continue;
            }
            if(lv==null)chosen=rv;
            else if(rv==null)chosen=lv;
            else {
                String lrev=lv.optString("rev",""),rrev=rv.optString("rev","");
                String known=base.get(id);
                JSONObject lc=CausalClock.clock(lv),rc=CausalClock.clock(rv);String order=CausalClock.compare(lc,rc);
                if(CausalClock.canonical(lv).equals(CausalClock.canonical(rv)))chosen=lv;
                else if(lc.length()>0&&rc.length()>0&&"after".equals(order))chosen=lv;
                else if(lc.length()>0&&rc.length()>0&&"before".equals(order))chosen=rv;
                else if(FolderHierarchy.sameIntent(lv,rv))chosen=lv;
                else if(FolderHierarchy.sameIntent(rv,lv))chosen=rv;
                else if(!(lc.length()>0&&rc.length()>0)&&known!=null&&!lrev.equals(rrev)&&known.equals(lrev))chosen=rv;
                else if(!(lc.length()>0&&rc.length()>0)&&known!=null&&!lrev.equals(rrev)&&known.equals(rrev))chosen=lv;
                else {
                    // Preserve independent edits; do not discard either side.
                    JSONObject conflict=SyncConflicts.normal(lv,rv);chosen="local".equals(conflict.getString("winner"))?lv:rv;JSONObject losing=conflict.getJSONObject("copy");String conflictId=losing.getString("id");
                    if(!tombstones.has(conflictId)&&!l.containsKey(conflictId)&&!r.containsKey(conflictId))merged.put(losing);
                }
            }
            merged.put(chosen);nextBase.put(id,chosen.optString("rev",""));
        }
        ArrayList<JSONObject> orderedRecords=new ArrayList<>();for(int i=0;i<merged.length();i++)orderedRecords.add(merged.getJSONObject(i));orderedRecords.sort(java.util.Comparator.comparing(record->record.optString("id")));JSONArray ordered=new JSONArray();for(JSONObject record:orderedRecords)ordered.put(record);
        ArrayList<String> orderedPurged=new ArrayList<>(purged);java.util.Collections.sort(orderedPurged);JSONObject result=new JSONObject(local.toString());result.put("records",ordered);result.put("trashPurgedIds",new JSONArray(orderedPurged));result.put("syncTombstones",tombstones);
        // Preferences are device-local (screen size, tool order, colors). Never overwrite.
        FolderHierarchy.repair(ordered);
        nextBaseline=nextBase.toString();
        return result;
    }
    private Uri dir(String parentId,String name,boolean create) throws Exception{
        Uri parent=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parentId);
        try(Cursor c=resolver.query(parent,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE},null,null,null)){
            if(c==null)throw new java.io.IOException("Nelze načíst cloudovou složku");
            while(c.moveToNext())if(name.equals(c.getString(1))&&Document.MIME_TYPE_DIR.equals(c.getString(2))){
                return DocumentsContract.buildDocumentUriUsingTree(tree,c.getString(0));}
        }
        if(!create)return null;
        return DocumentsContract.createDocument(resolver,DocumentsContract.buildDocumentUriUsingTree(tree,parentId),Document.MIME_TYPE_DIR,name);
    }
    private static class Entry {Uri uri;String mime;Entry(Uri u,String m){uri=u;mime=m;}}
    private Map<String,Entry> children(String parent) throws Exception{
        Map<String,Entry> result=new HashMap<>();Uri query=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parent);
        try(Cursor c=resolver.query(query,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE},null,null,null)){
            if(c==null)throw new java.io.IOException("Nelze načíst cloudovou složku");
            while(c.moveToNext())result.put(c.getString(1),new Entry(DocumentsContract.buildDocumentUriUsingTree(tree,c.getString(0)),c.getString(2)));
        }
        return result;
    }
    private String readDoc(Uri doc) throws Exception{try(InputStream in=resolver.openInputStream(doc)){if(in==null)throw new Exception("Nelze číst cloudový soubor");return slurp(in);}}
    private void writeDoc(Uri doc,String text) throws Exception{try(OutputStream out=resolver.openOutputStream(doc,"wt")){if(out==null)throw new Exception("Nelze zapisovat na disk");out.write(text.getBytes(StandardCharsets.UTF_8));out.flush();}}
    private String docId(Uri uri){return DocumentsContract.getDocumentId(uri);}
    private String contentType(String id){return prefs.getString("mime-"+id,"application/octet-stream");}
    private void copy(InputStream in,OutputStream out) throws Exception{byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);}
    private static void references(Object value,Set<String> ids)throws Exception{
        if(value instanceof JSONObject){JSONObject o=(JSONObject)value;
            for(String key:new String[]{"media","audioMedia"}){JSONArray media=o.optJSONArray(key);if(media!=null)for(int i=0;i<media.length();i++){String id=media.getString(i);if(!id.matches("[a-zA-Z0-9_-]{3,120}"))throw new java.io.IOException("Neplatná příloha synchronizace");ids.add(id);}}
            for(java.util.Iterator<String> it=o.keys();it.hasNext();){String key=it.next();if(!"prefs".equals(key)){Object child=o.get(key);if("items".equals(key)&&child instanceof String&&((String)child).trim().startsWith("[")){JsonInput.check((String)child);references(new JSONArray((String)child),ids);}else references(child,ids);}}
        }else if(value instanceof JSONArray){JSONArray a=(JSONArray)value;for(int i=0;i<a.length();i++)references(a.get(i),ids);}
    }
    protected void transferMedia(JSONObject data)throws Exception {
        Uri mediaFolder=dir(DocumentsContract.getTreeDocumentId(tree),"media",true);if(mediaFolder==null)throw new java.io.IOException("Nelze vytvořit složku media");
        Map<String,Entry> remote=children(docId(mediaFolder));Set<String> needed=new HashSet<>();references(data.optJSONArray("records"),needed);
        for(String id:needed){
            if(Thread.currentThread().isInterrupted())throw new java.io.InterruptedIOException("Přenos byl přerušen");
            File file=new File(mediaDir,id);Entry entry=remote.get(id);
            if(file.isFile()){
                JSONObject localHash;try(InputStream in=new FileInputStream(file)){localHash=ArchiveIntegrity.copy(in,DISCARD);}
                if(entry!=null){JSONObject remoteHash;try(InputStream in=resolver.openInputStream(entry.uri)){if(in==null)throw new java.io.IOException("Příloha není dostupná");remoteHash=ArchiveIntegrity.copy(in,DISCARD);}
                    if(!localHash.toString().equals(remoteHash.toString()))throw new java.io.IOException("Obsah přílohy se liší; obě kopie zůstávají zachované: "+id);
                }else{
                    Uri target=DocumentsContract.createDocument(resolver,mediaFolder,contentType(id),id);if(target==null)throw new java.io.IOException("Nelze vytvořit přílohu");
                    try{
                        try(InputStream in=new FileInputStream(file);OutputStream out=resolver.openOutputStream(target,"w")){if(out==null)throw new java.io.IOException("Zápis odmítnut");copy(in,out);}
                        JSONObject verified;try(InputStream in=resolver.openInputStream(target)){if(in==null)throw new java.io.IOException("Nelze ověřit zápis");verified=ArchiveIntegrity.copy(in,DISCARD);}
                        if(!verified.toString().equals(localHash.toString()))throw new java.io.IOException("Neúplná cloudová příloha");
                    }catch(Exception failure){try{DocumentsContract.deleteDocument(resolver,target);}catch(Exception ignored){}throw failure;}
                }
            }else{
                if(entry==null)throw new java.io.IOException("Chybí příloha synchronizace: "+id);
                File temporary=new File(mediaDir,id+".sync-"+UUID.randomUUID()+".tmp");
                try{
                    try(InputStream in=resolver.openInputStream(entry.uri);FileOutputStream out=new FileOutputStream(temporary)){if(in==null)throw new java.io.IOException("Chybí příloha "+id);copy(in,out);out.getFD().sync();}
                    if(temporary.length()==0)throw new java.io.IOException("Prázdná příloha synchronizace");
                    synchronized(TrashPurger.LOCK){
                        // A concurrent trash purge must not bring back an orphaned media file.
                        JSONObject latest=parse(loadLocal());Set<String> purged=TrashPurger.purgedIds(latest);boolean allowed=false;
                        JSONArray records=data.optJSONArray("records");if(records!=null)for(int i=0;i<records.length();i++){JSONObject rec=records.optJSONObject(i);if(rec!=null&&!purged.contains(rec.optString("id"))){Set<String> used=new HashSet<>();references(rec,used);if(used.contains(id)){allowed=true;break;}}}
                        if(allowed&&!file.exists()){ProtectedRevisions.requireUnpinned(file);java.nio.file.Files.move(temporary.toPath(),file.toPath());}
                    }
                }finally{temporary.delete();}
                prefs.edit().putString("mime-"+id,entry.mime).apply();
            }
        }
    }
    protected JSONObject fetchRemote()throws Exception{
        if(tree==null)throw new Exception("Nejdřív vyber složku na Google Disku");
        Entry db=children(DocumentsContract.getTreeDocumentId(tree)).get("projects.json");return db==null?parse(""):parse(readDoc(db.uri));
    }
    protected void publishRemote(JSONObject data)throws Exception{
        String rootId=DocumentsContract.getTreeDocumentId(tree);Uri root=DocumentsContract.buildDocumentUriUsingTree(tree,rootId);
        Entry db=children(rootId).get("projects.json");
        if(db==null){Uri uri=DocumentsContract.createDocument(resolver,root,"application/json","projects.json");if(uri==null)throw new Exception("Nelze založit cloudovou databázi");db=new Entry(uri,"application/json");}
        writeDoc(db.uri,data.toString());
        // A successful close is insufficient with asynchronous document providers.
        if(!parse(readDoc(db.uri)).toString().equals(data.toString()))throw new java.io.IOException("Cloudový zápis nebyl úplně potvrzen");
    }
    private static final OutputStream DISCARD=new OutputStream(){@Override public void write(int value){} @Override public void write(byte[] bytes,int offset,int length){}};
    private static final java.util.concurrent.locks.ReentrantLock SESSION=new java.util.concurrent.locks.ReentrantLock();
    public Result sync() throws Exception{
        if(!SESSION.tryLock())throw new java.io.IOException("Jiná synchronizace již probíhá");
        try{
            // Establish a durable empty baseline BEFORE downloading the first photo.
            // If a new installation loses connectivity after a media transfer,
            // strict CAS must see this confirmed DB instead of orphaned media.
            // Never bootstrap a lost/corrupt initialized DB: loadLocal throws.
            String snapshot;
            synchronized(TrashPurger.LOCK){
                snapshot=loadLocal();
                if(snapshot.isEmpty()){
                    saveLocal("{\"schema\":1,\"records\":[]}");
                    snapshot=loadLocal();
                }
            }
            JSONObject local=parse(snapshot),remote=fetchRemote();
            JSONObject merged=merge(local,remote);String publishedBase=nextBaseline;
            transferMedia(merged);publishRemote(merged);
            boolean pending;
            synchronized(TrashPurger.LOCK){
                String latest=loadLocal();pending=!latest.equals(snapshot);
                if(pending)merged=merge(parse(latest),merged);
                saveLocal(merged.toString());
                prefs.edit().putString("syncBase",publishedBase).putBoolean("syncPending",pending).commit();
            }
            return new Result(pending?"Přenos dokončen; novější místní změny čekají na další synchronizaci":"Synchronizováno · "+merged.optJSONArray("records").length()+" položek",merged);
        }catch(Exception failure){prefs.edit().putBoolean("syncPending",true).commit();throw failure;}
        finally{SESSION.unlock();}
    }
}
