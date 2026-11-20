'use strict';
const {suite,assert,createCanvas,tool,drag,clickAt,editSelected,record,projected,redo}=require('./harness.cjs');
async function dismiss(page){if(await page.locator('#modal').isVisible())await page.click('#cancelModal')}
async function setup(page){await createCanvas(page,'Gesta – syntetická');await tool(page,'dimension');await drag(page,{x:100,y:180},{x:470,y:360});await editSelected(page);await page.fill('#measureInput','1250,000000123');await page.fill('#dimensionCaption','Český <script>window.__xss=1</script> 😀');await page.click('#okModal');return record(page)}
(async()=>suite('interactions',async test=>{
 await test('move_paint_once_per_frame',async({page,evidence})=>{
  await createCanvas(page,'Seskupení vykreslení – syntetická');
  const result=await page.evaluate(async()=>{
   const item={id:'paint-probe',type:'dimension',a:{x:100,y:100},b:{x:300,y:150},
    measure:'1585,800001',unit:'mm',color:'#ffff00',width:3,fontSize:18};
   current.items=[item];paint();
   const bounds=stageCanvas.getBoundingClientRect(),start={x:100,y:100};
   pointers.set(1,start);
   selectedHandle={kind:'move-dimension',startScreen:start,dragged:true,item,
    startA:{...item.a},startB:{...item.b},beforeDragItems:JSON.stringify(current.items)};
   const originalPaint=paint;let paints=0;
   paint=function(){paints++;return originalPaint()};
   for(let n=0;n<100;n++)stageMove({pointerId:1,clientX:bounds.left+start.x+n,clientY:bounds.top+start.y+n});
   const beforeFrame=paints;
   await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   const afterFrame=paints,position={...item.a},measure=item.measure;
   selectedHandle=null;pointers.clear();mode='pan';drag={screen:start,dx:view.dx,dy:view.dy};
   pointers.set(2,start);
   stageMove({pointerId:2,clientX:bounds.left+start.x+10,clientY:bounds.top+start.y});
   stageUp({pointerId:2});
   const afterPanRelease=paints,pendingFrame=movePaintFrame;
   paint=originalPaint;
   return {beforeFrame,afterFrame,afterPanRelease,pendingFrame,position,measure};
  });
  assert.equal(result.beforeFrame,0,'Pointer moves must not synchronously repaint each event');
  assert.equal(result.afterFrame,1,'Latest pointer state should paint once on the next frame');
  assert.ok(result.position.x>100,'Latest dimension position was lost');
  assert.equal(result.measure,'1585,800001');
  assert.equal(result.afterPanRelease,2,'Pan release must paint its final position');
  assert.equal(result.pendingFrame,0,'Pan release must cancel queued paint');
  evidence(result);
 });
 await test('rapid_grips_jitter_cancel',async({page,step,evidence})=>{
  const original=await setup(page);await tool(page,'select');
  await step('One/two/three taps and one-pixel jitter do not collapse or delete measurement',async()=>{
   for(const taps of [1,2,3])for(const position of [original.a,original.b]){
    const p=await projected(page,position),r=await page.locator('#drawCanvas').boundingBox();
    await page.mouse.click(r.x+p.x,r.y+p.y,{clickCount:taps,delay:35});await dismiss(page);
    assert.deepEqual(await record(page),original);
    await drag(page,p,{x:p.x+.5,y:p.y+.5});await dismiss(page);assert.deepEqual(await record(page),original);
   }
  });
  await step('Trusted touch cancel leaves committed geometry and exact dimensions intact',async()=>{
   await page.evaluate(()=>{window.__events=[];for(const type of ['pointerdown','pointerup','pointercancel','touchstart','touchcancel'])stageCanvas.addEventListener(type,e=>__events.push({type,id:e.pointerId,trusted:e.isTrusted}))});
   const cdp=await page.context().newCDPSession(page),p=await projected(page,original.a),r=await page.locator('#drawCanvas').boundingBox();
   await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:r.x+p.x,y:r.y+p.y,id:9}]});await page.waitForFunction(()=>__events.some(e=>e.type==='pointerdown'&&e.trusted));await cdp.send('Input.dispatchTouchEvent',{type:'touchCancel',touchPoints:[]});
   await page.waitForTimeout(80);evidence(await page.evaluate(()=>({events:__events,pointers:[...pointers.keys()],magnifierPoint,hidden:document.querySelector('#loupe').hidden})));await page.waitForFunction(()=>pointers.size===0&&document.querySelector('#loupe').hidden);assert.deepEqual(await record(page),original);await cdp.detach();
  });
  await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();assert.deepEqual(await record(page),original);assert.equal(await page.evaluate(()=>window.__xss),undefined);evidence({taps:[1,2,3],endpoints:2,jitterPx:.5,touchCancel:true});

  await step('Two nearby dimension grips and an empty note: real mouse clicks, exact saved values',async()=>{
   // Synthetic fixture is staged through the production save; selection and
   // dragging below use actual trusted Chromium pointer events, not stageDown().
   const fixture=await page.evaluate(()=>{
    const a=current.items[0],b=JSON.parse(JSON.stringify(a));
    b.id=uid();b.a={x:a.a.x+18/view.zoom,y:a.a.y};
    b.b={x:a.b.x+18/view.zoom,y:a.b.y};
    b.measure='3250,000000009876543';b.unit='mm';
    const extras=[];
    for(let i=1;i<=3;i++){
     const other=JSON.parse(JSON.stringify(a));other.id=uid();
     other.a={x:a.a.x,y:a.a.y+70*i/view.zoom};
     other.b={x:a.b.x,y:a.b.y+70*i/view.zoom};
     extras.push(other);
    }
    const c={x:(a.a.x+a.b.x)/2,y:(a.a.y+a.b.y)/2+35/view.zoom};
    current.items.push(b,...extras,{id:uid(),type:'note',a:c,b:{...c},text:'',
      media:[],color:prefs.color,fontSize:prefs.fontSize,width:prefs.lineWidth});
    if(save()!==true)throw Error('Synthetic fixture was not confirmed saved');
    paint();
    return {aId:a.id,bId:b.id,a:a.a,b:b.a,bEnd:b.b,
      extras:extras.map(item=>({id:item.id,a:item.a})),
      firstMeasure:a.measure,secondMeasure:b.measure};
   });
   await tool(page,'select');
   // Browser-only timing: from a real pointerdown to first completed canvas
   // paint, plus editor commit. Native WebView/IO is not measured here.
   await page.evaluate(()=>{
    const timings=window.__annotationTiming={downAt:null,paintAfterDownMs:[],commitMs:[]};
    const oldPaint=paint,oldCommit=commitEditor;
    window.paint=function(...args){
     const result=oldPaint.apply(this,args);
     if(timings.downAt!==null){
      timings.paintAfterDownMs.push(performance.now()-timings.downAt);
      timings.downAt=null;
     }
     return result;
    };
    window.commitEditor=function(...args){
     const at=performance.now();
     try{return oldCommit.apply(this,args)}
     finally{timings.commitMs.push(performance.now()-at)}
    };
    stageCanvas.addEventListener('pointerdown',()=>{timings.downAt=performance.now()},true);
   });
   for(const extra of fixture.extras){
    await clickAt(page,await projected(page,extra.a));await dismiss(page);
    assert.equal(await page.evaluate(()=>selected),extra.id,'A separate dimension must be selectable');
   }
   await clickAt(page,await projected(page,fixture.a));await dismiss(page);
   assert.equal(await page.evaluate(()=>selected),fixture.aId,'First dimension must be selected');
   await clickAt(page,await projected(page,fixture.b));await dismiss(page);
   assert.equal(await page.evaluate(()=>selected),fixture.bId,
    'A closer overlapping endpoint must beat the previously selected grip');
   const midpoint={x:(fixture.a.x+fixture.b.x)/2,y:(fixture.a.y+fixture.b.y)/2};
   const beforeTap=await page.evaluate(()=>JSON.stringify(current.items));
   await clickAt(page,await projected(page,midpoint));await dismiss(page);
   assert.equal(await page.evaluate(()=>selected),fixture.bId,
    'At equally close endpoints the already-selected dimension should remain active');
   assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),beforeTap,
    'Tapping must never change precise geometry or media');
   const end=await projected(page,fixture.bEnd);
   await drag(page,end,{x:end.x+27,y:end.y+17});
   const moved=await page.evaluate(id=>JSON.parse(JSON.stringify(current.items.find(i=>i.id===id))),fixture.bId);
   assert(moved&&moved.b.x!==fixture.bEnd.x,'Drag must move the chosen endpoint');
   assert.equal(moved.measure,fixture.secondMeasure);
   assert.equal(moved.unit,'mm');
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).measure,fixture.aId),fixture.firstMeasure);
   await page.click('#undo');
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).b.x,fixture.bId),fixture.bEnd.x);
   await redo(page);
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).b.x,fixture.bId),moved.b.x);
   const capturedTimings=await page.evaluate(()=>({
    paintAfterDownMs:__annotationTiming.paintAfterDownMs,
    commitMs:__annotationTiming.commitMs
   }));
   assert(capturedTimings.paintAfterDownMs.length>=4,
    'Real pointerdown did not reach a measured canvas paint');
   assert(capturedTimings.commitMs.length>=1,
    'A completed endpoint drag must invoke commitEditor');
   await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();
   assert.equal(await page.evaluate(()=>current.items.length),6,'Five dimensions and an empty note must persist');
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).measure,fixture.aId),fixture.firstMeasure);
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).b.x,fixture.bId),moved.b.x);
   assert.equal(await page.evaluate(()=>current.items.find(i=>i.type==='note')?.text),'');
   // The timing probe was attached before the reload and is therefore lost.
   // Its numeric results are sampled before leaving the original editor.
   evidence({nativeModel:false,syntheticFixture:true,physicalEvents:true,
    endpointDistancePx:18,overlappingNote:true,dimensions:5,
    undoRedo:true,reopen:true,timings:capturedTimings});
  });
  await step('Five dimension pointer grips, drag, overlap, Undo/Redo and reopen',async()=>{
   await page.click('#editorBack');
   const title='Syntetické kóty 191';
   await createCanvas(page,title);
   const bounds=await page.locator('#drawCanvas').boundingBox();
   assert(bounds&&bounds.width>320&&bounds.height>360,'Canvas dimensions');
   // Positions must be inside the measured image, not viewport fractions:
   // drawing outside photoSize clamps the endpoints at the lower image edge.
   const pts=await page.evaluate(()=>Array.from({length:5},(_,i)=>{
    const y=photoSize.h*(.15+i*.16);
    return {a:worldToScreen({x:photoSize.w*.20,y}),
     b:worldToScreen({x:photoSize.w*.75,y})};
   }));
   for(let i=0;i<5;i++){
    await tool(page,'dimension');await drag(page,pts[i].a,pts[i].b);
    await editSelected(page);
    await page.fill('#measureInput','1250,00000012345678'+i);
    await page.click('#okModal');
   }
   await tool(page,'select');
   const before=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
   assert.equal(before.length,5);
   assert(await page.evaluate(()=>current.items.every(it=>
    it.a.y>0&&it.b.y>0&&it.a.y<photoSize.h-80&&it.b.y<photoSize.h-80
   )),'Precondition: five dimensions must stay inside image bounds');
   let hits=0,visibleSelected=false;
   for(let i=0;i<before.length;i++)for(const part of ['a','middle','b']){
    const item=before[i],point=part==='middle'?{x:(item.a.x+item.b.x)/2,y:(item.a.y+item.b.y)/2}:item[part];
    await page.evaluate(()=>{selected=null;paint()});
    const beforePixels=i===0&&part==='middle'?await page.evaluate(()=>stageCanvas.toDataURL()):null;
    await clickAt(page,await projected(page,point));
    assert.equal(await page.evaluate(()=>selected),item.id,'Wrong dimension at '+i+'/'+part);
    if(beforePixels!==null){
     const selectedPixels=await page.evaluate(()=>stageCanvas.toDataURL());
     assert.notEqual(selectedPixels,beforePixels,'Selection should visibly redraw the actual canvas');
     visibleSelected=true;
    }
    hits++;
   }
   await page.evaluate(()=>{selected=null;paint()});
   // Avoid the wide measurement caption; the touch stays within the drawn line hit band.
   const mid={x:before[2].a.x+(before[2].b.x-before[2].a.x)*.20,y:before[2].a.y+(before[2].b.y-before[2].a.y)*.20};
   const onLine=await projected(page,mid),from={x:onLine.x,y:onLine.y+20};
   await drag(page,from,{x:from.x+19,y:from.y+13});
   const moved=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
   assert.notDeepEqual(moved[2].a,before[2].a,'Center drag did not move a');
   assert.notDeepEqual(moved[2].b,before[2].b,'Center drag did not move b');
   for(let i=0;i<5;i++){
    assert.equal(moved[i].measure,before[i].measure,'Exact value changed');
    if(i!==2)assert.deepEqual(moved[i],before[i],'Unrelated dimension changed');
   }
   await page.click('#undo');
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(current.items))),before);
   await redo(page);
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(current.items))),moved);
   await page.click('#editorBack');await page.reload();
   await page.locator('.entry-title',{hasText:title}).click();
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(current.items))),moved,'Saved dimensions changed after reload');
   // Existing annotations are intentionally hit before drawing even in dimension
   // mode. Create the sixth line in free space, then MOVE it with real gestures
   // to overlap the fifth; drawing directly within 12px selects the old line.
   const fifth=await page.evaluate(()=>{
    const item=current.items[4];return {a:worldToScreen(item.a),b:worldToScreen(item.b)};
   });
   const canvas=await page.locator('#drawCanvas').boundingBox();
   const freeY=await page.evaluate(()=>worldToScreen({x:photoSize.w*.5,y:photoSize.h*.93}).y);
   assert(freeY-fifth.a.y>40&&freeY<canvas.height-15,
    'Require a free image region safely above the photo bottom');
   await tool(page,'dimension');
   await drag(page,{x:fifth.a.x,y:freeY},{x:fifth.b.x,y:freeY});
   await tool(page,'select');
   const created=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
   assert.equal(created.length,6,'The sixth line must be drawn outside existing hit zones');
   const sixth=await page.evaluate(()=>{
    const item=current.items[5];return {a:worldToScreen(item.a),b:worldToScreen(item.b)};
   });
   await page.evaluate(()=>{selected=null;paint()});
   const fromSixth={x:sixth.a.x+(sixth.b.x-sixth.a.x)*.2,y:sixth.a.y+20};
   await drag(page,fromSixth,{x:fromSixth.x,y:fromSixth.y+fifth.a.y+12-sixth.a.y});
   const overlap=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
   assert.equal(overlap.length,6);
   for(let i=0;i<5;i++)assert.deepEqual(overlap[i],moved[i],'Moving sixth dimension changed an existing one');
   const fifthScreen=await projected(page,overlap[4].a),sixthScreen=await projected(page,overlap[5].a);
   assert(Math.abs(sixthScreen.y-fifthScreen.y-12)<1,'Overlapping lines are not 12px apart');
   await page.evaluate(()=>{selected=null;paint()});
   const near=await projected(page,{x:(overlap[5].a.x+overlap[5].b.x)/2,y:(overlap[5].a.y+overlap[5].b.y)/2});
   await clickAt(page,near);
   const chosen=await page.evaluate(()=>selected);
   assert([overlap[4].id,overlap[5].id].includes(chosen),'Overlapping hit must select one of the two close dimensions');
   assert.deepEqual(await page.evaluate(()=>JSON.parse(JSON.stringify(current.items))),overlap,'Overlapping tap changed geometry');
   evidence({actualBrowserPointers:true,dimensions:5,hitChecks:hits,visibleSelected,moveUndoRedoReload:true,overlapDistancePx:12,overlapSelected:chosen===overlap[5].id?'new':'previous',androidRetest:false});
  });
 });
 await test('pan_zoom_fit_and_repeated_reopen',async({page,step,evidence})=>{
  const original=await setup(page),before=await page.evaluate(()=>({...view}));
  await tool(page,'pan');await drag(page,{x:170,y:430},{x:215,y:460});const after=await page.evaluate(()=>({...view}));assert.notEqual(after.dx,before.dx);assert.notEqual(after.dy,before.dy);assert.deepEqual(await record(page),original);
  const box=await page.locator('#drawCanvas').boundingBox();await page.mouse.move(box.x+230,box.y+280);await page.mouse.wheel(0,-180);await page.waitForTimeout(100);assert.notEqual(await page.evaluate(()=>view.zoom),after.zoom);assert.deepEqual(await record(page),original);
  await page.click('#editorTopMenu');await page.getByText('Přizpůsobit fotografii',{exact:true}).click();assert.deepEqual(await record(page),original);
  await step('Ten rapid save/exit/reopen cycles retain one record and exact annotation',async()=>{for(let i=0;i<10;i++){await page.click('#editorBack');await page.locator('.entry-title').click();assert.deepEqual(await record(page),original);assert.equal(await page.evaluate(()=>state.records.length),1)}});
  evidence({reopenCycles:10,pan:true,wheelZoom:true,fit:true});
 });
 await test('chain_finish_insert_remove_history',async({page,step,evidence})=>{
  await createCanvas(page,'Řetězec');await tool(page,'chain');for(const p of [{x:90,y:220},{x:280,y:300},{x:470,y:240}])await clickAt(page,p);
  await tool(page,'select');assert.equal(await page.evaluate(()=>current.items.length),1);assert.equal((await record(page)).points.length,3);
  await clickAt(page,await projected(page,(await record(page)).points[0]));await editSelected(page);await page.fill('#segmentMeasure0','100,000123');await page.fill('#segmentMeasure1','250,000456');await page.click('#okModal');
  await step('Insert/remove middle point through dialog, unaffected segment stays exact',async()=>{
   await editSelected(page);await page.selectOption('#insertSegmentAt','0');await page.click('#insertSegmentPoint');assert.equal((await record(page)).points.length,4);assert.equal((await record(page)).segmentData[2].measure,'250,000456');
   await page.selectOption('#removeSegmentAt','1');await page.click('#removeSegmentPoint');assert.equal((await record(page)).points.length,3);assert.equal((await record(page)).segmentData[1].measure,'250,000456');await page.click('#okModal');
  });
  const saved=await record(page);await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();assert.deepEqual(await record(page),saved);evidence({finishByToolSwitch:true,insert:true,remove:true});
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
