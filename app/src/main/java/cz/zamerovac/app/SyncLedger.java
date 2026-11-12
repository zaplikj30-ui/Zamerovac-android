package cz.zamerovac.app;

import android.content.ContentValues;
import android.database.Cursor;
import android.database.sqlite.SQLiteDatabase;
import android.database.sqlite.SQLiteException;
import android.util.AtomicFile;
import org.json.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.util.*;

/** Local transport bookkeeping only. Never grants LocalDatabase authority or releases a P1 pin. */
final class SyncLedger implements AutoCloseable {
    interface Fault { void at(String point) throws IOException; }
    static final Fault NONE=point->{};
    static final String EMPTY_QUEUE="{\"version\":2,\"revision\":0,\"jobs\":[]}";
    private final SQLiteDatabase db;
    private final File home;
    private final Fault fault;
    private SyncLedger(File home, SQLiteDatabase db, Fault fault) { this.home=home;this.db=db;this.fault=fault; }
    static SyncLedger open(File home) throws Exception { return open(home,NONE); }
    static SyncLedger open(File home, Fault fault) throws Exception {
        if(!home.isDirectory()&&!home.mkdirs())throw new IOException("Nelze otevřít evidenci přenosů");
        File path=new File(home,"sync-ledger-v1.sqlite"),witness=new File(home,"sync-ledger-v1.install");
        for(File f:new File[]{home,path,witness,new File(witness+".bak"),new File(witness+".new"),new File(path+"-journal"),new File(path+"-wal"),new File(path+"-shm")})
            if(Files.isSymbolicLink(f.toPath()))throw new IOException("Nebezpečná cesta evidence přenosů");
        String state="";
        if(witness.exists()||new File(witness+".bak").exists()){
            // Read the recoverable witness without AtomicFile's destructive read-side rename.
            File source=new File(witness+".bak").exists()?new File(witness+".bak"):witness;
            if(!source.isFile()||source.length()>64)throw new IOException("Poškozený doklad evidence");
            state=new String(Files.readAllBytes(source.toPath()),StandardCharsets.UTF_8);
            if(!state.equals("PREPARED\n")&&!state.equals("ACTIVE\n"))throw new IOException("Neznámý doklad evidence");
        }
        if(state.equals("ACTIVE\n")&&!path.isFile())throw new IOException("Evidence přenosů chybí; automatický reset je zakázán");
        if(state.isEmpty()){
            if(new File(witness+".new").exists())throw new IOException("Nedokončený doklad evidence vyžaduje prověření");
            if(path.exists())throw new IOException("Evidence nemá nezávislý doklad; ruční kontrola je nutná");
            writeWitness(witness,"PREPARED\n");fault.at("witness-prepared");
        }
        // The platform's default corruption handler deletes databases. Preserve all bytes instead.
        SQLiteDatabase database=SQLiteDatabase.openDatabase(path.getPath(),null,
            SQLiteDatabase.OPEN_READWRITE|SQLiteDatabase.CREATE_IF_NECESSARY,
            corrupt->{throw new SQLiteException("Poškozená evidence byla zachována; obnova je nutná");});
        SyncLedger ledger=new SyncLedger(home,database,fault);
        try {
            database.execSQL("PRAGMA synchronous=FULL");
            database.execSQL("PRAGMA foreign_keys=ON");
            try(Cursor c=database.rawQuery("PRAGMA quick_check",null)){
                if(!c.moveToFirst()||!"ok".equals(c.getString(0)))throw new IOException("Poškozená evidence přenosů");
            }
            try(Cursor c=database.rawQuery("PRAGMA foreign_key_check",null)){
                if(c.moveToFirst())throw new IOException("Evidence ztratila navázaný původní podklad; automatická oprava je zakázána");
            }
            int version=database.getVersion();
            if(version>1||version<0)throw new IOException("Nepodporovaná verze evidence");
            if(version==0){
                if(state.equals("ACTIVE\n"))throw new IOException("Aktivní evidence ztratila schéma");
                ledger.initialize();
            }
            // SQL commit is the sole cutover. A crash before this witness is repaired by verification.
            if(!"active".equals(ledger.document("migration")))throw new IOException("Neúplná migrace evidence");
            ledger.queue();
            if(!state.equals("ACTIVE\n")){fault.at("before-active-witness");writeWitness(witness,"ACTIVE\n");}
            return ledger;
        } catch(Exception error){database.close();throw error;}
    }
    private static void writeWitness(File file,String text)throws IOException{
        AtomicFile atomic=new AtomicFile(file);FileOutputStream out=null;
        try{out=atomic.startWrite();out.write(text.getBytes(StandardCharsets.UTF_8));out.getFD().sync();atomic.finishWrite(out);out=null;}
        finally{if(out!=null)atomic.failWrite(out);}
    }
    /** Absence is part of the copied inventory too; a newly appearing source must abort cutover. */
    private static void verifyLegacySet(File source,Map<String,byte[]> copies)throws IOException{
        for(String suffix:new String[]{"",".bak",".new"}){
            File file=new File(source+suffix);byte[] expected=copies.get(file.getName());
            boolean exists=Files.exists(file.toPath(),LinkOption.NOFOLLOW_LINKS);
            if(expected==null){if(exists)throw new IOException("Během migrace vznikl nový původní doklad");}
            else if(!exists||Files.isSymbolicLink(file.toPath())||!file.isFile()||file.length()!=expected.length||
                    !Arrays.equals(expected,Files.readAllBytes(file.toPath())))
                throw new IOException("Původní evidence se během migrace změnila");
        }
    }
    private void initialize()throws Exception{
        Map<String,byte[]> evidence=new TreeMap<>();
        File primary=new File(home,"sync-queue-v2.json"),backup=new File(primary+".bak");
        for(String suffix:new String[]{"",".bak",".new"}){
            File file=new File(primary+suffix);
            if(Files.exists(file.toPath(),LinkOption.NOFOLLOW_LINKS)){
                if(!file.isFile()||Files.isSymbolicLink(file.toPath())||file.length()>LocalDatabase.MAX_BYTES)throw new IOException("Původní frontu nelze bezpečně zkopírovat");
                byte[] bytes=Files.readAllBytes(file.toPath());evidence.put(file.getName(),bytes);
            }
        }
        byte[] selected=evidence.get(evidence.containsKey(backup.getName())?backup.getName():primary.getName());
        String text=selected==null?EMPTY_QUEUE:JsonInput.decode(selected);SyncQueueStore.validate(new JSONObject(text));
        fault.at("legacy-copied");
        db.beginTransaction();
        try {
            db.execSQL("CREATE TABLE documents(name TEXT PRIMARY KEY, value TEXT NOT NULL, hash TEXT NOT NULL)");
            db.execSQL("CREATE TABLE legacy_sources(name TEXT PRIMARY KEY, bytes BLOB NOT NULL, hash TEXT NOT NULL)");
            db.execSQL("CREATE TABLE jobs(id TEXT PRIMARY KEY,peer TEXT NOT NULL,kind TEXT NOT NULL,source_ref TEXT NOT NULL,hash TEXT NOT NULL,size INTEGER NOT NULL,quarantined INTEGER NOT NULL)");
            db.execSQL("CREATE INDEX pending_peer ON jobs(peer,quarantined,kind)");
            db.execSQL("CREATE TABLE targets(id TEXT PRIMARY KEY, kind TEXT NOT NULL, scope TEXT NOT NULL, peer TEXT NOT NULL)");
            db.execSQL("CREATE TABLE revisions(hash TEXT PRIMARY KEY, bytes BLOB NOT NULL, epoch TEXT NOT NULL, data_hash TEXT NOT NULL, content_only INTEGER NOT NULL)");
            db.execSQL("CREATE INDEX revision_content ON revisions(data_hash,content_only)");
            db.execSQL("CREATE TABLE revision_media(revision TEXT NOT NULL REFERENCES revisions(hash),id TEXT NOT NULL,hash TEXT NOT NULL,size INTEGER NOT NULL,PRIMARY KEY(revision,id))");
            db.execSQL("CREATE TABLE deliveries(target TEXT NOT NULL REFERENCES targets(id), revision TEXT NOT NULL REFERENCES revisions(hash), state TEXT NOT NULL, proof TEXT NOT NULL DEFAULT '', PRIMARY KEY(target,revision))");
            db.execSQL("CREATE TABLE transfers(id TEXT PRIMARY KEY, target TEXT NOT NULL REFERENCES targets(id), source_hash TEXT NOT NULL, size INTEGER NOT NULL, session TEXT NOT NULL, offset INTEGER NOT NULL, path TEXT NOT NULL)");
            putDocument("queue",text);
            for(Map.Entry<String,byte[]> item:evidence.entrySet()){
                ContentValues v=new ContentValues();v.put("name",item.getKey());v.put("bytes",item.getValue());v.put("hash",PeerWire.hash(item.getValue()));db.insertOrThrow("legacy_sources",null,v);
            }
            fault.at("before-cutover");
            // No legacy writer can run concurrently: SyncQueueStore holds the shared lock.
            verifyLegacySet(primary,evidence);
            putDocument("migration","active");db.setVersion(1);db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        fault.at("after-cutover");
    }
    private String document(String name)throws IOException{
        return new String(readPayload("documents","name",name,"value"),StandardCharsets.UTF_8);
    }
    /** Android CursorWindow is small. Never select an entire 20MiB TEXT/BLOB into one cursor row. */
    private byte[] readPayload(String table,String keyColumn,String key,String column)throws IOException{
        db.beginTransaction();try{
            long size;String expected;
            try(Cursor c=db.rawQuery("SELECT length(CAST("+column+" AS BLOB)),hash FROM "+table+" WHERE "+keyColumn+"=?",new String[]{key})){
                if(!c.moveToFirst())throw new IOException("Evidence je neúplná");size=c.getLong(0);expected=c.getString(1);
            }
            if(size<0||size>PeerWire.MAX_JSON)throw new IOException("Evidence překračuje bezpečný limit metadat");
            ByteArrayOutputStream bytes=new ByteArrayOutputStream((int)size);
            for(long at=0;at<size;){
                int count=(int)Math.min(65536,size-at);
                try(Cursor c=db.rawQuery("SELECT substr(CAST("+column+" AS BLOB),?,?) FROM "+table+" WHERE "+keyColumn+"=?",new String[]{String.valueOf(at+1),String.valueOf(count),key})){
                    if(!c.moveToFirst())throw new IOException("Podklad evidence zmizel");byte[] chunk=c.getBlob(0);if(chunk.length!=count)throw new IOException("Neúplný podklad evidence");bytes.write(chunk,0,chunk.length);
                }at+=count;
            }
            byte[] result=bytes.toByteArray();if(!expected.equals(PeerWire.hash(result)))throw new IOException("Evidence má jiné kontrolní bajty");db.setTransactionSuccessful();return result;
        }finally{db.endTransaction();}
    }
    private void putDocument(String name,String text)throws IOException{
        ContentValues v=new ContentValues();v.put("name",name);v.put("value",text);v.put("hash",PeerWire.hash(text.getBytes(StandardCharsets.UTF_8)));
        try{if(db.insertWithOnConflict("documents",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new IOException("Zápis evidence nebyl potvrzen");}
        catch(SQLiteException failure){throw new IOException("Zápis evidence selhal; předchozí stav zůstal zachován",failure);}
        if("queue".equals(name))try{
            JSONObject queue=new JSONObject(text);db.delete("jobs",null,null);
            for(String section:new String[]{"jobs","recoveryQuarantine"}){JSONArray jobs=queue.optJSONArray(section);if(jobs==null)continue;for(int i=0;i<jobs.length();i++){
                JSONObject job=jobs.getJSONObject(i);ContentValues row=new ContentValues();row.put("id",job.getString("id"));row.put("peer",job.getString("peer"));row.put("kind",job.getString("kind"));row.put("source_ref",job.optString("sourceRef",""));row.put("hash",job.getString("hash"));row.put("size",job.getLong("size"));row.put("quarantined","jobs".equals(section)?0:1);db.insertOrThrow("jobs",null,row);
            }}
        }catch(Exception invalid){throw new IOException("Index fronty nebyl potvrzen",invalid);}
    }
    String queue()throws Exception {String text=document("queue");SyncQueueStore.validate(new JSONObject(text));return text;}
    interface QueueWrite {void apply(SyncLedger ledger)throws Exception;}
    boolean saveQueue(long expected,String text)throws Exception{
        return saveQueue(expected,text,ledger->{});
    }
    boolean saveQueue(long expected,String text,QueueWrite receipt)throws Exception{
        SyncQueueStore.validate(new JSONObject(text));
        if(new JSONObject(text).getLong("revision")!=expected+1)throw new IOException("Neplatný krok fronty");
        db.beginTransaction();
        try {if(new JSONObject(queue()).getLong("revision")!=expected)return false;fault.at("before-queue-write");putDocument("queue",text);fault.at("after-queue-write");receipt.apply(this);fault.at("before-receipt-commit");db.setTransactionSuccessful();return true;}
        finally {db.endTransaction();}
    }
    String legacyDocument(File source,String initial)throws Exception{
        String name=source.getName();
        if(!source.getParentFile().getCanonicalFile().equals(home.getCanonicalFile())||!name.matches("sync-(inbox|scan|publications)-v2-[a-zA-Z0-9-]+\\.json"))throw new IOException("Neplatná evidence transportu");
        db.beginTransaction();
        try {
            // Check inside the writer transaction: another connection may already have cut over.
            try(Cursor c=db.rawQuery("SELECT 1 FROM documents WHERE name=?",new String[]{name})){if(c.moveToFirst()){String text=document(name);db.setTransactionSuccessful();return text;}}
            Map<String,byte[]> copies=new TreeMap<>();
            for(String suffix:new String[]{"",".bak",".new"}){
                File file=new File(source+suffix);if(!Files.exists(file.toPath(),LinkOption.NOFOLLOW_LINKS))continue;
                if(!file.isFile()||Files.isSymbolicLink(file.toPath())||file.length()>PeerWire.MAX_JSON)throw new IOException("Původní evidence je neověřitelná");
                copies.put(file.getName(),Files.readAllBytes(file.toPath()));
            }
            byte[] chosen=copies.get(copies.containsKey(name+".bak")?name+".bak":name);
            String text=chosen==null?initial:JsonInput.decode(chosen);JsonInput.object(text.getBytes(StandardCharsets.UTF_8));
            fault.at("before-document-cutover");verifyLegacySet(source,copies);
            for(Map.Entry<String,byte[]> item:copies.entrySet()){
                ContentValues v=new ContentValues();v.put("name",item.getKey());v.put("bytes",item.getValue());v.put("hash",PeerWire.hash(item.getValue()));db.insertOrThrow("legacy_sources",null,v);
            }
            putDocument(name,text);db.setTransactionSuccessful();return text;
        } finally {db.endTransaction();}
    }
    void saveDocument(File source,JSONObject data)throws Exception{
        String text=data.toString();if(text.getBytes(StandardCharsets.UTF_8).length>PeerWire.MAX_JSON)throw new IOException("Evidence transportu je příliš velká");
        legacyDocument(source,text);putDocument(source.getName(),text);
    }
    static String targetId(String kind,String scope,String peer)throws IOException{
        if(kind==null||!kind.matches("[a-z][a-z0-9-]{1,31}")||scope==null||scope.isEmpty()||scope.length()>4096||peer==null||peer.length()>120)throw new IOException("Neplatný cíl přenosu");
        return PeerWire.hash((kind.length()+":"+kind+scope.length()+":"+scope+peer.length()+":"+peer).getBytes(StandardCharsets.UTF_8));
    }
    String target(String kind,String scope,String peer)throws IOException{
        String id=targetId(kind,scope,peer),scopeHash=PeerWire.hash(scope.getBytes(StandardCharsets.UTF_8));db.execSQL("INSERT OR IGNORE INTO targets(id,kind,scope,peer) VALUES(?,?,?,?)",new Object[]{id,kind,scopeHash,peer});
        try(Cursor c=db.rawQuery("SELECT kind,scope,peer FROM targets WHERE id=?",new String[]{id})){if(!c.moveToFirst()||!kind.equals(c.getString(0))||!scopeHash.equals(c.getString(1))||!peer.equals(c.getString(2)))throw new IOException("Identita SQL cíle se změnila");}return id;
    }
    void prepare(String target,PeerSnapshot snapshot)throws Exception{
        db.beginTransaction();
        try {
            db.execSQL("INSERT OR IGNORE INTO revisions(hash,bytes,epoch,data_hash,content_only) VALUES(?,?,?,?,?)",new Object[]{snapshot.hash,snapshot.bytes,snapshot.wire.optString("recoveryEpoch",""),PeerWire.hash(CausalClock.canonical(snapshot.data).getBytes(StandardCharsets.UTF_8)),snapshot.wire.optBoolean("recoveryOnly")?1:0});
            db.execSQL("INSERT OR IGNORE INTO deliveries(target,revision,state) VALUES(?,?,'waiting')",new Object[]{target,snapshot.hash});
            for(JSONObject media:snapshot.media.values())db.execSQL("INSERT OR IGNORE INTO revision_media(revision,id,hash,size) VALUES(?,?,?,?)",new Object[]{snapshot.hash,media.getString("id"),media.getString("hash"),media.getLong("size")});
            db.setTransactionSuccessful();
        } finally {db.endTransaction();}
    }
    void state(String target,String revision,String state,String proof)throws IOException{
        if(!Arrays.asList("waiting","transferring","transport-ack","transport-receipt","verified-checkpoint","unknown","verified-object","error","conflict").contains(state)||proof==null||proof.length()>4096)throw new IOException("Neplatný stav přenosu");
        ContentValues v=new ContentValues();v.put("state",state);v.put("proof",proof);
        if(db.update("deliveries",v,"target=? AND revision=?",new String[]{target,revision})!=1)throw new IOException("Cíl nemá připravenou revizi");
    }
    String state(String target,String revision){try(Cursor c=db.rawQuery("SELECT state FROM deliveries WHERE target=? AND revision=?",new String[]{target,revision})){return c.moveToFirst()?c.getString(0):"waiting";}}
    static boolean received(String state){return Arrays.asList("transport-ack","transport-receipt","verified-checkpoint").contains(state);}
    private boolean hasDocument(String name){try(Cursor c=db.rawQuery("SELECT 1 FROM documents WHERE name=?",new String[]{name})){return c.moveToFirst();}}
    /** Permanent, hash-checked source and manifest, separate from the disposable active-upload queue. */
    void intent(String target,PeerSnapshot snapshot,JSONObject binding)throws Exception{
        try(Cursor c=db.rawQuery("SELECT 1 FROM revisions WHERE hash=?",new String[]{snapshot.hash})){if(c.moveToFirst())revision(snapshot.hash,snapshot.wire.getString("sourceId"));}
        prepare(target,snapshot);
        JSONObject descriptor=new JSONObject().put("version",1).put("target",target).put("sourceRef",snapshot.hash)
            .put("size",snapshot.bytes.length).put("epoch",snapshot.wire.optString("recoveryEpoch",""))
            .put("manifest",PeerWire.hash(CausalClock.canonical(snapshot.wire.getJSONArray("media")).getBytes(StandardCharsets.UTF_8)))
            .put("binding",new JSONObject(binding.toString()));
        String name="intent:"+target+":"+snapshot.hash,text=CausalClock.canonical(descriptor);
        if(hasDocument(name)){if(!text.equals(document(name)))throw new IOException("Záměr má jinou identitu nebo původní obsah");}
        else putDocument(name,text);
        revision(snapshot.hash,snapshot.wire.getString("sourceId")); // Also verify an existing SQL row; INSERT OR IGNORE is not integrity evidence.
    }
    PeerSnapshot revision(String hash,String author)throws Exception{
        if(hash==null||!hash.matches("[a-f0-9]{64}"))throw new IOException("Neplatný původní snímek");
        PeerSnapshot snapshot=PeerSnapshot.parse(readPayload("revisions","hash",hash,"bytes"),author);
        if(!hash.equals(snapshot.hash))throw new IOException("Původní SQL snímek se změnil");
        try(Cursor c=db.rawQuery("SELECT epoch,data_hash,content_only FROM revisions WHERE hash=?",new String[]{hash})){
            if(!c.moveToFirst()||!snapshot.wire.optString("recoveryEpoch","").equals(c.getString(0))||
                !PeerWire.hash(CausalClock.canonical(snapshot.data).getBytes(StandardCharsets.UTF_8)).equals(c.getString(1))||
                (snapshot.wire.optBoolean("recoveryOnly")?1:0)!=c.getInt(2))throw new IOException("SQL původní revize má jiné doklady");
        }
        Set<String> ids=new HashSet<>();
        try(Cursor c=db.rawQuery("SELECT id,hash,size FROM revision_media WHERE revision=?",new String[]{hash})){
            while(c.moveToNext()){JSONObject media=snapshot.media.get(c.getString(0));if(media==null||!media.getString("hash").equals(c.getString(1))||media.getLong("size")!=c.getLong(2))throw new IOException("SQL manifest se změnil");ids.add(c.getString(0));}
        }
        if(!ids.equals(snapshot.media.keySet()))throw new IOException("SQL manifest není úplný");return snapshot;
    }
    JSONObject descriptor(String target,String hash)throws Exception{
        String name="intent:"+target+":"+hash;if(!hasDocument(name))return null;
        JSONObject d=new JSONObject(document(name));
        if(d.getInt("version")!=1||!target.equals(d.getString("target"))||!hash.equals(d.getString("sourceRef")))throw new IOException("Poškozený obnovitelný záměr");return d;
    }
    JSONArray intents(String peer)throws Exception{
        JSONArray result=new JSONArray();try(Cursor c=db.rawQuery("SELECT d.target,d.revision,d.state,t.kind FROM deliveries d JOIN targets t ON t.id=d.target WHERE t.peer=? ORDER BY d.rowid",new String[]{peer})){
            while(c.moveToNext())result.put(new JSONObject().put("target",c.getString(0)).put("sourceRef",c.getString(1)).put("state",c.getString(2)).put("kind",c.getString(3)));
        }return result;
    }
    Set<String> sourceRefs(){Set<String> refs=new HashSet<>();try(Cursor c=db.rawQuery("SELECT DISTINCT revision FROM deliveries",null)){while(c.moveToNext())refs.add(c.getString(0));}return refs;}
    boolean legacyQuietSource(String hash)throws Exception{
        JSONObject state=new JSONObject(queue());
        for(String section:new String[]{"jobs","recoveryQuarantine"}){JSONArray jobs=state.optJSONArray(section);if(jobs==null)continue;
            for(int i=0;i<jobs.length();i++){JSONObject job=jobs.getJSONObject(i);if(hash.equals(job.optString("sourceRef"))||"metadata".equals(job.optString("kind"))&&hash.equals(job.optString("hash")))return false;}
        }
        try(Cursor c=db.rawQuery("SELECT 1 FROM deliveries WHERE revision=? AND state='transport-ack' LIMIT 1",new String[]{hash})){return c.moveToFirst();}
    }
    void receipt(String target,PeerSnapshot snapshot,JSONObject binding,String job)throws Exception{
        intent(target,snapshot,binding);fault.at("before-receipt-write");
        // A duplicate transport ACK cannot erase a stronger historical checkpoint.
        if(!"verified-checkpoint".equals(state(target,snapshot.hash)))state(target,snapshot.hash,"transport-receipt",job);
        fault.at("after-receipt-write");
    }
    void contentInventory(String target,String state)throws IOException{if(!Arrays.asList("none","complete","error").contains(state))throw new IOException("Neplatný stav inventáře");putDocument("content:"+target,state);}
    private String contentInventory(String target)throws IOException{
        String name="content:"+target;
        try(Cursor c=db.rawQuery("SELECT 1 FROM documents WHERE name=?",new String[]{name})){if(!c.moveToFirst())return "";}
        String state=document(name); // Hash-check even small status payloads; quick_check cannot detect semantic corruption.
        if(!Arrays.asList("none","complete","error").contains(state))throw new IOException("Poškozený stav inventáře");return state;
    }
    boolean contentProblem(String target)throws IOException{return "error".equals(contentInventory(target));}
    JSONObject status(String local,String epoch)throws Exception{
        JSONObject current=new JSONObject(local);current.remove("prefs");current.remove("created");current.put("syncProtocol",2);
        String hash=PeerWire.hash(CausalClock.canonical(current).getBytes(StandardCharsets.UTF_8));JSONArray rows=new JSONArray();
        try(Cursor targets=db.rawQuery("SELECT id,kind,peer FROM targets WHERE peer<>'' ORDER BY id",null)){
            while(targets.moveToNext()){
                String id=targets.getString(0),state="waiting",content="waiting";
                try(Cursor c=db.rawQuery("SELECT d.state FROM deliveries d JOIN revisions r ON r.hash=d.revision WHERE d.target=? AND r.data_hash=? AND r.epoch=? AND r.content_only=0 ORDER BY r.rowid DESC LIMIT 1",new String[]{id,hash,epoch})){if(c.moveToFirst())state=c.getString(0);}
                try(Cursor c=db.rawQuery("SELECT d.state FROM deliveries d JOIN revisions r ON r.hash=d.revision WHERE d.target=? AND r.epoch=? AND r.content_only=1 ORDER BY r.rowid DESC LIMIT 1",new String[]{id,epoch})){if(c.moveToFirst())content=c.getString(0);}
                String inventory=contentInventory(id);if("none".equals(inventory))content="not-required";if("error".equals(inventory))content="error";
                // All persisted receipts/checkpoints are historical. Offline current receiver health is UNKNOWN.
                rows.put(new JSONObject().put("id",id).put("kind",targets.getString(1)).put("peer",targets.getString(2)).put("state",state).put("receiverState","UNKNOWN").put("contentState",content));
            }
        }
        return new JSONObject().put("localSaved",true).put("backupCreated",false).put("targets",rows);
    }
    JSONObject transfer(String id)throws Exception{
        try(Cursor c=db.rawQuery("SELECT target,source_hash,size,session,offset,path FROM transfers WHERE id=?",new String[]{id})){
            return c.moveToFirst()?new JSONObject().put("target",c.getString(0)).put("hash",c.getString(1)).put("size",c.getLong(2)).put("session",c.getString(3)).put("offset",c.getLong(4)).put("path",c.getString(5)):null;
        }
    }
    void transfer(String id,String target,String hash,long size,String session,long offset)throws IOException{
        transfer(id,target,hash,size,session,offset,"");
    }
    void transfer(String id,String target,String hash,long size,String session,long offset,String path)throws IOException{
        if(!id.matches("[a-f0-9]{64}")||!hash.matches("[a-f0-9]{64}")||size<1||size>PeerSnapshot.MAX_MEDIA||offset<0||offset>size)throw new IOException("Neplatný rozpracovaný přenos");
        // Opaque provider state is private. Each adapter validates its own endpoints before using it.
        if(session==null||session.length()>12000||session.matches(".*[\\p{Cntrl}].*")||path==null||path.length()>4096)throw new IOException("Neplatný stav poskytovatele");
        ContentValues v=new ContentValues();v.put("id",id);v.put("target",target);v.put("source_hash",hash);v.put("size",size);v.put("session",session);v.put("offset",offset);v.put("path",path);if(db.insertWithOnConflict("transfers",null,v,SQLiteDatabase.CONFLICT_REPLACE)==-1)throw new IOException("Stav přenosu nebyl uložen");
    }
    void finishTransfer(String id){db.delete("transfers","id=?",new String[]{id});}
    /** Portable non-secret evidence; resumable session URLs and credentials never leave no_backup. */
    JSONObject portable()throws Exception{
        db.beginTransaction();try{
        JSONObject result=new JSONObject().put("format","cz.zamerovac.sync.ledger").put("version",1).put("queueDocument","queue");
        for(String table:new String[]{"targets","deliveries"}){JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery("SELECT * FROM "+table+" ORDER BY 1,2",null)){while(c.moveToNext()){JSONObject row=new JSONObject();for(int i=0;i<c.getColumnCount();i++)row.put(c.getColumnName(i),c.getString(i));rows.put(row);}}result.put(table,rows);}
        // Only descriptors live in the index. Export one bounded payload at a time.
        JSONArray files=new JSONArray();
        try(Cursor c=db.rawQuery("SELECT name,length(CAST(value AS BLOB)),hash FROM documents ORDER BY name",null)){while(c.moveToNext())files.put(new JSONObject().put("name",c.getString(0)).put("path","no_backup/sync-ledger-documents/"+PeerWire.hash(c.getString(0).getBytes(StandardCharsets.UTF_8))+".json").put("size",c.getLong(1)).put("hash",c.getString(2)));}
        try(Cursor c=db.rawQuery("SELECT hash,length(bytes) FROM revisions ORDER BY hash",null)){while(c.moveToNext())files.put(new JSONObject().put("path","no_backup/sync-ledger-revisions/"+c.getString(0)+".json").put("size",c.getLong(1)).put("hash",c.getString(0)));}
        try(Cursor c=db.rawQuery("SELECT name,length(bytes),hash FROM legacy_sources ORDER BY name",null)){while(c.moveToNext())files.put(new JSONObject().put("name",c.getString(0)).put("path","no_backup/sync-ledger-legacy/"+PeerWire.hash(c.getString(0).getBytes(StandardCharsets.UTF_8))+".bin").put("size",c.getLong(1)).put("hash",c.getString(2)));}
        result.put("files",files);
        db.setTransactionSuccessful();return result;
        }finally{db.endTransaction();}
    }
    static boolean exportPath(String path){return path!=null&&path.matches("no_backup/sync-ledger-(documents|revisions|legacy)/[a-f0-9]{64}\\.(json|bin)");}
    byte[] exportFile(String path)throws Exception{
        if(!exportPath(path))throw new IOException("Neplatný podklad evidence");
        String key=path.substring(path.lastIndexOf('/')+1,path.lastIndexOf('.'));byte[] bytes=null;String expected="";
        if(path.contains("/sync-ledger-revisions/")){
            bytes=readPayload("revisions","hash",key,"bytes");expected=key;
        }else{
            boolean document=path.contains("/sync-ledger-documents/");String table=document?"documents":"legacy_sources";
            try(Cursor c=db.rawQuery("SELECT name,hash FROM "+table+" ORDER BY name",null)){
                while(c.moveToNext())if(key.equals(PeerWire.hash(c.getString(0).getBytes(StandardCharsets.UTF_8)))){bytes=readPayload(table,"name",c.getString(0),document?"value":"bytes");expected=c.getString(1);break;}
            }
        }
        if(bytes==null||bytes.length>PeerWire.MAX_JSON||!expected.equals(PeerWire.hash(bytes)))throw new IOException("Podklad evidence chybí nebo má jiné bajty");return bytes;
    }
    @Override public void close(){db.close();}
}
