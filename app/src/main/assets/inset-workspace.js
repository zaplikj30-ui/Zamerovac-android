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
 function layout(it,image,render){
  const transform=render?.view||view,size=render?.photoSize||photoSize;
  const viewport=render?.viewport||{w:stageCanvas.clientWidth,h:stageCanvas.clientHeight};
  const exporting=render?render.exporting:window.__exportingAnnotations;
  const zoom=transform.zoom;
  const w=clamp(Number(it.insetWidth)||220,70,1500)*zoom;
  const h=w*image.naturalHeight/image.naturalWidth;
  const anchor=render?annotationProjectPoint(it.a||{x:0,y:0},transform):worldToScreen(it.a||{x:0,y:0});
  // Původní poznámky zůstanou na svém místě.
  // Výchozí vložený obrázek nesmí začínat mimo dostupný displej.
  const initialX=clamp(anchor.x+8,8,Math.max(8,(exporting?size.w*zoom:viewport.w)-w-8));
  const initialY=clamp(anchor.y+23,8,Math.max(8,(exporting?size.h*zoom:viewport.h)-h-8));
  const x=Number.isFinite(it.insetX)?it.insetX*zoom+transform.dx:initialX;
  const y=Number.isFinite(it.insetY)?it.insetY*zoom+transform.dy:initialY;
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
  // Hrot šipky je pevný bod na hlavní fotografii, nikoliv na rámečku detailu.
  const angle=Math.atan2(start.y-end.y,start.x-end.x);
  const size=11;
  ctx.save();
  ctx.lineCap='round';ctx.lineJoin='round';
  ctx.strokeStyle='#f7dc27';ctx.fillStyle='#f7dc27';
  ctx.lineWidth=2.8;
  ctx.beginPath();ctx.moveTo(start.x,start.y);ctx.lineTo(end.x,end.y);ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(start.x,start.y);
  ctx.lineTo(start.x-size*Math.cos(angle-.55),start.y-size*Math.sin(angle-.55));
  ctx.lineTo(start.x-size*Math.cos(angle+.55),start.y-size*Math.sin(angle+.55));
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
 function labelPosition(it,g,render){
  // Výchozí text je součástí rámečku fotografie, a proto jede spolu s ní.
  // Uživatelsky přetažený text (starší uložené poznámky) má vlastní souřadnici.
  if(it.captionMoved&&it.b)return render?annotationProjectPoint(it.b,render.view):worldToScreen(it.b);
  return {x:g.cx,y:g.y+g.h+18};
 }
 function labelRect(c,it,g,render){
  const text=String(it.text||'').trim();
  if(!text)return null;
  const p=labelPosition(it,g,render),fs=Number(it.fontSize)||Math.max(14,Number((render?.prefs||prefs).fontSize)||17);
  c.font='500 '+fs+'px sans-serif';
  const width=clamp(c.measureText(text).width+18,88,Math.max(88,(render?.viewport.w??stageCanvas.clientWidth)-20));
  return {x:p.x-width/2,y:p.y-fs/2-7,w:width,h:fs+15,p,text,fs};
 }
 // All visible sheets rotate around the front photograph's centre.
 // Reuse these screen-space bounds for the icon AND export/gallery extents.
 function insetVisibleBlocks(it,g,render){
  const count=(it.media||[]).filter(id=>!(it.audioMedia||[]).includes(id)).length;
  const step=Math.min(10,72/Math.max(1,count-1));
  const blocks=[];
  for(let layer=0;layer<Math.max(1,count);layer++){
   const offset=layer*step;
   const corners=[
    {x:-g.w/2+offset,y:-g.h/2-offset},
    {x:g.w/2+offset,y:-g.h/2-offset},
    {x:g.w/2+offset,y:g.h/2-offset},
    {x:-g.w/2+offset,y:g.h/2-offset}
   ].map(p=>turn(p,g));
   const xs=corners.map(p=>p.x),ys=corners.map(p=>p.y);
   blocks.push({x:Math.min(...xs),y:Math.min(...ys),
    w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)});
  }
  // The stack's numeric counter is visible only in the editor/gallery.
  if(count>1&&!render?.exporting){
   const offset=step*(count-1);
   const centre=turn({x:g.w/2+offset+15,y:-g.h/2-offset-11},g);
   blocks.push({x:centre.x-13,y:centre.y-13,w:26,h:26});
  }
  return blocks;
 }
 // Place the audio indicator next to the inset rather than over text or photo.
 // Only screen-space drawing is affected; the stored note and hit areas stay intact.
 function audioMarkerPosition(c,it,g,render){
  if(!Array.isArray(it.audioMedia)||!it.audioMedia.length)return null;
  const blocks=insetVisibleBlocks(it,g,render);
  const left=Math.min(...blocks.map(p=>p.x)),right=Math.max(...blocks.map(p=>p.x+p.w));
  const top=Math.min(...blocks.map(p=>p.y)),bottom=Math.max(...blocks.map(p=>p.y+p.h));
  let caption;c.save();try{caption=labelRect(c,it,g,render)}finally{c.restore()}
  const radius=13,gap=7;
  const viewport=render?.viewport||{w:stageCanvas.clientWidth,h:stageCanvas.clientHeight};
  const collides=(a,b)=>b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
  const options=[
   {x:right+gap+radius,y:bottom-radius}, // right/bottom, outside the inset
   {x:right-radius,y:Math.max(bottom,caption?caption.y+caption.h:bottom)+gap+radius},
   {x:left-gap-radius,y:bottom-radius},
   {x:right-radius,y:top-gap-radius},
   {x:left-gap-radius,y:top+radius}
  ];
  for(const p of options){
   const marker={x:p.x-radius,y:p.y-radius,w:radius*2,h:radius*2};
   // Export/gallery expands the output bounds; editor stays in the viewport.
   if(!render?.exporting&&(marker.x<2||marker.y<2||
    marker.x+marker.w>viewport.w-2||marker.y+marker.h>viewport.h-2))continue;
   if(blocks.every(block=>!collides(marker,block))&&!collides(marker,caption))return p;
  }
  return null; // no safe place: never obscure the inset, its stack or caption
 }
 // Shared bounds use the same geometry and default caption placement as rendering.
 window.insetAnnotationBounds=function(c,it,render){
  const image=window.__detailPhotoCache?.[it.media?.[0]];if(!image?.naturalWidth)return null;
  const g=layout(it,image,render);
  const corners=insetVisibleBlocks(it,g,render).flatMap(box=>
   [{x:box.x,y:box.y},{x:box.x+box.w,y:box.y+box.h}]);
  const label=labelRect(c,it,g,render);
  if(label)corners.push({x:label.x,y:label.y},{x:label.x+label.w,y:label.y+label.h});
  const marker=audioMarkerPosition(c,it,g,render);
  if(marker)corners.push({x:marker.x-13,y:marker.y-13},{x:marker.x+13,y:marker.y+13});
  return {minX:Math.min(...corners.map(p=>p.x))-18,minY:Math.min(...corners.map(p=>p.y))-18,maxX:Math.max(...corners.map(p=>p.x))+18,maxY:Math.max(...corners.map(p=>p.y))+18};
 };
 function renderLabel(c,it,g,render){
  const box=labelRect(c,it,g,render);
  if(!box)return;
  c.save();try{c.fillStyle='rgba(23,24,27,.8)';
  c.strokeStyle='#f7dc27';c.lineWidth=1.3;
  c.fillRect(box.x,box.y,box.w,box.h);
  c.strokeRect(box.x,box.y,box.w,box.h);
  c.fillStyle='#f7dc27';c.font='500 '+box.fs+'px sans-serif';
  c.textAlign='center';c.textBaseline='middle';
  c.fillText(box.text,box.p.x,box.p.y,box.w-8);
  }finally{c.restore();}
 }
 function shouldShowArrow(it,g,render){
  const transform=render?.view||view,size=render?.photoSize||photoSize;
  const outside=(g.x<transform.dx-2||g.y<transform.dy-2||
    g.x+g.w>transform.dx+size.w*transform.zoom+2||
    g.y+g.h>transform.dy+size.h*transform.zoom+2);
  return !!it.insetMoved||outside;
 }
 window.renderPhotoInset=function(c,it,image,drawOriginal,render=annotationRenderContext(c)){
  const g=layout(it,image,render),show=shouldShowArrow(it,g,render),isSelected=(render.selected===it.id)&&!render.exporting;
  if(show)connector(c,g);
  c.save();try{
  c.translate(g.cx,g.cy);c.rotate(g.angle);c.translate(-g.cx,-g.cy);
  // Every attached photograph gets its own visible sheet. Draw the back
  // sheets before the front photograph, without changing selection or touch areas.
  const imageCount=(it.media||[]).filter(id=>!(it.audioMedia||[]).includes(id)).length;
  // Leave a clear 10px reveal for common stacks of 2–4 photographs.
  // For unusually large stacks reduce the gap, so the sheets stay close to the inset.
  const stackStep=Math.min(10,72/Math.max(1,imageCount-1));
  if(imageCount>1){
   for(let layer=imageCount-1;layer>=1;layer--){
    const offset=layer*stackStep;
    c.fillStyle='#282c36';
    c.strokeStyle='#d8be6f';
    c.lineWidth=1.7;
    c.fillRect(g.x+offset,g.y-offset,g.w,g.h);
    c.strokeRect(g.x+offset,g.y-offset,g.w,g.h);
    // Fold the upper-right corner of every visible sheet.
    const x=g.x+offset+g.w,y=g.y-offset;
    c.fillStyle='#e9debf';c.beginPath();
    c.moveTo(x-14,y);c.lineTo(x,y+14);c.lineTo(x-14,y+14);c.closePath();c.fill();
    c.strokeStyle='#ae9560';c.beginPath();c.moveTo(x-14,y);c.lineTo(x-14,y+14);c.lineTo(x,y+14);c.stroke();
   }
  }
  c.fillStyle='rgba(0,0,0,.25)';
  c.fillRect(g.x-2,g.y-2,g.w+4,g.h+4);
  c.drawImage(image,g.x,g.y,g.w,g.h);
  // ImageMeter keeps the original thin yellow photo outline even while selected.
  c.strokeStyle='#f7dc27';c.lineWidth=isSelected?2.4:2;
  c.strokeRect(g.x-1,g.y-1,g.w+2,g.h+2);
  const detailRender={...render,view:{zoom:g.w/image.naturalWidth,dx:g.x,dy:g.y},
   photoSize:{w:image.naturalWidth,h:image.naturalHeight}};
  for(const note of it.detailItems||[])drawOriginal(c,note,detailRender);
  if(imageCount>1&&!render.exporting){
   c.save();
   c.font='bold 12px sans-serif';
   c.textAlign='center';c.textBaseline='middle';
   c.fillStyle='#d7b4ff';c.strokeStyle='#31253b';c.lineWidth=2;
   const px=g.x+g.w+stackStep*(imageCount-1)+15,py=g.y-stackStep*(imageCount-1)-11;
   c.beginPath();c.arc(px,py,13,0,Math.PI*2);c.fill();c.stroke();
   c.fillStyle='#271c35';c.fillText(String(imageCount),px,py+.5);
   c.restore();
  }
  }finally{c.restore();}
  // ImageMeter zachovává textovou část poznámky i po vložení detailu.
  renderLabel(c,it,g,render);
  // Recalculate the marker on zoom, rotation, drag and in the export renderer.
  const audioMarker=audioMarkerPosition(c,it,g,render);
  if(audioMarker){
   c.save();try{
    c.font='bold 22px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillStyle='#f7dc27';
    c.fillText('🎙',audioMarker.x,audioMarker.y);
   }finally{c.restore();}
  }
  // Bílý úchopový bod na konci šipky pouze při skutečném přetahování.
  if(show&&active?.item===it&&active.kind==='anchor'&&active.changed&&!render.exporting)
   handle(c,g.anchor,'',true);
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
     // Fotografie a vlastní text jsou společný objekt.
     if(item.text){
      const p=labelPosition(item,g);
      const w=clamp(String(item.text).length*(Number(item.fontSize)||17)*.62+18,88,stageCanvas.clientWidth-20);
      if(Math.abs(point.x-p.x)<w/2+7&&Math.abs(point.y-p.y)<24)
       return {item,g,kind:'move-caption'};
     }
   }
   const local=unrotate(point,g);
   if(Math.abs(local.x)<=g.w/2+4&&Math.abs(local.y)<=g.h/2+4)return {item,g,kind:'move'};
  }
  return null;
 }
 function down(e){
  if(current?.kind==='photo'&&!stageImg)return;
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
  if(v.kind==='move'||v.kind==='move-caption'){
   v.item.insetX=v.startingX+dx/view.zoom;
   v.item.insetY=v.startingY+dy/view.zoom;
   v.item.insetMoved=true;
   if(v.captionMoved&&v.caption)
    v.item.b={x:v.caption.x+dx/view.zoom,y:v.caption.y+dy/view.zoom};
  }else if(v.kind==='caption'){
   // Starší uložené poznámky: text už nesmí odjíždět od fotografie.
   v.item.insetX=v.startingX+dx/view.zoom;v.item.insetY=v.startingY+dy/view.zoom;
   v.item.insetMoved=true;
   if(v.captionMoved&&v.caption)
    v.item.b={x:v.caption.x+dx/view.zoom,y:v.caption.y+dy/view.zoom};
  }else if(v.kind==='anchor'){
   // Hrot se přesouvá samostatně, fotografie i její text zůstávají na místě.
   // Není třeba ukládat umělou polohu textu (captionMoved zůstane nezměněno).
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
   if(v.wasSelected&&(v.kind==='move'||v.kind==='move-caption'||v.kind==='caption')){
    if(typeof openRichNote==='function')openRichNote(v.item,false);
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
  let minX=0,minY=0,maxX=photoSize.w,maxY=photoSize.h;
  const measure=document.createElement('canvas').getContext('2d');
  const boundsRender=annotationRenderContext(measure,{view:{zoom:1,dx:0,dy:0},
   viewport:{w:photoSize.w,h:photoSize.h},selected:null,exporting:true});
  for(const it of photoItems()){
   const box=window.insetAnnotationBounds(measure,it,boundsRender);
   if(!box)continue;
   minX=Math.min(minX,box.minX);minY=Math.min(minY,box.minY);
   maxX=Math.max(maxX,box.maxX);maxY=Math.max(maxY,box.maxY);
  }
  const margin=25;
  const width=Math.ceil(maxX-minX+margin*2),height=Math.ceil(maxY-minY+margin*2);
  if(width*height>48_000_000){notify('Export je příliš velký. Zmenši nebo přibliž detail.');return}
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const c=canvas.getContext('2d');
  c.fillStyle='#292a2f';c.fillRect(0,0,width,height);
  const shiftX=margin-minX,shiftY=margin-minY;
  if(stageImg)c.drawImage(stageImg,shiftX,shiftY,photoSize.w,photoSize.h);
  const render=annotationRenderContext(c,{view:{zoom:1,dx:shiftX,dy:shiftY},
   viewport:{w:width,h:height},selected:null,exporting:true});
  for(const it of current.items||[])drawItem(c,it,render);
  const data=canvas.toDataURL('image/png');
  if(native)Native.exportPng((current.title||'zamerovani')+'.png',data.substring(data.indexOf(',')+1));
  else{const a=document.createElement('a');a.download='zamerovani.png';a.href=data;a.click()}
  notify('Export včetně pracovní plochy připraven');
 };
})();
