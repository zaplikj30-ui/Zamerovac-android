package cz.zamerovac.app;
import java.io.*;
import java.util.*;

/** An immutable repair copy keeps historical hashes and original physical files unchanged. */
final class BackupBlobs {
    static final String DIRECTORY="backups/v2/blobs";
    interface Verifier {void verify(String path,String hash,long size)throws Exception;}
    private final BackupStore store;private final Verifier verifier;
    BackupBlobs(BackupStore store,Verifier verifier){this.store=store;this.verifier=verifier;}
    static String canonical(String hash)throws IOException{if(hash==null||!hash.matches("[a-f0-9]{64}"))throw new IOException("Neplatný kontrolní součet zálohy");return DIRECTORY+"/"+hash;}
    private boolean valid(String path,String hash,long size)throws Exception{try{verifier.verify(path,hash,size);return true;}catch(FileNotFoundException|ImmutableStore.CorruptBlob unavailable){return false;}}
    String find(String hash,long size)throws Exception{
        String canonical=canonical(hash);if(valid(canonical,hash,size))return canonical;List<ImmutableStore.Entry> candidates=new ArrayList<>();for(ImmutableStore.Entry entry:store.list(DIRECTORY))if(!entry.directory&&entry.name.matches(hash+"-[a-f0-9-]{36}")&&(entry.size<0||entry.size==size))candidates.add(entry);
        candidates.sort(Comparator.comparing(entry->entry.name));int checked=0;for(ImmutableStore.Entry entry:candidates){if(++checked>16)throw new IOException("Příliš mnoho neověřených kopií bloku zálohy");String path=DIRECTORY+"/"+entry.name;if(valid(path,hash,size))return path;}return null;
    }
    String read(String hash,long size)throws Exception{String path=find(hash,size);if(path==null)throw new FileNotFoundException("Příloha zálohy je poškozená nebo chybí. Obnova nebyla provedena.");return path;}
    String destination(String hash)throws Exception{String path=canonical(hash);for(ImmutableStore.Entry entry:store.list(DIRECTORY))if(hash.equals(entry.name))return path+"-"+UUID.randomUUID();return path;}
}
