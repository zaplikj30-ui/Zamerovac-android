/* B15: production save() must report a failed, blocked write exactly like other failures.
 * Exercises actual save/error UI, retry action, browser and native CAS paths.
 * No Android or customer data; use test-only memory storage.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const first=app.indexOf('function reportSaveResult(ok){');
const last=app.indexOf('function notify(msg){',first);
assert(first>=0&&last>first,'Production save/error functions missing');
const saved={records:[{id:'photo-1',items:[{id:'dim-1',type:'dimension',measure:'1585,800001',
 laserMeasuredMm:'1585.800001',unit:'mm',a:{x:1.125,y:2},b:{x:3,y:4},media:['original-photo']}],
 media:['original-photo'],kind:'photo'}],prefs:{},syncProtocol:2};
const state=JSON.parse(JSON.stringify(saved)),snap=JSON.stringify(saved);
let disk=snap,browserWrites=0,nativeWrites=0,failNative=false;
const nodes=new Map();
function makeElement(tag){
 return {tag,attributes:{},children:[],setAttribute(name,value){this.attributes[name]=value},
  append(...items){this.children.push(...items)},
  remove(){nodes.delete(this.id);this.removed=true}};
}
const document={createElement:makeElement,body:{append(element){nodes.set(element.id,element)}}};
const env={state,initial:saved,dataLoadFailed:true,native:false,
 window:{__lastSaveFailed:false},document,persistedSnapshot:snap,
 localStorage:{setItem(key,value){assert.equal(key,'zamerovac-data');browserWrites++;disk=value}},
 Native:{saveDataChecked(payload,expected){
  nativeWrites++;
  assert.equal(expected,env.persistedSnapshot,'Native CAS must use exact last snapshot');
  if(failNative)throw Error('native disk-full');
  disk=payload;return JSON.stringify({ok:true});
 }},
 notify(message){env.message=message},
 $:id=>nodes.get(id)||null
};
vm.createContext(env);vm.runInContext(app.slice(first,last),env);
function failedBanner(){
 const banner=nodes.get('saveErrorBanner');
 assert(banner,'Failed save needs persistent alert banner');
 assert.equal(banner.attributes.role,'alert');
 assert.match(banner.children[0].textContent,/Změny nejsou uložené/);
 return banner;
}
const originalState=JSON.stringify(env.state);
assert.equal(env.save(),false,'Blocked data-load must refuse saving');
assert.equal(browserWrites,0,'Blocked load reached browser storage');
assert.equal(nativeWrites,0,'Blocked load reached native storage');
assert.equal(disk,snap,'Blocked load changed last persisted data');
assert.equal(JSON.stringify(env.state),originalState,'Blocked load changed live data');
assert.equal(env.window.__lastSaveFailed,true,'Blocked load did not set unsaved flag');
assert.match(env.message,/Zakázky nelze načíst/);
const firstBanner=failedBanner();
assert.equal(firstBanner.children[1].textContent,'Zkusit uložit znovu');
firstBanner.children[1].onclick();
assert.equal(browserWrites,0,'Retry must remain blocked while load is failed');
assert.equal(nodes.get('saveErrorBanner'),firstBanner,'Blocked retry removed warning');
env.dataLoadFailed=false;
firstBanner.children[1].onclick();
assert.equal(browserWrites,1,'Fixed load should allow exactly one retry write');
assert.equal(env.window.__lastSaveFailed,false,'Successful retry did not clear unsaved flag');
assert.equal(nodes.has('saveErrorBanner'),false,'Successful retry left failure banner');
assert.equal(disk,snap,'Unmodified browser retry changed exact data');

// Native path uses CAS; an unsuccessful I/O response cannot be acknowledged.
env.native=true;env.dataLoadFailed=true;
env.state.records[0].items[0].measure='1585,800002';
env.state.records[0].items[0].laserMeasuredMm='1585.800002';
const newState=JSON.stringify(env.state),confirmed=disk;
assert.equal(env.save(),false);
assert.equal(nativeWrites,0,'Blocked load reached native CAS');
assert.equal(disk,confirmed,'Blocked native write changed disk');
assert.equal(JSON.stringify(env.state),newState,'Blocked write discarded unsaved precision');
assert.equal(env.window.__lastSaveFailed,true);
const secondBanner=failedBanner();
env.dataLoadFailed=false;failNative=true;
secondBanner.children[1].onclick();
assert.equal(nativeWrites,1,'Native retry did not reach CAS');
assert.equal(disk,confirmed,'Failed native CAS changed persisted data');
assert.equal(env.window.__lastSaveFailed,true,'Failed native CAS reported success');
assert.equal(nodes.get('saveErrorBanner'),secondBanner,'Failed native retry hid warning');
assert.match(env.message,/Neuloženo/);
failNative=false;secondBanner.children[1].onclick();
assert.equal(nativeWrites,2);
assert.equal(nodes.has('saveErrorBanner'),false);
assert.equal(env.window.__lastSaveFailed,false);
assert.equal(JSON.stringify(JSON.parse(disk)),newState,'Successful native retry changed JSON values');
assert.equal(JSON.parse(disk).records[0].items[0].laserMeasuredMm,'1585.800002');
assert.deepEqual(JSON.parse(disk).records[0].media,['original-photo']);
assert.equal(env.persistedSnapshot,disk);
assert.equal(JSON.stringify(env.state),newState);
console.log('PASS B15: blocked-load/save flags and banner, real retry, native CAS failure, exact values and media');
