/* Regression: a rejected native CAS cannot leave a new folder/photo/note
 * in the working tree, where a later unrelated save could silently commit it.
 * Run actual production functions in a Node VM; only Native IO and DOM are fakes.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(first,last){
 const i=source.indexOf(first),j=source.indexOf(last,i);
 assert(i>=0&&j>i,'Missing production boundary '+first);
 return source.slice(i,j);
}
const logic=[
 extract('function touch(rec){','function reportSaveResult(ok){'),
 extract('function reportSaveResult(ok){','function notify(msg){'),
 extract('function recById(id,includeDeleted=false){','function folderContains('),
 extract('function newRecord(kind,title,parentId=currentFolder){','let modalFocusTimer=null;'),
 extract('function promptText(','// ImageMeter-style browser previews.'),
 extract('// #194: session-only last confirmed add action.','function pickMedia('),
 extract('async function addMediaRecord(','async function storeMedia(')
].join('\n');

async function run(kind,confirmed){
 const baseline={schema:1,prefs:{},syncProtocol:2,records:[{
  id:'old-photo',kind:'photo',parentId:null,rev:'original-revision',
  deleted:false,syncClock:{},media:['raw-original-id'],
  items:[{measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]
 }]};
 let uidCounter=0,saveCalls=0,openNoteCalls=0,openEditorCalls=0,folderRenders=0;
 let dialog=null,buttons=[],disk=JSON.stringify(baseline),failNotice=[];
 const env={state:JSON.parse(JSON.stringify(baseline)),
  initial:JSON.parse(JSON.stringify(baseline)),prefs:{},persistedSnapshot:disk,
  dataLoadFailed:false,native:true,window:{},current:null,noteActive:null,
  syncDeviceId:'00000000-0000-4000-8000-000000000001',screen:'browser',currentFolder:null,
  uid:()=>String(++uidCounter).padStart(8,'0'),stamp:()=>'2026-11-10',
  notify:message=>failNotice.push(message),escapeHtml:String,document:undefined,
  openNote:()=>{openNoteCalls++},openEditor:()=>{openEditorCalls++},
  showFolder:()=>{folderRenders++},pickMedia:()=>{},recordVoice:()=>{},
  modal:(title,markup,callback)=>{dialog=callback},
  $:id=>id==='promptValue'?{value:'Nová složka'}:
    id==='newMenu'?{hidden:true,querySelectorAll:()=>buttons}:
    id==='galleryBtn'?{hidden:true,textContent:'',setAttribute(){} }:
    {hidden:true},
  Native:{saveDataChecked(payload,expected){
    saveCalls++;
    assert.equal(expected,env.persistedSnapshot);
    if(!confirmed)return JSON.stringify({ok:false,error:'synthetic disk full'});
    disk=payload;return JSON.stringify({ok:true});
  }}
 };
 vm.createContext(env);
 vm.runInContext(logic,env);
 let result;
 if(kind==='folder')result=env.addRecord(env.newRecord('folder','Nová složka'));
 else if(kind==='photo')result=await env.addMediaRecord('raw-new-photo-id','Foto','image/jpeg');
 else if(kind==='prompt'){
  env.promptText('Nová složka','Jméno','',value=>env.addRecord(env.newRecord('folder',value)));
  result=dialog();
 }else if(kind==='note'){
  buttons=Array.from({length:7},(_,i)=>({dataset:{i:String(i)}}));
  env.showNewMenu();buttons[3].onclick();
 }
 const added=env.state.records.filter(item=>item.id!=='old-photo');
 const persisted=JSON.parse(env.persistedSnapshot).records.filter(item=>item.id!=='old-photo');
 assert.equal(saveCalls,1,'Case '+kind+'/'+confirmed+' notices='+failNotice.join(';'));
 assert.equal(added.length,confirmed?1:0,'A rejected save left a ghost record in memory');
 assert.equal(persisted.length,confirmed?1:0,'A rejected save promoted a ghost record');
 assert.equal(env.state.records[0].items[0].measure,'1585,800001234567890');
 assert.equal(env.state.records[0].items[0].laserMeasuredMm,'1585.800001234567890');
 assert.equal(env.state.records[0].media[0],'raw-original-id');
 if(kind==='folder'||kind==='prompt'){
  assert.equal(confirmed?result?.kind:'failed',confirmed?'folder':'failed');
  if(!confirmed)assert.equal(result,false,'Failed new-folder modal must remain open');
 }
 if(kind==='photo'){
  assert.equal(confirmed?result?.kind:null,confirmed?'photo':null);
  if(confirmed)assert.equal(added[0].media[0],'raw-new-photo-id');
 }
 assert.equal(openNoteCalls,confirmed&&kind==='note'?1:0);
 assert.equal(openEditorCalls,confirmed&&kind==='photo'?1:0);
 assert.equal(folderRenders,confirmed&&(kind==='folder'||kind==='prompt')?1:0,'Photo opens the editor without a redundant list redraw');
 if(!confirmed){
  assert.equal(env.window.__lastSaveFailed,true);
  assert.equal(disk,JSON.stringify(baseline));
  assert(failNotice.some(s=>s.includes('Neuloženo')));
  // Even when an unrelated later save succeeds, the rejected record stays absent.
  env.Native.saveDataChecked=(payload,expected)=>{
   assert.equal(expected,env.persistedSnapshot);disk=payload;return JSON.stringify({ok:true});
  };
  assert.equal(env.save(),true);
  assert.equal(JSON.parse(disk).records.length,1,'Later save silently committed rejected record');
 }else{
  assert.equal(env.window.__lastSaveFailed,false);
  assert.equal(disk,env.persistedSnapshot);
 }
}
(async()=>{
 for(const kind of ['folder','photo','prompt','note']){
  await run(kind,false);await run(kind,true);
 }
 console.log('PASS: 8 real creation/save cases, no ghost after failed native CAS, exact old data/media');
})().catch(error=>{console.error(error);process.exitCode=1});
