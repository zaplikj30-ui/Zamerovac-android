'use strict';
const {suite,assert,createCanvas,tool,drag,clickAt,editSelected,record,projected,redo}=require('./harness.cjs');
async function dismiss(page){if(await page.locator('#modal').isVisible())await page.click('#cancelModal')}
async function setup(page){await createCanvas(page,'Gesta – syntetická');await tool(page,'dimension');await drag(page,{x:100,y:180},{x:470,y:360});await editSelected(page);await page.fill('#measureInput','1250,000000123');await page.fill('#dimensionCaption','Český <script>window.__xss=1</script> 😀');await page.click('#okModal');return record(page)}
(async()=>suite('interactions',async test=>{
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
    const c={x:(a.a.x+a.b.x)/2,y:(a.a.y+a.b.y)/2+35/view.zoom};
    current.items.push(b,{id:uid(),type:'note',a:c,b:{...c},text:'',
      media:[],color:prefs.color,fontSize:prefs.fontSize,width:prefs.lineWidth});
    if(save()!==true)throw Error('Synthetic fixture was not confirmed saved');
    paint();
    return {aId:a.id,bId:b.id,a:a.a,b:b.a,bEnd:b.b,
      firstMeasure:a.measure,secondMeasure:b.measure};
   });
   await tool(page,'select');
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
   await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();
   assert.equal(await page.evaluate(()=>current.items.length),3);
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).measure,fixture.aId),fixture.firstMeasure);
   assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).b.x,fixture.bId),moved.b.x);
   assert.equal(await page.evaluate(()=>current.items.find(i=>i.type==='note')?.text),'');
   evidence({nativeModel:false,syntheticFixture:true,physicalEvents:true,
    endpointDistancePx:18,overlappingNote:true,undoRedo:true,reopen:true});
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
