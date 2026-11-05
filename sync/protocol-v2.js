'use strict';
// Transport-neutral checkpoint. Native discovery, TLS pairing, Drive OAuth and
// Android lifecycle adapters are deliberately NOT supplied by this module.
const vectors=require('./revision-vector');
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const HASH=/^[0-9a-f]{64}$/;
function canonical(value){
 if(value===null||typeof value==='string'||typeof value==='boolean')return JSON.stringify(value);
 if(typeof value==='number'){if(!Number.isFinite(value))throw Error('Non-finite number');return JSON.stringify(value)}
 if(Array.isArray(value))return '['+value.map(canonical).join(',')+']';
 if(value&&typeof value==='object'&&[Object.prototype,null].includes(Object.getPrototypeOf(value)))return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
 throw Error('Unsupported value');
}
const clone=value=>JSON.parse(canonical(value));
function validateData(data){
 if(!data||data.schema!==1||!Array.isArray(data.records)||data.records.length>100000)throw Error('Invalid project data');
 const ids=new Set();for(const r of data.records){if(!r||typeof r.id!=='string'||!r.id||ids.has(r.id))throw Error('Duplicate or invalid record');ids.add(r.id);if(r.clock)vectors.compare(r.clock,{})}
 return data;
}
function mediaReferences(value,result=new Set(),depth=0){
 if(depth>100)throw Error('Nested content limit');
 if(Array.isArray(value)){for(const item of value)mediaReferences(item,result,depth+1)}
 else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){
  if(['media','audioMedia'].includes(key)){if(!Array.isArray(child))throw Error('Invalid media references');for(const id of child){if(typeof id!=='string'||!id||id.length>120||!/^[a-zA-Z0-9_-]+$/.test(id))throw Error('Invalid media ID');result.add(id)}}
  else if(key==='items'&&typeof child==='string'&&child.trim().startsWith('['))mediaReferences(JSON.parse(child),result,depth+1);
  else mediaReferences(child,result,depth+1);
 }
 return result;
}
async function mergeData(left,right,hash){
 validateData(left);validateData(right);
 const l=new Map(left.records.map(r=>[r.id,r])),r=new Map(right.records.map(r=>[r.id,r])),result=new Map();
 for(const id of [...new Set([...l.keys(),...r.keys()])].sort()){
  const a=l.get(id),b=r.get(id);if(!a||!b){result.set(id,clone(a||b));continue}
  if(canonical(a)===canonical(b)){result.set(id,clone(a));continue}
  const order=vectors.compare(a.clock||{},b.clock||{});
  if(order==='after'||order==='before'){result.set(id,clone(order==='after'?a:b));continue}
  // Equal clocks with different content are also unsafe to collapse.
  const ordered=[a,b].sort((x,y)=>canonical(x)<canonical(y)?-1:canonical(x)>canonical(y)?1:0);
  result.set(id,clone(ordered[0]));
  const digest=await hash(new TextEncoder().encode(canonical({id,record:ordered[1]})));
  if(!HASH.test(digest))throw Error('Invalid digest implementation');
  const copy={...clone(ordered[1]),id:'conflict-'+digest,conflict:true,conflictOf:id};
  if(!l.has(copy.id)&&!r.has(copy.id))result.set(copy.id,copy);
 }
 return {...clone(left),records:[...result.values()].sort((a,b)=>a.id<b.id?-1:a.id>b.id?1:0)};
}
function routesFor(job,routes,{allowMetered=false,largeBytes=1024*1024}={}){
 return routes.filter(route=>{
  // This is a contract imposed on a native adapter, not proof of TLS/pairing.
  if(!route.available||!route.authenticated||!route.encrypted||!route.peers.includes(job.peer))return false;
  if(route.kind==='nearby'||route.kind==='lan')return true;
  return route.kind==='drive'&&(route.metered===false||allowMetered||job.size<=largeBytes);
 }).sort((a,b)=>({nearby:0,lan:1,drive:2}[a.kind]-{nearby:0,lan:1,drive:2}[b.kind]));
}
class PersistentQueue {
 constructor(storage,hash){this.storage=storage;this.hash=hash;this.running=false}
 async read(){const snapshot=await this.storage.readQueue();if(!snapshot||snapshot.version!==2||!Number.isSafeInteger(snapshot.revision)||snapshot.revision<0||!Array.isArray(snapshot.jobs)||snapshot.jobs.length>100000)throw Error('Invalid queue');
  const ids=new Set();for(const job of snapshot.jobs){if(!HASH.test(job.id)||ids.has(job.id)||!UUID.test(job.peer)||!['metadata','blob'].includes(job.kind)||!HASH.test(job.hash)||!Number.isSafeInteger(job.size)||job.size<0||!Number.isSafeInteger(job.attempts)||job.attempts<0||!Number.isSafeInteger(job.nextAttempt)||job.nextAttempt<0)throw Error('Invalid queued transfer');ids.add(job.id)}return snapshot}

 async mutate(change){for(let attempt=0;attempt<8;attempt++){const current=await this.read(),next=clone(current);change(next);next.revision=current.revision+1;if(await this.storage.compareAndSwapQueue(current.revision,next))return next}throw Error('Queue changed concurrently')}
 async enqueue({peer,kind,hash,size,payload=null}){
  if(!UUID.test(peer)||!['metadata','blob'].includes(kind)||!HASH.test(hash)||!Number.isSafeInteger(size)||size<0)throw Error('Invalid transfer');
  if(kind==='metadata'){const bytes=new TextEncoder().encode(canonical(payload));if(!payload||bytes.length>20*1024*1024||size!==bytes.length||await this.hash(bytes)!==hash)throw Error('Invalid metadata');}
  const id=await this.hash(new TextEncoder().encode(canonical({peer,kind,hash})));
  await this.mutate(queue=>{if(!queue.jobs.some(j=>j.id===id))queue.jobs.push({id,peer,kind,hash,size,payload,attempts:0,nextAttempt:0})});return id;
 }
 async flush(routes,policy={}){
  if(this.running)return {busy:true};this.running=true;const failedRoutes=new Set(),now=policy.now??Date.now();let completed=0;
  try{
   const jobs=(await this.read()).jobs.slice(0,policy.maxJobs||100);
   for(const job of jobs){
    if(job.nextAttempt>now)continue;
    let done=false;
    for(const route of routesFor(job,routes,policy).filter(r=>!failedRoutes.has(r.id))){
     try{
      const ack=await route.send(clone(job));
      if(!ack||ack.committed!==true||ack.id!==job.id||ack.hash!==job.hash||ack.size!==job.size)throw Error('Transfer not durably acknowledged');
      await this.mutate(queue=>{queue.jobs=queue.jobs.filter(j=>j.id!==job.id)});done=true;completed++;break;
     }catch(error){failedRoutes.add(route.id)}
    }
    if(!done&&failedRoutes.size)await this.mutate(queue=>{const pending=queue.jobs.find(j=>j.id===job.id);if(pending){pending.attempts++;pending.nextAttempt=now+Math.min(900000,1000*2**Math.min(pending.attempts,10));}});
   }
   return {completed,pending:(await this.read()).jobs.length};
  }finally{this.running=false}
 }
}
async function putVerified(store,path,bytes,hash){
 const expected=await hash(bytes);if(!HASH.test(expected))throw Error('Invalid hash');
 await store.putImmutable(path,bytes);const actual=await store.read(path);
 if(actual.length!==bytes.length||await hash(actual)!==expected)throw Error('Unconfirmed immutable write');return {hash:expected,size:bytes.length};
}
async function createBackup({store,hash,deviceId,backupId,createdAt,data,readMedia}){
 if(!UUID.test(deviceId)||!UUID.test(backupId)||!Number.isFinite(Date.parse(createdAt)))throw Error('Invalid backup identity');validateData(data);
 const project=new TextEncoder().encode(canonical(data)),projectHash=await hash(project),media=[];
 await putVerified(store,'backups/v2/blobs/'+projectHash,project,hash);
 for(const id of [...mediaReferences(data.records)].sort()){
  const bytes=await readMedia(id);if(!(bytes instanceof Uint8Array)||!bytes.length)throw Error('Missing backup media');
  const digest=await hash(bytes);await putVerified(store,'backups/v2/blobs/'+digest,bytes,hash);media.push({id,hash:digest,size:bytes.length});
 }
 const manifest={format:'cz.zamerovac.backup',version:2,deviceId,backupId,createdAt,project:{hash:projectHash,size:project.length},media};
 const bytes=new TextEncoder().encode(canonical(manifest)),path='backups/v2/devices/'+deviceId+'/'+backupId+'.json';
 // Only this final immutable manifest makes a backup visible. Failed earlier blobs are unreferenced; no GC is performed.
 await putVerified(store,path,bytes,hash);return {path,manifest};
}
async function restoreBackup({store,hash,path}){
 if(!/^backups\/v2\/devices\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.json$/.test(path))throw Error('Invalid backup path');
 const raw=await store.read(path);if(raw.length>20*1024*1024)throw Error('Manifest limit');
 const manifest=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
 if(manifest.format!=='cz.zamerovac.backup'||manifest.version!==2||!UUID.test(manifest.deviceId)||!UUID.test(manifest.backupId)||!path.endsWith('/'+manifest.deviceId+'/'+manifest.backupId+'.json')||!Array.isArray(manifest.media))throw Error('Invalid backup manifest');
 async function verified(entry){if(!entry||!HASH.test(entry.hash)||!Number.isSafeInteger(entry.size)||entry.size<0)throw Error('Invalid blob reference');const bytes=await store.read('backups/v2/blobs/'+entry.hash);if(bytes.length!==entry.size||await hash(bytes)!==entry.hash)throw Error('Damaged backup blob');return bytes}
 const data=validateData(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(await verified(manifest.project))));
 const media=new Map();for(const item of manifest.media){if(media.has(item.id))throw Error('Duplicate backup media');media.set(item.id,await verified(item))}
 const required=mediaReferences(data.records);if(required.size!==media.size||[...required].some(id=>!media.has(id)))throw Error('Incomplete backup');
 return {data,media,manifest}; // Caller must stage copies and CAS-commit; never overwrite the active database here.
}
module.exports={canonical,validateData,mediaReferences,mergeData,routesFor,PersistentQueue,createBackup,restoreBackup};
