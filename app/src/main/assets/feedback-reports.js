/* Zaměřovač TEST: lokální připomínky označované S Penem, hromadný export ZIP.
 * Bez sítě a bez automatického sdílení zákaznických dat.
 */
'use strict';
(function(){
 const KEY='zamerovac-feedback-v1',POS='zamerovac-feedback-flag-position-v1';
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(id);
 let reports=[];
 // If a write may have reached localStorage but its readback was not verified,
 // all subsequent mutations must wait for a fresh startup load.
 let feedbackWriteUncertain=false;
 // Never truncate on restart: doing so could silently erase older reports on the next save.
 try{
  const v=JSON.parse(localStorage.getItem(KEY)||'[]');
  if(Array.isArray(v)){
   reports=v.filter(x=>x&&typeof x==='object'&&!Array.isArray(x));
   // Malformed legacy elements stay intact in storage; never persist a filtered subset.
   if(reports.length!==v.length)feedbackWriteUncertain=true;
  }else feedbackWriteUncertain=true;
 }catch(e){feedbackWriteUncertain=true}
 // Commit the proposed list only after the device confirms its storage bytes.
 // A quota/private-mode failure must never be reported as a successful save.
 const persist=next=>{
  if(feedbackWriteUncertain){
   notify('Stav uložených připomínek je nejistý. Před další změnou znovu spusť aplikaci.');
   return false;
  }
  let attempted=false;
  try{
   const serialized=JSON.stringify(next);
   attempted=true;
   localStorage.setItem(KEY,serialized);
   if(localStorage.getItem(KEY)!==serialized)throw new Error('Nepotvrzený zápis připomínek');
   return true;
  }catch(e){
   // Even if setItem succeeded, a failed readback leaves the persisted baseline unknown.
   // Do not let the old RAM list overwrite a more recent, actually committed value.
   if(attempted)feedbackWriteUncertain=true;
   notify('Nepodařilo se uložit seznam připomínek'+
    (feedbackWriteUncertain?'. Stav úložiště je nejistý; před další změnou znovu spusť aplikaci.':''));
   return false;
  }
 };
 const q=s=>String(typeof s==='string'||typeof s==='number'?s:'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=()=>new Date().toISOString();
 const makeId=()=>typeof uid==='function'?uid():'f-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const videoName=v=>typeof v==='string'?v:v?.name||'Video obrazovky';
 const flag=document.createElement('button');
 flag.id='feedbackFlag';flag.type='button';flag.title='Nahlásit chybu nebo změnu (podržení: seznam připomínek)';
 flag.setAttribute('aria-label','Nahlásit chybu nebo změnu');
 flag.innerHTML='<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4m0 1c2-2 5-2 8 0s5 2 7 0v12c-2 2-5 2-7 0s-6-2-8 0"/></svg>';
 document.body.appendChild(flag);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let flagPosition={edge:'right',top:.17};
 try{const saved=JSON.parse(localStorage.getItem(POS)||'{}');if(['left','right'].includes(saved.edge)&&Number.isFinite(saved.top))flagPosition=saved}catch(e){}
 function placeFlag(){
  flag.style.top=clamp(flagPosition.top,0.10,0.88)*100+'%';
  flag.style.left=flagPosition.edge==='left'?'9px':'auto';
  flag.style.right=flagPosition.edge==='right'?'9px':'auto';
 }
 placeFlag();
 let drag=null,longTimer=null,longHandled=false;
 flag.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  drag={x:e.clientX,y:e.clientY,t:Date.now(),moved:false};
  longHandled=false;
  try{flag.setPointerCapture(e.pointerId)}catch(err){}
  clearTimeout(longTimer);
  longTimer=setTimeout(()=>{if(drag&&!drag.moved){longHandled=true;drag=null;showReportList()}},650);
 });
 flag.addEventListener('pointermove',e=>{
  if(!drag)return;
  if(Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>9)drag.moved=true;
  if(drag.moved){
   clearTimeout(longTimer);
   flag.style.left=clamp(e.clientX-23,4,innerWidth-49)+'px';
   flag.style.top=clamp(e.clientY-23,48,innerHeight-58)+'px';
   flag.style.right='auto';
  }
 });
 flag.addEventListener('pointerup',e=>{
  if(!drag)return;
  clearTimeout(longTimer);
  const moved=drag.moved;drag=null;
  try{flag.releasePointerCapture(e.pointerId)}catch(err){}
  if(moved){
   flagPosition.edge=e.clientX<innerWidth/2?'left':'right';
   flagPosition.top=clamp((e.clientY-23)/innerHeight,.10,.88);
   localStorage.setItem(POS,JSON.stringify(flagPosition));
   placeFlag();
  }else if(!longHandled){startNewReport()}
 });
 flag.addEventListener('pointercancel',()=>{drag=null;clearTimeout(longTimer);placeFlag()});
 flag.addEventListener('contextmenu',e=>{e.preventDefault();clearTimeout(longTimer);drag=null;showReportList()});
 let overlay=null,active=null,busy=false;
 function closeOverlay(){
  // Keep the editable report until slow PNG/storage writes have finished.
  if(busy&&active){notify('Probíhá ukládání připomínky. Nejdřív jej dokonči.');return}
  if(overlay)overlay.remove();overlay=null;active=null;flag.hidden=false;
 }
 function makeOverlay(markup){
  if(overlay)overlay.remove();
  flag.hidden=true;
  overlay=document.createElement('section');
  overlay.id='feedbackOverlay';overlay.className='feedback-overlay';
  overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');
  overlay.innerHTML=markup;
  document.body.appendChild(overlay);
 }
 function screenName(){
  const isSettings=!document.getElementById('settingsPanel')?.hidden;
  return isSettings?'Nastavení':screen==='editor'?'Editor fotografie':screen==='note'?'Poznámka':'Seznam zakázek';
 }
 function startNewReport(){
  if(!native||typeof Native.captureReportScreenshot!=='function'){
   notify('Automatické zachycení obrazovky funguje v testovací Android aplikaci');
   return;
  }
  if(busy)return;busy=true;
  // Snímek se pořídí ještě před otevřením editoru připomínky.
  flag.style.visibility='hidden';
  window.__feedbackCaptureContext={screen:screenName(),recordId:current?.id||null};
  requestAnimationFrame(()=>requestAnimationFrame(()=>Native.captureReportScreenshot()));
 }
 window.onReportScreenshot=id=>{
  flag.style.visibility='';
  busy=false;
  if(!validId(id)){notify('Snímek se nepodařilo zachytit');return}
  const ctx=window.__feedbackCaptureContext||{};
  const r={id:makeId(),createdAt:now(),updatedAt:now(),
   appVersion:typeof appVersion==='string'?appVersion:'web',device:'Android',
   screen:ctx.screen||screenName(),type:'change',title:'',description:'',
   screenshotId:id,annotatedId:null,annotations:[],videos:[],resolved:false};
  editReport(r,true);
 };
 function getBase(id){return validId(id)?'https://appassets.androidplatform.net/media/'+encodeURIComponent(id):''}
 function summary(r){
  const title=typeof r.title==='string'?r.title:'';
  const description=typeof r.description==='string'?r.description:'';
  const screen=typeof r.screen==='string'?r.screen:'';
  const rawDate=typeof r.createdAt==='string'?r.createdAt:'';
  const date=rawDate&&!Number.isNaN(Date.parse(rawDate))?
   new Date(rawDate).toLocaleDateString('cs-CZ'):'Datum neuvedeno';
  return '<div class="feedback-card-title">'+q(title||description.slice(0,65)||'(Bez popisu)')+'</div>'+
    '<small>'+q(r.type==='bug'?'Chyba':'Změna')+' · '+q(screen)+' · '+q(date)+
    (r.resolved?' · Vyřešeno':'')+'</small>';
 }
 function selectedReports(){
  return reports.filter(r=>overlay?.querySelector('input[data-feedback-check="'+r.id+'"]')?.checked);
 }
 function showReportList(){
  const cards=reports.slice().reverse().map(r=>
   '<article class="feedback-card">'+
   '<input type="checkbox" data-feedback-check="'+q(r.id)+'" aria-label="Vybrat připomínku" '+(r.resolved?'':'checked')+'>'+
   '<div class="feedback-card-detail">'+summary(r)+'</div>'+
   '<button data-feedback-edit="'+q(r.id)+'" class="outline">Otevřít</button>'+
   '<button data-feedback-delete="'+q(r.id)+'" class="outline">Smazat</button></article>'
  ).join('');
  makeOverlay('<div class="feedback-head"><b>Moje připomínky ('+reports.length+')</b><button id="feedbackClose" class="feedback-close" aria-label="Zavřít">✕</button></div>'+
   '<div class="feedback-list"><p class="feedback-muted">Hlášení zůstávají v tomto zařízení. Až budeš chtít, vybereš je a odešleš společně.</p>'+
   (feedbackWriteUncertain?'<p class="feedback-muted">Stav uložených hlášení nelze bezpečně ověřit. Změny a export jsou zablokovány; nepřepisuj ani nemaž data aplikace.</p>':'')+
   (cards||'<p>Zatím žádné připomínky. Klepni na vlaječku a označ první problém.</p>')+
   '</div><div class="feedback-list-footer">'+
   '<label class="feedback-check-all"><input type="checkbox" id="feedbackAll"> Vybrat vše</label>'+
   '<button id="feedbackDeleteResolved" class="outline">Smazat vyřešené</button>'+
   '<button id="feedbackCleanupZip" class="outline">Vyčistit dočasné ZIPy</button>'+
   '<button id="feedbackSaveZip" class="outline">Uložit ZIP</button>'+
   '<button id="feedbackShareZip" class="primary">Sdílet vybrané</button></div>');
  overlay.querySelector('#feedbackClose').onclick=closeOverlay;
  overlay.querySelectorAll('[data-feedback-edit]').forEach(button=>button.onclick=()=>{
   const report=reports.find(x=>x.id===button.dataset.feedbackEdit);
   if(report)editReport(JSON.parse(JSON.stringify(report)),false);
  });
  overlay.querySelectorAll('[data-feedback-delete]').forEach(button=>button.onclick=()=>{
   const id=button.dataset.feedbackDelete;
   const matches=reports.filter(r=>r.id===id);
   if(!matches.length)return;
   if(matches.length!==1){
    notify('Nelze bezpečně smazat: více hlášení má stejné ID. Nic nebylo smazáno.');
    return;
   }
   const report=matches[0];
   const name=String(report.title||report.description||'(Bez popisu)').slice(0,100);
   if(!window.confirm('Opravdu smazat uložené hlášení „'+name+'“?\n'+
      'Smaže se jen jeho záznam ze seznamu. Původní snímky ani videa se nemažou.'))return;
   // Remove precisely one confirmed object, never every entry sharing an ID.
   const remaining=reports.slice();
   remaining.splice(reports.indexOf(report),1);
   if(!persist(remaining))return;
   reports=remaining;showReportList();notify('Hlášení smazáno');
  });
  overlay.querySelector('#feedbackCleanupZip').onclick=()=>{
   if(!native||typeof Native.cleanupFinishedIssueBundles!=='function'){
    notify('Úklid dočasných ZIPů je dostupný v Android aplikaci');return;
   }
   // Native shows its own confirmation. The chooser alone does not prove delivery.
   Native.cleanupFinishedIssueBundles();
  };
  overlay.querySelector('#feedbackAll').onchange=e=>overlay.querySelectorAll('[data-feedback-check]').forEach(c=>c.checked=e.target.checked);
  overlay.querySelector('#feedbackDeleteResolved').onclick=()=>{
   const button=overlay.querySelector('#feedbackDeleteResolved');
   const count=reports.filter(r=>r.resolved).length;
   if(!count){notify('Žádné vyřešené připomínky');return}
   if(button.dataset.confirm!=='yes'){
    button.dataset.confirm='yes';
    button.textContent='Potvrdit smazání ('+count+')';
    notify('Pro smazání klepni ještě jednou');
    return;
   }
   const remaining=reports.filter(r=>!r.resolved);
   if(!persist(remaining))return;
   reports=remaining;showReportList();
  };
  overlay.querySelector('#feedbackShareZip').onclick=()=>sendBatch(false);
  overlay.querySelector('#feedbackSaveZip').onclick=()=>sendBatch(true);
 }
 function sendBatch(saveToFile){
  if(feedbackWriteUncertain){
   notify('Stav uložených připomínek je nejistý. Před exportem znovu spusť aplikaci.');
   return;
  }
  // Do not silently omit an ambiguous or invalid record from a shared evidence bundle.
  if(reports.some(r=>!validId(r.id))||new Set(reports.map(r=>r.id)).size!==reports.length){
   notify('Nelze bezpečně exportovat: hlášení mají neplatné nebo duplicitní ID.');
   return;
  }
  const batch=selectedReports();
  if(!batch.length){notify('Nejdřív vyber alespoň jednu připomínku');return}
  if(!native||typeof (saveToFile?Native.saveIssueBundle:Native.shareIssueBundle)!=='function'){
   notify('Export ZIP je dostupný v Android aplikaci');return;
  }
  if(!saveToFile){
   const overview=batch.map((r,i)=>{
    const videos=Array.isArray(r.videos)?r.videos:[];
    const names=videos.map(v=>String(typeof v==='string'?v:v?.name||'Video').slice(0,80)).join(', ');
    return (i+1)+'. '+String(r.title||r.description||'(Bez popisu)').slice(0,100)+
      ' — '+videos.length+' video'+(names?' ('+names+')':'');
   }).join('\n');
   const warning='Před sdílením otevři každou připomínku a zkontroluj obsah snímků, videí i textů.\n'+
     'Viditelné adresy, jména či zakázky se automaticky nezakrývají.\n'+
     'Video může obsahovat skrytá metadata a zachovává původní kvalitu.\n\n'+
     'Vybraná hlášení:\n'+overview+'\n\nPokračovat k systémové nabídce sdílení?';
   if(!window.confirm(warning))return;
  }
  // Android vytvoří oddělený ZIP; lokální originály se nepřepisují.
  const manifest={application:'Zaměřovač TEST',exportedAt:now(),
   formatVersion:1,reports:batch.map(r=>({...r,device:'Android'}))};
  if(saveToFile)Native.saveIssueBundle(JSON.stringify(manifest));
  else Native.shareIssueBundle(JSON.stringify(manifest));
 }
 window.onReportBundleSaved=()=>notify('ZIP připomínek uložen');
 window.onReportBundlesCleaned=count=>notify('Vyčištěné dočasné ZIPy: '+Number(count||0));
 function editReport(report,isNew){
  active={report,isNew,tool:'pen',selected:-1,stroke:null,canvas:null,image:null,
    viewport:{scale:1,x:0,y:0},pointers:new Map(),gesture:null,gestureEnding:false,pan:null};
  makeOverlay('<div class="feedback-head"><b>'+(isNew?'Nová připomínka':'Upravit připomínku')+'</b>'+
   '<button id="feedbackToList" class="outline">Seznam ('+reports.length+')</button>'+
   '<button id="feedbackClose" class="feedback-close" aria-label="Zavřít">✕</button></div>'+
   '<div class="feedback-editor-content">'+
    '<div class="feedback-tools" role="toolbar" aria-label="Označování chyby">'+
     '<button data-feedback-tool="pen" class="selected" title="Kreslit S Penem">✎ Pero</button>'+
     '<button data-feedback-tool="ellipse">◯ Kroužek</button>'+
     '<button data-feedback-tool="rect">▢ Čtverec</button>'+
     '<button data-feedback-tool="arrow">➜ Šipka</button>'+
     '<button data-feedback-tool="text">T Text</button>'+
     '<button data-feedback-tool="move">✥ Přesunout</button>'+
     '<button id="feedbackUndo" title="Vrátit poslední značku">↶</button>'+
    '</div>'+
    '<div class="feedback-image-wrap"><canvas id="feedbackCanvas" aria-label="Celá zachycená obrazovka pro označení chyby"></canvas>'+ 
     '<div class="feedback-zoom" aria-label="Přiblížení obrázku">'+
      '<button type="button" id="feedbackZoomIn" title="Přiblížit">＋</button>'+
      '<button type="button" id="feedbackZoomOut" title="Oddálit">−</button>'+
      '<button type="button" id="feedbackZoomFit" title="Zobrazit celou obrazovku">Celá</button>'+
     '</div></div>'+
    '<div class="feedback-fields collapsed">'+
     '<button type="button" id="feedbackFieldsToggle" class="feedback-fields-toggle" aria-expanded="false">▴ Popis chyby a přílohy (otevřít)</button>'+
     '<label>Co chceš nahlásit? <select id="feedbackType"><option value="bug">Chyba</option><option value="change">Chci změnu</option></select></label>'+
     '<input id="feedbackTitle" placeholder="Krátký název, např. Posunout tlačítko" maxlength="130">'+
     '<textarea id="feedbackDescription" rows="3" placeholder="Co je špatně a jak to má fungovat?"></textarea>'+
     '<div class="feedback-extra"><input id="feedbackTextLabel" placeholder="Text přímo do obrázku (vyber Text a klepni)" value="Přesunout sem" maxlength="160">'+
     '<button id="feedbackAddVideo" class="outline">＋ Připojit video</button><span id="feedbackVideoCount"></span></div>'+
     (!isNew?'<label class="feedback-resolved"><input type="checkbox" id="feedbackResolved"> Vyřešeno</label>':'')+
    '</div>'+
   '</div><div class="feedback-foot"><button id="feedbackCancel" class="outline">Zavřít</button><button id="feedbackSave" class="primary">Uložit připomínku</button></div>');
  overlay.querySelector('#feedbackClose').onclick=closeOverlay;
  overlay.querySelector('#feedbackCancel').onclick=closeOverlay;
  overlay.querySelector('#feedbackToList').onclick=()=>{
   if(busy){notify('Probíhá ukládání připomínky. Nejdřív jej dokonči.');return}
   showReportList();
  };
  overlay.querySelector('#feedbackTitle').value=report.title||'';
  overlay.querySelector('#feedbackDescription').value=report.description||'';
  overlay.querySelector('#feedbackType').value=report.type||'change';
  if(!isNew)overlay.querySelector('#feedbackResolved').checked=!!report.resolved;
  function countVideos(){overlay.querySelector('#feedbackVideoCount').textContent=(report.videos||[]).length+' video'}
  countVideos();
  overlay.querySelector('#feedbackAddVideo').onclick=()=>{
   if(typeof pickMedia!=='function'){notify('Výběr videa není dostupný');return}
   // Systémový výběr: stejný jako při přidání přílohy; videa se do ZIP přidají až při exportu.
   pickMedia('file',(id,file)=>{
    const mime=file?.type||file?.mime||'';
    if(!mime.startsWith('video/')){notify('Vyber prosím video obrazovky');return}
    report.videos=report.videos||[];
    report.videos.push({id,name:file.name||'Video obrazovky',mime});
    if(overlay)countVideos();
   });
  };
  overlay.querySelectorAll('[data-feedback-tool]').forEach(b=>b.onclick=()=>{
   active.tool=b.dataset.feedbackTool;active.selected=-1;
   overlay.querySelectorAll('[data-feedback-tool]').forEach(x=>x.classList.toggle('selected',x===b));
  });
  overlay.querySelector('#feedbackUndo').onclick=()=>{
   if(report.annotations.length)report.annotations.pop();
   active.selected=-1;repaint();
  };
  const fields=overlay.querySelector('.feedback-fields');
  const fieldsToggle=overlay.querySelector('#feedbackFieldsToggle');
  function setFieldsOpen(open){
   fields.classList.toggle('collapsed',!open);
   fieldsToggle.setAttribute('aria-expanded',String(open));
   fieldsToggle.textContent=open?'▾ Popis chyby a přílohy (skrýt)':'▴ Popis chyby a přílohy (otevřít)';
  }
  fieldsToggle.onclick=()=>setFieldsOpen(fields.classList.contains('collapsed'));
  overlay.querySelector('#feedbackSave').onclick=()=>{
   if(fields.classList.contains('collapsed')&&!overlay.querySelector('#feedbackTitle').value.trim()&&
      !overlay.querySelector('#feedbackDescription').value.trim()){
    setFieldsOpen(true);
    overlay.querySelector('#feedbackTitle').focus();
    return;
   }
   saveReport();
  };
  overlay.querySelector('#feedbackZoomIn').onclick=()=>setZoom(active.viewport.scale*1.5);
  overlay.querySelector('#feedbackZoomOut').onclick=()=>setZoom(active.viewport.scale/1.5);
  overlay.querySelector('#feedbackZoomFit').onclick=()=>setZoom(1);
  const canvas=overlay.querySelector('#feedbackCanvas');
  active.canvas=canvas;
  const img=new Image();
  img.onload=()=>{
   if(!active||active.report!==report)return;
   active.image=img;canvas.width=img.naturalWidth;canvas.height=img.naturalHeight;
   repaint();
  };
  img.onerror=()=>{notify('Původní snímek chybí');canvas.width=720;canvas.height=1400;repaint()};
  img.src=getBase(report.screenshotId);
  canvas.addEventListener('pointerdown',pointerDown);
  canvas.addEventListener('pointermove',pointerMove);
  canvas.addEventListener('pointerup',pointerUp);
  canvas.addEventListener('pointercancel',pointerUp);
 }
 function locate(e){
  const b=active.canvas.getBoundingClientRect();
  return [clamp((e.clientX-b.left)/b.width,0,1),clamp((e.clientY-b.top)/b.height,0,1)];
 }
 function near(a,p){
  const w=active.canvas.clientWidth||400,h=active.canvas.clientHeight||700;
  return Math.hypot((a[0]-p[0])*w,(a[1]-p[1])*h)<23;
 }
 function hitIndex(p){
  const arr=active.report.annotations;
  for(let i=arr.length-1;i>=0;i--){
   const a=arr[i],ps=a.points||[];
   if(ps.some(t=>near(t,p)))return i;
   if(a.type==='rect'||a.type==='ellipse'){
    if(ps.length>=2&&p[0]>=Math.min(ps[0][0],ps[1][0])-.025&&p[0]<=Math.max(ps[0][0],ps[1][0])+.025&&p[1]>=Math.min(ps[0][1],ps[1][1])-.025&&p[1]<=Math.max(ps[0][1],ps[1][1])+.025)return i;
   }
  }
  return -1;
 }
 function updateImageView(){
  if(!active?.canvas)return;
  const v=active.viewport;
  active.canvas.style.transform='translate('+v.x+'px,'+v.y+'px) scale('+v.scale+')';
 }
 function setZoom(scale){
  if(!active)return;
  const v=active.viewport;
  v.scale=clamp(scale,1,6);
  if(v.scale===1){v.x=0;v.y=0}
  updateImageView();
 }
 let moving=null;
 function pointerDown(e){
  if(!active||(e.pointerType==='mouse'&&e.button!==0))return;
  e.preventDefault();
  try{active.canvas.setPointerCapture(e.pointerId)}catch(err){}
  active.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(active.pointers.size===2){
   // Druhý prst znamená přiblížení/posunutí, nikoli další malování.
   if(active.stroke){
    const annotations=active.report.annotations;
    const last=annotations[annotations.length-1];
    if(last===active.stroke)annotations.pop();
   }
   active.stroke=null;moving=null;active.pan=null;
   const ps=[...active.pointers.values()];
   const rect=active.canvas.getBoundingClientRect();
   active.gesture={
    center:{x:rect.left+rect.width/2-active.viewport.x,
            y:rect.top+rect.height/2-active.viewport.y},
    distance:Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y)),
    mid:{x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2},
    scale:active.viewport.scale,x:active.viewport.x,y:active.viewport.y
   };
   repaint();return;
  }
  if(active.pointers.size!==1||active.gestureEnding)return;
  const p=locate(e),tool=active.tool;
  if(tool==='move'){
   const i=hitIndex(p);active.selected=i;
   moving=i>=0?{index:i,point:p,points:active.report.annotations[i].points.map(x=>x.slice())}:null;
   active.pan=i<0&&active.viewport.scale>1?{
    id:e.pointerId,x:e.clientX,y:e.clientY,
    startX:active.viewport.x,startY:active.viewport.y
   }:null;
  }else{
   const a={type:tool,points:[p,p.slice()],text:''};
   if(tool==='text'){
    a.points=[p];
    a.text=overlay.querySelector('#feedbackTextLabel').value.trim()||'Přesunout sem';
   }else if(tool==='pen')a.points=[p];
   active.report.annotations.push(a);active.stroke=a;
  }
  repaint();
 }
 function pointerMove(e){
  if(!active||!active.pointers.has(e.pointerId))return;
  active.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(active.gesture&&active.pointers.size>=2){
   e.preventDefault();
   const ps=[...active.pointers.values()];
   const distance=Math.max(1,Math.hypot(ps[0].x-ps[1].x,ps[0].y-ps[1].y));
   const mid={x:(ps[0].x+ps[1].x)/2,y:(ps[0].y+ps[1].y)/2};
   const v=active.viewport,g=active.gesture;
   v.scale=clamp(g.scale*distance/g.distance,1,6);
   // Místo pod prsty zůstává pod prsty i při změně měřítka.
   const ratio=v.scale/g.scale;
   v.x=mid.x-g.center.x-(g.mid.x-g.center.x-g.x)*ratio;
   v.y=mid.y-g.center.y-(g.mid.y-g.center.y-g.y)*ratio;
   if(v.scale===1){v.x=0;v.y=0}
   updateImageView();return;
  }
  if(active.gestureEnding||(!active.stroke&&!moving&&!active.pan))return;
  e.preventDefault();
  if(active.pan){
   const v=active.viewport,p=active.pan;
   v.x=p.startX+(e.clientX-p.x);
   v.y=p.startY+(e.clientY-p.y);
   updateImageView();return;
  }
  const p=locate(e);
  if(moving){
   const a=active.report.annotations[moving.index];
   if(a)a.points=moving.points.map(t=>[clamp(t[0]+p[0]-moving.point[0],0,1),clamp(t[1]+p[1]-moving.point[1],0,1)]);
  }else if(active.stroke){
   if(active.stroke.type==='pen')active.stroke.points.push(p);
   else if(active.stroke.type!=='text')active.stroke.points[1]=p;
  }
  repaint();
 }
 function pointerUp(e){
  if(!active)return;
  active.pointers.delete(e.pointerId);
  try{active.canvas.releasePointerCapture(e.pointerId)}catch(err){}
  if(active.gesture){
   if(active.pointers.size<2){active.gesture=null;active.gestureEnding=true}
  }else if(active.gestureEnding&&active.pointers.size===0)active.gestureEnding=false;
  if(active.pointers.size===0){
   active.stroke=null;active.pan=null;moving=null;
  }
 }
 function repaint(){
  if(!active||!active.canvas)return;
  const c=active.canvas,ctx=c.getContext('2d'),w=c.width,h=c.height;
  ctx.clearRect(0,0,w,h);ctx.fillStyle='#33343a';ctx.fillRect(0,0,w,h);
  if(active.image)ctx.drawImage(active.image,0,0,w,h);
  ctx.lineCap='round';ctx.lineJoin='round';
  const scale=Math.max(w/430,h/900,1);
  ctx.lineWidth=4*scale;ctx.strokeStyle='#ef3434';ctx.fillStyle='#ef3434';
  active.report.annotations.forEach((a,i)=>{
   const ps=a.points||[];if(!ps.length)return;
   const P=p=>[p[0]*w,p[1]*h],start=P(ps[0]),end=P(ps[ps.length-1]);
   ctx.save();ctx.beginPath();
   if(a.type==='pen'){
    ctx.moveTo(...start);ps.slice(1).forEach(p=>ctx.lineTo(...P(p)));ctx.stroke();
   }else if(a.type==='rect'){
    ctx.strokeRect(start[0],start[1],end[0]-start[0],end[1]-start[1]);
   }else if(a.type==='ellipse'){
    const rx=Math.max(1,Math.abs(end[0]-start[0])/2),ry=Math.max(1,Math.abs(end[1]-start[1])/2);
    ctx.beginPath();ctx.ellipse((start[0]+end[0])/2,(start[1]+end[1])/2,rx,ry,0,0,Math.PI*2);ctx.stroke();
   }else if(a.type==='arrow'){
    const dx=end[0]-start[0],dy=end[1]-start[1],angle=Math.atan2(dy,dx),head=17*scale;
    ctx.moveTo(...start);ctx.lineTo(...end);ctx.stroke();
    for(const d of [-.55,.55]){
     ctx.beginPath();ctx.moveTo(...end);
     ctx.lineTo(end[0]-head*Math.cos(angle+d),end[1]-head*Math.sin(angle+d));ctx.stroke();
    }
   }else if(a.type==='text'){
    const text=String(a.text||'Přesunout sem').slice(0,160);
    ctx.font='bold '+Math.round(18*scale)+'px Arial';
    ctx.lineWidth=5*scale;ctx.strokeStyle='#fff';
    ctx.strokeText(text,start[0],start[1]);ctx.fillText(text,start[0],start[1]);
   }
   if(i===active.selected){
    ctx.fillStyle='#fff';ctx.strokeStyle='#333';
    ctx.beginPath();ctx.arc(start[0],start[1],8*scale,0,Math.PI*2);ctx.fill();ctx.stroke();
   }
   ctx.restore();
  });
 }
 async function saveReport(){
  if(!active||busy)return;
  const editing=active;
  const r=editing.report;
  r.type=overlay.querySelector('#feedbackType').value;
  r.title=overlay.querySelector('#feedbackTitle').value.trim().slice(0,130);
  r.description=overlay.querySelector('#feedbackDescription').value.trim();
  if(!r.description&&!r.title){notify('Napiš alespoň krátce, co chceš změnit');return}
  r.resolved=!!overlay.querySelector('#feedbackResolved')?.checked;
  r.updatedAt=now();
  busy=true;
  const saveBtn=overlay.querySelector('#feedbackSave');saveBtn.disabled=true;saveBtn.textContent='Ukládám…';
  try{
   // Text/status-only edits reuse the already confirmed annotated image.
   // Re-rasterize if the source, annotations or saved image reference changed.
   const stored=reports.find(x=>x.id===r.id);
   const reuseRaster=!!(stored&&validId(stored.annotatedId)&&
     r.annotatedId===stored.annotatedId&&r.screenshotId===stored.screenshotId&&
     JSON.stringify(r.annotations||[])===JSON.stringify(stored.annotations||[]));
   if(!reuseRaster&&active.canvas&&active.image){
    const blob=await new Promise(ok=>editing.canvas.toBlob(ok,'image/png'));
    if(editing!==active)throw new Error('Editor připomínky se během ukládání změnil');
    if(!blob)throw new Error('Vykreslený snímek se nepodařilo vytvořit');
    if(native){
     const id=makeId();
     const bytes=new Uint8Array(await blob.arrayBuffer());
     if(editing!==active)throw new Error('Editor připomínky se během ukládání změnil');
     if(!Native.beginMediaChecked(id,'image/png','oznacena-chyba.png',bytes.length))throw new Error('Snímek nelze připravit');
     for(let off=0;off<bytes.length;off+=48*1024){
      const part=bytes.subarray(off,off+48*1024);
      let str='';for(const x of part)str+=String.fromCharCode(x);
      if(!Native.appendMedia(id,btoa(str)))throw new Error('Snímek nelze zapsat');
     }
     if(!Native.finishMedia(id))throw new Error('Snímek není úplný');
     r.annotatedId=id;
    }
   }
   if(editing!==active)throw new Error('Editor připomínky se během ukládání změnil');
   const i=reports.findIndex(x=>x.id===r.id);
   const nextReports=reports.slice();
   if(i>=0)nextReports[i]=r;else nextReports.push(r);
   // Keep the previous in-memory list and editable form on failed storage.
   if(!persist(nextReports))throw new Error('Připomínku nelze bezpečně uložit');
   reports=nextReports;
   showReportList();notify('Připomínka uložena');
  }catch(e){
   notify('Připomínku se nepodařilo uložit');
   if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Uložit připomínku'}
  }finally{busy=false}
 }
 // Android Zpět musí zavřít právě hlášení, nikoliv rozpracovanou fotografii.
 const previousBack=window.handleAndroidBack;
 window.handleAndroidBack=function(){
  if(overlay){closeOverlay();return 'handled'}
  return typeof previousBack==='function'?previousBack():'root';
 };
 window.__openFeedbackList=showReportList;
})();
