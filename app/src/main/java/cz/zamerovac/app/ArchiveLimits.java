package cz.zamerovac.app;
import java.io.*;

/** One contract for ZIP export and import, including all three metadata entries. */
final class ArchiveLimits {
    static final int MAX_ENTRIES=20000,MAX_JSON=LocalDatabase.MAX_BYTES;
    static final long MAX_BYTES=PeerSnapshot.MAX_MEDIA;
    static void entries(int count)throws IOException{if(count>MAX_ENTRIES)throw new IOException("Příliš mnoho souborů v záloze (limit 20 000 včetně metadat)");}
    static void json(long size)throws IOException{if(size>MAX_JSON)throw new IOException("Metadata v ZIP jsou příliš velká");}
    static long add(long total,long size)throws IOException{if(size<0||total<0||size>MAX_BYTES-total)throw new IOException("Záloha překračuje bezpečný číselný rozsah formátu");return total+size;}
    static final class Budget {
        private long total;
        OutputStream output(OutputStream destination,boolean json){return new OutputStream(){
            private long size;
            @Override public void write(int value)throws IOException{write(new byte[]{(byte)value},0,1);}
            @Override public void write(byte[] bytes,int offset,int count)throws IOException{
                total=add(total,count);size+=count;if(json)json(size);destination.write(bytes,offset,count);
            }
        };}
    }
}
