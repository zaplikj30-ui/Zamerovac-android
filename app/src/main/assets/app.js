/* Zaměřovač – independent, original implementation. All coordinates in image pixels. */
'use strict';
const $=id=>document.getElementById(id);
const native=!!window.Native;
const appVersion=native&&typeof Native.getAppVersion==='function'?Native.getAppVersion():'web';
const appVersionShort=appVersion.replace(/-test$/,'');
const uid=()=>crypto.randomUUID?crypto.randomUUID():('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const syncDeviceId=(()=>{try{
 const key='zamerovac-installation-id';let id=native&&typeof Native.getSyncDeviceId==='function'?Native.getSyncDeviceId():localStorage.getItem(key);
 if(native&&typeof Native.getSyncDeviceId==='function'&&!id)throw new Error('Identitu instalace nelze potvrdit');
 if(!id){if(crypto.randomUUID)id=crypto.randomUUID();else{const bytes=crypto.getRandomValues(new Uint8Array(16));bytes[6]=(bytes[6]&15)|64;bytes[8]=(bytes[8]&63)|128;const hex=[...bytes].map(b=>b.toString(16).padStart(2,'0')).join('');id=hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20)}localStorage.setItem(key,id)}return id;
}catch(error){return ''}})();
const initialPrefs={unit:'mm',decimals:0,laserDecimals:'auto',laserRounding:'none',color:'#f7dc27',lineWidth:2,fontSize:17,loupe:true,loupeZoom:2,repeatDrawing:false,snapGrid:false,showGrid:false,gridStep:40,snapPoints:true,snapHorizontal:true,snapCorners:true,snapContours:true,snapRightAngle:true,keepAwake:false,vibration:true,fullScreen:false,autoText:true,autoSync:true,syncFrequency:'auto',wifiOnly:false,moveSensitivity:1,presets:'Zásuvka;Voda;Odpad;Elektro;Výška parapetu',toolOrder:'',uiLanguage:'cs',backgroundPattern:'Vypnuto'};
const initial={schema:1,records:[],prefs:{...initialPrefs},created:new Date().toISOString()};
let state=initial,dataLoadFailed=!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(syncDeviceId),persistedSnapshot="";
try{const saved=native?Native.loadData():localStorage.getItem('zamerovac-data');if(saved){persistedSnapshot=saved;const loaded=JSON.parse(saved);if(loaded.schema!==1||!Array.isArray(loaded.records))throw new Error('Neplatná databáze');state={...initial,...loaded}};}catch(e){dataLoadFailed=true;console.warn('Cannot load database',e)}
state.prefs={...initialPrefs,...(state.prefs||{})};
const prefs=state.prefs;
let sortAsc=true;let currentFolder=null,screen='browser',current=null,noteActive=null,mode='dimension',selected=null,stagedMediaRequest=null,editStack=[],redoStack=[],lineDraft=[],stageImg=null,photoSize={w:1400,h:900},view={zoom:1,dx:0,dy:0},drag=null,pointers=new Map(),magnifierPoint=null,stageCanvas=$('drawCanvas'),ctx=stageCanvas.getContext('2d'),loupeCtx=$('loupe').getContext('2d'),autoSaving=false;
const stamp=()=>new Date().toISOString();
function touch(rec){rec.syncClock=advanceSyncClock(rec.syncClock||{});rec.rev=uid();rec.updatedAt=stamp();delete rec.hierarchyConflict;}
function checkedSyncClock(value){
 if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length>1024)throw new Error('Neplatná synchronizační revize');
 const next={};for(const [id,count] of Object.entries(value)){if(!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(id)||!Number.isSafeInteger(count)||count<1)throw new Error('Neplatný čítač revize');next[id]=count}return next;
}
function mergeSyncClocks(a={},b={}){const result=checkedSyncClock(a);for(const [id,count] of Object.entries(checkedSyncClock(b)))result[id]=Math.max(result[id]||0,count);return checkedSyncClock(result)}
function compareSyncClocks(a={},b={}){a=checkedSyncClock(a);b=checkedSyncClock(b);let less=false,greater=false;for(const id of new Set([...Object.keys(a),...Object.keys(b)])){less||=(a[id]||0)<(b[id]||0);greater||=(a[id]||0)>(b[id]||0)}return less&&greater?'concurrent':less?'before':greater?'after':'equal'}
function advanceSyncClock(clock){const result=checkedSyncClock(clock),count=result[syncDeviceId]||0;if(count===Number.MAX_SAFE_INTEGER)throw new Error('Vyčerpaný čítač revizí');result[syncDeviceId]=count+1;return checkedSyncClock(result)}
function mergeSyncTombstones(a={},b={}){const result={};for(const id of new Set([...Object.keys(a),...Object.keys(b)]))Object.defineProperty(result,id,{value:mergeSyncClocks(Object.hasOwn(a,id)?a[id]:{},Object.hasOwn(b,id)?b[id]:{}),enumerable:true,writable:true,configurable:true});return result}
// Three-way reconciliation also covers a native callback queued behind a newer edit.
function canonicalSavedValue(value){
 const canonical=v=>v&&typeof v==='object'?Array.isArray(v)?v.map(canonical):Object.fromEntries(Object.keys(v).sort().map(k=>[k,canonical(v[k])])):v;
 return JSON.stringify(canonical(value));
}
function sameSavedValue(a,b){return canonicalSavedValue(a)===canonicalSavedValue(b)}
function sameHierarchyIntent(repaired,original){
 if(!repaired?.hierarchyConflict||repaired.parentId!==null||typeof repaired.hierarchyConflict.parentId!=='string')return false;
 const intent={...repaired,parentId:repaired.hierarchyConflict.parentId};delete intent.hierarchyConflict;return sameSavedValue(intent,original);
}
function repairFolderHierarchy(records){
 const positions=new Map(records.map((record,index)=>[record.id,index])),done=new Set();
 for(const start of [...positions.keys()].sort()){
  const path=[],seen=new Map();let at=start;
  while(positions.has(at)&&!done.has(at)){
   if(seen.has(at)){
    const cut=path.slice(seen.get(at)).sort()[0],index=positions.get(cut),record=records[index];
    records[index]={...record,hierarchyConflict:{parentId:record.parentId},parentId:null};break;
   }
   seen.set(at,path.length);path.push(at);at=records[positions.get(at)].parentId;
  }
  for(const id of path)done.add(id);
 }
 return records;
}
function reconcileSavedState(base,local,remote){
 const old=new Map((base.records||[]).map(r=>[r.id,r])),ours=new Map(local.records.map(r=>[r.id,r]));
 const theirs=new Map(remote.records.map(r=>[r.id,r])),records=[];
 const purged=new Set([...(local.trashPurgedIds||[]),...(remote.trashPurgedIds||[])]);
 const tombstones=mergeSyncTombstones(local.syncTombstones||{},remote.syncTombstones||{});
 for(const id of purged)if(!Object.hasOwn(tombstones,id))Object.defineProperty(tombstones,id,{value:{},enumerable:true,writable:true,configurable:true});
 const conflicts=new Set([...ours.values(),...theirs.values()].map(r=>r.conflictSource).filter(Boolean));
 for(const id of new Set([...ours.keys(),...theirs.keys()])){
  const l=ours.get(id),d=theirs.get(id),o=old.get(id);
  if(Object.hasOwn(tombstones,id)){
   for(let record of [l,d])if(record&&!record.deleted){
    if(record===l&&!sameSavedValue(record,o)&&sameSavedValue(record.syncClock,o?.syncClock))record={...record,syncClock:advanceSyncClock(record.syncClock||{})};
    if(!Object.keys(record.syncClock||{}).length||['after','concurrent'].includes(compareSyncClocks(record.syncClock||{},tombstones[id]))){
     const source='purge:'+id+':'+canonicalSavedValue(record);
     if(!conflicts.has(source)){let copy;if(native&&typeof Native.preservePurgedEdit==='function'){copy=JSON.parse(Native.preservePurgedEdit(id,JSON.stringify(record),JSON.stringify(tombstones[id])));if(copy.error||!copy.id)throw Error('Konfliktní kopie nebyla potvrzena');}else copy={...record,id:uid(),conflict:true,conflictOf:id,conflictSource:source,title:(record.title||'Položka')+' (změna po vysypání koše)',syncClock:mergeSyncClocks(record.syncClock||{},tombstones[id])};if(!Object.hasOwn(tombstones,copy.id))records.push(copy);conflicts.add(source)}
    }
   }
   continue;
  }
  if(purged.has(id)&&(!l||l.deleted)&&(!d||d.deleted))continue;
  if(sameSavedValue(l,d)){if(l)records.push(l);continue}
  if(sameSavedValue(l,o)){if(d)records.push(d);continue}
  if(sameSavedValue(d,o)){if(l)records.push(l);continue}
  if(sameHierarchyIntent(l,d)){records.push(l);continue}
  if(sameHierarchyIntent(d,l)){records.push(d);continue}
  // Use the same deterministic winner and copy as native peer merge.
  if(l&&d&&native&&typeof Native.resolveSyncConflict==='function'){
   const result=JSON.parse(Native.resolveSyncConflict(JSON.stringify(l),JSON.stringify(d)));
   if(result.error||!result.copy?.id||!['local','remote'].includes(result.winner))throw Error('Konfliktní kopie nebyla potvrzena');
   records.push(result.winner==='local'?l:d);const copy=result.copy;
   if(!conflicts.has(copy.conflictSource)&&!ours.has(copy.id)&&!theirs.has(copy.id)&&!Object.hasOwn(tombstones,copy.id)){records.push(copy);conflicts.add(copy.conflictSource)}
  }else{
   // Browser-only fallback has no native transport; preserve both local drafts.
   if(l)records.push(l);else if(d)records.push(d);
   if(l&&d){const source=JSON.stringify([id,d.rev||'',d]);if(!conflicts.has(source)){records.push({...d,id:uid(),title:(d.title||'Položka')+' (konflikt synchronizace)',conflict:true,conflictSource:source});conflicts.add(source)}}
  }
 }
 return {...remote,...local,records:repairFolderHierarchy(records),trashPurgedIds:[...purged],syncTombstones:tombstones,prefs};
}
function applySavedState(next){
 state=next;state.prefs=prefs;
 // Retain live editor/note references when a local draft wins reconciliation.
 for(const active of new Set([current,noteActive,window.__detailParent]))if(active){let at=state.records.findIndex(r=>r.id===active.id&&r.rev===active.rev);if(at<0)at=state.records.findIndex(r=>r.conflictOf===active.id&&r.rev===active.rev);if(at<0)at=state.records.findIndex(r=>r.id===active.id);if(at>=0&&state.records[at]!==active){const saved=state.records[at],retained={};for(const key of ['items','checks','media','sketchStrokes'])if(Array.isArray(active[key])&&sameSavedValue(active[key],saved[key]))retained[key]=active[key];for(const key of Object.keys(active))if(!Object.hasOwn(saved,key))delete active[key];for(const key of Object.keys(saved))Object.defineProperty(active,key,{value:saved[key],writable:true,enumerable:true,configurable:true});Object.assign(active,retained);state.records[at]=active}}
 if(typeof document!=='undefined'&&current&&screen==='editor')$('editorTitle').textContent=current.title;
}
function reportSaveResult(ok){
 window.__lastSaveFailed=!ok;
 if(typeof document==='undefined')return ok;
 let banner=$('saveErrorBanner');
 if(ok){banner?.remove();return true}
 if(!banner){banner=document.createElement('div');banner.id='saveErrorBanner';banner.setAttribute('role','alert');banner.className='save-error-banner';
  const text=document.createElement('span');text.textContent='Změny nejsou uložené. Ponech aplikaci otevřenou.';
  const retry=document.createElement('button');retry.type='button';retry.textContent='Zkusit uložit znovu';retry.onclick=()=>save();banner.append(text,retry);document.body.append(banner);
 }
 return false;
}
function save(){
 if(dataLoadFailed){notify('Zakázky nelze načíst. Zápis je zablokovaný, původní data zůstávají chráněná.');return reportSaveResult(false)}
 try{
  for(let attempt=0;attempt<3;attempt++){
   state.syncProtocol=2;const text=JSON.stringify(state);
   if(!native){localStorage.setItem('zamerovac-data',text);persistedSnapshot=text;return reportSaveResult(true)}
   const result=JSON.parse(Native.saveDataChecked(text,persistedSnapshot));
   if(result.ok){persistedSnapshot=text;if(result.audioPending)window.PendingAudio?.retained();else window.PendingAudio?.refresh();return reportSaveResult(true)}
   if(typeof result.current!=='string')throw new Error(result.error||'Zápis nebyl potvrzen');
   const disk=JSON.parse(result.current),base=persistedSnapshot?JSON.parse(persistedSnapshot):initial;
   applySavedState(reconcileSavedState(base,state,disk));persistedSnapshot=result.current;
  }
  throw new Error('Zakázky se právě mění. Zkus uložení znovu.');
 }catch(e){notify('Neuloženo: '+e.message);return reportSaveResult(false)}
}
function notify(msg){const el=$('toast');el.textContent=msg;el.hidden=false;clearTimeout(window.toastTimer);window.toastTimer=setTimeout(()=>el.hidden=true,3000)}
function dateText(s){return s?new Date(s).toLocaleDateString('cs-CZ'):''}
function photoDateText(value){
  if(!value)return '';
  const d=new Date(value);
  return Number.isNaN(d.getTime())?'':d.toLocaleString('cs-CZ',{day:'numeric',month:'numeric',year:'numeric',hour:'2-digit',minute:'2-digit'});
}
function photoAddressText(r){
  if(r.photoAddress)return r.photoAddress;
  if(!r.photoTakenAt)return '';
  return r.photoAddressChecked?'Adresu se nepodařilo zjistit':'Zjišťuji adresu…';
}
function photoDetailsText(r){
  if(!r.photoTakenAt)return photoAddressText(r);
  return photoDateText(r.photoTakenAt)+' · '+photoAddressText(r);
}
function escapeHtml(t){return String(t??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function recById(id,includeDeleted=false){return state.records.find(r=>r.id===id&&(includeDeleted||!r.deleted))}
function canWriteToFolder(id){if(dataLoadFailed)return false;if(!id)return true;const folder=recById(id);return !!folder&&folder.kind==='folder'&&!folder.deleted&&!window.isRecordLocked?.(folder)}
function folderContains(folderId,otherId){
 let node=recById(otherId),seen=new Set();
 while(node&&!seen.has(node.id)){if(node.id===folderId)return true;seen.add(node.id);node=node.parentId?recById(node.parentId):null}
 return false;
}
function newRecord(kind,title,parentId=currentFolder){return {id:uid(),syncClock:advanceSyncClock({}),kind,title,parentId,createdAt:stamp(),updatedAt:stamp(),rev:uid(),media:[],items:[],text:'',checks:[],width:1400,height:900,deleted:false}}
function addRecord(r){if(!canWriteToFolder(r.parentId)){notify('Nejdříve odemkněte složku.');return null}state.records.push(r);save();showFolder();return r}
function closeMenus(){for(let id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow'])$(id).hidden=true;if($('editorExtraToolbar')?.hidden===false)window.setEditorExtraToolbarExpanded?.(false)}
let modalFocusTimer=null;
function modal(title,markup,cb,okText='Uložit'){closeMenus();delete $('modal').dataset.actionMenu;$('okModal').classList.remove('danger');$('modalTitle').textContent=title;$('modalBody').innerHTML=markup;$('modal').hidden=false;$('okModal').textContent=okText;$('cancelModal').hidden=okText==='Zavřít';window.modalOK=cb;window.modalBackHandler=null;document.getElementById('editorUnsavedConfirm')?.remove();clearTimeout(modalFocusTimer);modalFocusTimer=setTimeout(()=>{const body=$('modalBody');if(!$('modal').hidden&&!body.contains(document.activeElement))body.querySelector('input,textarea')?.focus()},90)}
$('okModal').onclick=()=>{try{if(window.modalOK?.()!==false){$('modal').hidden=true;window.modalOK=null;window.modalBackHandler=null}}catch(e){notify('Chyba: '+e.message)}};
$('cancelModal').onclick=()=>{$('modal').hidden=true;window.modalOK=null;window.modalBackHandler=null;document.getElementById('editorUnsavedConfirm')?.remove()};
function promptText(title,label,initial,done){modal(title,`<label>${escapeHtml(label)}</label><input id="promptValue" value="${escapeHtml(initial)}">`,()=>{let v=$('promptValue').value.trim();if(!v){notify('Vyplň hodnotu');return false}done(v)})}
// ImageMeter-style browser previews. Android loads only cached small JPEG
// thumbnails from /thumb/<id>, never the original full-size camera image.
// A compact, high-contrast badge for any photo containing saved annotations.
function photoEditedBadge(r){
  if(r.kind!=='photo'||!Array.isArray(r.items)||!r.items.some(item=>item&&!item.deleted))return '';
  return '<span class="photo-edited-badge" title="Fotografie obsahuje kóty nebo poznámky" aria-label="Fotografie obsahuje úpravy">'+
    '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+
    '<path d="m21 7-4-4L3 17l4 4L21 7Z"/><path d="m14 6 4 4m-6-1 4 4m-7-1 4 4"/></svg></span>';
}
function browserEntryIcon(r){
  if(r.kind==='folder'){
    return '<div class="entry-icon folder"><svg viewBox="0 0 52 44" width="51" height="43" aria-label="Složka"><path d="M2 11V7c0-2 2-3 4-3h16l5 5h20c2 0 3 1 3 3v28H2Z" fill="#dfb65d" stroke="#242424" stroke-width="2"/><path d="M2 15h48v25H2Z" fill="#ffd17a" stroke="#222" stroke-width="2"/></svg></div>';
  }
  const fallback=({photo:'▧',canvas:'▦',note:'▤',video:'▶',audio:'♫',file:'▣'}[r.kind]||'▣');
  const id=['photo','video'].includes(r.kind)&&Array.isArray(r.media)?r.media[0]:null;
  const badge=photoEditedBadge(r);
  const videoMark=r.kind==='video'?'<span class="video-thumb-play" aria-hidden="true">▶</span>':'';
  const videoFallback=r.kind==='video'?'▶':'▧';
  if(native&&id&&/^[a-zA-Z0-9_-]{3,120}$/.test(id)){
    const url='https://appassets.androidplatform.net/thumb/'+encodeURIComponent(id);
    return '<div class="entry-icon photo-preview'+(r.kind==='video'?' video-preview':'')+'"><img class="entry-thumb" src="'+url+'" alt="" loading="lazy"><span class="thumb-fallback" hidden>'+videoFallback+'</span>'+videoMark+badge+'</div>';
  }
  if(['photo','video'].includes(r.kind))return '<div class="entry-icon photo-preview'+(r.kind==='video'?' video-preview':'')+'"><span class="thumb-fallback">'+videoFallback+'</span>'+videoMark+badge+'</div>';
  return '<div class="entry-icon">'+fallback+'</div>';
}
function applyBackgroundPattern(){document.body.dataset.backgroundPattern=prefs.backgroundPattern||'Vypnuto'}
function showFolder(){applyBackgroundPattern();screen='browser';current=null;document.body.classList.remove('in-editor','in-note');closeMenus();$('browserView').hidden=false;$('browserFoot').hidden=false;$('editorView').hidden=true;$('noteView').hidden=true;$('back').textContent='☰';$('screenTitle').innerHTML=`<span class="app-title">Zaměřovač</span><small class="app-version">verze ${escapeHtml(appVersionShort)}</small>`;let path=[];let walk=currentFolder;let guard=0;while(walk&&guard++<50){let r=recById(walk);if(!r)break;path.unshift(r);walk=r.parentId;}
$('breadcrumbs').innerHTML=`<button class="crumb" data-nav="root">⌂ Domů</button>`+path.map(r=>`<span>›</span><button class="crumb" data-nav="${escapeHtml(r.id)}">${escapeHtml(r.title)}</button>`).join('');
$('breadcrumbs').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{currentFolder=b.dataset.nav==='root'?null:b.dataset.nav;showFolder()});
if(dataLoadFailed){$('items').innerHTML='<div class="empty" role="alert">Uložené zakázky se nepodařilo načíst. Zápis je zablokovaný, původní soubory zůstávají beze změny. Aplikaci nemaž ani nevymazávej její data. Zavři ji a zkus otevřít znovu; pokud chyba trvá, požádej o pomoc s obnovou zálohy.</div>';return}
let list=state.records.filter(r=>!r.deleted&&r.parentId===currentFolder).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||(sortAsc?1:-1)*a.title.localeCompare(b.title,'cs'));
$('items').innerHTML=list.length?list.map(r=>`<div class="entry" data-id="${escapeHtml(r.id)}">${browserEntryIcon(r)}<div class="entry-info"><div class="entry-title">${escapeHtml(r.title)}${(r.locked||window.isRecordLocked?.(r))?' <span class="entry-lock" title="Uzamčeno" aria-label="Uzamčeno">🔒</span>':''}</div><div class="entry-date">${r.photoTakenAt?'Pořízeno: '+escapeHtml(photoDateText(r.photoTakenAt)):dateText(r.updatedAt)}${r.hierarchyConflict?' · OPRAVENÝ CYKLUS SLOŽEK':r.conflict?' · KONFLIKTNÍ KOPIE':''}</div>${r.photoTakenAt||r.photoAddress?'<div class="entry-place" title="'+escapeHtml(photoAddressText(r))+'">📍 '+escapeHtml(photoAddressText(r))+'</div>':''}</div><button class="entry-more" data-more="${escapeHtml(r.id)}">⋮</button></div>`).join(''):`<div class="empty"><div class="big">▤</div>Zatím prázdné.<br>Pomocí ＋ vytvoříš složku, fotografii nebo poznámku.</div>`;
$('items').querySelectorAll('.entry').forEach(el=>el.onclick=(e)=>{if(e.target.closest('[data-more]')){recordActions(el.dataset.id);return}openRecord(el.dataset.id)});
$('items').querySelectorAll('.entry-thumb').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false},{once:true}));
}
function promptRenameRecord(r){
 if(window.isRecordLocked?.(r)){notify('Nejdříve odemkněte složku.');return}
 const match=['photo','video','audio','file'].includes(r.kind)?String(r.title).match(/^(.*?)(\.[A-Za-z0-9]{1,8})$/):null;
 const base=match?match[1]:r.title,suffix=match?match[2]:'';
 modal('Přejmenovat','<label>Název</label><div class="rename-inline"><input id="renameBase" value="'+escapeHtml(base)+'" autocomplete="off">'+
 (suffix?'<span class="rename-extension">'+escapeHtml(suffix)+'</span>':'')+'</div>',()=>{
  const name=$('renameBase').value.trim();
  if(!name){notify('Zadej název');return false}
  r.title=name+suffix;touch(r);save();showFolder();
 });
 setTimeout(()=>{const input=$('renameBase');if(input){input.focus();input.setSelectionRange(input.value.length,input.value.length)}},120);
}
function restoreDeleted(id,seen=new Set()){
 const r=recById(id,true);
 if(!r||!r.deleted||seen.has(id))return false;
 seen.add(id);r.deleted=false;touch(r);
 for(const child of state.records.filter(x=>x.parentId===id&&x.deleted))restoreDeleted(child.id,seen);
 return true;
}
let trashBusy=false;
function trashCleanupCount(){return native&&typeof Native.trashCleanupCount==='function'?Native.trashCleanupCount():0}
function purgeTrashRecords(ids){
 if(trashBusy||dataLoadFailed)return false;
 trashBusy=true;$('okModal').disabled=true;
 try{
  const expected=JSON.stringify(state);
  let result;
  if(native){
   if(typeof Native.purgeTrash!=='function')throw new Error('Trvalé mazání vyžaduje aktuální Android aplikaci');
   // Native rejects a stale snapshot; never overwrite a concurrent save to make it match.
   result=JSON.parse(Native.purgeTrash(persistedSnapshot,expected,JSON.stringify(ids)));
   if(result.error||!result.data)throw new Error(result.error||'Odstranění se nepodařilo');
  }else{
   const targets=new Set(ids);
   if(state.records.filter(r=>targets.has(r.id)&&r.deleted).length!==targets.size)throw new Error('Obsah koše se změnil');
   const tombstones=mergeSyncTombstones(state.syncTombstones||{},{});
   for(const record of state.records.filter(r=>targets.has(r.id)))Object.defineProperty(tombstones,record.id,{value:advanceSyncClock(mergeSyncClocks(record.syncClock||{},Object.hasOwn(tombstones,record.id)?tombstones[record.id]:{})),enumerable:true,writable:true,configurable:true});
   const next={...state,records:state.records.filter(r=>!targets.has(r.id)),syncTombstones:tombstones,trashPurgedIds:[...new Set([...(state.trashPurgedIds||[]),...targets])]};
   localStorage.setItem('zamerovac-data',JSON.stringify(next));
   result={data:next};
  }
  persistedSnapshot=result.snapshot||JSON.stringify(result.data);
  // Kept records are unchanged by purge. Preserve references held by editor/note/detail workspaces.
  const kept=new Map(state.records.map(r=>[r.id,r]));
  state={...result.data,records:result.data.records.map(r=>kept.get(r.id)||r),prefs};
  if(screen==='browser')showFolder();
  showTrash();
  notify(result.warning||'Koš byl trvale vyprázdněn');
 }catch(e){notify('Chyba: '+e.message)}
 finally{trashBusy=false;$('okModal').disabled=false}
 return false; // Keep the refreshed trash or error dialog visible.
}
function confirmTrashPurge(ids,all){
 if(trashBusy)return;
 modal(!ids.length?'Dokončit úklid koše?':all?'Vysypat koš?':'Trvale odstranit?',
  !ids.length?'<p>Zopakovat trvalé odstranění souborů dříve vysypaného koše? Aktivně používané a sdílené soubory zůstanou zachované.</p>':all?'<p>Opravdu vysypat koš? Všechny položky v koši budou trvale odstraněny a nebude možné je obnovit.</p>':
  '<p>Vybraná položka v koši a její smazané podsložky budou trvale odstraněny a nebude možné je obnovit.</p>',
  ()=>purgeTrashRecords(ids),'Trvale odstranit');
 $('okModal').classList.add('danger');
}
function showTrash(){
 closeMenus();
 const deleted=state.records.filter(r=>r.deleted),pending=trashCleanupCount();
 // Cyclic/malformed deleted parent links must not hide all trash entries.
 const roots=deleted.filter(r=>!deleted.some(p=>p.id===r.parentId));
 const root=roots.length?roots:deleted;
 const body=(root.length?root.map(r=>
  '<div class="trash-entry">'+browserEntryIcon(r)+'<div><strong>'+escapeHtml(r.title)+'</strong><small>'+escapeHtml(r.kind)+'</small></div>'+
  '<button class="outline" data-restore="'+escapeHtml(r.id)+'">Obnovit</button>'+
  '<button class="outline" data-purge="'+escapeHtml(r.id)+'">Odstranit</button></div>'
 ).join(''):'<p class="muted">Koš je prázdný.</p>')+
 '<button class="outline danger" id="emptyTrash" '+(!deleted.length||dataLoadFailed?'disabled':'')+'>Vysypat koš</button>'+
 (pending?'<p role="alert">Úklid některých souborů nebyl dokončen.</p><button class="outline" id="retryTrashCleanup">Zopakovat odstranění souborů</button>':'');
 modal('🗑️ Koš',body,()=>true,'Zavřít');
 $('emptyTrash').onclick=()=>{if(deleted.length&&!dataLoadFailed)confirmTrashPurge(deleted.map(r=>r.id),true)};
 if($('retryTrashCleanup'))$('retryTrashCleanup').onclick=()=>confirmTrashPurge([],false);
 $('modalBody').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{
  if(!restoreDeleted(b.dataset.restore)){notify('Položku se nepodařilo obnovit');return}
  const r=recById(b.dataset.restore);if(r&&r.parentId&&!recById(r.parentId))r.parentId=null;
  save();if(screen==='browser')showFolder();showTrash();notify('Položka obnovena');
 });
 $('modalBody').querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>{
  const targets=new Set([b.dataset.purge]);
  let changed=true;
  while(changed){changed=false;for(const r of deleted)if(targets.has(r.parentId)&&!targets.has(r.id)){targets.add(r.id);changed=true}}
  confirmTrashPurge([...targets],false);
 });
}
function recordActions(id){let r=recById(id);modal(r.title,`<div class="message">${escapeHtml(r.kind)} · ${dateText(r.updatedAt)}</div><div class="row wrap" style="margin-top:20px"><button class="outline" id="renameOne">Přejmenovat</button><button class="outline" id="moveOne">Přesunout</button><button class="outline" id="deleteOne">Smazat</button>${r.kind==='folder'?'<button class="outline" id="exportFolderOne">Exportovat složku ZIP</button>':''}${r.kind==='photo'?'<button class="outline" id="exportPhotoOne">Exportovat fotografii ZIP</button>':''}</div>`,()=>true,'Zavřít');$('modal').dataset.actionMenu='record';const folderExport=$('exportFolderOne');if(folderExport)folderExport.onclick=()=>{
 $('modal').hidden=true;
 let count=state.records.filter(x=>!x.deleted&&x.kind==='photo'&&(x.parentId===r.id||folderContains(r.id,x.parentId))).length;
 modal('Exportovat složku','<p>Exportovat složku <strong>'+escapeHtml(r.title)+'</strong> – '+count+' fotografií včetně podsložek, kót a příloh?</p>',()=>{
   if(native&&typeof Native.exportFolder==='function')Native.exportFolder(r.id);
   else notify('Export ZIP vyžaduje Android aplikaci');
 },'Exportovat do ZIP');
};const photoExport=$('exportPhotoOne');if(photoExport)photoExport.onclick=()=>{
 $('modal').hidden=true;
 modal('Exportovat fotografii','<p>Exportovat fotografii <strong>'+escapeHtml(r.title)+'</strong> včetně původního snímku, editovatelných kót a poznámek?</p>',()=>{
   if(native&&typeof Native.exportPhoto==='function')Native.exportPhoto(r.id);
   else notify('Export fotografie ZIP vyžaduje aktualizovanou Android aplikaci');
 },'Exportovat do ZIP');
};$('renameOne').onclick=()=>{ $('modal').hidden=true;promptRenameRecord(r)};$('deleteOne').onclick=()=>{$('modal').hidden=true;modal('Odstranit?',`<p>Přesunout „${escapeHtml(r.title)}“ do koše? Záznam se při synchronizaci označí jako odstraněný.</p>`,()=>{markDeleted(r.id);save();showFolder()},'Odstranit')};$('moveOne').onclick=()=>{if(window.isRecordLocked?.(r)){notify('Nejdříve odemkněte složku.');return}$('modal').hidden=true;let folders=state.records.filter(x=>x.kind==='folder'&&!x.deleted&&x.id!==r.id&&!folderContains(r.id,x.id));modal('Přesunout do složky',`<select id="moveWhere"><option value="">Kořen</option>${folders.map(f=>`<option value="${escapeHtml(f.id)}" ${window.isRecordLocked?.(f)?'disabled':''}>${escapeHtml(f.title)}${window.isRecordLocked?.(f)?' 🔒':''}</option>`).join('')}</select>`,()=>{const destination=$('moveWhere').value||null;if(!canWriteToFolder(destination)||window.isRecordLocked?.(r)){notify('Nejdříve odemkněte složku.');return false}if(destination&&folderContains(r.id,destination)){notify('Složku nelze přesunout do sebe');return false}r.parentId=destination;touch(r);save();showFolder()})};}
function markDeleted(id){let r=recById(id);
 if(!r||window.isRecordLocked?.(r)||state.records.some(x=>!x.deleted&&x.id!==id&&window.isRecordLocked?.(x)&&folderContains(id,x.id))){
  notify('Nejdříve odemkněte složku.');return false;
 }
 r.deleted=true;touch(r);for(let child of state.records.filter(x=>x.parentId===id&&!x.deleted))markDeleted(child.id)}
function openRecord(id){let r=recById(id);if(!r)return;if(r.kind==='folder'){currentFolder=id;showFolder();return}if(r.kind==='photo'||r.kind==='canvas'){openEditor(r);return}if(r.kind==='note'){openNote(r);return}if(r.kind==='audio'||r.kind==='video'||r.kind==='file'){openAttachment(r.media[0]);return}}
function showNewMenu(){if(!$('newMenu').hidden){closeMenus();return}if(!canWriteToFolder(currentFolder)){notify('Nejdříve odemkněte složku.');return}closeMenus();$('newMenu').hidden=false;const choices=[
['📷','Pořídit fotografii',()=>pickMedia('camera')],
['🖼️','Importovat obrázek / PDF / video',()=>pickMedia('media')],
['<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 3h9l5 5v12H5z" fill="#f3f0e7" stroke="#a8a0ba" stroke-width="1.5"/><path d="M14 3v5h5" stroke="#a8a0ba" stroke-width="1.5"/><path d="m9 16 7.6-7.6 2.4 2.4-7.6 7.6-3.4 1z" fill="#d7c2ff" stroke="#9263d5" stroke-width="1.6"/><path d="m15.2 9.8 2.4 2.4" stroke="#9263d5" stroke-width="1.6"/></svg>','Nový náčrt',()=>promptText('Nový náčrt','Název','Nový náčrt',name=>addRecord(newRecord('canvas',name)))],
['📝','Nová textová poznámka',()=>{let r=newRecord('note','Nová poznámka');if(!canWriteToFolder(r.parentId)){notify('Nejdříve odemkněte složku.');return}state.records.push(r);save();openNote(r)}],
['📁','Nová složka',()=>promptText('Nová složka','Jméno zákazníka nebo místnosti','',name=>addRecord(newRecord('folder',name)))],
['🎤','Hlasová poznámka',()=>recordVoice()],
['📎','Přidat další soubor',()=>pickMedia('file')],
['<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16v12H4z" fill="#e8bf65" stroke="#b98828" stroke-width="1.7"/><path d="M3 4h18v4H3z" fill="#ffd778" stroke="#b98828" stroke-width="1.7"/><path d="M12 11a4 4 0 1 1-3.5 5.9" stroke="#9263d5" stroke-width="2.2"/><path d="m7 12 1.5 4.9 4.8-1.1" stroke="#9263d5" stroke-width="2.2"/></svg>','Importovat zakázky ze ZIP',()=>native?Native.importBackup():notify('Obnova ZIP je dostupná v Android aplikaci')]
];
$('newMenu').innerHTML=choices.map((a,i)=>`<button class="choice" data-i="${i}"><strong>${a[0]}</strong>${a[1]}</button>`).join('');$('newMenu').querySelectorAll('button').forEach(b=>b.onclick=()=>{closeMenus();choices[+b.dataset.i][2]()})}
function pickMedia(type,handler=null){
 if(stagedMediaRequest){notify('Probíhá přidávání příloh. Počkej na dokončení.');return}
 const request={id:uid(),handler,folder:currentFolder,modal:handler&&!$('modal').hidden?$('modalBody').firstElementChild:null};stagedMediaRequest=request;
 try{if(native){if(type==='camera')Native.takePhotoForRequest(request.id);else Native.selectFilesForRequest(type,request.id);return}
 const inp=$('filePick');inp.value='';inp.accept=type==='camera'?'image/*':type==='file'?'*/*':'image/*,video/*,application/pdf,audio/*';inp.multiple=type==='file'||type==='media';if(type==='camera')inp.setAttribute('capture','environment');else inp.removeAttribute('capture');inp.click();
 }catch(error){stagedMediaRequest=null;notify('Přílohu nelze vybrat: '+error.message)}
}
async function acceptPickedMedia(request,id,mime,name,takenAt=null){
 if(!request||stagedMediaRequest!==request)return false;
 if(request.handler){if(request.modal&&($('modal').hidden||$('modalBody').firstElementChild!==request.modal)){notify('Původní dialog už je zavřený; příloha nebyla připojena jinam.');return false}if(request.handler(id,{name,mime,type:mime})===false)return false;return save()}
 return !!(await addMediaRecord(id,name,mime,takenAt,request.folder));
}
$('filePick').addEventListener('change',async(e)=>{const request=stagedMediaRequest;if(!request)return;try{for(let file of e.target.files){let mediaId=await storeMedia(file,request.id);await acceptPickedMedia(request,mediaId,file.type||'application/octet-stream',file.name)}}catch(error){notify('Příloha nebyla přidána: '+error.message)}finally{if(stagedMediaRequest===request)stagedMediaRequest=null}});
$('filePick').addEventListener('cancel',()=>{stagedMediaRequest=null});
async function addMediaRecord(id,name,mime,takenAt=null,folder=currentFolder){if(!canWriteToFolder(folder)){notify('Původní složka není dostupná nebo je uzamčená; příloha nebyla připojena jinam.');return null}const kind=mime.startsWith('image/')?'photo':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'file',r=newRecord(kind,name,folder);r.media=[id];if(kind==='photo'&&takenAt)r.photoTakenAt=takenAt;state.records.push(r);if(!save())return null;if(screen==='browser'&&currentFolder===folder){showFolder();if(kind==='photo')openEditor(r)}return r}
async function storeMedia(file,importToken=null){const id=uid(),mime=file.type||'application/octet-stream';if(importToken)await MediaImportOwnership.reserve(id,importToken);if(native){let bytes=new Uint8Array(await file.arrayBuffer());const chunkSize=48*1024;if(!Native.beginMediaChecked(id,mime,file.name||'soubor',bytes.length))throw new Error('Přílohu nelze připravit k uložení');for(let off=0;off<bytes.length;off+=chunkSize){let sub=bytes.subarray(off,off+chunkSize);let s='';for(let b of sub)s+=String.fromCharCode(b);if(!Native.appendMedia(id,btoa(s)))throw new Error('Příloha nebyla zapsána');}if(!Native.finishMedia(id))throw new Error('Příloha není uložená úplně');}
else{const db=await mediaDb();await new Promise((resolve,reject)=>{let tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=reject})}if(importToken)await MediaImportOwnership.published(id,importToken);return id}
let idb=null;function mediaDb(){if(!idb)idb=new Promise((res,rej)=>{let req=indexedDB.open('zamerovac-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>res(req.result);req.onerror=rej});return idb}
// Bounded decoded-image cache. Media IDs identify immutable originals; no edited pixels are stored here.
const decodedPhotoCache=new Map();
function loadPhotoImage(id){
 if(decodedPhotoCache.has(id)){const entry=decodedPhotoCache.get(id);decodedPhotoCache.delete(id);decodedPhotoCache.set(id,entry);return entry.promise}
 const entry={pixels:0,promise:null};
 entry.promise=assetUrl(id).then(url=>new Promise((resolve,reject)=>{
  if(!url){reject(new Error('Chybí fotografie'));return}
  const image=new Image(),release=()=>{if(url.startsWith('blob:'))URL.revokeObjectURL(url)};
  image.onload=()=>{release();entry.pixels=image.naturalWidth*image.naturalHeight;
   while(decodedPhotoCache.size>3||[...decodedPhotoCache.values()].reduce((sum,e)=>sum+e.pixels,0)>24000000)decodedPhotoCache.delete(decodedPhotoCache.keys().next().value);
   resolve(image);
  };
  image.onerror=()=>{release();reject(new Error('Fotografii nelze načíst'))};image.src=url;
 })).catch(error=>{if(decodedPhotoCache.get(id)===entry)decodedPhotoCache.delete(id);throw error});
 decodedPhotoCache.set(id,entry);return entry.promise;
}
async function assetUrl(id){if(!id)return '';if(native)return 'https://appassets.androidplatform.net/media/'+encodeURIComponent(id);let db=await mediaDb();let blob=await new Promise((res,rej)=>{let tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(id);req.onsuccess=()=>res(req.result);req.onerror=rej});return blob?URL.createObjectURL(blob):''}
async function openAttachment(id){if(!id){notify('Soubor nelze najít');return}let url=await assetUrl(id);if(native)Native.openMedia(id);else window.open(url,'_blank')}
const noteViewBaselines=new WeakMap();let noteCheckSaveTimer=null,noteRecordingOwner=null;
function noteChanged(debounce=false){if(!noteActive)return;const record=noteActive;touch(record);clearTimeout(noteCheckSaveTimer);if(debounce)noteCheckSaveTimer=setTimeout(()=>{if(state.records.includes(record))save();},350);else save();}
function openNote(r){noteViewBaselines.set(r,{value:canonicalSavedValue(r),title:String(r.title??''),text:String(r.text||'')});screen='note';document.body.classList.add('in-note');noteActive=r;$('browserView').hidden=true;$('browserFoot').hidden=true;$('noteView').hidden=false;$('editorView').hidden=true;$('noteTitle').value=r.title;$('noteText').value=r.text||'';renderChecks();renderNoteAttachments()}
function renderChecks(){$('checkItems').innerHTML=(noteActive.checks||[]).map((c,i)=>`<div class="checkRow"><input type="checkbox" data-check="${i}" ${c.done?'checked':''}><input type="text" data-text="${i}" value="${escapeHtml(c.text)}" aria-label="Úkol"><button data-delete="${i}">×</button></div>`).join('');$('checkItems').querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>{noteActive.checks[+el.dataset.check].done=el.checked;noteChanged()});$('checkItems').querySelectorAll('[data-text]').forEach(el=>el.oninput=()=>{noteActive.checks[+el.dataset.text].text=el.value;noteChanged(true)});$('checkItems').querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{noteActive.checks.splice(+el.dataset.delete,1);noteChanged();renderChecks()});if(window.isRecordLocked?.(noteActive))$('checkItems').querySelectorAll('input,button').forEach(el=>el.disabled=true)}
function renderNoteAttachments(){$('noteAttachments').innerHTML=(noteActive.media||[]).map((m,i)=>`<div class="attachRow"><button data-open="${escapeHtml(m)}">▣ Příloha ${i+1}</button><button data-remove="${i}">×</button></div>`).join('');$('noteAttachments').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openAttachment(b.dataset.open));$('noteAttachments').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{noteActive.media.splice(+b.dataset.remove,1);noteChanged();renderNoteAttachments()});if(window.isRecordLocked?.(noteActive))$('noteAttachments').querySelectorAll('[data-remove]').forEach(el=>el.disabled=true)}
function saveNote(){if(!noteActive)return;if(!finishNoteRecording())return false;clearTimeout(noteCheckSaveTimer);const baseline=noteViewBaselines.get(noteActive);if(!baseline||$('noteTitle').value!==baseline.title)noteActive.title=$('noteTitle').value.trim()||'Poznámka';if(!baseline||$('noteText').value!==baseline.text)noteActive.text=$('noteText').value;if(!baseline||canonicalSavedValue(noteActive)!==baseline.value)touch(noteActive);if(!save())return false;noteActive=null;showFolder();return true}
$('saveNote').onclick=saveNote;$('noteBack').onclick=saveNote;$('addCheck').onclick=()=>{noteActive.checks.push({text:'',done:false});noteChanged();renderChecks();let fields=$('checkItems').querySelectorAll('[data-text]');fields[fields.length-1]?.focus()};$('attachFile').onclick=()=>{const owner=noteActive;if(!owner)return;pickMedia('media',(id)=>{const target=recById(owner.id);if(!target||target.deleted||target.kind!=='note'||window.isRecordLocked?.(target)){notify('Poznámka není dostupná nebo je uzamčena; příloha nebyla připojena.');return;}target.media.push(id);touch(target);save();if(noteActive===target)renderNoteAttachments()})};
$('recordAudio').onclick=recordVoice;
window.__audioPermissionDenied=()=>{window.__audioPermissionRetry=null;notify('Mikrofon není povolen. Povol jej v nastavení aplikace.');};
function finishNoteRecording(){
 window.__audioPermissionRetry=null;if(!window.recording)return true;
 const id=window.recording,owner=noteRecordingOwner,recorded=Native.stopAudio();window.recording=null;noteRecordingOwner=null;$('recordAudio').textContent='● Hlasová poznámka';
 if(!recorded){if(window.PendingAudio)window.PendingAudio.retained();else notify('Záznam hlasu nebyl bezpečně uložen. Poznámka zůstává otevřená.');return false}
 const target=owner&&state.records.find(r=>r===owner);
 if(!target||target.deleted||target.kind!=='note'||window.isRecordLocked?.(target)){notify('Původní poznámka není dostupná nebo je uzamčená; hlas nebyl připojen k jiné poznámce.');return false}
 if(!target.media.includes(id))target.media.push(id);touch(target);if(!save())return false;if(noteActive===target)renderNoteAttachments();return true;
}
function recordVoice(){
 if(!native){notify('V prohlížeči použij možnost přidat zvukový soubor.');const owner=noteActive;pickMedia('file',(id)=>{if(owner&&state.records.includes(owner)&&!window.isRecordLocked?.(owner)){owner.media.push(id);touch(owner);save();if(noteActive===owner)renderNoteAttachments()}});return}
 if(window.recording){if(finishNoteRecording())notify('Zvuková poznámka uložena');return}
 const owner=noteActive,id=uid();if(!owner)return;
 const start=()=>{if(noteActive!==owner||!state.records.includes(owner)||owner.deleted||window.isRecordLocked?.(owner))return;if(!Native.startAudio(id))return;window.__audioPermissionRetry=null;noteRecordingOwner=owner;window.recording=id;$('recordAudio').textContent='■ Zastavit záznam';notify('Nahrávání spuštěno')};window.__audioPermissionRetry=start;start();
}
$('createBtn').onclick=showNewMenu;$('galleryBtn').onclick=()=>pickMedia('media');
function showAppMenu(id,items){
  const el=$(id),open=!el.hidden;closeMenus();if(open)return;
  el.innerHTML=items.map((o,i)=>'<button class="appMenuItem" data-action="'+i+'">'+o[0]+'</button>').join('');
  el.querySelectorAll('button').forEach(btn=>btn.onclick=()=>{closeMenus();items[+btn.dataset.action][1]()});
  el.hidden=false;
}
$('back').onclick=()=>showAppMenu('navMenu',[
  ['⌂  Domů',()=>{currentFolder=null;showFolder()}],
  ['⚙  Nastavení',()=>toggleSettings()],
  ['☁  Google Disk',()=>window.openZamerovacPeers?.()],
  ['ⓘ  O Zaměřovači',()=>modal('O Zaměřovači','<p>Vlastní aplikace pro zaměřování nábytku.</p><p>Aktuální verze: <b>'+escapeHtml(appVersion)+'</b></p>',()=>true,'Zavřít')]
]);
$('sortBtn').onclick=()=>{sortAsc=!sortAsc;$('sortBtn').textContent=sortAsc?'ᴬ↓ᶻ':'ᶻ↓ᴬ';showFolder()};
function showOverflow(){showAppMenu('overflowMenu',[
  ['Nastavení',()=>toggleSettings()],['Seřadit A–Z / Z–A',()=>{$('sortBtn').click()}],
  ['Nová složka',()=>promptText('Nová složka','Jméno zákazníka nebo místnosti','',name=>addRecord(newRecord('folder',name)))],
  ['Google Disk',()=>window.openZamerovacPeers?.()],['Nápověda',()=>window.openZamerovacHelp?.()]
]);}
$('settingsBtn').onclick=showOverflow;$('searchBtn').onclick=()=>promptText('Hledat zakázku','Název','',val=>{let found=state.records.find(r=>!r.deleted&&r.title.toLocaleLowerCase('cs').includes(val.toLocaleLowerCase('cs')));if(found){currentFolder=found.parentId;showFolder();[...document.querySelectorAll('.entry')].find(el=>el.dataset.id===found.id)?.scrollIntoView()}else notify('Nenašel jsem žádnou odpovídající položku')});
function toggleSettings(){$('settingsPanel').hidden=!$('settingsPanel').hidden;if(!$('settingsPanel').hidden)renderSettings()}
$('closeSettings').onclick=toggleSettings;
function renderSettings(){const spec=[['Editor','Lupa při posouvání bodů','loupe','bool'],['Editor','Zvětšení lupy','loupeZoom','num',2,6],['Editor','Přichytávání k existujícím bodům','snapPoints','bool'],['Editor','Pomocný rastr','snapGrid','bool'],['Editor','Zobrazit mřížku','showGrid','bool'],['Editor','Rozestup rastru (obrazové body)','gridStep','num',5,300],['Editor','Přichytávání vodorovně / svisle','snapHorizontal','bool'],['Editor','Přichytávání k rohům','snapCorners','bool'],['Editor','Přichytávání k obrysům','snapContours','bool'],['Editor','Přichytávání na pravý úhel','snapRightAngle','bool'],['Editor','Citlivost přesouvání','moveSensitivity','num',0.2,3],['Rozměry','Jednotky','unit','select',['mm','cm','m','in']],['Rozměry','Desetinná místa','decimals','num',0,3],['Vzhled','Pozadí přehledu','backgroundPattern','select',['Vypnuto','Jemné tečky','Jemná mřížka']],['Vzhled','Barva nástrojů','color','color'],['Vzhled','Tloušťka čar','lineWidth','num',1,12],['Vzhled','Velikost textu','fontSize','num',10,42],['Vzhled','Vibrace při delším podržení','vibration','bool'],['Vzhled','Trvale zapnutý displej','keepAwake','bool'],['Vzhled','Celá obrazovka','fullScreen','bool'],['Vzhled','Přednastavené texty','presets','text'],['Vzhled','Otevřít klávesnici u nové poznámky','autoText','bool'],['Cloud','Automatická synchronizace','autoSync','bool'],['Cloud','Synchronizovat pouze na Wi-Fi','wifiOnly','bool']];let category='';$('settingsContent').innerHTML=spec.map(row=>{let [group,label,key,type]=row;let head=group!==category?`<div class="setGroup">${group}</div>`:'';category=group;let v=prefs[key];let control=type==='bool'?`<input type="checkbox" data-setting="${key}" ${v?'checked':''}>`:type==='select'?`<select data-setting="${key}">${row[4].map(s=>`<option ${v===s?'selected':''}>${s}</option>`).join('')}</select>`:type==='color'?`<input type="color" data-setting="${key}" value="${v}">`:type==='text'?`<input type="text" data-setting="${key}" value="${escapeHtml(v)}">`:`<input type="number" data-setting="${key}" min="${row[4]}" max="${row[5]}" step="any" value="${v}">`;return head+`<label class="setting"><span>${label}</span>${control}</label>`}).join('')+`<div class="setGroup">Systémová složka synchronizace</div><button class="setting" style="width:100%" id="chooseCloud">Vybrat systémovou složku</button><button class="setting" style="width:100%" id="syncCloud">Synchronizovat nyní</button><div class="setGroup">Bluetooth</div><button class="setting" style="width:100%" id="chooseLaser">Připojit měřič</button><div class="setGroup">${window.ZamerovacI18n.t('language.group')}</div><button class="setting" style="width:100%" id="appLanguageSetting" type="button" aria-label="${window.ZamerovacI18n.t('language.setting')}, ${window.ZamerovacI18n.t('language.czech')}"><span>🌐 ${window.ZamerovacI18n.t('language.setting')}</span><strong>${window.ZamerovacI18n.t('language.czech')}</strong></button><div class="setGroup">O aplikaci</div><div class="setting" id="appVersionInfo"><span>Verze Zaměřovače</span><strong>${escapeHtml(appVersion)}</strong></div><div style="height:40px"></div>`;
$('settingsContent').querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{let key=el.dataset.setting,previous=prefs[key],previousFrequency=prefs.syncFrequency;prefs[key]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;if(key==='autoSync'&&prefs.autoSync&&prefs.syncFrequency==='manual')prefs.syncFrequency='auto';if(!save()){prefs[key]=previous;prefs.syncFrequency=previousFrequency;renderSettings();return}if(!applyNativePrefs()){prefs[key]=previous;prefs.syncFrequency=previousFrequency;save();renderSettings();return}applyBackgroundPattern();if(key==='color')$('lineColor').value=prefs.color;if(screen==='editor')paint()});$('chooseCloud').onclick=chooseCloud;$('syncCloud').onclick=syncCloud;$('chooseLaser').onclick=()=>native?Native.connectLaser():notify('Bluetooth laser vyžaduje Android aplikaci');$('appLanguageSetting').onclick=showLanguagePicker}
/* Data-backed locale list, with only Czech available until translations are real. */
function showLanguagePicker(){
 const api=window.ZamerovacI18n;
 const langs=api?.availableLanguages()||[{tag:'cs',autonym:'Čeština',flag:'🇨🇿',dir:'ltr'}];
 const selectedTag=api?.normalizeLanguage(prefs.uiLanguage)||'cs';
 modal(window.ZamerovacI18n.t('language.title'),'<div id="languageSearchWrap" '+(langs.length<5?'hidden':'')+'><label for="languageSearch">'+window.ZamerovacI18n.t('language.search')+'</label><input id="languageSearch" type="search"></div><div id="languageOptions" role="radiogroup" aria-label="'+window.ZamerovacI18n.t('language.setting')+'"></div>',()=>true,'Zavřít');
 const results=$('languageOptions'),search=$('languageSearch');
 const render=()=>{
   const found=api?.findLanguages(search?.value||'')||langs;
   results.innerHTML=found.map(l=>'<button type="button" class="setting language-option" data-language="'+escapeHtml(l.tag)+'" role="radio" aria-checked="'+(l.tag===selectedTag?'true':'false')+'" dir="'+escapeHtml(l.dir||'ltr')+'"><span>'+escapeHtml((l.flag||'')+' '+l.autonym)+'</span><strong>'+(l.tag===selectedTag?'✓ '+window.ZamerovacI18n.t('language.selected'):'')+'</strong></button>').join('')||'<p>'+window.ZamerovacI18n.t('language.empty')+'</p>';
   results.querySelectorAll('[data-language]').forEach(btn=>btn.onclick=()=>{
     const tag=btn.dataset.language;if(!langs.some(l=>l.tag===tag))return;
     if(prefs.uiLanguage!==tag){prefs.uiLanguage=tag;save()}
     $('modal').hidden=true;
   });
 };
 if(search)search.oninput=render;render();
}
function applyNativePrefs(){try{if(native&&Native.configure(JSON.stringify({keepAwake:prefs.keepAwake,fullscreen:prefs.fullScreen,wifiOnly:prefs.wifiOnly,autoSync:prefs.autoSync,syncFrequency:prefs.syncFrequency||'auto'}))===false)throw Error('Android nepotvrdil nastavení');return true}catch(e){notify('Nastavení nebylo potvrzeno. Zkus změnu znovu.');return false}}
function chooseCloud(){if(native)Native.selectCloudFolder();else notify('Systémovou složku synchronizace vybereš v Android verzi.')}
function syncCloud(){if(native){Native.syncCloud();notify('Spouštím synchronizaci…')}else notify('Synchronizace Google Disku vyžaduje Android verzi.')}
$('cloudBtn').onclick=()=>native?modal('Google Disk','<p>Vyber složku na Google Disku, ve které budou projekty všech zařízení. Synchronizace funguje i po návratu z offline režimu.</p><div class="row wrap"><button class="outline" id="cloudChoose">Vybrat složku</button><button class="outline" id="cloudSync">Synchronizovat</button></div>',()=>true,'Zavřít'):notify('Cloud je dostupný v Android aplikaci');
document.addEventListener('click',e=>{if(e.target.id==='cloudChoose'){Native.selectCloudFolder();$('modal').hidden=true}if(e.target.id==='cloudSync'){Native.syncCloud();$('modal').hidden=true}});
$('bluetoothBtn').onclick=()=>native?Native.connectLaser():notify('Laser se připojuje v Android aplikaci');
window.onNativeMedia=async(id,mime,name,takenAt,token)=>{const request=stagedMediaRequest;if(!request||request.id!==token)return false;try{return await acceptPickedMedia(request,id,mime,name,takenAt)}catch(error){notify('Příloha nebyla připojena: '+error.message);return false}};
window.onNativePhotoAddress=(mediaId,address)=>{
  const record=state.records.find(r=>r.kind==='photo'&&Array.isArray(r.media)&&r.media.includes(mediaId));
  if(!record||record.photoAddressConfirmed)return;
  record.photoAddress=String(address||'').trim();
  record.photoAddressChecked=true;
  touch(record);save();
  if(screen==='browser')showFolder();
  else if(screen==='editor'&&current?.id===record.id){
    const meta=$('editorPhotoMeta');
    if(meta){meta.textContent=photoDetailsText(record);meta.title=meta.textContent;}
  }
};
window.onNativeMediaDone=token=>{if(stagedMediaRequest?.id===token)stagedMediaRequest=null};
window.onNativeMediaProgress=(token,done,total)=>{if(stagedMediaRequest?.id===token)notify('Přidávání příloh: '+done+'/'+total)};
window.onNativeSync=(text)=>{
 try{
  const result=JSON.parse(text);
  if(result.data){
   // Read the current confirmed database, never replay a stale callback snapshot.
   const snapshot=native?Native.loadData():JSON.stringify(result.data),disk=JSON.parse(snapshot);
   if(disk.schema!==1||!Array.isArray(disk.records))throw new Error('Zakázky nelze bezpečně načíst');
   const base=persistedSnapshot?JSON.parse(persistedSnapshot):initial;
   applySavedState(reconcileSavedState(base,state,disk));persistedSnapshot=snapshot;
   if(!save())return false;
   if(screen==='browser')showFolder();
  }
  const conflicts=result.data?state.records.filter(r=>r.conflict).length:0;
  notify((result.message||'Synchronizace dokončena')+(conflicts?' · zachované konfliktní kopie: '+conflicts:''));return true;
 }catch(e){notify('Synchronizace: '+e.message);return false}
};
window.onLaserValue=(value,unit)=>{
 // Přenos mimo editor: uložit poslední přijatou hodnotu do paměti.
 // V editoru provede přímý zápis __handleLaserAuto v upgrade.js.
 window.lastLaser={value:String(value),unit:String(unit||'mm'),receivedAt:Date.now()};
 notify('Bosch: '+value+' '+(unit||'mm')+' – pro zápis otevři a vyber kótu');
};
window.onNativeError=message=>notify('Chyba: '+message);
window.handleAndroidBack=()=>{
  if(!$('modal').hidden){if(typeof window.modalBackHandler==='function'){window.modalBackHandler();return 'handled'}$('modal').hidden=true;window.modalOK=null;return 'handled';}
  if(!$('settingsPanel').hidden){$('settingsPanel').hidden=true;return 'handled';}
  for(const id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow'])if(!$(id).hidden){$(id).hidden=true;return 'handled';}
  if(screen==='editor'){exitEditor();return 'handled';}
  if(screen==='note'){saveNote();return 'handled';}
  if(currentFolder){currentFolder=recById(currentFolder)?.parentId||null;showFolder();return 'handled';}
  return 'root';
};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();window.handleAndroidBack()}if(e.ctrlKey&&e.key==='z'&&screen==='editor'){e.preventDefault();undoEditor()}if(e.ctrlKey&&e.key==='y'&&screen==='editor'){e.preventDefault();redoEditor()}});
// Editor functions supplied by editor.js below.
$('lineColor').value=prefs.color;
showFolder();applyNativePrefs();

window.ZamerovacPeerConflictCount=()=>state.records.filter(record=>(record.conflict||record.hierarchyConflict)&&!record.deleted).length;
