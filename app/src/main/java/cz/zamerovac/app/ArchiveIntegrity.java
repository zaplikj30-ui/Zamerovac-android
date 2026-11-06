package cz.zamerovac.app;
import org.json.*;
import java.io.*;
import java.security.*;

/** Open archive format v2, SHA-256 and byte counts. Hashes detect corruption, not sender identity. */
final class ArchiveIntegrity {
    static MessageDigest digest(){try{return MessageDigest.getInstance("SHA-256");}catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
    static String hex(byte[] bytes){StringBuilder text=new StringBuilder();for(byte b:bytes)text.append(String.format(java.util.Locale.ROOT,"%02x",b&255));return text.toString();}
    static JSONObject entry(long size,byte[] hash)throws JSONException{return new JSONObject().put("size",size).put("sha256",hex(hash));}
    static JSONObject copy(InputStream in,OutputStream out)throws IOException,JSONException {
        MessageDigest hash=digest();long size=0;byte[] block=new byte[65536];int n;
        while((n=in.read(block))!=-1){out.write(block,0,n);hash.update(block,0,n);size+=n;}
        return entry(size,hash.digest());
    }
    static void verify(JSONObject manifest,JSONObject actual)throws IOException,JSONException {
        if(!"cz.zamerovac.archive".equals(manifest.optString("format"))||manifest.optInt("version")!=2)throw new IOException("Nepodporovaná kontrola zálohy");
        JSONObject expected=manifest.optJSONObject("entries");if(expected==null||expected.length()!=actual.length())throw new IOException("Záloha není úplná");
        for(java.util.Iterator<String> keys=actual.keys();keys.hasNext();){String name=keys.next();JSONObject a=actual.getJSONObject(name),e=expected.optJSONObject(name);
            if(e==null||e.optLong("size",-1)!=a.getLong("size")||!a.getString("sha256").equals(e.optString("sha256")))throw new IOException("Kontrola přílohy zálohy selhala: "+name);
        }
    }
}
