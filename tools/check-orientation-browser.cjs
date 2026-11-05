/* #26: real viewport rotations, synthetic media, no private files or APK. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:360,height:800},hasTouch:true}),errors=[];
 page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8765');
 await page.evaluate(async()=>{
  const image=document.createElement('canvas');image.width=1400;image.height=900;
  const c=image.getContext('2d');c.fillStyle='#79969f';c.fillRect(0,0,1400,900);
  const blob=await new Promise(resolve=>image.toBlob(resolve));const id=await storeMedia(new File([blob],'rotation.png',{type:'image/png'}));
  const folder=newRecord('folder','Orientace – zakázka'),photo=newRecord('photo','Foto');photo.parentId=folder.id;photo.media=[id];photo.width=1400;photo.height=900;
  photo.items=[{id:'dimension',type:'dimension',a:{x:100,y:120},b:{x:800,y:320},measure:'1585,800001',unit:'mm',text:'Přesná kóta'},
   {id:'note',type:'note',a:{x:200,y:300},text:'Původní text poznámky',media:[]}];
  state.records=[folder,photo];currentFolder=folder.id;showFolder();save();openRecord(photo.id);
 });
 await page.waitForFunction(()=>!!stageImg);
 await page.evaluate(()=>{setTool('chain');polylineDraft=[{x:100,y:150},{x:600,y:400}];selected='dimension';view={zoom:1.37,dx:-200,dy:-140};paint();$('editorMore').click()});
 const snapshot=await page.evaluate(()=>JSON.stringify({items:current.items,draft:polylineDraft,selected,mode,folder:currentFolder,undo:editStack,redo:redoStack}));
 const centre=()=>page.evaluate(()=>({x:(stageCanvas.clientWidth/2-view.dx)/view.zoom,y:(stageCanvas.clientHeight/2-view.dy)/view.zoom,zoom:view.zoom}));
 const initialCentre=await centre();
 async function rotate(size){
  await page.setViewportSize(size);
  await page.waitForFunction(()=>stageCanvas.width===Math.round($('stage').clientWidth*devicePixelRatio)&&stageCanvas.height===Math.round($('stage').clientHeight*devicePixelRatio));
 }
 async function reachable(selector){
  const el=page.locator(selector);await el.scrollIntoViewIfNeeded();
  const box=await el.boundingBox(),size=page.viewportSize();
  assert(box&&box.x>=-1&&box.y>=-1&&box.x+box.width<=size.width+1&&box.y+box.height<=size.height+1,selector+' outside viewport '+JSON.stringify(box));
  assert(await el.evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),selector+' overlapped');
 }
 const sizes=[{width:320,height:568},{width:568,height:320},{width:360,height:800},{width:800,height:360},{width:412,height:915},{width:915,height:412},{width:768,height:1024},{width:1024,height:768},{width:1280,height:800},{width:800,height:1280},{width:500,height:400}];
 for(const size of sizes){
  await page.evaluate(()=>setEditorExtraToolbarExpanded(true));
  await rotate(size);assert(await page.locator('#editorExtraToolbar').isVisible());
  assert.equal(await page.evaluate(()=>JSON.stringify({items:current.items,draft:polylineDraft,selected,mode,folder:currentFolder,undo:editStack,redo:redoStack})),snapshot,'Rotation changes no annotation, draft or selection');
  const now=await centre();assert.equal(now.zoom,initialCentre.zoom);assert(Math.abs(now.x-initialCentre.x)<.01&&Math.abs(now.y-initialCentre.y)<.01,'Keep world centre on rotate');
  const geometry=await page.locator('.toolbar > [data-toolbar-key]:visible').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return {id:el.id,x:r.x,y:r.y,w:r.width,h:r.height}}));
  assert.equal(geometry.length,7);
  for(const r of geometry){assert(r.w>=39&&r.w<=65,r.id+' must have bounded width');assert(r.h>=40&&r.h<=55);await reachable('#'+r.id)}
  assert(await page.locator('#stage').evaluate(el=>el.clientHeight>=90),'Photo retains usable space in short landscape');
  const icons=await page.locator('.toolbar svg:visible,#editorExtraToolbar svg:visible,.last-tool-glyph:visible').evaluateAll(els=>els.map(el=>{const r=el.getBoundingClientRect();return [r.width,r.height]}));
  for(const [w,h] of icons){assert(w<=32.1&&h<=32.1);assert(Math.abs(w-h)<.2,'Square icon proportions')}
  await reachable('#editorExtraToolbar > [data-toolbar-key]:first-child');await reachable('#editorExtraToolbar > [data-toolbar-key]:last-child');
  await page.click('#toolsToggle');assert(await page.locator('#toolMenu').isVisible());
  await reachable('#toolMenu .toolList .choice:last-child');await page.evaluate(()=>window.handleAndroidBack());
 }
 fs.mkdirSync('/tmp/zamerovac-orientation',{recursive:true});await page.screenshot({path:'/tmp/zamerovac-orientation/editor-landscape.png'});
 // Rotation with an unsaved numeric dialog must retain exactly what was typed.
 await page.evaluate(()=>{polylineDraft=[];setTool('select');editItem(current.items[0])});
 await page.fill('#measureInput','1585,800003');
 for(const size of [{width:360,height:800},{width:800,height:360}]){
  await rotate(size);assert.equal(await page.inputValue('#measureInput'),'1585,800003');await reachable('#okModal');
  assert.equal(await page.evaluate(()=>current.items[0].measure),'1585,800001');
 }
 await page.click('#okModal');assert.equal(await page.evaluate(()=>current.items[0].measure),'1585,800003');
 await page.evaluate(()=>openRichNote(current.items[1],false));await page.fill('#richText','Dosud neuložená poznámka\npři otočení');
 for(const size of [{width:768,height:1024},{width:1024,height:768},{width:568,height:320}]){
  await rotate(size);assert.equal(await page.inputValue('#richText'),'Dosud neuložená poznámka\npři otočení');await reachable('#okModal');
  assert.equal(await page.evaluate(()=>current.items[1].text),'Původní text poznámky');
 }
 await page.click('#okModal');await page.evaluate(()=>{commitEditor();exitEditor()});
 const saved=await page.evaluate(()=>JSON.stringify(state.records));
 // Browser controls remain inside the viewport, including small phones.
 for(const size of sizes){await page.setViewportSize(size);for(const id of ['createBtn','galleryBtn','browseGallery','bluetoothBtn','boschHistoryBtn','cloudBtn'])await reachable('#'+id)}
 await page.click('#browseGallery');await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>1);
 await page.evaluate(()=>{
  const image=document.querySelector('.gallery-img');
  const send=(type,distance)=>{const touches=[new Touch({identifier:1,target:image,clientX:100,clientY:100}),new Touch({identifier:2,target:image,clientX:100+distance,clientY:100})];image.dispatchEvent(new TouchEvent(type,{touches,bubbles:true,cancelable:true}))};
  send('touchstart',60);send('touchmove',120);
 });
 const transform=await page.locator('.gallery-img').evaluate(el=>el.style.transform);
 for(const size of sizes){
  await page.setViewportSize(size);
  await page.waitForFunction(()=>{const c=document.querySelector('.gallery-img'),box=document.querySelector('.gallery-content');return parseFloat(c.style.width)<=box.clientWidth+1&&parseFloat(c.style.height)<=box.clientHeight+1});
  const ratio=await page.locator('.gallery-img').evaluate(el=>{const r=el.getBoundingClientRect();return {rendered:r.width/r.height,image:el.width/el.height}});
  assert(Math.abs(ratio.rendered-ratio.image)<.01,'Gallery canvas proportions');
  assert.equal(await page.locator('.gallery-img').evaluate(el=>el.style.transform),transform,'Gallery pinch zoom survives rotate');
  await reachable('.gallery-top [data-action="close"]');await reachable('.gallery-top [data-action="edit"]');
  assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),saved);
 }
 await page.click('.gallery-top [data-action="close"]');await page.reload();
 assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),saved,'Exact values and text survive restart');
 assert.deepEqual(errors,[]);
 // The actual openRecord wrapper must select the native video player on Android.
 const nativePage=await browser.newPage();await nativePage.addInitScript(()=>{
  window.Native=new Proxy({loadData:()=>JSON.stringify({schema:1,records:[{id:'video-record',kind:'video',media:['synthetic-video'],title:'Video'}]}),getAppVersion:()=> '1.2.149-test',openVideo:id=>window.__openedMedia=id,openMedia:()=>{throw Error("Legacy video routed to MIME-based dispatch")}},{get:(object,key)=>object[key]||(()=> '')});
 });
 await nativePage.goto(process.argv[2]||'http://127.0.0.1:8765');await nativePage.evaluate(()=>openRecord('video-record'));
 assert.equal(await nativePage.evaluate(()=>__openedMedia),'synthetic-video');assert.equal(await nativePage.locator('.mediaOverlay').count(),0);await nativePage.close();
 console.log('OK: #26 eleven phone/tablet viewports, bounded icons, accessible tools/menus/gallery, zoom/draft/dialog/text/persistence and native video routing');
 }finally{await browser.close()}
})().catch(error=>{console.error(error);process.exitCode=1});
