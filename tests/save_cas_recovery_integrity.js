'use strict';
// B16-R2/R3/R4: execute the actual production save/reconcile functions in Node VM.
// The Android fallback and restart paths have separate Robolectric coverage.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const begin=app.indexOf('function checkedSyncClock');
const end=app.indexOf('function notify(',begin);
assert(begin>=0&&end>begin,'Production save functions not found');
const device='11111111-1111-4111-8111-111111111111';
const base={schema:1,syncProtocol:2,prefs:{unit:'mm'},records:[{
 id:'photo-1',kind:'photo',rev:'confirmed',syncClock:{[device]:1},
 media:['latest-photo-id'],items:[{id:'dim-1',measure:'1585,800001234567890',
 laserMeasuredMm:'1585.800001234567890'}]
}]};
const snapshot=JSON.stringify(base);
let cases=0;
function create(handler,seed=base){
 const env={native:true,syncDeviceId:device,window:{},state:structuredClone(seed),
  persistedSnapshot:JSON.stringify(seed),initial:seed,prefs:seed.prefs,
  current:null,noteActive:null,screen:'browser',dataLoadFailed:false,notices:[],calls:[],
  uid:()=> 'conflict-copy',notify(msg){env.notices.push(msg)},
  Native:{
   saveDataChecked(text,expected){env.calls.push({text,expected});return handler(text,expected,env)},
   resolveSyncConflict(local,remote){return JSON.stringify({winner:'local',copy:{
    ...JSON.parse(remote),id:'conflict-copy',conflictSource:'native-remote-conflict'}})},
   preservePurgedEdit(id,record,tombstone){return JSON.stringify({
    ...JSON.parse(record),id:'purged-copy',conflictSource:'purge-edit:'+id})}
  }};
 vm.createContext(env);
 vm.runInContext(app.slice(begin,end),env);
 return env;
}
function denied(env,draft){
 assert.equal(env.save(),false);
 assert.equal(JSON.stringify(env.state),draft,'working precise data changed after failure');
 assert.equal(env.persistedSnapshot,snapshot,'confirmed snapshot replaced after failure');
 assert.equal(env.window.__lastSaveFailed,true,'false save acknowledgement');
 assert.match(env.notices.at(-1),/^Neuloženo:/);
 cases++;
}
function exact(record,measure='1585,800001234567890',media='latest-photo-id'){
 assert.equal(record.items[0].measure,measure,'exact measurement lost');
 assert.equal(record.items[0].laserMeasuredMm,'1585.800001234567890','laser precision lost');
 assert.equal(record.media[0],media,'original photo ID lost');
}
// R2: Native must return an I/O/recovery error, NEVER the stale backup as current.
let backing=snapshot,unavailable=true;
const recovered=create((text,expected)=>{
 if(unavailable)return JSON.stringify({ok:false,error:'Primary damaged; backup is recovery only'});
 if(expected!==backing)return JSON.stringify({ok:false,current:backing});
 backing=text;return JSON.stringify({ok:true});
});
recovered.state.records[0].items[0].measure='1999,123456789123456789';
recovered.state.records[0].media=['newest-original-photo-id'];
let edited=JSON.stringify(recovered.state);
denied(recovered,edited);
assert.equal(recovered.calls.length,1);
assert.equal(recovered.calls[0].expected,snapshot);
assert.equal(recovered.state.records[0].media[0],'newest-original-photo-id');
unavailable=false;
assert.equal(recovered.save(),true,'retry after repair failed');
assert.equal(recovered.persistedSnapshot,backing);
assert.equal(JSON.parse(backing).records[0].items[0].measure,'1999,123456789123456789');
assert.equal(JSON.parse(backing).records[0].media[0],'newest-original-photo-id');
assert.equal(recovered.save(),true,'second save after repair failed');
cases++;
// R3: Existing remote ID with a newer tombstone is inconsistent even when
// there are no missing IDs. Both without and with purge evidence MUST reject.
for(const receipt of [false,true]){
 for(const localEdit of [false,true]){
  let remote=structuredClone(base);
  remote.sequence=98;
  remote.syncTombstones={'photo-1':{[device]:2}};
  if(receipt)remote.trashPurgedIds=['photo-1'];
  let onDisk=JSON.stringify(remote);
  const draft=create((text,expected)=>{
   if(expected!==onDisk)return JSON.stringify({ok:false,current:onDisk});
   onDisk=text;return JSON.stringify({ok:true});
  });
  if(localEdit)draft.state.records[0].items[0].measure='7777,123456789123456789';
  edited=JSON.stringify(draft.state);
  denied(draft,edited);
  assert.equal(draft.calls.length,1,'invalid tombstone was retried/written');
  assert.equal(JSON.parse(onDisk).records[0].media[0],'latest-photo-id');
  // Repair the inconsistent remote metadata; retry in the SAME live session.
  delete remote.syncTombstones;
  delete remote.trashPurgedIds;
  onDisk=JSON.stringify(remote);
  assert.equal(draft.save(),true,'legitimate conflict after repair must succeed');
  assert.equal(JSON.parse(onDisk).records.length,1);
  exact(JSON.parse(onDisk).records[0],
   localEdit?'7777,123456789123456789':'1585,800001234567890');
  assert.equal(draft.persistedSnapshot,onDisk);
  cases++;
 }
}
// A tombstone without a purge receipt cannot discard a newly inserted local ID
// even when that ID was not in the previously confirmed base.
const emptyBase={schema:1,syncProtocol:2,prefs:{unit:'mm'},records:[]};
const incoming={schema:1,records:[],syncTombstones:{'photo-1':{[device]:2}}};
const unconfirmed=create(()=>JSON.stringify({ok:false,current:JSON.stringify(incoming)}),emptyBase);
unconfirmed.state.records.push(structuredClone(base.records[0]));
const freshDraft=JSON.stringify(unconfirmed.state);
assert.equal(unconfirmed.save(),false);
assert.equal(JSON.stringify(unconfirmed.state),freshDraft);
assert.equal(unconfirmed.persistedSnapshot,JSON.stringify(emptyBase));
assert.equal(unconfirmed.window.__lastSaveFailed,true);
cases++;
// Genuine purge with two durable receipts remains allowed; a concurrent edit
// becomes a new conflict record rather than silently disappearing.
for(const localEdit of [false,true]){
 let remote={schema:1,records:[],trashPurgedIds:['photo-1'],
  syncTombstones:{'photo-1':{[device]:2}}};
 let disk=JSON.stringify(remote);
 const working=create((text,expected)=>{
  if(expected!==disk)return JSON.stringify({ok:false,current:disk});
  disk=text;return JSON.stringify({ok:true});
 });
 if(localEdit)working.state.records[0].items[0].measure='3333,123456789123456789';
 assert.equal(working.save(),true);
 const records=JSON.parse(disk).records;
 assert.equal(records.length,localEdit?1:0);
 if(localEdit){assert.equal(records[0].id,'purged-copy');exact(records[0],'3333,123456789123456789')}
 assert.equal(working.save(),true);
 assert.equal(JSON.parse(disk).records.length,records.length);
 cases++;
}
// Production bootstrap: missing old data on restart MUST yield load failure and
// block save, whereas a genuinely clean install may create its first snapshot.
function boot(loadResult){
 let writes=0,stored='';
 const bridge={
  getAppVersion(){return '1.3.0-test'},getSyncDeviceId(){return device},
  loadData(){return loadResult},
  saveDataChecked(text,expected){writes++;if(expected!==stored)return JSON.stringify({ok:false,current:stored});stored=text;return JSON.stringify({ok:true})}
 };
 const env={window:{Native:bridge},Native:bridge,crypto:{randomUUID(){return device}},
  localStorage:{getItem(){return null},setItem(){}},console:{warn(){}},notices:[],
  notify(msg){env.notices.push(msg)}};
 vm.createContext(env);
 vm.runInContext(app.slice(0,app.indexOf('let sortAsc')),env);
 vm.runInContext(app.slice(begin,end),env);
 return {env,get writes(){return writes},
  status(){return vm.runInContext('({failed:dataLoadFailed,snapshot:persistedSnapshot,records:state.records.length})',env)},
  save(){return vm.runInContext('save()',env)}};
}
const lost=boot('{"_loadError":true}');
assert.equal(lost.status().failed,true);
assert.equal(lost.save(),false);assert.equal(lost.writes,0);
assert.equal(lost.env.window.__lastSaveFailed,true);cases++;
const clean=boot('');
assert.equal(clean.status().failed,false);
assert.equal(clean.status().snapshot,'');
assert.equal(clean.save(),true);
assert.equal(clean.writes,1);
assert.equal(clean.status().records,0);
assert.equal(JSON.parse(clean.status().snapshot).schema,1);cases++;
const restarted=boot(snapshot);
assert.equal(restarted.status().failed,false);
assert.equal(restarted.status().snapshot,snapshot);
assert.equal(restarted.status().records,1);
exact(JSON.parse(restarted.status().snapshot).records[0]);cases++;
console.log('PASS B16-R2/R3/R4 Node production VM: '+cases+' strict recovery, tombstone, purge, retry and bootstrap scenarios');
