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
function scene(fault='none',restartData=null){
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
 const boot=restartData?clone(restartData):clone(old);
 if(restartData){remote.records=clone(restartData.records);remote.prefs=clone(restartData.prefs)}
 let disk=JSON.stringify(restartData||remote),acks=0,attempts=0;
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
   if(mode==='media-malformed'){
    const malformed=JSON.parse(disk);malformed.records[0].media=[null];
    return JSON.stringify(malformed);
   }
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
  prefs:clone(boot.prefs),state:clone(boot),initial:clone(old),
  persistedSnapshot:JSON.stringify(boot),dataLoadFailed:false,
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
 return {window,nodes,notices,seen,old,remote,
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
 assert.equal(s.snapshot.records.some(r=>r.id==='conflict-1'),false,
  'Refused local merge must not advance the JS CAS baseline');
 assert.match(s.details,/Zachované konfliktní kopie: 1/,
  'Native already stored this conflict; explicit cloud tap must not hide it');
 console.log('PASS F4 pre-ACK JS-CAS refusal: draft baseline unchanged, native conflict still visible');
}

if(mode==='edge'||mode==='all'){
 const dirty=s=>{
  const draft=s.ram.records.find(r=>r.id==='note-1');
  draft.title='Local unsaved editor draft';
  draft.rev='local-draft-rev';
  draft.syncClock={'00000000-0000-4000-8000-000000000001':1};
  s.window.__f4.setCurrent(draft);
  s.env.screen='editor';
  s.env.editStack=[{id:'undo-draft',measure:'1585,800001234567890'}];
  s.env.redoStack=[{id:'redo-draft',measure:'55,00000000001'}];
  return draft;
 };
 // P4: native sync changed a different record. Preserve a real local dirty
 // editor through concurrent CAS, and only acknowledge an actual disk commit.
 const s=scene(),draft=dirty(s);
 assert.equal(send(s),true,'P4: dirty editor plus remote conflict must be confirmed');
 assert.equal(s.acks,1,'P4: actual dirty edit needs a confirmed Native JS CAS');
 assert.equal(s.disk.records.find(r=>r.id==='note-1').title,'Local unsaved editor draft');
 assert.equal(s.snapshot.records.find(r=>r.id==='note-1').title,'Local unsaved editor draft');
 assert.equal(s.ram.records.find(r=>r.id==='note-1').title,'Local unsaved editor draft');
 assert.equal(s.current,draft,'P4: unchanged live editor identity must be retained');
 assert.equal(s.env.editStack.length,1,'P4: Undo draft lost');
 assert.equal(s.env.redoStack.length,1,'P4: Redo draft lost');
 intact(s);
 const firstAcks=s.acks;
 assert.equal(send(s,clone(s.old)),true,'P4: stale callback must read current Native disk');
 assert.equal(s.acks,firstAcks,'P4: repeated callback must not duplicate confirmed CAS');
 assert.equal(s.disk.records.filter(r=>r.id==='conflict-1').length,1,'P4: duplicate conflict ID');
 assert.match(s.details,/Zachované konfliktní kopie: 1/);
 console.log('PASS F4 P4 dirty editor, confirmed CAS, stale/repeated callback, exact IDs, Undo/Redo');
 // Pre-ACK disk full must not mutate references, lose a local draft or
 // produce a false status confirmation.
 const rejected=scene('disk-full'),ref=dirty(rejected);
 const baseline=clone(rejected.snapshot);
 assert.equal(send(rejected),false,'P4: disk-full JS CAS must fail closed');
 assert.equal(rejected.acks,0);
 assert.equal(rejected.current,ref,'P4: pre-ACK failure changed active editor object');
 assert.equal(rejected.ram.records[0].title,'Local unsaved editor draft');
 assert.deepEqual(rejected.snapshot,baseline,'P4: rejected candidate poisoned persistedSnapshot');
 assert.equal(rejected.env.editStack.length,1);
 assert.equal(rejected.env.redoStack.length,1);
 console.log('PASS F4 P4 dirty pre-ACK CAS refusal preserves draft + snapshot and Undo/Redo');
 // Native load failure/corruption must not publish a false merge.
 for(const fault of ['load-throw','duplicate-ids']){
  const x=scene(fault),ref=dirty(x),base=clone(x.snapshot);
  assert.equal(send(x),false,'P5: invalid native '+fault+' cannot succeed');
  assert.equal(x.acks,0);assert.deepEqual(x.snapshot,base);
  assert.equal(x.current,ref);assert.equal(x.ram.records[0].title,'Local unsaved editor draft');
 }
 console.log('PASS F4 P5 Native.loadData throw and duplicate IDs');
 // A genuinely concurrent third writer between disk read and JS CAS must
 // survive the existing shared save()/reconcile retry.
 const raced=scene('race-read-cas');dirty(raced);
 assert.equal(send(raced),true,'P4: concurrent writer between read and CAS lost');
 assert.equal(raced.acks,1,'P4: expected confirmed CAS after conflict retry');
 assert(raced.attempts>=2,'P4: CAS conflict branch was not exercised');
 assert.equal(raced.disk.records.filter(r=>r.id==='peer-new').length,1);
 assert.equal(raced.disk.records.find(r=>r.id==='note-1').title,'Local unsaved editor draft');
 assert.equal(raced.disk.records.filter(r=>r.id==='conflict-1').length,1);
 console.log('PASS F4 P4 concurrent read/CAS update retained and confirmed');
 // Exhausted CAS retries: new Native disk data exist, but the JS dirty draft
 // must not be silently acknowledged, overwritten or discarded.
 const exhausted=scene('retry-exhausted'),r=dirty(exhausted),expected=clone(exhausted.snapshot);
 assert.equal(send(exhausted),false,'P5: exhausted CAS retry cannot report local success');
 assert.equal(exhausted.acks,0);assert(exhausted.attempts>=3);
 assert.equal(exhausted.current,r,'P5: retry failure lost active editor');
 assert.equal(exhausted.ram.records[0].title,'Local unsaved editor draft');
 assert.deepEqual(exhausted.snapshot,expected,'P5: retry failure changed local CAS baseline');
 assert.equal(exhausted.disk.records.filter(row=>row.id.startsWith('peer-')).length,3);
 console.log('PASS F4 P5 exhausted retry retains local draft without overwriting native newer data');
 // P5: a post-ACK warning must not label a durable write as uncommitted.
 const audio=scene('post-ack-audio');dirty(audio);
 assert.equal(send(audio),true,'P5: pending-audio callback after acknowledged CAS cannot invalidate durable data');
 assert.equal(audio.acks,1,'P5: Native did not actually commit');
 assert.equal(audio.disk.records[0].title,'Local unsaved editor draft');
 assert.equal(audio.snapshot.records[0].title,'Local unsaved editor draft');
 assert(!audio.notices.some(s=>/^Neuloženo:/.test(s)),
  'P5: post-ACK PendingAudio UI fault incorrectly displayed Neuloženo');
 console.log('PASS F4 P5 post-ACK PendingAudio exception has truthful user-visible status');
 // Malformed media IDs in a Native snapshot are not silently accepted.
 const mediaBad=scene('media-malformed'),badDraft=dirty(mediaBad);
 const mediaBase=clone(mediaBad.snapshot);
 assert.equal(send(mediaBad),false,'P5: malformed Native media ID must fail closed');
 assert.equal(mediaBad.acks,0);assert.deepEqual(mediaBad.snapshot,mediaBase);
 assert.equal(mediaBad.current,badDraft);
 assert.equal(mediaBad.ram.records[0].title,'Local unsaved editor draft');
 console.log('PASS F4 P5 malformed Native media rejected with active draft intact');
 // Native success precedes optional editor reference rebinding. If a live
 // JavaScript getter becomes non-readable AFTER ACK, recover by captured ID.
 const rebind=scene(),live=dirty(rebind),rawId=live.id;
 Object.defineProperty(live,'id',{enumerable:true,configurable:true,
  get(){if(rebind.acks>0)throw Error('synthetic post-ACK live getter failure');return rawId;}});
 assert.equal(send(rebind),true,'P1: post-ACK active getter must not revoke Native commit');
 assert.equal(rebind.acks,1,'P1: synthetic CAS did not actually commit');
 assert.equal(rebind.snapshot.records[0].title,'Local unsaved editor draft');
 assert.equal(rebind.ram.records[0].title,'Local unsaved editor draft');
 assert.equal(rebind.current,rebind.ram.records[0],'P1: recovered current not bound to ACKed state');
 assert.equal(rebind.disk.records.filter(r=>r.id==='conflict-1').length,1);
 console.log('PASS F4 P1 recovery from fallible active-object rebind after ACK');
 // An undelivered toast is not marked seen; explicit cloud tap retries
 // conflict details directly from Native.loadData and does not double-notify.
 const toast=scene();toast.env.notify=()=>{throw Error('synthetic toast unavailable')};
 assert.equal(send(toast),true,'P3: notification rendering may not revoke ACK');
 assert.equal(toast.notices.length,0);
 toast.env.notify=msg=>toast.notices.push(String(msg));
 assert.match(toast.details,/Zachované konfliktní kopie: 1/);
 assert.equal(toast.notices.filter(x=>/zachované konfliktní kopie/i.test(x)).length,1);
 toast.details;
 assert.equal(toast.notices.filter(x=>/zachované konfliktní kopie/i.test(x)).length,1,
  'P3: successful recovery must not duplicate same conflict');
 console.log('PASS F4 P3 explicit status rederives Native durable conflict after toast failure');
 // Further save, then restart on exactly those persisted JSON bytes. Must not
 // resurrect stale peer copies, duplicate IDs or alter exact dimensional data.
 const follow=scene();dirty(follow);
 assert.equal(send(follow),true);
 const next=follow.ram.records.find(r=>r.id==='note-1');
 next.title='Later local confirmed edit';
 assert.equal(follow.window.__f4.save(),true,'P4: next local save after sync failed');
 assert.equal(follow.disk.records.find(r=>r.id==='note-1').title,'Later local confirmed edit');
 assert.equal(follow.disk.records.filter(r=>r.id==='conflict-1').length,1);
 const restarted=scene('none',follow.disk);
 assert.equal(send(restarted,clone(restarted.old)),true,
  'P4: restart with a stale callback must use Native persisted disk');
 assert.equal(restarted.acks,0,'P4: clean restart must not rewrite identical persisted data');
 assert.equal(restarted.snapshot.records.find(r=>r.id==='note-1').title,'Later local confirmed edit');
 assert.equal(restarted.disk.records.filter(r=>r.id==='conflict-1').length,1);
 intact(restarted);
 console.log('PASS F4 P4 next save/restart with stale callback, exact media/kóty, no duplicate copy');
}
