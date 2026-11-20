'use strict';
const toolGroups=[{title:'Měřicí nástroje',tools:[['dimension','↔','Rozměr'],['chain','ϟ','Dimenzní řetězec'],['cumulative','⇥','Kumulativní řetězec'],['angle','∠','Úhel'],['polyline','⌁','Lomená čára'],['area','▱','Lichoběžník'],['rect','▭','Obdélník'],['circle','◯','Kruh'],['target','⊕','Směřovat']]},{title:'Kreslicí nástroje',tools:[['note','▤','Poznámka'],['line','／','Čára'],['arrow','➜','Šipka'],['freehand','✎','Volná ruka'],['ellipse','⬭','Elipsa'],['symbol','⚑','Symbol']]},{title:'Úpravy',tools:[['select','◎','Vybrat a upravit'],['pan','✥','Posun obrazu']]}];
const allTools=toolGroups.flatMap(g=>g.tools);
let drawStart=null,drawCurrent=null,stroke=[],polylineDraft=[],drawPointerId=null,selectedHandle=null,lastTap=0,lastTapAt=null,gesture=null;
let lastDrawingTool='dimension',suppressToolClick=false,repeatPressTimer=null,loupeSide=null;
let photoLoadGeneration=0,photoLoadTimer=null,photoLoadFailed=false,editorViewport=null;
function openEditor(r){
 hideEditorLoupe();
 editorViewport=null;
 polylineDraft=[];stroke=[];drawStart=null;drawCurrent=null;lastTap=0;lastTapAt=null;loupeSide=null;
 screen='editor';window.ZFlight?.record('editor-open',{itemCount:r.items?.length||0});document.body.classList.add('in-editor');closeMenus();$('editorHint').hidden=true;
 current=r;selected=null;mode='select';lastDrawingTool='dimension';updateDrawingToolButton();
 $('browserView').hidden=true;$('browserFoot').hidden=true;$('noteView').hidden=true;
 $('editorView').hidden=false;$('editorTitle').textContent=r.title;
 const photoMeta=$('editorPhotoMeta');
 if(photoMeta){photoMeta.textContent=photoDetailsText(r);photoMeta.title=photoMeta.textContent}
 photoSize={w:r.width||1400,h:r.height||900};stageImg=null;selectedHandle=null;editStack=[];redoStack=[];
 const generation=++photoLoadGeneration;photoLoadFailed=false;clearTimeout(photoLoadTimer);
 if(r.kind==='photo'&&r.media?.[0]){
  const active=()=>generation===photoLoadGeneration&&current===r&&screen==='editor';
  const failed=()=>{
   if(!active())return;clearTimeout(photoLoadTimer);photoLoadFailed=true;
   notify('Nepodařilo se načíst fotografii');paint();
  };
  photoLoadTimer=setTimeout(failed,20000);
  loadPhotoImage(r.media[0]).then(img=>{
   if(!active())return;clearTimeout(photoLoadTimer);photoLoadFailed=false;stageImg=img;
   photoSize={w:img.naturalWidth,h:img.naturalHeight};
   initialImageView();paint();
  }).catch(failed);
 }
 resizeEditor();initialImageView();paint();
}
function hideEditorLoupe(){
 magnifierPoint=null;loupeSide=null;$('loupe').hidden=true;
 for(const id of pointers.keys())try{stageCanvas.releasePointerCapture(id)}catch(error){}
 pointers.clear();
}
function exitEditor(){hideEditorLoupe();finishHandleGesture(selectedHandle);selectedHandle=null;finishPendingPath();current=null;screen='browser';showFolder()}
$('editorBack').onclick=exitEditor;
// Hide before the Back click, and retire captured pointers before any queued move.
$('editorBack').addEventListener('pointerdown',hideEditorLoupe,{capture:true});
$('fitBtn').onclick=fitImage;$('zoomIn').onclick=()=>{const p=centerPoint();zoomAt(1.25,p.x,p.y)};$('zoomOut').onclick=()=>{const p=centerPoint();zoomAt(.8,p.x,p.y)};
function centerPoint(){return{x:stageCanvas.clientWidth/2,y:stageCanvas.clientHeight/2}}
function resizeEditor(){
 if(screen!=='editor')return;
 const el=$('stage'),dpr=window.devicePixelRatio||1,w=el.clientWidth,h=el.clientHeight;
 // Preserve zoom and the world point at the centre, including unsaved drafts.
 if(editorViewport?.record===current&&w>0&&h>0){
  view.dx+=(w-editorViewport.w)/2;view.dy+=(h-editorViewport.h)/2;
 }
 editorViewport={record:current,w,h};
 stageCanvas.width=Math.max(1,Math.floor(w*dpr));stageCanvas.height=Math.max(1,Math.floor(h*dpr));
 ctx.setTransform(dpr,0,0,dpr,0,0);paint();
}
window.addEventListener('resize',resizeEditor);
function fitImage(){let w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;if(!w||!h)return;Object.assign(view,AnnotationGeometry.fittedViewport(w,h,photoSize));paint()}
function initialImageView(){fitImage();const p=centerPoint();zoomAt(1.15,p.x,p.y)}
function zoomAt(factor,x,y){Object.assign(view,AnnotationGeometry.zoomedViewport(view,factor,x,y));paint()}
function screenToWorld(p){return AnnotationGeometry.screenToWorld(p,view)}
function worldToScreen(p){return AnnotationGeometry.worldToScreen(p,view)}
function eventPoint(e){let r=stageCanvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}}
function boundsPoint(p){return AnnotationGeometry.boundsPoint(p,photoSize)}
// Magnetické přichytávání není vazba: výsledek se přepočítává z aktuální
// polohy prstu. Vždy musí zbýt prostor mezi magnetickými zónami pro uvolnění.
function snap(p,ref=null,ignore=null){return AnnotationGeometry.snapPoint(p,ref,ignore,current.items||[],prefs,view.zoom,photoSize)}
function checkpoint(){AnnotationHistory.checkpoint(current.items,editStack);redoStack=[]}
function finishHandleGesture(handle){
 // Only changed objects enter Undo; taps and rejected/pinch gestures preserve Redo.
 if(!handle?.dragged||!handle.beforeDragItems||!current)return false;
 if(JSON.stringify(current.items||[])===handle.beforeDragItems)return false;
 AnnotationHistory.recordSnapshot(handle.beforeDragItems,editStack);
 redoStack=[];
 window.ZFlight?.record('drag-release',{undoCount:editStack.length,itemCount:current.items?.length||0},true);
 touch(handle.item);commitEditor();
 return true;
}
function commitEditor(){
 const started=performance.now();
 if(current?.kind==='photo'&&stageImg){current.width=photoSize.w;current.height=photoSize.h;}
 touch(current);const confirmed=save();const paintedFrom=performance.now();paint();
 window.ZFlight?.record('editor-commit',{savePathMs:paintedFrom-started,paintMs:performance.now()-paintedFrom,success:confirmed===true?1:0});
 return confirmed;
}
function undoEditor(){if(!editStack.length)return;let restored;
 try{restored=AnnotationHistory.restore(current.items,editStack,redoStack)}
 catch(error){notify('Historie úprav je poškozená. Změny nebyly použity.');return false}
 current.items=restored;return commitEditor()}
function redoEditor(){if(!redoStack.length)return;let restored;
 try{restored=AnnotationHistory.restore(current.items,redoStack,editStack)}
 catch(error){notify('Historie úprav je poškozená. Změny nebyly použity.');return false}
 current.items=restored;return commitEditor()}
$('undo').onclick=undoEditor;$('redo').onclick=redoEditor;$('selectTool').onclick=()=>setTool('select');$('toolsToggle').onclick=()=>showTools();$('activeTool').onclick=()=>{
  if(suppressToolClick){suppressToolClick=false;return;}
  if(mode==='select'||mode==='pan')setTool(lastDrawingTool);
  else setTool('select');
};
// Dlouhé podržení nyní slouží k přesunu ikony. Režim opakovaného kreslení
// zůstává dostupný v existující nabídce editoru, bez kolize dvou gest.
function updateDrawingToolButton(){
  const t=allTools.find(x=>x[0]===lastDrawingTool);
  const b=$('activeTool');
  b.innerHTML=toolIcon(t?.[0],t?.[1]||'↔')+(prefs.repeatDrawing?'∞':'¹');
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
function toolIcon(key,fallback){
 if(key!=='chain')return escapeHtml(fallback);
 return '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17 9 6l5 12 7-12M3 12v5h5M16 6h5v5"/></svg>';
}
function showTools(){const open=!$('toolMenu').hidden;closeMenus();if(open)return;$('toolMenu').hidden=false;let html='<div class="toolList">';for(let group of toolGroups){html+=`<div class="sectionLabel">${group.title}</div>`;for(let [key,icon,label] of group.tools)html+=`<button class="choice" data-tool="${key}"><strong>${toolIcon(key,icon)}</strong>${label}</button>`}html+='</div>';$('toolMenu').innerHTML=html;$('toolMenu').querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{setTool(b.dataset.tool);closeMenus()})}
function finishPendingPath(){
 if(['polyline','chain','cumulative'].includes(mode)&&polylineDraft.length>=2)completePolyline(mode,false);
}
function updateChainHint(){
 const hint=$('editorHint');
 hint.hidden=!['chain','cumulative'].includes(mode);
 if(mode==='chain')hint.textContent=polylineDraft.length?'Klepni pro další navazující kótu':'Vyber počáteční bod';
 if(mode==='cumulative')hint.textContent=polylineDraft.length?'Klepni pro další kótu':'Označ výchozí bod';
}
function setTool(key,keepSelection=false){
 finishPendingPath();
 mode=key;selectedHandle=null;if(!keepSelection)selected=null;
 drawStart=null;drawCurrent=null;stroke=[];polylineDraft=[];lastTap=0;lastTapAt=null;
 if(key!=='select'&&key!=='pan')lastDrawingTool=key;
 updateDrawingToolButton();updateChainHint();paint();
}
function drawGrid(){if(!prefs.showGrid)return;let spacing=Math.max(5,prefs.gridStep)*view.zoom;if(spacing<8)return;ctx.save();ctx.strokeStyle='#eeeeee28';ctx.lineWidth=1;const left=Math.max(0,Math.ceil(-view.dx/spacing)),right=Math.min(Math.ceil(photoSize.w/prefs.gridStep),Math.ceil((stageCanvas.clientWidth-view.dx)/spacing));const top=Math.max(0,Math.ceil(-view.dy/spacing)),bottom=Math.min(Math.ceil(photoSize.h/prefs.gridStep),Math.ceil((stageCanvas.clientHeight-view.dy)/spacing));ctx.beginPath();for(let i=left;i<=right;i++){const x=view.dx+i*spacing;ctx.moveTo(x,0);ctx.lineTo(x,stageCanvas.clientHeight)}for(let j=top;j<=bottom;j++){const y=view.dy+j*spacing;ctx.moveTo(0,y);ctx.lineTo(stageCanvas.clientWidth,y)}ctx.stroke();ctx.restore()}
function paint(){if(screen!=='editor'||!current)return;let w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;ctx.clearRect(0,0,w,h);if(current.kind==='photo'&&!stageImg){ctx.fillStyle='#202123';ctx.fillRect(0,0,w,h);ctx.fillStyle='#ddd';ctx.font='14px sans-serif';ctx.textAlign='center';ctx.fillText(photoLoadFailed?'Fotografii nelze načíst. Zavři ji a otevři znovu.':'Načítám fotografii…',w/2,h/2);return}ctx.save();ctx.fillStyle='#202123';ctx.fillRect(0,0,w,h);ctx.translate(view.dx,view.dy);ctx.scale(view.zoom,view.zoom);if(stageImg)ctx.drawImage(stageImg,0,0,photoSize.w,photoSize.h);else{ctx.fillStyle='#36383a';ctx.fillRect(0,0,photoSize.w,photoSize.h);ctx.strokeStyle='#4b4e50';ctx.lineWidth=3/view.zoom;ctx.strokeRect(0,0,photoSize.w,photoSize.h)}ctx.restore();drawGrid();for(let item of current.items||[]){if(item.id===selected)drawSelectedOutline(ctx,item);drawItem(ctx,item);}if(drawStart&&drawCurrent){let mock={type:mode,a:drawStart,b:drawCurrent,points:stroke,measure:'',unit:prefs.unit,color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize};drawItem(ctx,mock,false)}drawSelectedGrips(ctx);if(magnifierPoint&&prefs.loupe)drawLoupe();else $('loupe').hidden=true;}

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
 if(['area','rect','circle','ellipse'].includes(item.type)){
  for(const vertex of resizePoints(item)||[]){
   const p=worldToScreen(vertex);c.beginPath();c.arc(p.x,p.y,14,0,Math.PI*2);c.fill();c.stroke();
  }
 }else if(item.type==='target'){
  // Fixed-size marker: no resize grips.
 }else if(item.type==='note'&&!item.media?.length){
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
function noteDisplayedCaption(item,exporting=window.__exportingAnnotations){
 const voice=Array.isArray(item.audioMedia)&&item.audioMedia.length?'🎙 ':'';
 const body=item.text||((item.media?.length||exporting)?'':'Klikněte pro zadání textu');
 return voice+body;
}
function noteCaptionScreen(item,transform=view){
 return annotationProjectPoint(item.captionMoved&&item.b?item.b:item.a||{x:0,y:0},transform);
}
function noteCaptionBounds(item,render=annotationRenderContext(ctx)){
 const ctx=render.ctx,p=noteCaptionScreen(item,render.view),fs=Number(item.fontSize)||Number(render.prefs.fontSize)||17;
 const caption=noteDisplayedCaption(item,render.exporting);
 ctx.save();ctx.font='600 '+fs+'px sans-serif';
 const w=ctx.measureText(caption).width+10;ctx.restore();
 return {x:p.x-w/2,y:p.y-fs*.7,w,h:fs*1.4,p};
}
function drawNoteLeader(c,item,color,render=annotationRenderContext(c)){
 if(!item.captionMoved||!item.a)return;
 const p=annotationProjectPoint(item.a,render.view),box=noteCaptionBounds(item,render),mid=box.p;
 const dx=p.x-mid.x,dy=p.y-mid.y;
 const factor=Math.max(Math.abs(dx)/Math.max(1,box.w/2),Math.abs(dy)/Math.max(1,box.h/2));
 if(factor<=1||!Number.isFinite(factor))return;
 const edge={x:mid.x+dx/factor,y:mid.y+dy/factor};
 c.save();c.strokeStyle=color;c.fillStyle=color;
 c.lineWidth=Number(item.width)||Number(render.prefs.lineWidth)||2;c.lineCap='round';
 c.beginPath();c.moveTo(edge.x,edge.y);c.lineTo(p.x,p.y);c.stroke();
 drawArrow(c,p,edge,11);c.restore();
}
function canvasText(text,p,color,size,angle=0,c=ctx){c.save();try{c.translate(p.x,p.y);c.rotate(angle);c.font=`600 ${size}px sans-serif`;c.textAlign='center';c.textBaseline='middle';let width=c.measureText(text).width;c.fillStyle='#222d';c.fillRect(-width/2-5,-size*.67,width+10,size*1.4);c.fillStyle=color;c.fillText(text,0,0);}finally{c.restore()}}
function readableSegmentAngle(a,b){
 let angle=Math.atan2(b.y-a.y,b.x-a.x);
 if(angle>Math.PI/2)angle-=Math.PI;
 if(angle< -Math.PI/2)angle+=Math.PI;
 return angle;
}
function drawArrow(c,point,to,size=10){let a=Math.atan2(point.y-to.y,point.x-to.x);c.beginPath();c.moveTo(point.x,point.y);c.lineTo(point.x-size*Math.cos(a-.48),point.y-size*Math.sin(a-.48));c.moveTo(point.x,point.y);c.lineTo(point.x-size*Math.cos(a+.48),point.y-size*Math.sin(a+.48));c.stroke()}
function rectCorners(item){return AnnotationGeometry.rectCorners(item)}
function quadCorners(item){return AnnotationGeometry.quadCorners(item)}
function ellipseGeometry(item){return AnnotationGeometry.ellipseGeometry(item)}
function resizePoints(item){return AnnotationGeometry.resizePoints(item)}
function cumulativeSegment(item,index,transform=view){return AnnotationGeometry.cumulativeSegment(item,index,transform)}
function triangleArea(a,b,c){return AnnotationGeometry.triangleArea(a,b,c)}
function quadAreaFromMeasures(item){return AnnotationGeometry.quadAreaFromMeasures(item)}
// Unitless captions hide only the suffix; item.unit remains unchanged for measurements.
function measureDisplay(value,unit,hideUnit=false){
 const text=String(value??'');
 return !text||hideUnit?text:text+' '+(unit||'mm');
}
// Each view owns its transform and canvas. Rendering never swaps editor globals.
function annotationProjectPoint(p,transform){return AnnotationGeometry.annotationProjectPoint(p,transform)}
function annotationRenderContext(c,options={}){
 return {ctx:c,view:{...view},photoSize:{...photoSize},
  viewport:{w:stageCanvas.clientWidth,h:stageCanvas.clientHeight},prefs,selected,
  exporting:!!window.__exportingAnnotations,...options};
}
function drawItem(c,item,render=annotationRenderContext(c)){
 if(!render||typeof render!=='object')render=annotationRenderContext(c);
 const view=render.view,prefs=render.prefs;
 const project=p=>annotationProjectPoint(p,view);
 const drawText=(value,p,color,size,angle=0)=>canvasText(value,p,color,size,angle,c);
let a=item.a&&project(item.a),b=item.b&&project(item.b);let pts=(item.points||[]).map(project);const color=item.color||prefs.color,fw=(item.width||prefs.lineWidth),fs=(item.fontSize||prefs.fontSize);c.save();try{c.strokeStyle=color;c.fillStyle=color;c.lineWidth=fw;c.lineJoin='round';c.lineCap='round';
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
 drawText((item.measure||degrees.toFixed(1))+(item.hideUnit?'':'°'),
  {x:vertex.x+Math.cos(mid)*(radius+25),y:vertex.y+Math.sin(mid)*(radius+25)},color,fs);
 for(let i=0;i<2;i++){
  const end=i===0?p:q,row=item.segmentData?.[i]||{};
  const caption=[row.measure?measureDisplay(row.measure,row.unit,row.hideUnit):'',row.text||''].filter(Boolean).join(' · ');
  if(caption)drawText(caption,{x:(end.x+vertex.x)/2+(end.x-vertex.x)*(Number(row.labelT)||0),y:(end.y+vertex.y)/2-18+(end.y-vertex.y)*(Number(row.labelT)||0)},color,fs);
 }
}
else if(['chain','cumulative'].includes(item.type)&&pts.length>1){
 for(let i=0;i<pts.length-1;i++){
  const projected=item.type==='cumulative'?cumulativeSegment(item,i,view):null;
   const from=projected?.from||pts[i],to=projected?.to||pts[i+1];
  const data=item.segmentData?.[i]||{};
  const dx=to.x-from.x,dy=to.y-from.y,d=Math.hypot(dx,dy)||1;
  const nx=-dy/d,ny=dx/d,offset=(Number(item.offset)||0)+i*(item.type==='cumulative'?26:0);
  const p={x:from.x+nx*offset,y:from.y+ny*offset};
  const q={x:to.x+nx*offset,y:to.y+ny*offset};
  c.beginPath();
  c.moveTo(from.x+nx*(offset-9),from.y+ny*(offset-9));
  c.lineTo(from.x+nx*(offset+9),from.y+ny*(offset+9));
  c.moveTo(to.x+nx*(offset-9),to.y+ny*(offset-9));
  c.lineTo(to.x+nx*(offset+9),to.y+ny*(offset+9));
  c.moveTo(p.x,p.y);c.lineTo(q.x,q.y);c.stroke();
  drawArrow(c,p,q,9);drawArrow(c,q,p,9);
  const caption=[data.measure?measureDisplay(data.measure,data.unit||item.unit,data.hideUnit):'?',data.text||''].filter(Boolean).join(' · ');
  let angle=Math.atan2(dy,dx);if(angle>Math.PI/2||angle< -Math.PI/2)angle+=Math.PI;
  drawText(caption,{x:(p.x+q.x)/2+(q.x-p.x)*(Number(data.labelT)||0),y:(p.y+q.y)/2+(q.y-p.y)*(Number(data.labelT)||0)},color,fs,angle);
 }
}
else if(item.type==='dimension'||item.type==='chain'||item.type==='cumulative'){if(a&&b){let dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;let nx=-dy/d,ny=dx/d;let off=item.offset??0;let ao={x:a.x+nx*off,y:a.y+ny*off},bo={x:b.x+nx*off,y:b.y+ny*off};c.beginPath();c.moveTo(a.x+nx*(off-11),a.y+ny*(off-11));c.lineTo(a.x+nx*(off+11),a.y+ny*(off+11));c.moveTo(b.x+nx*(off-11),b.y+ny*(off-11));c.lineTo(b.x+nx*(off+11),b.y+ny*(off+11));c.moveTo(ao.x,ao.y);c.lineTo(bo.x,bo.y);c.stroke();drawArrow(c,ao,bo,9);drawArrow(c,bo,ao,9);let label=item.measure?measureDisplay(item.measure,item.unit,item.hideUnit):'?';if(item.text)label+=' · '+item.text;let ang=Math.atan2(dy,dx);if(ang>Math.PI/2||ang< -Math.PI/2)ang+=Math.PI;drawText(label,{x:(ao.x+bo.x)/2+nx*(-Math.max(26,fs*1.5))+(bo.x-ao.x)*(Number(item.labelT)||0),y:(ao.y+bo.y)/2+ny*(-Math.max(26,fs*1.5))+(bo.y-ao.y)*(Number(item.labelT)||0)},color,fs,ang)}}
else if(item.type==='target'){
 if(a){
   c.beginPath();c.arc(a.x,a.y,10,0,Math.PI*2);c.moveTo(a.x-14,a.y);c.lineTo(a.x+14,a.y);
   c.moveTo(a.x,a.y-14);c.lineTo(a.x,a.y+14);c.stroke();
   const text=[item.measure?measureDisplay(item.measure,item.unit,item.hideUnit):'',item.text||''].filter(Boolean).join(' · ');
   if(text)drawText(text,b||{x:a.x+35,y:a.y+12},color,fs);
 }
}
else if(item.type==='line'||item.type==='arrow'||item.type==='angle'){
 if(a&&b){
  seg();
  if(item.type==='arrow')drawArrow(c,b,a,15);
  /* Fixed target has its own drawing branch above. */
  if(item.type==='angle'){
   const degree=(Math.atan2(b.y-a.y,b.x-a.x)*180/Math.PI+360)%360;
   drawText((item.measure||degree.toFixed(0))+(item.hideUnit?'':'°'),{x:(a.x+b.x)/2,y:(a.y+b.y)/2-23},color,fs);
  }else if(item.type==='line'||item.type==='arrow'){
   // Stejný postup pro čáru i šipku: libovolný text a/nebo kóta.
   const label=[item.measure?measureDisplay(item.measure,item.unit,item.hideUnit):'',item.text||''].filter(Boolean).join(' · ');
   if(label){
    const dx=b.x-a.x,dy=b.y-a.y;
    let angle=Math.atan2(dy,dx);
    if(angle>Math.PI/2||angle< -Math.PI/2)angle+=Math.PI;
    const gap=(Number(fs)||17)*.85+4;
    drawText(label,{x:(a.x+b.x)/2+Math.sin(angle)*gap+(b.x-a.x)*(Number(item.labelT)||0),
      y:(a.y+b.y)/2-Math.cos(angle)*gap+(b.y-a.y)*(Number(item.labelT)||0)},color,fs,angle);
   }
  }
 }
}
else if(item.type==='rect'||item.type==='area'){
 const corners=(item.type==='area'?quadCorners(item):rectCorners(item)).map(project);
 if(corners.length===4){
   c.beginPath();c.moveTo(corners[0].x,corners[0].y);
   corners.slice(1).forEach(p=>c.lineTo(p.x,p.y));c.closePath();c.stroke();
   const center={x:corners.reduce((sum,p)=>sum+p.x,0)/4,y:corners.reduce((sum,p)=>sum+p.y,0)/4};
   let measure=item.type==='rect'?'':item.measure;
   if(item.type==='rect'&&item.dimW&&item.dimH){
     const w=Number(String(item.dimW).replace(',','.')),h=Number(String(item.dimH).replace(',','.'));
     if(Number.isFinite(w)&&Number.isFinite(h)&&w>0&&h>0)measure=(w*h/1000000).toFixed(4).replace('.',',');
   }
   if(item.type==='area'){const calculated=quadAreaFromMeasures(item);if(calculated!==null)measure=calculated.toFixed(4).replace('.',',')}
   if(measure)drawText(measure+' m²',center,color,fs);
   if(item.type==='area'){
     if(!item.points?.length){
       if(item.areaWidth)drawText(item.areaWidth+' mm',{x:(corners[0].x+corners[1].x)/2,y:corners[0].y+14},color,Math.max(11,fs*.8));
       if(item.areaHeight)drawText(item.areaHeight+' mm',{x:corners[1].x+20,y:(corners[1].y+corners[2].y)/2},color,Math.max(11,fs*.8));
     }
     corners.forEach((p,i)=>{
       const q=corners[(i+1)%4],info=item.sideMeasures?.[i]||'';
       const txt=[info?info+' mm':'',item.sideTexts?.[i]||''].filter(Boolean).join(' · ');
       const t=Number(item.sideLabelT?.[i])||0;
       if(txt)drawText(txt,{x:(p.x+q.x)/2+(q.x-p.x)*t,y:(p.y+q.y)/2+(q.y-p.y)*t},color,Math.max(11,fs*.8));
     });
   }else{
     const topText=[item.dimW?item.dimW+' mm':'',item.widthText||''].filter(Boolean).join(' · ');
     const rightText=[item.dimH?item.dimH+' mm':'',item.heightText||''].filter(Boolean).join(' · ');
     if(topText){const t=Number(item.rectLabelT?.[0])||0;drawText(topText,{x:(corners[0].x+corners[1].x)/2+(corners[1].x-corners[0].x)*t,y:corners[0].y+14},color,Math.max(11,fs*.8))}
     if(rightText){const t=Number(item.rectLabelT?.[1])||0;drawText(rightText,{x:corners[1].x+20,y:(corners[1].y+corners[2].y)/2+(corners[2].y-corners[1].y)*t},color,Math.max(11,fs*.8))}
     if(item.text)drawText(item.text,{x:center.x,y:center.y+fs*1.5},color,fs);
   }
 }
}
else if(item.type==='ellipse'||item.type==='circle'){
 const g=ellipseGeometry(item),center=project({x:g.cx,y:g.cy});
 const cx=center.x,cy=center.y,rx=g.rx*view.zoom,ry=g.ry*view.zoom;
 c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,Math.PI*2);c.stroke();
 const label=[item.measure?(item.measureKind==='radius'?'R ':'Ø ')+measureDisplay(item.measure,item.unit,item.hideUnit):'',item.text||''].filter(Boolean).join(' · ');
 if(label)drawText(label,{x:cx+Number(item.labelDx||0)*view.zoom,y:cy-28+Number(item.labelDy||0)*view.zoom},color,fs);
}
else if(item.type==='freehand'||item.type==='polyline'){if(pts.length){c.beginPath();c.moveTo(pts[0].x,pts[0].y);for(let p of pts.slice(1))c.lineTo(p.x,p.y);c.stroke();if(item.type==='polyline')for(let i=0;i<pts.length-1;i++){const row=item.segmentData?.[i]||{};const text=[row.measure?measureDisplay(row.measure,row.unit||item.unit,row.hideUnit):'',row.text||''].filter(Boolean).join(' · ');if(text)drawText(text,{x:(pts[i].x+pts[i+1].x)/2+(pts[i+1].x-pts[i].x)*(Number(row.labelT)||0),y:(pts[i].y+pts[i+1].y)/2+(pts[i+1].y-pts[i].y)*(Number(row.labelT)||0)},color,fs,readableSegmentAngle(pts[i],pts[i+1]))}}}
else if(item.type==='note'||item.type==='symbol'){if(a){if(item.type==='note'){drawNoteLeader(c,item,color,render);(noteDisplayedCaption(item,render.exporting)&&drawText(noteDisplayedCaption(item,render.exporting),noteCaptionScreen(item,view),color,fs))}else drawText((item.icon||'⚑')+' '+(item.text||''),a,color,fs)}}
}finally{c.restore();}}
function drawLoupe(){
  if(screen!=='editor'||!current||!magnifierPoint||pointers.size===0){$('loupe').hidden=true;return;}
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
  const zoom=Math.max(1.2,Math.min(6,Number(prefs.loupeZoom)||2));
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
  if(!item||!['dimension','chain','cumulative','line','arrow'].includes(item.type)||!item.a||!item.b||(['chain','cumulative'].includes(item.type)&&item.points?.length>1))return null;
  const a=worldToScreen(item.a),b=worldToScreen(item.b);
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,ux=dx/d,uy=dy/d;
  const angle=Math.atan2(dy,dx),flipped=angle>Math.PI/2||angle< -Math.PI/2;
  const off=['line','arrow'].includes(item.type)?((flipped?1:-1)*((Number(item.fontSize)||Number(prefs.fontSize)||17)*.85+4)):((item.offset??0)-Math.max(26,(Number(item.fontSize)||Number(prefs.fontSize)||17)*1.5)),t=Number(item.labelT)||0;
  return {x:(a.x+b.x)/2-uy*off+dx*t,y:(a.y+b.y)/2+ux*off+dy*t,ux,uy,d};
}
function segmentLineScreen(item,index){return AnnotationGeometry.segmentLineScreen(item,index,view)}
function nearestSegmentLabel(point){
 for(const item of [...(current.items||[])].reverse()){
  if(!['chain','cumulative','polyline','angle','area','rect'].includes(item.type))continue;
  const count=item.type==='area'?4:item.type==='rect'||item.type==='angle'?2:Math.max(0,(item.points?.length||0)-1);
  for(let i=0;i<count;i++){
   const line=segmentLineScreen(item,i);if(!line)continue;
   const row=item.segmentData?.[i]||{},hasCaption=item.type==='area'?
    Boolean(item.sideMeasures?.[i]||item.sideTexts?.[i]):
    item.type==='rect'?Boolean(i===0?(item.dimW||item.widthText):(item.dimH||item.heightText)):
    ['chain','cumulative'].includes(item.type)||Boolean(row.measure||row.text);
   if(!hasCaption)continue;
   const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,d=Math.hypot(dx,dy)||1;
   let x=(line.a.x+line.b.x)/2,y=(line.a.y+line.b.y)/2;
   if(item.type==='angle')y-=18;
   if(item.type==='rect'){if(i===0)y+=14;else x+=20}

   const t=Number(item.type==='area'?item.sideLabelT?.[i]:item.type==='rect'?item.rectLabelT?.[i]:row.labelT)||0;
   x+=dx*t;y+=dy*t;
   if(Math.abs(point.x-x)<Math.max(35,(item.fontSize||17)*2)&&Math.abs(point.y-y)<18)
    return {item,kind:'segment-label',index:i};
  }
 }
 return null;
}
function nearestLabel(point){
  for(const item of [...(current.items||[])].reverse()){
    if(['circle','ellipse'].includes(item.type)&&(item.measure||item.text)){
      const g=ellipseGeometry(item);
      const x=g.cx+(Number(item.labelDx)||0)*view.zoom,y=g.cy-28+(Number(item.labelDy)||0)*view.zoom;
      const label=[item.measure?measureDisplay(item.measure,item.unit,item.hideUnit):'',item.text||''].filter(Boolean).join(' · ');
      ctx.save();ctx.font='600 '+(item.fontSize||prefs.fontSize)+'px sans-serif';
      const width=ctx.measureText(label).width;ctx.restore();
      if(Math.abs(point.x-x)<=Math.max(20,width/2+10)&&Math.abs(point.y-y)<=Math.max(12,(item.fontSize||prefs.fontSize)*.75))
        return {item,kind:'round-label'};
    }
    const p=labelInfo(item);if(!p)continue;
    const along=Math.abs((point.x-p.x)*p.ux+(point.y-p.y)*p.uy);
    const across=Math.abs((point.x-p.x)*(-p.uy)+(point.y-p.y)*p.ux);
    ctx.save();ctx.font='600 '+(item.fontSize||prefs.fontSize)+'px sans-serif';
    const width=ctx.measureText((item.measure?(measureDisplay(item.measure,item.unit,item.hideUnit)):'?')+(item.text?' · '+item.text:'')).width;ctx.restore();
    if(along<=Math.max(28,width/2+15)&&across<=Math.max(11,(item.fontSize||prefs.fontSize)*.65)){
      return {item,kind:'label'};
    }
  }
  return null;
}
function nearestHandle(point,onlyItem=null){
 return AnnotationGeometry.nearestHandle(point,current.items||[],view,onlyItem);
}
function nearestItem(point){
 return AnnotationGeometry.nearestItem(point,current.items||[],view,(item,point)=>{
  const p=item.type==='note'?noteCaptionScreen(item):worldToScreen(item.a);
  const caption=item.type==='symbol'?(item.icon||'⚑')+' '+(item.text||''):noteDisplayedCaption(item);
  ctx.save();ctx.font='600 '+(item.fontSize||prefs.fontSize)+'px sans-serif';
  const width=ctx.measureText(caption).width+22;ctx.restore();
  return Math.abs(point.x-p.x)<width/2+7&&Math.abs(point.y-p.y)<Math.max(23,(item.fontSize||prefs.fontSize)*.9);
 });
}
function hitAnnotation(point){
 // Endpoint grips take priority over captions and the move area, even on
 // first selection. In short segments the middle 40% remains a move zone.
 const activeItem=(current?.items||[]).find(item=>item.id===selected);
 const grip=(activeItem&&nearestHandle(point,activeItem))||nearestHandle(point);
 if(grip)return grip.item;
 const label=nearestLabel(point);
 if(label?.item)return label.item;
 const segment=typeof nearestSegmentLabel==='function'?nearestSegmentLabel(point):null;
 if(segment?.item)return segment.item;
 return nearestItem(point);
}
function selectAnnotation(item){
 if(!item)return;
 window.ensureAnnotationVisible?.(item.type);
 selected=item.id;
 if(mode!=='select')setTool('select',true);
 paint();
}
function completePolyline(kind='polyline',finish=true){
 if(polylineDraft.length<2)return;
 const points=polylineDraft.map(p=>({...p}));
 polylineDraft=[];drawStart=null;drawCurrent=null;stroke=[];magnifierPoint=null;
 const item={id:uid(),type:kind,a:{...points[0]},b:{...points[points.length-1]},
  points,segmentData:points.slice(1).map(()=>({measure:'',text:'',unit:prefs.unit})),color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize,unit:kind==='angle'?'°':prefs.unit,measure:'',text:''};
 checkpoint();current.items.push(item);commitEditor();if(finish)finishDraw(item);updateChainHint();
}
function stageDown(e){
 if(current?.kind==='photo'&&!stageImg)return;
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
  drag=null;drawPointerId=null;drawStart=null;drawCurrent=null;finishHandleGesture(selectedHandle);selectedHandle=null;paint();return;
 }
 if(pointers.size>2){gesture=null;return;} // extra pointer invalidates old pinch anchor
 if(['polyline','chain','cumulative','angle'].includes(mode)){
   const position=snap(screenToWorld(s),polylineDraft[polylineDraft.length-1]||null);
   const last=polylineDraft[polylineDraft.length-1];
   if(mode==='angle'&&polylineDraft.length===2){
    polylineDraft.push({...position});completePolyline('angle');return;
   }
   if(polylineDraft.length>=2&&last&&Math.hypot(position.x-last.x,position.y-last.y)<15/Math.max(.05,view.zoom)){
    const now=Date.now();
    if(lastTapAt&&now-lastTap<480&&Math.hypot(s.x-lastTapAt.x,s.y-lastTapAt.y)<28){
      lastTap=0;lastTapAt=null;completePolyline(mode);
    }else{lastTap=now;lastTapAt={...s}}
    return;
   }
   lastTap=0;lastTapAt=null;
   if(!last||Math.hypot(position.x-last.x,position.y-last.y)>2/Math.max(.05,view.zoom))
    polylineDraft.push({...position});
   drawStart={...polylineDraft[0]};drawCurrent={...position};
   stroke=polylineDraft.map(p=>({...p}));
   magnifierPoint=null;updateChainHint();paint();return;
  }
  const candidate=hitAnnotation(s);
 if(candidate){
  // U řetězců si pamatuj konkrétní úsek, kterého se uživatel dotkl.
  // Další odečet z Bosche vyplní právě tento úsek, nikoli celý řetězec.
  const activeSegment=AnnotationGeometry.nearestEditableSegment(candidate,s,view);
  if(activeSegment!==null)candidate.activeSegmentIndex=activeSegment;
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
  const grip=nearestHandle(s,candidate);
  const label=nearestLabel(s);
  const segmentLabel=typeof nearestSegmentLabel==='function'?nearestSegmentLabel(s):null;
  const hit=AnnotationSelection.dragHandle(candidate,{
   wantsCaption,grip,label,segmentLabel,
   targetCaption:candidate.type==='target'&&candidate.b&&
    Math.hypot(s.x-worldToScreen(candidate.b).x,s.y-worldToScreen(candidate.b).y)<40
  });
   selectedHandle=hit;
  hit.startScreen={...s};
  hit.initialSelection=!alreadySelected;
  if(hit.kind==='point'||hit.kind==='shape-resize')hit.startPoint={...hit.point};
  if(hit.kind==='move-dimension'){
   hit.startA={...candidate.a};
   hit.startB={...candidate.b};
  }
  if(hit.kind==='target-caption')hit.startPoint={...candidate.b};
   if(hit.kind==='note-caption')
   hit.startPoint={...(hit.item.captionMoved&&hit.item.b?hit.item.b:hit.item.a)};
  if(hit.kind==='move-polyline')hit.startPoints=candidate.points.map(p=>({...p}));
  if(hit.kind==='round-label'){
    hit.startLabelDx=Number(hit.item.labelDx)||0;
    hit.startLabelDy=Number(hit.item.labelDy)||0;
   }
   hit.startLabelT=hit.kind==='segment-label'?
    Number(hit.item.type==='area'?hit.item.sideLabelT?.[hit.index]:hit.item.segmentData?.[hit.index]?.labelT)||0:
    Number(hit.item.labelT)||0;
  hit.dragged=false;
  // Selection may update activeSegmentIndex but is not an edit.
  if(['point','shape-resize','label','note-caption','target-caption','segment-label','round-label','move-dimension','move-polyline'].includes(hit.kind))
   hit.beforeDragItems=JSON.stringify(current.items||[]);
  magnifierPoint=hit.kind==='point'?hit.point:null;
  paint();return;
 }
 if(selected!==null){selected=null;paint()}
 if(mode==='select')return;
 if(mode==='pan'){drag={screen:s,dx:view.dx,dy:view.dy};return}
 drawPointerId=e.pointerId;drawStart=mode==='freehand'?boundsPoint(screenToWorld(s)):snap(screenToWorld(s));
 drawCurrent=drawStart;stroke=[drawStart];magnifierPoint=drawStart;paint();
}
function stageMove(e){if(screen!=='editor')return;const s=eventPoint(e);if(!pointers.has(e.pointerId))return;pointers.set(e.pointerId,s);if(pointers.size===2&&gesture){Object.assign(view,AnnotationGeometry.pinchViewport(gesture,[...pointers.values()]));paint();return}
if(['polyline','chain','cumulative','angle'].includes(mode)&&polylineDraft.length&&pointers.size===1){
  drawCurrent=snap(screenToWorld(s),polylineDraft[polylineDraft.length-1]);
  const last=polylineDraft[polylineDraft.length-1];
  stroke=Math.hypot(drawCurrent.x-last.x,drawCurrent.y-last.y)>2/Math.max(.05,view.zoom)?[...polylineDraft,{...drawCurrent}]:polylineDraft.map(p=>({...p}));paint();return;
 }
 if(selectedHandle&&pointers.size===1){
  if(Math.hypot(s.x-selectedHandle.startScreen.x,s.y-selectedHandle.startScreen.y)>7)selectedHandle.dragged=true;
  // Android often sends tiny pointermove events during a tap or double tap.
  // Never mutate annotation coordinates until a real drag is established.
  // Previously the endpoint branch called snap() even below 7 px, silently
  // changing geometry while stageUp discarded the undo checkpoint as a tap.
  if(!selectedHandle.dragged){paint();return;}
  if(selectedHandle.kind==='select-only'||selectedHandle.kind==='open-selected'){
   magnifierPoint=null;paint();return;
  }
  if(selectedHandle.kind==='move-polyline'){
     if(selectedHandle.dragged){
      const delta={x:s.x-selectedHandle.startScreen.x,y:s.y-selectedHandle.startScreen.y};
      const translated=AnnotationTranslation.translatedPolyline(selectedHandle.startPoints,delta,view,photoSize);
      selectedHandle.item.points=translated.points;
      selectedHandle.item.a=translated.a;
      selectedHandle.item.b=translated.b;
     }
     magnifierPoint=null;
  }else if(selectedHandle.kind==='move-dimension'){
    if(selectedHandle.dragged){
      const delta={x:s.x-selectedHandle.startScreen.x,y:s.y-selectedHandle.startScreen.y};
      const translated=AnnotationTranslation.translatedEndpoints(selectedHandle.startA,selectedHandle.startB,delta,view,photoSize);
      selectedHandle.item.a=translated.a;
      selectedHandle.item.b=translated.b;
    }
    magnifierPoint=null;
  }else if(selectedHandle.kind==='shape-resize'){
   if(selectedHandle.dragged){
    const item=selectedHandle.item,index=selectedHandle.pointIndex;
    const origin=worldToScreen(selectedHandle.startPoint);
    const target=boundsPoint(screenToWorld({x:origin.x+s.x-selectedHandle.startScreen.x,y:origin.y+s.y-selectedHandle.startScreen.y}));
    const resized=AnnotationResize.resizedShape(item,index,target,AnnotationGeometry);
    if(resized.points)item.points=resized.points;
    item.a=resized.a;item.b=resized.b;
   }
   if(selectedHandle.dragged){
    const item=selectedHandle.item;
    if(item.type==='rect'){
     const origin=worldToScreen(selectedHandle.startPoint);
     magnifierPoint=boundsPoint(screenToWorld({x:origin.x+s.x-selectedHandle.startScreen.x,y:origin.y+s.y-selectedHandle.startScreen.y}));
    }else magnifierPoint={...resizePoints(item)[selectedHandle.pointIndex]};
   }else magnifierPoint=null;
  }else if(selectedHandle.kind==='target-caption'){
   const origin=worldToScreen(selectedHandle.startPoint);
   selectedHandle.item.b=boundsPoint(screenToWorld({x:origin.x+s.x-selectedHandle.startScreen.x,y:origin.y+s.y-selectedHandle.startScreen.y}));
   magnifierPoint=null;
  }else if(selectedHandle.kind==='note-caption'){
    const origin=worldToScreen(selectedHandle.startPoint);
    selectedHandle.item.b=screenToWorld({
      x:origin.x+s.x-selectedHandle.startScreen.x,
      y:origin.y+s.y-selectedHandle.startScreen.y
    });
    selectedHandle.item.captionMoved=true;
    magnifierPoint=null;
  }else if(selectedHandle.kind==='round-label'){
    selectedHandle.item.labelDx=selectedHandle.startLabelDx+(s.x-selectedHandle.startScreen.x)/view.zoom;
    selectedHandle.item.labelDy=selectedHandle.startLabelDy+(s.y-selectedHandle.startScreen.y)/view.zoom;
    magnifierPoint=null;
  }else if(selectedHandle.kind==='segment-label'){
    const item=selectedHandle.item,index=selectedHandle.index,line=segmentLineScreen(item,index);
    if(line){
     const dx=line.b.x-line.a.x,dy=line.b.y-line.a.y,den=dx*dx+dy*dy||1;
     const delta=((s.x-selectedHandle.startScreen.x)*dx+(s.y-selectedHandle.startScreen.y)*dy)/den;
     const t=Math.max(-.9,Math.min(.9,selectedHandle.startLabelT+delta));
     if(item.type==='area'){
      if(!Array.isArray(item.sideLabelT))item.sideLabelT=[0,0,0,0];
      item.sideLabelT[index]=t;
     }else if(item.type==='rect'){
      if(!Array.isArray(item.rectLabelT))item.rectLabelT=[0,0];
      item.rectLabelT[index]=t;
     }else{
      if(!Array.isArray(item.segmentData))item.segmentData=[];
      item.segmentData[index]={...(item.segmentData[index]||{}),labelT:t};
     }
    }
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
    // Do not allow a snapped endpoint to collapse a measured line or one
    // segment onto its neighbour. Such a zero-length annotation can disappear.
    const selectedItem=selectedHandle.item;
    const adjacent=Number.isInteger(selectedHandle.pointIndex)?
     [selectedItem.points?.[selectedHandle.pointIndex-1],
      selectedItem.points?.[selectedHandle.pointIndex+1]]:
     ['dimension','line','arrow','chain','cumulative'].includes(selectedItem.type)?
      [selectedItem[selectedHandle.key==='a'?'b':'a']]:[];
    const minLength=8/Math.max(.05,view.zoom);
    if(adjacent.some(other=>other&&Math.hypot(movedPoint.x-other.x,movedPoint.y-other.y)<minLength)){
     magnifierPoint=null;paint();return;
    }
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
 if(screen!=='editor'||!pointers.has(e.pointerId))return;
 const wasTwo=pointers.size===2;
 pointers.delete(e.pointerId);
 if(wasTwo){
  gesture=null;drawStart=null;drawCurrent=null;
  magnifierPoint=null;loupeSide=null;paint();return;
 }
 if(['polyline','chain','cumulative','angle'].includes(mode)&&polylineDraft.length){stroke=polylineDraft.map(p=>({...p}));magnifierPoint=null;paint();return;}
 if(selectedHandle){
  const handle=selectedHandle,item=handle.item,moved=handle.dragged;
  selectedHandle=null;magnifierPoint=null;loupeSide=null;
  if(handle.kind==='select-only'){paint();return}
  if(!moved){
   if(handle.initialSelection){paint();return}
   // Druhé samostatné klepnutí otevře úpravu bez časového limitu.
   editItem(item);
  }else if(['point','shape-resize','label','note-caption','target-caption','segment-label','round-label','move-dimension','move-polyline'].includes(handle.kind)){
   if(!finishHandleGesture(handle))paint();
  }else paint();
  return;
 }
 if(drag){drag=null;return}if(!drawStart||drawPointerId!==e.pointerId)return;const a=drawStart,b=drawCurrent||drawStart;drawStart=null;drawCurrent=null;magnifierPoint=null;loupeSide=null;drawPointerId=null;if(Math.hypot(a.x-b.x,a.y-b.y)<3/view.zoom&&mode!=='note'&&mode!=='symbol'&&mode!=='target'){paint();return}if(mode==='target'&&Math.hypot(a.x-b.x,a.y-b.y)<3/view.zoom)b={x:a.x+36/view.zoom,y:a.y+12/view.zoom};let item={id:uid(),type:mode,a,b,color:prefs.color,width:prefs.lineWidth,fontSize:prefs.fontSize,unit:mode==='area'?'m²':prefs.unit,measure:'',text:'',points:(mode==='freehand'||mode==='polyline')?[...stroke]:[]};stroke=[];
if(mode==='area'){item.points=rectCorners(item);item.sideMeasures=['','','',''];item.sideTexts=['','','',''];}
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
// Annotation forms: Back asks what to do with edits; explicit Zrušit always discards.
function protectAnnotationModalOnBack(){
 const body=$('modalBody');
 const ignored=new Set(['insertSegmentAt','removeSegmentAt','boschReadingSelection','simpleBOSCH']);
 const snapshot=()=>JSON.stringify(Array.from(body.querySelectorAll('input,textarea,select'))
  .filter(el=>!ignored.has(el.id)&&!el.matches('[data-segment-reading],[data-area-reading],[data-angle-reading]'))
  .map(el=>[el.id,el.type==='checkbox'?el.checked:el.value]));
 const original=snapshot();
 window.modalBackHandler=()=>{
  const existing=document.getElementById('editorUnsavedConfirm');
  if(existing){existing.remove();return}
  if(snapshot()===original){$('cancelModal').click();return}
  const confirmation=document.createElement('div');
  confirmation.id='editorUnsavedConfirm';
  confirmation.className='modal';
  confirmation.style.zIndex='120';
  confirmation.innerHTML='<div class="dialog" role="alertdialog" aria-modal="true" aria-label="Neuložené změny">'+
   '<div class="dialogTitle">Uložit změny?</div>'+
   '<p>Upravil jsi rozměry nebo popisky. Co chceš udělat?</p>'+
   '<div class="dialogActions" style="flex-wrap:wrap">'+
   '<button type="button" id="keepAnnotationEditing" class="outline">Pokračovat v úpravách</button>'+
   '<button type="button" id="discardAnnotationEdits" class="outline danger">Zahodit</button>'+
   '<button type="button" id="saveAnnotationEdits" class="primary">Uložit</button></div></div>';
  document.body.append(confirmation);
  confirmation.querySelector('#keepAnnotationEditing').onclick=()=>confirmation.remove();
  confirmation.querySelector('#discardAnnotationEdits').onclick=()=>{$('cancelModal').click();confirmation.remove()};
  confirmation.querySelector('#saveAnnotationEdits').onclick=()=>{confirmation.remove();$('okModal').click()};
  confirmation.querySelector('#saveAnnotationEdits').focus();
 };
}
function editSegmentedItem(item){
 const count=item.points.length-1;
 const saved=Array.from({length:count},(_,i)=>item.segmentData?.[i]||{measure:'',text:'',unit:item.unit||prefs.unit});
 const readings=window.__boschHistoryReadings?.()||[];
 const header=item.type==='chain'?'Dimenzní řetězec':item.type==='cumulative'?'Kumulativní řetězec':'Lomená čára';
 const fields=saved.map((row,i)=>{
  const selectedUnit=row.hideUnit?'none':(row.unit||item.unit||prefs.unit);
  const readingField=readings.length?'<select data-segment-reading="'+i+'"><option value="">Použít hodnotu z laseru…</option>'+
   readings.slice(0,30).map((reading,index)=>'<option value="'+index+'">'+escapeHtml(reading.value)+' '+escapeHtml(reading.unit)+'</option>').join('')+'</select>':'';
  return '<div class="segment-row"><strong>'+(item.type==='cumulative'?'Od začátku k bodu ':'Úsek ')+(i+1)+'</strong>'+
   '<label>Rozměr</label><div class="measure-with-unit"><input id="segmentMeasure'+i+'" type="text" value="'+escapeHtml(row.measure||'')+'" placeholder="Hodnota z laseru nebo ručně">'+
   '<select aria-label="Jednotka úseku" id="segmentUnit'+i+'"><option value="none" '+(selectedUnit==='none'?'selected':'')+'>Bez jednotky</option>'+['mm','cm','m','in'].map(u=>'<option '+(u===selectedUnit?'selected':'')+'>'+u+'</option>').join('')+'</select></div>'+
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
  const previous=target.segmentData||[];
  target.segmentData=Array.from({length:count},(_,i)=>{
   const chosen=$('segmentUnit'+i).value;
   return {
    measure:$('segmentMeasure'+i).value.trim(),
    text:$('segmentText'+i).value.trim(),
    // The real unit is retained for Bosch readings; only the visible suffix is hidden.
    unit:chosen==='none'?(previous[i]?.unit||target.unit||prefs.unit):chosen,
    hideUnit:chosen==='none'
   };
  });
 }
 for(let i=0;i<count;i++)for(const prefix of ['segmentMeasure','segmentText','segmentUnit'])$(prefix+i).onfocus=()=>{item.activeSegmentIndex=i};
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
 protectAnnotationModalOnBack();
}
// Refresh the currently open history picker as soon as Bosch delivers a value.
function refreshOpenBoschHistory(){
 const chooser=$('boschReadingSelection');
 if(!chooser||$('modal').hidden)return;
 const history=window.__boschHistoryReadings?.()||[];
 chooser.innerHTML='<option value="">Vybrat naměřenou hodnotu…</option>'+
  history.slice(0,40).map((reading,index)=>
   '<option value="'+index+'">'+escapeHtml(reading.value)+' '+escapeHtml(reading.unit)+
   ' · '+escapeHtml(new Date(reading.time).toLocaleTimeString('cs-CZ'))+'</option>').join('');
 chooser.value='';
}
window.__refreshOpenBoschHistory=refreshOpenBoschHistory;
function editItem(item){
 if(['polyline','chain','cumulative'].includes(item.type)&&item.points?.length>1){editSegmentedItem(item);return}
 if(item.type==='area'){
  const sides=Array.isArray(item.sideMeasures)?item.sideMeasures:['','','',''];
  const captions=Array.isArray(item.sideTexts)?item.sideTexts:['','','',''];
  const readings=window.__boschHistoryReadings?.()||[];
  const labels=['Horní','Pravá','Dolní','Levá'];
  const fields=labels.map((name,i)=>
    '<div class="segment-row"><strong>'+name+' strana</strong><label>Rozměr (mm)</label><input id="areaSide'+i+'" value="'+escapeHtml(sides[i]||'')+'">'+
    (readings.length?'<select data-area-reading="'+i+'"><option value="">Vybrat hodnotu Bosch…</option>'+
      readings.slice(0,40).map((r,j)=>'<option value="'+j+'">'+escapeHtml(r.value+' '+r.unit)+'</option>').join('')+'</select>':'')+
    '<label>Popisek strany</label><input id="areaText'+i+'" value="'+escapeHtml(captions[i]||'')+'"></div>').join('');
  modal('Lichoběžník – čtyři strany',
   '<p>Každý roh můžeš přesunout zvlášť. Přesný obsah vyžaduje také úhlopříčku mezi horním levým a dolním pravým rohem.</p>'+fields+
   '<label>Úhlopříčka (mm)</label><input id="areaDiagonal" value="'+escapeHtml(item.diagonal||'')+'">'+
   '<label>Obsah (m²) – ručně, není-li měřena úhlopříčka</label><input id="areaMeasure" value="'+escapeHtml(item.measure||'')+'">'+
   '<button id="removeItem" class="outline">Smazat lichoběžník</button>',
   ()=>{
     const values=labels.map((_,i)=>$('areaSide'+i).value.trim()),diag=$('areaDiagonal').value.trim();
     const computed=quadAreaFromMeasures({sideMeasures:values,diagonal:diag});
     if(diag&&computed===null){notify('Rozměry a úhlopříčka netvoří platný čtyřúhelník');return false}
     checkpoint();item.points=quadCorners(item).map(p=>({...p}));
     item.sideMeasures=values;item.sideTexts=labels.map((_,i)=>$('areaText'+i).value.trim());
     item.diagonal=diag;item.measure=computed!==null?String(Number(computed.toFixed(5))).replace('.',','):$('areaMeasure').value.trim();
     item.unit='m²';commitEditor();
   },'Uložit');
  $('modalBody').querySelectorAll('[data-area-reading]').forEach(el=>el.onchange=()=>{
    if(el.value==='')return;
    const reading=readings[Number(el.value)],i=Number(el.dataset.areaReading),factor={mm:1,cm:10,m:1000,in:25.4};
    if(reading&&factor[reading.unit])$('areaSide'+i).value=String(Number(String(reading.value).replace(',','.'))*factor[reading.unit]).replace('.',',');
  });
  labels.forEach((_,i)=>$('areaSide'+i).onfocus=()=>{item.activeSegmentIndex=i});
  $('removeItem').onclick=()=>{checkpoint();current.items=current.items.filter(x=>x.id!==item.id);selected=null;$('modal').hidden=true;commitEditor()};
  protectAnnotationModalOnBack();
  return;
 }
 if(item.type==='angle'&&item.points?.length>=3){
  const readings=window.__boschHistoryReadings?.()||[];
  const old=item.segmentData||[{},{}];
  const fields=[0,1].map(i=>'<div class="segment-row"><strong>Rameno '+(i+1)+'</strong><label>Délka (mm)</label><input id="angleLength'+i+'" value="'+escapeHtml(old[i]?.measure||'')+'"><label>Popisek ramene</label><input id="angleText'+i+'" value="'+escapeHtml(old[i]?.text||'')+'">'+
    (readings.length?'<select data-angle-reading="'+i+'"><option value="">Vybrat z historie Bosch…</option>'+readings.slice(0,40).map((r,j)=>'<option value="'+j+'">'+escapeHtml(r.value+' '+r.unit)+'</option>').join('')+'</select>':'')+'</div>').join('');
  modal('Úhel – stupně a obě ramena','<p>Stupně se počítají automaticky z tří bodů. Každé rameno má vlastní měřenou délku.</p>'+fields+
   '<button id="removeItem" class="outline">Smazat úhel</button>',
   ()=>{checkpoint();item.segmentData=[0,1].map(i=>({measure:$('angleLength'+i).value.trim(),text:$('angleText'+i).value.trim(),unit:'mm'}));commitEditor()},'Uložit');
  $('modalBody').querySelectorAll('[data-angle-reading]').forEach(el=>el.onchange=()=>{
    const r=readings[Number(el.value)],i=Number(el.dataset.angleReading),unit={mm:1,cm:10,m:1000,in:25.4};
    if(el.value!==''&&r&&unit[r.unit])$('angleLength'+i).value=String(Number(String(r.value).replace(',','.'))*unit[r.unit]).replace('.',',');
  });
  [0,1].forEach(i=>$('angleLength'+i).onfocus=()=>{item.activeSegmentIndex=i});
  $('removeItem').onclick=()=>{checkpoint();current.items=current.items.filter(x=>x.id!==item.id);selected=null;$('modal').hidden=true;commitEditor()};
  protectAnnotationModalOnBack();
  return;
 }
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
   '<label>Rozměr</label><div class="measure-with-unit"><input id="measureInput" type="text" value="'+escapeHtml(item.measure||'')+'">'+
   '<select aria-label="Jednotka rozměru" id="measureUnit"><option value="none" '+(item.hideUnit?'selected':'')+'>Bez jednotky</option>'+['mm','cm','m','in','m²','°'].map(u=>'<option '+(!item.hideUnit&&u===(item.unit||prefs.unit)?'selected':'')+'>'+u+'</option>').join('')+'</select></div>'+
   historyMarkup+
   '<label>Popisek ke kótě (volitelné)</label><input id="dimensionCaption" value="'+escapeHtml(item.text||'')+'" placeholder="Např. přívod vody">'+
   '<div class="row wrap"><button id="removeItem" class="outline">Smazat kótu</button></div>',
   ()=>{checkpoint();item.measure=$('measureInput').value;const unit=$('measureUnit').value;item.hideUnit=unit==='none';if(!item.hideUnit)item.unit=unit;else if(!item.unit)item.unit=prefs.unit;item.text=$('dimensionCaption').value.trim();commitEditor()}
  );
  const chooser=$('boschReadingSelection');
  if(chooser)chooser.onchange=()=>{
   // The list can be refreshed during an open dialog by a new Bluetooth reading.
   const history=window.__boschHistoryReadings?.()||[];
   const index=Number(chooser.value);
   if(chooser.value===''||!history[index])return;
   $('measureInput').value=history[index].value;
   $('measureUnit').value=history[index].unit;
  };
 }else if(['line','arrow','circle','ellipse','rect','target'].includes(item.type)){
  const kind=item.type;
  const isRound=kind==='circle'||kind==='ellipse';
  const roundFields=isRound?'<label>Značení rozměru</label><select id="measureKind"><option value="diameter">Ø Průměr</option><option value="radius">R Poloměr</option></select>':'';
  const rectFields=kind==='rect'?'<label>Šířka (mm)</label><input id="rectWidth" type="text" value="'+escapeHtml(item.dimW||'')+'"><label>Text k šířce</label><input id="rectWidthText" value="'+escapeHtml(item.widthText||'')+'"><label>Výška (mm)</label><input id="rectHeight" type="text" value="'+escapeHtml(item.dimH||'')+'"><label>Text k výšce</label><input id="rectHeightText" value="'+escapeHtml(item.heightText||'')+'">':'';
  const history=window.__boschHistoryReadings?.()||[];
  const historyField=history.length?'<label>Historie měření Bosch</label><select id="simpleBOSCH"><option value="">Vybrat naměřenou hodnotu…</option>'+
    history.slice(0,40).map((r,i)=>'<option value="'+i+'">'+escapeHtml(r.value+' '+r.unit)+'</option>').join('')+'</select>':'';
  modal(kind==='line'?'Upravit čáru':kind==='arrow'?'Upravit šipku':kind==='rect'?'Upravit obdélník':'Upravit tvar',
   (kind==='rect'?'':'<label>'+(isRound?'Rozměr kruhu / elipsy':'Kóta / rozměr (volitelné)')+'</label><div class="measure-with-unit"><input id="measureInput" type="text" value="'+escapeHtml(item.measure||'')+'" placeholder="Např. 1250">'+
   '<select aria-label="Jednotka rozměru" id="measureUnit"><option value="none" '+(item.hideUnit?'selected':'')+'>Bez jednotky</option>'+['mm','cm','m','in'].map(u=>'<option '+(!item.hideUnit&&u===(item.unit||prefs.unit)?'selected':'')+'>'+u+'</option>').join('')+'</select></div>')+
   roundFields+rectFields+(kind==='rect'?'<small id="rectBoschTarget">Bosch → šířka (mm). Klepnutím do šířky nebo výšky zvolíš cíl měření.</small>':'')+historyField+
   '<label>Textový popisek</label><input id="drawText" value="'+escapeHtml(item.text||'')+'" placeholder="Např. přívod vody">'+
   '<div class="row"><button id="removeItem" class="outline">Smazat prvek</button></div>',
   ()=>{checkpoint();if(kind!=='rect'){item.measure=$('measureInput').value.trim();const unit=$('measureUnit').value;item.hideUnit=unit==='none';if(!item.hideUnit)item.unit=unit;else if(!item.unit)item.unit=prefs.unit}item.text=$('drawText').value.trim();
     if(isRound)item.measureKind=$('measureKind').value;
     if(kind==='rect'){item.dimW=$('rectWidth').value.trim();item.dimH=$('rectHeight').value.trim();item.widthText=$('rectWidthText').value.trim();item.heightText=$('rectHeightText').value.trim()}
     commitEditor();
   }
  );
  if(isRound)$('measureKind').value=item.measureKind||'diameter';
  const chooser=$('simpleBOSCH');
  if(chooser)chooser.onchange=()=>{
    if(chooser.value==='')return;
    const r=history[Number(chooser.value)];
    if(r){
      if(kind==='rect'){
       const factor={mm:1,cm:10,m:1000,in:25.4};
       const field=item.activeSegmentIndex===1?'rectHeight':'rectWidth';
       if(factor[r.unit])$(field).value=String(Number(String(r.value).replace(',','.'))*factor[r.unit]).replace('.',',');
      }else{$('measureInput').value=r.value;$('measureUnit').value=r.unit}
    }
  };
  if(kind==='rect'){
    const setTarget=index=>{item.activeSegmentIndex=index;$('rectBoschTarget').textContent='Bosch → '+(index===0?'šířka':'výška')+' (mm). Klepnutím do šířky nebo výšky zvolíš cíl měření.'};
    for(const id of ['rectWidth','rectWidthText'])$(id).onfocus=()=>setTarget(0);
    for(const id of ['rectHeight','rectHeightText'])$(id).onfocus=()=>setTarget(1);
    setTarget(item.activeSegmentIndex===1?1:0);
  }
 }else if(item.type==='note'){openRichNote(item,false);return}
 else modal('Upravit prvek',
  '<label>Text</label><input id="drawText" value="'+escapeHtml(item.text||'')+'"><div class="row"><button id="removeItem" class="outline">Smazat prvek</button></div>',
  ()=>{checkpoint();item.text=$('drawText').value;commitEditor()}
 );
 $('removeItem').onclick=()=>{checkpoint();current.items=current.items.filter(i=>i.id!==item.id);selected=null;$('modal').hidden=true;commitEditor()};
 protectAnnotationModalOnBack();
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
    <label>Barva vybraného prvku</label><input id="styleColor" type="color" value="${escapeHtml(item?.color||prefs.color)}">
    <div class="muted">${item?'Styl vybraného prvku':'Výchozí styl pro nové prvky'}</div>`,()=>{
      const w=Math.max(1,Math.min(15,Number($('styleWidth').value)||2));
      const fs=Math.max(8,Math.min(80,Number($('styleFont').value)||17));
      const color=$('styleColor').value;
      if(item){checkpoint();item.width=w;item.fontSize=fs;item.color=color;commitEditor()}
      else{prefs.lineWidth=w;prefs.fontSize=fs;prefs.color=color;save();paint()}
  });
};
stageCanvas.addEventListener('pointerdown',stageDown);stageCanvas.addEventListener('pointermove',stageMove);stageCanvas.addEventListener('pointerup',stageUp);stageCanvas.addEventListener('pointercancel',e=>{if(screen!=='editor'||!pointers.has(e.pointerId))return;pointers.delete(e.pointerId);gesture=null;drag=null;drawPointerId=null;magnifierPoint=null;drawStart=null;drawCurrent=null;finishHandleGesture(selectedHandle);selectedHandle=null;paint()});stageCanvas.addEventListener('wheel',e=>{e.preventDefault();const p=eventPoint(e);zoomAt(e.deltaY<0?1.1:.9,p.x,p.y)},{passive:false});
$('exportBtn').onclick=()=>{modal('Export',`<div class="row wrap"><button id="exportPng" class="outline">Export PNG</button><button id="exportPdf" class="outline">Export PDF</button></div><div class="muted">Originální soubor a editovatelné kóty se zachovávají zvlášť.</div>`,()=>true,'Zavřít');$('exportPng').onclick=()=>{exportPng();$('modal').hidden=true};$('exportPdf').onclick=()=>{if(native)Native.printPdf();else window.print();$('modal').hidden=true}};
function exportPng(){let o=document.createElement('canvas');o.width=photoSize.w;o.height=photoSize.h;let c=o.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,o.width,o.height);if(stageImg)c.drawImage(stageImg,0,0,o.width,o.height);const render=annotationRenderContext(c,{view:{zoom:1,dx:0,dy:0},viewport:{w:o.width,h:o.height},selected:null,exporting:true});for(let item of current.items||[])drawItem(c,item,render);const data=o.toDataURL('image/png');if(native)Native.exportPng((current.title||'zamerovani')+'.png',data.slice(data.indexOf(',')+1));else{let a=document.createElement('a');a.download='zamerovani.png';a.href=data;a.click()}notify('Export obrázku připraven')}
