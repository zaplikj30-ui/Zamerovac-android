/* B16 P2: restore-from-trash must not acknowledge an uncommitted CAS save.
 * Use the real production save(), touch(), recursive restoreDeleted(), and UI
 * click callback in a Node VM; fake only Android persistence and DOM plumbing.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8');
function extract(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a);
 assert(a>=0&&b>a,'Cannot extract production function: '+start);
 return src.slice(a,b);
}
const production=[
 // Run the actual three-way CAS reconciliation, not a mock of it.
 extract('function touch(rec){','function reportSaveResult(ok){'),
 extract('function reportSaveResult(ok){','function notify(msg){'),
 extract('function recById(id,includeDeleted=false){','function canWriteToFolder('),
 extract('function restoreDeleted(id,seen=new Set()','let trashBusy=false;'),
 extract('function showTrash(){','function recordActions(')
].join('\n');

function scenario(response,expectSaved){
 const folder={id:'folder',kind:'folder',title:'Původní složka',parentId:'missing-parent',
  deleted:true,rev:'old-folder',updatedAt:'old-date',syncClock:{},hierarchyConflict:{parentId:'missing-parent'}};
 const photo={id:'photo',kind:'photo',title:'Původní foto',parentId:'folder',
  deleted:true,rev:'old-photo',updatedAt:'old-date',syncClock:{},
  media:['original-bytes-id'],items:[{id:'dim',measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]};
 const originals=[JSON.stringify(folder),JSON.stringify(photo)];
 let buttons=[],saveCalls=0,folderCalls=0,committed=null,disk=null,remoteBaseline=null;
 const notifications=[];
 const elements={emptyTrash:{},modalBody:{querySelectorAll(selector){
  return selector==='[data-restore]'?buttons:[];
 }}};
 const env={state:{schema:1,records:[folder,photo],prefs:{},syncProtocol:2},
  persistedSnapshot:'',dataLoadFailed:false,native:true,window:{},screen:'browser',
  initial:null,prefs:{},current:null,noteActive:null,syncDeviceId:'00000000-0000-4000-8000-000000000001',
  stamp:()=>'new-date',uid:(()=>{let i=0;return ()=>'rev-'+(++i)})(),
  document:{createElement(tag){return {tag,setAttribute(){},append(){},remove(){delete elements[this.id]}};},
   body:{append(node){elements[node.id]=node}}},
  Native:{saveDataChecked(payload,expected){
   saveCalls++;
   const conflict=response==='conflictThenFail'||response==='conflictThenSucceed';
   assert.equal(expected,conflict&&saveCalls>1?remoteBaseline:env.persistedSnapshot,
    'Native CAS must compare the exact confirmed version');
   if(conflict&&saveCalls===1)return JSON.stringify({ok:false,current:remoteBaseline});
   if(conflict&&response==='conflictThenFail')
    return JSON.stringify({ok:false,error:'Disk full after CAS reconciliation'});
   if(response==='ok'||response==='conflictThenSucceed'){
    committed=payload;disk=payload;return JSON.stringify({ok:true});
   }
   return JSON.stringify(response);
  }},
  notify:message=>notifications.push(message),$:id=>elements[id]||null,
  closeMenus:()=>{},browserEntryIcon:()=>'<i/>',escapeHtml:txt=>String(txt),
  trashCleanupCount:()=>0,
  modal:(title,html)=>{buttons=[...html.matchAll(/data-restore="([^"]+)"/g)]
   .map(match=>({dataset:{restore:match[1]}}))},
  showFolder:()=>folderCalls++
 };
 env.persistedSnapshot=JSON.stringify(env.state);
 const snapshot=env.persistedSnapshot;
 disk=snapshot;
 if(response==='conflictThenFail'||response==='conflictThenSucceed'){
  const remote=structuredClone(env.state);
  remote.records.push({id:'remote-note',kind:'note',title:'Nezávisle uložené',
   parentId:null,deleted:false,rev:'remote-rev',syncClock:{},media:[],
   text:'Novější nezávislá poznámka',items:[]});
  remoteBaseline=JSON.stringify(remote);disk=remoteBaseline;
 }
 vm.createContext(env);vm.runInContext(production,env);
 env.showTrash();
 assert(buttons.length>0,'Trash view must expose restore button');
 buttons.find(b=>b.dataset.restore==='folder').onclick();
 assert.equal(saveCalls,response==='conflictThenFail'||response==='conflictThenSucceed'?2:1,
  'CAS must retry exactly once after an authoritative newer snapshot');
 assert.equal(env.state.records[0],folder,'Folder identity must be preserved');
 assert.equal(env.state.records[1],photo,'Original photo object must remain live');
 assert.equal(photo.items[0].measure,'1585,800001234567890');
 assert.equal(photo.items[0].laserMeasuredMm,'1585.800001234567890');
 assert.deepEqual(photo.media,['original-bytes-id']);
 if(expectSaved){
  assert.equal(folder.deleted,false);
  assert.equal(photo.deleted,false,'Nested child must be restored');
  assert.equal(folder.parentId,null,'Orphan parent must be normalized after success');
  assert.equal(notifications.at(-1),'Položka obnovena');
  assert.equal(env.window.__lastSaveFailed,false);
  assert.notEqual(env.persistedSnapshot,snapshot);
  assert.equal(committed,env.persistedSnapshot);
  assert.equal(JSON.parse(committed).records[1].items[0].measure,'1585,800001234567890');
  assert.notEqual(folder.rev,'old-folder','Successful restore must commit a new revision');
  assert.equal(folder.syncClock[env.syncDeviceId],1,
   'Successful restore must advance the causal clock');
  const savedFolder=JSON.parse(committed).records.find(r=>r.id==='folder');
  assert.equal(savedFolder.rev,folder.rev);
  assert.equal(savedFolder.syncClock[env.syncDeviceId],1);
  if(response==='conflictThenSucceed')
   assert.equal(JSON.parse(committed).records.find(r=>r.id==='remote-note').text,
    'Novější nezávislá poznámka','CAS retry must retain independent remote data');
  assert.equal(folderCalls,1);
 }else{
  assert.deepEqual([JSON.stringify(folder),JSON.stringify(photo)],originals,
   'Rejected restore must roll back deleted flags, parent, revision and clock byte-for-byte');
  assert.equal(env.persistedSnapshot,snapshot,'Failed CAS must not advance confirmed snapshot');
  assert.equal(disk,remoteBaseline||snapshot,
   'Failed retry must preserve the newer disk, not overwrite it');
  assert.equal(env.state.records.length,2,
   'Failed restore must not install an unconfirmed reconciled state');
  assert.equal(env.window.__lastSaveFailed,true,'Failed save must report unsaved');
  assert.equal(notifications.includes('Položka obnovena'),false,'No misleading success toast');
  assert.match(notifications.at(-1),/nepodařilo uložit/);
  assert.equal(folderCalls,0,'Failed restore must not navigate to a false restored folder');
  assert(elements.saveErrorBanner,'Failed CAS needs persistent error banner');
  assert(buttons.some(b=>b.dataset.restore==='folder'),
   'Item must remain visible in trash after failure');
 }
}
scenario({ok:false,error:'Disk full'},false);
scenario({ok:false,error:'CAS conflict, no confirmed current'},false);
scenario({ok:false,error:'Recovery pending'},false);
scenario({ok:'true'},false);
scenario('conflictThenFail',false);
scenario('ok',true);
scenario('conflictThenSucceed',true);
console.log('PASS: real trash restore, CAS fail/rollback (5), successful save/reconciliation (2), exact media and clock');
