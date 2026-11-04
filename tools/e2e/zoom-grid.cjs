'use strict';
// ImageMeter/Zaměřovač #28: actual zoom gestures, grid pixels, snap independence,
// exact dimensions after reload. Synthetic local canvas only, no customer photos.
const {suite,assert,createCanvas,tool,drag,editSelected,record}=require('./harness.cjs');
const originalPrefs=page=>page.evaluate(()=>({showGrid:prefs.showGrid,snapGrid:prefs.snapGrid,step:prefs.gridStep}));
async function dimension(page,name){
 await createCanvas(page,name);
 await tool(page,'dimension');
 await drag(page,{x:140,y:270},{x:450,y:420});
 await editSelected(page);
 await page.fill('#measureInput','1585,800001');
 await page.fill('#dimensionCaption','Přesná kóta – zoom');
 await page.click('#okModal');
 await tool(page,'pan');
 return record(page);
}
(async()=>suite('zoom-grid',async test=>{
 await test('buttons_grid_pixels_and_snap_independence',async({page,step,evidence})=>{
  const original=await dimension(page,'Zoom – syntetický náčrt');
  const before=await page.evaluate(()=>view.zoom);
  await step('Zoom + then - uses actual buttons, without changing saved measurements',async()=>{
   await page.click('#zoomIn');
   const up=await page.evaluate(()=>view.zoom);
   assert(up>before,'Zoom + must increase scale');
   await page.click('#zoomOut');
   const down=await page.evaluate(()=>view.zoom);
   assert(down<up,'Zoom - must decrease scale');
   assert.deepEqual(await record(page),original);
  });
  const grid=await step('Visual raster is controlled by showGrid, not magnetic snapGrid',()=>page.evaluate(()=>{
   const old={showGrid:prefs.showGrid,snapGrid:prefs.snapGrid,gridStep:prefs.gridStep};
   const canvas=stageCanvas,context=canvas.getContext('2d'),capture=()=>{
    paint();return new Uint8ClampedArray(context.getImageData(0,0,canvas.width,canvas.height).data);
   };
   const changes=(a,b)=>{let count=0;for(let i=0;i<a.length;i+=4)
    if(Math.abs(a[i]-b[i])+Math.abs(a[i+1]-b[i+1])+Math.abs(a[i+2]-b[i+2])>7)count++;
    return count;};
   try{
    prefs.gridStep=40;
    prefs.showGrid=false;prefs.snapGrid=false;const noGrid=capture();
    prefs.snapGrid=true;const magnetOn=capture();
    prefs.snapGrid=false;prefs.showGrid=true;const gridOn=capture();
    return{magnetOnly:changes(noGrid,magnetOn),visibleGrid:changes(noGrid,gridOn),
      totalPixels:canvas.width*canvas.height,gridStep:prefs.gridStep,zoom:view.zoom};
   }finally{prefs.showGrid=old.showGrid;prefs.snapGrid=old.snapGrid;prefs.gridStep=old.gridStep;paint();}
  }));
  assert.equal(grid.magnetOnly,0,'Snap alone must not draw checkerboard/grid');
  assert(grid.visibleGrid>100,'Explicit showGrid must render detectable raster pixels');
  assert(grid.visibleGrid<grid.totalPixels*.20,'Grid should be thin lines, not opaque square tiles');
  assert.deepEqual(await record(page),original);
  await page.click('#editorBack');
  await page.reload();
  await page.locator('.entry-title',{hasText:'Zoom – syntetický náčrt'}).click();
  assert.deepEqual(await record(page),original);
  evidence(grid);
 });
 await test('trusted_two_finger_pinch_and_limits',async({page,step,evidence})=>{
  const original=await dimension(page,'Pinch – syntetický náčrt');
  const before=await page.evaluate(()=>view.zoom),bounds=await page.locator('#drawCanvas').boundingBox();
  const x=bounds.x+bounds.width/2,y=bounds.y+bounds.height/2;
  const cdp=await page.context().newCDPSession(page);
  try{
   await step('Two real touch points pinch out and preserve exact annotation',async()=>{
    await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x:x-35,y,id:101},{x:x+35,y,id:102}]});
    for(let n=1;n<=5;n++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x-35-n*16,y,id:101},{x:x+35+n*16,y,id:102}]});
    await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
    await page.waitForTimeout(80);
    const after=await page.evaluate(()=>view.zoom);
    assert(after>before*1.35,'Pinch must visibly enlarge photo/canvas');
    assert.deepEqual(await record(page),original);
   });
  }finally{await cdp.detach();}
  await step('Zoom extremes clamp safely and fit restores finite canvas geometry',async()=>{
   for(let i=0;i<28;i++)await page.click('#zoomIn');
   let z=await page.evaluate(()=>view.zoom);
   assert(z<=12.00001&&z>0,'Maximum zoom must be bounded');
   for(let i=0;i<45;i++)await page.click('#zoomOut');
   z=await page.evaluate(()=>view.zoom);
   assert(z>=.04999&&z<=12,'Minimum zoom must be bounded');
   await page.click('#editorTopMenu');
   await page.getByText('Přizpůsobit fotografii',{exact:true}).click();
   const pos=await page.evaluate(()=>({zoom:view.zoom,dx:view.dx,dy:view.dy,items:current.items.length}));
   assert(Number.isFinite(pos.zoom)&&pos.zoom>0&&Number.isFinite(pos.dx)&&Number.isFinite(pos.dy));
   assert.equal(pos.items,1);
   assert.deepEqual(await record(page),original);
   evidence(pos);
  });
  await page.click('#editorBack');await page.reload();
  await page.locator('.entry-title',{hasText:'Pinch – syntetický náčrt'}).click();
  assert.deepEqual(await record(page),original);
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
