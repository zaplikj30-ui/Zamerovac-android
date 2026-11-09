'use strict';
// B16-R1: test the actual production reconcile/apply/save functions (no stubs).
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const begin=app.indexOf('function checkedSyncClock'),end=app.indexOf('function notify(',begin);
assert(begin>=0&&end>begin);
const id='11111111-1111-4111-8111-111111111111',base={schema:1,syncProtocol:2,prefs:{unit:'mm'},records:[{
 id:'photo-1',rev:'base',kind:'photo',syncClock:{[id]:1},media:['original-image-id'],
 items:[{id:'dim-1',measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]
}]},snapshot=JSON.stringify(base);
let scenarios=0;
function create(handler,seed=base){
 const env={native:true,syncDeviceId:id,window:{},state:structuredClone(seed),persistedSnapshot:JSON.stringify(seed),
   initial:seed,prefs:seed.prefs,current:null,noteActive:null,screen:'browser',dataLoadFailed:false,
   uid:()=> 'native-copy-id',notices:[],calls:[],notify(message){env.notices.push(message)},
   Native:{
    saveDataChecked(text,expected){env.calls.push({text,expected});return handler(text,expected,env)},
    resolveSyncConflict(local,remote){return JSON.stringify({winner:'local',copy:{...JSON.parse(remote),id:'native-copy-id',conflictSource:'remote-change'}})}
   }};
 vm.createContext(env);vm.runInContext(app.slice(begin,end),env);return env;
}
function rejected(env,original=snapshot){
 assert.equal(env.save(),false);assert.equal(JSON.stringify(env.state),original,'live draft modified');
 assert.equal(env.persistedSnapshot,snapshot,'confirmed snapshot changed');
 assert.equal(env.window.__lastSaveFailed,true,'false saved acknowledgement');
 assert.match(env.notices.at(-1),/^Neuloženo:/);scenarios++;
}
// Missing / unreadable native DB must not become a synthetic empty valid DB.
let missing=create(()=>JSON.stringify({ok:false,error:'Database unavailable'}));
rejected(missing);assert.equal(missing.calls.length,1);
// Guard even a legacy Android bridge that sends a synthetic empty response.
let oldBridge=create(()=>JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:[]})}));
rejected(oldBridge);assert.equal(oldBridge.calls.length,1);
let unproven=create(()=>JSON.stringify({ok:false,current:JSON.stringify({
 schema:1,records:[],trashPurgedIds:['different-id'],syncTombstones:{'different-id':{}}
})}));
rejected(unproven);
// Even a partly missing remote database may not silently drop an untouched photo.
let partial=create(()=>JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:[{id:'unrelated'}]})}));
rejected(partial);
// A real native purge records BOTH durable evidence fields; allow its zero records.
let empty=JSON.stringify({schema:1,records:[],trashPurgedIds:['photo-1'],syncTombstones:{'photo-1':{[id]:2}}});
let authorized=create((text,expected)=>{if(expected!==empty)return JSON.stringify({ok:false,current:empty});empty=text;return JSON.stringify({ok:true})});
assert.equal(authorized.save(),true);assert.equal(authorized.state.records.length,0);
assert.equal(authorized.persistedSnapshot,empty);assert.equal(authorized.save(),true);
assert.equal(authorized.state.records.length,0);scenarios++;
// Old imported photos may have no clock: an unchanged legacy record is not
// an unsaved new edit and must not resurrect after a legitimate trash purge.
let legacy=structuredClone(base);delete legacy.records[0].syncClock;
let legacyDisk=JSON.stringify({schema:1,records:[],trashPurgedIds:['photo-1'],syncTombstones:{'photo-1':{[id]:2}}});
let legacyPurge=create((text,expected)=>{if(expected!==legacyDisk)return JSON.stringify({ok:false,current:legacyDisk});legacyDisk=text;return JSON.stringify({ok:true})},legacy);
assert.equal(legacyPurge.save(),true);assert.equal(legacyPurge.state.records.length,0);
assert.equal(legacyPurge.persistedSnapshot,legacyDisk);scenarios++;
// Valid native same-record conflict, then disk-full on retry: absolutely no
// intermediate mutation, even if the merge created a native conflict copy.
let remote=structuredClone(base);remote.records[0].rev='remote';
remote.records[0].items[0].measure='0,000000000000987654321';
let onDisk=JSON.stringify(remote);
let rejectWrite=true;
let retryFails=create((text,expected)=>{
 if(expected!==onDisk)return JSON.stringify({ok:false,current:onDisk});
 if(rejectWrite)return JSON.stringify({ok:false,error:'disk full'});
 onDisk=text;return JSON.stringify({ok:true});
});
retryFails.state.records[0].rev='local';
retryFails.state.records[0].items[0].measure='999999999,123456789';
const draft=JSON.stringify(retryFails.state);
rejected(retryFails,draft);assert.equal(retryFails.calls.length,2);
// Repeat on the SAME live draft after the I/O fault is cleared.
rejectWrite=false;
assert.equal(retryFails.save(),true);assert.equal(retryFails.state.records.length,2);
assert.equal(retryFails.persistedSnapshot,onDisk);
assert.deepEqual(JSON.parse(onDisk).records.map(r=>r.media),[['original-image-id'],['original-image-id']]);
assert.equal(retryFails.save(),true);assert.equal(JSON.parse(onDisk).records.length,2);
scenarios++;
// After the original native snapshot is restored, its exact media survives.
let disk=snapshot;
let restored=create((text,expected)=>{if(expected!==disk)return JSON.stringify({ok:false,current:disk});disk=text;return JSON.stringify({ok:true})});
assert.equal(restored.save(),true);assert.equal(restored.persistedSnapshot,disk);
assert.equal(JSON.parse(disk).records[0].items[0].laserMeasuredMm,'1585.800001234567890');
assert.deepEqual(JSON.parse(disk).records[0].media,['original-image-id']);scenarios++;
// Real reconcile plus native resolver: preserve both exact records and photos.
disk=onDisk;
let collision=create((text,expected)=>{if(expected!==disk)return JSON.stringify({ok:false,current:disk});disk=text;return JSON.stringify({ok:true})});
collision.state.records[0].rev='local';
collision.state.records[0].items[0].measure='999999999,123456789';
assert.equal(collision.save(),true);assert.equal(collision.calls.length,2);
assert.equal(collision.state.records.length,2);assert.equal(collision.state.records[1].id,'native-copy-id');
assert.deepEqual(JSON.parse(disk).records.map(r=>r.items[0].measure).sort(),
 ['0,000000000000987654321','999999999,123456789']);
assert.deepEqual(JSON.parse(disk).records.map(r=>r.media),[['original-image-id'],['original-image-id']]);
assert.equal(collision.save(),true);assert.equal(JSON.parse(disk).records.length,2);scenarios++;
console.log('PASS B16-R1: '+scenarios+' native CAS / true merge / no phantom purge / retry / exact media scenarios');
