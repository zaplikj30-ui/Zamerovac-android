/* Run against a local server: node tools/check-post17-browser.cjs http://127.0.0.1:8765 */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:412,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8765');
 await page.evaluate(()=>{
  const r=newRecord('canvas','Regrese #17');state.records.push(r);openEditor(r);
 });
 for(const selector of ['#toolsToggle','#editorTopMenu']){
  const target=selector==='#toolsToggle'?'toolMenu':'editorOverflow';
  await page.click(selector);assert.equal(await page.locator('#'+target).isVisible(),true);
  await page.click(selector);assert.equal(await page.locator('#'+target).isVisible(),false);
  await page.click(selector);await page.evaluate(()=>window.handleAndroidBack());
  assert.equal(await page.locator('#'+target).isVisible(),false);assert.equal(await page.evaluate(()=>screen),'editor');
 }
 await page.evaluate(()=>{setTool('chain');prefs.snapPoints=false;prefs.snapHorizontal=false;view={zoom:1,dx:0,dy:0}});
 assert.equal(await page.locator('#editorHint').innerText(),'Vyber počáteční bod');
 const box=await page.locator('#drawCanvas').boundingBox();
 for(const [x,y] of [[70,130],[170,130],[250,210]])await page.mouse.click(box.x+x,box.y+y);
 assert.equal(await page.locator('#editorHint').innerText(),'Klepni pro další navazující kótu');
 await page.click('#toolsToggle');await page.evaluate(()=>window.handleAndroidBack());
 assert.equal(await page.evaluate(()=>polylineDraft.length),3,'Back closes menu without losing draft');
 await page.click('#activeTool');
 assert.equal(await page.evaluate(()=>current.items.length),1);assert.equal(await page.locator('#editorHint').isVisible(),false);
 await page.evaluate(()=>{current.items[0].segmentData[0]={measure:'123,456789',unit:'cm',text:'Ahoj'};commitEditor();editItem(current.items[0])});
 const geometry=await page.evaluate(()=>{const a=$('segmentMeasure0').getBoundingClientRect(),b=$('segmentUnit0').getBoundingClientRect();return {sameRow:Math.abs(a.y-b.y)<1,valueWidth:a.width,unitWidth:b.width,unit:$('segmentUnit0').value}});
 assert.equal(geometry.sameRow,true);assert(geometry.valueWidth>geometry.unitWidth*2);assert.equal(geometry.unit,'cm');
 await page.click('#okModal');
 await page.reload();
 assert.equal(await page.evaluate(()=>state.records[0].items[0].segmentData[0].measure),'123,456789');
 assert.equal(await page.evaluate(()=>state.records[0].items[0].segmentData[0].unit),'cm');
 // Old schema plus arbitrary project/note/history fields must survive save/reload.
 await page.evaluate(()=>{state.records[0].legacyUnknown={precision:'0.000000123',notes:'Soukromé'};state.records[0].versionHistory=[{items:'opaque'}];save()});
 await page.reload();
 assert.deepEqual(await page.evaluate(()=>state.records[0].legacyUnknown),{precision:'0.000000123',notes:'Soukromé'});
 assert.equal(await page.evaluate(()=>state.records[0].versionHistory[0].items),'opaque');
 // Restoring in the current folder redraws the list immediately.
 await page.evaluate(()=>{const photo=newRecord('photo','Obnovit');photo.deleted=true;state.records.push(photo);showFolder();showTrash()});
 await page.locator('[data-restore]').click();await page.click('#okModal');
 assert.equal(await page.locator('.entry-title').filter({hasText:'Obnovit'}).count(),1);
 // Customer render uses selected groups; no annotation/model edits, ratio retained.
 const result=await page.evaluate(async()=>{
  const source=document.createElement('canvas');source.width=800;source.height=400;
  const c=source.getContext('2d');c.fillStyle='#ffffff';c.fillRect(0,0,800,400);
  const imageUrl=source.toDataURL();assetUrl=async()=>imageUrl;
  const rec={id:'customer-test',kind:'photo',media:['test'],items:[
   {id:'dim',type:'dimension',a:{x:100,y:150},b:{x:500,y:150},measure:'1250,123',unit:'mm',color:'#f7dc27'},
   {id:'note',type:'note',a:{x:200,y:200},text:'PRIVATE'},
   {id:'arrow',type:'arrow',a:{x:100,y:250},b:{x:500,y:250},color:'#f7dc27'}]};
  const before=JSON.stringify(rec),stateBefore=JSON.stringify(state),viewBefore=JSON.stringify(view);
  const opts={dimensions:true,drawing:true,notes:false};
  const types=window.__customerExport.selectedItems(rec,opts).map(x=>x.type);
  const png=await window.__customerExport.render(rec,opts);
  const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
  return {types,w:image.naturalWidth,h:image.naturalHeight,unchanged:JSON.stringify(rec)===before&&JSON.stringify(state)===stateBefore&&JSON.stringify(view)===viewBefore};
 });
 assert.deepEqual(result,{types:['dimension','arrow'],w:800,h:400,unchanged:true});
 await page.evaluate(()=>{prefs.backgroundPattern='Jemné tečky';save();showFolder()});await page.reload();
 assert.equal(await page.locator('body').getAttribute('data-background-pattern'),'Jemné tečky');
 await page.screenshot({path:'/tmp/post17-browser.png'});
 assert.deepEqual(errors,[],'No runtime errors');
 await browser.close();console.log('OK: full browser menus/Back/draft/units/persistence/trash/customer render/background, no JS runtime errors');
})().catch(e=>{console.error(e);process.exit(1)});
