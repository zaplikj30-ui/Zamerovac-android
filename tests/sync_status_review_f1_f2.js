/* #192 F1/F2 independent review regressions. Execute the actual app.js save()
 * and native-sync callback with the real sync-status.js presenter.
 * Native CAS/ledger and DOM are synthetic: not physical Android/Drive.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const presenter=fs.readFileSync('app/src/main/assets/sync-status.js','utf8');
function extract(start,end){
 const a=app.indexOf(start),b=app.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Production boundary changed: '+start);
 return app.slice(a,b);
}
const saveStart=app.includes('function invalidateSyncBadgeAfterSave(){')?
 'function invalidateSyncBadgeAfterSave(){':'function save(){';
const product=extract(saveStart,'function notify(msg){')+'\n'+
 extract('window.onNativeSync=(text)=>{','window.onLaserValue=')+
 '\nwindow.__save=save;window.__getSnapshot=()=>persistedSnapshot;window.__setState=value=>{state=value};';
const clone=v=>JSON.parse(JSON.stringify(v));
function scene(){
 const notices=[],elements=new Map(),classes=new Set(),calls=[];
 let reads=0,refuse=false;
 const old={schema:1,syncProtocol:2,records:[
  {id:'n1',kind:'note',title:'Test',media:['original-audio'],
   items:[{id:'dim1',measure:'1324,00000123',laserMeasuredMm:'1324.00000123',unit:'mm'}]}
 ],prefs:{}};
 let disk=JSON.stringify(old);
 const node=id=>{
  if(!elements.has(id))elements.set(id,{id,title:'',dataset:{},hidden:false,textContent:'',
   classList:{add(...x){x.forEach(y=>classes.add(y))},remove(...x){x.forEach(y=>classes.delete(y))}},
   setAttribute(key,value){this[key]=value},onclick:null});
  return elements.get(id);
 };
 const Native={
  syncLedgerState(){reads++;return JSON.stringify({localSaved:true,targets:[
   {kind:'drive',state:'transport-receipt',contentState:'not-required'}]})},
  saveDataChecked(text,expected){
   calls.push({text,expected});
   if(refuse)return JSON.stringify({ok:false,error:'synthetic ENOSPC'});
   if(expected!==disk)return JSON.stringify({ok:false,current:disk});
   disk=text;
   return JSON.stringify({ok:true,pendingAudioCount:0,audioPending:false});
  },
  loadData(){return disk}
 };
 const window={Native,PendingAudio:{saved(){}},openZamerovacPeers(){}};
 const env={
  window,document:{getElementById:node},Native,native:true,
  screen:'browser',dataLoadFailed:false,state:clone(old),initial:clone(old),
  persistedSnapshot:disk,notify:message=>notices.push(message),
  reportSaveResult:ok=>ok,
  applySavedState:next=>{env.state=next},
  reconcileSavedState:(base,local,remote)=>remote,
  showFolder(){},modal(){},
 };
 vm.createContext(env);
 vm.runInContext(presenter,env,{filename:'sync-status.js'});
 vm.runInContext(product,env,{filename:'app-save-native-sync.js'});
 return {env,window,notices,calls,node,old,
  get reads(){return reads},get disk(){return clone(JSON.parse(disk))},
  set disk(value){disk=JSON.stringify(value)},
  set refuse(value){refuse=!!value},
  get api(){return window.ZamerovacSyncStatus}
 };
}
const mode=process.env.SYNC_REVIEW_CASE||'all';
if(mode==='f1'||mode==='all'){
 const s=scene();
 s.api.peerState({peers:{trusted:{}}});
 s.api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen'});
 assert.equal(s.api.status().phase,'confirmed','Trusted current ACK must be green');
 const beforeReads=s.reads;
 const edited=clone(s.old);
 edited.records[0].items[0].measure='1325,00000123';
 s.window.__setState(edited);
 s.env.screen='editor';
 assert.equal(s.window.__save(),true,'Native must confirm the local edit');
 assert.equal(s.api.status().phase,'pending','F1: a newly persisted revision must not retain stale green');
 assert.equal(s.reads,beforeReads,'F1: save/editor must not synchronously read SQLite ledger');
 assert.equal(s.disk.records[0].items[0].measure,'1325,00000123');
 assert.equal(s.disk.records[0].media[0],'original-audio');
 s.env.screen='browser';
 s.api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen'});
 assert.equal(s.api.status().phase,'confirmed','Verified latest receipt may become green again');
 s.refuse=true;
 const rejected=clone(s.disk);rejected.records[0].items[0].measure='unconfirmed';
 s.window.__setState(rejected);
 const noReads=s.reads;
 assert.equal(s.window.__save(),false,'Rejected native write must not be acknowledged');
 assert.equal(s.api.status().phase,'confirmed','Uncommitted edit must not claim a new successful revision');
 assert.equal(s.reads,noReads,'Rejected save must not poll ledger');
 assert.equal(s.disk.records[0].items[0].measure,'1325,00000123','Rejected write changed durable bytes');
 console.log('PASS F1: ACK(A) -> durable edit(B) pending without ledger I/O -> ACK(B), rejected CAS safe');
}
if(mode==='f2'||mode==='all'){
 const s=scene();
 s.api.peerState({peers:{trusted:{}}});
 const update=items=>{
  const next=clone(s.old);
  next.records.push(...items);
  s.disk=next;
  return s.window.onNativeSync(JSON.stringify({
   transport:'cloud-v2',pending:false,
   message:'Přenos potvrzen pro toto úložiště',data:next
  }));
 };
 const conflict=id=>({id,kind:'note',title:'Zachovaná konfliktní kopie',
  media:['other-original'],conflict:true,conflictSource:'source-'+id,
  items:[{measure:'55,00001',unit:'mm'}]});
 assert.equal(update([conflict('copy-1')]),true,'Sync callback failed');
 assert.equal(s.api.status().phase,'confirmed','Real ledger success may remain confirmed');
 const warnings=()=>s.notices.filter(x=>/konfliktní kopie/i.test(x));
 assert.equal(warnings().length,1,'F2: first new cloud conflict needs a visible warning');
 assert.equal(update([conflict('copy-1')]),true);
 assert.equal(warnings().length,1,'F2: same conflict must not cause repeated toasts');
 assert.equal(update([conflict('copy-1'),conflict('copy-2')]),true);
 assert.equal(warnings().length,2,'F2: another preserved copy must be announced');
 assert.equal(s.disk.records.find(x=>x.id==='copy-1').media[0],'other-original');
 assert.equal(s.disk.records.find(x=>x.id==='n1').items[0].measure,'1324,00000123');
 s.api.show();
 assert.match(s.node('syncStatusDetails').textContent,/konfliktní kopie/i,
  'F2: conflict explanation must remain available on status tap');
 s.refuse=true;
 const pre=s.notices.length;
 assert.equal(update([conflict('copy-1'),conflict('copy-2'),conflict('copy-3')]),false,
  'Rejected sync save must not be reported as successful');
 assert.equal(s.notices.filter(x=>/konfliktní kopie/i.test(x)).length,2,
  'Rejected update must not announce a committed new conflict');
 assert(s.notices.length>=pre,'Failure should not hide notices');
 console.log('PASS F2: new cloud-v2 conflict, deduplicated repeat, second conflict, persistent detail, rejected save');
}
