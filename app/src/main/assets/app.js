/* Zaměřovač – independent, original implementation. All coordinates in image pixels. */
'use strict';
const $=id=>document.getElementById(id);
const native=!!window.Native;
const appVersion=native&&typeof Native.getAppVersion==='function'?Native.getAppVersion():'web';
const appVersionShort=appVersion.replace(/-test$/,'');
const uid=()=>crypto.randomUUID?crypto.randomUUID():('id-'+Date.now()+'-'+Math.random().toString(36).slice(2));
const initialPrefs={unit:'mm',decimals:0,laserDecimals:'auto',laserRounding:'none',color:'#f7dc27',lineWidth:2,fontSize:17,loupe:true,loupeZoom:2,repeatDrawing:false,snapGrid:false,gridStep:40,snapPoints:true,snapHorizontal:true,snapCorners:true,snapContours:true,snapRightAngle:true,keepAwake:false,vibration:true,fullScreen:false,autoText:true,autoSync:true,wifiOnly:false,moveSensitivity:1,presets:'Zásuvka;Voda;Odpad;Elektro;Výška parapetu',toolOrder:''};
const initial={schema:1,records:[],prefs:{...initialPrefs},created:new Date().toISOString()};
let state=initial;
try{const saved=native?Native.loadData():localStorage.getItem('zamerovac-data');if(saved)state={...initial,...JSON.parse(saved)};}catch(e){console.warn('Cannot load database',e)}
state.prefs={...initialPrefs,...(state.prefs||{})};
const prefs=state.prefs;
let sortAsc=true;let currentFolder=null,screen='browser',current=null,noteActive=null,mode='dimension',selected=null,stagedFileHandler=null,editStack=[],redoStack=[],lineDraft=[],stageImg=null,photoSize={w:1400,h:900},view={zoom:1,dx:0,dy:0},drag=null,pointers=new Map(),magnifierPoint=null,stageCanvas=$('drawCanvas'),ctx=stageCanvas.getContext('2d'),loupeCtx=$('loupe').getContext('2d'),autoSaving=false;
const stamp=()=>new Date().toISOString();
function touch(rec){rec.rev=uid();rec.updatedAt=stamp();}
function save(){if(native){Native.saveData(JSON.stringify(state));}else{localStorage.setItem('zamerovac-data',JSON.stringify(state));}}
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
function recById(id){return state.records.find(r=>r.id===id&&!r.deleted)}
function newRecord(kind,title,parentId=currentFolder){return {id:uid(),kind,title,parentId,createdAt:stamp(),updatedAt:stamp(),rev:uid(),media:[],items:[],text:'',checks:[],width:1400,height:900,deleted:false}}
function addRecord(r){state.records.push(r);save();showFolder();return r}
function closeMenus(){for(let id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow'])$(id).hidden=true}
function modal(title,markup,cb,okText='Uložit'){$('modalTitle').textContent=title;$('modalBody').innerHTML=markup;$('modal').hidden=false;$('okModal').textContent=okText;$('cancelModal').hidden=okText==='Zavřít';window.modalOK=cb;setTimeout(()=>$('modalBody').querySelector('input,textarea')?.focus(),90)}
$('okModal').onclick=()=>{try{if(window.modalOK?.()!==false){$('modal').hidden=true;window.modalOK=null}}catch(e){notify('Chyba: '+e.message)}};
$('cancelModal').onclick=()=>{$('modal').hidden=true;window.modalOK=null};
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
  const id=r.kind==='photo'&&Array.isArray(r.media)?r.media[0]:null;
  const badge=photoEditedBadge(r);
  if(native&&id&&/^[a-zA-Z0-9_-]{3,120}$/.test(id)){
    const url='https://appassets.androidplatform.net/thumb/'+encodeURIComponent(id);
    return '<div class="entry-icon photo-preview"><img class="entry-thumb" src="'+url+'" alt="" loading="lazy"><span class="thumb-fallback" hidden>▧</span>'+badge+'</div>';
  }
  if(r.kind==='photo')return '<div class="entry-icon photo-preview"><span class="thumb-fallback">▧</span>'+badge+'</div>';
  return '<div class="entry-icon">'+fallback+'</div>';
}
function showFolder(){screen='browser';current=null;document.body.classList.remove('in-editor','in-note');closeMenus();$('browserView').hidden=false;$('browserFoot').hidden=false;$('editorView').hidden=true;$('noteView').hidden=true;$('back').textContent='☰';$('screenTitle').innerHTML=`<span class="app-title">Zaměřovač</span><small class="app-version">verze ${escapeHtml(appVersionShort)}</small>`;let path=[];let walk=currentFolder;let guard=0;while(walk&&guard++<50){let r=recById(walk);if(!r)break;path.unshift(r);walk=r.parentId;}
$('breadcrumbs').innerHTML=`<button class="crumb" data-nav="root">⌂ Domů</button>`+path.map(r=>`<span>›</span><button class="crumb" data-nav="${r.id}">${escapeHtml(r.title)}</button>`).join('');
$('breadcrumbs').querySelectorAll('[data-nav]').forEach(b=>b.onclick=()=>{currentFolder=b.dataset.nav==='root'?null:b.dataset.nav;showFolder()});
let list=state.records.filter(r=>!r.deleted&&r.parentId===currentFolder).sort((a,b)=>(a.kind==='folder'?0:1)-(b.kind==='folder'?0:1)||(sortAsc?1:-1)*a.title.localeCompare(b.title,'cs'));
$('items').innerHTML=list.length?list.map(r=>`<div class="entry" data-id="${r.id}">${browserEntryIcon(r)}<div class="entry-info"><div class="entry-title">${escapeHtml(r.title)}${(r.locked||window.isRecordLocked?.(r))?' <span class="entry-lock" title="Uzamčeno" aria-label="Uzamčeno">🔒</span>':''}</div><div class="entry-date">${r.photoTakenAt?'Pořízeno: '+escapeHtml(photoDateText(r.photoTakenAt)):dateText(r.updatedAt)}${r.conflict?' · KONFLIKTNÍ KOPIE':''}</div>${r.photoTakenAt||r.photoAddress?'<div class="entry-place" title="'+escapeHtml(photoAddressText(r))+'">📍 '+escapeHtml(photoAddressText(r))+'</div>':''}</div><button class="entry-more" data-more="${r.id}">⋮</button></div>`).join(''):`<div class="empty"><div class="big">▤</div>Zatím prázdné.<br>Pomocí ＋ vytvoříš složku, fotografii nebo poznámku.</div>`;
$('items').querySelectorAll('.entry').forEach(el=>el.onclick=(e)=>{if(e.target.closest('[data-more]')){recordActions(el.dataset.id);return}openRecord(el.dataset.id)});
$('items').querySelectorAll('.entry-thumb').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;img.nextElementSibling.hidden=false},{once:true}));
}
function promptRenameRecord(r){
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
function restoreDeleted(id){
 const r=recById(id);if(!r)return;
 r.deleted=false;touch(r);
 for(const child of state.records.filter(x=>x.parentId===id&&x.deleted))restoreDeleted(child.id);
}
function removeDeletedForever(id){
 const children=new Set([id]);
 let count=0;
 while(count++<60){let changed=false;for(const r of state.records){
  if(r.parentId&&children.has(r.parentId)&&!children.has(r.id)){children.add(r.id);changed=true}
 }if(!changed)break}
 state.records=state.records.filter(r=>!children.has(r.id));
}
function showTrash(){
 closeMenus();
 const root=state.records.filter(r=>r.deleted&&!state.records.some(p=>p.id===r.parentId&&p.deleted));
 const body=root.length?root.map(r=>
  '<div class="trash-entry"><div><strong>'+escapeHtml(r.title)+'</strong><small>'+escapeHtml(r.kind)+'</small></div>'+
  '<button class="outline" data-restore="'+escapeHtml(r.id)+'">Obnovit</button>'+
  '<button class="outline" data-purge="'+escapeHtml(r.id)+'">Odstranit</button></div>'
 ).join(''):'<p class="muted">Koš je prázdný.</p>';
 modal('🗑️ Koš',body,()=>true,'Zavřít');
 $('modalBody').querySelectorAll('[data-restore]').forEach(b=>b.onclick=()=>{
  restoreDeleted(b.dataset.restore);
  const r=recById(b.dataset.restore);if(r&&r.parentId&&!recById(r.parentId))r.parentId=null;
  save();showTrash();notify('Položka obnovena');
 });
 $('modalBody').querySelectorAll('[data-purge]').forEach(b=>b.onclick=()=>{
  const r=recById(b.dataset.purge);
  if(!r)return;
  $('modal').hidden=true;
  modal('Trvale odstranit?', '<p>Odstranit „'+escapeHtml(r.title)+'“ ze seznamu bez možnosti obnovení?</p>',()=>{
   removeDeletedForever(r.id);save();showFolder();return true;
  },'Odstranit');
 });
}
function recordActions(id){let r=recById(id);modal(r.title,`<div class="message">${escapeHtml(r.kind)} · ${dateText(r.updatedAt)}</div><div class="row wrap" style="margin-top:20px"><button class="outline" id="renameOne">Přejmenovat</button><button class="outline" id="moveOne">Přesunout</button><button class="outline" id="deleteOne">Smazat</button>${r.kind==='folder'?'<button class="outline" id="exportFolderOne">Exportovat složku ZIP</button>':''}</div>`,()=>true,'Zavřít');const folderExport=$('exportFolderOne');if(folderExport)folderExport.onclick=()=>{if(native){$('modal').hidden=true;Native.exportFolder(r.id)}else notify('Export složky do ZIP vyžaduje Android aplikaci')};$('renameOne').onclick=()=>{ $('modal').hidden=true;promptRenameRecord(r)};$('deleteOne').onclick=()=>{$('modal').hidden=true;modal('Odstranit?',`<p>Přesunout „${escapeHtml(r.title)}“ do koše? Záznam se při synchronizaci označí jako odstraněný.</p>`,()=>{markDeleted(r.id);save();showFolder()},'Odstranit')};$('moveOne').onclick=()=>{$('modal').hidden=true;let folders=state.records.filter(x=>x.kind==='folder'&&!x.deleted&&x.id!==r.id);modal('Přesunout do složky',`<select id="moveWhere"><option value="">Kořen</option>${folders.map(f=>`<option value="${f.id}">${escapeHtml(f.title)}</option>`).join('')}</select>`,()=>{r.parentId=$('moveWhere').value||null;touch(r);save();showFolder()})};}
function markDeleted(id){let r=recById(id);if(!r)return;r.deleted=true;touch(r);for(let child of state.records.filter(x=>x.parentId===id&&!x.deleted))markDeleted(child.id)}
function openRecord(id){let r=recById(id);if(!r)return;if(r.kind==='folder'){currentFolder=id;showFolder();return}if(r.kind==='photo'||r.kind==='canvas'){openEditor(r);return}if(r.kind==='note'){openNote(r);return}if(r.kind==='audio'||r.kind==='video'||r.kind==='file'){openAttachment(r.media[0]);return}}
function showNewMenu(){closeMenus();$('newMenu').hidden=false;const choices=[
['📷','Pořídit fotografii',()=>pickMedia('camera')],
['🖼️','Importovat obrázek / PDF / video',()=>pickMedia('media')],
['🎨','Nové plátno',()=>promptText('Nové plátno','Název','Nový náčrt',name=>addRecord(newRecord('canvas',name)))],
['📝','Nová textová poznámka',()=>{let r=newRecord('note','Nová poznámka');state.records.push(r);save();openNote(r)}],
['📁','Nová složka',()=>promptText('Nová složka','Jméno zákazníka nebo místnosti','',name=>addRecord(newRecord('folder',name)))],
['🎤','Hlasová poznámka',()=>recordVoice()],
['📎','Přidat další soubor',()=>pickMedia('file')],
['<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 8h16v12H4z" fill="#e8bf65" stroke="#b98828" stroke-width="1.7"/><path d="M3 4h18v4H3z" fill="#ffd778" stroke="#b98828" stroke-width="1.7"/><path d="M12 11a4 4 0 1 1-3.5 5.9" stroke="#9263d5" stroke-width="2.2"/><path d="m7 12 1.5 4.9 4.8-1.1" stroke="#9263d5" stroke-width="2.2"/></svg>','Importovat zakázky ze ZIP',()=>native?Native.importBackup():notify('Obnova ZIP je dostupná v Android aplikaci')]
];
$('newMenu').innerHTML=choices.map((a,i)=>`<button class="choice" data-i="${i}"><strong>${a[0]}</strong>${a[1]}</button>`).join('');$('newMenu').querySelectorAll('button').forEach(b=>b.onclick=()=>{closeMenus();choices[+b.dataset.i][2]()})}
function pickMedia(type,handler=null){stagedFileHandler=handler;if(native&&type==='camera'){Native.takePhoto();return}if(native){Native.selectFiles(type);return}const inp=$('filePick');inp.value='';inp.accept=type==='camera'?'image/*':type==='file'?'*/*':'image/*,video/*,application/pdf,audio/*';inp.multiple=type==='file'||type==='media';if(type==='camera')inp.setAttribute('capture','environment');else inp.removeAttribute('capture');inp.click()}
$('filePick').addEventListener('change',async(e)=>{for(let file of e.target.files){let mediaId=await storeMedia(file);if(stagedFileHandler)stagedFileHandler(mediaId,file);else addMediaRecord(mediaId,file.name,file.type)}stagedFileHandler=null});
async function addMediaRecord(id,name,mime,takenAt=null){const kind=mime.startsWith('image/')?'photo':mime.startsWith('video/')?'video':mime.startsWith('audio/')?'audio':'file';let r=newRecord(kind,name);r.media=[id];if(kind==='photo'&&takenAt)r.photoTakenAt=takenAt;addRecord(r);if(kind==='photo')openEditor(r)}
async function storeMedia(file){const id=uid(),mime=file.type||'application/octet-stream';if(native){let bytes=new Uint8Array(await file.arrayBuffer());const chunkSize=48*1024;Native.beginMedia(id,mime,file.name||'soubor');for(let off=0;off<bytes.length;off+=chunkSize){let sub=bytes.subarray(off,off+chunkSize);let s='';for(let b of sub)s+=String.fromCharCode(b);Native.appendMedia(id,btoa(s));}Native.finishMedia(id);}
else{const db=await mediaDb();await new Promise((resolve,reject)=>{let tx=db.transaction('files','readwrite');tx.objectStore('files').put(file,id);tx.oncomplete=resolve;tx.onerror=reject})}return id}
let idb=null;function mediaDb(){if(!idb)idb=new Promise((res,rej)=>{let req=indexedDB.open('zamerovac-media',1);req.onupgradeneeded=()=>req.result.createObjectStore('files');req.onsuccess=()=>res(req.result);req.onerror=rej});return idb}
async function assetUrl(id){if(!id)return '';if(native)return 'https://appassets.androidplatform.net/media/'+encodeURIComponent(id);let db=await mediaDb();let blob=await new Promise((res,rej)=>{let tx=db.transaction('files','readonly'),req=tx.objectStore('files').get(id);req.onsuccess=()=>res(req.result);req.onerror=rej});return blob?URL.createObjectURL(blob):''}
async function openAttachment(id){if(!id){notify('Soubor nelze najít');return}let url=await assetUrl(id);if(native)Native.openMedia(id);else window.open(url,'_blank')}
function openNote(r){screen='note';document.body.classList.add('in-note');noteActive=r;$('browserView').hidden=true;$('browserFoot').hidden=true;$('noteView').hidden=false;$('editorView').hidden=true;$('noteTitle').value=r.title;$('noteText').value=r.text||'';renderChecks();renderNoteAttachments()}
function renderChecks(){$('checkItems').innerHTML=(noteActive.checks||[]).map((c,i)=>`<div class="checkRow"><input type="checkbox" data-check="${i}" ${c.done?'checked':''}><input type="text" data-text="${i}" value="${escapeHtml(c.text)}" aria-label="Úkol"><button data-delete="${i}">×</button></div>`).join('');$('checkItems').querySelectorAll('[data-check]').forEach(el=>el.onchange=()=>noteActive.checks[+el.dataset.check].done=el.checked);$('checkItems').querySelectorAll('[data-text]').forEach(el=>el.oninput=()=>noteActive.checks[+el.dataset.text].text=el.value);$('checkItems').querySelectorAll('[data-delete]').forEach(el=>el.onclick=()=>{noteActive.checks.splice(+el.dataset.delete,1);renderChecks()})}
function renderNoteAttachments(){$('noteAttachments').innerHTML=(noteActive.media||[]).map((m,i)=>`<div class="attachRow"><button data-open="${m}">▣ Příloha ${i+1}</button><button data-remove="${i}">×</button></div>`).join('');$('noteAttachments').querySelectorAll('[data-open]').forEach(b=>b.onclick=()=>openAttachment(b.dataset.open));$('noteAttachments').querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{noteActive.media.splice(+b.dataset.remove,1);renderNoteAttachments()})}
function saveNote(){if(!noteActive)return;noteActive.title=$('noteTitle').value.trim()||'Poznámka';noteActive.text=$('noteText').value;touch(noteActive);save();noteActive=null;showFolder()}
$('saveNote').onclick=saveNote;$('noteBack').onclick=saveNote;$('addCheck').onclick=()=>{noteActive.checks.push({text:'',done:false});renderChecks();let fields=$('checkItems').querySelectorAll('[data-text]');fields[fields.length-1]?.focus()};$('attachFile').onclick=()=>pickMedia('media',(id)=>{noteActive.media.push(id);renderNoteAttachments()});
$('recordAudio').onclick=recordVoice;
window.__audioPermissionDenied=()=>{window.__audioPermissionRetry=null;notify('Mikrofon není povolen. Povol jej v nastavení aplikace.');};
function recordVoice(){if(!native){notify('V prohlížeči použij možnost přidat zvukový soubor.');pickMedia('file',(id)=>{if(noteActive)noteActive.media.push(id);else addMediaRecord(id,'Hlasová poznámka','audio/m4a');renderNoteAttachments()});return}if(!window.recording){const id=uid();const start=()=>{if(!noteActive)return;if(!Native.startAudio(id))return;window.__audioPermissionRetry=null;window.recording=id;$('recordAudio').textContent='■ Zastavit záznam';notify('Nahrávání spuštěno')};window.__audioPermissionRetry=start;start()}else{const id=window.recording;Native.stopAudio();window.recording=null;$('recordAudio').textContent='● Hlasová poznámka';if(noteActive){noteActive.media.push(id);renderNoteAttachments();}else addMediaRecord(id,'Hlasová poznámka','audio/mp4');notify('Zvuková poznámka uložena')}}
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
  ['☁  Google Disk',()=>chooseCloud()],
  ['ⓘ  O Zaměřovači',()=>modal('O Zaměřovači','<p>Vlastní aplikace pro zaměřování nábytku.</p><p>Aktuální verze: <b>'+escapeHtml(appVersion)+'</b></p>',()=>true,'Zavřít')]
]);
$('sortBtn').onclick=()=>{sortAsc=!sortAsc;$('sortBtn').textContent=sortAsc?'ᴬ↓ᶻ':'ᶻ↓ᴬ';showFolder()};
function showOverflow(){showAppMenu('overflowMenu',[
  ['Nastavení',()=>toggleSettings()],['Seřadit A–Z / Z–A',()=>{$('sortBtn').click()}],
  ['Nová složka',()=>promptText('Nová složka','Jméno zákazníka nebo místnosti','',name=>addRecord(newRecord('folder',name)))],
  ['Google Disk',()=>chooseCloud()]
]);}
$('settingsBtn').onclick=showOverflow;$('searchBtn').onclick=()=>promptText('Hledat zakázku','Název','',val=>{let found=state.records.find(r=>!r.deleted&&r.title.toLocaleLowerCase('cs').includes(val.toLocaleLowerCase('cs')));if(found){currentFolder=found.parentId;showFolder();document.querySelector(`.entry[data-id="${found.id}"]`)?.scrollIntoView()}else notify('Nenašel jsem žádnou odpovídající položku')});
function toggleSettings(){$('settingsPanel').hidden=!$('settingsPanel').hidden;if(!$('settingsPanel').hidden)renderSettings()}
$('closeSettings').onclick=toggleSettings;
function renderSettings(){const spec=[['Editor','Lupa při posouvání bodů','loupe','bool'],['Editor','Zvětšení lupy','loupeZoom','num',2,6],['Editor','Přichytávání k existujícím bodům','snapPoints','bool'],['Editor','Pomocný rastr','snapGrid','bool'],['Editor','Rozestup rastru (obrazové body)','gridStep','num',5,300],['Editor','Přichytávání vodorovně / svisle','snapHorizontal','bool'],['Editor','Přichytávání k rohům','snapCorners','bool'],['Editor','Přichytávání k obrysům','snapContours','bool'],['Editor','Přichytávání na pravý úhel','snapRightAngle','bool'],['Editor','Citlivost přesouvání','moveSensitivity','num',0.2,3],['Rozměry','Jednotky','unit','select',['mm','cm','m','in']],['Rozměry','Desetinná místa','decimals','num',0,3],['Vzhled','Barva nástrojů','color','color'],['Vzhled','Tloušťka čar','lineWidth','num',1,12],['Vzhled','Velikost textu','fontSize','num',10,42],['Vzhled','Vibrace při delším podržení','vibration','bool'],['Vzhled','Trvale zapnutý displej','keepAwake','bool'],['Vzhled','Celá obrazovka','fullScreen','bool'],['Vzhled','Přednastavené texty','presets','text'],['Vzhled','Otevřít klávesnici u nové poznámky','autoText','bool'],['Cloud','Automatická synchronizace','autoSync','bool'],['Cloud','Synchronizovat pouze na Wi-Fi','wifiOnly','bool']];let category='';$('settingsContent').innerHTML=spec.map(row=>{let [group,label,key,type]=row;let head=group!==category?`<div class="setGroup">${group}</div>`:'';category=group;let v=prefs[key];let control=type==='bool'?`<input type="checkbox" data-setting="${key}" ${v?'checked':''}>`:type==='select'?`<select data-setting="${key}">${row[4].map(s=>`<option ${v===s?'selected':''}>${s}</option>`).join('')}</select>`:type==='color'?`<input type="color" data-setting="${key}" value="${v}">`:type==='text'?`<input type="text" data-setting="${key}" value="${escapeHtml(v)}">`:`<input type="number" data-setting="${key}" min="${row[4]}" max="${row[5]}" step="any" value="${v}">`;return head+`<label class="setting"><span>${label}</span>${control}</label>`}).join('')+`<div class="setGroup">Cloud – Google Disk</div><button class="setting" style="width:100%" id="chooseCloud">Vybrat složku Google Disku</button><button class="setting" style="width:100%" id="syncCloud">Synchronizovat nyní</button><div class="setGroup">Bluetooth</div><button class="setting" style="width:100%" id="chooseLaser">Připojit měřič</button><div class="setGroup">O aplikaci</div><div class="setting" id="appVersionInfo"><span>Verze Zaměřovače</span><strong>${escapeHtml(appVersion)}</strong></div><div style="height:40px"></div>`;
$('settingsContent').querySelectorAll('[data-setting]').forEach(el=>el.onchange=()=>{let key=el.dataset.setting;prefs[key]=el.type==='checkbox'?el.checked:el.type==='number'?Number(el.value):el.value;save();applyNativePrefs();if(key==='color')$('lineColor').value=prefs.color;if(screen==='editor')paint()});$('chooseCloud').onclick=chooseCloud;$('syncCloud').onclick=syncCloud;$('chooseLaser').onclick=()=>native?Native.connectLaser():notify('Bluetooth laser vyžaduje Android aplikaci')}
function applyNativePrefs(){if(native)Native.configure(JSON.stringify({keepAwake:prefs.keepAwake,fullscreen:prefs.fullScreen,wifiOnly:prefs.wifiOnly,autoSync:prefs.autoSync}))}
function chooseCloud(){if(native)Native.selectCloudFolder();else notify('Google Disk nastavíš v Android verzi přes systémový výběr složky.')}
function syncCloud(){if(native){Native.syncCloud();notify('Spouštím synchronizaci…')}else notify('Synchronizace Google Disku vyžaduje Android verzi.')}
$('cloudBtn').onclick=()=>native?modal('Google Disk','<p>Vyber složku na Google Disku, ve které budou projekty všech zařízení. Synchronizace funguje i po návratu z offline režimu.</p><div class="row wrap"><button class="outline" id="cloudChoose">Vybrat složku</button><button class="outline" id="cloudSync">Synchronizovat</button></div>',()=>true,'Zavřít'):notify('Cloud je dostupný v Android aplikaci');
document.addEventListener('click',e=>{if(e.target.id==='cloudChoose'){Native.selectCloudFolder();$('modal').hidden=true}if(e.target.id==='cloudSync'){Native.syncCloud();$('modal').hidden=true}});
$('bluetoothBtn').onclick=()=>native?Native.connectLaser():notify('Laser se připojuje v Android aplikaci');
window.onNativeMedia=async(id,mime,name,takenAt)=>{if(stagedFileHandler){stagedFileHandler(id,{name,mime,type:mime});save();}else await addMediaRecord(id,name,mime,takenAt)};
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
window.onNativeMediaDone=()=>{stagedFileHandler=null;save()};
window.onNativeSync=(text)=>{try{let s=JSON.parse(text);if(s.data){if(screen==='browser'){state=s.data;Object.assign(prefs,state.prefs||{});state.prefs=prefs;save();showFolder()}else{const activeIds=new Set([current?.id,noteActive?.id].filter(Boolean));const active=state.records.filter(r=>activeIds.has(r.id));let incoming=s.data.records||[];for(const r of active){let at=incoming.findIndex(x=>x.id===r.id);if(at>=0)incoming[at]=r;else incoming.push(r)}state.records=incoming;save();} }notify(s.message||'Synchronizace dokončena')}catch(e){notify(text)}};
window.onLaserValue=(value,unit)=>{
 // Přenos mimo editor: uložit poslední přijatou hodnotu do paměti.
 // V editoru provede přímý zápis __handleLaserAuto v upgrade.js.
 window.lastLaser={value:String(value),unit:String(unit||'mm'),receivedAt:Date.now()};
 notify('Bosch: '+value+' '+(unit||'mm')+' – pro zápis otevři a vyber kótu');
};
window.onNativeError=message=>notify('Chyba: '+message);
window.handleAndroidBack=()=>{
  if(!$('modal').hidden){$('modal').hidden=true;return 'handled';}
  if(!$('settingsPanel').hidden){$('settingsPanel').hidden=true;return 'handled';}
  for(const id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow'])if(!$(id).hidden){$(id).hidden=true;return 'handled';}
  if(screen==='editor'){exitEditor();return 'handled';}
  if(screen==='note'){saveNote();return 'handled';}
  if(currentFolder){currentFolder=recById(currentFolder)?.parentId||null;showFolder();return 'handled';}
  return 'root';
};
window.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!$('modal').hidden)$('modal').hidden=true;else if(screen==='editor')exitEditor();else if(screen==='note')saveNote();else if(currentFolder){currentFolder=recById(currentFolder)?.parentId||null;showFolder()}}if(e.ctrlKey&&e.key==='z'&&screen==='editor'){e.preventDefault();undoEditor()}if(e.ctrlKey&&e.key==='y'&&screen==='editor'){e.preventDefault();redoEditor()}});
// Editor functions supplied by editor.js below.
$('lineColor').value=prefs.color;
showFolder();applyNativePrefs();
