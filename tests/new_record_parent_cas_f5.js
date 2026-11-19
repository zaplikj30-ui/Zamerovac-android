/* Issue #207 F5. Executes the actual app.js save/reconcile/persistNewRecord,
 * addRecord/newRecord and native media callback paths. Disk/CAS/DOM are mocked.
 * No #204 quick-add implementation is imported into this separate PR.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function source(a,b){
 const i=app.indexOf(a),j=app.indexOf(b,i+a.length);
 assert(i>=0&&j>i,'Production JS boundary missing: '+a);
 return app.slice(i,j);
}
const production=[
 source('function touch(rec){','function notify(msg){'),
 source('function recById(id,includeDeleted=false){','function closeMenus(){'),
 source('function pickMedia(type,handler=null){',"$('filePick').addEventListener('change'"),
 source('async function addMediaRecord(','async function storeMedia('),
 source('window.onNativeMedia=async(','window.onNativePhotoAddress='),
 source('window.onNativeMediaDone=','window.onNativeMediaProgress=')
].join('\n');
const deep=x=>JSON.parse(JSON.stringify(x));
const device='00000000-0000-4000-8000-000000000001';
const originalBytes=[0,255,1,77,80,52,33,128,90];
const seed={schema:1,syncProtocol:2,prefs:{},records:[
 {id:'original',kind:'photo',parentId:null,rev:'immutable-rev',syncClock:{},
  media:['original-image-id'],items:[{id:'measure-1',value:'1585,800001234567890',
   laserMeasuredMm:'1585.800001234567890',unit:'mm'}]},
 {id:'ancestor',kind:'folder',parentId:null,rev:'ancestor-rev',deleted:false,
  syncClock:{},media:[]},
 {id:'parent',kind:'folder',parentId:null,rev:'parent-rev',deleted:false,
  syncClock:{},media:[]}
]};
function scene(initial=seed){
 let disk=JSON.stringify(initial),mode='',acks=0,casCalls=0,races=0,serial=0;
 const notices=[],requests=[],views=[],journal={state:'complete',bytes:originalBytes.slice()};
 const env={
  native:true,state:deep(initial),initial:deep(initial),prefs:{},
  persistedSnapshot:disk,dataLoadFailed:false,current:null,noteActive:null,
  stagedMediaRequest:null,currentFolder:'parent',screen:'browser',syncDeviceId:device,
  uid:()=> 'new-'+(++serial),stamp:()=> '2026-11-19',
  window:{PendingAudio:{saved(){}},isRecordLocked:null},
  Native:{
   saveDataChecked(payload,expected){
    casCalls++;
    if(mode==='deny'){mode='';return JSON.stringify({ok:false,error:'ENOSPC'})}
    if(mode==='throw'){mode='';throw Error('synthetic Native pre-ACK error')}
    if(mode==='malformed'){mode='';return JSON.stringify({ok:false,current:'{corrupt'})}
    if(mode.startsWith('race-')||mode==='race2'||mode==='race3'){
     const operation=mode;mode='';
     const remote=JSON.parse(disk);
     const parent=remote.records.find(r=>r.id==='parent');
     const ancestor=remote.records.find(r=>r.id==='ancestor');
     const original=remote.records.find(r=>r.id==='original');
     if(operation==='race-delete'){parent.deleted=true;parent.rev='peer-delete'}
     if(operation==='race-lock'){parent.locked=true;parent.rev='peer-lock'}
     if(operation==='race-ancestor-delete'){parent.parentId='ancestor';ancestor.deleted=true;ancestor.rev='peer-delete'}
     if(operation==='race-ancestor-lock'){parent.parentId='ancestor';ancestor.locked=true;ancestor.rev='peer-lock'}
     if(operation==='race-ancestor-purge'){
      parent.parentId='ancestor';
      remote.records=remote.records.filter(r=>r.id!=='ancestor');
      remote.trashPurgedIds=['ancestor'];remote.syncTombstones={ancestor:{}};
     }
     if(operation==='race-purge'){
      remote.records=remote.records.filter(r=>r.id!=='parent');
      remote.trashPurgedIds=['parent'];remote.syncTombstones={parent:{}};
     }
     if(operation==='race-unverified-missing')remote.records=remote.records.filter(r=>r.id!=='parent');
     if(operation==='race-cycle'){parent.parentId='parent';parent.rev='peer-cycle'}
     if(operation==='race-rename'){parent.title='New remote folder title';parent.rev='peer-rename'}
     if(operation==='race-move-valid'){parent.parentId='ancestor';parent.rev='peer-move'}
     if(operation==='race-unrelated'){original.title='Changed remotely';original.rev='peer-other'}
     if(operation==='race2'||operation==='race3'){
      original.title='Other rev '+casCalls;original.rev='peer-other-'+casCalls;
      mode=casCalls<(operation==='race3'?2:1)?operation:'';
     }
     disk=JSON.stringify(remote);races++;
     return JSON.stringify({ok:false,current:disk});
    }
    if(expected!==disk)return JSON.stringify({ok:false,current:disk});
    disk=payload;acks++;
    return JSON.stringify({ok:true,pendingAudioCount:0});
   },
   selectFilesForRequest(route,token){requests.push({route,token})},
   takePhotoForRequest(token){requests.push({route:'camera',token})}
  },
  $:id=>({hidden:true}),
  showFolder(){views.push('folder')},
  openEditor(r){views.push('editor:'+r.id)},
  notify(message){notices.push(String(message))},
  document:undefined
 };
 env.window.isRecordLocked=record=>{
  let at=record,seen=new Set();
  while(at&&!seen.has(at.id)){
   if(at.locked)return true;
   seen.add(at.id);
   at=at.parentId?env.state.records.find(r=>r.id===at.parentId):null;
  }
  return false;
 };
 vm.createContext(env);
 vm.runInContext(production+'\nwindow.__f5={save,reconcileSavedState,newRecord,persistNewRecord,addRecord,pickMedia,addMediaRecord,recById,canWriteToFolder};',env,{filename:'production-app.js-F5'});
 Object.assign(env,env.window.__f5);
 return {
  env,notices,requests,views,journal,
  get disk(){return deep(JSON.parse(disk))},
  get snapshot(){return deep(JSON.parse(env.persistedSnapshot))},
  get acks(){return acks},get casCalls(){return casCalls},get races(){return races},
  set mode(v){mode=v},
  set disk(next){disk=JSON.stringify(next)}
 };
}
function unchanged(s){
 for(const data of [s.disk,s.snapshot]){
  const r=data.records.find(r=>r.id==='original');
  assert(r,'Original record must exist');
  assert.deepEqual(Array.from(r.media),['original-image-id']);
  assert.equal(r.items[0].value,'1585,800001234567890');
  assert.equal(r.items[0].laserMeasuredMm,'1585.800001234567890');
  assert.equal(r.items[0].unit,'mm');
 }
 assert.deepEqual(s.journal.bytes,originalBytes);
 assert.equal(s.journal.state,'complete');
}
function childRecords(data){return data.records.filter(r=>r.id.startsWith('new-'))}
async function create(s,kind,title='Created'){
 if(kind==='media'){
  s.env.pickMedia('media');
  const request=s.requests.at(-1);
  assert.equal(request.route,'media');
  const result=await s.env.window.onNativeMedia('attached-media-id','image/png',title+'.png',null,request.token);
  s.env.window.onNativeMediaDone(request.token);
  return result;
 }
 const r=s.env.newRecord(kind==='note'?'note':kind,title);
 if(kind==='note')return s.env.persistNewRecord(r);
 return s.env.addRecord(r);
}
function committed(s,result,expectedParent){
 assert(result,'Healthy new record must commit');
 assert.equal(s.acks,1);
 const children=childRecords(s.disk);
 assert.equal(children.length,1,'one durable child');
 assert.equal(children[0].parentId,expectedParent);
 assert.equal(childRecords(s.snapshot).length,1);
 assert.equal(childRecords(s.env.state).length,1);
 assert.equal(s.env.window.__lastSaveFailed,false);
 unchanged(s);
}
function refused(s,result){
 assert(!result,'Invalid parent must fail-closed before any native ACK');
 assert.equal(s.acks,0,'No successful CAS for inaccessible parent');
 assert.equal(childRecords(s.disk).length,0,'No orphaned durable child');
 assert.equal(childRecords(s.snapshot).length,0,'No ghost in persistedSnapshot');
 assert.equal(childRecords(s.env.state).length,0,'No RAM ghost');
 assert.equal(s.views.length,0,'No success UI for refused add');
 unchanged(s);
}
const ok=[],failed=[];
async function check(label,fn){try{await fn();ok.push(label)}catch(e){failed.push(label+': '+e.message)}}
const f5Results=[];
async function f5(){
 for(const change of ['race-delete','race-lock']){
  for(const kind of ['folder','canvas','note','media']){
   const s=scene();s.mode=change;
   const added=await create(s,kind,'F5 '+change+' '+kind);
   assert.equal(s.races,1,'Native must force a genuine CAS conflict');
   const child=childRecords(s.disk)[0],parent=s.disk.records.find(r=>r.id==='parent');
   const eligible=!!parent&&!parent.deleted&&!parent.locked;
   const safe=added?(s.acks===1&&!!child&&eligible&&child.parentId===parent.id):
    (s.acks===0&&!child&&childRecords(s.env.state).length===0);
   f5Results.push({change,kind,ack:s.acks,added:!!added,child:child?.id||null,
    parentDeleted:!!parent?.deleted,parentLocked:!!parent?.locked,safe});
   assert.equal(safe,true,'F5 child committed under inaccessible parent');
   refused(s,added);
  }
 }
}
const extras=async()=>{
 await check('root folder',async()=>{const s=scene();s.env.currentFolder=null;committed(s,await create(s,'folder'),null)});
 await check('live parent',async()=>{const s=scene();committed(s,await create(s,'canvas'),'parent')});
 await check('valid nested',async()=>{const data=deep(seed);data.records.find(r=>r.id==='parent').parentId='ancestor';const s=scene(data);committed(s,await create(s,'note'),'parent')});
 for(const kind of ['folder','canvas','note','media'])await check('healthy '+kind,async()=>{const s=scene();committed(s,await create(s,kind),'parent')});
 for(const change of ['race-ancestor-delete','race-ancestor-lock','race-ancestor-purge','race-purge','race-unverified-missing','race-cycle'])await check(change,async()=>{
  const s=scene();s.mode=change;const result=await create(s,'folder');
  assert.equal(s.races,1);refused(s,result);
 });
 for(const change of ['race-unrelated','race-rename','race-move-valid'])await check(change,async()=>{
  const s=scene();s.mode=change;const result=await create(s,'folder');
  committed(s,result,'parent');
  if(change==='race-unrelated')assert.equal(s.disk.records.find(r=>r.id==='original').title,'Changed remotely');
  if(change==='race-rename')assert.equal(s.disk.records.find(r=>r.id==='parent').title,'New remote folder title');
  if(change==='race-move-valid')assert.equal(s.disk.records.find(r=>r.id==='parent').parentId,'ancestor');
 });
 for(const mode of ['deny','throw','malformed'])await check('preACK '+mode,async()=>{
  const s=scene();s.mode=mode;refused(s,await create(s,'folder'));
 });
 for(const mode of ['race2','race3'])await check(mode+' retry',async()=>{
  const s=scene();s.mode=mode;
  const result=await create(s,'folder');committed(s,result,'parent');
  assert.equal(s.casCalls,mode==='race2'?2:3);
 });
 await check('missing initial parent',async()=>{
  const s=scene();s.env.currentFolder='missing';refused(s,await create(s,'folder'));
 });
 await check('deleted initial parent',async()=>{
  const data=deep(seed);data.records.find(r=>r.id==='parent').deleted=true;
  const s=scene(data);refused(s,await create(s,'folder'));
 });
 await check('locked initial parent',async()=>{
  const data=deep(seed);data.records.find(r=>r.id==='parent').locked=true;
  const s=scene(data);refused(s,await create(s,'folder'));
 });
 await check('batch PASS FAIL PASS preserves first',async()=>{
  const s=scene();
  assert(await create(s,'folder','first'));
  assert.equal(s.acks,1);
  s.mode='race-delete';assert(!(await create(s,'canvas','rejected')));
  assert.equal(s.acks,1);
  s.env.currentFolder=null;
  assert(await create(s,'folder','third'));
  const persisted=s.disk.records;
  assert(persisted.some(r=>r.title==='first'));
  assert(persisted.some(r=>r.title==='third'));
  assert(!persisted.some(r=>r.title==='rejected'));
  unchanged(s);
 });
 await check('next save/reload keeps remote parent and originals',async()=>{
  const s=scene();s.mode='race-delete';
  assert(!(await create(s,'folder')));
  assert.equal(s.env.save(),true,'unrelated save should reconcile remote delete');
  assert.equal(s.disk.records.find(r=>r.id==='parent').deleted,true);
  assert.equal(childRecords(s.disk).length,0);
  unchanged(s);
 });
};
const done=(async()=>{
 // When running on the original vulnerable main, leave the definitive 8/8
 // F5 check RED; healthy baseline cases can be run separately via F5_PHASE=extras.
 const phase=process.env.F5_PHASE||'all';
 if(phase!=='extras'){
  for(const change of ['race-delete','race-lock'])
   for(const kind of ['folder','canvas','note','media'])
    await check('F5 '+change+'/'+kind,async()=>{
     const s=scene();s.mode=change;const added=await create(s,kind,'F5 '+change+' '+kind);
     assert.equal(s.races,1);
     const children=childRecords(s.disk),parent=s.disk.records.find(r=>r.id==='parent');
     const safe=added?(s.acks===1&&children.length===1&&
      !parent.deleted&&!parent.locked&&children[0].parentId==='parent'):
      (s.acks===0&&children.length===0&&childRecords(s.env.state).length===0);
     f5Results.push({change,kind,acks:s.acks,added:!!added,safe});
     assert.equal(safe,true,'Unsafe confirmed orphan under deleted/locked parent');
     refused(s,added);
    });
  console.log('F5-8-RESULTS',JSON.stringify(f5Results));
 }
 if(phase!=='f5')await extras();
 if(failed.length)throw Error(failed.length+' FAIL: '+failed.join(' | '));
 console.log('PASS #207 F5 '+ok.length+'/'+ok.length+' ('+phase+')');
})();
done.catch(e=>{console.error(e);process.exitCode=1});
