package cz.zamerovac.app;
import org.json.*;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;

/** Bound untrusted input before org.json recursively allocates its object graph. */
final class JsonInput {
    static String decode(byte[] bytes)throws IOException {
        if(bytes.length>20*1024*1024)throw new IOException("JSON překračuje limit velikosti");
        try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}
        catch(CharacterCodingException invalid){throw new IOException("Neplatné kódování JSON",invalid);}
    }
    static void check(String text)throws IOException {
        if(text==null||text.length()>20*1024*1024)throw new IOException("JSON překračuje limit velikosti");
        boolean quoted=false,escaped=false;int depth=0;
        for(int i=0;i<text.length();i++){
            char c=text.charAt(i);
            if(quoted){if(c<32)throw new IOException("Neplatný znak JSON");if(escaped){escaped=false;continue;}if(c=='\\'){escaped=true;continue;}if(c=='\"')quoted=false;}
            else if(c=='\"')quoted=true;
            else if(c=='['||c=='{'){if(++depth>100)throw new IOException("JSON je příliš zanořený");}
            else if(c==']'||c=='}'){if(--depth<0)throw new IOException("Neplatný JSON");}
        }
        if(quoted||depth!=0)throw new IOException("Neúplný JSON");
    }
    static JSONObject object(byte[] bytes)throws IOException,JSONException {String text=decode(bytes);check(text);return new JSONObject(text);}
}
