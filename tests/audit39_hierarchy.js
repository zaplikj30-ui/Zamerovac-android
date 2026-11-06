'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8'),fixtures=JSON.parse(fs.readFileSync('app/src/test/resources/audit39-hierarchy.json'));
const context={prefs:{},native:false,window:{},syncDeviceId:'11111111-1111-4111-8111-111111111111',uid:()=>{throw Error('Unexpected conflict copy')}};
vm.createContext(context);vm.runInContext(source.slice(source.indexOf('function checkedSyncClock'),source.indexOf('function reportSaveResult')),context);
for(const fixture of fixtures){
 const input=structuredClone(fixture.records),before=JSON.stringify(input);
 const repaired=context.repairFolderHierarchy(input);
 assert.deepEqual(JSON.parse(JSON.stringify(repaired)),fixture.expected,fixture.name);
 assert.equal(before,JSON.stringify(fixture.records),'fixture payload unchanged');
 const wrap=records=>({schema:1,records});
 for(const records of [fixture.records,[...fixture.records].reverse()]){
  const result=context.reconcileSavedState(wrap([]),wrap(records),wrap(fixture.expected));
  assert.equal(result.records.length,fixture.expected.length,'repeated repair cannot multiply records');
  assert.deepEqual(JSON.parse(JSON.stringify(result.records)).sort((a,b)=>a.id.localeCompare(b.id)),fixture.expected);
 }
}
const base={schema:1,records:fixtures[0].records.map(r=>({...r,parentId:null}))};
const local=structuredClone(base),remote=structuredClone(base);local.records[0].parentId='folder-b';remote.records[1].parentId='folder-a';
for(const [a,b] of [[local,remote],[remote,local]])assert.deepEqual(JSON.parse(JSON.stringify(context.reconcileSavedState(base,a,b).records)),fixtures[0].expected);
assert.match(source,/OPRAVENÝ CYKLUS SLOŽEK/,'repair is visible in browser');
console.log('PASS A39-03: shared Java/JS hierarchy fixtures, offline CAS moves, stable repeat and exact values');

(async()=>{const protocol=require('../sync/protocol-v2'),crypto=require('node:crypto'),hash=async bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
 for(const fixture of fixtures){const original={schema:1,records:fixture.records},fixed=await protocol.mergeData(original,{schema:1,records:[]},hash);assert.deepEqual(fixed.records,fixture.expected);
  for(const [a,b] of [[original,fixed],[fixed,original]])assert.deepEqual((await protocol.mergeData(a,b,hash)).records,fixture.expected);
 }
 console.log('PASS A39-03: transport-neutral JS merge follows the same hierarchy contract');
})().catch(error=>{console.error(error);process.exitCode=1});
