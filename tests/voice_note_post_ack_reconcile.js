/* F3 #197: real save/reconcile/applySavedState/finishNoteRecording source.
 * Native CAS, audio bytes and journal are synthetic; Android is NOT tested.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'production function boundaries '+start);
 return source.slice(a,b);
}
const production=[
 extract('function touch(rec){','function reportSaveResult('),
 extract('function reportSaveResult(','function notify('),
 extract('function finishNoteRecording(){','function recordVoice(){')
].join('\n');
const device='00000000-0000-4000-8000-000000000001';
const bytes=[0,255,1,77,80,52,33,128,90];
const clone=value=>JSON.parse(JSON.stringify(value));
function create(fault){
 const note={id:'note-197',kind:'note',deleted:false,parentId:null,
  media:['existing-audio'],syncClock:{[device]:2},rev:'note-old',
  updatedAt:'2026-11-18',title:'Note'};
 const photo={id:'photo-old',kind:'photo',deleted:false,parentId:null,
  media:['photo-original'],syncClock:{[device]:1},rev:'photo-old-rev',
  updatedAt:'2026-11-18',title:'Original',measure:'1585.800001234567890',
  laserValue:'1585.800001234567890',unit:'mm'};
 const initial={schema:1,syncProtocol:2,records:[clone(note),clone(photo)]};
 const state={...initial,records:[note,photo]};
 let disk=JSON.stringify(initial),calls=0,acks=0,retained=0,saved=0;
 const notifications=[],journal={id:'new-audio',state:'complete',bytes:bytes.slice()};
 const Native={
  stopAudio(){return true},
  saveDataChecked(text,expected){
   calls++;
   if(calls===1){
    if(fault==='bad-current')
     return JSON.stringify({ok:false,current:'{"schema":0,"records":[]}'});
    const newer=JSON.parse(disk);
    newer.records.find(r=>r.id==='photo-old').title='Remote edit';
    newer.records.find(r=>r.id==='photo-old').rev='remote-rev';
    disk=JSON.stringify(newer);
    return JSON.stringify({ok:false,current:disk});
   }
   if(fault==='second-throw'&&calls===2)throw Error('Native second CAS failed');
   assert.equal(expected,disk,'CAS expected snapshot');
   disk=text;acks++;return JSON.stringify({ok:true,pendingAudioCount:1});
  }
 };
 const window={recording:'new-audio',__audioPermissionRetry:null,
  isRecordLocked:()=>false,
  PendingAudio:{saved(){saved++},retained(){retained++},refresh(){}},
  __detailParent:null
 };
 const titleNode={set textContent(value){
  if(fault==='dom-throw')throw Error('Editor title DOM failure after ACK');
 }};
 const env={state,initial,persistedSnapshot:JSON.stringify(initial),prefs:{},
  Native,native:true,dataLoadFailed:false,window,current:photo,noteActive:note,
  noteRecordingOwner:note,screen:'editor',syncDeviceId:device,
  uid:()=> 'new-rev',stamp:()=> '2026-11-19T00:30:00Z',
  document:{createElement:()=>({setAttribute(){},append(){}}),body:{append(){}}},
  $:key=>key==='editorTitle'?titleNode:key==='saveErrorBanner'?
   {remove(){}}:{textContent:''},
  notify:msg=>notifications.push(msg),renderNoteAttachments(){}
 };
 if(fault==='partial-throw'){
  // A live editor object can reject an in-place projection after CAS ACK.
  Object.defineProperty(photo,'title',{value:'Original',writable:false,
   configurable:false,enumerable:true});
 }
 vm.createContext(env);
 vm.runInContext(production,env,{filename:'app.js production F3 functions'});
 const get=()=>({
  ram:env.state.records.find(r=>r.id==='note-197')?.media||[],
  disk:JSON.parse(disk).records.find(r=>r.id==='note-197')?.media||[],
  snapshot:JSON.parse(env.persistedSnapshot).records.find(r=>r.id==='note-197')?.media||[],
  ramPhoto:env.state.records.find(r=>r.id==='photo-old'),
  diskPhoto:JSON.parse(disk).records.find(r=>r.id==='photo-old'),
  snapshotPhoto:JSON.parse(env.persistedSnapshot).records.find(r=>r.id==='photo-old')
 });
 return {env,Native,note,photo,notifications,journal,get,
  get acks(){return acks},get calls(){return calls},
  get retained(){return retained},get saved(){return saved}};
}
const passed=[];
function test(name,fn){fn();passed.push(name)}
function originals(x){
 const a=x.get();
 for(const item of [a.ramPhoto,a.diskPhoto,a.snapshotPhoto]){
  assert.equal(item.measure,'1585.800001234567890');
  assert.equal(item.laserValue,'1585.800001234567890');
  assert.equal(item.unit,'mm');
  assert.deepEqual(Array.from(item.media),['photo-original']);
 }
 assert.deepEqual(x.journal.bytes,bytes);
 assert.equal(x.journal.state,'complete');
}
function committed(x,shouldWarn){
 assert.equal(x.env.finishNoteRecording(),true,
  'confirmed second CAS must not become a failed recording');
 assert.equal(x.calls,2);
 assert.equal(x.acks,1);
 const a=x.get();
 for(const items of [a.ram,a.disk,a.snapshot])
  assert.deepEqual(Array.from(items),['existing-audio','new-audio']);
 for(const photo of [a.ramPhoto,a.diskPhoto,a.snapshotPhoto])
  assert.equal(photo.title,'Remote edit','remote edit must survive reconciliation');
 assert.equal(x.env.window.__lastSaveFailed,false);
 assert.equal(x.retained,0);
 assert.equal(x.env.noteActive,x.env.state.records.find(r=>r.id==='note-197'),
  'live note points to authoritative reconciled record');
 assert.equal(x.env.current,x.env.state.records.find(r=>r.id==='photo-old'),
  'live editor points to authoritative reconciled record');
 if(shouldWarn)assert(x.notifications.some(s=>s.includes('Uloženo')),
  'UI projection failure must be reported');
 originals(x);
 // A subsequent unrelated save must preserve the committed audio reference,
 // original media, remote photo edit, precise measure and journal evidence.
 assert.equal(x.env.save(),true);
 assert.equal(x.acks,2);
 const b=x.get();
 for(const items of [b.ram,b.disk,b.snapshot])
  assert.deepEqual(Array.from(items),['existing-audio','new-audio']);
 originals(x);
}
test('CAS conflict -> successful reconciliation -> ACK',()=>{
 const x=create('normal');committed(x,false);
 assert.equal(x.env.current,x.photo,'healthy reconciliation keeps active editor');
 assert.equal(x.env.noteActive,x.note,'healthy reconciliation keeps live note');
});
test('F3: title DOM throw after ACK',()=>{
 committed(create('dom-throw'),true);
});
test('F3: partial live-object projection throw after ACK',()=>{
 const x=create('partial-throw');committed(x,true);
 assert.notEqual(x.env.current,x.photo,
  'recovery must discard failed partially-mutated editor object');
});
test('second Native CAS throw remains pre-ACK failure',()=>{
 const x=create('second-throw');
 assert.equal(x.env.finishNoteRecording(),false);
 assert.equal(x.acks,0);assert.equal(x.retained,1);
 assert.deepEqual(Array.from(x.get().ram),['existing-audio']);
 assert.deepEqual(Array.from(x.get().disk),['existing-audio']);
 assert.equal(x.get().diskPhoto.title,'Remote edit');
 assert.deepEqual(x.journal.bytes,bytes);
});
test('invalid CAS current stays fail-closed',()=>{
 const x=create('bad-current');
 assert.equal(x.env.finishNoteRecording(),false);
 assert.equal(x.acks,0);assert.equal(x.retained,1);
 assert.deepEqual(Array.from(x.get().ram),['existing-audio']);
 assert.deepEqual(Array.from(x.get().disk),['existing-audio']);
 originals(x);
});
console.log('PASS #197 F3 native-CAS-reconcile '+passed.length+'/'+passed.length);
