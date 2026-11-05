package cz.zamerovac.app;

import javax.net.ssl.HttpsURLConnection;
import java.io.*;
import java.net.*;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/** Restricted Drive HTTPS boundary. Tokens never enter project data, storage, URLs or error text. */
final class DriveHttp {
    interface Credentials {String token()throws IOException;void rejected(String token);}
    interface Gate {void check(long accountedBytes)throws IOException;}
    interface Connections {HttpsURLConnection open(URL url)throws IOException;}
    static final class Failure extends IOException {
        final int status;final boolean retryable;
        Failure(int status){super(status==401?"Přístup k Disku vypršel; připoj účet znovu.":status==403?"Disk odmítl přístup nebo je vyčerpaná kvóta.":status==429?"Disk dočasně omezuje požadavky; přenos zůstává ve frontě.":"Google Disk vrátil chybu HTTP "+status);this.status=status;retryable=status==429||status>=500;}
    }
    static final class Response implements AutoCloseable {
        final int status;final InputStream body;private final HttpsURLConnection connection;
        Response(int status,InputStream body,HttpsURLConnection connection){this.status=status;this.body=body;this.connection=connection;}
        String header(String name){return connection.getHeaderField(name);}
        void success(int... allowed)throws IOException{for(int code:allowed)if(code==status)return;throw new Failure(status);}
        @Override public void close()throws IOException{try{body.close();}finally{connection.disconnect();}}
    }
    private final Credentials credentials;private final Gate gate;private final Connections connections;
    private final AtomicLong accounted=new AtomicLong();
    DriveHttp(Credentials credentials,Gate gate){this(credentials,gate,url->(HttpsURLConnection)url.openConnection());}
    DriveHttp(Credentials credentials,Gate gate,Connections connections){this.credentials=credentials;this.gate=gate;this.connections=connections;}
    long accountedBytes(){return accounted.get();}
    private synchronized void reserve(long bytes)throws IOException{
        if(Thread.currentThread().isInterrupted())throw new InterruptedIOException("Přenos Disku byl přerušen");
        if(bytes<0||bytes>Long.MAX_VALUE-accounted.get())throw new IOException("Neplatný rozpočet Disku");long next=accounted.get()+bytes;gate.check(next);accounted.set(next);
    }
    static URL endpoint(String value)throws IOException{
        if(value==null||value.length()>12000||java.util.regex.Pattern.compile("[\\p{Cntrl}]").matcher(value).find())throw new IOException("Neplatná adresa Disku");
        URL url=new URL(value);String path=url.getPath();
        if(!"https".equals(url.getProtocol())||!"www.googleapis.com".equals(url.getHost())||url.getPort()!=-1&&url.getPort()!=443||url.getUserInfo()!=null||url.getRef()!=null||!(path.equals("/drive/v3/files")||path.matches("/drive/v3/files/[A-Za-z0-9_-]{1,200}")||path.equals("/upload/drive/v3/files")))throw new IOException("Disk vrátil nepovolenou adresu přenosu");return url;
    }
    Response request(String method,String address,Map<String,String> headers,byte[] payload,long responseLimit)throws IOException{
        URL url=endpoint(address);if(!Arrays.asList("GET","POST","PUT").contains(method)||payload!=null&&payload.length>262144||responseLimit<0||responseLimit>PeerSnapshot.MAX_MEDIA)throw new IOException("Neplatný požadavek Disku");
        for(Map.Entry<String,String> header:headers.entrySet())if(!header.getKey().matches("[A-Za-z-]{1,80}")||header.getValue()==null||header.getValue().length()>12000||java.util.regex.Pattern.compile("[\\p{Cntrl}]").matcher(header.getValue()).find())throw new IOException("Neplatná hlavička Disku");
        // Conservative allowance for HTTP headers. TLS/TCP and carrier billing are outside this counter.
        reserve(8192L+address.length());String token=credentials.token();if(token==null||!token.matches("[A-Za-z0-9._~+/=-]{1,8192}"))throw new IOException("Disk nemá platné přihlášení");
        HttpsURLConnection connection=connections.open(url);boolean returned=false;
        try{
            connection.setInstanceFollowRedirects(false);connection.setUseCaches(false);connection.setConnectTimeout(15000);connection.setReadTimeout(30000);connection.setRequestMethod(method);connection.setRequestProperty("Authorization","Bearer "+token);connection.setRequestProperty("Accept-Encoding","identity");
            for(Map.Entry<String,String> header:headers.entrySet()){if("Authorization".equalsIgnoreCase(header.getKey())||"Host".equalsIgnoreCase(header.getKey())||"Accept-Encoding".equalsIgnoreCase(header.getKey()))throw new IOException("Nepovolená hlavička Disku");connection.setRequestProperty(header.getKey(),header.getValue());}
            if(payload!=null){connection.setDoOutput(true);connection.setFixedLengthStreamingMode(payload.length);try(OutputStream out=connection.getOutputStream()){for(int at=0;at<payload.length;){int count=Math.min(65536,payload.length-at);reserve(count);out.write(payload,at,count);at+=count;}}}
            reserve(0);int status=connection.getResponseCode();if(status==401)credentials.rejected(token);long declared=connection.getContentLengthLong();if(status>=200&&status<300&&declared>responseLimit)throw new IOException("Odpověď Disku překračuje limit");
            InputStream source=status>=400?connection.getErrorStream():connection.getInputStream();if(source==null)source=new ByteArrayInputStream(new byte[0]);final InputStream input=source;final long maximum=declared<0?responseLimit:Math.min(responseLimit,declared);
            InputStream bounded=new InputStream(){long read;boolean closed,ended;
                @Override public int read()throws IOException{byte[] one=new byte[1];int count=read(one,0,1);return count<0?-1:one[0]&255;}
                @Override public int read(byte[] bytes,int offset,int length)throws IOException{if(offset<0||length<0||offset>bytes.length-length)throw new IndexOutOfBoundsException();if(closed)throw new IOException("Přenos Disku je uzavřený");if(length==0)return 0;if(ended)return -1;if(read>maximum)throw new IOException("Odpověď Disku překračuje limit");int count=(int)Math.min(Math.min(length,65536),(maximum-read)+1);reserve(count);int actual=input.read(bytes,offset,count);if(actual==0)throw new IOException("Disk nevrátil žádná data");if(actual<0)ended=true;if(actual>0){read+=actual;if(read>maximum)throw new IOException("Odpověď Disku překračuje limit");}return actual;}
                @Override public void close()throws IOException{if(closed)return;closed=true;try{input.close();}finally{connection.disconnect();}}
            };
            returned=true;return new Response(status,bounded,connection);
        }finally{if(!returned)connection.disconnect();}
    }
}
