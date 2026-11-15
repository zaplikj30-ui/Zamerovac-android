package cz.zamerovac.app;
import org.json.*;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.charset.*;

/** Bound untrusted input before org.json recursively allocates its object graph. */
final class JsonInput {
    static String decode(byte[] bytes)throws IOException {
        return decode(bytes,20*1024*1024);
    }
    static String decode(byte[] bytes,int maximum)throws IOException {
        if(bytes.length>maximum)throw new IOException("JSON překračuje limit velikosti");
        try{return StandardCharsets.UTF_8.newDecoder().onMalformedInput(CodingErrorAction.REPORT).onUnmappableCharacter(CodingErrorAction.REPORT).decode(ByteBuffer.wrap(bytes)).toString();}
        catch(CharacterCodingException invalid){throw new IOException("Neplatné kódování JSON",invalid);}
    }
    static void check(String text)throws IOException {
        check(text,20*1024*1024);
    }
    static void check(String text,int maximum)throws IOException {
        if(text==null||text.length()>maximum)throw new IOException("JSON překračuje limit velikosti");
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
    static void unicode(Object value)throws IOException,JSONException{unicode(value,0);}
    private static void unicode(Object value,int depth)throws IOException,JSONException{
        if(depth>100)throw new IOException("JSON je příliš zanořený");
        if(value instanceof String){String text=(String)value;for(int i=0;i<text.length();i++){char c=text.charAt(i);if(Character.isHighSurrogate(c)){if(i+1>=text.length()||!Character.isLowSurrogate(text.charAt(++i)))throw new IOException("Neplatný znak Unicode v JSON");}else if(Character.isLowSurrogate(c))throw new IOException("Neplatný znak Unicode v JSON");}}
        else if(value instanceof JSONObject){JSONObject object=(JSONObject)value;for(java.util.Iterator<String> it=object.keys();it.hasNext();){String key=it.next();unicode(key,depth+1);unicode(object.get(key),depth+1);}}
        else if(value instanceof JSONArray){JSONArray array=(JSONArray)value;for(int i=0;i<array.length();i++)unicode(array.get(i),depth+1);}
    }
    static JSONObject object(byte[] bytes)throws IOException,JSONException {String text=decode(bytes);check(text);JSONObject data=new JSONObject(text);unicode(data);return data;}
}
