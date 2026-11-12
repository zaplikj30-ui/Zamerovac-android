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
        byte[] selected=evidence.get(backup.exists()?backup.getName():primary.getName());
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
            for(Map.Entry<String,byte[]> item:evidence.entrySet())if(!Arrays.equals(item.getValue(),Files.readAllBytes(new File(home,item.getKey()).toPath())))throw new IOException("Původní fronta se během migrace změnila");
            putDocument("migration","active");db.setVersion(1);db.setTransactionSuccessful();
        } finally { db.endTransaction(); }
        fault.at("after-cutover");
    }
    private String document(String name)throws IOException{
        try(Cursor c=db.rawQuery("SELECT value,hash FROM documents WHERE name=?",new String[]{name})){
            if(!c.moveToFirst())throw new IOException("Evidence je neúplná");String text=c.getString(0);
            if(!PeerWire.hash(text.getBytes(StandardCharsets.UTF_8)).equals(c.getString(1)))throw new IOException("Evidence má jiné kontrolní bajty");return text;
        }
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
    boolean saveQueue(long expected,String text)throws Exception{
        SyncQueueStore.validate(new JSONObject(text));
        if(new JSONObject(text).getLong("revision")!=expected+1)throw new IOException("Neplatný krok fronty");
        db.beginTransaction();
        try {if(new JSONObject(queue()).getLong("revision")!=expected)return false;fault.at("before-queue-write");putDocument("queue",text);fault.at("after-queue-write");db.setTransactionSuccessful();return true;}
        finally {db.endTransaction();}
    }
    String legacyDocument(File source,String initial)throws Exception{
        String name=source.getName();
        if(!source.getParentFile().getCanonicalFile().equals(home.getCanonicalFile())||!name.matches("sync-(inbox|scan|publications)-v2-[a-zA-Z0-9-]+\\.json"))throw new IOException("Neplatná evidence transportu");
        try(Cursor c=db.rawQuery("SELECT 1 FROM documents WHERE name=?",new String[]{name})){if(c.moveToFirst())return document(name);}
        db.beginTransaction();
        try {
            Map<String,byte[]> copies=new TreeMap<>();
            for(String suffix:new String[]{"",".bak",".new"}){
                File file=new File(source+suffix);if(!Files.exists(file.toPath(),LinkOption.NOFOLLOW_LINKS))continue;
                if(!file.isFile()||Files.isSymbolicLink(file.toPath())||file.length()>PeerWire.MAX_JSON)throw new IOException("Původní evidence je neověřitelná");
                copies.put(file.getName(),Files.readAllBytes(file.toPath()));
            }
            byte[] chosen=copies.get(new File(source+".bak").exists()?name+".bak":name);
            String text=chosen==null?initial:JsonInput.decode(chosen);JsonInput.object(text.getBytes(StandardCharsets.UTF_8));
            for(Map.Entry<String,byte[]> item:copies.entrySet()){
                if(!Arrays.equals(item.getValue(),Files.readAllBytes(new File(home,item.getKey()).toPath())))throw new IOException("Evidence se během migrace změnila");
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
        String id=targetId(kind,scope,peer);ContentValues v=new ContentValues();v.put("id",id);v.put("kind",kind);v.put("scope",PeerWire.hash(scope.getBytes(StandardCharsets.UTF_8)));v.put("peer",peer);
        db.insertWithOnConflict("targets",null,v,SQLiteDatabase.CONFLICT_IGNORE);return id;
    }
    void prepare(String target,PeerSnapshot snapshot)throws Exception{
        db.beginTransaction();
        try {
            ContentValues r=new ContentValues();r.put("hash",snapshot.hash);r.put("bytes",snapshot.bytes);r.put("epoch",snapshot.wire.optString("recoveryEpoch",""));r.put("data_hash",PeerWire.hash(CausalClock.canonical(snapshot.data).getBytes(StandardCharsets.UTF_8)));r.put("content_only",snapshot.wire.optBoolean("recoveryOnly")?1:0);db.insertWithOnConflict("revisions",null,r,SQLiteDatabase.CONFLICT_IGNORE);
            ContentValues d=new ContentValues();d.put("target",target);d.put("revision",snapshot.hash);d.put("state","waiting");db.insertWithOnConflict("deliveries",null,d,SQLiteDatabase.CONFLICT_IGNORE);
            for(JSONObject media:snapshot.media.values()){ContentValues ref=new ContentValues();ref.put("revision",snapshot.hash);ref.put("id",media.getString("id"));ref.put("hash",media.getString("hash"));ref.put("size",media.getLong("size"));db.insertWithOnConflict("revision_media",null,ref,SQLiteDatabase.CONFLICT_IGNORE);}
            db.setTransactionSuccessful();
        } finally {db.endTransaction();}
    }
    void state(String target,String revision,String state,String proof)throws IOException{
        if(!Arrays.asList("waiting","transferring","transport-ack","verified-object","error","conflict").contains(state)||proof==null||proof.length()>4096)throw new IOException("Neplatný stav přenosu");
        ContentValues v=new ContentValues();v.put("state",state);v.put("proof",proof);
        if(db.update("deliveries",v,"target=? AND revision=?",new String[]{target,revision})!=1)throw new IOException("Cíl nemá připravenou revizi");
    }
    String state(String target,String revision){try(Cursor c=db.rawQuery("SELECT state FROM deliveries WHERE target=? AND revision=?",new String[]{target,revision})){return c.moveToFirst()?c.getString(0):"waiting";}}
    void contentInventory(String target,String state)throws IOException{if(!Arrays.asList("none","complete","error").contains(state))throw new IOException("Neplatný stav inventáře");putDocument("content:"+target,state);}
    boolean contentProblem(String target)throws IOException{try(Cursor c=db.rawQuery("SELECT 1 FROM documents WHERE name=?",new String[]{"content:"+target})){return c.moveToFirst()&&"error".equals(document("content:"+target));}}
    JSONObject status(String local,String epoch)throws Exception{
        JSONObject current=new JSONObject(local);current.remove("prefs");current.remove("created");current.put("syncProtocol",2);
        String hash=PeerWire.hash(CausalClock.canonical(current).getBytes(StandardCharsets.UTF_8));JSONArray rows=new JSONArray();
        try(Cursor targets=db.rawQuery("SELECT id,kind,peer FROM targets ORDER BY id",null)){
            while(targets.moveToNext()){
                String id=targets.getString(0),state="waiting",content="waiting";
                try(Cursor c=db.rawQuery("SELECT d.state FROM deliveries d JOIN revisions r ON r.hash=d.revision WHERE d.target=? AND r.data_hash=? AND r.epoch=? AND r.content_only=0 ORDER BY r.rowid DESC LIMIT 1",new String[]{id,hash,epoch})){if(c.moveToFirst())state=c.getString(0);}
                try(Cursor c=db.rawQuery("SELECT d.state FROM deliveries d JOIN revisions r ON r.hash=d.revision WHERE d.target=? AND r.epoch=? AND r.content_only=1 ORDER BY r.rowid DESC LIMIT 1",new String[]{id,epoch})){if(c.moveToFirst())content=c.getString(0);}
                try(Cursor c=db.rawQuery("SELECT value FROM documents WHERE name=?",new String[]{"content:"+id})){if(c.moveToFirst()){if("none".equals(c.getString(0)))content="not-required";if("error".equals(c.getString(0)))content="error";}}
                rows.put(new JSONObject().put("id",id).put("kind",targets.getString(1)).put("peer",targets.getString(2)).put("state",state).put("contentState",content));
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
        JSONObject result=new JSONObject().put("format","cz.zamerovac.sync.ledger").put("version",1).put("queue",new JSONObject(queue()));
        for(String table:new String[]{"targets","deliveries","documents"}){JSONArray rows=new JSONArray();try(Cursor c=db.rawQuery("SELECT * FROM "+table+" ORDER BY 1,2",null)){while(c.moveToNext()){JSONObject row=new JSONObject();for(int i=0;i<c.getColumnCount();i++)row.put(c.getColumnName(i),c.getString(i));rows.put(row);}}result.put(table,rows);}
        JSONArray revisions=new JSONArray();try(Cursor c=db.rawQuery("SELECT hash,bytes FROM revisions ORDER BY hash",null)){while(c.moveToNext()){byte[] bytes=c.getBlob(1);if(!c.getString(0).equals(PeerWire.hash(bytes)))throw new IOException("Historická revize evidence je poškozená");revisions.put(new JSONObject().put("hash",c.getString(0)).put("metadata",JsonInput.decode(bytes)));}}result.put("revisions",revisions);
        db.setTransactionSuccessful();return result;
        }finally{db.endTransaction();}
    }
    @Override public void close(){db.close();}
}
