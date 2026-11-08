'use strict';
const {suite,assert,createCanvas,tool,drag,projected}=require('./harness.cjs');
(async()=>suite('update39',async test=>{
 await test('gallery_bounded_pan_and_caption_pixels',async({page,step,evidence})=>{
  await page.evaluate(()=>{
   window.captionInk=null;const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,max){
    const result=fill.call(this,text,x,y,max);
    if(this.canvas.classList.contains('gallery-img')&&text==='Všechny anotace'){
     const t=this.getTransform(),m=this.measureText(text),p=t.transformPoint({x,y});
     const sx=Math.hypot(t.a,t.b),sy=Math.hypot(t.c,t.d),density=this.canvas.width/this.canvas.clientWidth;
     captionInk={x:p.x,y:p.y,w:Math.min(m.width,max||m.width)*sx,h:parseFloat(this.font.match(/[\d.]+px/)[0])*sy,density};
    }return result;
   };
  });
  const before=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=1200;c.height=800;c.getContext('2d').fillRect(0,0,1200,800);
   const blob=await new Promise(r=>c.toBlob(r)),id=await storeMedia(new File([blob],'synthetic.png',{type:'image/png'}));
   const r=newRecord('photo','Synthetic gallery');r.media=[id];r.items=[{id:'caption',type:'note',a:{x:250,y:300},text:'Všechny anotace',media:[id],insetX:800,insetY:780,insetWidth:300,fontSize:28}];state.records=[r];save();document.getElementById('browseGallery').click();return JSON.stringify(state);
  });
  await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>300);
  assert(await page.evaluate(async()=>await loadPhotoImage(state.records[0].media[0])===await loadPhotoImage(state.records[0].media[0])),'decoded photo reused without changing original');
  assert.equal(await page.locator('.gallery-bottom').count(),0);
  // Inspect the real rendered caption outside the source photo: yellow glyph pixels must exist below inset.
  await page.waitForFunction(()=>!!captionInk);
  const caption=await page.evaluate(()=>{
   const c=document.querySelector('.gallery-img'),v=JSON.parse(c.dataset.galleryView),s=captionInk;
   const x=Math.max(0,Math.floor(s.x-s.w/2)),y=Math.max(0,Math.floor(s.y-s.h/2));
   const w=Math.min(c.width-x,Math.ceil(s.w)),h=Math.min(c.height-y,Math.ceil(s.h));
   const data=c.getContext('2d').getImageData(x,y,w,h).data;let yellow=0;
   for(let i=0;i<data.length;i+=4)if(data[i]>180&&data[i+1]>150&&data[i+2]<100)yellow++;
   return {yellow,widthCss:s.w/s.density,heightCss:s.h/s.density,belowInset:s.y/s.density>v.dy+(780+200)*v.scale};
  });
  const pixels=caption.yellow;
  assert(caption.belowInset,'Caption must follow the actual inset bottom');
  assert(caption.widthCss>150,'Caption must not be squeezed to a hidden editor viewport');
  assert(caption.heightCss>=20&&pixels>20,'Real caption glyph pixels must be visible below the inset');
  for(const viewport of [{width:600,height:950},{width:1100,height:650}]){
   await page.setViewportSize(viewport);await page.waitForTimeout(100);await page.locator('.gallery-img').dblclick();
   for(const [x,y] of [[8000,0],[-8000,0],[0,8000],[0,-8000]]){
    await page.evaluate(([dx,dy])=>{const el=document.querySelector('.gallery-img');const event=(type,touches)=>el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,touches:touches.map(([clientX,clientY])=>new Touch({identifier:1,target:el,clientX,clientY}))}));event('touchstart',[[200,200]]);event('touchmove',[[200+dx,200+dy]]);event('touchend',[])},[x,y]);
    const geometry=await page.evaluate(()=>{const a=document.querySelector('.gallery-img').getBoundingClientRect(),b=document.querySelector('.gallery-content').getBoundingClientRect();return {left:Math.max(a.left,b.left),right:Math.min(a.right,b.right),top:Math.max(a.top,b.top),bottom:Math.min(a.bottom,b.bottom)}});
    assert(geometry.right>geometry.left&&geometry.bottom>geometry.top,'photo remains reachable after extreme pan');
   }
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);evidence({yellowCaptionPixels:pixels,originalDataUnchanged:true});
 });
 await test('default_selection_corner_loupe_and_landscape_tools',async({page,step})=>{
  await createCanvas(page,'Synthetic corners');assert.equal(await page.evaluate(()=>mode),'select');
  await tool(page,'rect');await drag(page,{x:100,y:200},{x:300,y:400});
  await page.evaluate(()=>{current.items[0].measure='1234,123456789';setTool('select');selected=current.items[0].id;paint()});
  const item=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items[0]))),start=await projected(page,item.a),box=await page.locator('#drawCanvas').boundingBox();
  await page.mouse.move(box.x+start.x,box.y+start.y);await page.mouse.down();await page.mouse.move(box.x+start.x+30,box.y+start.y+30,{steps:5});assert(await page.locator('#loupe').isVisible());await page.mouse.up();assert.equal(await page.locator('#loupe').isVisible(),false);assert.equal(await page.evaluate(()=>current.items[0].measure),'1234,123456789');
  assert.equal(await page.locator('[data-landscape-tool]:visible').count(),0);
  const snapshot=await page.evaluate(()=>JSON.stringify(current.items));await page.setViewportSize({width:1280,height:800});await page.waitForTimeout(100);assert(await page.locator('[data-landscape-tool]:visible').count()>3);
  await page.click('#toolsToggle');await page.click('#configureLandscapeTools');await page.locator('[data-landscape-choice="dimension"]').uncheck();await page.click('#okModal');assert.equal(await page.locator('[data-landscape-tool="dimension"]').count(),0);
  await page.evaluate(()=>{const order=window.__getToolbarIconOrder(),index=order.indexOf('editorMore');[order[index],order[7]]=[order[7],order[index]];window.__applyToolbarIconOrder(order)});
  assert(await page.locator('[data-landscape-drawer]').isVisible());await page.click('[data-landscape-drawer]');assert(await page.locator('#editorExtraToolbar').isVisible());await page.click('[data-landscape-drawer]');
  await page.setViewportSize({width:600,height:950});assert.equal(await page.locator('[data-landscape-tool]:visible').count(),0);assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),snapshot);
 });
 await test('real_save_failure_and_photo_loading_errors',async({page})=>{
  await createCanvas(page,'Quota synthetic');
  const before=await page.evaluate(()=>persistedSnapshot);
  const result=await page.evaluate(()=>{window.__originalSetItem=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key==='zamerovac-data')throw new DOMException('Synthetic quota','QuotaExceededError');return __originalSetItem.call(this,key,value)};current.title='Local unsaved edit';return save()});
  assert.equal(result,false);assert(await page.locator('#saveErrorBanner').isVisible());assert.equal(await page.evaluate(()=>persistedSnapshot),before);assert.equal(await page.evaluate(()=>localStorage.getItem('zamerovac-data')),before);
  await page.evaluate(()=>{Storage.prototype.setItem=window.__originalSetItem});await page.locator('#saveErrorBanner button').click();assert.equal(await page.locator('#saveErrorBanner').count(),0);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-data')).records[0].title),'Local unsaved edit');
  await page.evaluate(()=>{const r=newRecord('photo','Missing synthetic image');r.media=['nonexistent-media'];r.items=[{id:'must-not-draw',type:'dimension',a:{x:0,y:0},b:{x:900,y:800},measure:'123,000001',unit:'mm'}];state.records.push(r);openEditor(r)});
  await page.waitForFunction(()=>photoLoadFailed===true);assert.equal(await page.evaluate(()=>stageImg),null);assert.equal(await page.evaluate(()=>current.items[0].measure),'123,000001');assert.equal(await page.locator('#loupe').isVisible(),false);
 });
 await test('help_occurrences_and_neutral_bluetooth',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>openZamerovacHelp());await page.fill('#helpSearch','kota');const count=await page.locator('mark[data-help-match]').count();assert(count>=4);assert.match(await page.locator('#helpOccurrenceCount').innerText(),/^1 z /);await page.click('#helpNextMatch');assert.match(await page.locator('#helpOccurrenceCount').innerText(),/^2 z /);await page.click('#helpPreviousMatch');assert.match(await page.locator('#helpOccurrenceCount').innerText(),/^1 z /);await page.click('#helpPreviousMatch');assert.match(await page.locator('#helpOccurrenceCount').innerText(),new RegExp('^'+count+' z '));await page.fill('#helpSearch','první použití');assert.equal(await page.locator('mark[data-help-match]').count(),0);assert(await page.locator('#helpNextMatch').isDisabled());await page.fill('#helpSearch',await page.evaluate(()=>ZamerovacHelp.chapters[0].intro));assert.equal(await page.locator('mark[data-help-match]').count(),1);await page.click('#helpNextMatch');assert.equal(await page.locator('#helpOccurrenceCount').innerText(),'1 z 1 výskytů');await page.fill('#helpSearch','zzzznothere');assert(await page.locator('#helpNextMatch').isDisabled());assert.equal(await page.locator('mark').count(),0);await page.click('#helpBack');assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  await page.click('#bluetoothBtn');assert.equal(await page.locator('#modalTitle').innerText(),'Bluetooth měřič');assert.match(await page.locator('#modalBody').innerText(),/Bluetooth: odpojeno/);await page.click('#okModal');await page.evaluate(()=>onLaserStatus(JSON.stringify({status:'connected',name:'Bosch synthetic'})));assert.match(await page.locator('#bluetoothBtn').getAttribute('title'),/Bluetooth: připojeno.*Bosch synthetic/);
 });
}))();
