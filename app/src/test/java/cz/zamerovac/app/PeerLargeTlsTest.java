package cz.zamerovac.app;

import org.json.*;
import org.junit.*;
import org.junit.runner.RunWith;
import org.robolectric.*;
import org.robolectric.annotation.Config;
import javax.net.ssl.SSLSocket;
import java.io.*;
import java.nio.file.*;
import java.util.concurrent.atomic.AtomicLong;
import static org.junit.Assert.*;
import static org.mockito.Mockito.*;

/** Actual loopback TLS and production protocol; only the receiver read fault is synthetic. */
@RunWith(RobolectricTestRunner.class) @Config(sdk=35)
public class PeerLargeTlsTest {
    private SSLSocket receiving(SSLSocket real,long failAfter,AtomicLong received)throws Exception{
        SSLSocket transport=mock(SSLSocket.class);when(transport.getSession()).thenReturn(real.getSession());when(transport.getOutputStream()).thenReturn(real.getOutputStream());
        when(transport.getInputStream()).thenReturn(new FilterInputStream(real.getInputStream()){
            @Override public int read(byte[] bytes,int offset,int count)throws IOException{
                if(count==0)return 0;if(received.get()>=failAfter)throw new IOException("synthetic halfway TLS disconnection");
                int n=in.read(bytes,offset,(int)Math.min(count,failAfter-received.get()));if(n>0)received.addAndGet(n);return n;
            }
            @Override public int read()throws IOException{byte[] one=new byte[1];int n=read(one,0,1);return n<0?-1:one[0]&255;}
        });doAnswer(call->{real.close();return null;}).when(transport).close();return transport;
    }
    private void exchange(PeerTransferTest fixture,long failAfter,AtomicLong received)throws Exception{
        fixture.tls.sockets(fixture.tls.b.context(fixture.br,()->false),fixture.tls.a.context(fixture.ar,()->false),real->{
            PeerHandshake.Peer peer=PeerHandshake.negotiate(real,fixture.bid,"Synthetic tablet",fixture.tls.b,fixture.br,()->false,request->false);
            new PeerTransfer(fixture.bs,null).exchange(receiving(real,failAfter,received),peer,false);
        },real->{PeerHandshake.Peer peer=PeerHandshake.negotiate(real,fixture.aid,"Synthetic phone",fixture.tls.a,fixture.ar,()->false,request->false);new PeerTransfer(fixture.as,null).exchange(real,peer,true);});
    }
    @Test public void threeGiBActualTlsDropsHalfwayAndRetryPreservesExactGeometryAndOriginals()throws Exception{
        PeerTransferTest f=new PeerTransferTest();f.setup();long size=3L*1024*1024*1024;
        LocalDatabase.write(f.a.home,"{\"schema\":1,\"records\":[]}");LocalDatabase.write(f.b.home,"{\"schema\":1,\"records\":[]}");File sourceDir=new File(f.a.home,"media");sourceDir.mkdir();File source=new File(sourceDir,"large-video");
        try(RandomAccessFile file=new RandomAccessFile(source,"rw")){file.setLength(size);file.seek(size-5);file.write(new byte[]{1,5,8,5,80});}
        JSONObject record=f.record("video-project",f.aid,"1585,800001234567890").put("media",new JSONArray().put("large-video"));f.save(f.a,f.db(record));f.a.prefs.edit().putString("mime-large-video","video/mp4").commit();
        JSONObject neighbour=f.record("healthy-neighbour",f.bid,"0,000000000123456789");f.media(f.b,neighbour,1);f.save(f.b,f.db(neighbour));String before=LocalDatabase.readForCas(f.b);byte[] healthy=Files.readAllBytes(new File(f.b.home,"media/media-0").toPath());String hash=PeerMedia.inspect(source).getString("hash");AtomicLong partial=new AtomicLong();
        try{exchange(f,size/2,partial);fail("Interrupted TLS stream committed");}catch(Exception expected){assertTrue(PeerTlsTest.contains(expected,"synthetic halfway TLS disconnection"));}
        assertEquals(size/2,partial.get());assertEquals(before,LocalDatabase.readForCas(f.b));assertFalse(new File(f.b.home,"media/large-video").exists());assertArrayEquals(healthy,Files.readAllBytes(new File(f.b.home,"media/media-0").toPath()));assertTrue(f.as.outbox.pending(f.bid)>0);
        f.as=f.store(f.a,new SyncPeerRegistry(f.a.noBackup));f.bs=f.store(f.b,new SyncPeerRegistry(f.b.noBackup));AtomicLong retry=new AtomicLong();exchange(f,Long.MAX_VALUE,retry);
        JSONObject copied=PeerMedia.inspect(new File(f.b.home,"media/large-video"));assertEquals(size,copied.getLong("size"));assertEquals(hash,copied.getString("hash"));assertTrue("The unfinished file restarted from byte zero over TLS",retry.get()>=size);assertTrue(size>Runtime.getRuntime().maxMemory());assertArrayEquals(healthy,Files.readAllBytes(new File(f.b.home,"media/media-0").toPath()));
        JSONArray records=new JSONObject(LocalDatabase.readForCas(f.b)).getJSONArray("records");boolean exact=false;for(int i=0;i<records.length();i++)if("video-project".equals(records.getJSONObject(i).getString("id"))){exact=true;JSONObject dimension=records.getJSONObject(i).getJSONArray("items").getJSONObject(0);assertEquals("1585,800001234567890",dimension.getString("measure"));assertEquals("mm",dimension.getString("unit"));assertEquals(12.125,dimension.getJSONArray("points").getJSONObject(0).getDouble("x"),0);assertEquals(23.875,dimension.getJSONArray("points").getJSONObject(0).getDouble("y"),0);}assertTrue("Original project and editable geometry arrived",exact);assertEquals(2,records.length());
        System.out.println("ACTUAL_TLS_3GIB_RETRY_FROM_ZERO SHA256="+hash+" RECEIVED="+retry.get()+" HEAP_LIMIT="+Runtime.getRuntime().maxMemory());
    }
}
