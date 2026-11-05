package cz.zamerovac.app;
import java.io.IOException;
/** Live sync namespace cannot address a historical backup. */
interface SyncStore extends ImmutableStore {
    String namespace();
    static String[] parts(String path)throws IOException{if(path==null||!path.matches("sync/v2(?:/[a-zA-Z0-9_.-]+)*")||path.contains("..")||path.length()>400)throw new IOException("Neplatná cesta synchronizace");return path.split("/");}
}
