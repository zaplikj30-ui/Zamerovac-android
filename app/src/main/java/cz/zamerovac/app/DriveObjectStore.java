package cz.zamerovac.app;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.*;

/** Flat Drive objects exposed as virtual directories. It never replaces or deletes a remote object. */
final class DriveObjectStore {
    private static final Set<File> ACTIVE=new HashSet<>();
    final DriveApi api;final File staging;final String namespace;
    DriveObjectStore(DriveApi api,File cache,String accountScope)throws IOException{
        if(accountScope==null||accountScope.isEmpty()||accountScope.length()>1000)throw new IOException("Neplatný účet Disku");this.api=api;namespace="drive-appdata-v2:"+PeerWire.hash(accountScope.getBytes(StandardCharsets.UTF_8));staging=new File(cache,"drive-staging-v2");
        synchronized(ACTIVE){if(!staging.isDirectory()&&!staging.mkdirs())throw new IOException("Není místo pro přípravu Disku");File[] files=staging.listFiles();if(files==null)throw new IOException("Přípravu Disku nelze načíst");for(File file:files)if(file.getName().matches("upload-[a-f0-9-]{36}\\.tmp")&&!ACTIVE.contains(file)&&file.isFile()&&!Files.isSymbolicLink(file.toPath()))file.delete();}
    }
    private DriveObjectStore(DriveApi api,File staging,String namespace,boolean copy){this.api=api;this.staging=staging;this.namespace=namespace;}
    DriveObjectStore checked(ImmutableStore.Checkpoint checkpoint){return new DriveObjectStore(new DriveApi(api.http.checked(checkpoint)),staging,namespace,true);}
    List<ImmutableStore.Entry> list(String path)throws Exception{
        List<DriveApi.ObjectFile> files=api.list(path);Map<String,ImmutableStore.Entry> entries=new TreeMap<>();String prefix=path+"/";
        for(DriveApi.ObjectFile file:files){String tail=file.path.substring(prefix.length());int slash=tail.indexOf('/');String name=slash<0?tail:tail.substring(0,slash);boolean directory=slash>=0;ImmutableStore.Entry previous=entries.get(name);if(previous!=null&&previous.directory!=directory)throw new IOException("Disk obsahuje nejednoznačný soubor a složku");entries.put(name,new ImmutableStore.Entry(name,directory,directory?0:previous==null?file.size:-1));}return new ArrayList<>(entries.values());
    }
    InputStream open(String path)throws Exception{
        List<DriveApi.ObjectFile> files=api.exact(path);if(files.isEmpty())throw new FileNotFoundException("Blok na Disku chybí");if(files.size()==1)return api.open(files.get(0));
        // Drive permits identical names after a race. Resolve only content-addressed blobs by their real bytes.
        String name=path.substring(path.lastIndexOf('/')+1);if(files.size()>16||!path.contains("/blobs/")||!name.matches("[a-f0-9]{64}(?:-[a-f0-9-]{36})?"))throw new IOException("Disk obsahuje nejednoznačné neměnné zprávy");String expected=name.substring(0,64);files.sort(Comparator.comparing(file->file.id));
        for(DriveApi.ObjectFile file:files){boolean matches;try(InputStream input=api.open(file)){org.json.JSONObject verified=CloudFiles.copy(input,new OutputStream(){public void write(int value){}public void write(byte[] bytes,int offset,int length){}},file.size);matches=file.size==verified.getLong("size")&&expected.equals(verified.getString("sha256"));}if(matches)return api.open(file);}
        throw new IOException("Disk nemá úplnou ověřenou kopii duplicitního bloku");
    }
    OutputStream create(String path)throws Exception{
        if(!api.exact(path).isEmpty())throw new IOException("Neměnný soubor Disku již existuje");File file;
        synchronized(ACTIVE){file=new File(staging,"upload-"+UUID.randomUUID()+".tmp");if(!file.createNewFile())throw new IOException("Nelze připravit soubor Disku");ACTIVE.add(file);}
        try{return new Staged(path,file);}catch(IOException failure){synchronized(ACTIVE){ACTIVE.remove(file);file.delete();}throw failure;}
    }
    private final class Staged extends OutputStream implements ImmutableStore.PendingOutput {
        final String path;final File file;final FileOutputStream output;long size;boolean sealed,published,closed;
        Staged(String path,File file)throws IOException{this.path=path;this.file=file;output=new FileOutputStream(file);}
        @Override public void write(int value)throws IOException{write(new byte[]{(byte)value},0,1);}
        @Override public void write(byte[] bytes,int offset,int length)throws IOException{if(closed||sealed)throw new IOException("Příprava Disku je uzavřená");if(offset<0||length<0||offset>bytes.length-length)throw new IndexOutOfBoundsException();if(length>PeerSnapshot.MAX_MEDIA-size)throw new IOException("Soubor Disku je příliš velký");output.write(bytes,offset,length);size+=length;}
        @Override public void flush()throws IOException{if(closed||sealed)throw new IOException("Příprava Disku je uzavřená");output.flush();}
        @Override public void publish()throws IOException{
            if(published)return;if(closed||sealed)throw new IOException("Příprava Disku již skončila");sealed=true;
            try{output.getFD().sync();output.close();try(InputStream input=new FileInputStream(file)){api.upload(path,input,size);}published=true;}catch(IOException failure){throw failure;}catch(Exception failure){throw new IOException("Disk nepotvrdil publikaci",failure);}
        }
        @Override public void close()throws IOException{if(closed)return;closed=true;try{output.close();}finally{synchronized(ACTIVE){ACTIVE.remove(file);file.delete();}}}
    }
}
