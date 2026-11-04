/* Zaměřovač 1.2 – rozšíření bez změny schématu a bez ztráty uložených záznamů. */
'use strict';
(function(){
const esc=escapeHtml;
const photoKinds=['photo','canvas'];
const dimTypes=['dimension','chain','cumulative','angle','area'];
const grouped={dimensions:['dimension','chain','cumulative','angle','area'],notes:['note','symbol'],drawing:['line','arrow','rect','circle','ellipse','polyline','freehand','target']};
prefs.themeAccent=prefs.themeAccent||'#8b5cf6';
prefs.layerVisible=prefs.layerVisible||{dimensions:true,notes:true,drawing:true};
prefs.seenVersion=prefs.seenVersion||'';
if(!prefs.experimentalFeatures||typeof prefs.experimentalFeatures!=='object'||Array.isArray(prefs.experimentalFeatures))prefs.experimentalFeatures={};
const experimentalCatalog=[
 ['remoteTrigger','Dálková spoušť Bosch','Zkušební Bluetooth příkaz – kompatibilitu ověříme až při testování.'],
 ['boschIncline','Digitální vodováha a sklon Bosch','Přenos úhlu z měřiče zatím není potvrzen.'],
 ['boschLive','Průběžné hodnoty Bosch','Zobrazí přijaté hodnoty, které Bosch skutečně odešle.'],
 ['boschArea','Plocha a objem z Bosch','Přenos vypočtené plochy a objemu zatím není ověřen.'],
 ['smartCanvas','Chytré plátno a půdorys','Připraveno pro budoucí testování narovnávání skic.']
];
const experimentalEnabled=id=>prefs.experimentalFeatures[id]===true;
window.__experimentalEnabled=experimentalEnabled;
function openExperimentalSettings(){
 const body='<p class="muted">Všechny experimenty jsou standardně vypnuté. Zapnutím se jejich položka objeví v nabídce nástrojů při zaměřování, vypnutím zmizí. Běžné měření to neovlivní.</p>'+
 experimentalCatalog.map(([id,label,note])=>
 '<label class="setting" style="display:flex;align-items:center;gap:12px"><span style="flex:1"><strong>'+esc(label)+'</strong><small style="display:block">'+esc(note)+'</small></span><input type="checkbox" data-experiment="'+id+'" '+(experimentalEnabled(id)?'checked':'')+'></label>').join('');
 modal('Experimentální funkce',body,()=>true,'Hotovo');
 $('modalBody').querySelectorAll('[data-experiment]').forEach(input=>input.onchange=()=>{
  prefs.experimentalFeatures[input.dataset.experiment]=input.checked;
  save();
 });
}
$('back').onclick=()=>showAppMenu('navMenu',[
 ['⌂  Domů',()=>{currentFolder=null;showFolder()}],
 ['⚙  Nastavení',()=>toggleSettings()],
 ['🧪  Experimentální funkce',openExperimentalSettings],
 ['🗑️  Koš',showTrash],
 ['☁  Google Disk',chooseCloud],
 ['ⓘ  O Zaměřovači',()=>modal('O Zaměřovači','<p>Vlastní aplikace pro zaměřování nábytku.</p><p>Verze: <b>'+esc(appVersion)+'</b></p>',()=>true,'Zavřít')]
]);
function openExperimentalAction(id){
 if(!experimentalEnabled(id))return;
 if(id==='remoteTrigger'){
  if(!native||typeof Native.triggerLaser!=='function'){notify('Dálková spoušť není v tomto sestavení dostupná');return}
  if(laserState!=='receiving'&&laserState!=='connected'){notify('Nejdřív připoj laser Bosch');return}
  Native.triggerLaser();return;
 }
 if(id==='boschLive'){
  const value=window.lastLaser;
  modal('Poslední přijaté měření',
   '<p><b id="experimentalLiveReading">'+esc(value?value.value+' '+value.unit:'Dosud žádné měření')+'</b></p>'+
   '<p class="muted">Zobrazujeme pouze skutečná přijatá data. Průběžný přenos závisí na režimu laseru.</p>',()=>true,'Zavřít');return;
 }
 const details=experimentalCatalog.find(row=>row[0]===id);
 modal(details?.[1]||'Experiment','<p>'+esc(details?.[2]||'Zatím nepřipraveno')+'</p>'+
 '<p class="muted">Neověřená funkce – bez přijatých údajů aplikace neukazuje žádné domnělé hodnoty.</p>',()=>true,'Zavřít');
}

function accent(){
  const color=/^#[0-9a-f]{6}$/i.test(prefs.themeAccent)?prefs.themeAccent:'#8b5cf6';
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--green',color);
  document.documentElement.style.setProperty('--top-accent',color);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content',color);
}
accent();
const history=[];
const allowedLogs=new Set(['chyba','uložení','cloud','bluetooth','média','obnova','editor','záznam']);
function logEvent(group,message){
  if(!allowedLogs.has(group))group='záznam';
  const sanitized=String(message||'').replace(/(?:https?:\/\/|file:\/\/)\S+/g,'[adresa]').slice(0,170);
  history.push({time:new Date().toISOString(),group,message:sanitized});
  if(history.length>300)history.shift();
  try{localStorage.setItem('zamerovac-diagnostic-v1',JSON.stringify(history));}catch(e){}
}
try{const old=JSON.parse(localStorage.getItem('zamerovac-diagnostic-v1')||'[]');if(Array.isArray(old))history.push(...old.slice(-150));}catch(e){}
window.addEventListener('error',ev=>logEvent('chyba','JavaScript: '+(ev.message||'Neznámá chyba')));
window.addEventListener('unhandledrejection',ev=>logEvent('chyba','Nesplněný úkol: '+String(ev.reason?.message||'').slice(0,80)));
const oldError=window.onNativeError;
window.onNativeError=function(message){logEvent('chyba',String(message).split('\n')[0]);if(/synchronizac|google disk|cloud/i.test(String(message)))setCloudState('failed');oldError(message)};
const oldSync=window.onNativeSync;
window.onNativeSync=function(text){
  let message='Dokončená synchronizace';
  try{message=JSON.parse(text).message||message;}catch(e){}
  setCloudState(/chyb|selhal|nelze|nepodpor/i.test(message)?'failed':'ok');
  logEvent('cloud',/chyb|selhal|nelze|nepodpor/i.test(message)?'Synchronizace hlásí chybu':'Synchronizace dokončena');
  oldSync(text);
};
function setCloudState(status){
 const b=$('cloudBtn');b.dataset.status=status;
 b.title=status==='running'?'Synchronizace probíhá':status==='ok'?'Poslední synchronizace dokončena':status==='failed'?'Synchronizace selhala':'Cloud zatím neověřen';
 b.setAttribute('aria-label',b.title);
}
setCloudState('unknown');
const oldSyncCloud=syncCloud;
syncCloud=function(){setCloudState('running');logEvent('cloud','Spuštěna synchronizace');oldSyncCloud()};
$('cloudBtn').onclick=()=>modal('Cloud – stav a synchronizace',
 '<p>'+esc($('cloudBtn').title)+'</p><p class="muted">Google Disk přes systémový výběr složky závisí na podpoře zápisu. Funkčnost je potřeba ověřit na telefonu i tabletu.</p><div class="row wrap"><button class="outline" id="setCloud">Vybrat složku</button><button class="outline" id="runCloud">Synchronizovat nyní</button></div>',
 ()=>true,'Zavřít');
document.addEventListener('click',e=>{
 if(e.target?.id==='setCloud'){chooseCloud();$('modal').hidden=true}
 if(e.target?.id==='runCloud'){syncCloud();$('modal').hidden=true}
});
const oldSave=save;
save=function(){
  try{oldSave();}catch(e){logEvent('chyba','Nepodařilo se uložit místní data');notify('Uložení se nezdařilo');throw e}
};
const oldCommit=commitEditor;
commitEditor=function(){
  if(!current)return;
  const record=current;
  // Snapshot jen při změně a maximálně 12 verzí; historie je uložena se zakázkou.
  if(!record._detailTemporary){
    if(!Array.isArray(record.versionHistory))record.versionHistory=[];
    const serialized=JSON.stringify(record.items||[]);
    const previous=record.versionHistory[record.versionHistory.length-1];
    if(!previous||previous.items!==serialized){
      record.versionHistory.push({time:new Date().toISOString(),items:serialized});
      if(record.versionHistory.length>12)record.versionHistory.shift();
    }
  }
  oldCommit();
  if(window.__detailParent && record._detailTemporary){
    window.__detailItem.detailItems=record.items;
    touch(window.__detailParent);save();
  }
  logEvent('editor','Změna kótování uložena');
};
function restoreVersion(){
 if(!current||current._detailTemporary)return;
 const versions=(current.versionHistory||[]);
 if(!versions.length){notify('Zatím nejsou uložené žádné předchozí verze');return}
 modal('Historie úprav fotografie',
   '<p>Vyber uloženou podobu kótování. Před obnovením se zachová současná verze.</p>'+
   '<select id="restoreChoice">'+versions.map((v,i)=>'<option value="'+i+'">'+esc(new Date(v.time).toLocaleString('cs-CZ'))+'</option>').join('')+'</select>',
   ()=>{const data=versions[Number($('restoreChoice').value)];if(!data)return false;
     checkpoint();current.items=JSON.parse(data.items);commitEditor();notify('Předchozí verze obnovena')},
   'Obnovit');
}
function recordLocked(rec){
 let node=rec,seen=0;
 while(node&&seen++<50){if(node.locked)return true;node=node.parentId?recById(node.parentId):null}
 return false;
}
window.isRecordLocked=recordLocked;
const oldRecordActions=recordActions;
recordActions=function(id){
 oldRecordActions(id);
 const rec=recById(id);
 if(!rec)return;
 const extra=document.createElement('button');
 extra.className='outline';
 extra.textContent=rec.locked?'🔓 Odemknout':'🔒 Uzamknout';
 extra.onclick=()=>{
   rec.locked=!rec.locked;touch(rec);save();$('modal').hidden=true;showFolder();
   notify(rec.locked?'Zakázka uzamčena proti úpravám':'Zakázka odemčena');
 };
 if(recordLocked(rec))for(const id of ['renameOne','moveOne','deleteOne']){const b=$(id);if(b)b.disabled=true}
 $('modalBody').querySelector('.row')?.append(extra);
};
const oldOpenEditor=openEditor;
openEditor=function(r){
 oldOpenEditor(r);
 if(!r._detailTemporary&&(!r.versionHistory||!r.versionHistory.length)){
   r.versionHistory=[{time:new Date().toISOString(),items:JSON.stringify(r.items||[])}];
 }
 const locked=recordLocked(r);
 stageCanvas.style.pointerEvents=locked?'none':'auto';
 $('editorHint').textContent=locked?'Zakázka je uzamčena – jen prohlížení':$('editorHint').textContent;
 document.querySelectorAll('.toolbar button').forEach(b=>{if(b.id!=='editorMore'&&b.id!=='exportBtn')b.disabled=locked});
 renderEditorNavigation();
};
const oldOpenNote=openNote;
openNote=function(r){
 oldOpenNote(r);
 const locked=recordLocked(r);
 for(const id of ['noteTitle','noteText','addCheck','attachFile','recordAudio','saveNote']){
  $(id).disabled=locked;
 }
 if(typeof window.setupNoteSketch==='function')window.setupNoteSketch(r);
 if(locked)notify('Zakázka je uzamčena – poznámku nelze upravovat');
};
let noteSaveDebounce;
function draftNote(){
 if(!noteActive||recordLocked(noteActive))return;
 clearTimeout(noteSaveDebounce);
 noteSaveDebounce=setTimeout(()=>{
   if(!noteActive)return;
   noteActive.title=$('noteTitle').value.trim()||'Poznámka';
   noteActive.text=$('noteText').value;
   touch(noteActive);save();
 },350);
}
$('noteTitle').addEventListener('input',draftNote);
$('noteText').addEventListener('input',draftNote);
$('checkItems').addEventListener('input',draftNote);
$('checkItems').addEventListener('change',draftNote);
const oldShowFolder=showFolder;
showFolder=function(){oldShowFolder();document.body.classList.toggle('tablet-layout',innerWidth>=850)};
const oldOpenRecord=openRecord;
openRecord=function(id){
 const r=recById(id);
 if(r&&['video','audio'].includes(r.kind)){openMediaPlayer(r);return}
 oldOpenRecord(id);
};
async function openMediaPlayer(r){
 const id=r.media?.[0],url=await assetUrl(id);
 if(!url){notify('Soubor nelze otevřít');return}
 const el=document.createElement('div');el.className='mediaOverlay';
 const tag=r.kind==='video'?'video':'audio';
 el.innerHTML='<div class="mediaTop"><strong>'+esc(r.title)+'</strong><button id="mediaClose" aria-label="Zavřít">✕</button></div>'+
 '<'+tag+' controls playsinline preload="metadata" id="playInline"></'+tag+'>'+
 '<p>Přehrávání přímo v Zaměřovači</p>';
 document.body.append(el);
 const player=el.querySelector('#playInline');player.src=url;
 el.querySelector('#mediaClose').onclick=()=>{player.pause();el.remove();if(!native)URL.revokeObjectURL(url)};
 logEvent('média','Otevřeno vestavěné přehrávání');
}
let searchReturnState=null;
const priorShowFolderForSearch=showFolder;
showFolder=function(){
  priorShowFolderForSearch();
  if(searchReturnState&&screen==='browser'){
    const resume=searchReturnState;searchReturnState=null;
    openGlobalSearch(resume);
  }
};
function openGlobalSearch(resume=null){
  modal('Hledat zakázky a poznámky','<label for="searchAll">Hledat v zakázkách</label><input id="searchAll" type="search" placeholder="Zákazník, adresa, místnost, poznámka"><div id="searchResults" class="search-results"></div><button class="outline" id="searchRuian">📍 Vyhledat adresu v RÚIAN</button>',()=>true,'Zavřít');
  $('modal').classList.add('search-open');
  $('searchRuian').onclick=()=>{$('modal').classList.remove('search-open');openAddressSearch()};
  for(const key of ['cancelModal','okModal'])$(key)?.addEventListener('click',()=>{$('modal').classList.remove('search-open')},{once:true});
  const input=$('searchAll'),result=$('searchResults');
  if(resume)input.value=resume.query;
  const update=()=>{
    const q=input.value.trim().toLocaleLowerCase('cs');
    if(q.length<2){result.innerHTML='<p>Prohledají se názvy, adresy a texty poznámek.</p>';return}
    const records=state.records.filter(r=>!r.deleted&&[r.title,r.photoAddress,r.text,...(r.items||[]).map(x=>x.text||''),...(r.checks||[]).map(x=>x.text||'')].join(' ').toLocaleLowerCase('cs').includes(q));
    const found=records.sort((a,b)=>{
      const rank=r=>{const title=r.title.toLocaleLowerCase('cs');return title===q?0:title.startsWith(q)?1:title.includes(q)?2:3};
      return rank(a)-rank(b)||a.title.localeCompare(b.title,'cs');
    }).slice(0,60);
    const snippet=r=>{
      const text=[r.text,...(r.items||[]).map(x=>x.text||''),...(r.checks||[]).map(x=>x.text||'')].find(t=>String(t||'').toLocaleLowerCase('cs').includes(q));
      if(!text)return r.photoAddress||'';
      const pos=String(text).toLocaleLowerCase('cs').indexOf(q);
      return String(text).slice(Math.max(0,pos-28),Math.min(String(text).length,pos+q.length+44));
    };
    result.innerHTML=found.length?found.map(r=>'<button class="search-hit" data-found="'+esc(r.id)+'">'+browserEntryIcon(r)+'<span class="search-hit-body"><span>'+esc(r.title)+'</span><small>'+esc(r.kind)+' · '+esc(snippet(r))+'</small></span></button>').join(''):'<p>Nic nenalezeno</p>';
    result.querySelectorAll('[data-found]').forEach(b=>b.onclick=()=>{
      const id=b.dataset.found,record=recById(id);if(!record)return;
      const resumeState={query:input.value,scroll:result.scrollTop};
      $('modal').hidden=true;$('modal').classList.remove('search-open');
      currentFolder=record.parentId||null;
      showFolder();
      openRecord(id);
      searchReturnState=resumeState;
    });
    result.querySelectorAll('.entry-thumb').forEach(img=>img.addEventListener('error',()=>{img.hidden=true;if(img.nextElementSibling)img.nextElementSibling.hidden=false},{once:true}));
  };
  input.addEventListener('input',update);update();
  if(resume)result.scrollTop=resume.scroll||0;
}
$('searchBtn').onclick=()=>openGlobalSearch();

function openAddressSearch(){
 modal('Vyhledat přesnou adresu','<label>Adresa v České republice</label><input id="ruianQuery" value="Jezernice 54" placeholder="Obec a číslo domu"><p class="muted">Dotaz se odešle veřejné geokódovací službě RÚIAN (ČÚZK). Výsledky vyber podle skutečného čísla domu.</p><button class="outline" id="ruianFind">Vyhledat adresu</button><div id="ruianResults"></div>',()=>true,'Zavřít');
 $('ruianFind').onclick=()=>{
   const q=$('ruianQuery').value.trim();
   if(q.length<3){notify('Zadej alespoň 3 znaky adresy');return}
   if(!native||typeof Native.searchAddress!=='function'){notify('Vyhledávání RÚIAN vyžaduje Android verzi');return}
   $('ruianResults').textContent='Hledám přesné adresní místo…';
   Native.searchAddress(q);
 };
}
window.onAddressCandidates=function(raw){
 let response;
 try{response=JSON.parse(raw)}catch(e){notify('Nepodařilo se načíst adresy');return}
 const wrap=$('ruianResults');if(!wrap)return;
 const matches=response.candidates||[];
 wrap.innerHTML=matches.length?'<h3>Výsledky RÚIAN</h3>'+matches.map((x,i)=>'<button class="addressCandidate" data-candidate="'+i+'">'+esc(x.address||'Neznámá adresa')+' <small>'+Number(x.score||0).toFixed(0)+' % shoda</small></button>').join('')+'<div id="addressMap"></div>':'<p>Pro tuto adresu není v RÚIAN nalezen žádný výsledek. Zkontroluj obec nebo číslo domu.</p>';
 wrap.querySelectorAll('[data-candidate]').forEach(button=>button.onclick=()=>{
  const candidate=matches[Number(button.dataset.candidate)];
  const lat=Number(candidate.lat),lon=Number(candidate.lon);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return;
  const bbox=[lon-.005,lat-.003,lon+.005,lat+.003].join('%2C');
  const marker=encodeURIComponent(lat+','+lon);
  const url='https://www.openstreetmap.org/export/embed.html?bbox='+bbox+'&layer=mapnik&marker='+marker;
  $('addressMap').innerHTML='<p>📍 '+esc(candidate.address)+'</p><iframe title="Mapa adresního místa" loading="lazy" width="100%" height="270" src="'+url+'"></iframe><small>Souřadnice vrácené službou RÚIAN, mapový podklad OpenStreetMap.</small>';
 });
};

const browseGallery=document.createElement('button');
browseGallery.id='browseGallery';browseGallery.className='ico';browseGallery.innerHTML='<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="6" y="6" width="15" height="15" rx="2"/><path d="M3 16V5a2 2 0 0 1 2-2h11"/><circle cx="16" cy="10" r="1.5"/><path d="m7 18 4-4 3 3 2-2 4 4"/></svg>';browseGallery.title='Galerie fotografií';browseGallery.setAttribute('aria-label','Galerie fotografií');
$('browserFoot').insertBefore(browseGallery,$('bluetoothBtn'));
browseGallery.onclick=()=>openGallery(0);
let gallery=null,galleryList=[],galleryIndex=0,galleryStart=null;
function galleryPhotos(){return state.records.filter(r=>!r.deleted&&r.kind==='photo'&&r.parentId===currentFolder).sort((a,b)=>a.createdAt.localeCompare(b.createdAt))}
async function renderGallery(){
 if(!gallery)return;
 const display=gallery,r=galleryList[galleryIndex];
 if(!r){closeGallery();return}
 const canvas=display.querySelector('.gallery-img');
 canvas.style.transform='none';
 display.querySelector('.gallery-title').textContent=r.title+' · '+(galleryIndex+1)+'/'+galleryList.length;
 try{
  const url=await assetUrl(r.media?.[0]);
  if(!url)return;
  const image=await new Promise((resolve,reject)=>{
   const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=url;
  });
  // Stejnou anotovanou podobu zobrazit i při listování; žádný prvek není dotykově aktivní.
  const details=(r.items||[]).filter(it=>it.type==='note'&&it.media?.length);
  await Promise.all(details.map(async it=>{
   const id=it.media[0];
   if(window.__detailPhotoCache?.[id]?.naturalWidth)return;
   try{
    const source=await assetUrl(id);
    await new Promise((resolve,reject)=>{
     const im=new Image();im.onload=resolve;im.onerror=reject;im.src=source;
     window.__detailPhotoCache[id]=im;
    });
   }catch(err){/* Přílohou může být i audio; nemění zobrazení ostatních poznámek. */}
  }));
  if(gallery!==display||galleryList[galleryIndex]?.id!==r.id)return;
  const available=display.querySelector('.gallery-content');
  const density=Math.min(2,window.devicePixelRatio||1);
  const maxW=Math.max(240,(available.clientWidth||500)*density);
  const maxH=Math.max(240,(available.clientHeight||650)*density);
  // Include insets dragged outside the original photo. Gallery must use
  // the whole annotated workspace, not clip at the original image edges.
  let minX=0,minY=0,maxX=image.naturalWidth,maxY=image.naturalHeight;
  for(const item of details){
   const inset=window.__detailPhotoCache?.[item.media?.[0]];
   if(!inset?.naturalWidth||!inset?.naturalHeight)continue;
   if(!Number.isFinite(item.insetX)||!Number.isFinite(item.insetY))continue;
   const w=Math.max(70,Math.min(1500,Number(item.insetWidth)||220));
   const h=w*inset.naturalHeight/inset.naturalWidth;
   const angle=(Number(item.insetRotation)||0)*Math.PI/180;
   const rotatedW=Math.abs(w*Math.cos(angle))+Math.abs(h*Math.sin(angle));
   const rotatedH=Math.abs(w*Math.sin(angle))+Math.abs(h*Math.cos(angle));
   const x=item.insetX,y=item.insetY;
   minX=Math.min(minX,x+(w-rotatedW)/2);
   minY=Math.min(minY,y+(h-rotatedH)/2);
   maxX=Math.max(maxX,x+(w+rotatedW)/2);
   maxY=Math.max(maxY,y+(h+rotatedH)/2);
   if(item.captionMoved&&item.b){
    minX=Math.min(minX,item.b.x-100);maxX=Math.max(maxX,item.b.x+100);
    minY=Math.min(minY,item.b.y-35);maxY=Math.max(maxY,item.b.y+35);
   }
  }
  const margin=38;
  const workspaceW=maxX-minX+2*margin,workspaceH=maxY-minY+2*margin;
  const scale=Math.min(maxW/workspaceW,maxH/workspaceH,2);
  const width=Math.max(1,Math.round(workspaceW*scale));
  const height=Math.max(1,Math.round(workspaceH*scale));
  canvas.width=width;canvas.height=height;
  canvas.style.width=(width/density)+'px';canvas.style.height=(height/density)+'px';
  const c=canvas.getContext('2d');
  c.fillStyle='#292a2f';c.fillRect(0,0,width,height);
  const shiftX=(margin-minX)*scale,shiftY=(margin-minY)*scale;
  c.drawImage(image,shiftX,shiftY,image.naturalWidth*scale,image.naturalHeight*scale);
  const oldCtx=ctx,oldView=view,oldCurrent=current,oldPhoto=photoSize,oldSelected=selected;
  const oldExport=window.__exportingAnnotations;
  try{
   ctx=c;view={zoom:scale,dx:shiftX,dy:shiftY};
   current=r;photoSize={w:image.naturalWidth,h:image.naturalHeight};
   selected=null;window.__exportingAnnotations=true;
   for(const item of r.items||[])drawItem(c,item);
  }finally{
   ctx=oldCtx;view=oldView;current=oldCurrent;photoSize=oldPhoto;selected=oldSelected;
   window.__exportingAnnotations=oldExport;
  }
 }catch(err){notify('Fotografii v galerii se nepodařilo zobrazit');}
}
function openGallery(index,records=null){
 galleryList=records||galleryPhotos();galleryIndex=Math.min(Math.max(index,0),galleryList.length-1);
 if(!galleryList.length){notify('Ve složce nejsou fotografie');return}
 gallery=document.createElement('div');gallery.className='galleryOverlay';
 gallery.innerHTML='<div class="gallery-top"><button data-action="close">←</button><strong class="gallery-title"></strong><button data-action="edit">Upravit</button></div><div class="gallery-content"><canvas class="gallery-img" role="img" aria-label="Fotografie včetně kót a poznámek"></canvas></div><div class="gallery-bottom"><button data-action="prev" aria-label="Předchozí fotografie">❮</button><span>Listuj přejetím do stran · přibliž dvěma prsty</span><button data-action="next" aria-label="Další fotografie">❯</button></div>';
 document.body.append(gallery);
 gallery.querySelectorAll('[data-action]').forEach(b=>b.onclick=()=>{
  const a=b.dataset.action;
  if(a==='close')return closeGallery();
  if(a==='edit'){const r=galleryList[galleryIndex];closeGallery();openEditor(r);return}
  galleryIndex=(galleryIndex+(a==='next'?1:-1)+galleryList.length)%galleryList.length;renderGallery();
 });
 const image=gallery.querySelector('.gallery-img');
 let galleryZoom=1,galleryTx=0,galleryTy=0,pinch=null,pan=null;
 const updateZoom=()=>{image.style.transform='translate('+galleryTx+'px,'+galleryTy+'px) scale('+galleryZoom+')'};
 const resetZoom=()=>{galleryZoom=1;galleryTx=0;galleryTy=0;updateZoom()};
 const distance=(a,b)=>Math.hypot(a.clientX-b.clientX,a.clientY-b.clientY);
 const oldRender=renderGallery;
 const galleryNavigate=step=>{
  galleryIndex=(galleryIndex+step+galleryList.length)%galleryList.length;
  resetZoom();renderGallery();
 };
 image.addEventListener('touchstart',e=>{
  if(e.touches.length===2){
   pinch={distance:distance(e.touches[0],e.touches[1]),scale:galleryZoom};
   galleryStart=null;pan=null;
  }else if(e.touches.length===1){
   const t=e.touches[0];
   if(galleryZoom>1){pan={x:t.clientX,y:t.clientY,tx:galleryTx,ty:galleryTy};galleryStart=null}
   else {galleryStart={x:t.clientX,y:t.clientY};pan=null}
  }
 },{passive:false});
 image.addEventListener('touchmove',e=>{
  if(e.touches.length===2&&pinch){
   e.preventDefault();
   galleryZoom=Math.max(1,Math.min(5,pinch.scale*distance(e.touches[0],e.touches[1])/Math.max(1,pinch.distance)));
   if(galleryZoom===1){galleryTx=0;galleryTy=0}
   updateZoom();
  }else if(e.touches.length===1&&pan){
   e.preventDefault();
   galleryTx=pan.tx+e.touches[0].clientX-pan.x;
   galleryTy=pan.ty+e.touches[0].clientY-pan.y;
   updateZoom();
  }
 },{passive:false});
 image.addEventListener('touchend',e=>{
  if(galleryStart&&e.touches.length===0&&e.changedTouches.length===1){
   const dx=e.changedTouches[0].clientX-galleryStart.x;
   if(Math.abs(dx)>70)galleryNavigate(dx<0?1:-1);
  }
  if(e.touches.length<2)pinch=null;
  if(e.touches.length===0){pan=null;galleryStart=null}
 },{passive:true});
 image.addEventListener('dblclick',()=>{if(galleryZoom>1)resetZoom();else{galleryZoom=2;updateZoom()}});

 renderGallery();
}
function closeGallery(){gallery?.remove();gallery=null}
function renderEditorNavigation(){
 let nav=$('photoNavigation');
 if(!nav){nav=document.createElement('div');nav.id='photoNavigation';nav.innerHTML='<button id="galleryMode" title="Prohlížet fotografie"><img class="editor-gallery-thumbnail" alt="" draggable="false"></button>';const head=document.querySelector('.editor-head');head.insertBefore(nav,$('editorTopMenu'))}
 const photos=galleryPhotos();const at=photos.findIndex(r=>r.id===current?.id);
 nav.hidden=current?.kind!=='photo'||!!current?._detailTemporary;
 nav.querySelector('#galleryMode').onclick=()=>{if(at>=0)openGallery(at,photos)};
 const thumbnail=nav.querySelector('.editor-gallery-thumbnail');
 if(thumbnail){
  thumbnail.removeAttribute('src');
  thumbnail.hidden=true;
  const mediaId=current?.media?.[0],recordId=current?.id;
  if(mediaId)assetUrl(mediaId).then(url=>{
   if(screen==='editor'&&current?.id===recordId&&thumbnail.isConnected){
    thumbnail.src=url;thumbnail.hidden=false;
   }
  }).catch(()=>{thumbnail.hidden=true});
 }

}
function openSumCheck(){
 if(!current)return;
 const dims=(current.items||[]).filter(i=>['dimension','chain','cumulative'].includes(i.type)&&Number(String(i.measure||'').replace(',','.'))>0);
 if(dims.length<3){notify('Potřebuješ alespoň tři vyplněné kóty');return}
 modal('Kontrola součtu kót','<label>Celkový rozměr</label><select id="sumTarget">'+dims.map(x=>'<option value="'+esc(x.id)+'">'+esc(x.measure+' '+(x.unit||'mm'))+'</option>').join('')+'</select><p>Zaškrtni pouze úseky, které skutečně tvoří celkový rozměr:</p><div id="sumPieces">'+dims.map(x=>'<label class="sum-option"><input type="checkbox" value="'+esc(x.id)+'"> '+esc(x.measure+' '+(x.unit||'mm'))+'</label>').join('')+'</div><p id="sumResult"></p>',()=>{calculateSum();return false},'Zkontrolovat');
 $('sumTarget').onchange=()=>{const v=$('sumTarget').value;$('sumPieces').querySelectorAll('input').forEach(i=>{i.disabled=i.value===v;i.checked=false})};
 $('sumTarget').onchange();
 function calculateSum(){
  const target=dims.find(x=>x.id===$('sumTarget').value);
  const chosen=[...$('sumPieces').querySelectorAll('input:checked')].map(i=>dims.find(x=>x.id===i.value));
  if(!chosen.length){$('sumResult').textContent='Vyber alespoň jeden dílčí rozměr';return}
  const factor={mm:1,cm:10,m:1000,in:25.4};
  const toMm=i=>Number(String(i.measure).replace(',','.'))*(factor[i.unit||'mm']||1);
  const overall=toMm(target),sum=chosen.reduce((n,i)=>n+toMm(i),0),delta=Math.round((overall-sum)*100)/100;
  $('sumResult').textContent='Celek: '+overall.toFixed(1)+' mm · součet: '+sum.toFixed(1)+' mm · rozdíl: '+delta.toFixed(1)+' mm'+(Math.abs(delta)<0.5?' ✓ Souhlasí':' ⚠ Zkontroluj');
  logEvent('editor','Kontrola součtu kót '+(Math.abs(delta)<0.5?'OK':'nesoulad'));
 }
}
const originalOverflow=showEditorOverflow;
showEditorOverflow=function(){
 if(recordLocked(current)){
  showAppMenu('editorOverflow',[
   ['▤ Galerie fotografií',()=>{const photos=galleryPhotos(),idx=photos.findIndex(x=>x.id===current?.id);if(idx>=0)openGallery(idx,photos)}],
   ['☷ Viditelnost vrstev',openLayers],
   ['Přizpůsobit fotografii',fitImage],
   ['Export obrázku / PDF',()=>$('exportBtn').click()],
   ['🔓 Odemknout zakázku',()=>recordActions(current.id)]
  ]);
  return;
 }
 originalOverflow();
 const menu=$('editorOverflow');
 const extras=[
  ['☷ Vrstvy kót, poznámek a kreslení',openLayers],
  ['∑ Kontrola součtu kót',openSumCheck],
  ['◷ Historie úprav',restoreVersion],
  ['▤ Galerie fotografií',()=>{const photos=galleryPhotos(),index=photos.findIndex(r=>r.id===current?.id);if(index>=0)openGallery(index,photos)}],
  ['▣ Export všech zakázek do ZIP',()=>native?Native.exportBackup():notify('ZIP je dostupný v Android verzi')],
  ['▣ Obnovit zakázky ze ZIP',()=>native?Native.importBackup():notify('Obnova ZIP vyžaduje Android verzi')]
 ];
 for(const [text,action] of extras){const b=document.createElement('button');b.className='appMenuItem';b.textContent=text;b.onclick=()=>{menu.hidden=true;action()};menu.append(b)}
};
function openLayers(){
 const names={dimensions:'Kóty',notes:'Poznámky',drawing:'Kreslení'};
 modal('Viditelnost vrstev','<p>Skrytí nic nemaže, přepínej skupiny podle potřeby.</p>'+
 Object.entries(names).map(([key,label])=>'<label class="sum-option"><input type="checkbox" data-layer="'+key+'" '+(prefs.layerVisible[key]?'checked':'')+'> '+label+'</label>').join(''),()=>{
  document.querySelectorAll('[data-layer]').forEach(x=>{prefs.layerVisible[x.dataset.layer]=x.checked});
  save();paint();
 });
}
const drawItemOriginal=drawItem;
drawItem=function(c,item){
 const kind=Object.entries(grouped).find(([name,kinds])=>kinds.includes(item.type))?.[0];
 if(kind&&prefs.layerVisible[kind]===false)return;
 if(item.type==='note'&&Array.isArray(item.media)&&item.media.length){
  const imageId=item.media[0],image=window.__detailPhotoCache?.[imageId];
  if(image?.complete&&image.naturalWidth&&typeof window.renderPhotoInset==='function'){
    window.renderPhotoInset(c,item,image,drawItemOriginal);
    return;
  }
 }
 drawItemOriginal(c,item);
};
window.__detailPhotoCache={};
function preloadDetail(item){
 const id=item.media?.[0];if(!id||window.__detailPhotoCache[id])return;
 assetUrl(id).then(url=>{const im=new Image();im.onload=()=>{if(screen==='editor')paint()};im.src=url;window.__detailPhotoCache[id]=im}).catch(()=>{});
}
const oldPaint=paint;
paint=function(){
 if(current)for(const i of current.items||[])if(i.type==='note'&&i.media?.length)preloadDetail(i);
 oldPaint();
};
// Jediný seznam pracovních nástrojů je pod tlačítkem "+".
// Aktivní nástroj zvýrazníme v nabídce i na tlačítku "+".
function highlightCurrentTool(){
 const chooser=$('toolsToggle');
 if(!chooser)return;
 const activeLastTool=mode===lastDrawingTool;
 const lastButton=$('activeTool');
 if(lastButton){
  lastButton.classList.toggle('tool-active',activeLastTool);
  lastButton.setAttribute('aria-pressed',String(activeLastTool));
  const last=allTools.find(x=>x[0]===lastDrawingTool);
  // Zachovat obě role: vybrat/upravit ↔ poslední kreslicí nástroj.
  lastButton.title=(last?.[2]||'Poslední nástroj')+
    (activeLastTool?' – právě vybráno':' – klepnutím znovu vybrat')+
    ' · dlouhým podržením přepnout opakované kreslení';
  lastButton.setAttribute('aria-label',lastButton.title);
 }
 const selectedTool=allTools.find(x=>x[0]===mode);
 chooser.classList.remove('tool-active');
 chooser.setAttribute('aria-expanded',String(!$('toolMenu').hidden));
 chooser.title='Vybrat nástroj (＋) · '+(selectedTool?.[2]||'Vybrat a upravit');
 chooser.setAttribute('aria-label',chooser.title);
 const menu=$('toolMenu');
 if(menu&&!menu.hidden){
  menu.querySelectorAll('[data-tool]').forEach(button=>{
   const active=button.dataset.tool===mode;
   button.classList.toggle('tool-chosen',active);
   button.setAttribute('aria-pressed',String(active));
   let tick=button.querySelector('.tool-choice-check');
   if(active&&!tick){
    tick=document.createElement('span');
    tick.className='tool-choice-check';
    tick.textContent='✓';
    tick.setAttribute('aria-hidden','true');
    button.append(tick);
   }else if(!active&&tick)tick.remove();
  });
 }
}
const originalShowTools=showTools;
showTools=function(){
 originalShowTools();
 const list=$('toolMenu').querySelector('.toolList');
 if(list){
  const enabled=experimentalCatalog.filter(([id])=>experimentalEnabled(id));
  if(enabled.length){
   const heading=document.createElement('div');heading.className='sectionLabel';heading.textContent='Experimentální funkce';list.append(heading);
   for(const [id,label] of enabled){
    const button=document.createElement('button');button.type='button';button.className='choice';
    button.dataset.experimentalTool=id;button.textContent='🧪 '+label;
    button.onclick=()=>{closeMenus();openExperimentalAction(id)};
    list.append(button);
   }
  }
 }
 highlightCurrentTool();
};
window.ensureAnnotationVisible=key=>{
 const group=Object.entries(grouped).find(([,types])=>types.includes(key))?.[0];
 if(group&&prefs.layerVisible[group]===false){prefs.layerVisible[group]=true;save()}
};
const originalSetTool=setTool;
setTool=function(key,keepSelection=false){
 window.ensureAnnotationVisible(key);
 originalSetTool(key,keepSelection);
 highlightCurrentTool();
};
function updateVisualControls(){
 $('fitBtn').hidden=true;
 $('activeTool').hidden=false;
 // Výrazná ikona tužky a pravítka – editor tloušťky čáry a velikosti textu.
 $('styleTool').innerHTML='<svg viewBox="0 0 24 24" width="29" height="29" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 16.8 15.8 4a2 2 0 0 1 2.8 0l1.4 1.4a2 2 0 0 1 0 2.8L7.2 21 2 22z"/><path d="m14.2 5.6 4.2 4.2"/><path d="M3 12V3h8"/><path d="M6 3v3M9 3v2M3 6h3M3 9h2"/></svg>';
 $('styleTool').title='Vzhled kóty – pravítko a tužka';
 $('styleTool').setAttribute('aria-label',$('styleTool').title);
 $('deleteTool').innerHTML='<svg viewBox="0 0 24 24" width="27" height="27" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 7V4h4v3M6 7l1 14h10l1-14M10 11v7M14 11v7"/></svg>';
 $('deleteTool').title='Odstranit vybraný prvek';
 $('deleteTool').setAttribute('aria-label',$('deleteTool').title);
}
updateVisualControls();
const oldUpdateDrawingToolButton=updateDrawingToolButton;
updateDrawingToolButton=function(){
 oldUpdateDrawingToolButton();
 const t=allTools.find(x=>x[0]===lastDrawingTool);
 // Jeden optický rozměr pro každý poslední nástroj: jako symbol ＋.
 // SVG má pevný čtvercový prostor a lze ho přesně vycentrovat.
 const glyph=t?.[1]||'↔';
 const icon=glyph==='↔'
   ?'<svg class="last-tool-svg" viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16h20"/><path d="m11 11-5 5 5 5M21 11l5 5-5 5"/></svg>'
   :'<span class="last-tool-glyph" aria-hidden="true"></span>';
 $('activeTool').innerHTML=icon;
 const span=$('activeTool').querySelector('.last-tool-glyph');
 if(span)span.textContent=glyph;
 $('activeTool').classList.toggle('repeat',!!prefs.repeatDrawing);
 highlightCurrentTool();
};
updateDrawingToolButton();
let laserState='off',laserName='';
function renderBluetooth(){
 const b=$('bluetoothBtn');
 b.classList.toggle('connecting',laserState==='connecting');
 b.classList.toggle('connected',laserState==='connected'||laserState==='receiving');
 b.classList.toggle('disconnected',laserState!=='connected'&&laserState!=='receiving'&&laserState!=='connecting');
 const icon='<svg class="bluetooth-symbol" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 7l10 10-5 4V3l5 4L7 17"/></svg>';
 const overlay=(laserState==='connected'||laserState==='receiving')?'<span class="bt-overlay bt-check" aria-hidden="true">✓</span>':laserState==='connecting'?'<span class="bt-overlay bt-spinner" aria-hidden="true"></span>':'<span class="bt-overlay bt-off" aria-hidden="true">×</span>';
 b.innerHTML=icon+overlay;
 b.title='Bosch Bluetooth: '+(laserState==='receiving'?'přenos ověřen':laserState==='connected'?'připojen – čekám na první měření':laserState==='connecting'?'připojování':'odpojen')+(laserName?' · '+laserName:'');
 b.setAttribute('aria-label',b.title);
}
window.onLaserStatus=(json)=>{
 try{const data=JSON.parse(json);laserState=data.status||'off';laserName=data.name||'';renderBluetooth();logEvent('bluetooth',laserState)}catch(e){}
};
renderBluetooth();
$('bluetoothBtn').onclick=()=>{
 modal('Měřič Bosch','<p>'+esc($('bluetoothBtn').title)+'</p><p>Po připojení čeká Zaměřovač na první naměřenou hodnotu. Teprve potom potvrdí příjem měření.</p><button class="outline" id="laserConnect" >Připojit můj laser Bosch</button><button class="outline" id="laserOther" type="button">Vybrat jiný měřič</button>',()=>true,'Zavřít');
 $('laserConnect').onclick=()=>{if(native){$('modal').hidden=true;laserState='connecting';laserName='vyhledávání Bosch';renderBluetooth();Native.connectLaser()}else notify('Vyžaduje Android')};
  $('laserOther').onclick=()=>{if(native&&Native.chooseOtherLaser){$('modal').hidden=true;laserState='connecting';laserName='ruční výběr';renderBluetooth();Native.chooseOtherLaser()}else notify('Vyžaduje aktualizovanou Android aplikaci')};
};
window.onExperimentalLaserTrigger=function(status){
 if(status==='sent')notify('Zkušební příkaz spouště odeslán. Zkontroluj laser; úspěšné měření zatím není potvrzené.');
};
const originalLaser=window.onLaserValue;
const readings=[];
try{
 const saved=JSON.parse(localStorage.getItem('zamerovac-bosch-readings-v1')||'[]');
 if(Array.isArray(saved))for(const x of saved.slice(0,40)){
  if(x&&typeof x.value==='string'&&typeof x.unit==='string'&&typeof x.time==='string')
   readings.push({value:x.value,unit:x.unit,time:x.time});
 }
}catch(e){}
window.__boschHistoryReadings=()=>readings.map(x=>({...x}));
window.onLaserValue=function(value,unit){
 const live=$('experimentalLiveReading');
 if(live&&experimentalEnabled('boschLive'))live.textContent=String(value)+' '+String(unit||'mm');
 readings.unshift({value:String(value),unit:String(unit||'mm'),time:new Date().toISOString()});
 if(readings.length>40)readings.pop();
 try{localStorage.setItem('zamerovac-bosch-readings-v1',JSON.stringify(readings))}catch(e){}
 const handled=typeof window.__handleLaserAuto==='function'&&window.__handleLaserAuto(value,unit);
 if(!handled)originalLaser(value,unit);
 logEvent('bluetooth','Přijata hodnota z laseru');
};
function showLaserHistory(){
 modal('Historie měření z Bosch','<p>Posledních 40 hodnot. Vyber hodnotu pro právě upravovanou kótu.</p>'+
 (readings.length?readings.map((r,i)=>'<div class="historyLine"><span>'+esc(r.value)+' '+esc(r.unit)+' <small>'+esc(new Date(r.time).toLocaleTimeString('cs-CZ'))+'</small></span><button data-reading="'+i+'">Použít</button></div>').join(''):'<p>Žádné naměřené hodnoty</p>')+
 '<button class="outline" id="clearReadings">Vymazat historii</button>',()=>true,'Zavřít');
 $('modalBody').querySelectorAll('[data-reading]').forEach(b=>b.onclick=()=>{
  const r=readings[Number(b.dataset.reading)];
  $('modal').hidden=true;
  if(typeof window.__applyLaserMeasurement==='function')
    window.__applyLaserMeasurement(r.value,r.unit,{fromHistory:true});
  else notify('Otevři fotografii a vyber kótu');
 });
 $('clearReadings').onclick=()=>{readings.length=0;try{localStorage.removeItem('zamerovac-bosch-readings-v1')}catch(e){};$('modal').hidden=true;notify('Historie měření vymazána')};
}
const oldBluetoothLong=$('bluetoothBtn');
oldBluetoothLong.addEventListener('contextmenu',e=>{e.preventDefault();showLaserHistory()});
const originalGlobalOverflow=showOverflow;
showOverflow=function(){
 originalGlobalOverflow();
 const menu=$('overflowMenu');
 if(menu&&!menu.hidden&&!menu.querySelector('[data-open-experiments]')){
  const b=document.createElement('button');b.className='appMenuItem';
  b.dataset.openExperiments='1';b.textContent='🧪 Experimentální funkce';
  b.onclick=()=>{closeMenus();openExperimentalSettings()};menu.append(b);
 }
};
$('settingsBtn').onclick=showOverflow;
const oldRenderSettings=renderSettings;
renderSettings=function(){
 oldRenderSettings();
 const place=$('settingsContent');
 const wrapper=document.createElement('div');
 wrapper.innerHTML='<div class="setGroup">Vzhled aplikace</div><label class="setting"><span>Barva prostředí</span><input type="color" id="uiTheme" value="'+esc(prefs.themeAccent)+'"></label>'+
 '<div class="setGroup">Laser Bosch – přesnost zápisu</div>'+
 '<label class="setting"><span>Zaokrouhlování laseru</span><select id="laserRoundingChoice"><option value="none">Bez zaokrouhlení</option><option value="0.1">Na 0,1 mm</option><option value="0.5">Na 0,5 mm</option><option value="1">Na celé milimetry</option></select></label>'+
 '<label class="setting"><span>Desetinná místa laseru</span><select id="laserDecimalsChoice"><option value="auto">Automaticky</option><option value="0">0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></label>'+
 '<p class="muted">Původní naměřená hodnota se zachovává. Volby mění zápis nových kót, ne starší historii.</p>'+
 
 
 '<div class="setGroup">Informace a údržba</div>'+
 '<button class="setting" id="openDiagnostics" style="width:100%">Diagnostika a sdílení logu</button>'+
 '<button class="setting" id="openHistory" style="width:100%">Novinky a historie aktualizací</button>'+
 '<button class="setting" id="openReadings" style="width:100%">Historie měření z laseru</button>'+
 '<button class="setting" id="openFeedbackReports" style="width:100%">Moje připomínky – chyby a požadavky</button>'+

 '<button class="setting" id="backupAll" style="width:100%">Exportovat všechny zakázky a přílohy (ZIP)</button>'+
 '<button class="setting" id="restoreAll" style="width:100%">Obnovit ZIP jako nové zakázky</button>';
 place.append(wrapper);
 wrapper.querySelector('#uiTheme').onchange=e=>{prefs.themeAccent=e.target.value;accent();save();if(native&&typeof Native.setAccent==='function')Native.setAccent(prefs.themeAccent)};
 for(const [id,key] of [['laserRoundingChoice','laserRounding'],['laserDecimalsChoice','laserDecimals']]){
  const select=wrapper.querySelector('#'+id);select.value=String(prefs[key]??(key==='laserDecimals'?'auto':'none'));
  select.onchange=()=>{prefs[key]=select.value;save()};
 }
 
 wrapper.querySelector('#openDiagnostics').onclick=openDiagnostics;
 wrapper.querySelector('#openHistory').onclick=showChanges;
 wrapper.querySelector('#openReadings').onclick=showLaserHistory;
 wrapper.querySelector('#openFeedbackReports').onclick=()=>{if(typeof window.__openFeedbackList==='function')window.__openFeedbackList();else notify('Otevření připomínek není dostupné')};
 wrapper.querySelector('#backupAll').onclick=()=>native?Native.exportBackup():notify('Export ZIP je dostupný v Android verzi');
 wrapper.querySelector('#restoreAll').onclick=()=>native?Native.importBackup():notify('Obnova ZIP je dostupná v Android verzi');
};
const releases=[
 {version:appVersionShort,title:'Ovládání podle ImageMeteru a Bosch',items:[
  ['Další dvě řady nástrojů – vysunutí tahem nahoru','extraToolbar'],
  ['Bosch automaticky změří vybranou kótu','laserTap'],
  ['Číslo domu u fotografií a doplnění z RÚIAN','photoAddress'],
  ['Nová přehledná ikona Bluetooth','readings'],
  ['Ikona galerie fotografií','gallery']
 ]},
 {version:'1.2',title:'Velká aktualizace Zaměřovače',items:[
  ['Galerie a listování fotografiemi','gallery'],
  ['Video a zvuk přímo v aplikaci','media'],
  ['Rozšířené hledání zakázek','search'],
  ['Přesné adresní místo v RÚIAN','address'],
  ['Zámek dokončených zakázek','lock'],
  ['Historie úprav fotografií','versions'],
  ['Kontrola součtu kót','sum'],
  ['Vrstvy anotací a nástroje pod +','layers'],
  ['Text, hlas a detailní fotografie v poznámce','notes'],
  ['Editovatelná kóta s popiskem v detailu','notes'],
  ['Diagnostika a sdílení logu','diagnostics'],
  ['Bosch měření a indikátor stavu','readings'],
  ['Fialový vzhled a volitelná barva','theme'],
  ['Zálohování a obnovení zakázek ZIP','backup'],
  ['Skici pomocí S Pen','sketch']
 ]},
 {version:'1.1',title:'Základní funkce Zaměřovače',items:[
  ['Zakázky a složky','browser'],['Fotografie s kótami','editor'],
  ['Textové poznámky a přílohy','notes'],['Export PNG/PDF','editor'],
  ['Výběr cloudové složky','settings']
 ]}
];
function navigateToFeature(key){
 $('modal').hidden=true;
 $('settingsPanel').hidden=true;
 const photo=state.records.find(r=>!r.deleted&&r.kind==='photo');
 const note=state.records.find(r=>!r.deleted&&r.kind==='note');
 const first=state.records.find(r=>!r.deleted);
 function editor(){
  if(!photo){showFolder();notify('Nejdřív otevři nebo vytvoř fotografii');return false}
  currentFolder=photo.parentId||null;openEditor(photo);return true
 }
 function settings(targetId){
  showFolder();$('settingsPanel').hidden=false;renderSettings();
  const target=$(targetId);if(target)target.scrollIntoView({block:'center',behavior:'smooth'});
 }
 switch(key){
  case 'extraToolbar':if(editor())$('editorMore').click();break;
  case 'laserTap':if(editor())notify('Nejdřív označ kótu, potom měř Boschem. Hodnota se uloží sama.');break;
  case 'gallery':showFolder();openGallery(0);break;
  case 'media':showFolder();notify('Klepni na video či hlasový soubor v seznamu zakázky');break;
  case 'search':showFolder();$('searchBtn').click();break;
  case 'address':showFolder();openAddressSearch();break;
  case 'photoAddress':{if(photo&&window.openPhotoAddressEditor){showFolder();window.openPhotoAddressEditor(photo.id)}else{showFolder();notify('Nejdřív pořiď nebo importuj fotografii')}break}
  case 'lock':showFolder();if(first)recordActions(first.id);else notify('Vytvoř nejdřív zakázku');break;
  case 'versions':if(editor())restoreVersion();break;
  case 'sum':if(editor())openSumCheck();break;
  case 'layers':if(editor())openLayers();break;
  case 'notes':if(editor()){setTool('note');notify('Umísti bod poznámky do fotografie')};break;
  case 'diagnostics':openDiagnostics();break;
  case 'readings':showLaserHistory();break;
  case 'theme':settings('uiTheme');break;
  case 'backup':settings('backupAll');break;
  case 'sketch':if(note){currentFolder=note.parentId||null;openNote(note);$('toggleSketch')?.click()}else{showFolder();notify('Nejdřív vytvoř textovou poznámku')};break;
  case 'editor':editor();break;
  case 'settings':settings('chooseCloud');break;
  default:showFolder();break;
 }
}
function showChanges(){
 modal('Novinky a historie aktualizací','<p>Instalovaná verze: <b>'+esc(appVersion)+'</b></p>'+
 releases.map((r,i)=>'<section class="releaseItem"><b>Verze '+esc(r.version)+'</b><p>'+esc(r.title)+'</p>'+
 r.items.map((t,j)=>'<div class="releaseFeature"><span>'+esc(t[0])+'</span><button class="outline" data-release="'+i+'" data-feature="'+j+'">Ukázat, kde to najdu</button></div>').join('')+'</section>').join('')+
 '<p class="muted">Zobrazují se novinky z verze 1.2 a ověřené základní změny verze 1.1. Datum a číslo konkrétní APK určuje GitHub vydání.</p>',()=>true,'Zavřít');
 $('modalBody').querySelectorAll('[data-release]').forEach(b=>b.onclick=()=>{
  const i=Number(b.dataset.release),j=Number(b.dataset.feature);
  navigateToFeature(releases[i].items[j][1]);
 });
}
function openDiagnostics(){
 modal('Diagnostika','<p>Záznamy se ukládají jen v zařízení, bez obsahu zákaznických poznámek. Do jiné aplikace se předají pouze na tvoje vyžádání.</p>'+
 '<div class="diagScroll">'+history.slice(-100).reverse().map(h=>'<div><small>'+esc(new Date(h.time).toLocaleString('cs-CZ'))+'</small> ['+esc(h.group)+'] '+esc(h.message)+'</div>').join('')+'</div>'+
 '<div class="row wrap"><button class="outline" id="shareLog">Sdílet diagnostiku</button><button class="outline" id="deleteLog">Vymazat záznamy</button></div>',()=>true,'Zavřít');
 $('shareLog').onclick=()=>{
  const text='Zaměřovač '+appVersion+'\n'+history.map(x=>x.time+' ['+x.group+'] '+x.message).join('\n');
  if(native&&Native.shareText)Native.shareText('Diagnostika Zaměřovače',text);
  else if(navigator.clipboard)navigator.clipboard.writeText(text).then(()=>notify('Log zkopírován'));
  else notify('Sdílení není dostupné');
 };
 $('deleteLog').onclick=()=>{history.length=0;localStorage.removeItem('zamerovac-diagnostic-v1');$('modal').hidden=true;notify('Log vymazán')};
}
// Původní onClick uchovává referenci na starou funkci – přepojit na rozšířenou nabídku.
$('editorMore').onclick=showEditorOverflow;
$('editorTopMenu').onclick=showEditorOverflow;
const oldBack=window.handleAndroidBack;
window.handleAndroidBack=()=>{
 if(gallery){closeGallery();return 'handled'}
 const media=document.querySelector('.mediaOverlay');
 if(media){media.querySelector('video,audio')?.pause();media.remove();return 'handled'}
 return oldBack();
};
if(appVersion!=='web'){
 try{
  const key='zamerovac-last-seen-app-version';
  if(localStorage.getItem(key)!==appVersion){localStorage.setItem(key,appVersion);setTimeout(()=>showChanges(),700)}
 }catch(e){}
}
})();
