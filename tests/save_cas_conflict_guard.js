/* B16: malformed native compare-and-save responses must never acknowledge a
 * failed write or overwrite precise measurements, metadata, or media IDs.
 * Exercise the production save() function, not a reimplemented copy.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const first=app.indexOf('function reportSaveResult(ok){');
const last=app.indexOf('function notify(msg){',first);
assert(first>=0&&last>first,'Cannot find production save()');
const baseline={schema:1,syncProtocol:2,prefs:{unit:'mm'},records:[{
 id:'photo-1',rev:'base',kind:'photo',title:'Original',media:['original-image'],
 items:[{id:'dim-1',type:'dimension',measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]
}]};
const persisted=JSON.stringify(baseline);
let disk=persisted,reply='',calls=0,merges=0,notifications=[];
const env={state:structuredClone(baseline),initial:baseline,dataLoadFailed:false,native:true,
 persistedSnapshot:persisted,window:{},
 Native:{saveDataChecked(payload,expected){calls++;assert.equal(expected,env.persistedSnapshot);return reply}},
 reconcileSavedState(base,local,remote){
  merges++;
  assert.equal(base.records[0].id,'photo-1');
  assert.equal(local.records[0].items[0].laserMeasuredMm,'1585.800001234567890');
  assert.equal(remote.schema,1);
  return {...local,records:[...local.records,...remote.records.map(r=>({...r,id:'remote-copy'}))]};
 },
 applySavedState(next){env.state=next},notify(message){notifications.push(message)}
};
vm.createContext(env);vm.runInContext(app.slice(first,last),env);
const invalid=[
 ['string acknowledgement',JSON.stringify({ok:'true'})],
 ['numeric acknowledgement',JSON.stringify({ok:1})],
 ['unsupported schema',JSON.stringify({ok:false,current:JSON.stringify({schema:2,records:[]})})],
 ['missing records',JSON.stringify({ok:false,current:JSON.stringify({schema:1})})],
 ['non-array records',JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:{}})})],
 ['null record',JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:[null]})})],
 ['record without ID',JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:[{title:'Unknown'}]})})],
 ['duplicate IDs',JSON.stringify({ok:false,current:JSON.stringify({schema:1,records:[{id:'photo-1'},{id:'photo-1'}]})})],
 ['broken JSON',JSON.stringify({ok:false,current:'{broken'})],
 ['I/O rejection',JSON.stringify({ok:false,error:'Disk full'})]
];
for(const [label,response] of invalid){
 env.state=structuredClone(baseline);env.persistedSnapshot=persisted;env.window.__lastSaveFailed=false;
 disk=persisted;reply=response;calls=0;merges=0;notifications=[];
 assert.equal(env.save(),false,label+' must refuse write');
 assert.equal(calls,1,label+' should not retry an invalid response');
 assert.equal(merges,0,label+' must not merge invalid data');
 assert.equal(env.persistedSnapshot,persisted,label+' changed confirmed snapshot');
 assert.equal(JSON.stringify(env.state),persisted,label+' mutated precise in-memory data');
 assert.equal(disk,persisted,label+' changed persisted media or dimensions');
 assert.equal(env.window.__lastSaveFailed,true,label+' falsely reported saved');
 assert.match(notifications.at(-1),/^Neuloženo:/,label+' failed to notify');
}
// After a valid collision the app can retry and retain both sets of precision.
// Full three-way reconciliation has its own existing contract test.
env.state=structuredClone(baseline);env.persistedSnapshot=persisted;
const remote=structuredClone(baseline);remote.records[0].items[0].laserMeasuredMm='2100.000000000000009';
remote.records[0].items[0].measure='2100,000000000000009';
disk=JSON.stringify(remote);calls=0;merges=0;notifications=[];
env.Native.saveDataChecked=(payload,expected)=>{
 calls++;assert.equal(expected,calls===1?persisted:JSON.stringify(remote));
 if(expected!==disk)return JSON.stringify({ok:false,current:disk});
 disk=payload;return JSON.stringify({ok:true});
};
assert.equal(env.save(),true,'valid CAS conflict must still save');
assert.equal(calls,2,'valid conflict should merge then retry once');
assert.equal(merges,1);
assert.equal(env.window.__lastSaveFailed,false);
const saved=JSON.parse(disk);
assert.deepEqual(saved.records.map(r=>r.items[0].laserMeasuredMm).sort(),
 ['1585.800001234567890','2100.000000000000009']);
assert.deepEqual(saved.records.map(r=>r.media),[['original-image'],['original-image']]);
assert.equal(env.persistedSnapshot,disk);
console.log('PASS B16: '+invalid.length+' fail-closed native CAS responses, valid retry, exact dimensions and media');
