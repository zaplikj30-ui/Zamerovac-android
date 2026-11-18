/* #197: ACK is durability, post-ACK UI failure must not undo committed audio.
 * Runs actual extracted app.js touch/save/finish functions in Node VM.
 * Native CAS, PendingAudio journal and microphone are intentionally synthetic.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function slice(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing actual app.js source: '+start);
 return app.slice(a,b);
}
const production=[
 slice('function touch(rec){','function mergeSyncTombstones('),
 slice('function reportSaveResult(','function save(){'),
 slice('function save(){','function notify('),
 slice('function finishNoteRecording(){','function recordVoice(){')
].join('\n');
const device='00000000-0000-4000-8000-000000000001';
const bytes=[0,255,1,77,80,52,33,128,90];
function scene(mode){
 const owner={id:'note-197',kind:'note',deleted:false,media:['existing-media'],
  syncClock:{[device]:3},rev:'old-rev',updatedAt:'2026-11-18',
  title:'Původní',text:'Původní text'};
 const photo={id:'photo-old',kind:'photo',deleted:false,media:['photo-original'],
  measure:'1585.800001234567890',unit:'mm',
  laserValue:'1585.800001234567890'};
 const state={schema:1,syncProtocol:2,records:[owner,photo]};
 let disk=JSON.stringify(state),calls=0,acks=0,retained=0,refreshed=0;
 let savedCalls=0,failOnce=true,locked=false,alerts=[];
 const journal=new Map([['audio-new',{state:'complete',bytes:[...bytes]}]]);
 const Native={
  stopAudio(){return true},
  saveDataChecked(text,expected){
   calls++;
   if(mode==='pre-refused'&&calls===1)
    return JSON.stringify({ok:false,error:'synthetic full disk'});
   if(mode==='pre-throw'&&calls===1)throw Error('synthetic Native failure');
   if(mode==='bad-conflict'&&calls===1)
    return JSON.stringify({ok:false,current:'{"schema":0,"records":[]}'});
   if(expected!==disk)
    return JSON.stringify({ok:false,current:disk,error:'CAS conflict'});
   disk=text;acks++;return JSON.stringify({ok:true,pendingAudioCount:1});
  }
 };
 const window={recording:'audio-new',__audioPermissionRetry:null,
  isRecordLocked:()=>locked,
  PendingAudio:{
   saved(){savedCalls++;if(mode==='post-throw'&&failOnce){
    failOnce=false;throw Error('synthetic post-ACK PendingAudio.saved exception');
   }},
   retained(){retained++},
   refresh(){refreshed++}
  }};
 const env={state,initial:JSON.parse(disk),persistedSnapshot:disk,native:true,
  dataLoadFailed:false,window,Native,noteActive:owner,noteRecordingOwner:owner,
  syncDeviceId:device,uid:()=> 'new-rev',stamp:()=> '2026-11-18T23:20:00Z',
  notify:message=>alerts.push(message),renderNoteAttachments(){},
  applySavedState(){throw Error('unexpected merge')},
  reconcileSavedState(){throw Error('unexpected conflict reconciliation')},
  $:key=>key==='saveErrorBanner'?
   {remove(){if(mode==='post-report-throw')throw Error('synthetic post-ACK UI exception')}}:
   {textContent:''}
 };
 if(mode==='post-report-throw')env.document={};
 vm.createContext(env);vm.runInContext(production,env,{filename:'app.js original functions'});
 const has=(records)=>records.find(r=>r.id==='note-197').media.filter(id=>id==='audio-new').length;
 const inspect=()=>({
  ram:has(state.records),disk:has(JSON.parse(disk).records),
  snapshot:has(JSON.parse(env.persistedSnapshot).records),
  originalMedia:owner.media.includes('existing-media'),
  photoMedia:JSON.parse(disk).records.find(r=>r.id==='photo-old').media[0],
  precise:JSON.parse(disk).records.find(r=>r.id==='photo-old').measure,
  unit:JSON.parse(disk).records.find(r=>r.id==='photo-old').unit,
  journalBytes:journal.get('audio-new').bytes.join(','),
  journalState:journal.get('audio-new').state,
  acks,calls,savedCalls,retained,refreshed,reportedFail:window.__lastSaveFailed
 });
 return {env,owner,state,inspect,alerts,set locked(v){locked=v},
  removeOwner(){state.records=state.records.filter(r=>r!==owner)}};
}
const completed=[];
function test(label,fn){fn();completed.push(label)}
function originals(s){
 const data=s.inspect();
 assert.equal(data.originalMedia,true);
 assert.equal(data.photoMedia,'photo-original');
 assert.equal(data.precise,'1585.800001234567890');
 assert.equal(data.unit,'mm');
 assert.equal(data.journalBytes,bytes.join(','));
 assert.equal(data.journalState,'complete');
}
test('positive ACK and later save/reload',()=>{
 const s=scene('ok');assert.equal(s.env.finishNoteRecording(),true);
 assert.equal(s.inspect().ram,1);assert.equal(s.inspect().disk,1);
 assert.equal(s.inspect().snapshot,1);
 assert.equal(s.env.save(),true);assert.equal(s.inspect().disk,1);
 assert.equal(s.inspect().acks,2);assert.equal(s.inspect().reportedFail,false);
 originals(s);
});
for(const mode of ['pre-refused','pre-throw','bad-conflict']){
 test('pre-ACK failure '+mode,()=>{
  const s=scene(mode);assert.equal(s.env.finishNoteRecording(),false);
  assert.equal(s.inspect().ram,0);assert.equal(s.inspect().disk,0);
  assert.equal(s.inspect().acks,0);assert.equal(s.inspect().retained,1);
  if(mode!=='bad-conflict'){
   assert.equal(s.env.save(),true);assert.equal(s.inspect().disk,0);
  }
  originals(s);
 });
}
for(const mode of ['post-throw','post-report-throw']){
 test('post-ACK UI fault '+mode+' preserves confirmed ID through later save',()=>{
  const s=scene(mode);assert.equal(s.env.finishNoteRecording(),true);
  const after=s.inspect();
  assert.equal(after.acks,1,'Native durable ACK must have happened');
  assert.equal(after.ram,1,'ACK must not rollback committed RAM media');
  assert.equal(after.disk,1);assert.equal(after.snapshot,1);
  assert.equal(after.reportedFail,false,'Do not claim durable write failed');
  // Immediate reload, unrelated second save, then reload again.
  assert.equal(s.inspect().disk,1);
  assert.equal(s.env.save(),true);
  assert.equal(s.inspect().disk,1);
  assert.equal(s.inspect().ram,1);assert.equal(s.inspect().snapshot,1);
  assert.equal(s.inspect().acks,2);assert.equal(s.inspect().retained,0);
  assert(s.alerts.some(x=>x.includes('Uloženo')||x.includes('uložen')),
   'User must be informed of recoverable presentation error');
  originals(s);
 });
}
for(const mode of ['deleted','locked','replaced']){
 test('stale owner '+mode+' cannot bind or write',()=>{
  const s=scene('ok');
  if(mode==='deleted')s.owner.deleted=true;
  if(mode==='locked')s.locked=true;
  if(mode==='replaced')s.removeOwner();
  assert.equal(s.env.finishNoteRecording(),false);
  const x=s.inspect();
  assert.equal(x.acks,0);assert.equal(x.disk,0);assert.equal(x.retained,1);
  originals(s);
 });
}
console.log('PASS #197 post-ACK durability '+completed.length+'/'+completed.length);