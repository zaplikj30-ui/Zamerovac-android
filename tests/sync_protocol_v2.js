'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const p=require('../sync/protocol-v2'),v=require('../sync/revision-vector');
const hash=async bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
class DiskStore {
 constructor(root){this.root=root;this.fail=false;this.denyQueue=false}
 file(name){if(!/^(backups\/v2\/(blobs\/[a-f0-9]{64}|devices\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.json)|queue\.json)$/.test(name))throw Error('Unsafe namespace');return path.join(this.root,name)}
 async read(name){return new Uint8Array(await fs.readFile(this.file(name)))}
 async putImmutable(name,bytes){if(this.fail)throw Error('synthetic storage full');const file=this.file(name);await fs.mkdir(path.dirname(file),{recursive:true});let handle;try{handle=await fs.open(file,'wx');await handle.writeFile(bytes);await handle.sync()}catch(error){if(error.code!=='EEXIST')throw error;assert.deepEqual(await fs.readFile(file),Buffer.from(bytes),'immutable bytes may never be overwritten')}finally{await handle?.close()}}
 async readQueue(){try{return JSON.parse(await fs.readFile(this.file('queue.json'),'utf8'))}catch(error){if(error.code==='ENOENT')return {version:2,revision:0,jobs:[]};throw error}}
 async compareAndSwapQueue(revision,next){if(this.denyQueue)throw Error('synthetic disk full');const current=await this.readQueue();if(current.revision!==revision)return false;const temporary=this.file('queue.json')+'.tmp';const handle=await fs.open(temporary,'w');try{await handle.writeFile(JSON.stringify(next));await handle.sync()}finally{await handle.close()}await fs.rename(temporary,this.file('queue.json'));return true}
}
(async()=>{
 let deep={};for(let i=0;i<110;i++)deep={child:deep};assert.throws(()=>p.canonical(deep),/Nested content limit/);
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'zamerovac-protocol-'));
 try{
  const disk=new DiskStore(directory),queue=new p.PersistentQueue(disk,hash),source=new Map(),receiver=new Map();
  const received=path.join(directory,'received');await fs.mkdir(received);
  async function commit(job){const bytes=source.get(job.hash);assert(bytes&&bytes.length===job.size);assert.equal(await hash(bytes),job.hash);const temporary=path.join(received,job.hash+'.part'),target=path.join(received,job.hash);await fs.writeFile(temporary,bytes);assert.equal(await hash(await fs.readFile(temporary)),job.hash);await fs.rename(temporary,target);receiver.set(job.id,job.hash);return {...job,committed:true}}
  let sent=0,cloud=0;const direct={id:'nearby',kind:'nearby',available:true,encrypted:true,authenticated:true,peers:[B],send:async job=>{if(++sent===19){await fs.writeFile(path.join(received,job.hash+'.part'),source.get(job.hash).slice(0,2));throw Error('synthetic radio disconnected halfway through media')}return commit(job)}};
  const drive={id:'drive',kind:'drive',available:true,metered:false,encrypted:true,authenticated:true,peers:[B],send:async job=>{cloud++;return commit(job)}};
  for(let i=0;i<30;i++){const bytes=new Uint8Array([i,23,45,67]);const digest=await hash(bytes);source.set(digest,bytes);await queue.enqueue({peer:B,kind:'blob',hash:digest,size:bytes.length})}
  const result=await queue.flush([drive,direct],{now:1});assert.equal(result.completed,30);assert.equal(sent,19);assert.equal(cloud,12);assert.equal(receiver.size,30);assert.equal(result.pending,0);assert.equal((await fs.readdir(received)).length,30);assert(!(await fs.readdir(received)).some(name=>name.endsWith('.part')));for(const [digest,bytes] of source)assert.deepEqual(await fs.readFile(path.join(received,digest)),Buffer.from(bytes));
  // No cloud calls while a direct path works; metered large blobs remain pending without opt-in.
  const largeBytes=new Uint8Array(5000000).fill(99),largeHash=await hash(largeBytes);source.set(largeHash,largeBytes);const large={peer:B,kind:'blob',hash:largeHash,size:largeBytes.length};await queue.enqueue(large);
  const metered={...drive,id:'mobile',metered:true};assert.deepEqual(await queue.flush([metered],{now:2}),{completed:0,pending:1});assert.equal(cloud,12);
  const reopened=new p.PersistentQueue(new DiskStore(directory),hash);await reopened.flush([metered],{now:3,allowMetered:true});assert.equal((await reopened.read()).jobs.length,0);
  // Lost acknowledgement and process restart cannot remove a pending transfer or duplicate remote content.
  const id=await queue.enqueue(large);let attempts=0;const accepted=new Set();const lost={...direct,id:'lost',send:async job=>{attempts++;accepted.add(job.id);await commit(job);if(attempts===1)throw Error('ack lost');return {...job,committed:true}}};
  await queue.flush([lost],{now:100});assert.equal((await queue.read()).jobs.length,1);await new p.PersistentQueue(new DiskStore(directory),hash).flush([lost],{now:100000});assert.equal(accepted.size,1);assert.equal(attempts,2);assert.equal((await queue.read()).jobs.length,0);
  // Invalid acknowledgements and plaintext/unpaired adapters never clear jobs.
  await queue.enqueue(large);const wrongAck={...direct,id:'wrong',send:async job=>({...job,hash:'0'.repeat(64),committed:true})};await queue.flush([wrongAck],{now:200000});assert.equal((await queue.read()).jobs.length,1);
  let unauthorizedCalls=0;await queue.flush([{...direct,id:'unsafe',encrypted:false,send:async()=>{unauthorizedCalls++}}],{now:300000});assert.equal(unauthorizedCalls,0);
  const previous=JSON.stringify(await disk.readQueue());disk.denyQueue=true;await assert.rejects(queue.enqueue({peer:A,kind:'blob',hash:await hash(new Uint8Array([10])),size:1}));assert.equal(JSON.stringify(await disk.readQueue()),previous);disk.denyQueue=false;
  const raw={schema:1,records:[{id:'photo',syncClock:v.advance({},A),items:[{type:'dimension',measure:'0,000000000123456789',unit:'in'}],media:['photo-001']}]};
  const other=structuredClone(raw);other.records[0].syncClock=v.advance({},B);other.records[0].items[0].measure='99999999,123456789';
  const merged=await p.mergeData(raw,other,hash),reverse=await p.mergeData(other,raw,hash);assert.equal(p.canonical(merged),p.canonical(reverse));assert.equal(merged.records.length,2);assert.equal((await p.mergeData(merged,other,hash)).records.length,2);assert.deepEqual(merged.records.map(r=>r.items[0].measure).sort(),['0,000000000123456789','99999999,123456789']);
  const deleted=structuredClone(other);deleted.records[0].deleted=true;assert.equal((await p.mergeData(raw,deleted,hash)).records.length,2,'concurrent deletion preserves edited live version');
  // Two device histories deduplicate one hundred immutable originals, then preserve both old/new versions.
  const photos=new Map();for(let i=0;i<100;i++)photos.set('photo-'+String(i).padStart(3,'0'),new Uint8Array([i,5,6]));
  const data={schema:1,records:[{id:'all',media:[...photos.keys()],items:[{measure:'1585,800001',unit:'mm',detailItems:[{measure:'0,0000001',media:['photo-001']}]}]}]};
  const first=await p.createBackup({store:disk,hash,deviceId:A,backupId:crypto.randomUUID(),createdAt:'2026-11-05T00:00:00Z',data,readMedia:id=>photos.get(id)});
  const second=await p.createBackup({store:disk,hash,deviceId:B,backupId:crypto.randomUUID(),createdAt:'2026-11-05T00:00:00Z',data,readMedia:id=>photos.get(id)});
  assert.equal((await fs.readdir(path.join(directory,'backups/v2/blobs'))).length,101,'one project blob plus 100 shared originals');assert.notEqual(first.path,second.path);
  photos.set('photo-001',new Uint8Array([201,202,203]));const third=await p.createBackup({store:disk,hash,deviceId:A,backupId:crypto.randomUUID(),createdAt:'2026-11-05T00:00:01Z',data,readMedia:id=>photos.get(id)});assert.equal((await fs.readdir(path.join(directory,'backups/v2/blobs'))).length,102);
  const old=await p.restoreBackup({store:disk,hash,path:first.path}),newer=await p.restoreBackup({store:disk,hash,path:third.path});assert.deepEqual([...old.media.get('photo-001')],[1,5,6]);assert.deepEqual([...newer.media.get('photo-001')],[201,202,203]);assert.equal(p.canonical(old.data),p.canonical(data));
  disk.fail=true;await assert.rejects(p.createBackup({store:disk,hash,deviceId:A,backupId:crypto.randomUUID(),createdAt:'2026-11-05T00:00:02Z',data,readMedia:id=>photos.get(id)}));disk.fail=false;assert.equal(p.canonical((await p.restoreBackup({store:disk,hash,path:first.path})).data),p.canonical(data));
  // Corruption is rejected; active projects are never written by restoreBackup.
  const corrupted=third.manifest.media.find(x=>x.id==='photo-001').hash;await fs.writeFile(path.join(directory,'backups/v2/blobs',corrupted),new Uint8Array([0]));await assert.rejects(p.restoreBackup({store:disk,hash,path:third.path}));assert.equal(p.canonical((await p.restoreBackup({store:disk,hash,path:first.path})).data),p.canonical(data));
  await assert.rejects(p.restoreBackup({store:disk,hash,path:'../projects.json'}));
  console.log('PASS isolated v2 core: 30 synthetic file tasks/simulated failover, persistent queue/restart, idempotent ack, metered policy, exact conflicts, 2 device histories/100 deduplicated blobs, old/new restore and storage faults');
 }finally{await fs.rm(directory,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
