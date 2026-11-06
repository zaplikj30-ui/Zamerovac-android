package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;

/** Bounded protocol frames. Media are streamed separately; never allocated from an untrusted length. */
final class PeerWire {
    static final int MAX_JSON=20*1024*1024,MAX_HELLO=4096;
    static void write(DataOutputStream out,JSONObject object,int limit)throws Exception{
        writeBytes(out,object.toString().getBytes(StandardCharsets.UTF_8),limit);
    }
    static JSONObject read(DataInputStream in,int limit)throws Exception{
        return JsonInput.object(readBytes(in,limit));
    }
    static void writeBytes(DataOutputStream out,byte[] bytes,int limit)throws IOException{if(bytes.length<2||bytes.length>limit)throw new IOException("Zpráva přenosu je příliš velká");out.writeInt(bytes.length);out.write(bytes);out.flush();}
    static byte[] readBytes(DataInputStream in,int limit)throws IOException{int size=in.readInt();if(size<2||size>limit)throw new IOException("Neplatná velikost zprávy přenosu");byte[] bytes=new byte[size];in.readFully(bytes);return bytes;}
    static String nonce(){byte[] bytes=new byte[32];new java.security.SecureRandom().nextBytes(bytes);return ArchiveIntegrity.hex(bytes);}
    static String hash(byte[] bytes){return ArchiveIntegrity.hex(ArchiveIntegrity.digest().digest(bytes));}
}
