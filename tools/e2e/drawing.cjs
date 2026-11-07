'use strict';
const {suite,assert,createCanvas,tool,drag,clickAt,editSelected,redo,record,projected,midpoint}=require('./harness.cjs');
const stable=item=>{const copy=JSON.parse(JSON.stringify(item));delete copy.activeSegmentIndex;return copy};
const geometry=item=>JSON.stringify({a:item.a,b:item.b,points:item.points,insetX:item.insetX,insetY:item.insetY});
const tools=['dimension','line','arrow','circle','ellipse','rect','area','polyline','chain','cumulative','angle','freehand','target','note','symbol'];
// Independent outline oracle: raw persisted vertices + documented shape geometry,
// never calls drawItem, ellipseGeometry, quadCorners or hit-test helpers.
async function pixels(page){return page.evaluate(()=>{
 const it=current.items[0],v=view,points=[],to=p=>({x:p.x*v.zoom+v.dx,y:p.y*v.zoom+v.dy});
 const edge=(a,b)=>{for(const t of [.22,.4,.6,.78])points.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t})};
 if(['circle','ellipse'].includes(it.type)){
  const cx=(it.a.x+it.b.x)/2,cy=(it.a.y+it.b.y)/2,rx=Math.abs(it.b.x-it.a.x)/2,ry=it.type==='circle'?rx:Math.abs(it.b.y-it.a.y)/2;
  for(let i=0;i<12;i++){const angle=(i+.5)*Math.PI/6;points.push(to({x:cx+rx*Math.cos(angle),y:cy+ry*Math.sin(angle)}))}
 }else if(['rect','area'].includes(it.type)){
  const p=it.type==='area'?it.points:[it.a,{x:it.b.x,y:it.a.y},it.b,{x:it.a.x,y:it.b.y}];
  for(let i=0;i<4;i++)edge(to(p[i]),to(p[(i+1)%4]));
 }else if(it.type==='target'){
  const a=to(it.a);for(const d of [-8,8]){points.push({x:a.x+d,y:a.y},{x:a.x,y:a.y+d})}
 }else if(it.points?.length>1){
  const p=it.points.map(to);
  if(it.type==='cumulative'){
   const a=p[0],b=p[1],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy),ux=dx/length,uy=dy/length;
   for(let i=1;i<p.length;i++){const along=(p[i].x-a.x)*ux+(p[i].y-a.y)*uy,off=(i-1)*26;edge({x:a.x-uy*off,y:a.y+ux*off},{x:a.x+ux*along-uy*off,y:a.y+uy*along+ux*off})}
  }else for(let i=1;i<p.length;i++)edge(p[i-1],p[i]);
 }else if(!['note','symbol'].includes(it.type))edge(to(it.a),to(it.b));
 const c=stageCanvas.getContext('2d'),dpr=stageCanvas.width/stageCanvas.clientWidth,data=c.getImageData(0,0,stageCanvas.width,stageCanvas.height).data;
 const yellow=(x,y)=>{const k=(y*stageCanvas.width+x)*4;return data[k]>170&&data[k+1]>140&&data[k+2]<115&&data[k+3]>160};
 let colored=0;for(let y=0;y<stageCanvas.height;y++)for(let x=0;x<stageCanvas.width;x++)if(yellow(x,y))colored++;
 const hits=points.map(p=>{for(let y=Math.max(0,Math.round(p.y*dpr)-5);y<Math.min(stageCanvas.height,Math.round(p.y*dpr)+6);y++)for(let x=Math.max(0,Math.round(p.x*dpr)-5);x<Math.min(stageCanvas.width,Math.round(p.x*dpr)+6);x++)if(yellow(x,y))return true;return false});
 return {colored,hits,points};
})}
function outline(result){assert(result.colored>15,'Missing colored drawing pixels');if(result.hits.length)assert(result.hits.filter(Boolean).length/result.hits.length>=.7,'Missing colored outline; white grips do not count: '+JSON.stringify(result.hits))}
(async()=>suite('drawing',async test=>{
 for(const type of tools)await test(type,async({page,step,evidence})=>{
  const title='Syntetický '+type;await step('Create canvas through UI',()=>createCanvas(page,title));await tool(page,type);
  const frame=await page.evaluate(()=>({a:{x:view.dx+photoSize.w*view.zoom*.20,y:view.dy+photoSize.h*view.zoom*.25},b:{x:view.dx+photoSize.w*view.zoom*.78,y:view.dy+photoSize.h*view.zoom*.68},m:{x:view.dx+photoSize.w*view.zoom*.49,y:view.dy+photoSize.h*view.zoom*.72}}));
  await step('Draw using real pointer gestures',async()=>{
   if(['polyline','chain','cumulative','angle'].includes(type)){
    for(const p of [frame.a,frame.m,frame.b])await clickAt(page,p);
    if(type!=='angle'){const r=await page.locator('#drawCanvas').boundingBox();await page.mouse.dblclick(r.x+frame.b.x,r.y+frame.b.y)}
   }else if(type==='freehand'){
    const r=await page.locator('#drawCanvas').boundingBox();await page.mouse.move(r.x+frame.a.x,r.y+frame.a.y);await page.mouse.down();
    for(const p of [frame.m,frame.b])await page.mouse.move(r.x+p.x,r.y+p.y,{steps:8});await page.mouse.up();
   }else await drag(page,frame.a,frame.b);
   if(type==='symbol'){await page.locator('[data-symbol="6"]').click();await page.fill('#drawText','Symbol test');await page.click('#okModal')}
   assert.equal(await page.evaluate(()=>current.items.length),1);assert.equal((await record(page)).type,type);
  });
  await step('Pixel oracle + fault injection',async()=>{
   outline(await pixels(page));
   if(!['note','symbol'].includes(type)){
    await page.evaluate(()=>{window.__originalStroke=CanvasRenderingContext2D.prototype.stroke;CanvasRenderingContext2D.prototype.stroke=function(...args){if(this.strokeStyle==='#f7dc27')return;return __originalStroke.apply(this,args)};paint()});
    const hidden=await pixels(page);let rejected=false;try{outline(hidden)}catch{rejected=true}
    await page.evaluate(()=>{CanvasRenderingContext2D.prototype.stroke=__originalStroke;paint()});
    assert(rejected,'Mutation control must fail when only white grips/text remain');evidence({faultInjectionRejected:true,hiddenHits:hidden.hits});
   }
   const actual=await pixels(page);evidence({outline:actual.hits,colorPixels:actual.colored});
  });
  await step('Edit exact measurements and text via dialog',async()=>{
   await editSelected(page);
   if(['polyline','chain','cumulative'].includes(type)){
    for(let i=0;i<2;i++){await page.fill('#segmentMeasure'+i,['100,000123','250,000456'][i]);await page.fill('#segmentText'+i,'Úsek '+i);await page.selectOption('#segmentUnit'+i,i?'mm':'cm')}
   }else if(type==='angle'){
    for(let i=0;i<2;i++){await page.fill('#angleLength'+i,'1000,000123');await page.fill('#angleText'+i,'Rameno '+i)}
   }else if(type==='area'){
    for(let i=0;i<4;i++){await page.fill('#areaSide'+i,'1000');await page.fill('#areaText'+i,'Strana '+i)}await page.fill('#areaDiagonal','1414,2135623730951');
   }else if(type==='note')await page.fill('#richText','Poznámka\npřesný text');
   else{
    if(type==='rect'){await page.fill('#rectWidth','1000,000123');await page.fill('#rectHeight','500,000321')}
    else if(await page.locator('#measureInput').count()){await page.fill('#measureInput','1250,123456789');await page.selectOption('#measureUnit','cm')}
    await page.fill(type==='dimension'?'#dimensionCaption':'#drawText','Popisek '+type);
   }
   await page.click('#okModal');const it=await record(page);
   if(['polyline','chain','cumulative'].includes(type)){assert.equal(it.segmentData[0].measure,'100,000123');assert.equal(it.segmentData[0].unit,'cm');assert.equal(it.segmentData[1].measure,'250,000456')}
   else if(type==='angle')assert.equal(it.segmentData[0].measure,'1000,000123');
   else if(type==='area'){assert.equal(it.measure,'1');assert.equal(it.unit,'m²');assert.deepEqual(it.sideMeasures,['1000','1000','1000','1000'])}
   else if(type==='rect'){assert.equal(it.dimW,'1000,000123');assert.equal(it.dimH,'500,000321')}
   else if(type==='note')assert.equal(it.text,'Poznámka\npřesný text');
   else if(type!=='freehand'&&type!=='symbol'){assert.equal(it.measure,'1250,123456789');assert.equal(it.unit,'cm')}
  });
  await step('Move + Undo/Redo using controls',async()=>{
   const before=await record(page);let p;
   if(['circle','ellipse','rect','area'].includes(type))p=midpoint(before.a,before.b);
   else if(type==='note')p=before.captionMoved?before.b:before.a;
   else if(type==='symbol')p=before.a;
   else if(type==='target')p=before.b;
   else if(before.points?.length>1)p=midpoint(before.points[0],before.points[1],.20);
   else p=midpoint(before.a,before.b);
   const at=await projected(page,p);
   if(before.points?.length>1){
    const a=await projected(page,before.points[0]),b=await projected(page,before.points[1]),length=Math.hypot(b.x-a.x,b.y-a.y);
    at.x-=(b.y-a.y)/length*24;at.y+=(b.x-a.x)/length*24; // Outside caption and endpoint zones, inside body hit tolerance.
   }
   await drag(page,at,{x:at.x+16,y:at.y+14});
   const moved=await record(page);assert.notEqual(geometry(moved),geometry(before),'Body/caption movement must change geometry');
   await page.click('#undo');assert.deepEqual(stable(await record(page)),stable(before));await redo(page);assert.deepEqual(stable(await record(page)),stable(moved));
  });
  if(!['freehand','note','symbol'].includes(type))await step('Endpoint/corner edit preserves measurements',async()=>{
   const before=await record(page);let p=before.points?.[0]||before.a;
   if(['circle','ellipse'].includes(type))p={x:Math.min(before.a.x,before.b.x),y:(before.a.y+before.b.y)/2};
   if(type==='target')p=before.b;
   const at=await projected(page,p);await drag(page,at,{x:at.x-16,y:at.y-10});const changed=await record(page);
   assert.notDeepEqual(changed,before);assert.equal(changed.measure,before.measure);assert.equal(changed.unit,before.unit);
   if(type==='area')for(let i=1;i<4;i++)assert.deepEqual(changed.points[i],before.points[i],'Other area vertices must stay fixed');
   if(before.points?.length&&type!=='area')for(let i=1;i<before.points.length;i++)assert.deepEqual(changed.points[i],before.points[i]);
   if(['dimension','line','arrow'].includes(type))assert.deepEqual(changed.b,before.b);
  });
  await step('Close/reopen/reload retain exact object and rendered outline',async()=>{
   const saved=await record(page);await page.click('#editorBack');await page.locator('.entry-title',{hasText:title}).click();assert.deepEqual(await record(page),saved);outline(await pixels(page));
   await page.click('#editorBack');await page.reload();await page.locator('.entry-title',{hasText:title}).click();assert.deepEqual(await record(page),saved);outline(await pixels(page));
  });
 });
 await test('two_finger_pinch_keeps_undo_redo_and_exact_measure',async({page,step,evidence})=>{
  const title='Test přiblížení dvěma prsty';await step('Create and measure dimension',async()=>{
   await createCanvas(page,title);await tool(page,'dimension');
   const pts=await page.evaluate(()=>({
    a:{x:view.dx+photoSize.w*view.zoom*.2,y:view.dy+photoSize.h*view.zoom*.25},
    b:{x:view.dx+photoSize.w*view.zoom*.75,y:view.dy+photoSize.h*view.zoom*.65}
   }));
   await drag(page,pts.a,pts.b);
   await editSelected(page);
   await page.fill('#measureInput','1250,00000123');
   await page.selectOption('#measureUnit','mm');
   await page.click('#okModal');
   assert.equal((await record(page)).measure,'1250,00000123');
   await page.click('#undo');
  });
  const original=await page.evaluate(()=>({
   items:JSON.stringify(current.items),undo:editStack.length,redo:redoStack.length,
   zoom:view.zoom,save:localStorage.getItem('zamerovac-data')
  }));
  assert(original.redo>0,'Precondition: Redo must exist before pinch');
  const frame=await page.locator('#drawCanvas').boundingBox();
  assert(frame&&frame.width>220&&frame.height>200,'Editor canvas too small for pinch smoke');
  const center={x:frame.x+frame.width*.5,y:frame.y+frame.height*.52};
  const touch=(x,id)=>({id,x,y:center.y});
  const points=[touch(center.x-55,0),touch(center.x+55,1)];
  const cdp=await page.context().newCDPSession(page);
  try{
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[points[0]]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});
   const pinch=await page.evaluate(()=>({
    gesture:gesture?JSON.parse(JSON.stringify(gesture)):null,
    count:pointers.size
   }));
   assert.equal(pinch.count,2,'Browser must deliver two real pointers');
   assert(pinch.gesture,'Editor must start its two-pointer gesture');
   const moved=[touch(center.x-100,0),touch(center.x+100,1)];
   await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:moved});
   const currentZoom=await page.evaluate(()=>({zoom:view.zoom,dx:view.dx,dy:view.dy}));
   assert(currentZoom.zoom>original.zoom*1.4,'Real two-finger gesture must zoom image');
   const worldAtMid={
    x:(center.x-frame.x-currentZoom.dx)/currentZoom.zoom,
    y:(center.y-frame.y-currentZoom.dy)/currentZoom.zoom
   };
   assert(Math.abs(worldAtMid.x-pinch.gesture.world.x)<1e-7&&
     Math.abs(worldAtMid.y-pinch.gesture.world.y)<1e-7,'Pinch must anchor original world center');
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[moved[0]]});
   await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  }finally{await cdp.detach()}
  const after=await page.evaluate(()=>({
   items:JSON.stringify(current.items),undo:editStack.length,redo:redoStack.length,
   zoom:view.zoom,save:localStorage.getItem('zamerovac-data'),pointerCount:pointers.size
  }));
  assert.equal(after.items,original.items,'Pinch must never alter precise annotations');
  assert.equal(after.undo,original.undo,'Pinch must not create Undo');
  assert.equal(after.redo,original.redo,'Pinch must not clear Redo');
  assert.equal(after.save,original.save,'Pinch must not write unnecessary records');
  assert.equal(after.pointerCount,0,'Pinch must release both touch pointers');
  await step('Redo, close and reload preserve exact original measurement',async()=>{
   await redo(page);
   assert.equal((await record(page)).measure,'1250,00000123');
   await page.click('#editorBack');
   await page.reload();
   await page.locator('.entry-title',{hasText:title}).click();
   assert.equal((await record(page)).measure,'1250,00000123');
  });
  evidence({scenario:'real two-pointer CDP input, unchanged Undo/Redo and exact saved value',
   before:{zoom:original.zoom,undo:original.undo,redo:original.redo},
   after:{zoom:after.zoom,undo:after.undo,redo:after.redo}});
 });

}))().catch(e=>{console.error(e);process.exitCode=1});
