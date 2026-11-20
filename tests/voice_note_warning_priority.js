/* #197: real recordVoice() must preserve an important post-ACK warning.
 * Actual app.js recordVoice/finishNoteRecording/save/notify; synthetic Native
 * CAS, bytes and journal. Never a physical Android audio test.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(a,b){
 const start=app.indexOf(a),end=app.indexOf(b,start+a.length);
 assert(start>=0&&end>start,'production function not found: '+a);
 return app.slice(start,end);
}
const production=[
 extract('function touch(rec){','function reportSaveResult('),
 extract('function reportSaveResult(','function dateText('),
 extract('function finishNoteRecording(){','function recordVoice(){'),
 extract('function recordVoice(){',"\n$('createBtn').onclick=showNewMenu")
].join('\n');
const device='00000000-0000-4000-8000-000000000001';
const originalBytes=[0,255,1,77,80,52,33,128,90];
function scene(mode){
 const owner={id:'note-197',kind:'note',deleted:false,parentId:null,
  media:['existing-audio'],syncClock:{[device]:2},rev:'old-rev',
  updatedAt:'2026-11-18',title:'Original'};
 const photo={id:'photo',kind:'photo',deleted:false,parentId:null,
  media:['photo-original'],unit:'mm',value:'1585.800001234567890'};
 const state={schema:1,syncProtocol:2,records:[owner,photo]};
 let disk=JSON.stringify(state),acks=0,writes=0,savedCalls=0,retained=0;
 const journal={id:'new-audio',state:'complete',bytes:originalBytes.slice()};
 const messages=[];
 const toast={hidden:true,_text:'',
  set textContent(value){this._text=value;messages.push(value)},
  get textContent(){return this._text}};
 const Native={
  stopAudio(){return true},
  saveDataChecked(text,expected){
   writes++;
   if(mode==='pre-ack-fail')return JSON.stringify({ok:false,error:'synthetic full disk'});
   assert.equal(expected,disk,'expected CAS snapshot');
   disk=text;acks++;
   return JSON.stringify({ok:true,pendingAudioCount:1});
  }
 };
 const window={recording:'new-audio',isRecordLocked:()=>false,
  PendingAudio:{
   saved(){savedCalls++;if(mode==='pending-throw')throw Error('injected post-ACK pending UI failure')},
   retained(){retained++;env.notify('Uchovaná hlasová nahrávka k prověření')},
   refresh(){}
  }};
 const env={state,persistedSnapshot:disk,initial:JSON.parse(disk),prefs:{},
  Native,native:true,dataLoadFailed:false,window,
  noteActive:owner,noteRecordingOwner:owner,current:null,screen:'note',
  syncDeviceId:device,uid:()=>'new-rev',stamp:()=>'2026-11-19T00:45:00Z',
  $:key=>key==='toast'?toast:key==='saveErrorBanner'?
    {remove(){if(mode==='banner-throw')throw Error('injected post-ACK banner failure')}}:
    {textContent:''},
  clearTimeout(){},setTimeout(){return 1},
  renderNoteAttachments(){},pickMedia(){throw Error('unexpected pickMedia')},
  applySavedState(){throw Error('unexpected reconciliation in narrow test')},
  reconcileSavedState(){throw Error('unexpected conflict in narrow test')}
 };
 if(mode==='banner-throw')env.document={};
 vm.createContext(env);
 vm.runInContext(production,env,{filename:'app.js voice note production'});
 return {env,owner,photo,toast,messages,journal,
  get disk(){return JSON.parse(disk)},
  get acks(){return acks},get writes(){return writes},
  get retained(){return retained},get savedCalls(){return savedCalls}};
}
function checkOriginals(s){
 const disk=s.disk;
 assert.deepEqual(Array.from(s.journal.bytes),originalBytes);
 assert.equal(s.journal.state,'complete');
 assert.deepEqual(Array.from(disk.records.find(x=>x.id==='photo').media),['photo-original']);
 assert.equal(disk.records.find(x=>x.id==='photo').value,'1585.800001234567890');
 assert.equal(disk.records.find(x=>x.id==='photo').unit,'mm');
 assert.deepEqual(Array.from(s.owner.media.slice(0,1)),['existing-audio']);
}
const passed=[];
function test(name,run){run();passed.push(name)}
test('healthy native ACK ends with ordinary success toast',()=>{
 const s=scene('healthy');s.env.recordVoice();
 assert.equal(s.toast.textContent,'Nahrávka připojena. Ulož poznámku.');
 assert.equal(s.acks,1);
 assert.deepEqual(Array.from(s.owner.media),['existing-audio','new-audio']);
 assert.deepEqual(s.disk.records.find(r=>r.id==='note-197').media,
  ['existing-audio','new-audio']);
 assert.equal(s.env.window.__lastSaveFailed,false);
 checkOriginals(s);
});
for(const mode of ['pending-throw','banner-throw']){
 test('post-ACK '+mode+' keeps warning visible through recordVoice()',()=>{
  const s=scene(mode);s.env.recordVoice();
  assert.equal(s.acks,1,'native durable acknowledgment must happen');
  assert(s.toast.textContent.startsWith('Uloženo, ale přehled'),
   'Important warning must remain visible, not ordinary success');
  assert.equal(s.messages.includes('Nahrávka připojena. Ulož poznámku.'),false,
   'Ordinary success must not overwrite post-ACK warning');
  assert.equal(s.env.window.__lastSaveFailed,false);
  assert.deepEqual(Array.from(s.owner.media),['existing-audio','new-audio']);
  assert.deepEqual(s.disk.records.find(r=>r.id==='note-197').media,
   ['existing-audio','new-audio']);
  assert.equal(s.env.save(),true,'subsequent unrelated save succeeds');
  assert.deepEqual(s.disk.records.find(r=>r.id==='note-197').media,
   ['existing-audio','new-audio']);
  checkOriginals(s);
 });
}
test('pre-ACK CAS fail does not claim success or bind audio',()=>{
 const s=scene('pre-ack-fail');s.env.recordVoice();
 assert.equal(s.acks,0);assert.equal(s.retained,1);
 assert.equal(s.toast.textContent,'Uchovaná hlasová nahrávka k prověření');
 assert.equal(s.messages.includes('Nahrávka připojena. Ulož poznámku.'),false);
 assert.deepEqual(Array.from(s.owner.media),['existing-audio']);
 assert.deepEqual(s.disk.records.find(r=>r.id==='note-197').media,['existing-audio']);
 assert.equal(s.env.window.__lastSaveFailed,true);
 checkOriginals(s);
});
console.log('PASS #197 recordVoice warning priority '+passed.length+'/'+passed.length);
