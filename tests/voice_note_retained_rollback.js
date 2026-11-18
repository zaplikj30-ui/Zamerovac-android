/* #197 F1/F2: run actual app.js owner, clock and recording-finish logic
 * under Node VM. Native recorder, journal and CAS are synthetic test doubles.
 * Does NOT prove Android microphone or real media bytes.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing production boundary '+start);
 return source.slice(a,b);
}
const product=[
 extract('function touch(rec){','function mergeSyncTombstones('),
 extract('function finishNoteRecording(){','function recordVoice(){')
].join('\n');
const deviceId='00000000-0000-4000-8000-000000000001';
const originalBytes=Uint8Array.from([0,255,1,77,80,52,33,128,90]);
function setup(options={}){
 const parent={id:'folder-197',kind:'folder',deleted:false};
 const existing={id:'photo-old',kind:'photo',parentId:parent.id,deleted:false,
  media:['immutable-photo-id'],items:[{measure:'1585,800001234567890',
   laserMeasuredMm:'1585.800001234567890',unit:'mm'}]};
 const owner={id:'note-197',kind:'note',parentId:parent.id,deleted:false,
  title:'Původní poznámka',media:['existing-attachment-id'],rev:'old-rev',
  updatedAt:'2026-11-18',syncClock:{[deviceId]:options.maxClock?Number.MAX_SAFE_INTEGER:3},
  hierarchyConflict:{parentId:'previous-folder'},text:'Nezměnit'};
 const state={records:[parent,existing,owner]};
 let kept=0,refreshed=0,writes=0,stops=0,visible=false,locked=false;
 let stopSucceeds=options.stopSucceeds!==false;
 const journal=new Map([['audio-new',Uint8Array.from(originalBytes)]]);
 const recordButton={textContent:'■ Zastavit záznam'};
 let savedSnapshot=null;
 const env={state,window:{recording:'audio-new',isRecordLocked:()=>locked,
   PendingAudio:{retained(){kept++;refreshed++;visible=true}}},
  noteActive:owner,noteRecordingOwner:owner,syncDeviceId:deviceId,
  $:()=>recordButton,uid:()=> 'revision-new',stamp:()=> '2026-11-18T23:00:00Z',
  notify(){},renderNoteAttachments(){},
  save(){writes++;savedSnapshot=JSON.stringify(state);return true},
  Native:{stopAudio(){stops++;return stopSucceeds}}
 };
 vm.createContext(env);
 vm.runInContext(product,env,{filename:'pr202-finish-production.js'});
 function assertOriginals(){
  assert.deepEqual([...journal.get('audio-new')],[...originalBytes],'Original audio changed');
  assert.equal(existing.media[0],'immutable-photo-id');
  assert.equal(existing.items[0].measure,'1585,800001234567890');
  assert.equal(existing.items[0].laserMeasuredMm,'1585.800001234567890');
  assert.equal(existing.items[0].unit,'mm');
 }
 function verifyNotAttached(){
  assert(state.records.every(r=>!r.media?.includes('audio-new')),
    'Recording attached to another note or resurrected owner');
  assert.deepEqual([...owner.media],['existing-attachment-id']);
  assertOriginals();
  env.save=()=>{writes++;savedSnapshot=JSON.stringify(state);return true};
  assert.equal(env.save(),true);
  assert(!savedSnapshot.includes('audio-new'),'Later unrelated save published ghost audio ID');
 }
 return {env,owner,state,journal,assertOriginals,verifyNotAttached,
  set locked(v){locked=v},get kept(){return kept},get refreshed(){return refreshed},
  get visible(){return visible},get stops(){return stops},get writes(){return writes}};
}
const checks=[];
function check(name,alter,expectSuccess=false){
 const s=setup();alter(s);
 const before=JSON.parse(JSON.stringify(s.owner));
 const result=s.env.finishNoteRecording();
 assert.equal(result,expectSuccess,name+' wrong result');
 assert.equal(s.stops,1,name+' stop() count');
 assert.equal(s.env.window.recording,null,name+' active flag left behind');
 if(expectSuccess){assert(s.owner.media.includes('audio-new'));
  assert.equal(s.kept,0);s.assertOriginals();}
 else {assert.equal(s.kept,1,name+' recovery alert not issued');
  assert.equal(s.refreshed,1,name+' recovery inventory not refreshed');
  assert.equal(s.visible,true,name+' recovery not visible');
  assert.deepEqual(JSON.parse(JSON.stringify(s.owner)),before,name+' metadata not restored');
  s.verifyNotAttached();}
 checks.push(name);
}
check('F1 deleted owner after start',s=>{s.owner.deleted=true});
check('F1 locked owner after start',s=>{s.locked=true});
check('F1 owner removed after start',s=>{
 s.state.records=s.state.records.filter(r=>r!==s.owner);
});
check('F1 owner object replaced after start',s=>{
 s.state.records=s.state.records.map(r=>r===s.owner?
  {...s.owner,media:['existing-attachment-id'],rev:'newer-remote'}:r);
});
check('F1 owner changed kind after start',s=>{s.owner.kind='file'});
check('F2 MAX_SAFE_INTEGER clock validation',s=>{
 s.owner.syncClock[deviceId]=Number.MAX_SAFE_INTEGER;
});
check('F2 exception after clock and revision changes',s=>{
 s.env.stamp=()=>{throw Error('injected timestamp failure inside touch')};
});
check('F2 exception after partial clock change',s=>{
 s.env.uid=()=>{throw Error('injected revision allocation inside touch')};
});
check('F2 save() returns false',s=>{
 s.env.save=()=>false;
});
check('F2 save() throws after touch()',s=>{
 s.env.save=()=>{throw Error('injected CAS exception')};
});
check('F2 success leaves original unrelated records intact',()=>{},true);
console.log('PASS #197 F1/F2 Node VM '+checks.length+'/'+checks.length+
 ' owner loss, retained journal, exception rollback, MAX_SAFE_INTEGER, later-save ghost and originals');
