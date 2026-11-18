/* #194 M3/F5: execute REAL app.js save/CAS/reconcile and native media callbacks.
 * Only Native transport/disk and DOM are synthetic; no Android bytes are changed.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Changed product JS boundary: '+start);
 return app.slice(a,b);
}
const production=[
 extract('function touch(rec){','function notify(msg){'),
 extract('function recById(id,includeDeleted=false){','function folderContains('),
 extract('function newRecord(kind,title,parentId=currentFolder){','function closeMenus(){'),
 extract('// #194: session-only last confirmed add action.','function showNewMenu(){'),
 extract('function pickMedia(type,handler=null){',"$('filePick').addEventListener('change'"),
 extract('async function addMediaRecord(','async function storeMedia('),
 extract('window.onNativeMedia=async(', 'window.onNativePhotoAddress='),
 extract('window.onNativeMediaDone=','window.onNativeMediaProgress='),
 extract('window.onNativeMediaProgress=','window.onNativeSync=')
].join('\n');
const copy=x=>JSON.parse(JSON.stringify(x));
const seed={schema:1,syncProtocol:2,prefs:{},records:[
 {id:'original',kind:'photo',rev:'original-rev',syncClock:{},
  media:['unaltered-media-0'],items:[{measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890',unit:'mm'}]},
 {id:'parent',kind:'folder',parentId:null,rev:'folder-rev',syncClock:{},deleted:false,media:[]}
]};
function scene(snapshot=seed){
 let disk=JSON.stringify(snapshot),mode='',nativeWrites=0,casRaces=0,serial=0,render=0;
 const requests=[],notices=[],locks=new Set(),views=[];
 const button={textContent:'',title:'',dataset:{},setAttribute(key,value){this[key]=value}};
 const env={
  native:true,initial:copy(seed),state:copy(snapshot),prefs:{},dataLoadFailed:false,
  persistedSnapshot:disk,current:null,noteActive:null,stagedMediaRequest:null,screen:'browser',currentFolder:null,
  syncDeviceId:'00000000-0000-4000-8000-000000000001',
  uid:()=>('n-'+(++serial)),stamp:()=> '2026-11-18',
  window:{isRecordLocked:record=>locks.has(record?.id),PendingAudio:{saved(){} }},
  Native:{
   saveDataChecked(payload,expected){
    if(mode==='throw')throw Error('synthetic pre-ack exception');
    if(mode==='deny'){mode='';return JSON.stringify({ok:false,error:'ENOSPC'})}
    // Deterministic F5: a peer deletes/locks the target folder *after*
    // the initial UI canWriteToFolder check but *before* native CAS ACK.
    // The true product save() below must reconcile the returned disk snapshot.
    if(mode==='race-delete'||mode==='race-lock'){
     const concurrent=mode;mode='';
     const remote=JSON.parse(disk),parent=remote.records.find(r=>r.id==='parent');
     if(!parent)throw Error('F5 invalid fixture: missing remote parent');
     parent.rev='peer-concurrent-parent';parent.syncClock={'peer-device':1};
     if(concurrent==='race-delete')parent.deleted=true;
     else {parent.locked=true;locks.add(parent.id)}
     disk=JSON.stringify(remote);casRaces++;
     return JSON.stringify({ok:false,current:disk});
    }
    if(expected!==disk)return JSON.stringify({ok:false,current:disk});
    disk=payload;nativeWrites++;return JSON.stringify({ok:true,pendingAudioCount:0});
   },
   takePhotoForRequest(token){requests.push({route:'camera',token})},
   selectFilesForRequest(route,token){requests.push({route,token})}
  },
  document:undefined,
  $:id=>id==='galleryBtn'?button:{hidden:true},
  notify:message=>notices.push(String(message)),
  showFolder:()=>{render++},
  openEditor:item=>views.push({kind:'editor',id:item.id}),
  openNote:item=>views.push({kind:'note',id:item.id}),
  promptText:()=>{},closeMenus:()=>{}
 };
 vm.createContext(env);
 vm.runInContext(production+'\nwindow.__qa194={newRecord,addRecord,createTextNote,pickMedia,repeatQuickAdd,recById,canWriteToFolder};',env,{filename:'app-194-cas-media.js'});
 // Expose the product's actual functions also to simplified V8 test harnesses;
 // on Node's own vm global scope they are already available.
 Object.assign(env,env.window.__qa194);
 return {
  env,button,requests,notices,locks,views,
  get saved(){return copy(JSON.parse(disk))},
  get writes(){return nativeWrites},
  get races(){return casRaces},
  get renders(){return render},
  set mode(value){mode=value},
  set disk(value){disk=JSON.stringify(value)}
 };
}
function intact(s){
 const r=s.saved.records.find(x=>x.id==='original');
 assert.deepEqual([...r.media],['unaltered-media-0']);
 assert.equal(r.items[0].measure,'1585,800001234567890');
 assert.equal(r.items[0].laserMeasuredMm,'1585.800001234567890');
 assert.equal(r.items[0].unit,'mm');
}
(async()=>{
 const s=scene(),e=s.env;
 assert.equal(e.addRecord(e.newRecord('folder','Root')).kind,'folder');
 assert.equal(s.button.textContent,'📁');
 const root=s.saved.records.find(r=>r.title==='Root');
 e.currentFolder=root.id;
 assert.equal(e.addRecord(e.newRecord('canvas','Nested canvas')).kind,'canvas');
 assert.equal(s.saved.records.find(r=>r.title==='Nested canvas').parentId,root.id);
 assert.equal(s.button.title,'Nový náčrt');
 assert.equal(e.createTextNote(),true);
 assert.equal(s.views.at(-1).kind,'note');
 assert.equal(s.button.title,'Nová textová poznámka');
 for(const invalid of ['missing','parent']){
  if(invalid==='parent')s.locks.add('parent');
  e.currentFolder=invalid;
  const count=s.saved.records.length,icon=s.button.textContent;
  assert.equal(e.addRecord(e.newRecord('folder','unwritten')),false);
  assert.equal(s.saved.records.length,count);
  assert.equal(s.button.textContent,icon);
 }
 s.locks.clear();
 e.currentFolder=root.id;
 const count=s.saved.records.length,prev=s.button.title;
 s.mode='deny';
 assert.equal(e.addRecord(e.newRecord('folder','ghost')),false,'Disk-full rejected add');
 assert.equal(s.saved.records.length,count,'Disk-full created durable ghost');
 assert.equal(e.state.records.some(r=>r.title==='ghost'),false,'Disk-full left RAM ghost');
 assert.equal(s.button.title,prev,'Denied native CAS changed shortcut');
 s.mode='throw';
 assert.equal(e.addRecord(e.newRecord('folder','throw-ghost')),false);
 assert.equal(s.saved.records.length,count);
 s.mode='';
 const media=async(route,mime,id,expectedKind)=>{
  e.pickMedia(route);
  const req=s.requests.at(-1);
  assert.equal(req.route,route);
  assert.equal(await e.window.onNativeMedia(id,mime,id+'.bin',null,req.token),true,'Media failed '+route+'/'+mime);
  const record=s.saved.records.find(r=>r.media?.includes(id));
  assert(record,'Missing durable media ID '+id);
  assert.equal(record.kind,expectedKind);
  assert.equal(record.parentId,root.id);
  e.window.onNativeMediaDone(req.token);
  assert.equal(e.stagedMediaRequest,null);
  return record;
 };
 await media('camera','image/jpeg','new-photo','photo');
 assert.equal(s.button.title,'Pořídit fotografii');
 await media('media','video/mp4','new-video','video');
 assert.equal(s.button.title,'Vybrat média a soubory');
 await media('media','audio/mpeg','new-audio','audio');
 await media('file','application/octet-stream','new-file','file');
 assert.equal(s.button.title,'Vybrat soubory');
 await media('media','image/png','new-image','photo');
 const after=s.saved.records.length;
 e.pickMedia('media');const token=s.requests.at(-1).token;
 assert.equal(await e.window.onNativeMedia('stray','video/mp4','stray.mp4',null,'wrong-token'),false);
 s.mode='deny';
 assert.equal(await e.window.onNativeMedia('rejected','audio/mp3','bad.mp3',null,token),false);
 assert.equal(s.saved.records.length,after,'Rejected batch item left durable ghost');
 assert.equal(e.state.records.some(r=>r.media?.includes('rejected')),false,'Rejected batch item left RAM ghost');
 assert.equal(await e.window.onNativeMedia('batch-ok','video/mp4','ok.mp4',null,token),true);
 e.window.onNativeMediaDone(token);
 assert.equal(await e.window.onNativeMedia('late','video/mp4','late.mp4',null,token),false,'Stale callback accepted');
 e.pickMedia('media');const cancelled=s.requests.at(-1).token;
 e.window.onNativeMediaDone(cancelled);
 assert.equal(await e.window.onNativeMedia('cancelled','audio/mpeg','cancelled.mp3',null,cancelled),false);
 assert(!s.saved.records.some(r=>r.media?.includes('late')||r.media?.includes('cancelled')));
 // Folder deleted/locked between opening picker and returned media: fail closed.
 e.pickMedia('media');let req=s.requests.at(-1).token;
 s.locks.add(root.id);
 assert.equal(await e.window.onNativeMedia('locked-asset','image/png','locked.png',null,req),false);
 e.window.onNativeMediaDone(req);s.locks.delete(root.id);
 e.pickMedia('media');req=s.requests.at(-1).token;
 e.state.records.find(r=>r.id===root.id).deleted=true;
 assert.equal(await e.window.onNativeMedia('deleted-asset','image/png','deleted.png',null,req),false);
 e.state.records.find(r=>r.id===root.id).deleted=false;
 e.window.onNativeMediaDone(req);
 assert(!s.saved.records.some(r=>r.media?.includes('locked-asset')||r.media?.includes('deleted-asset')));
 // True concurrent Native CAS: an independently committed remote record must survive
 // the production three-way reconciliation and next successful local save.
 const remote=copy(s.saved);
 remote.records.push({id:'remote-added',kind:'note',title:'Other device',rev:'rev-peer',syncClock:{},
  media:['other-immutable'],items:[],parentId:null,deleted:false});
 s.disk=remote;
 const merged=e.addRecord(e.newRecord('folder','Concurrent local'));
 assert(merged&&merged.kind==='folder','Native CAS reconciliation must commit');
 assert.equal(s.saved.records.filter(r=>r.title==='Concurrent local').length,1);
 assert.equal(s.saved.records.filter(r=>r.id==='remote-added').length,1);
 assert.deepEqual([...s.saved.records.find(r=>r.id==='remote-added').media],['other-immutable']);
 assert.equal(s.button.title,'Nová složka');
 intact(s);
 const restart=scene(s.saved);
 assert.equal(restart.button.textContent,'','Restart should restore original SVG');
 restart.env.repeatQuickAdd();
 assert.equal(restart.requests.at(-1).route,'media','Restart must open default media picker');
 intact(restart);
 // F5: concurrent deletion / lock of the target AFTER initial allow, BEFORE
 // native CAS retry. A successful add must never claim a live child under
 // an inaccessible parent. A rejected add cannot leave a silent durable orphan.
 const f5Findings=[],f5Failures=[],seedIds=new Set(seed.records.map(r=>r.id));
 for(const race of ['race-delete','race-lock']){
  for(const kind of ['folder','canvas','note','media']){
   const q=scene();q.env.currentFolder='parent';q.mode=race;
   let result;
   const title='F5-'+race+'-'+kind;
   if(kind==='note')result=q.env.createTextNote();
   else if(kind==='media'){
    q.env.pickMedia('media');const token=q.requests.at(-1).token;
    result=await q.env.window.onNativeMedia(title,'image/png',title+'.png',null,token);
    q.env.window.onNativeMediaDone(token);
   }else result=q.env.addRecord(q.env.newRecord(kind,title));
   assert.equal(q.races,1,'F5: a real synthetic Native CAS race must occur exactly once');
   const durable=q.saved;
   const children=durable.records.filter(r=>!seedIds.has(r.id));
   const persisted=JSON.parse(q.env.persistedSnapshot);
   const ramChildren=q.env.state.records.filter(r=>!seedIds.has(r.id));
   const parent=durable.records.find(r=>r.id==='parent');
   const liveParent=q.env.recById('parent'),writable=q.env.canWriteToFolder('parent');
   const child=children[0];
   assert.equal(children.length,1,'F5: fixture should keep one candidate to inspect');
   assert.equal(persisted.records.some(r=>r.id===child.id),true,
    'F5: persistedSnapshot must reflect native confirmed CAS, not a fake save');
   assert.equal(ramChildren.some(r=>r.id===child.id),true,
    'F5: RAM must expose the same committed child for this reproducer');
   assert.equal(q.writes,1,'F5: one durable native ACK after CAS reconciliation required');
   intact(q);
   const reached=!!liveParent&&writable&&child.parentId===liveParent.id;
   const wrong=!!result&&!reached;
   f5Findings.push({race,kind,ack:q.writes,result:!!result,
    parent:{id:parent.id,deleted:!!parent.deleted,locked:!!parent.locked},
    child:{id:child.id,kind:child.kind,parentId:child.parentId,media:child.media},
    reachable:reached,ram:ramChildren.length,snapshot:true,
    quickTitle:q.button.title});
   if(wrong)f5Failures.push(race+'/'+kind);
  }
 }
 console.log('F5-CAS-REPRO',JSON.stringify(f5Findings));
 assert.equal(f5Failures.length,0,
  'F5: production save/reconcile published an inaccessible child with a successful quick action: '+f5Failures.join(', '));
 console.log('PASS F5: no inaccessible child after concurrent delete/lock during real CAS retry');
 console.log('PASS #194 M3: real save CAS/reconcile and Native media callbacks, folder/canvas/note, camera/video/audio/file, root/nested/locked/missing, mixed batch, stale/cancel/disk-full, true CAS retry, restart');
})().catch(err=>{console.error(err);process.exitCode=1});
