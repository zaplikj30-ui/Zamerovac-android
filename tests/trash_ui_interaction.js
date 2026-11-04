/* Run the real native-result UI path: active editor objects must keep their identity. */
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8');
const code=src.slice(src.indexOf('let trashBusy=false;'),src.indexOf('function confirmTrashPurge('));
const active={id:'active',items:[{measure:'100,000000123',unit:'in'}]},note={id:'note',text:'rozepsaná poznámka'},gone={id:'gone',deleted:true};
const elements={okModal:{disabled:false}},messages=[];
let calls=0,folders=0,trash=0;
const env={native:true,dataLoadFailed:false,persistedSnapshot:'last-disk-snapshot',state:{schema:1,records:[active,note,gone]},prefs:{},screen:'editor',
 Native:{purgeTrash(expected,desired,ids){calls++;assert.equal(expected,'last-disk-snapshot');assert.deepEqual(JSON.parse(ids),['gone']);const data=JSON.parse(desired);data.records=data.records.filter(r=>!r.deleted);return JSON.stringify({data,snapshot:JSON.stringify(data),pending:0})}},
 $:id=>elements[id],notify:m=>messages.push(m),showFolder:()=>folders++,showTrash:()=>trash++};
vm.createContext(env);vm.runInContext(code,env);
env.purgeTrashRecords(['gone']);
assert.equal(calls,1);assert.equal(folders,0);assert.equal(trash,1);
assert.equal(env.state.records[0],active);assert.equal(env.state.records[1],note);
active.items.push({measure:'999,000123',unit:'mm'});note.text+=' pokračování';
assert.equal(JSON.parse(JSON.stringify(env.state)).records[0].items.length,2);
assert.equal(env.state.records[1].text,'rozepsaná poznámka pokračování');
assert.equal(elements.okModal.disabled,false);
// Native failure must retain the whole current state and the last known disk snapshot.
const before=env.state,snapshot=env.persistedSnapshot;
env.Native.purgeTrash=()=>JSON.stringify({error:'Concurrent database change'});
env.purgeTrashRecords([]);assert.equal(env.state,before);assert.equal(env.persistedSnapshot,snapshot);
assert(messages.at(-1).includes('Concurrent database change'));
// Simulated reentrant tap cannot start a second purge while the first native call is pending.
env.Native.purgeTrash=()=>{env.purgeTrashRecords([]);return JSON.stringify({error:'failed once'})};
env.purgeTrashRecords([]);assert.equal(elements.okModal.disabled,false);
console.log('OK: native purge preserves live editor/note references, exact values, stale-snapshot errors and repeated taps');
