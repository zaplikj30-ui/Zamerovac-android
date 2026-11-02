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
        while((n=in.read(block))!=-1)b.write(block,0,n);
        return b.toString("UTF-8");
    }
    private String loadLocal() throws Exception {
        File f=new File(home,"projects.json");if(!f.isFile())return "";
        try(InputStream in=new FileInputStream(f)){return slurp(in);}
    }
    private void saveLocal(String text) throws Exception {
        File dest=new File(home,"projects.json"), tmp=new File(home,"projects.sync.tmp");
        try(FileOutputStream out=new FileOutputStream(tmp)){out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();}
        if(!tmp.renameTo(dest))throw new Exception("Nelze uložit lokální databázi");
    }
    private JSONObject parse(String text) throws Exception {
        if(text==null||text.isEmpty())return new JSONObject().put("schema",1).put("records",new JSONArray()).put("prefs",new JSONObject());
        JSONObject o=new JSONObject(text);if(o.optInt("schema")!=1)throw new Exception("Nepodporovaná verze souboru zakázek");
        return o;
    }
    private Map<String,String> baseline(){Map<String,String> m=new HashMap<>();try{
        JSONObject j=new JSONObject(prefs.getString("syncBase","{}"));for(java.util.Iterator<String> it=j.keys();it.hasNext();){String k=it.next();m.put(k,j.optString(k));}
        }catch(Exception ignored){}return m;}
    private String nextBaseline="{}";
    private JSONObject merge(JSONObject local, JSONObject remote) throws Exception {
        Map<String,JSONObject> l=new HashMap<>(), r=new HashMap<>();
        JSONArray a=local.optJSONArray("records"), b=remote.optJSONArray("records");
        if(a!=null)for(int i=0;i<a.length();i++){JSONObject rec=a.optJSONObject(i);if(rec!=null&&rec.has("id"))l.put(rec.getString("id"),rec);}
        if(b!=null)for(int i=0;i<b.length();i++){JSONObject rec=b.optJSONObject(i);if(rec!=null&&rec.has("id"))r.put(rec.getString("id"),rec);}
        Map<String,String> base=baseline();Set<String> all=new HashSet<>();all.addAll(l.keySet());all.addAll(r.keySet());
        JSONArray merged=new JSONArray();JSONObject nextBase=new JSONObject();
        // Deterministic order keeps generated JSON stable.
        ArrayList<String> sorted=new ArrayList<>(all);java.util.Collections.sort(sorted);
        for(String id: sorted){JSONObject lv=l.get(id),rv=r.get(id), chosen;
            if(lv==null)chosen=rv;
            else if(rv==null)chosen=lv;
            else {
                String lrev=lv.optString("rev",""),rrev=rv.optString("rev","");
                String known=base.get(id);
                if(lrev.equals(rrev))chosen=lv;
                else if(known!=null&&known.equals(lrev))chosen=rv;
                else if(known!=null&&known.equals(rrev))chosen=lv;
                else {
                    // Preserve independent edits; do not discard either side.
                    boolean localNewer=lv.optString("updatedAt","").compareTo(rv.optString("updatedAt",""))>=0;
                    chosen=localNewer?lv:rv;
                    JSONObject losing=new JSONObject((localNewer?rv:lv).toString());
                    losing.put("id",UUID.randomUUID().toString());losing.put("title",losing.optString("title","Položka")+" (konflikt synchronizace)");
                    losing.put("rev",UUID.randomUUID().toString());losing.put("conflict",true);
                    merged.put(losing);
                }
            }
            merged.put(chosen);nextBase.put(id,chosen.optString("rev",""));
        }
        JSONObject result=new JSONObject(local.toString());result.put("records",merged);
        // Preferences are device-local (screen size, tool order, colors). Never overwrite.
        nextBaseline=nextBase.toString();
        return result;
    }
    private Uri dir(String parentId,String name,boolean create) throws Exception{
        Uri parent=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parentId);
        try(Cursor c=resolver.query(parent,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE},null,null,null)){
            if(c!=null)while(c.moveToNext())if(name.equals(c.getString(1))&&Document.MIME_TYPE_DIR.equals(c.getString(2))){
                return DocumentsContract.buildDocumentUriUsingTree(tree,c.getString(0));}
        }
        if(!create)return null;
        return DocumentsContract.createDocument(resolver,DocumentsContract.buildDocumentUriUsingTree(tree,parentId),Document.MIME_TYPE_DIR,name);
    }
    private static class Entry {Uri uri;String mime;Entry(Uri u,String m){uri=u;mime=m;}}
    private Map<String,Entry> children(String parent) throws Exception{
        Map<String,Entry> result=new HashMap<>();Uri query=DocumentsContract.buildChildDocumentsUriUsingTree(tree,parent);
        try(Cursor c=resolver.query(query,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE},null,null,null)){
            if(c!=null)while(c.moveToNext())result.put(c.getString(1),new Entry(DocumentsContract.buildDocumentUriUsingTree(tree,c.getString(0)),c.getString(2)));
        }
        return result;
    }
    private String readDoc(Uri doc) throws Exception{try(InputStream in=resolver.openInputStream(doc)){if(in==null)throw new Exception("Nelze číst cloudový soubor");return slurp(in);}}
    private void writeDoc(Uri doc,String text) throws Exception{try(OutputStream out=resolver.openOutputStream(doc,"wt")){if(out==null)throw new Exception("Nelze zapisovat na disk");out.write(text.getBytes(StandardCharsets.UTF_8));out.flush();}}
    private String docId(Uri uri){return DocumentsContract.getDocumentId(uri);}
    private String contentType(String id){return prefs.getString("mime-"+id,"application/octet-stream");}
    private void copy(InputStream in,OutputStream out) throws Exception{byte[] buf=new byte[65536];int n;while((n=in.read(buf))!=-1)out.write(buf,0,n);}
    private void syncMedia(Uri mediaFolder) throws Exception {
        Map<String,Entry> remote=children(docId(mediaFolder));
        for(File f:mediaDir.listFiles()==null?new File[0]:mediaDir.listFiles()){
            if(!f.isFile()||!f.getName().matches("[a-zA-Z0-9_-]{3,120}"))continue;
            if(!remote.containsKey(f.getName())){
                Uri created=DocumentsContract.createDocument(resolver,mediaFolder,contentType(f.getName()),f.getName());
                if(created==null)throw new Exception("Nelze vytvořit cloudový soubor "+f.getName());
                try(InputStream in=new FileInputStream(f);OutputStream out=resolver.openOutputStream(created,"w")){if(out==null)throw new Exception("Cloudový zápis odmítnut");copy(in,out);}
            }
        }
        for(Map.Entry<String,Entry> it:remote.entrySet()){
            String id=it.getKey();if(!id.matches("[a-zA-Z0-9_-]{3,120}"))continue;
            File f=new File(mediaDir,id);
            if(!f.exists()){
                File tmp=new File(mediaDir,id+".tmp");
                try(InputStream in=resolver.openInputStream(it.getValue().uri);OutputStream out=new FileOutputStream(tmp)){if(in==null)throw new Exception("Chybí příloha "+id);copy(in,out);}
                if(!tmp.renameTo(f))throw new Exception("Nelze uložit přílohu "+id);
            }
            prefs.edit().putString("mime-"+id,it.getValue().mime).apply();
        }
    }
    public synchronized Result sync() throws Exception{
        if(tree==null)throw new Exception("Nejdřív vyber složku na Google Disku");
        String rootId=DocumentsContract.getTreeDocumentId(tree);
        Uri root=DocumentsContract.buildDocumentUriUsingTree(tree,rootId);
        // The selected folder itself is the app-specific cloud directory.
        Map<String,Entry> files=children(rootId);
        Entry db=files.get("projects.json");
        JSONObject local=parse(loadLocal());
        JSONObject remote=db==null?parse(""):parse(readDoc(db.uri));
        JSONObject merged=merge(local,remote);
        Uri mdir=dir(rootId,"media",true);if(mdir==null)throw new Exception("Nelze vytvořit složku media");
        syncMedia(mdir);
        if(db==null){Uri uri=DocumentsContract.createDocument(resolver,root,"application/json","projects.json");if(uri==null)throw new Exception("Nelze založit cloudovou databázi");db=new Entry(uri,"application/json");}
        writeDoc(db.uri,merged.toString());
        saveLocal(merged.toString());
        prefs.edit().putString("syncBase",nextBaseline).apply();
        return new Result("Synchronizováno · "+merged.optJSONArray("records").length()+" položek",merged);
    }
}
