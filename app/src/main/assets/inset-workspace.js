/* Zaměřovač: volná pracovní plocha a detail fotografie s přemístitelnou šipkou.
   Původní fotografii ani editovatelné kóty neměníme.
   Dvě samostatné souřadnice: a = počátek šipky na hlavní fotce;
   insetX/Y = pozice detailní fotografie i mimo hranice hlavní fotky.
 */
'use strict';
(function(){
 let active=null;
 const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
 const pointerDistance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
 function photoItems(){
  return (current?.items||[]).filter(it=>it.type==='note'&&it.media?.length&&
    window.__detailPhotoCache?.[it.media[0]]?.naturalWidth);
 }
 function layout(it,image){
  const zoom=view.zoom;
  const w=clamp(Number(it.insetWidth)||220,70,1500)*zoom;
  const h=w*image.naturalHeight/image.naturalWidth;
  const anchor=worldToScreen(it.a||{x:0,y:0});
  // Původní poznámky zůstanou na svém místě.
  // Výchozí vložený obrázek nesmí začínat mimo dostupný displej.
  const initialX=clamp(anchor.x+8,8,Math.max(8,stageCanvas.clientWidth-w-8));
  const initialY=clamp(anchor.y+23,8,Math.max(8,stageCanvas.clientHeight-h-8));
  const x=Number.isFinite(it.insetX)?it.insetX*zoom+view.dx:initialX;
  const y=Number.isFinite(it.insetY)?it.insetY*zoom+view.dy:initialY;
  return {x,y,w,h,anchor,cx:x+w/2,cy:y+h/2,angle:(Number(it.insetRotation)||0)*Math.PI/180};
 }
 function unrotate(p,g){
  const dx=p.x-g.cx,dy=p.y-g.cy;
  return {x:dx*Math.cos(g.angle)+dy*Math.sin(g.angle),y:-dx*Math.sin(g.angle)+dy*Math.cos(g.angle)};
 }
 function turn(p,g){
  const x=p.x*Math.cos(g.angle)-p.y*Math.sin(g.angle);
  const y=p.x*Math.sin(g.angle)+p.y*Math.cos(g.angle);
  return {x:g.cx+x,y:g.cy+y};
 }
 function nearestEdgePoint(g){
  const anchor=unrotate(g.anchor,g);
  const ray={x:anchor.x,y:anchor.y};
  const limit=Math.min(g.w/2/(Math.abs(ray.x)||0.0001),g.h/2/(Math.abs(ray.y)||0.0001));
  return turn({x:ray.x*limit,y:ray.y*limit},g);
 }
 function connector(ctx,g){
  const end=nearestEdgePoint(g);
  const start=g.anchor;
  if(pointerDistance(start,end)<15)return;
  const angle=Math.atan2(end.y-start.y,end.x-start.x);
  const size=11;
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#f7dc27';ctx.fillStyle='#f7dc27';
  ctx.lineWidth=2.8;
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(end.x,end.y);
  ctx.lineTo(end.x-size*Math.cos(angle-.55),end.y-size*Math.sin(angle-.55));
  ctx.lineTo(end.x-size*Math.cos(angle+.55),end.y-size*Math.sin(angle+.55));
  ctx.closePath();ctx.fill();
  ctx.restore();
 }
 function handle(ctx,p,label,selected){
  ctx.save();
  ctx.fillStyle=selected?'#fff8ef':'#f7dc27';
  ctx.strokeStyle='#3a343c';ctx.lineWidth=2;
  ctx.beginPath();ctx.arc(p.x,p.y,selected?10:7,0,Math.PI*2);ctx.fill();ctx.stroke();
  if(label){ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
    ctx.fillStyle='#231a30';ctx.fillText(label,p.x,p.y+1)}
  ctx.restore();
 }
 // Rotace zobrazená jako dvě lehké šipky nad obrázkem, ne nové tlačítko v kolečku.
 function rotationHandle(c,p,g){
  c.save();c.translate(p.x,p.y);c.rotate(g.angle);
  c.lineCap='round';c.lineJoin='round';
  c.strokeStyle='rgba(255,255,255,.88)';c.fillStyle='rgba(255,255,255,.88)';
  c.shadowColor='rgba(0,0,0,.7)';c.shadowBlur=4;c.lineWidth=2.7;
  for(const side of [-1,1]){
   const a=side*3,b=side*17;
   c.beginPath();c.moveTo(a,0);c.lineTo(b,0);c.stroke();
   c.beginPath();c.moveTo(b,0);c.lineTo(b-side*7,-6);c.lineTo(b-side*7,6);c.closePath();c.fill();
  }
  c.restore();
 }
 function labelPosition(it,g){
  const base=it.b||it.a||{x:0,y:0};
  const p=worldToScreen(base);
  return it.captionMoved?p:{x:p.x+45,y:p.y-23};
 }
 function labelRect(c,it,g){
  const text=String(it.text||'Klikněte pro zadání textu').trim();
  const p=labelPosition(it,g),fs=Number(it.fontSize)||Math.max(14,Number(prefs.fontSize)||17);
  c.font='500 '+fs+'px sans-serif';
  const width=clamp(c.measureText(text).width+18,88,Math.max(88,stageCanvas.clientWidth-20));
  return {x:p.x-width/2,y:p.y-fs/2-7,w:width,h:fs+15,p,text,fs};
 }
 function renderLabel(c,it,g){
  const box=labelRect(c,it,g);
  if(!box)return;
  c.save();c.fillStyle='rgba(23,24,27,.8)';
  c.strokeStyle='#f7dc27';c.lineWidth=1.3;
  c.fillRect(box.x,box.y,box.w,box.h);
  c.strokeRect(box.x,box.y,box.w,box.h);
  c.fillStyle='#f7dc27';c.font='500 '+box.fs+'px sans-serif';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText(box.text,box.p.x,box.p.y,box.w-8);
  c.restore();
 }
 function shouldShowArrow(it,g){
  const outside=(g.x<view.dx-2||g.y<view.dy-2||
    g.x+g.w>view.dx+photoSize.w*view.zoom+2||
    g.y+g.h>view.dy+photoSize.h*view.zoom+2);
  return !!it.insetMoved||outside||active?.item===it;
 }
 window.renderPhotoInset=function(c,it,image,drawOriginal){
  const g=layout(it,image),show=shouldShowArrow(it,g),isSelected=(selected===it.id)&&!window.__exportingAnnotations;
  if(show)connector(c,g);
  c.save();
  c.translate(g.cx,g.cy);c.rotate(g.angle);c.translate(-g.cx,-g.cy);
  c.fillStyle='rgba(0,0,0,.25)';
  c.fillRect(g.x-2,g.y-2,g.w+4,g.h+4);
  c.drawImage(image,g.x,g.y,g.w,g.h);
  // ImageMeter keeps the original thin yellow photo outline even while selected.
  c.strokeStyle='#f7dc27';c.lineWidth=isSelected?2.4:2;
  c.strokeRect(g.x-1,g.y-1,g.w+2,g.h+2);
  const oldView=view;
  try{
   view={zoom:g.w/image.naturalWidth,dx:g.x,dy:g.y};
   for(const note of it.detailItems||[])drawOriginal(c,note);
  }finally{view=oldView}
  c.restore();
  // ImageMeter zachovává textovou část poznámky i po vložení detailu.
  renderLabel(c,it,g);
  if(show&&!window.__exportingAnnotations)handle(c,g.anchor,'',isSelected);
  if(isSelected){
   // Referenční ImageMeter: poloprůhledný středový úchop pro tažení fotografie.
   c.save();c.fillStyle='rgba(255,255,255,.46)';
   c.strokeStyle='rgba(38,38,38,.55)';c.lineWidth=1.4;
   c.setLineDash([3,3]);
   c.beginPath();c.arc(g.cx,g.cy,11,0,Math.PI*2);c.fill();c.stroke();c.restore();
   // Jemné bílé trojúhelníkové úchopy u obou stran a otáčení nahoře.
   for(const side of [-1,1]){
    const p=turn({x:side*(g.w/2+15),y:0},g);
    c.save();c.translate(p.x,p.y);c.rotate(g.angle);
    c.fillStyle='rgba(255,255,255,.72)';
    c.strokeStyle='rgba(55,55,55,.65)';c.lineWidth=1.3;c.setLineDash([4,3]);
    c.beginPath();
    c.moveTo(side*17,0);c.lineTo(-side*7,-16);c.lineTo(-side*7,16);c.closePath();
    c.fill();c.stroke();c.restore();
   }
   rotationHandle(c,turn({x:0,y:-g.h/2-33},g),g);
  }
 };
 function hitTest(point){
  const items=photoItems().slice().reverse();
  for(const item of items){
   const image=window.__detailPhotoCache[item.media[0]];
   const g=layout(item,image);
   const near=position=>pointerDistance(point,position)<=24;
   if(selected===item.id&&near(turn({x:0,y:-g.h/2-33},g)))return {item,g,kind:'rotate'};
   if(selected===item.id&&near(turn({x:g.w/2+15,y:0},g)))return {item,g,kind:'resize-right'};
   if(selected===item.id&&near(turn({x:-g.w/2-15,y:0},g)))return {item,g,kind:'resize-left'};
   if(shouldShowArrow(item,g)&&near(g.anchor))return {item,g,kind:'anchor'};
   // Tažení přímo za žlutou šipku také posouvá její počáteční bod.
   if(shouldShowArrow(item,g)){
     const end=nearestEdgePoint(g),a=g.anchor,dx=end.x-a.x,dy=end.y-a.y;
     const t=clamp(((point.x-a.x)*dx+(point.y-a.y)*dy)/(dx*dx+dy*dy||1),0,1);
     const dist=Math.hypot(point.x-a.x-t*dx,point.y-a.y-t*dy);
     if(t<.8&&dist<14)return {item,g,kind:'anchor'};
   }
   {
     // Textová část poznámky může být nezávisle přesouvána.
     const p=labelPosition(item,g);
     const w=clamp(String(item.text||'Klikněte pro zadání textu').length*(Number(item.fontSize)||17)*.62+18,88,stageCanvas.clientWidth-20);
     if(Math.abs(point.x-p.x)<w/2+7&&Math.abs(point.y-p.y)<24)
       return {item,g,kind:'caption'};
   }
   const local=unrotate(point,g);
   if(Math.abs(local.x)<=g.w/2+4&&Math.abs(local.y)<=g.h/2+4)return {item,g,kind:'move'};
  }
  return null;
 }
 function down(e){
  if(screen!=='editor'||!current||e.button!==0||window.isRecordLocked?.(current))return;
  if(active){e.preventDefault();e.stopImmediatePropagation();return}
  const at=eventPoint(e),hit=hitTest(at);
  if(!hit)return;
  e.preventDefault();e.stopImmediatePropagation();
  if(typeof setTool==='function'&&mode!=='select')setTool('select',true);
  const wasSelected=selected===hit.item.id;
  selected=hit.item.id;
  const it=hit.item;
  const g=layout(it,window.__detailPhotoCache[it.media[0]]);
  active={item:it,kind:hit.kind,id:e.pointerId,start:at,changed:false,wasSelected,
    startingX:Number.isFinite(it.insetX)?it.insetX:(g.x-view.dx)/view.zoom,
    startingY:Number.isFinite(it.insetY)?it.insetY:(g.y-view.dy)/view.zoom,
    width:Number(it.insetWidth)||220,
    height:g.h/view.zoom,
    angle:Number(it.insetRotation)||0,
    anchor:{...(it.a||{x:0,y:0})},
    caption:{...(it.b||it.a||{x:0,y:0})},captionMoved:!!it.captionMoved,
    center:{x:g.cx,y:g.cy},
    startAngle:Math.atan2(at.y-g.cy,at.x-g.cx),
    g,wasMoved:!!it.insetMoved
  };
  try{stageCanvas.setPointerCapture(e.pointerId)}catch(err){}
  checkpoint();paint();
 }
 function move(e){
  if(!active||active.id!==e.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();
  const at=eventPoint(e),v=active;
  const dx=at.x-v.start.x,dy=at.y-v.start.y;
  if(Math.hypot(dx,dy)>3)v.changed=true;
  if(!v.changed)return;
  if(v.kind==='move'){
   v.item.insetX=v.startingX+dx/view.zoom;
   v.item.insetY=v.startingY+dy/view.zoom;
   v.item.insetMoved=true;
  }else if(v.kind==='caption'){
   const start=v.captionMoved?worldToScreen(v.caption):{
     x:worldToScreen(v.caption).x+45,y:worldToScreen(v.caption).y-23
   };
   v.item.b=screenToWorld({x:start.x+dx,y:start.y+dy});
   v.item.captionMoved=true;
  }else if(v.kind==='anchor'){
   // Posun začátku šipky NESMÍ přesunout samotný detail.
   v.item.insetX=v.startingX;
   v.item.insetY=v.startingY;
   const w=screenToWorld({x:worldToScreen(v.anchor).x+dx,y:worldToScreen(v.anchor).y+dy});
   v.item.a=boundsPoint(w);
   v.item.insetMoved=true;
  }else if(v.kind==='resize-right'||v.kind==='resize-left'){
   const vx=dx*Math.cos(v.g.angle)+dy*Math.sin(v.g.angle);
   const mult=v.kind==='resize-right'?2:-2;
   const newWidth=clamp(v.width+mult*vx/view.zoom,70,1500);
   const ratio=v.height/v.width;
   // Úchopy mění velikost kolem středu, nerozjíždějí původní pozici.
   v.item.insetWidth=newWidth;
   v.item.insetX=v.startingX-(newWidth-v.width)/2;
   v.item.insetY=v.startingY-(newWidth-v.width)*ratio/2;
  }else if(v.kind==='rotate'){
   const delta=Math.atan2(at.y-v.center.y,at.x-v.center.x)-v.startAngle;
   v.item.insetRotation=(((v.angle+delta*180/Math.PI)+540)%360)-180;
  }
  paint();
 }
 function up(e){
  if(!active||active.id!==e.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();
  const v=active;active=null;
  try{stageCanvas.releasePointerCapture(e.pointerId)}catch(err){}
  if(v.changed){
   commitEditor();
  }else{
   if(editStack.length)editStack.pop();
   // První klepnutí jen vybere, druhé otevře; bez časového limitu.
   if(v.wasSelected&&(v.kind==='move'||v.kind==='caption')){
    if(v.kind==='move'&&typeof openNestedPhoto==='function')
      openNestedPhoto(current,v.item,v.item.media[0]);
    else if(v.kind==='caption'&&typeof openRichNote==='function')
      openRichNote(v.item,false);
   }
   paint();
  }
 }
 function cancel(e){
  if(!active||active.id!==e.pointerId)return;
  e.preventDefault();e.stopImmediatePropagation();
  const v=active;active=null;
  // Zrušené přetažení vrátí přesně původní stav.
  v.item.insetX=v.startingX;v.item.insetY=v.startingY;
  v.item.insetWidth=v.width;v.item.insetRotation=v.angle;
  v.item.a=v.anchor;
  v.item.b=v.caption;
  v.item.captionMoved=v.captionMoved;
  v.item.insetMoved=v.wasMoved;
  if(editStack.length)editStack.pop();
  paint();
 }
 for(const [ev,cb] of [['pointerdown',down],['pointermove',move],
   ['pointerup',up],['pointercancel',cancel]]){
  stageCanvas.addEventListener(ev,cb,true);
 }
 // Zvětšit dostupný pracovní prostor i pro vysoké fotografie.
 const originalFitImage=fitImage;
 fitImage=function(){
  if(screen!=='editor'||!current)return originalFitImage();
  const w=stageCanvas.clientWidth,h=stageCanvas.clientHeight;
  if(!w||!h)return;
  // Reference: fotografie nad šedou zónou, která patří pracovní ploše.
  const maxImageHeight=h*.75;
  view.zoom=Math.max(.01,Math.min((w-20)/photoSize.w,(maxImageHeight-20)/photoSize.h));
  view.dx=(w-photoSize.w*view.zoom)/2;
  view.dy=10+(maxImageHeight-photoSize.h*view.zoom)/2;
  paint();
 };
 // Export zahrne i vysunuté detailní fotografie mimo původní snímek.
 exportPng=function(){
  if(!current)return;
  const oldCtx=ctx,oldView={...view};
  let minX=0,minY=0,maxX=photoSize.w,maxY=photoSize.h;
  for(const it of photoItems()){
   const im=window.__detailPhotoCache[it.media[0]];
   if(!im)continue;
   const x=Number.isFinite(it.insetX)?it.insetX:it.a.x+8/view.zoom;
   const y=Number.isFinite(it.insetY)?it.insetY:it.a.y+23/view.zoom;
   const width=clamp(Number(it.insetWidth)||220,70,1500);
   const height=width*im.naturalHeight/im.naturalWidth;
   // Rotace v exportu: konzervativně zahrneme oba rozměry.
   const d=Math.hypot(width,height),angle=(Number(it.insetRotation)||0)*Math.PI/180;
   const boxW=Math.abs(width*Math.cos(angle))+Math.abs(height*Math.sin(angle));
   const boxH=Math.abs(width*Math.sin(angle))+Math.abs(height*Math.cos(angle));
   minX=Math.min(minX,x+(width-boxW)/2);
   minY=Math.min(minY,y+(height-boxH)/2);
   maxX=Math.max(maxX,x+(width+boxW)/2);
   maxY=Math.max(maxY,y+(height+boxH)/2);
  }
  const margin=25;
  const width=Math.ceil(maxX-minX+margin*2),height=Math.ceil(maxY-minY+margin*2);
  if(width*height>48_000_000){notify('Export je příliš velký. Zmenši nebo přibliž detail.');return}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d');
  c.fillStyle='#292a2f';c.fillRect(0,0,width,height);
  const shiftX=margin-minX,shiftY=margin-minY;
  if(stageImg)c.drawImage(stageImg,shiftX,shiftY,photoSize.w,photoSize.h);
  try{
   ctx=c;view={zoom:1,dx:shiftX,dy:shiftY};
   window.__exportingAnnotations=true;
   for(const it of current.items||[])drawItem(c,it);
  }finally{window.__exportingAnnotations=false;ctx=oldCtx;view=oldView}
  const data=canvas.toDataURL('image/png');
  if(native)Native.exportPng((current.title||'zamerovani')+'.png',data.substring(data.indexOf(',')+1));
  else{const a=document.createElement('a');a.download='zamerovani.png';a.href=data;a.click()}
  notify('Export včetně pracovní plochy připraven');
 };
})();
