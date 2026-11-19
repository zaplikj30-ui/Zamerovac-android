/* #192 F4: RED before fix; keep exact browser/editor fault injections after fix.
 * Executes production reconcileSavedState(), applySavedState(), save(),
 * onNativeSync() and sync-status.js. Only Native/disk/DOM are synthetic.
 * Use the original RED assertions unchanged; now demand PASS on the fixed SHA.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const presenter=fs.readFileSync('app/src/main/assets/sync-status.js','utf8');
function extract(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Production boundary changed: '+start);
 return app.slice(a,b);
}
const production=extract('function touch(rec){','function notify(msg){')+'\n'+
 extract(app.includes('window.ZamerovacSyncReadCommittedConflicts=')?
  'window.ZamerovacSyncReadCommittedConflicts=':'window.onNativeSync=(text)=>{','window.onLaserValue=')+
 '\nwindow.__f4={snapshot:()=>persistedSnapshot,state:()=>state,'+
 'getCurrent:()=>current,setCurrent:v=>{current=v},getNote:()=>noteActive,'+
 'setNote:v=>{noteActive=v},setState:v=>{state=v},' +
 'save:()=>save()};';
const clone=v=>JSON.parse(JSON.stringify(v));
function scene(fault='none'){
 const old={schema:1,syncProtocol:2,records:[{
  id:'note-1',rev:'r1',kind:'note',title:'Originál',parentId:null,deleted:false,
  media:['immutable-origin-media-id'],
  items:[{id:'dim-1',measure:'1585,800001234567890',
   laserMeasuredMm:'1585.800001234567890',unit:'mm'}]
 }],prefs:{unit:'mm'}};
 const remote=clone(old);
 remote.records.push({id:'conflict-1',rev:'peer-conflict',kind:'note',
  title:'Zachovaná konfliktní kopie',parentId:null,deleted:false,
  conflict:true,conflictSource:'synthetic-f4',
  media:['immutable-peer-media-id'],
  items:[{id:'dim-2',measure:'55,00000000001',
   laserMeasuredMm:'55.00000000001',unit:'mm'}]});
 let disk=JSON.stringify(remote),acks=0,attempts=0;
 const notices=[],nodes=new Map(),seen=[];
 let mode=fault;
 function node(id){
  if(!nodes.has(id))nodes.set(id,{
   id,title:'',hidden:false,dataset:{},attributes:{},textContent:'',
   classList:{add(){},remove(){}},setAttribute(k,v){this.attributes[k]=v},
   remove(){},append(){}
  });
  if(id==='editorTitle'&&mode==='editor')
   return {set textContent(value){seen.push('editor-title-throw');throw Error('synthetic editorTitle DOM failure')}};
  return nodes.get(id);
 }
 const document={getElementById:node,createElement:id=>node('made-'+id),body:{append(){}}};
 const Native={
  loadData(){
   if(mode==='load-throw')throw Error('synthetic Native load unavailable');
   if(mode==='invalid-load')return '{"schema":0,"records":[]}';
   if(mode==='duplicate-ids'){
    const broken=JSON.parse(disk);broken.records.push({...broken.records[0]});
    return JSON.stringify(broken);
   }
   return disk;
  },
  saveDataChecked(text,expected){
   attempts++;
   if(mode==='cas-refusal'||mode==='disk-full')
    return JSON.stringify({ok:false,error:'synthetic disk full'});
   if(mode==='race-read-cas'&&attempts===1){
    const newer=JSON.parse(disk);newer.records.push({id:'peer-new',
     kind:'note',rev:'other-peer',parentId:null,title:'Newer remote',
     media:['immutable-peer-extra'],items:[]});
    disk=JSON.stringify(newer);
    return JSON.stringify({ok:false,current:disk});
   }
   if(mode==='retry-exhausted'){
    const newer=JSON.parse(disk);newer.records.push({id:'peer-'+attempts,
     kind:'note',rev:'other-'+attempts,title:'Peer update',
     parentId:null,media:[],items:[]});
    disk=JSON.stringify(newer);
    return JSON.stringify({ok:false,current:disk});
   }
   if(expected!==disk)return JSON.stringify({ok:false,current:disk});
   disk=text;acks++;return JSON.stringify({ok:true,pendingAudioCount:0,audioPending:false});
  },
  syncLedgerState(){return JSON.stringify({localSaved:true,
   targets:[{kind:'drive',state:'waiting',contentState:'waiting'}]})}
 };
 const window={Native,PendingAudio:{saved(){
   if(mode==='post-ack-audio')throw Error('synthetic post-ACK PendingAudio.saved failure');
  }},openZamerovacPeers(){}};
 const env={Native,window,document,$:node,native:true,
  screen:fault==='editor'?'editor':'browser',current:null,noteActive:null,
  prefs:clone(old.prefs),state:clone(old),initial:clone(old),
  persistedSnapshot:JSON.stringify(old),dataLoadFailed:false,
  syncDeviceId:'00000000-0000-4000-8000-000000000001',uid:()=>'new-id',
  showFolder(){seen.push('show-folder');if(mode==='browser')throw Error('synthetic showFolder DOM failure')},
  notify:msg=>notices.push(String(msg)),modal(){seen.push('show-details')},
  console:{warn(){}}
 };
 if(fault==='editor')env.current=env.state.records[0];
 vm.createContext(env);
 vm.runInContext(presenter,env,{filename:'sync-status.js'});
 vm.runInContext(production,env,{filename:'actual-app-sync-cas.js'});
 window.ZamerovacSyncStatus.peerState({peers:{trusted:{}}});
 return {window,nodes,notices,seen,remote,
  get disk(){return JSON.parse(disk)},get acks(){return acks},get attempts(){return attempts},
  get snapshot(){return JSON.parse(window.__f4.snapshot())},
  get ram(){return window.__f4.state()},
  get current(){return window.__f4.getCurrent()},
  get nativeData(){return JSON.parse(disk)},
  get status(){return window.ZamerovacSyncStatus.status()},
  set fault(x){mode=x},
  get env(){return env},
  get details(){
   window.ZamerovacSyncStatus.show();
   return nodes.get('syncStatusDetails')?.textContent||'';
  }
 };
}
function send(s,data=s.remote){
 return s.window.onNativeSync(JSON.stringify({
  transport:'cloud-v2',pending:true,message:'Synchronizace čeká na připojení',data
 }));
}
function intact(s){
 const a=s.disk.records.find(r=>r.id==='note-1');
 assert.deepEqual(a.media,['immutable-origin-media-id']);
 assert.equal(a.items[0].measure,'1585,800001234567890');
 assert.equal(a.items[0].laserMeasuredMm,'1585.800001234567890');
 assert.equal(a.items[0].unit,'mm');
 const b=s.disk.records.find(r=>r.id==='conflict-1');
 assert.deepEqual(b.media,['immutable-peer-media-id']);
 assert.equal(b.items[0].measure,'55,00000000001');
}
function committedAndVisible(s,name){
 assert(s.disk.records.some(r=>r.id==='conflict-1'),name+': committed disk lacks copy');
 assert(s.ram.records.some(r=>r.id==='conflict-1'),name+': RAM lacks copy');
 assert(s.snapshot.records.some(r=>r.id==='conflict-1'),name+': snapshot stale after native sync');
 assert.equal(s.window.ZamerovacSyncStatus.status().phase,'pending',name+': waiting must not turn green');
 assert.match(s.details,/Zachované konfliktní kopie: 1/,name+': missing conflict details');
 assert(s.notices.some(m=>/zachované konfliktní kopie/i.test(m)),name+': no conflict notification');
 intact(s);
}
const mode=process.env.SYNC_F4_CASE||'all';
if(mode==='clean'||mode==='all'){
 const s=scene();
 assert.equal(send(s),true,'F4 clean confirmed sync');
 assert.equal(s.acks,1,'F4 clean must confirm native JS CAS');
 committedAndVisible(s,'clean');
 console.log('PASS F4 clean: source sync/merge/CAS + visible conflict');
}
if(mode==='browser'||mode==='all'){
 const s=scene('browser');
 assert.equal(send(s),true,'F4 RED: post-ACK showFolder exception must not cause false failure');
 assert.equal(s.acks,1,'F4: browser case must contain confirmed native CAS');
 committedAndVisible(s,'browser');
 console.log('PASS F4 browser: confirmed data survives DOM exception');
}
if(mode==='editor'||mode==='all'){
 const s=scene('editor');
 assert.equal(send(s),true,'F4 RED: editorTitle exception after Native.loadData must not cause false failure');
 assert(s.acks<=1,'F4: no repeated or duplicate CAS after editor UI fault');
 committedAndVisible(s,'editor');
 console.log('PASS F4 editor: confirmed native disk survives failed title projection');
}
if(mode==='invalid'||mode==='all'){
 const s=scene('invalid-load');
 assert.equal(send(s),false,'F4 invalid native load must fail closed');
 assert.equal(s.acks,0);
 assert.equal(s.ram.records.some(r=>r.id==='conflict-1'),false);
 assert.equal(s.snapshot.records.some(r=>r.id==='conflict-1'),false);
 assert.doesNotMatch(s.details,/Zachované konfliktní kopie/);
 console.log('PASS F4 invalid native data: no false ACK');
}
if(mode==='cas-refusal'||mode==='all'){
 const s=scene('cas-refusal');
 assert.equal(send(s),false,'F4 rejected additional JS CAS must not claim confirmed local reconciliation');
 assert.equal(s.acks,0);
 assert.doesNotMatch(s.details,/Zachované konfliktní kopie/);
 console.log('PASS F4 pre-ACK additional CAS refusal: no false local confirmation');
}
