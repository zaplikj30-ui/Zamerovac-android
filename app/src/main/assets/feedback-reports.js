/* Zaměřovač TEST: lokální připomínky označované S Penem, hromadný export ZIP.
 * Bez sítě a bez automatického sdílení zákaznických dat.
 */
'use strict';
(function(){
 const KEY='zamerovac-feedback-v1',POS='zamerovac-feedback-flag-position-v1';
 const validId=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(id);
 let reports=[];
 try{const v=JSON.parse(localStorage.getItem(KEY)||'[]');if(Array.isArray(v))reports=v.filter(x=>x&&typeof x==='object').slice(-300)}catch(e){}
 const persist=()=>{try{localStorage.setItem(KEY,JSON.stringify(reports))}catch(e){notify('Nepodařilo se uložit seznam připomínek')}};
 const q=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const now=()=>new Date().toISOString();
 const makeId=()=>typeof uid==='function'?uid():'f-'+Date.now()+'-'+Math.random().toString(36).slice(2);
 const videoName=v=>typeof v==='string'?v:v?.name||'Video obrazovky';
 const flag=document.createElement('button');
 flag.id='feedbackFlag';flag.type='button';flag.title='Nahlásit chybu nebo změnu (podržení: seznam připomínek)';
 flag.setAttribute('aria-label','Nahlásit chybu nebo změnu');
 flag.innerHTML='<svg width="25" height="25" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 21V4m0 1c2-2 5-2 8 0s5 2 7 0v12c-2 2-5 2-7 0s-6-2-8 0"/></svg>';
 document.body.appendChild(flag);
 const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
 let flagPosition={edge:'right',top:.43};
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
  longTimer=setTimeout(()=>{if(drag&&!drag.moved){longHandled=true;showReportList()}},650);
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
  return '<div class="feedback-card-title">'+q(r.title||r.description.slice(0,65)||'(Bez popisu)')+'</div>'+
    '<small>'+q(r.type==='bug'?'Chyba':'Změna')+' · '+q(r.screen||'')+' · '+q(new Date(r.createdAt).toLocaleDateString('cs-CZ'))+
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
   '<button data-feedback-edit="'+q(r.id)+'" class="outline">Otevřít</button></article>'
  ).join('');
  makeOverlay('<div class="feedback-head"><b>Moje připomínky ('+reports.length+')</b><button id="feedbackClose" class="feedback-close" aria-label="Zavřít">✕</button></div>'+
   '<div class="feedback-list"><p class="feedback-muted">Hlášení zůstávají v tomto zařízení. Až budeš chtít, vybereš je a odešleš společně.</p>'+
   (cards||'<p>Zatím žádné připomínky. Klepni na vlaječku a označ první problém.</p>')+
   '</div><div class="feedback-list-footer">'+
   '<label class="feedback-check-all"><input type="checkbox" id="feedbackAll"> Vybrat vše</label>'+
   '<button id="feedbackDeleteResolved" class="outline">Smazat vyřešené</button>'+
   '<button id="feedbackSaveZip" class="outline">Uložit ZIP</button>'+
   '<button id="feedbackShareZip" class="primary">Sdílet vybrané</button></div>');
  overlay.querySelector('#feedbackClose').onclick=closeOverlay;
  overlay.querySelectorAll('[data-feedback-edit]').forEach(button=>button.onclick=()=>{
   const report=reports.find(x=>x.id===button.dataset.feedbackEdit);
   if(report)editReport(JSON.parse(JSON.stringify(report)),false);
  });
  overlay.querySelector('#feedbackAll').onchange=e=>overlay.querySelectorAll('[data-feedback-check]').forEach(c=>c.checked=e.target.checked);
  overlay.querySelector('#feedbackDeleteResolved').onclick=()=>{
   const count=reports.filter(r=>r.resolved).length;
   if(!count){notify('Žádné vyřešené připomínky');return}
   if(!window.confirm('Smazat '+count+' vyřešených připomínek ze seznamu?'))return;
   reports=reports.filter(r=>!r.resolved);persist();showReportList();
  };
  overlay.querySelector('#feedbackShareZip').onclick=()=>sendBatch(false);
  overlay.querySelector('#feedbackSaveZip').onclick=()=>sendBatch(true);
 }
 function sendBatch(saveToFile){
  const batch=selectedReports();
  if(!batch.length){notify('Nejdřív vyber alespoň jednu připomínku');return}
  if(!native||!Native.shareIssueBundle){notify('Export ZIP je dostupný v Android aplikaci');return}
  // Připojeny jsou výhradně snímky vytvořené při hlášení a videa zvolená uživatelem.
  const manifest={application:'Zaměřovač TEST',exportedAt:now(),
   formatVersion:1,reports:batch.map(r=>({...r,device:'Android'}))};
  if(saveToFile)Native.saveIssueBundle(JSON.stringify(manifest));
  else Native.shareIssueBundle(JSON.stringify(manifest));
 }
 window.onReportBundleSaved=()=>notify('ZIP připomínek uložen');
 function editReport(report,isNew){
  active={report,isNew,tool:'pen',selected:-1,stroke:null,canvas:null,image:null};
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
    '<div class="feedback-image-wrap"><canvas id="feedbackCanvas" aria-label="Zachycená obrazovka pro označení chyby"></canvas></div>'+
    '<div class="feedback-fields">'+
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
  overlay.querySelector('#feedbackToList').onclick=showReportList;
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
  overlay.querySelector('#feedbackSave').onclick=()=>saveReport();
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
 let moving=null;
 function pointerDown(e){
  if(!active||e.button!==0)return;
  e.preventDefault();active.canvas.setPointerCapture(e.pointerId);
  const p=locate(e),tool=active.tool;
  if(tool==='move'){
   const i=hitIndex(p);active.selected=i;
   moving=i>=0?{index:i,point:p,points:active.report.annotations[i].points.map(x=>x.slice())}:null;
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
  if(!active||e.buttons===0)return;
  if(!active.stroke&&!moving)return;
  e.preventDefault();
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
  active.stroke=null;moving=null;
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
  const r=active.report;
  r.type=overlay.querySelector('#feedbackType').value;
  r.title=overlay.querySelector('#feedbackTitle').value.trim().slice(0,130);
  r.description=overlay.querySelector('#feedbackDescription').value.trim();
  if(!r.description&&!r.title){notify('Napiš alespoň krátce, co chceš změnit');return}
  r.resolved=!!overlay.querySelector('#feedbackResolved')?.checked;
  r.updatedAt=now();
  busy=true;
  const saveBtn=overlay.querySelector('#feedbackSave');saveBtn.disabled=true;saveBtn.textContent='Ukládám…';
  try{
   if(active.canvas&&active.image){
    const blob=await new Promise(ok=>active.canvas.toBlob(ok,'image/png'));
    if(blob&&native){
     const id=makeId();
     Native.beginMedia(id,'image/png','oznacena-chyba.png');
     const bytes=new Uint8Array(await blob.arrayBuffer());
     for(let off=0;off<bytes.length;off+=48*1024){
      const part=bytes.subarray(off,off+48*1024);
      let str='';for(const x of part)str+=String.fromCharCode(x);
      Native.appendMedia(id,btoa(str));
     }
     Native.finishMedia(id);
     r.annotatedId=id;
    }
   }
   const i=reports.findIndex(x=>x.id===r.id);
   if(i>=0)reports[i]=r;else reports.push(r);
   persist();showReportList();notify('Připomínka uložena');
  }catch(e){
   notify('Připomínku se nepodařilo uložit');
   if(saveBtn){saveBtn.disabled=false;saveBtn.textContent='Uložit připomínku'}
  }finally{busy=false}
 }
 window.__openFeedbackList=showReportList;
})();
