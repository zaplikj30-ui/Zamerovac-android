/* #197 permanent Node VM regression: real browser action / recording UI logic
 * with deterministic Native CAS, microphone and journal fakes.
 * Hardware/permissions dialog, actual original audio bytes and Android lifecycle
 * are NOT proved by these synthetic tests.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(start,end){
 const i=src.indexOf(start),j=src.indexOf(end,i);
 assert(i>=0&&j>i,'Production boundary missing: '+start);
 return src.slice(i,j);
}
const production=[
 extract('function reportSaveResult(ok){','function notify(msg){'),
 extract('function recById(id,includeDeleted=false){','function folderContains('),
 extract('function newRecord(kind,title,parentId=currentFolder){','let modalFocusTimer=null;'),
 extract('function showNewMenu(){','function pickMedia('),
 extract('const noteViewBaselines=new WeakMap();','function renderChecks(){'),
 extract('function saveNote(){','function finishNoteRecording(){'),
 extract('function finishNoteRecording(){',"$('createBtn')")
].join('\n');
const oldPhoto={id:'photo-old',kind:'photo',parentId:'folder-main',rev:'original',
 deleted:false,media:['immutable-photo-bytes-id'],items:[{
  measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'
 }]};
const folder={id:'folder-main',kind:'folder',parentId:null,rev:'original-folder',deleted:false};
const baseline={schema:1,syncProtocol:2,prefs:{},records:[oldPhoto,folder]};
function scene(options={}){
 const dom=new Map(),notice=[],menuButtons=Array.from({length:8},(_,i)=>({dataset:{i:String(i)}}));
 let disk=JSON.stringify(options.data||baseline),writes=0,starts=0,stops=0,retained=0,
  failWrites=0,locked=!!options.locked,uidCount=0,folderRenders=0;
 function element(id){
  if(!dom.has(id)){
   dom.set(id,{id,hidden:true,textContent:'',value:'',dataset:{},
    classList:{add(){},remove(){}},setAttribute(){},append(){},
    remove(){dom.delete(id)},querySelectorAll(){return id==='newMenu'?menuButtons:[]}
   });
  }
  return dom.get(id);
 }
 const document={
  body:{classList:{add(){},remove(){}},append(){}},
  createElement(tag){return {tag,setAttribute(){},append(){},classList:{add(){},remove(){}}}},
  getElementById:element
 };
 const env={
  document,$:element,window:{isRecordLocked:()=>locked,
   PendingAudio:{saved(){},retained(){retained++}}},
  native:true,currentFolder:Object.hasOwn(options,'currentFolder')?options.currentFolder:'folder-main',
  current:null,noteActive:null,screen:'browser',state:JSON.parse(disk),
  initial:JSON.parse(JSON.stringify(baseline)),dataLoadFailed:false,
  persistedSnapshot:disk,syncDeviceId:'00000000-0000-4000-8000-000000000001',
  uid:()=>('generated-'+(++uidCount)),stamp:()=> '2026-11-18',
  advanceSyncClock:()=>({'00000000-0000-4000-8000-000000000001':1}),
  touch(r){r.rev='new-rev-'+(++uidCount);r.updatedAt='2026-11-18';r.syncClock={'00000000-0000-4000-8000-000000000001':uidCount}},
  notify:message=>notice.push(message),canonicalSavedValue:r=>JSON.stringify(r),
  renderChecks(){},renderNoteAttachments(){},
  showFolder(){folderRenders++},pickMedia(){},
  Native:{
   saveDataChecked(payload,expected){
    writes++;assert.equal(expected,env.persistedSnapshot,'CAS expected snapshot changed');
    if(failWrites>0){failWrites--;return JSON.stringify({ok:false,error:'synthetic disk full'})}
    disk=payload;return JSON.stringify({ok:true,pendingAudioCount:0})
   },
   startAudio(){starts++;return options.startWorks!==false},
   stopAudio(){stops++;return options.stopWorks!==false}
  }
 };
 vm.createContext(env);vm.runInContext(production,env,{filename:'production-voice-note.js'});
 function openVoice(){
  env.showNewMenu();
  if(!locked){assert(menuButtons[5].onclick,'Hlasová poznámka missing in + menu');menuButtons[5].onclick()}
 }
 return {env,notice,dom,openVoice,element,
  set failWrites(n){failWrites=n},set locked(value){locked=value},
  get disk(){return JSON.parse(disk)},get rawDisk(){return disk},
  get writes(){return writes},get starts(){return starts},get stops(){return stops},
  get retained(){return retained},get folderRenders(){return folderRenders}
 };
}
function voiceNotes(s){return s.env.state.records.filter(r=>r.kind==='note')}
function assertOldPhoto(s){
 const photo=s.env.state.records.find(r=>r.id==='photo-old');
 assert.equal(photo.media[0],'immutable-photo-bytes-id');
 assert.equal(photo.items[0].measure,'1585,800001234567890');
 assert.equal(photo.items[0].laserMeasuredMm,'1585.800001234567890');
}
{
 const s=scene();s.openVoice();
 assert.equal(voiceNotes(s).length,1,'+ must create exactly one standalone voice note');
 assert.equal(voiceNotes(s)[0].parentId,'folder-main','wrong folder');
 assert.equal(s.env.noteActive,voiceNotes(s)[0],'new note was not opened');
 assert.equal(s.starts,0,'voice started automatically');
 assert.match(s.element('recordAudio').textContent,/Spustit/);
 assert.equal(s.disk.records.filter(r=>r.kind==='note').length,1,'note not durably saved');
 s.element('recordAudio').onclick();
 assert.equal(s.starts,1);assert(s.env.window.recording,'microphone did not start');
 assert.match(s.element('recordAudio').textContent,/Zastavit/);
 s.element('recordAudio').onclick();
 assert.equal(s.stops,1);assert.equal(voiceNotes(s)[0].media.length,1);
 const audioId=voiceNotes(s)[0].media[0];
 assert.equal(s.disk.records.find(r=>r.kind==='note').media[0],audioId);
 assert.match(s.element('recordAudio').textContent,/Spustit/);
 s.element('saveNote').onclick();
 assert.equal(s.env.noteActive,null,'Uložit did not close note');
 assert.equal(s.disk.records.filter(r=>r.kind==='note').length,1,'duplicate after save');
 const restarted=scene({data:s.disk});
 assert.equal(voiceNotes(restarted)[0].media[0],audioId,'restart lost audio reference');
 restarted.env.openNote(voiceNotes(restarted)[0]);
 assert.match(restarted.element('recordAudio').textContent,/Spustit/);
 assertOldPhoto(s);assertOldPhoto(restarted);
}
{
 const s=scene({currentFolder:null});s.openVoice();
 assert.equal(voiceNotes(s).length,1);
 assert.equal(voiceNotes(s)[0].parentId,null,'root insertion went to stale folder');
}
{
 const s=scene({locked:true});s.openVoice();
 assert.equal(voiceNotes(s).length,0,'locked folder created note');
 assert.equal(s.starts,0);
 assert(s.notice.some(x=>/odemkn/.test(x)),'locked folder needs explanation');
}
{
 const s=scene();s.failWrites=1;s.openVoice();
 assert.equal(voiceNotes(s).length,0,'CAS refusal left phantom new note');
 assert.equal(s.disk.records.length,2,'CAS refusal changed durable data');
 assert.equal(s.env.noteActive,null,'rejected note opened');
 assert.equal(s.starts,0);
 assert.equal(s.env.save(),true);
 assert.equal(s.disk.records.length,2,'later save silently wrote phantom');
 assertOldPhoto(s);
}
{
 const s=scene({startWorks:false});s.openVoice();s.element('recordAudio').onclick();
 assert.equal(s.starts,1);assert.equal(s.stops,0);
 assert(!s.env.window.recording,'denied microphone should not indicate recording');
 s.env.window.__audioPermissionDenied();
 assert(s.notice.some(x=>/Mikrofon není povolen/.test(x)),'permission denied not explained');
 assert.equal(voiceNotes(s)[0].media.length,0);
}
{
 const s=scene({stopWorks:false});s.openVoice();s.element('recordAudio').onclick();
 s.element('recordAudio').onclick();
 assert.equal(s.stops,1);assert.equal(s.retained,1,'failed stop must retain journal warning');
 assert.equal(voiceNotes(s)[0].media.length,0,'failed stop attached broken recording');
 assert(!s.env.window.recording);
}
{
 const s=scene();s.openVoice();s.element('recordAudio').onclick();
 s.failWrites=1;s.element('recordAudio').onclick();
 assert.equal(s.retained,1,'CAS failure must retain completed raw audio');
 assert.equal(voiceNotes(s)[0].media.length,0,'CAS refusal left ghost audio in memory');
 assert.equal(s.disk.records.find(r=>r.kind==='note').media.length,0);
 assert.equal(s.env.save(),true);
 assert.equal(s.disk.records.find(r=>r.kind==='note').media.length,0,'later save committed rejected audio');
 assertOldPhoto(s);
}
{
 const seeded=JSON.parse(JSON.stringify(baseline));
 seeded.records.push({id:'existing-note',kind:'note',parentId:'folder-main',
  title:'Textová poznámka',text:'Původní',checks:[],media:[],rev:'old',deleted:false});
 const s=scene({data:seeded});const original=s.env.state.records.find(r=>r.id==='existing-note');
 s.env.openNote(original);s.element('recordAudio').onclick();
 s.element('recordAudio').onclick();
 assert.equal(voiceNotes(s).length,1,'recording in an open note created another note');
 assert.equal(original.media.length,1,'existing note lost recording');
 assert.equal(s.disk.records.find(r=>r.id==='existing-note').media[0],original.media[0]);
}
console.log('PASS #197: menu/folder/root, explicit start-stop-save, restart, lock, denied mic, failed stop/CAS, original media/precision, existing note');