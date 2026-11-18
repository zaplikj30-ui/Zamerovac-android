'use strict';
const {suite,assert,createCanvas,chooseFiles,tool,drag,editSelected,record}=require('./harness.cjs');
const row=(page,title)=>page.locator('.entry').filter({has:page.locator('.entry-title').filter({hasText:title})});
async function add(page,label){await page.click('#createBtn');await page.locator('#newMenu .choice').filter({hasText:label}).click()}
async function folder(page,title){await add(page,'Nová složka');await page.fill('#promptValue',title);await page.click('#okModal')}
async function actions(page,title){
 // The feedback flag is deliberately draggable. Exercise its real UI instead of force-clicking through it.
 const flag=page.locator('#feedbackFlag'),box=await flag.boundingBox();
 if(box){await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.mouse.move(25,750,{steps:12});await page.mouse.up()}
 await row(page,title).locator('.entry-more').click();
}
async function trash(page){await page.click('#back');await page.locator('#navMenu .appMenuItem').filter({hasText:'Koš'}).click()}
async function png(page,color='#a0a0a0',width=800,height=600){return Buffer.from(await page.evaluate(({color,width,height})=>{const c=document.createElement('canvas');c.width=width;c.height=height;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,width,height);return c.toDataURL('image/png').split(',')[1]},{color,width,height}),'base64')}
async function upload(page,name,color,width,height){const buffer=await png(page,color,width,height);await chooseFiles(page,'#galleryBtn',{name,mimeType:'image/png',buffer});await page.waitForFunction(()=>screen==='editor'&&!!stageImg);return buffer}
async function hashes(page){return page.evaluate(async()=>{
 const db=await mediaDb(),pairs=await new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly'),store=tx.objectStore('files'),req=store.openCursor(),pairs=[];req.onerror=reject;req.onsuccess=()=>{const cursor=req.result;if(!cursor)return resolve(pairs);pairs.push([cursor.key,cursor.value]);cursor.continue()}});
 const result={};for(const [id,blob] of pairs)result[id]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),x=>x.toString(16).padStart(2,'0')).join('');return result;
})}
async function links(page){return page.evaluate(async()=>{
 const ids=new Set(state.records.map(r=>r.id)),media=new Set();const walk=items=>{for(const i of items||[]){for(const id of i.media||[])media.add(id);walk(i.detailItems)}};
 if(ids.size!==state.records.length)throw Error('Duplicate record IDs');
 for(const r of state.records){if(r.parentId&&!ids.has(r.parentId))throw Error('Broken parent '+r.id);for(const id of r.media||[])media.add(id);walk(r.items)}
 const db=await mediaDb();for(const id of media){const found=await new Promise(resolve=>{const req=db.transaction('files','readonly').objectStore('files').get(id);req.onsuccess=()=>resolve(req.result)});if(!found)throw Error('Missing referenced media '+id)}
 return {records:ids.size,referencedMedia:media.size};
})}
async function line(page,type='dimension'){
 await tool(page,type);const points=await page.evaluate(()=>({a:{x:view.dx+photoSize.w*view.zoom*.15,y:view.dy+photoSize.h*view.zoom*.3},b:{x:view.dx+photoSize.w*view.zoom*.7,y:view.dy+photoSize.h*view.zoom*.7}}));await drag(page,points.a,points.b);
 await editSelected(page);await page.fill('#measureInput','1585,800001');await page.selectOption('#measureUnit','mm');await page.fill(type==='dimension'?'#dimensionCaption':'#drawText','Č/Ř – přesné');await page.click('#okModal');
}
(async()=>suite('workflows',async test=>{
 await test('folders_move_rename_trash_restore',async({page,step,evidence})=>{
  await step('Measure real browser UI folder save, rejected storage, retry and double click',async()=>{
   // The browser uses localStorage, NOT Android Native.saveDataChecked.
   // Record JS save and folder rendering separately; never interpret this
   // timing as a benchmark of the native database/audio journal.
   const initial=await page.evaluate(()=>({
    disk:localStorage.getItem('zamerovac-data'),count:state.records.length
   }));
   await page.evaluate(()=>{
    const log=window.__folderSaveProbe={saveMs:[],renderMs:[],
      storageWrites:0,rejectedWrites:0,failOnce:false};
    const previousSave=save,previousFolder=showFolder,previousSet=Storage.prototype.setItem;
    window.__restoreFolderProbe=()=>{
     window.save=previousSave;window.showFolder=previousFolder;
     Storage.prototype.setItem=previousSet;
    };
    window.save=function(...args){
     const began=performance.now();
     try{return previousSave.apply(this,args)}
     finally{log.saveMs.push(performance.now()-began)}
    };
    window.showFolder=function(...args){
     const began=performance.now();
     try{return previousFolder.apply(this,args)}
     finally{log.renderMs.push(performance.now()-began)}
    };
    Storage.prototype.setItem=function(key,value){
     if(key==='zamerovac-data'){
      log.storageWrites++;
      if(log.failOnce){
       log.failOnce=false;log.rejectedWrites++;
       throw new DOMException('synthetic insufficient space','QuotaExceededError');
      }
     }
     return previousSet.call(this,key,value);
    };
   });
   const title='Syntetická složka – odmítnutý zápis';
   await add(page,'Nová složka');await page.fill('#promptValue',title);
   await page.evaluate(()=>__folderSaveProbe.failOnce=true);
   await page.click('#okModal');
   assert.equal(await page.locator('#modal').isVisible(),true,
    'Rejected save must leave the folder dialog open');
   assert.equal(await row(page,title).count(),0,'Rejected save created a ghost folder');
   assert.deepEqual(await page.evaluate(()=>({
    disk:localStorage.getItem('zamerovac-data'),count:state.records.length
   })),initial,'Rejected save changed durable records or working list');
   await page.click('#okModal');
   assert.equal(await row(page,title).count(),1,
    'Retry after synthetic disk-full must persist exactly one folder');
   const second='Syntetická složka – dvojklik';
   await page.context().setOffline(true);
   try{
    await add(page,'Nová složka');await page.fill('#promptValue',second);
    const box=await page.locator('#okModal').boundingBox();
    assert(box,'Save button must remain present');
    await page.mouse.dblclick(box.x+box.width/2,box.y+box.height/2,{delay:45});
   }finally{await page.context().setOffline(false)}
   const result=await page.evaluate(({title,second})=>{
    const rows=state.records.filter(r=>r.kind==='folder'&&(r.title===title||r.title===second));
    const disk=JSON.parse(localStorage.getItem('zamerovac-data'));
    const durable=disk.records.filter(r=>r.kind==='folder'&&(r.title===title||r.title===second));
    return {live:rows.map(r=>r.title),durable:durable.map(r=>r.title),
      saveMs:__folderSaveProbe.saveMs,renderMs:__folderSaveProbe.renderMs,
      storageWrites:__folderSaveProbe.storageWrites,
      rejectedWrites:__folderSaveProbe.rejectedWrites}
   },{title,second});
   assert.equal(result.live.filter(x=>x===title).length,1);
   assert.equal(result.live.filter(x=>x===second).length,1,'Double-click duplicated a folder');
   assert.deepEqual(result.durable.slice().sort(),result.live.slice().sort(),
    'UI and durable browser state diverged');
   assert.equal(result.rejectedWrites,1);
   assert(result.saveMs.length>=3,'Save did not pass instrumented JS path');
   assert(result.renderMs.length>=2,'Folder list did not pass render path');
   await page.evaluate(()=>__restoreFolderProbe());
   await page.reload();
   assert.equal(await row(page,title).count(),1,'Retry did not survive reload');
   assert.equal(await row(page,second).count(),1,'Double-click did not survive reload');
   evidence({environment:'Chromium browser localStorage ONLY; no native Android IO',
    confirmedFolders:2,rejectedWrites:result.rejectedWrites,
    storageWrites:result.storageWrites,saveMs:result.saveMs,
    renderMs:result.renderMs,offlineSecondFolder:true,doubleClick:true});
  });
  await step('Create project/room/canvas through UI',async()=>{await folder(page,'Zakázka A');await row(page,'Zakázka A').click();await folder(page,'Pokoj');await row(page,'Pokoj').click();await createCanvas(page,'Stěna');await line(page);await page.click('#editorBack')});
  await step('Rename and move preserve exact annotations',async()=>{
   await actions(page,'Stěna');await page.click('#renameOne');await page.fill('#renameBase','Přejmenovaná stěna');await page.click('#okModal');
   await actions(page,'Přejmenovaná stěna');await page.click('#moveOne');await page.selectOption('#moveWhere','');await page.click('#okModal');assert.equal(await row(page,'Přejmenovaná stěna').count(),0);
   await page.click('[data-nav="root"]');await row(page,'Přejmenovaná stěna').click();assert.equal((await record(page)).measure,'1585,800001');await page.click('#editorBack');
  });
  await step('Delete/restore folder descendants without restart',async()=>{
   await actions(page,'Zakázka A');await page.click('#deleteOne');await page.click('#okModal');await trash(page);await page.locator('[data-restore]').click();await page.click('#okModal');
   await row(page,'Zakázka A').click();assert.equal(await row(page,'Pokoj').count(),1);evidence(await links(page));
  });
  await page.reload();assert.equal(await page.evaluate(()=>state.records.find(r=>r.title==='Přejmenovaná stěna').items[0].measure),'1585,800001');
 });
 await test('bulk_copy_move_lock',async({page,step,evidence})=>{
  await createCanvas(page,'Originál');await line(page);await page.click('#editorBack');await folder(page,'Cíl');
  const original=await page.evaluate(()=>JSON.parse(JSON.stringify(state.records.find(r=>r.title==='Originál'))));
  await step('Long press/copy preserves values with new record and item IDs',async()=>{
   const r=await row(page,'Originál').boundingBox();await page.mouse.move(r.x+140,r.y+r.height/2);await page.mouse.down();await page.waitForTimeout(700);await page.mouse.up();
   await page.locator('[data-bulk="copy"]').click();await page.click('#okModal');
   const copy=await page.evaluate(()=>state.records.find(r=>r.title==='Kopie – Originál'));assert(copy);assert.notEqual(copy.id,original.id);assert.notEqual(copy.items[0].id,original.items[0].id);assert.equal(copy.items[0].measure,original.items[0].measure);
  });
  await step('Move copy, inherited lock blocks writing',async()=>{
   await actions(page,'Kopie – Originál');await page.click('#moveOne');const target=await page.evaluate(()=>state.records.find(r=>r.title==='Cíl').id);await page.selectOption('#moveWhere',target);await page.click('#okModal');
   await actions(page,'Cíl');await page.getByText('🔒 Uzamknout',{exact:true}).click();await row(page,'Cíl').click();await row(page,'Kopie – Originál').click();
   assert.equal(await page.locator('#drawCanvas').evaluate(el=>getComputedStyle(el).pointerEvents),'none');const before=await page.evaluate(()=>JSON.stringify(current.items));
   const box=await page.locator('#drawCanvas').boundingBox();await page.mouse.click(box.x+100,box.y+100);assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),before);await page.click('#editorBack');
   await page.click('[data-nav="root"]');await actions(page,'Cíl');await page.getByText('🔓 Odemknout',{exact:true}).click();await row(page,'Cíl').click();await row(page,'Kopie – Originál').click();assert.equal(await page.locator('#drawCanvas').evaluate(el=>getComputedStyle(el).pointerEvents),'auto');
   evidence(await links(page));
  });
 });
 await test('note_checklist_sketch_attachment',async({page,step,evidence})=>{
  await add(page,'Nová textová poznámka');await page.fill('#noteTitle','Poznámka Č/Ř');await page.fill('#noteText','Řádek 1\nŘádek 2 😀');
  await page.click('#addCheck');await page.fill('[data-text="0"]','Přesný úkol');await page.check('[data-check="0"]');
  await step('Actual sketch, undo, draw again',async()=>{
   await page.click('#toggleSketch');await page.locator('[data-pen="#f7dc27"]').click();const c=await page.locator('#sketchCanvas').boundingBox();
   const draw=async()=>{await page.mouse.move(c.x+20,c.y+30);await page.mouse.down();await page.mouse.move(c.x+c.width*.6,c.y+c.height*.6,{steps:10});await page.mouse.up()};
   await draw();assert.equal(await page.evaluate(()=>noteActive.sketchStrokes.length),1);await page.click('#undoSketch');assert.equal(await page.evaluate(()=>noteActive.sketchStrokes.length),0);await draw();
   const count=await page.locator('#sketchCanvas').evaluate(c=>{const p=c.getContext('2d').getImageData(0,0,c.width,c.height).data;let n=0;for(let i=0;i<p.length;i+=4)if(p[i]>200&&p[i+1]>150&&p[i+2]<100)n++;return n});assert(count>50);
  });
  await step('Attach image and save/reload exact note',async()=>{
   const buffer=await png(page,'#ff0000',64,128);await chooseFiles(page,'#attachFile',{name:'detail.png',mimeType:'image/png',buffer});await page.waitForFunction(()=>noteActive.media.length===1);
   const before=await hashes(page);await page.click('#saveNote');await page.reload();await row(page,'Poznámka Č/Ř').click();
   assert.equal(await page.inputValue('#noteText'),'Řádek 1\nŘádek 2 😀');assert.equal(await page.locator('[data-check="0"]').isChecked(),true);assert.equal(await page.evaluate(()=>noteActive.sketchStrokes.length),1);assert.deepEqual(await hashes(page),before);evidence(await links(page));
  });
 });
 await test('photo_details_nested_gallery_png_hashes',async({page,step,evidence,directory})=>{
  await folder(page,'Fotografická zakázka');await row(page,'Fotografická zakázka').click();await upload(page,'original.png','#777777',1000,700);await line(page);
  await step('Note with two real uploaded images and nested dimension',async()=>{
   await tool(page,'note');const p=await page.evaluate(()=>({x:view.dx+photoSize.w*view.zoom*.35,y:view.dy+photoSize.h*view.zoom*.65}));await drag(page,p,{x:p.x+30,y:p.y+20});await editSelected(page);await page.fill('#richText','Soukromý detail\nobě fotografie');
   const one=await png(page,'#ff0000',120,240),two=await png(page,'#0000ff',240,120);await chooseFiles(page,'#richPhotoPick',[{name:'red.png',mimeType:'image/png',buffer:one},{name:'blue.png',mimeType:'image/png',buffer:two}]);
   await page.waitForFunction(()=>document.querySelectorAll('[data-attachment]').length===2);await page.click('#okModal');await editSelected(page);await page.click('#richEditDetail');await page.waitForFunction(()=>current._detailTemporary&&!!stageImg);
   await line(page);await page.click('#editorBack');await page.waitForFunction(()=>!current._detailTemporary&&!!stageImg);
   assert.equal(await page.evaluate(()=>current.items.find(i=>i.type==='note').detailItems[0].measure),'1585,800001');
  });
  const before=await hashes(page),saved=await page.evaluate(()=>JSON.stringify(current.items));
  await step('Actual PNG output, not just clicking export',async()=>{
   await page.click('#editorTopMenu');await page.getByText('Exportovat obrázek nebo PDF',{exact:true}).click();
   const pending=page.waitForEvent('download');await page.click('#exportPng');const download=await pending;await download.saveAs(require('node:path').join(directory,'annotated.png'));
   const bytes=require('node:fs').readFileSync(require('node:path').join(directory,'annotated.png'));assert.deepEqual([...bytes.subarray(0,8)],[137,80,78,71,13,10,26,10]);assert(bytes.length>1000);
   assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),saved);assert.deepEqual(await hashes(page),before);
  });
  await page.click('#editorBack');await page.click('#browseGallery');await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>1);await page.locator('.gallery-top [data-action="edit"]').click();await page.waitForFunction(()=>!!stageImg);
  assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),saved);await page.click('#editorBack');await page.reload();assert.deepEqual(await hashes(page),before);evidence(await links(page));
 });
 await test('trash_restore_purge_and_live_media',async({page,step,evidence})=>{
  await upload(page,'keep.png','#00ff00');await line(page);await page.click('#editorBack');await upload(page,'trash.png','#ff0000');await page.click('#editorBack');
  const before=await hashes(page);const ids=await page.evaluate(()=>Object.fromEntries(state.records.map(r=>[r.title,r.media[0]])));
  await actions(page,'trash.png');await page.click('#deleteOne');await page.click('#okModal');await trash(page);await page.locator('[data-restore]').click();await page.click('#okModal');assert.equal(await row(page,'trash.png').count(),1);assert.deepEqual(await hashes(page),before);
  await actions(page,'trash.png');await page.click('#deleteOne');await page.click('#okModal');await trash(page);await page.click('#emptyTrash');await page.click('#cancelModal');assert.deepEqual(await hashes(page),before);
  await trash(page);await page.click('#emptyTrash');await page.click('#okModal');await page.waitForFunction(()=>state.records.length===1);await page.click('#okModal');await page.reload();
  const after=await hashes(page);assert.equal(after[ids['keep.png']],before[ids['keep.png']]);/* Browser purge intentionally removes records only. Native shared-file unlink has its own TrashPurgerTest. */assert.equal(after[ids['trash.png']],before[ids['trash.png']]);assert.equal(await row(page,'keep.png').count(),1);evidence(await links(page));
 });
 await test('focus_cancel_layers_history_search',async({page,step,evidence})=>{
  await createCanvas(page,'Hledaná zakázka');await line(page);const saved=await record(page);
  await step('Delayed autofocus must not steal another field',async()=>{
   await editSelected(page);await page.focus('#dimensionCaption');await page.waitForTimeout(120);assert.equal(await page.evaluate(()=>document.activeElement.id),'dimensionCaption');
   await page.fill('#measureInput','999,000000001');await page.click('#cancelModal');assert.deepEqual(await record(page),saved);
  });
  await step('Layer hide does not delete; choosing tool restores its layer',async()=>{
   await page.click('#editorTopMenu');await page.getByText('☷ Vrstvy kót, poznámek a kreslení',{exact:true}).click();await page.uncheck('[data-layer="dimensions"]');await page.click('#okModal');assert.deepEqual(await record(page),saved);
   await tool(page,'dimension');assert.equal(await page.evaluate(()=>prefs.layerVisible.dimensions),true);
  });
  await page.click('#editorBack');await page.click('#searchBtn');await page.fill('#searchAll','Hledaná');await page.locator('[data-found]').click();assert.equal((await record(page)).measure,'1585,800001');evidence(await links(page));
 });
} ))().catch(error=>{console.error(error);process.exitCode=1});
