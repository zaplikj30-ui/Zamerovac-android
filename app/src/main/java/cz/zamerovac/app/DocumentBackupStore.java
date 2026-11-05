package cz.zamerovac.app;
import android.content.*;
import android.database.Cursor;
import android.net.Uri;
import android.provider.DocumentsContract;
import android.provider.DocumentsContract.Document;
import java.io.*;
import java.util.*;

/** User-selected SAF provider. All paths are beneath its dedicated Zamerovac-zalohy namespace. */
final class DocumentBackupStore implements BackupStore {
    private final ContentResolver resolver;private final Uri tree;
    DocumentBackupStore(Context context,String uri)throws IOException{if(uri==null||uri.isEmpty())throw new IOException("Nejdříve vyber složku historických záloh.");tree=Uri.parse(uri);if(!"content".equals(tree.getScheme())||!DocumentsContract.isTreeUri(tree))throw new IOException("Neplatná složka záloh");resolver=context.getContentResolver();}
    private static final class Child {final Uri uri;final String name;final boolean directory;final long size;Child(Uri uri,String name,boolean directory,long size){this.uri=uri;this.name=name;this.directory=directory;this.size=size;}}
    private List<Child> children(Uri parent)throws Exception{
        ArrayList<Child> result=new ArrayList<>();Uri query=DocumentsContract.buildChildDocumentsUriUsingTree(tree,DocumentsContract.getDocumentId(parent));
        try(Cursor cursor=resolver.query(query,new String[]{Document.COLUMN_DOCUMENT_ID,Document.COLUMN_DISPLAY_NAME,Document.COLUMN_MIME_TYPE,Document.COLUMN_SIZE},null,null,null)){
            if(cursor==null)throw new IOException("Poskytovatel nevrátil seznam záloh. Nelze jej považovat za prázdný.");while(cursor.moveToNext()){if(result.size()>=100000)throw new IOException("Seznam záloh je příliš velký");String name=cursor.getString(1);if(name==null)throw new IOException("Poskytovatel obsahuje nejednoznačné názvy; původní zálohy se nemění.");result.add(new Child(DocumentsContract.buildDocumentUriUsingTree(tree,cursor.getString(0)),name,Document.MIME_TYPE_DIR.equals(cursor.getString(2)),cursor.isNull(3)?-1:cursor.getLong(3)));}
        }return result;
    }
    private Child child(Uri parent,String name)throws Exception{Child found=null;for(Child child:children(parent))if(name.equals(child.name)){if(found!=null)throw new IOException("Poskytovatel obsahuje nejednoznačné názvy vybraného souboru");found=child;}return found;}
    private Uri directory(String path,boolean create)throws Exception{
        String[] parts=BackupStore.parts(path);Uri current=DocumentsContract.buildDocumentUriUsingTree(tree,DocumentsContract.getTreeDocumentId(tree));String[] names=new String[parts.length+1];names[0]="Zamerovac-zalohy";System.arraycopy(parts,0,names,1,parts.length);
        for(String name:names){Child found=child(current,name);if(found!=null){if(!found.directory)throw new IOException("Místo složky záloh je soubor");current=found.uri;}else{if(!create)return null;Uri made=DocumentsContract.createDocument(resolver,current,Document.MIME_TYPE_DIR,name);if(made==null)throw new IOException("Poskytovatel nepovolil vytvoření složky. Zkontroluj oprávnění nebo dostupné místo.");Child verified=child(current,name);if(verified==null||!verified.directory||!verified.uri.equals(made))throw new IOException("Složka záloh nebyla jednoznačně potvrzena");current=made;}}
        return current;
    }
    @Override public InputStream open(String path)throws Exception{BackupStore.parts(path);int slash=path.lastIndexOf('/');Uri parent=directory(path.substring(0,slash),false);Child child=parent==null?null:child(parent,path.substring(slash+1));if(child==null)throw new FileNotFoundException("Blok zálohy chybí");if(child.directory)throw new IOException("Blok zálohy je adresář");InputStream in=resolver.openInputStream(child.uri);if(in==null)throw new IOException("Zálohu nelze číst");return in;}
    @Override public OutputStream create(String path)throws Exception{
        BackupStore.parts(path);int slash=path.lastIndexOf('/');Uri parent=directory(path.substring(0,slash),true);String name=path.substring(slash+1);if(child(parent,name)!=null)throw new IOException("Historický soubor již existuje a nesmí se přepsat");
        Uri made=DocumentsContract.createDocument(resolver,parent,"application/octet-stream",name);if(made==null)throw new IOException("Nelze vytvořit blok zálohy. Zkontroluj oprávnění a volné místo.");Child verified=child(parent,name);if(verified==null||verified.directory||!made.equals(verified.uri))throw new IOException("Nový blok zálohy není jednoznačný");OutputStream out=resolver.openOutputStream(made,"w");if(out==null)throw new IOException("Poskytovatel nepovolil zápis zálohy");return out;
    }
    @Override public List<Entry> list(String path)throws Exception{Uri parent=directory(path,false);List<Entry> entries=new ArrayList<>();if(parent!=null)for(Child child:children(parent))entries.add(new Entry(child.name,child.directory,child.size));return entries;}
}
