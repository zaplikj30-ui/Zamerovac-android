/* Ručně kreslené skici v poznámce – S Pen / stylus / prst, lokální JSON. */
'use strict';
window.setupNoteSketch=function(record){
 let wrapper=$('noteSketchBlock');
 if(!wrapper){
  wrapper=document.createElement('section');wrapper.id='noteSketchBlock';
  wrapper.innerHTML='<div class="divider"></div><button id="toggleSketch" class="outline">✍ Skica S Pen / kreslení</button>'+
  '<div id="sketchTools" hidden><p class="muted">Skica se ukládá automaticky s poznámkou a synchronizuje se jako editovatelná data.</p>'+
  '<div class="row wrap"><button data-pen="#f4f4f6" class="outline">Bílá</button><button data-pen="#f7dc27" class="outline">Žlutá</button><button data-pen="#a78bfa" class="outline">Fialová</button><button data-pen="#171720" class="outline">Guma</button></div>'+
  '<canvas id="sketchCanvas" width="1000" height="580" aria-label="Kreslicí plocha pro S Pen"></canvas>'+
  '<div class="row wrap"><button class="outline" id="undoSketch">↶ Zpět</button><button class="outline" id="clearSketch">Vymazat skicu</button><button class="outline" id="exportSketch">Export PNG</button></div></div>';
  document.querySelector('.note-body').append(wrapper);
 }
 const canvas=$('sketchCanvas'),brush=canvas.getContext('2d');
 let color='#f4f4f6',isDrawing=false,active=null,sketchRecord=record;
 if(!Array.isArray(sketchRecord.sketchStrokes))sketchRecord.sketchStrokes=[];
 const locked=!!window.isRecordLocked?.(record);
 function draw(){
  brush.fillStyle='#171720';brush.fillRect(0,0,canvas.width,canvas.height);
  for(const stroke of sketchRecord.sketchStrokes){
   if(!Array.isArray(stroke.points)||!stroke.points.length)continue;
   brush.strokeStyle=stroke.color||'#fff';brush.lineWidth=stroke.width||4;
   brush.lineCap='round';brush.lineJoin='round';brush.beginPath();
   brush.moveTo(stroke.points[0].x,stroke.points[0].y);
   if(stroke.points.length===1)brush.lineTo(stroke.points[0].x+.1,stroke.points[0].y+.1);
   else for(const p of stroke.points.slice(1))brush.lineTo(p.x,p.y);
   brush.stroke();
  }
 }
 function point(e){
  const rect=canvas.getBoundingClientRect();
  return {x:Math.max(0,Math.min(1000,(e.clientX-rect.left)*canvas.width/rect.width)),
          y:Math.max(0,Math.min(580,(e.clientY-rect.top)*canvas.height/rect.height))};
 }
 $('toggleSketch').onclick=()=>{
  $('sketchTools').hidden=!$('sketchTools').hidden;
  if(!$('sketchTools').hidden)draw();
 };
 wrapper.querySelectorAll('[data-pen]').forEach(b=>b.onclick=()=>{
  color=b.dataset.pen;
  wrapper.querySelectorAll('[data-pen]').forEach(x=>x.classList.toggle('activePen',x===b));
 });
 canvas.onpointerdown=e=>{
  if(locked)return;
  e.preventDefault();canvas.setPointerCapture(e.pointerId);isDrawing=true;
  active={color,width:e.pointerType==='pen'&&e.pressure>0?Math.max(2,Math.round(e.pressure*8)):4,points:[point(e)]};
  sketchRecord.sketchStrokes.push(active);draw();
 };
 canvas.onpointermove=e=>{
  if(!isDrawing||!active||locked)return;
  e.preventDefault();active.points.push(point(e));draw();
 };
 function stop(){
  if(!isDrawing||locked)return;
  isDrawing=false;active=null;touch(sketchRecord);save();
 }
 canvas.onpointerup=stop;canvas.onpointercancel=stop;
 $('undoSketch').onclick=()=>{if(locked)return;sketchRecord.sketchStrokes.pop();touch(sketchRecord);save();draw()};
 $('clearSketch').onclick=()=>{if(locked)return;modal('Vymazat skicu?','<p>Vymažou se pouze čáry skici této poznámky, ne ostatní přílohy.</p>',()=>{
  sketchRecord.sketchStrokes=[];touch(sketchRecord);save();draw();
 },'Vymazat')};
 $('exportSketch').onclick=()=>{
  const png=canvas.toDataURL('image/png');
  const name=(sketchRecord.title||'skica').replace(/[^a-zA-Z0-9À-ž _-]/g,'_')+'.png';
  if(native)Native.exportPng(name,png.split(',')[1]);
  else{const a=document.createElement('a');a.href=png;a.download=name;a.click()}
 };
 $('undoSketch').disabled=locked;$('clearSketch').disabled=locked;
 draw();
};
