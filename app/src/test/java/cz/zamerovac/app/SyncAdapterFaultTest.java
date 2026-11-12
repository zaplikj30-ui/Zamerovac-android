package cz.zamerovac.app;
import org.junit.*;
import java.io.*;
import java.util.*;
import static org.junit.Assert.*;

/** Real streaming verification against adversarial provider behavior, with no network or credentials. */
@org.junit.runner.RunWith(org.robolectric.RobolectricTestRunner.class) @org.robolectric.annotation.Config(sdk=35)
public class SyncAdapterFaultTest {
    static final byte[] ORIGINAL={7,9,11,13,15};
    static class Store implements SyncStore {
        final Map<String,byte[]> objects=new LinkedHashMap<>();String fault="";int creates;
        public String namespace(){return "fake-private-space";}
        public InputStream open(String path)throws IOException{byte[] bytes=objects.get(path);if(bytes==null)throw new FileNotFoundException();return new ByteArrayInputStream(bytes);}
        public List<Entry> list(String directory){List<Entry> entries=new ArrayList<>();if(!fault.equals("stale-list"))for(Map.Entry<String,byte[]> e:objects.entrySet())if(e.getKey().startsWith(directory+"/"))entries.add(new Entry(e.getKey().substring(directory.length()+1),false,e.getValue().length));return entries;}
        public OutputStream create(String path)throws IOException{
            if(objects.containsKey(path))throw new IOException("Immutable object already exists");creates++;
            return new ByteArrayOutputStream(){boolean closed;public void write(byte[] b,int o,int n){super.write(b,o,n);}
                @Override public void close()throws IOException{if(closed)return;closed=true;if(fault.equals("quota"))throw new IOException("synthetic quota");if(fault.equals("success-without-bytes"))return;byte[] bytes=toByteArray();if(fault.equals("truncated"))bytes=Arrays.copyOf(bytes,2);objects.put(path,bytes);if(fault.equals("lost-ack"))throw new IOException("synthetic lost ACK after commit");}
            };
        }
    }
    @Test public void successfulOrTruncatedWriteCannotBecomeVerifiedReceipt()throws Exception{
        String hash=PeerWire.hash(ORIGINAL);
        for(String fault:new String[]{"success-without-bytes","truncated","quota"}){
            Store store=new Store();store.fault=fault;store.objects.put("sync/v2/blobs/"+"a".repeat(64),new byte[]{42});
            try{CloudFiles.put(store,hash,ORIGINAL.length,()->new ByteArrayInputStream(ORIGINAL));fail("Provider fault became verified success: "+fault);}catch(IOException expected){}
            assertArrayEquals(new byte[]{42},store.objects.get("sync/v2/blobs/"+"a".repeat(64)));assertArrayEquals(new byte[]{7,9,11,13,15},ORIGINAL);
        }
    }
    @Test public void lostAcknowledgementRetriesWithoutLosingOrDuplicatingLogicalContent()throws Exception{
        Store store=new Store();store.fault="lost-ack";String hash=PeerWire.hash(ORIGINAL);
        try{CloudFiles.put(store,hash,ORIGINAL.length,()->new ByteArrayInputStream(ORIGINAL));fail();}catch(IOException expected){}
        store.fault="";String path=CloudFiles.put(store,hash,ORIGINAL.length,()->new ByteArrayInputStream(ORIGINAL));CloudFiles.verify(store,path,hash,ORIGINAL.length);assertEquals(1,store.creates);
    }
    @Test public void staleListingAndDuplicatePhysicalObjectsNeverAuthorizeDeletionOrFalseSuccess()throws Exception{
        Store store=new Store();String hash=PeerWire.hash(ORIGINAL),base=CloudFiles.blob(hash);store.objects.put(base+"-11111111-1111-4111-8111-111111111111",new byte[]{0});store.objects.put(base+"-22222222-2222-4222-8222-222222222222",ORIGINAL);
        String found=CloudFiles.find(store,hash,ORIGINAL.length);assertTrue(found.endsWith("22222222-2222-4222-8222-222222222222"));
        store.fault="stale-list";String duplicate=CloudFiles.put(store,hash,ORIGINAL.length,()->new ByteArrayInputStream(ORIGINAL));CloudFiles.verify(store,duplicate,hash,ORIGINAL.length);assertEquals(3,store.objects.size());assertArrayEquals(new byte[]{0},store.objects.get(base+"-11111111-1111-4111-8111-111111111111"));
    }
    @Test public void networkBudgetTreatsMeteredHotspotAndUnknownNetworkConservatively()throws Exception{
        SyncNetworkPolicy policy=new SyncNetworkPolicy(false,SyncNetworkPolicy.LEGACY_METERED_ATTEMPT_BYTES);
        assertFalse(policy.allows(false,false,true,1));assertFalse(policy.allows(true,false,false,3L*1024*1024*1024));assertTrue(policy.allows(true,true,false,3L*1024*1024*1024));assertTrue(policy.allows(true,false,true,3L*1024*1024*1024));assertTrue(policy.allows(true,false,false,1));
        try{SyncNetworkPolicy.add(Long.MAX_VALUE,1);fail("Overflow allowed a transfer");}catch(IOException expected){}
    }
}
