'use strict';
const toolGroups=[{title:'Měřicí nástroje',tools:[['dimension','↔','Rozměr'],['chain','↔','Dimenzní řetězec'],['cumulative','⇥','Kumulativní řetězec'],['angle','∠','Úhel'],['polyline','⌁','Lomená čára'],['area','▱','Plocha'],['rect','▭','Obdélník'],['circle','◯','Kruh'],['target','⊕','Směrovat']]},{title:'Kreslicí nástroje',tools:[['note','▤','Poznámka'],['line','／','Čára'],['arrow','➜','Šipka'],['freehand','✎','Volná ruka'],['ellipse','⬭','Elipsa'],['symbol','⚑','Symbol']]},{title:'Úpravy',tools:[['select','◎','Vybrat a upravit'],['pan','✥','Posun obrazu']]}];
const allTools=toolGroups.flatMap(g=>g.tools);
let drawStart=null,drawCurrent=null,stroke=[],polylineDraft=[],drawPointerId=null,selectedHandle=null,lastTap=0,lastTapAt=null,gesture=null;
let lastDrawingTool='dimension',suppressToolClick=false,repeatPressTimer=null,loupeSide=null;
function openEditor(r){loupeSide=null;screen='editor';document.body.classList.add('in-editor');closeMenus();$('editorHint').hidden=true;current=r;selected=null;mode='dimension';lastDrawingTool='dimension';updateDrawingToolButton();$('browserView').hidden=true;$('browserFoot').hidden=true;$('noteView').hidden=true;$('editorView').hidden=false;$('editorTitle').textContent=r.title;const photoMeta=$('editorPhotoMeta');if(photoMeta){photoMeta.textContent=photoDetailsText(r);photoMeta.title=photoMeta.textContent;}photoSize={w:r.width||1400,h:r.height||900};stageImg=null;selectedHandle=null;editStack=[];redoStack=[];if(r.kind==='photo'&&r.media?.[0]){assetUrl(r.media[0]).then(url=>{let img=new Image();img.onload=()=>{stageImg=img;photoSize={w:img.naturalWidth,h:img.naturalHeight};r.width=photoSize.w;r.height=photoSize.h;fitImage();paint()};img.onerror=()=>notify('Nepodařilo se načíst fotografii');img.src=url})}resizeEditor();fitImage();paint();}
function exitEditor(){current=null;screen='browser';showFolder()}
$('editorBack').onclick=exitEditor;
$('fitBtn').onclick=fitImage;$('zoomIn').onclick=()=>{const p=centerPoint();zoomAt(1.25,p.x,p.y)};$('zoomOut').onclick=()=>{const p=centerPoint();zoomAt(.8,p.x,p.y)};
function centerPoint(){return{x:stageCanvas.clientWidth/2,y:stageCanvas.clientHeight/2}}
function resizeEditor(){if(screen!=='editor')return;let el=$('stage'),dpr=window.devicePixelRatio||1;stageCanvas.width=Math.max(1,Math.floor(el.clientWidth*dpr));stageCanvas.height=Math.max(1,Math.floor(el.clientHeight*dpr));ctx.setTransform(dpr,0,0,dpr,0,0);paint()}
window.addEventListener('resize',resizeEditor);
function fitImage(){let w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;if(!w||!h)return;view.zoom=Math.min((w-24)/photoSize.w,(h-24)/photoSize.h);view.dx=(w-photoSize.w*view.zoom)/2;view.dy=(h-photoSize.h*view.zoom)/2;paint()}
function zoomAt(factor,x,y){let before=screenToWorld({x,y});view.zoom=Math.min(12,Math.max(.05,view.zoom*factor));view.dx=x-before.x*view.zoom;view.dy=y-before.y*view.zoom;paint()}
function screenToWorld(p){return {x:(p.x-view.dx)/view.zoom,y:(p.y-view.dy)/view.zoom}}
function worldToScreen(p){return {x:p.x*view.zoom+view.dx,y:p.y*view.zoom+view.dy}}
function eventPoint(e){let r=stageCanvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function boundsPoint(p){return{x:Math.max(0,Math.min(photoSize.w,p.x)),y:Math.max(0,Math.min(photoSize.h,p.y))}}
// Magnetické přichytávání není vazba: výsledek se přepočítává z aktuální
// polohy prstu. Vždy musí zbýt prostor mezi magnetickými zónami pro uvolnění.
function snap(p,ref=null,ignore=null){
 p=boundsPoint({...p});
 const step=Math.max(5,Number(prefs.gridStep)||40),zoom=Math.max(.05,view.zoom);
 const pointDistance=12/zoom;
 if(prefs.snapGrid){
  const gridDistance=Math.min(11/zoom,step*.22);
  const gx=Math.round(p.x/step)*step,gy=Math.round(p.y/step)*step;
  if(Math.abs(gx-p.x)<gridDistance)p.x=gx;
  if(Math.abs(gy-p.y)<gridDistance)p.y=gy;
 }
 if(prefs.snapPoints){
  let best=null,bestDistance=pointDistance;
  for(const item of current.items||[]){
   // Vlastní kóta nesmí přichytávat svůj konec k druhému vlastnímu konci.
   if(ignore?.item===item)continue;
   for(const candidate of [item.a,item.b,...(item.points||[])]){
    if(!candidate)continue;
    const distance=Math.hypot(candidate.x-p.x,candidate.y-p.y);
    if(distance<bestDistance){bestDistance=distance;best=candidate}
   }
  }
  if(best)p={...best};
 }
 if(prefs.snapHorizontal&&ref){
  if(Math.abs(p.y-ref.y)<pointDistance)p.y=ref.y;
  if(Math.abs(p.x-ref.x)<pointDistance)p.x=ref.x;
 }
 return boundsPoint(p);
}
function checkpoint(){editStack.push(JSON.stringify(current.items||[]));if(editStack.length>50)editStack.shift();redoStack=[]}
function commitEditor(){touch(current);save();paint()}
function undoEditor(){if(!editStack.length)return;redoStack.push(JSON.stringify(current.items));current.items=JSON.parse(editStack.pop());commitEditor()}
function redoEditor(){if(!redoStack.length)return;editStack.push(JSON.stringify(current.items));current.items=JSON.parse(redoStack.pop());commitEditor()}
$('undo').onclick=undoEditor;$('redo').onclick=redoEditor;$('selectTool').onclick=()=>setTool('select');$('toolsToggle').onclick=()=>showTools();$('activeTool').onclick=()=>{
  if(suppressToolClick){suppressToolClick=false;return;}
  if(mode==='select'||mode==='pan')setTool(lastDrawingTool);
  else setTool('select');
};
$('activeTool').addEventListener('pointerdown',()=>{
  suppressToolClick=false;
  clearTimeout(repeatPressTimer);
  repeatPressTimer=setTimeout(()=>{
    prefs.repeatDrawing=!prefs.repeatDrawing;save();suppressToolClick=true;
    updateDrawingToolButton();
    notify(prefs.repeatDrawing?'Opakované kreslení zapnuto':'Po jedné kótě');
  },650);
});
for(const eventName of ['pointerup','pointercancel','pointerleave']){
  $('activeTool').addEventListener(eventName,()=>clearTimeout(repeatPressTimer));
}
function updateDrawingToolButton(){
  const t=allTools.find(x=>x[0]===lastDrawingTool);
  const b=$('activeTool');
  b.textContent=(t?.[1]||'↔')+(prefs.repeatDrawing?'∞':'¹');
  b.title=(t?.[2]||'Nástroj')+(prefs.repeatDrawing?' – opakovaně':' – jedna kóta')+' · dlouhé podržení přepíná režim';
  b.classList.toggle('inactive',mode==='select'||mode==='pan');
}
function finishDraw(item){
  // Keep the fresh dimension selected, with two visible grips ready to adjust.
  selected=item?.id||null;
  if(!prefs.repeatDrawing)setTool('select',true);
  else paint();
}
$('lineColor').oninput=e=>{prefs.color=e.target.value;save();paint()};
// Vyhledávání symbolů odpouští diakritiku, mezery a drobné překlepy.
function normalizeSymbolSearch(value){
 return String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .toLocaleLowerCase('cs').trim().replace(/\s+/g,' ');
}
function symbolSearchNear(word,query){
 if(query.length<4||Math.abs(word.length-query.length)>1)return false;
 if(word===query)return true;
 let i=0,j=0,edits=0;
 while(i<word.length&&j<query.length){
  if(word[i]===query[j]){i++;j++;continue}
  if(++edits>1)return false;
  if(word.length>query.length)i++;
  else if(query.length>word.length)j++;
  else {i++;j++}
 }
 return edits+Number(i<word.length||j<query.length)<=1;
}
function matchesSymbolSearch(label,query){
 const q=normalizeSymbolSearch(query);
 if(!q)return true;
 const name=normalizeSymbolSearch(label);
 if(name.includes(q))return true;
 return name.split(/\s+/).some(word=>symbolSearchNear(word,q));
}
function showTools(){closeMenus();$('toolMenu').hidden=false;let html='<div class="toolList">';for(let group of toolGroups){html+=`<div class="sectionLabel">${group.title}</div>`;for(let [key,icon,label] of group.tools)html+=`<button class="choice" data-tool="${key}"><strong>${icon}</strong>${label}</button>`}html+='</div>';$('toolMenu').innerHTML=html;$('toolMenu').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);closeMenus()})}
function setTool(key,keepSelection=false){mode=key;selectedHandle=null;if(!keepSelection)selected=null;drawStart=null;drawCurrent=null;stroke=[];polylineDraft=[];if(key!=='select'&&key!=='pan')lastDrawingTool=key;updateDrawingToolButton();$('editorHint').textContent=key==='select'?'Klepni na kótu nebo posuň její koncový bod':key==='pan'?'Táhni fotografii pro posunutí':key==='angle'?'Klepni na první rameno, vrchol a druhé rameno':['polyline','chain','cumulative'].includes(key)?'Klepáním přidávej body; dalším klepnutím na poslední dokončíš':'Táhni prstem mezi body · rozměry zadáváš ručně';paint()}
function drawGrid(){if(!prefs.snapGrid)return;let spacing=Math.max(5,prefs.gridStep)*view.zoom;if(spacing<8)return;ctx.save();ctx.strokeStyle='#eeeeee28';ctx.lineWidth=1;const left=Math.max(0,Math.ceil(-view.dx/spacing)),right=Math.min(Math.ceil(photoSize.w/prefs.gridStep),Math.ceil((stageCanvas.clientWidth-view.dx)/spacing));const top=Math.max(0,Math.ceil(-view.dy/spacing)),bottom=Math.min(Math.ceil(photoSize.h/prefs.gridStep),Math.ceil((stageCanvas.clientHeight-view.dy)/spacing));ctx.beginPath();for(let i=left;i<=right;i++){const x=view.dx+i*spacing;ctx.moveTo(x,0);ctx.lineTo(x,stageCanvas.clientHeight)}for(let j=top;j<=bottom;j++){const y=view.dy+j*spacing;ctx.moveTo(0,y);ctx.lineTo(stageCanvas.clientWidth,y)}ctx.stroke();ctx.restore()}
function paint(){if(screen!=='editor'||!current)return;let w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;ctx.clearRect(0,0,w,h);ctx.save();ctx.fillStyle='#202123';ctx.fillRect(0,0,w,h);ctx.translate(view.dx,view.dy);ctx.scale(view.zoom,view.zoom);if(stageImg)ctx.drawImage(stageImg,0,0,photoSize.w,photoSize.h);else{ctx.fillStyle='#36383a';ctx.fillRect(0,0,photoSize.w,photoSize.h);ctx.strokeStyle='#4b4e50';ctx.lineWidth=3/view.zoom;ctx.strokeRect(0,0,photoSize.w,photoSize.h)}ctx.restore();drawGrid();for(let item of current.items||[]){if(item.id===selected)drawSelectedOutline(ctx,item);drawItem(ctx,item);}if(drawStart&&drawCurrent){let mock={type:mode,a:drawStart,b:drawCurrent,points:stroke,measure:'',unit:prefs.unit,color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize};drawItem(ctx,mock,false)}drawSelectedGrips(ctx);if(magnifierPoint&&prefs.loupe)drawLoupe();else $('loupe').hidden=true;}

/* ImageMeter-like selection: the translucent white contour is drawn
   BEFORE the original colored annotation. No white stroke covers the
   yellow line, terminal ticks, or arrows. Stored annotation is untouched. */
function drawSelectedOutline(c,item){
 if(!item?.a||!item?.b||!['dimension','chain','cumulative'].includes(item.type)||(['chain','cumulative'].includes(item.type)&&item.points?.length>1))return;
 const a=worldToScreen(item.a),b=worldToScreen(item.b);
 const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
 const nx=-dy/d,ny=dx/d,off=item.offset??0;
 const ao={x:a.x+nx*off,y:a.y+ny*off};
 const bo={x:b.x+nx*off,y:b.y+ny*off};
 c.save();
 c.lineCap='round';c.lineJoin='round';
 // Light contour runs outside the original line and both arrowheads.
 c.strokeStyle='rgba(255,255,255,.55)';
 c.lineWidth=(Number(item.width)||Number(prefs.lineWidth)||2)+3;
 c.beginPath();
 c.moveTo(a.x+nx*(off-11),a.y+ny*(off-11));
 c.lineTo(a.x+nx*(off+11),a.y+ny*(off+11));
 c.moveTo(b.x+nx*(off-11),b.y+ny*(off-11));
 c.lineTo(b.x+nx*(off+11),b.y+ny*(off+11));
 c.moveTo(ao.x,ao.y);c.lineTo(bo.x,bo.y);c.stroke();
 drawArrow(c,ao,bo,9);
 drawArrow(c,bo,ao,9);
 // These rings are VISUAL only. The 31 px touch target stays unchanged.
 // Draw before yellow ticks: the ticks stay crisp above the faint fill.
 c.fillStyle='rgba(255,255,255,.12)';
 c.strokeStyle='rgba(255,255,255,.73)';
 c.lineWidth=1.4;
 for(const point of [a,b]){
  c.beginPath();c.arc(point.x,point.y,14,0,Math.PI*2);c.fill();c.stroke();
 }
 c.restore();
}
/* Keep the existing selection markers for other object types.
   Dimension handles were already drawn underneath in drawSelectedOutline. */
function drawSelectedGrips(c){
 const item=(current?.items||[]).find(i=>i.id===selected);
 if(!item)return;
 if(item.type==='note'&&item.media?.length)return;
 if(item.type==='dimension'||(['chain','cumulative'].includes(item.type)&&!(item.points?.length>1)))return;
 c.save();
 c.fillStyle='rgba(255,255,255,.14)';
 c.strokeStyle='rgba(255,255,255,.78)';c.lineWidth=1.6;
 if(item.type==='note'&&!item.media?.length){
  const p=noteCaptionScreen(item),anchor=worldToScreen(item.a||{x:0,y:0});
  c.strokeRect(p.x-14,p.y-14,28,28);
  if(selectedHandle?.item?.id===item.id&&selectedHandle.kind==='point'&&selectedHandle.dragged){c.beginPath();c.arc(anchor.x,anchor.y,14,0,Math.PI*2);c.fill();c.stroke();}
 }else if(item.type==='note'||item.type==='symbol'){
  const p=worldToScreen(item.a||{x:0,y:0});
  c.strokeRect(p.x-14,p.y-14,28,28);
  if(item.type!=='note'||(selectedHandle?.item?.id===item.id&&selectedHandle.kind==='point'&&selectedHandle.dragged)){c.beginPath();c.arc(p.x,p.y,14,0,Math.PI*2);c.fill();c.stroke();}
 }else{
  if(['polyline','chain','cumulative','angle'].includes(item.type)&&Array.isArray(item.points)&&item.points.length>1){
   for(const vertex of item.points){
    const p=worldToScreen(vertex);c.beginPath();c.arc(p.x,p.y,14,0,Math.PI*2);c.fill();c.stroke();
   }
  }else for(const key of ['a','b'])if(item[key]){
   const p=worldToScreen(item[key]);
   c.beginPath();c.arc(p.x,p.y,14,0,Math.PI*2);c.fill();c.stroke();
  }
 }
 c.restore();
}

/* Textová poznámka má dva nezávislé body: a = hrot šipky,
   b = střed rámečku (použije se až při prvním přesunu textu).
   U starších záznamů bez captionMoved zůstává vzhled beze změny. */
function noteDisplayedCaption(item){
 const voice=Array.isArray(item.audioMedia)&&item.audioMedia.length?'🎙 ':'';
 const body=item.text||((item.media?.length)?'':'Klikněte pro zadání textu');
 return voice+body;
}
function noteCaptionScreen(item){
 return worldToScreen(item.captionMoved&&item.b?item.b:item.a||{x:0,y:0});
}
function noteCaptionBounds(item){
 const p=noteCaptionScreen(item),fs=Number(item.fontSize)||Number(prefs.fontSize)||17;
 const caption=noteDisplayedCaption(item);
 ctx.save();ctx.font='600 '+fs+'px sans-serif';
 const w=ctx.measureText(caption).width+10;ctx.restore();
 return {x:p.x-w/2,y:p.y-fs*.7,w,h:fs*1.4,p};
}
function drawNoteLeader(c,item,color){
 if(!item.captionMoved||!item.a)return;
 const p=worldToScreen(item.a),box=noteCaptionBounds(item),mid=box.p;
 const dx=p.x-mid.x,dy=p.y-mid.y;
 const factor=Math.max(Math.abs(dx)/Math.max(1,box.w/2),Math.abs(dy)/Math.max(1,box.h/2));
 if(factor<=1||!Number.isFinite(factor))return;
 const edge={x:mid.x+dx/factor,y:mid.y+dy/factor};
 c.save();c.strokeStyle=color;c.fillStyle=color;
 c.lineWidth=Number(item.width)||Number(prefs.lineWidth)||2;c.lineCap='round';
 c.beginPath();c.moveTo(edge.x,edge.y);c.lineTo(p.x,p.y);c.stroke();
 drawArrow(c,p,edge,11);c.restore();
}
function canvasText(text,p,color,size,angle=0){ctx.save();ctx.translate(p.x,p.y);ctx.rotate(angle);ctx.font=`600 ${size}px sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';let width=ctx.measureText(text).width;ctx.fillStyle='#222d';ctx.fillRect(-width/2-5,-size*.67,width+10,size*1.4);ctx.fillStyle=color;ctx.fillText(text,0,0);ctx.restore()}
function drawArrow(c,point,to,size=10){let a=Math.atan2(point.y-to.y,point.x-to.x);c.beginPath();c.moveTo(point.x,point.y);c.lineTo(point.x-size*Math.cos(a-.48),point.y-size*Math.sin(a-.48));c.moveTo(point.x,point.y);c.lineTo(point.x-size*Math.cos(a+.48),point.y-size*Math.sin(a+.48));c.stroke()}
function drawItem(c,item){let a=item.a&&worldToScreen(item.a),b=item.b&&worldToScreen(item.b);let pts=(item.points||[]).map(worldToScreen);const color=item.color||prefs.color,fw=(item.width||prefs.lineWidth),fs=(item.fontSize||prefs.fontSize);c.save();c.strokeStyle=color;c.fillStyle=color;c.lineWidth=fw;c.lineJoin='round';c.lineCap='round';
function seg(){c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.stroke()};
if(item.type==='angle'&&pts.length>=3){
 const p=pts[0],vertex=pts[1],q=pts[2];
 c.beginPath();c.moveTo(p.x,p.y);c.lineTo(vertex.x,vertex.y);c.lineTo(q.x,q.y);c.stroke();
 const a1=Math.atan2(p.y-vertex.y,p.x-vertex.x),a2=Math.atan2(q.y-vertex.y,q.x-vertex.x);
 const angle=Math.atan2(Math.sin(a2-a1),Math.cos(a2-a1));
 const degrees=Math.abs(angle)*180/Math.PI;
 const radius=Math.max(8,Math.min(36,Math.hypot(p.x-vertex.x,p.y-vertex.y)*.4,
  Math.hypot(q.x-vertex.x,q.y-vertex.y)*.4));
 c.beginPath();c.arc(vertex.x,vertex.y,radius,a1,a1+angle,angle<0);c.stroke();
 const mid=a1+angle/2;
 canvasText((item.measure||degrees.toFixed(1))+'°',
  {x:vertex.x+Math.cos(mid)*(radius+25),y:vertex.y+Math.sin(mid)*(radius+25)},color,fs);
}
else if(['chain','cumulative'].includes(item.type)&&pts.length>1){
 for(let i=0;i<pts.length-1;i++){
  const from=item.type==='cumulative'?pts[0]:pts[i],to=pts[i+1];
  const data=item.segmentData?.[i]||{};
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1;
  const nx=-dy/d,ny=dx/d,offset=(Number(item.offset)||0)+i*(item.type==='cumulative'?10:0);
  const p={x:from.x+nx*offset,y:from.y+ny*offset};
  const q={x:to.x+nx*offset,y:to.y+ny*offset};
  c.beginPath();
  c.moveTo(from.x+nx*(offset-9),from.y+ny*(offset-9));
  c.lineTo(from.x+nx*(offset+9),from.y+ny*(offset+9));
  c.moveTo(to.x+nx*(offset-9),to.y+ny*(offset-9));
  c.lineTo(to.x+nx*(offset+9),to.y+ny*(offset+9));
  c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
  drawArrow(c,p,q,9);drawArrow(c,q,p,9);
  const caption=[data.measure?data.measure+' '+(data.unit||item.unit||'mm'):'?',data.text||''].filter(Boolean).join(' · ');
  let angle=Math.atan2(dy,dx);if(angle>Math.PI/2||angle< -Math.PI/2)angle+=Math.PI;
  canvasText(caption,{x:(p.x+q.x)/2,y:(p.y+q.y)/2},color,fs,angle);
 }
}
else if(item.type==='dimension'||item.type==='chain'||item.type==='cumulative'){if(a&&b){let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;let nx=-dy/d,ny=dx/d;let off=item.offset??0;let ao={x:a.x+nx*off,y:a.y+ny*off},bo={x:b.x+nx*off,y:b.y+ny*off};c.beginPath();c.moveTo(a.x+nx*(off-11),a.y+ny*(off-11));c.lineTo(a.x+nx*(off+11),a.y+ny*(off+11));c.moveTo(b.x+nx*(off-11),b.y+ny*(off-11));c.lineTo(b.x+nx*(off+11),b.y+ny*(off+11));c.moveTo(ao.x,ao.y);c.lineTo(bo.x,bo.y);c.stroke();drawArrow(c,ao,bo,9);drawArrow(c,bo,ao,9);let label=item.measure?`${item.measure} ${item.unit||'mm'}`:'?';if(item.text)label+=' · '+item.text;let ang=Math.atan2(dy,dx);if(ang>Math.PI/2||ang< -Math.PI/2)ang+=Math.PI;canvasText(label,{x:(ao.x+bo.x)/2+(bo.x-ao.x)*(Number(item.labelT)||0),y:(ao.y+bo.y)/2+(bo.y-ao.y)*(Number(item.labelT)||0)},color,fs,ang)}}
else if(item.type==='line'||item.type==='arrow'||item.type==='angle'||item.type==='target'){
 if(a&&b){
  seg();
  if(item.type==='arrow')drawArrow(c,b,a,15);
  if(item.type==='target'){c.beginPath();c.arc(b.x,b.y,12,0,Math.PI*2);c.stroke()}
  if(item.type==='angle'){
   const degree=(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
   canvasText((item.measure||degree.toFixed(0))+'°',{x:(a.x+b.x)/2,y:(a.y+b.y)/2-23},color,fs);
  }else if(item.type==='line'||item.type==='arrow'){
   // Stejný postup pro čáru i šipku: libovolný text a/nebo kóta.
   const label=[item.measure?item.measure+' '+(item.unit||'mm'):'',item.text||''].filter(Boolean).join(' · ');
   if(label){
    const dx=b.x-a.x,dy=b.y-a.y;
    let angle=Math.atan2(dy,dx);
    if(angle>Math.PI/2||angle< -Math.PI/2)angle+=Math.PI;
    const gap=(Number(fs)||17)*.85+4;
    canvasText(label,{x:(a.x+b.x)/2+Math.sin(angle)*gap,
      y:(a.y+b.y)/2-Math.cos(angle)*gap},color,fs,angle);
   }
  }
 }
}
else if(item.type==='rect'||item.type==='area'){if(a&&b){let x=Math.min(a.x,b.x),y=Math.min(a.y,b.y),w=Math.abs(a.x-b.x),h=Math.abs(a.y-b.y);c.strokeRect(x,y,w,h);if(item.type==='area'&&item.measure)canvasText(item.measure+' '+(item.unit||'m²'),{x:x+w/2,y:y+h/2},color,fs)}}
else if(item.type==='ellipse'||item.type==='circle'){
 if(a&&b){
  const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2;
  const rx=Math.abs(a.x-b.x)/2,ry=item.type==='circle'?rx:Math.abs(a.y-b.y)/2;
  c.beginPath();c.ellipse(cx,cy,Math.max(1,rx),Math.max(1,ry),0,0,Math.PI*2);c.stroke();
  const label=[item.measure?(item.measureKind==='radius'?'R ':'Ø ')+item.measure+' '+(item.unit||'mm'):'',item.text||''].filter(Boolean).join(' · ');
  if(label)canvasText(label,{x:cx,y:cy},color,fs);
 }
}
else if(item.type==='freehand'||item.type==='polyline'){if(pts.length){c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let p of pts.slice(1))c.lineTo(p.x,p.y);c.stroke()}}
else if(item.type==='note'||item.type==='symbol'){if(a){if(item.type==='note'){drawNoteLeader(c,item,color);(noteDisplayedCaption(item)&&canvasText(noteDisplayedCaption(item),noteCaptionScreen(item),color,fs))}else canvasText((item.icon||'⚑')+' '+(item.text||''),a,color,fs)}}
c.restore();}
function drawLoupe(){
  if(!magnifierPoint)return;
  const pointer=worldToScreen(magnifierPoint);
  const canvas=$('loupe');
  const width=Math.max(1,stageCanvas.clientWidth);
  // Reference comparison on the same phone: the ImageMeter magnifier is
  // about 160 screenshot pixels, while ours was about 105. At the device's
  // WebView scaling this corresponds to roughly 136 CSS pixels.
  const size=136;
  // Reference interaction: fixed at the opposite upper corner from the
  // point being manipulated, switching around the image midpoint. Keep a
  // small hysteresis zone to prevent flickering while crossing the middle.
  if(loupeSide===null)loupeSide=pointer.x>width/2?'left':'right';
  else if(loupeSide==='right'&&pointer.x>width*.55)loupeSide='left';
  else if(loupeSide==='left'&&pointer.x<width*.45)loupeSide='right';
  const left=loupeSide==='left';
  canvas.style.width=size+'px';
  canvas.style.height=size+'px';
  canvas.style.left=(left?12:Math.max(4,width-size-12))+'px';
  canvas.style.top='12px';
  const dpr=Math.max(1,window.devicePixelRatio||1);
  const pixels=Math.round(size*dpr);
  if(canvas.width!==pixels||canvas.height!==pixels){
    canvas.width=pixels;canvas.height=pixels;
  }
  canvas.hidden=false;
  const zoom=Math.max(1.2,Math.min(2.5,Number(prefs.loupeZoom)||2));
  const stageDensity=stageCanvas.width/width;
  loupeCtx.save();
  loupeCtx.setTransform(dpr,0,0,dpr,0,0);
  loupeCtx.clearRect(0,0,size,size);
  loupeCtx.fillStyle='#202123';
  loupeCtx.fillRect(0,0,size,size);
  // Center the real dimension endpoint in the magnifier in both corners.
  // The reference video shows the end tick crossing the exact center.
  // No extra crosshair, dots or synthetic markers.
  loupeCtx.translate(size*.5-pointer.x*zoom,size*.5-pointer.y*zoom);
  loupeCtx.scale(zoom,zoom);
  loupeCtx.drawImage(stageCanvas,0,0,stageCanvas.width/stageDensity,stageCanvas.height/stageDensity);
  // A thin dashed cross like the reference screenshot. The REAL dimension
  // end tick remains visible underneath; no large dots or grab handles.
  loupeCtx.setTransform(dpr,0,0,dpr,0,0);
  loupeCtx.beginPath();
  loupeCtx.setLineDash([5,7]);
  loupeCtx.lineWidth=.8;
  loupeCtx.strokeStyle='rgba(245,245,245,.65)';
  loupeCtx.moveTo(size*.5,0);
  loupeCtx.lineTo(size*.5,size);
  loupeCtx.moveTo(0,size*.5);
  loupeCtx.lineTo(size,size*.5);
  loupeCtx.stroke();
  loupeCtx.restore();
}
function labelInfo(item){
  if(!item||!['dimension','chain','cumulative'].includes(item.type)||!item.a||!item.b||(['chain','cumulative'].includes(item.type)&&item.points?.length>1))return null;
  const a=worldToScreen(item.a),b=worldToScreen(item.b);
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
  const off=item.offset??0,t=Number(item.labelT)||0;
  return {x:(a.x+b.x)/2-uy*off+dx*t,y:(a.y+b.y)/2+ux*off+dy*t,ux,uy,d};
}
function nearestLabel(point){
  for(const item of [...(current.items||[])].reverse()){
    const p=labelInfo(item);if(!p)continue;
    const along=Math.abs((point.x-p.x)*p.ux+(point.y-p.y)*p.uy);
    const across=Math.abs((point.x-p.x)*(-p.uy)+(point.y-p.y)*p.ux);
    ctx.save();ctx.font='600 '+(item.fontSize||prefs.fontSize)+'px sans-serif';
    const width=ctx.measureText((item.measure?(item.measure+' '+(item.unit||'mm')):'?')+(item.text?' · '+item.text:'')).width;ctx.restore();
    if(along<=Math.max(28,width/2+15)&&across<=Math.max(22,(item.fontSize||prefs.fontSize)*.85)){
      return {item,kind:'label'};
    }
  }
  return null;
}
function nearestHandle(point){
 let best=null,dist=31;
 for(const item of current.items||[]){
  if(['polyline','chain','cumulative','angle'].includes(item.type)&&Array.isArray(item.points)&&item.points.length>1){
   item.points.forEach((vertex,index)=>{
    const p=worldToScreen(vertex),d=Math.hypot(point.x-p.x,point.y-p.y);
    if(d<dist){best={item,key:'points',point:vertex,pointIndex:index,kind:'point'};dist=d}
   });continue;
  }
  if(item.type==='freehand')continue;
  for(const key of ['a','b'])if(item[key]&&!(item.type==='note'&&key==='b')){
   const p=worldToScreen(item[key]),d=Math.hypot(point.x-p.x,point.y-p.y);
   if(d<dist){best={item,key,point:item[key],kind:'point'};dist=d}
  }
 }
 return best;
}
function nearestItem(point){
 const world=screenToWorld(point);
 let best=null,distance=26/view.zoom;
 for(const item of [...(current.items||[])].reverse()){
  if((item.type==='note'||item.type==='symbol')&&item.a){
   const p=item.type==='note'?noteCaptionScreen(item):worldToScreen(item.a);
   const caption=item.type==='symbol'?(item.icon||'⚑')+' '+(item.text||''):noteDisplayedCaption(item);
   ctx.save();ctx.font='600 '+(item.fontSize||prefs.fontSize)+'px sans-serif';
   const width=ctx.measureText(caption).width+22;ctx.restore();
   if(Math.abs(point.x-p.x)<width/2+7&&Math.abs(point.y-p.y)<Math.max(23,(item.fontSize||prefs.fontSize)*.9))
    return item;
  }
  if((['polyline','chain','cumulative','angle','freehand'].includes(item.type))&&Array.isArray(item.points)&&item.points.length>1){
   for(let i=1;i<item.points.length;i++){
    const a=item.points[i-1],b=item.points[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((world.x-a.x)*dx+(world.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const d=Math.hypot(world.x-a.x-t*dx,world.y-a.y-t*dy);
    if(d<distance){best=item;distance=d}
   }
   continue;
  }
  const a=item.a,b=item.b;
  if(a&&b){
   let ux=b.x-a.x,uy=b.y-a.y,den=ux*ux+uy*uy||1;
   // Testovat viditelnou odsazenou kótovací čáru, nejen geometrii pod ní.
   let shift=0;
   if(['dimension','chain','cumulative'].includes(item.type))
    shift=(Number(item.offset)||0)/Math.max(0.0001,view.zoom);
   const lineLength=Math.hypot(ux,uy)||1;
   const ax=a.x-uy/lineLength*shift,ay=a.y+ux/lineLength*shift;
   let t=Math.max(0,Math.min(1,((world.x-ax)*ux+(world.y-ay)*uy)/den));
   let d=Math.hypot(world.x-ax-t*ux,world.y-ay-t*uy);
   if(d<distance){best=item;distance=d}
  }else if(a){
   let d=Math.hypot(a.x-world.x,a.y-world.y);
   if(d<distance){best=item;distance=d}
  }
 }
 return best;
}
function hitAnnotation(point){
 // Při překrývajících se přichycených koncích dát přednost vybrané kótě:
 // společné souřadnice neznamenají, že se dva samostatné prvky spojily.
 const activeItem=(current?.items||[]).find(item=>item.id===selected);
 if(activeItem&&activeItem.type!=='note'){
  for(const p of [activeItem.a,activeItem.b]){
   if(p&&Math.hypot(point.x-worldToScreen(p).x,point.y-worldToScreen(p).y)<24)
    return activeItem;
  }
 }
 const label=nearestLabel(point);
 if(label?.item)return label.item;
 return nearestItem(point);
}
function selectAnnotation(item){
 if(!item)return;
 selected=item.id;
 if(mode!=='select')setTool('select',true);
 paint();
}
function completePolyline(kind='polyline'){
 if(polylineDraft.length<2)return;
 const points=polylineDraft.map(p=>({...p}));
 polylineDraft=[];drawStart=null;drawCurrent=null;stroke=[];magnifierPoint=null;
 const item={id:uid(),type:kind,a:{...points[0]},b:{...points[points.length-1]},
  points,segmentData:points.slice(1).map(()=>({measure:'',text:'',unit:prefs.unit})),color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize,unit:prefs.unit,measure:'',text:''};
 checkpoint();current.items.push(item);commitEditor();finishDraw(item);
}
function stageDown(e){
 if(screen!=='editor')return;
 e.preventDefault();
 stageCanvas.setPointerCapture(e.pointerId);
 const s=eventPoint(e);
 pointers.set(e.pointerId,s);
 if(pointers.size===2){
  const v=[...pointers.values()];
  gesture={distance:Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y),zoom:view.zoom,
   mid:{x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2},
   world:screenToWorld({x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2})};
  drawStart=null;drawCurrent=null;selectedHandle=null;paint();return;
 }
 if(pointers.size>2)return;
 if(['polyline','chain','cumulative','angle'].includes(mode)){
   const position=snap(screenToWorld(s),polylineDraft[polylineDraft.length-1]||null);
   const last=polylineDraft[polylineDraft.length-1];
   if(mode==='angle'&&polylineDraft.length===2){
    polylineDraft.push({...position});completePolyline('angle');return;
   }
   if(polylineDraft.length>=2&&last&&Math.hypot(position.x-last.x,position.y-last.y)<15/Math.max(.05,view.zoom)){
    completePolyline(mode);return;
   }
   if(!last||Math.hypot(position.x-last.x,position.y-last.y)>2/Math.max(.05,view.zoom))
    polylineDraft.push({...position});
   drawStart={...polylineDraft[0]};drawCurrent={...position};
   stroke=polylineDraft.map(p=>({...p}));
   magnifierPoint=null;paint();return;
  }
  const candidate=hitAnnotation(s);
 if(candidate){
  // U řetězců si pamatuj konkrétní úsek, kterého se uživatel dotkl.
  // Další odečet z Bosche vyplní právě tento úsek, nikoli celý řetězec.
  if(['chain','cumulative'].includes(candidate.type)&&candidate.points?.length>1){
   const w=screenToWorld(s);
   let nearest=0,dist=Infinity;
   for(let i=0;i<candidate.points.length-1;i++){
    const a=candidate.type==='cumulative'?candidate.points[0]:candidate.points[i];
    const b=candidate.points[i+1],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((w.x-a.x)*dx+(w.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const d=Math.hypot(w.x-a.x-t*dx,w.y-a.y-t*dy);
    if(d<dist){dist=d;nearest=i}
   }
   candidate.activeSegmentIndex=nearest;
  }
  const alreadySelected=selected===candidate.id;
  const isTextNote=candidate.type==='note'&&!candidate.media?.length;
  const captionBox=isTextNote?noteCaptionBounds(candidate):null;
  const onCaption=captionBox&&s.x>=captionBox.x-7&&s.x<=captionBox.x+captionBox.w+7&&
    s.y>=captionBox.y-7&&s.y<=captionBox.y+captionBox.h+7;
  if(!alreadySelected)selectAnnotation(candidate);
  // Tažení za text přesouvá jen rámeček, nikoliv hrot šipky.
  // Zvolení textu má přednost před překrývajícím se bodem a jen do prvního přesunu.
  const anchor=isTextNote?worldToScreen(candidate.a||{x:0,y:0}):null;
  const anchorNear=anchor&&Math.hypot(s.x-anchor.x,s.y-anchor.y)<=24;
  const wantsCaption=isTextNote&&onCaption&&(!candidate.captionMoved||!anchorNear);
  // První krátké klepnutí jen označí prvek. První skutečné tažení ale
  // musí hned fungovat (střed = celá kóta, konec = jediný bod).
  // Rozlišení klepnutí a tahu zajistí initialSelection v stageUp.
  const grip=nearestHandle(s);
  const label=nearestLabel(s);
  let hit;
  if(wantsCaption)hit={item:candidate,kind:'note-caption'};
  else if(grip?.item.id===candidate.id)hit=grip;
  else if(['chain','cumulative','angle'].includes(candidate.type)&&candidate.points?.length>1)
   hit={item:candidate,kind:'move-polyline'};
  else if(['dimension','chain','cumulative','line','arrow','angle','target'].includes(candidate.type))
   hit={item:candidate,kind:'move-dimension'};
  else if(candidate.type==='polyline'||candidate.type==='freehand')hit={item:candidate,kind:'move-polyline'};
  else if(label?.item.id===candidate.id)hit=label;
  else hit={item:candidate,kind:'open-selected'};
  selectedHandle=hit;
  hit.startScreen={...s};
  hit.initialSelection=!alreadySelected;
  if(hit.kind==='point')hit.startPoint={...hit.point};
  if(hit.kind==='move-dimension'){
   hit.startA={...candidate.a};
   hit.startB={...candidate.b};
  }
  if(hit.kind==='note-caption')
   hit.startPoint={...(hit.item.captionMoved&&hit.item.b?hit.item.b:hit.item.a)};
  if(hit.kind==='move-polyline')hit.startPoints=candidate.points.map(p=>({...p}));
  hit.startLabelT=Number(hit.item.labelT)||0;
  hit.dragged=false;
  if(hit.kind==='point'||hit.kind==='label'||hit.kind==='note-caption'||hit.kind==='move-dimension'||hit.kind==='move-polyline')checkpoint();
  magnifierPoint=hit.kind==='point'?hit.point:null;
  paint();return;
 }
 if(selected!==null){selected=null;paint()}
 if(mode==='select')return;
 if(mode==='pan'){drag={screen:s,dx:view.dx,dy:view.dy};return}
 drawPointerId=e.pointerId;drawStart=mode==='freehand'?boundsPoint(screenToWorld(s)):snap(screenToWorld(s));
 drawCurrent=drawStart;stroke=[drawStart];magnifierPoint=drawStart;paint();
}
function stageMove(e){if(screen!=='editor')return;const s=eventPoint(e);if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,s);if(pointers.size===2&&gesture){let v=[...pointers.values()],dist=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);let mid={x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2};view.zoom=Math.max(.05,Math.min(12,gesture.zoom*dist/Math.max(1,gesture.distance)));view.dx=mid.x-gesture.world.x*view.zoom;view.dy=mid.y-gesture.world.y*view.zoom;paint();return}
if(['polyline','chain','cumulative','angle'].includes(mode)&&polylineDraft.length&&pointers.size===1){
  drawCurrent=snap(screenToWorld(s),polylineDraft[polylineDraft.length-1]);
  stroke=[...polylineDraft,{...drawCurrent}];paint();return;
 }
 if(selectedHandle&&pointers.size===1){
  if(Math.hypot(s.x-selectedHandle.startScreen.x,s.y-selectedHandle.startScreen.y)>7)selectedHandle.dragged=true;
  if(selectedHandle.kind==='select-only'||selectedHandle.kind==='open-selected'){
   magnifierPoint=null;paint();return;
  }
  if(selectedHandle.kind==='move-polyline'){
     if(selectedHandle.dragged){
      const dx=(s.x-selectedHandle.startScreen.x)/view.zoom;
      const dy=(s.y-selectedHandle.startScreen.y)/view.zoom;
      const points=selectedHandle.startPoints;
      const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
      const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
      const shiftX=Math.max(-minX,Math.min(dx,photoSize.w-maxX));
      const shiftY=Math.max(-minY,Math.min(dy,photoSize.h-maxY));
      selectedHandle.item.points=points.map(p=>({x:p.x+shiftX,y:p.y+shiftY}));
      selectedHandle.item.a={...selectedHandle.item.points[0]};
      selectedHandle.item.b={...selectedHandle.item.points[selectedHandle.item.points.length-1]};
     }
     magnifierPoint=null;
  }else if(selectedHandle.kind==='move-dimension'){
    if(selectedHandle.dragged){
      const a=selectedHandle.startA,b=selectedHandle.startB;
      // Uchopení uprostřed posune oba konce společně. Zachovat délku a směr.
      // Neprovádět magnet na jednom konci, který by změnil geometrii celé kóty.
      const dx=Math.max(-Math.min(a.x,b.x),Math.min((s.x-selectedHandle.startScreen.x)/view.zoom,photoSize.w-Math.max(a.x,b.x)));
      const dy=Math.max(-Math.min(a.y,b.y),Math.min((s.y-selectedHandle.startScreen.y)/view.zoom,photoSize.h-Math.max(a.y,b.y)));
      selectedHandle.item.a={x:a.x+dx,y:a.y+dy};
      selectedHandle.item.b={x:b.x+dx,y:b.y+dy};
    }
    magnifierPoint=null;
  }else if(selectedHandle.kind==='note-caption'){
    const origin=worldToScreen(selectedHandle.startPoint);
    selectedHandle.item.b=screenToWorld({
      x:origin.x+s.x-selectedHandle.startScreen.x,
      y:origin.y+s.y-selectedHandle.startScreen.y
    });
    selectedHandle.item.captionMoved=true;
    magnifierPoint=null;
  }else if(selectedHandle.kind==='label'){
    const info=labelInfo(selectedHandle.item);
    if(info&&info.d>0){
      const delta=((s.x-selectedHandle.startScreen.x)*info.ux+
        (s.y-selectedHandle.startScreen.y)*info.uy)/info.d;
      selectedHandle.item.labelT=Math.max(-.92,Math.min(.92,selectedHandle.startLabelT+delta));
    }
    magnifierPoint=null;
  }else{
    // Retain the initial touch-to-endpoint offset. Otherwise grabbing within
    // the generous invisible hit area makes the measured end jump.
    const screenOrigin=worldToScreen(selectedHandle.startPoint);
    const target=screenToWorld({
      x:screenOrigin.x+(s.x-selectedHandle.startScreen.x),
      y:screenOrigin.y+(s.y-selectedHandle.startScreen.y)
    });
    const movedPoint=snap(target,null,selectedHandle);
    if(Number.isInteger(selectedHandle.pointIndex)){
     const item=selectedHandle.item,index=selectedHandle.pointIndex;
     item.points[index]=movedPoint;
     if(index===0)item.a={...movedPoint};
     if(index===item.points.length-1)item.b={...movedPoint};
    }else selectedHandle.item[selectedHandle.key]=movedPoint;
    selectedHandle.point=movedPoint;
    magnifierPoint=selectedHandle.point;
  }
  paint();return;
}
if(drag&&mode==='pan'){view.dx=drag.dx+(s.x-drag.screen.x);view.dy=drag.dy+(s.y-drag.screen.y);paint();return}
if(drawStart&&drawPointerId===e.pointerId){drawCurrent=mode==='freehand'?boundsPoint(screenToWorld(s)):snap(screenToWorld(s),drawStart);magnifierPoint=drawCurrent;if(mode==='freehand')stroke.push({...drawCurrent});paint()}}
function stageUp(e){
 if(screen!=='editor')return;
 const wasTwo=pointers.size===2;
 pointers.delete(e.pointerId);
 if(wasTwo){
  gesture=null;drawStart=null;drawCurrent=null;
  magnifierPoint=null;loupeSide=null;paint();return;
 }
 if(['polyline','chain','cumulative','angle'].includes(mode)&&polylineDraft.length){magnifierPoint=null;return;}
 if(selectedHandle){
  const handle=selectedHandle,item=handle.item,moved=handle.dragged;
  selectedHandle=null;magnifierPoint=null;loupeSide=null;
  if(handle.kind==='select-only'){paint();return}
  if(!moved){
   if((handle.kind==='point'||handle.kind==='label'||handle.kind==='note-caption'||handle.kind==='move-dimension'||handle.kind==='move-polyline')&&editStack.length)editStack.pop();
   if(handle.initialSelection){paint();return}
   // Druhé samostatné klepnutí otevře úpravu bez časového limitu.
   editItem(item);
  }else if(handle.kind==='point'||handle.kind==='label'||handle.kind==='note-caption'||handle.kind==='move-dimension'||handle.kind==='move-polyline'){
   touch(item);commitEditor();
  }else paint();
  return;
 }
 if(drag){drag=null;return}if(!drawStart||drawPointerId!==e.pointerId)return;const a=drawStart,b=drawCurrent||drawStart;drawStart=null;drawCurrent=null;magnifierPoint=null;loupeSide=null;drawPointerId=null;if(Math.hypot(a.x-b.x,a.y-b.y)<3/view.zoom&&mode!=='note'&&mode!=='symbol'){paint();return}let item={id:uid(),type:mode,a,b,color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize,unit:prefs.unit,measure:'',text:'',points:(mode==='freehand'||mode==='polyline')?[...stroke]:[]};stroke=[];
if(['dimension','chain','cumulative','area'].includes(mode)){
  // Follow the reference video: lay down the geometry first, adjust endpoints,
  // and enter the actual laser/manual value later by tapping its '?' label.
  checkpoint();
  current.items.push(item);
  commitEditor();
  finishDraw(item);
}
else if(mode==='note'){
 // ImageMeter-like: vložení bodu vytvoří okamžitě i prázdnou poznámku.
 // Odtáhnutí poznámky při prvním tahu vytvoří propojení bez textu/fotografie.
 // Text nebo detailní fotku lze doplnit až po klepnutí na rámeček.
 item.a={...a};
 item.b={...a};
 if(Math.hypot(a.x-b.x,a.y-b.y)>3/view.zoom){
   item.b={...b};
   item.captionMoved=true;
 }
 checkpoint();
 current.items.push(item);
 commitEditor();
 finishDraw(item);
}
 else if(mode==='symbol'){
 const symbols=[
  ['Elektroinstalace','🔌','Zásuvka'],['Elektroinstalace','⚡','Elektro'],['Elektroinstalace','💡','Světlo'],
  ['Elektroinstalace','🔘','Vypínač'],['Elektroinstalace','🔋','Rozvaděč'],['Elektroinstalace','📡','Datová zásuvka'],
  ['Půdorys','▣','Okno'],['Půdorys','🚪','Dveře'],['Půdorys','▰','Skříň'],
  ['Půdorys','▤','Pracovní deska'],['Půdorys','⊞','Stůl'],['Půdorys','⬆','Výška parapetu'],
  ['Voda a topení','🚰','Voda'],['Voda a topení','🟤','Odpad'],['Voda a topení','♨','Topení'],
  ['Voda a topení','🚿','Sprcha'],['Voda a topení','🚽','WC'],
  ['Obecné','📍','Bod'],['Obecné','⚠','Pozor'],['Obecné','↗','Směr'],
  ['Obecné','✕','Označit místo'],['Obecné','📷','Detail'],['Obecné','☑','Zkontrolováno']
 ];
 let chosen=null;
 const recent=Array.isArray(prefs.recentSymbols)?prefs.recentSymbols:[];
 modal('Knihovna symbolů',
  '<label>Kategorie</label><select id="symbolCategory">'+
  ['Vše','Naposledy použité','Elektroinstalace','Půdorys','Voda a topení','Obecné']
  .map(x=>'<option>'+escapeHtml(x)+'</option>').join('')+'</select>'+
  '<label>Vyhledat symbol</label><input id="symbolSearch" placeholder="Např. zásuvka nebo okno">'+
  '<div id="symbolChoices" style="max-height:32vh;overflow:auto;margin:10px 0"></div>'+
  '<label>Text u symbolu (volitelný)</label><input id="drawText" placeholder="Vlastní popisek">',
  ()=>{
   const label=$('drawText').value.trim();
   if(chosen===null&&!label){notify('Vyber symbol nebo napiš popisek');return false}
   item.icon=chosen===null?'⚑':symbols[chosen][1];
   item.text=label;
   if(chosen!==null){
    prefs.recentSymbols=[chosen,...recent.filter(i=>i!==chosen)].slice(0,12);save();
   }
   checkpoint();current.items.push(item);commitEditor();finishDraw(item);
  },'Vložit');
 const render=()=>{
  const cat=$('symbolCategory').value,q=$('symbolSearch').value;
  const choices=$('symbolChoices');
  const found=symbols.map((row,index)=>({row,index}))
   .filter(({row,index})=>(cat==='Vše'||(cat==='Naposledy použité'?recent.includes(index):row[0]===cat))&&
    (matchesSymbolSearch(row[2],q)||matchesSymbolSearch(row[0],q)));
  choices.innerHTML=found.map(({row,index})=>
   '<button type="button" class="choice" data-symbol="'+index+'" style="width:100%;text-align:left;'+(chosen===index?'outline:2px solid #f7dc27;':'')+'"><strong>'+row[1]+'</strong> '+escapeHtml(row[2])+'</button>').join('')||'<p class="muted">Žádný symbol neodpovídá výběru.</p>';
  choices.querySelectorAll('[data-symbol]').forEach(btn=>btn.onclick=()=>{
   chosen=Number(btn.dataset.symbol);
   $('drawText').value=symbols[chosen][2];render();
  });
 };
 $('symbolCategory').onchange=render;$('symbolSearch').oninput=render;render();
}
else{checkpoint();current.items.push(item);commitEditor();finishDraw(item)}}
function editSegmentedItem(item){
 const count=item.points.length-1;
 const saved=Array.from({length:count},(_,i)=>item.segmentData?.[i]||{measure:'',text:'',unit:item.unit||prefs.unit});
 const readings=window.__boschHistoryReadings?.()||[];
 const header=item.type==='chain'?'Dimenzní řetězec':item.type==='cumulative'?'Kumulativní řetězec':'Lomená čára';
 const fields=saved.map((row,i)=>{
  const selectedUnit=row.unit||item.unit||prefs.unit;
  const readingField=readings.length?'<select data-segment-reading="'+i+'"><option value="">Použít hodnotu z laseru…</option>'+
   readings.slice(0,30).map((reading,index)=>'<option value="'+index+'">'+escapeHtml(reading.value)+' '+escapeHtml(reading.unit)+'</option>').join('')+'</select>':'';
  return '<div class="segment-row"><strong>'+(item.type==='cumulative'?'Od začátku k bodu ':'Úsek ')+(i+1)+'</strong>'+
   '<label>Rozměr</label><input id="segmentMeasure'+i+'" type="text" value="'+escapeHtml(row.measure||'')+'" placeholder="Hodnota z laseru nebo ručně">'+
   '<label>Jednotka</label><select id="segmentUnit'+i+'">'+['mm','cm','m','in'].map(u=>'<option '+(u===selectedUnit?'selected':'')+'>'+u+'</option>').join('')+'</select>'+
   readingField+'<label>Popisek</label><input id="segmentText'+i+'" value="'+escapeHtml(row.text||'')+'" placeholder="Volitelný text"></div>';
 }).join('');
 const insertOptions=Array.from({length:count},(_,i)=>'<option value="'+i+'">Za úsek '+(i+1)+'</option>').join('');
 const removeOptions=item.points.slice(1).map((_,i)=>'<option value="'+(i+1)+'">Bod '+(i+2)+'</option>').join('');
 modal(header,fields+
   '<div class="segment-tools"><label>Vložit další bod</label><select id="insertSegmentAt">'+insertOptions+'</select>'+
   '<button class="outline" id="insertSegmentPoint">Přidat bod mezi dva body</button>'+
   '<label>Odstranit existující bod</label><select id="removeSegmentAt">'+removeOptions+'</select>'+
   '<button class="outline" id="removeSegmentPoint">Odstranit vybraný bod</button></div>'+
   '<button class="outline" id="removeItem">Smazat celý prvek</button>',
   ()=>{checkpoint();readSegmentFields(item);commitEditor()},'Uložit');
 function readSegmentFields(target){
  target.segmentData=Array.from({length:count},(_,i)=>({
   measure:$('segmentMeasure'+i).value.trim(),
   text:$('segmentText'+i).value.trim(),unit:$('segmentUnit'+i).value
  }));
 }
 $('modalBody').querySelectorAll('[data-segment-reading]').forEach(select=>select.onchange=()=>{
  if(select.value==='')return;
  const r=readings[Number(select.value)],i=Number(select.dataset.segmentReading);
  if(r){$('segmentMeasure'+i).value=String(r.value);$('segmentUnit'+i).value=r.unit}
 });
 $('insertSegmentPoint').onclick=()=>{
  const index=Number($('insertSegmentAt').value);
  if(!Number.isInteger(index)||!item.points[index+1])return;
  checkpoint();readSegmentFields(item);
  const a=item.points[index],b=item.points[index+1];
  item.points.splice(index+1,0,{x:(a.x+b.x)/2,y:(a.y+b.y)/2});
  item.segmentData.splice(index,1,{measure:'',text:'',unit:item.unit||prefs.unit},{measure:'',text:'',unit:item.unit||prefs.unit});
  item.a={...item.points[0]};item.b={...item.points[item.points.length-1]};
  commitEditor();editSegmentedItem(item);
 };
 $('removeSegmentPoint').onclick=()=>{
  if(item.points.length<=2){notify('Musí zůstat aspoň dva body');return}
  const index=Number($('removeSegmentAt').value);
  if(!Number.isInteger(index)||index<1||index>=item.points.length)return;
  checkpoint();readSegmentFields(item);
  item.points.splice(index,1);
  item.segmentData.splice(Math.max(0,index-1),1);
  item.a={...item.points[0]};item.b={...item.points[item.points.length-1]};
  commitEditor();editSegmentedItem(item);
 };
 $('removeItem').onclick=()=>{
  checkpoint();current.items=current.items.filter(x=>x.id!==item.id);
  selected=null;$('modal').hidden=true;commitEditor();
 };
}
function editItem(item){
 if(['polyline','chain','cumulative','angle'].includes(item.type)&&item.points?.length>1){editSegmentedItem(item);return}
 const dimension=['dimension','chain','cumulative','area','angle'].includes(item.type);
 if(dimension){
  const laserApplicable=['dimension','chain','cumulative'].includes(item.type);
  const previous=laserApplicable&&window.__boschHistoryReadings?.()||[];
  const historyMarkup=laserApplicable?
   '<label for="boschReadingSelection">Historie měření Bosch (posledních 40)</label>'+
   '<select id="boschReadingSelection"><option value="">Vybrat naměřenou hodnotu…</option>'+
   previous.map((reading,index)=>'<option value="'+index+'">'+escapeHtml(reading.value)+' '+escapeHtml(reading.unit)+' · '+escapeHtml(new Date(reading.time).toLocaleTimeString('cs-CZ'))+'</option>').join('')+
   '</select><small class="bosch-history-hint">Výběrem hodnoty se vyplní rozměr. Potvrď tlačítkem Uložit.</small>':'';
  modal('Upravit hodnotu',
   '<label>Rozměr</label><input id="measureInput" type="text" value="'+escapeHtml(item.measure||'')+'">'+
   '<label>Jednotka</label><select id="measureUnit">'+['mm','cm','m','in','m²','°'].map(u=>'<option '+(u===(item.unit||prefs.unit)?'selected':'')+'>'+u+'</option>').join('')+'</select>'+
   historyMarkup+
   '<label>Popisek ke kótě (volitelné)</label><input id="dimensionCaption" value="'+escapeHtml(item.text||'')+'" placeholder="Např. přívod vody">'+
   '<div class="row wrap"><button id="removeItem" class="outline">Smazat kótu</button></div>',
   ()=>{checkpoint();item.measure=$('measureInput').value;item.unit=$('measureUnit').value;item.text=$('dimensionCaption').value.trim();commitEditor()}
  );
  const chooser=$('boschReadingSelection');
  if(chooser)chooser.onchange=()=>{
   const index=Number(chooser.value);
   if(chooser.value===''||!previous[index])return;
   $('measureInput').value=previous[index].value;
   $('measureUnit').value=previous[index].unit;
  };
 }else if(['line','arrow','circle','ellipse','rect'].includes(item.type)){
  const kind=item.type;
  const isRound=kind==='circle'||kind==='ellipse';
  const roundFields=isRound?'<label>Značení rozměru</label><select id="measureKind"><option value="diameter">Ø Průměr</option><option value="radius">R Poloměr</option></select>':'';
  const rectFields=kind==='rect'?'<label>Šířka (mm)</label><input id="rectWidth" type="text" value="'+escapeHtml(item.dimW||'')+'"><label>Výška (mm)</label><input id="rectHeight" type="text" value="'+escapeHtml(item.dimH||'')+'">':'';
  modal(kind==='line'?'Upravit čáru':kind==='arrow'?'Upravit šipku':kind==='rect'?'Upravit obdélník':'Upravit tvar',
   '<label>'+(isRound?'Rozměr kruhu / elipsy':'Kóta / rozměr (volitelné)')+'</label><input id="measureInput" type="text" value="'+escapeHtml(item.measure||'')+'" placeholder="Např. 1250">'+
   '<label>Jednotka</label><select id="measureUnit">'+['mm','cm','m','in'].map(u=>'<option '+(u===(item.unit||prefs.unit)?'selected':'')+'>'+u+'</option>').join('')+'</select>'+
   roundFields+rectFields+
   '<label>Textový popisek</label><input id="drawText" value="'+escapeHtml(item.text||'')+'" placeholder="Např. přívod vody">'+
   '<div class="row"><button id="removeItem" class="outline">Smazat prvek</button></div>',
   ()=>{checkpoint();item.measure=$('measureInput').value.trim();item.unit=$('measureUnit').value;item.text=$('drawText').value.trim();
     if(isRound)item.measureKind=$('measureKind').value;
     if(kind==='rect'){item.dimW=$('rectWidth').value.trim();item.dimH=$('rectHeight').value.trim()}
     commitEditor();
   }
  );
  if(isRound)$('measureKind').value=item.measureKind||'diameter';
 }else if(item.type==='note'){openRichNote(item,false);return}
 else modal('Upravit prvek',
  '<label>Text</label><input id="drawText" value="'+escapeHtml(item.text||'')+'"><div class="row"><button id="removeItem" class="outline">Smazat prvek</button></div>',
  ()=>{checkpoint();item.text=$('drawText').value;commitEditor()}
 );
 $('removeItem').onclick=()=>{checkpoint();current.items=current.items.filter(i=>i.id!==item.id);selected=null;$('modal').hidden=true;commitEditor()};
}
function showEditorOverflow(){
  showAppMenu('editorOverflow',[
    [prefs.repeatDrawing?'Opakovat kóty ✓':'Jedna kóta ✓',()=>{
       prefs.repeatDrawing=!prefs.repeatDrawing;save();updateDrawingToolButton();
       notify(prefs.repeatDrawing?'Kóty opakovaně':'Jen jedna kóta');
    }],
    ['Upravit vybranou kótu',()=>{const item=current.items.find(x=>x.id===selected);if(item)editItem(item);else notify('Nejdřív vyber kótu klepnutím')}],
    ['Vybrat a přesunout kótu',()=>setTool('select')],
    ['Přizpůsobit fotografii',()=>fitImage()],
    ['Vrátit / opakovat úpravu',()=>redoEditor()],
    ['Exportovat obrázek nebo PDF',()=>$('exportBtn').click()],
    ['Nastavení editoru',()=>toggleSettings()]
  ]);
}
$('editorMore').onclick=showEditorOverflow;
$('editorTopMenu').onclick=showEditorOverflow;
$('deleteTool').onclick=()=>{
  if(!selected){notify('Nejdřív vyber kótu klepnutím');setTool('select');return;}
  checkpoint();current.items=current.items.filter(x=>x.id!==selected);selected=null;commitEditor();
};
$('styleTool').onclick=()=>{
  const item=(current?.items||[]).find(x=>x.id===selected);
  const width=item?.width||prefs.lineWidth;
  const font=item?.fontSize||prefs.fontSize;
  modal('Vzhled kóty',`<label>Tloušťka čáry</label><input id="styleWidth" type="number" min="1" max="15" value="${width}">
    <label>Velikost textu</label><input id="styleFont" type="number" min="8" max="80" value="${font}">
    <div class="muted">${item?'Styl vybraného prvku':'Výchozí styl pro nové prvky'}</div>`,()=>{
      const w=Math.max(1,Math.min(15,Number($('styleWidth').value)||2));
      const fs=Math.max(8,Math.min(80,Number($('styleFont').value)||17));
      if(item){checkpoint();item.width=w;item.fontSize=fs;commitEditor()}
      else{prefs.lineWidth=w;prefs.fontSize=fs;save();paint()}
  });
};
stageCanvas.addEventListener('pointerdown',stageDown);stageCanvas.addEventListener('pointermove',stageMove);stageCanvas.addEventListener('pointerup',stageUp);stageCanvas.addEventListener('pointercancel',e=>{pointers.delete(e.pointerId);magnifierPoint=null;drawStart=null;selectedHandle=null;paint()});stageCanvas.addEventListener('wheel',e=>{e.preventDefault();const p=eventPoint(e);zoomAt(e.deltaY<0?1.1:.9,p.x,p.y)},{passive:false});
$('exportBtn').onclick=()=>{modal('Export',`<div class="row wrap"><button id="exportPng" class="outline">Export PNG</button><button id="exportPdf" class="outline">Export PDF</button></div><div class="muted">Originální soubor a editovatelné kóty se zachovávají zvlášť.</div>`,()=>true,'Zavřít');$('exportPng').onclick=()=>{exportPng();$('modal').hidden=true};$('exportPdf').onclick=()=>{if(native)Native.printPdf();else window.print();$('modal').hidden=true}};
function exportPng(){let o=document.createElement('canvas');o.width=photoSize.w;o.height=photoSize.h;let c=o.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,o.width,o.height);if(stageImg)c.drawImage(stageImg,0,0,o.width,o.height);let oldCtx=ctx,oldView={...view};ctx=c;view={zoom:1,dx:0,dy:0};for(let item of current.items||[])drawItem(c,item,false);ctx=oldCtx;view=oldView;const data=o.toDataURL('image/png');if(native)Native.exportPng((current.title||'zamerovani')+'.png',data.slice(data.indexOf(',')+1));else{let a=document.createElement('a');a.download='zamerovani.png';a.href=data;a.click()}notify('Export obrázku připraven')}
