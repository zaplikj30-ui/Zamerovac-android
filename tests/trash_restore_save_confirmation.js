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
 extract('function touch(rec){','function mergeSyncTombstones('),
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
 let buttons=[],saveCalls=0,folderCalls=0,committed=null;
 const notifications=[];
 const elements={emptyTrash:{},modalBody:{querySelectorAll(selector){
  return selector==='[data-restore]'?buttons:[];
 }}};
 const env={state:{schema:1,records:[folder,photo],prefs:{},syncProtocol:2},
  persistedSnapshot:'',dataLoadFailed:false,native:true,window:{},screen:'browser',
  initial:null,syncDeviceId:'00000000-0000-4000-8000-000000000001',
  stamp:()=>'new-date',uid:(()=>{let i=0;return ()=>'rev-'+(++i)})(),
  document:{createElement(tag){return {tag,setAttribute(){},append(){},remove(){delete elements[this.id]}};},
   body:{append(node){elements[node.id]=node}}},
  Native:{saveDataChecked(payload,expected){
   saveCalls++;
   assert.equal(expected,env.persistedSnapshot,'Expected exact CAS snapshot');
   if(response==='ok'){committed=payload;return JSON.stringify({ok:true})}
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
 vm.createContext(env);vm.runInContext(production,env);
 env.showTrash();
 assert(buttons.length>0,'Trash view must expose restore button');
 buttons.find(b=>b.dataset.restore==='folder').onclick();
 assert.equal(saveCalls,1,'Restore must attempt one durable save');
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
  assert.equal(folderCalls,1);
 }else{
  assert.deepEqual([JSON.stringify(folder),JSON.stringify(photo)],originals,
   'Rejected restore must roll back deleted flags, parent, revision and clock byte-for-byte');
  assert.equal(env.persistedSnapshot,snapshot,'Failed CAS must not advance confirmed snapshot');
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
scenario('ok',true);
console.log('PASS: real trash restore UI + native CAS failure rollback (4), success (1), exact media/dimensions, stable objects');
