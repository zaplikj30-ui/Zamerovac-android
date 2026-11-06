package cz.zamerovac.app;
import android.net.Uri;
import android.webkit.WebResourceResponse;
import java.io.*;
import java.util.*;

/** The JavascriptInterface belongs only to the bundled application document. */
final class WebContentPolicy {
    static final String HOST="appassets.androidplatform.net";
    static final String APP_CSP="default-src 'none'; script-src https://appassets.androidplatform.net/app/; style-src https://appassets.androidplatform.net/app/ 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; connect-src 'self'; font-src 'self' data:; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'";
    static final String MEDIA_CSP="default-src 'none'; script-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; frame-src 'none'; connect-src 'none'; sandbox";
    static boolean origin(Uri uri){return uri!=null&&"https".equalsIgnoreCase(uri.getScheme())&&HOST.equalsIgnoreCase(uri.getHost())&&uri.getUserInfo()==null&&(HOST.equalsIgnoreCase(uri.getEncodedAuthority())||(HOST+":443").equalsIgnoreCase(uri.getEncodedAuthority()));}
    static boolean document(Uri uri){return origin(uri)&&"/app/index.html".equals(uri.getPath())&&uri.getQuery()==null;}
    static boolean external(Uri uri){return uri!=null&&("https".equalsIgnoreCase(uri.getScheme())||"http".equalsIgnoreCase(uri.getScheme()))&&uri.getHost()!=null&&!uri.getHost().isEmpty()&&uri.getUserInfo()==null;}
    static Map<String,String> headers(boolean media){Map<String,String> headers=new HashMap<>();headers.put("Content-Security-Policy",media?MEDIA_CSP:APP_CSP);headers.put("X-Content-Type-Options","nosniff");headers.put("Referrer-Policy","no-referrer");headers.put("Cache-Control","no-store");return headers;}
    static String mime(String mime){return PeerSnapshot.validMime(mime)&&(mime.startsWith("image/")||mime.startsWith("audio/")||mime.startsWith("video/"))?mime:"application/octet-stream";}
    static WebResourceResponse blocked(int code){return new WebResourceResponse("text/plain","UTF-8",code,code==404?"Not Found":"Forbidden",headers(true),new ByteArrayInputStream(new byte[0]));}
}
