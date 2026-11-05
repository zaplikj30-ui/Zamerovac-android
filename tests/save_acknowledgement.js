'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
let disk='',fail=false,notices=[],serial=0;
const seed={schema:1,records:[{id:'photo',rev:'one',title:'Synthetic',items:[{measure:'1250,000000123456789',unit:'mm'}]}],prefs:{}};
const context={window:{},native:true,uid:()=>`conflict-${++serial}`,notify:s=>notices.push(s),initial:seed,prefs:{},current:null,noteActive:null,dataLoadFailed:false,state:structuredClone(seed),persistedSnapshot:JSON.stringify(seed),Native:{saveDataChecked(text,expected){if(fail)return JSON.stringify({ok:false,error:'disk full'});if(disk!==expected)return JSON.stringify({ok:false,current:disk});disk=text;return '{"ok":true}';},loadData:()=>disk},screen:'browser',showFolder:()=>{}};
disk=context.persistedSnapshot;vm.createContext(context);vm.runInContext(source.slice(source.indexOf('// Three-way reconciliation'),source.indexOf('function notify(')),context);
context.state.records[0].title='local';context.state.records[0].rev='two';
const before=context.persistedSnapshot;fail=true;assert.equal(context.save(),false);assert.equal(context.persistedSnapshot,before);assert.equal(disk,before);assert.match(notices.at(-1),/Neuloženo/);
fail=false;assert.equal(context.save(),true);assert.equal(JSON.parse(disk).records[0].title,'local');
// A concurrent native write and a newer local edit of the same measurement survive together.
const remote=JSON.parse(disk);remote.records[0].rev='remote';remote.records[0].items[0].measure='0,000000000000987654321';disk=JSON.stringify(remote);
context.state.records[0].rev='local-new';context.state.records[0].items[0].measure='999999999,123456789';
assert.equal(context.save(),true);const saved=JSON.parse(disk);assert.equal(saved.records.length,2);assert.deepEqual(saved.records.map(r=>r.items[0].measure).sort(),['0,000000000000987654321','999999999,123456789']);
assert.equal(context.save(),true);assert.equal(JSON.parse(disk).records.length,2,'retry cannot duplicate conflict');
// Delayed callback carries old data, while native storage contains the latest confirmed edits.
const start=source.indexOf('window.onNativeSync=');const end=source.indexOf('\n};',start)+3;context.window={};vm.runInContext(source.slice(start,end),context);
context.window.onNativeSync(JSON.stringify({data:seed,message:'done'}));assert.equal(JSON.parse(disk).records[0].items[0].measure,'999999999,123456789');assert.equal(JSON.parse(disk).records.length,2);
console.log('PASS: rejected write, acknowledgement, exact conflict values, retry and delayed native callback');
