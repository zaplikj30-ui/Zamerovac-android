/* #13: actual captured touch, Back down/up, delayed callbacks and next gesture. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:412,height:850},hasTouch:true}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8765');
 await page.evaluate(async()=>{
  const c=document.createElement('canvas');c.width=1000;c.height=800;c.getContext('2d').fillRect(0,0,1000,800);
  const blob=await new Promise(r=>c.toBlob(r));const media=await storeMedia(new File([blob],'loupe-fixture.png',{type:'image/png'}));
  const photo=newRecord('photo','Lupa při Zpět');photo.media=[media];photo.width=1000;photo.height=800;
  photo.items=[{id:'measured',type:'dimension',a:{x:100,y:200},b:{x:300,y:300},measure:'1585,800001',unit:'mm'}];
  state.records=[photo];save();openRecord(photo.id);
 });
 await page.waitForFunction(()=>!!stageImg);
 async function prepare(){await page.evaluate(()=>{setTool('select');selected='measured';prefs.loupe=true;prefs.snapPoints=false;prefs.snapGrid=false;prefs.snapHorizontal=false;view={zoom:1,dx:0,dy:0};paint()})}
 await prepare();
 const stage=await page.locator('#drawCanvas').boundingBox();const cdp=await page.context().newCDPSession(page);
 const touch=async(type,x,y)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:type==='touchEnd'?[]:[{x:stage.x+x,y:stage.y+y,id:7,force:.7}]});
 await touch('touchStart',100,200);await touch('touchMove',122,215);
 assert(await page.locator('#loupe').isVisible(),'Loupe remains functional during genuine endpoint drag');
 // Saving a real drag may add revision/clock metadata; compare exact user content.
 const beforeBack=await page.evaluate(()=>JSON.stringify(current.items.map(({id,type,a,b,measure,unit})=>({id,type,a,b,measure,unit}))));
 const oldPointer=await page.evaluate(()=>[...pointers.keys()][0]);
 await page.evaluate(()=>{
  window.__leaving=false;window.__loupeFlashes=0;
  const canvas=$('loupe'),descriptor=Object.getOwnPropertyDescriptor(HTMLElement.prototype,'hidden');
  Object.defineProperty(canvas,'hidden',{configurable:true,get(){return descriptor.get.call(this)},set(value){if(__leaving&&!value)__loupeFlashes++;descriptor.set.call(this,value)}});
  $('editorBack').addEventListener('pointerdown',()=>__leaving=true,{capture:true});
 });
 const back=await page.locator('#editorBack').boundingBox();
 await page.mouse.move(back.x+back.width/2,back.y+back.height/2);await page.mouse.down();
 assert.equal(await page.locator('#loupe').isVisible(),false,'Already hidden at Back down, before click');
 assert.equal(await page.evaluate(()=>pointers.size),0,'Captured touch is retired before queued moves');
 await page.mouse.up();assert.equal(await page.evaluate(()=>screen),'browser');
 await touch('touchEnd');
 await page.evaluate(id=>{
  for(const type of ['pointermove','pointerup','pointercancel'])stageCanvas.dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:190,clientY:240,bubbles:true}));
  paint();drawLoupe();
 },oldPointer);
 for(let i=0;i<3;i++)await page.evaluate(()=>new Promise(requestAnimationFrame));
 assert.equal(await page.evaluate(()=>__loupeFlashes),0);assert.equal(await page.locator('#loupe').isVisible(),false);
 assert.equal(await page.evaluate(()=>JSON.stringify(state.records[0].items.map(({id,type,a,b,measure,unit})=>({id,type,a,b,measure,unit})))),beforeBack,'Back preserves dragged geometry and exact measurement');
 await page.evaluate(()=>{__leaving=false;openRecord(state.records[0].id)});await page.waitForFunction(()=>!!stageImg);await prepare();
 await page.evaluate(id=>{
  stageCanvas.dispatchEvent(new PointerEvent('pointerup',{pointerId:id,bubbles:true}));
  stageCanvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:id,bubbles:true}));
  paint();
 },oldPointer);
 assert.equal(await page.locator('#loupe').isVisible(),false);assert.equal(await page.locator('#modal').isVisible(),false);
 // A fresh real touch still shows the loupe; old pointer cancellation must not end it.
 const endpoint=await page.evaluate(()=>current.items[0].a);
 await touch('touchStart',endpoint.x,endpoint.y);assert(await page.locator('#loupe').isVisible());
 await page.evaluate(()=>stageCanvas.dispatchEvent(new PointerEvent('pointercancel',{pointerId:9999,bubbles:true})));
 assert(await page.locator('#loupe').isVisible());await touch('touchEnd');
 if(await page.locator('#modal').isVisible())await page.click('#cancelModal');
 await page.click('#editorBack');assert.equal(await page.locator('#loupe').isVisible(),false);
 await page.reload();assert.equal(await page.evaluate(()=>JSON.stringify(state.records[0].items.map(({id,type,a,b,measure,unit})=>({id,type,a,b,measure,unit})))),beforeBack);
 // Returning from an annotated inset uses a separate exit wrapper.
 await page.evaluate(()=>{
  const parent=state.records[0],note={id:'nested-note',type:'note',a:{x:600,y:500},text:'Detail',media:[parent.media[0]],detailItems:JSON.parse(JSON.stringify(parent.items))};
  parent.items.push(note);save();openNestedPhoto(parent,note,parent.media[0]);
 });
 await page.waitForFunction(()=>!!stageImg);await prepare();
 const nestedPoint=await page.evaluate(()=>current.items[0].a);
 await touch('touchStart',nestedPoint.x,nestedPoint.y);assert(await page.locator('#loupe').isVisible());
 await page.click('#editorBack');await touch('touchEnd');await page.waitForFunction(()=>!!stageImg&&!current._detailTemporary);
 assert.equal(await page.locator('#loupe').isVisible(),false);assert.equal(await page.evaluate(()=>pointers.size),0);
 assert.equal(await page.evaluate(()=>current.items.at(-1).detailItems[0].measure),'1585,800001');
 assert.deepEqual(errors,[]);
 console.log('OK: actual touch loupe, Back down/click with captured pointer, delayed move/up/cancel, reopen and exact persisted coordinates/measurement');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
