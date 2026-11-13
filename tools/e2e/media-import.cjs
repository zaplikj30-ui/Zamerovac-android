'use strict';
const {suite,assert,createCanvas,tool,drag,editSelected}=require('./harness.cjs'),nativeStorage=require('./native-storage-fixture.cjs');
async function setup(page){await nativeStorage(page);await page.evaluate(()=>{window.pickCalls=[];Native.selectFilesForRequest=(type,id)=>pickCalls.push({type,id});Native.takePhotoForRequest=id=>pickCalls.push({type:'camera',id});const a=newRecord('folder','Složka A',null),b=newRecord('folder','Složka B',null);state.records=[a,b];window.folderA=a.id;window.folderB=b.id;currentFolder=folderA;save();showFolder();});}
suite('media-import',async run=>{
 await run('issue46-two-notes-back-focus-cancel-and-delayed-picker-callback',async({page,evidence})=>{
  await setup(page);await createCanvas(page,'Dvě poznámky #46');
  for(const [index,text] of ['První přesný text','Druhý přesný text'].entries()){
   await tool(page,'note');await drag(page,{x:100,y:210+index*180},{x:210,y:250+index*180});
   await editSelected(page);await page.fill('#richText',text);await page.click('#okModal');
  }
  const open=async(index)=>{
   await page.evaluate(index=>{setTool('select');selected=current.items[index].id;paint()},index);
   await editSelected(page);await page.waitForTimeout(140);
   assert.notEqual(await page.evaluate(()=>document.activeElement.id),'richText','Opening a note must leave keyboard focus closed');
  };
  for(let i=0;i<6;i++){
   await open(i%2);await page.locator('#richText').click();
   if(i%3===0)await page.keyboard.press('Escape');
   else await page.click(i%3===1?'#cancelModal':'#okModal');
   await page.waitForTimeout(140);
   assert.equal(await page.evaluate(()=>pickCalls.length),0,'Open, focus, Back, Save or Cancel must never launch picker');
  }
  await open(0);await page.locator('#richPhotoPick').dblclick();
  assert.equal(await page.evaluate(()=>pickCalls.length),1,'Double tap may create only one request');
  const old=await page.evaluate(()=>pickCalls[0]);assert.equal(old.type,'media');
  await page.keyboard.press('Escape');await open(1);
  assert.equal(await page.evaluate(id=>onNativeMedia('late-photo','image/png','Late',null,id),old.id),false);
  await page.evaluate(id=>onNativeMediaDone(id),old.id);
  assert.equal(await page.locator('#richAttachments [data-attachment]').count(),0);
  await page.click('#richPhotoCamera');const camera=await page.evaluate(()=>pickCalls.at(-1));
  assert.equal(camera.type,'camera');await page.evaluate(id=>onNativeMediaDone(id),camera.id);
  await page.click('#okModal');
  const expected=['První přesný text','Druhý přesný text'];
  assert.deepEqual(await page.evaluate(()=>current.items.map(n=>n.text)),expected);
  assert(await page.evaluate(()=>current.items.every(n=>!n.media?.length)));
  // Preserve the model disk across JS restart; the base Native fixture resets it.
  await page.addInitScript(disk=>{window.syntheticDisk=disk},await page.evaluate(()=>syntheticDisk));
  await page.reload();
  assert.deepEqual(await page.evaluate(()=>state.records.find(r=>r.title==='Dvě poznámky #46').items.map(n=>n.text)),expected);
  evidence({unrequestedPicker:'NOT REPRODUCED in Chromium Native model',explicitRequests:2,staleCallbackRejected:true,restartPreservedTexts:true,physicalAndroid:'NOT RUN'});
 });
 await run('delayed-native-results-stay-in-original-folder-and-stale-token-cannot-complete-new-picker',async({page})=>{
  await setup(page);await page.click('#galleryBtn');let first=await page.evaluate(()=>pickCalls.at(-1));await page.evaluate(()=>{currentFolder=folderB;showFolder()});await page.click('#galleryBtn');assert.equal(await page.evaluate(()=>pickCalls.length),1);await page.evaluate(token=>onNativeMedia('synthetic-first','application/pdf','Příloha A',null,token),first.id);assert.equal(await page.evaluate(()=>state.records.find(r=>r.media?.includes('synthetic-first')).parentId),await page.evaluate(()=>folderA));assert.equal(await page.evaluate(()=>currentFolder),await page.evaluate(()=>folderB));await page.evaluate(id=>onNativeMediaDone(id),first.id);await page.click('#galleryBtn');const next=await page.evaluate(()=>pickCalls.at(-1));assert.notEqual(next.id,first.id);await page.evaluate(id=>{onNativeMediaDone(id);onNativeMedia('synthetic-stale','application/pdf','Starý callback',null,id)},first.id);await page.click('#galleryBtn');assert.equal(await page.evaluate(()=>pickCalls.length),2);assert.equal(await page.evaluate(()=>state.records.some(r=>r.media?.includes('synthetic-stale'))),false);await page.evaluate(id=>onNativeMedia('synthetic-next','application/pdf','Příloha B',null,id),next.id);assert.equal(await page.evaluate(()=>state.records.find(r=>r.media?.includes('synthetic-next')).parentId),await page.evaluate(()=>folderB));
 });
 await run('deleted-or-locked-destination-and-closed-owner-dialog-do-not-redirect-file',async({page})=>{
  await setup(page);for(const key of ['deleted','locked']){await page.click('#galleryBtn');const token=await page.evaluate(()=>pickCalls.at(-1).id);await page.evaluate(key=>{const r=recById(folderA);r[key]=true;touch(r);save()},key);await page.evaluate(({token,key})=>onNativeMedia('synthetic-'+key,'application/pdf','Nesmí jinam',null,token),{token,key});assert.equal(await page.evaluate(()=>state.records.filter(r=>r.kind!=='folder').length),0);await page.evaluate(({token,key})=>{state.records.find(r=>r.id===folderA)[key]=false;save();onNativeMediaDone(token)},{token,key});}
  await page.evaluate(()=>{window.oldHandlerCalls=0;modal('Původní vlastník','<input id="oldOwner">',()=>{});pickMedia('file',()=>oldHandlerCalls++);});const token=await page.evaluate(()=>pickCalls.at(-1).id);await page.click('#cancelModal');await page.evaluate(()=>modal('Jiný dialog','<input id="newOwner">',()=>{}));await page.evaluate(id=>onNativeMedia('synthetic-modal','application/pdf','Starý vlastník',null,id),token);assert.equal(await page.evaluate(()=>oldHandlerCalls),0);assert.equal(await page.locator('#newOwner').isVisible(),true);assert.equal(await page.evaluate(()=>state.records.length),2);
 });
 await run('picker-cancel-and-rejected-write-keep-data-without-ghost-record',async({page})=>{
  await setup(page);const before=await page.evaluate(()=>syntheticDisk);
  await page.click('#galleryBtn');const token=await page.evaluate(()=>pickCalls.at(-1).id);
  await page.evaluate(id=>onNativeMediaDone(id),token);assert.equal(await page.evaluate(()=>syntheticDisk),before);
  await page.click('#galleryBtn');const next=await page.evaluate(()=>pickCalls.at(-1).id);
  await page.evaluate(()=>syntheticWriteFailure=true);
  await page.evaluate(id=>onNativeMedia('synthetic-draft','application/pdf','Neuložená příloha',null,id),next);
  assert.equal(await page.locator('#saveErrorBanner').isVisible(),true);
  assert.equal(await page.evaluate(()=>syntheticDisk),before);
  assert.equal(await page.evaluate(()=>state.records.some(r=>r.media?.includes('synthetic-draft'))),false,
   'PR #99 must remove the unconfirmed record from runtime state');
  await page.evaluate(()=>syntheticWriteFailure=false);await page.locator('#saveErrorBanner button').click();
  assert.equal(await page.locator('#saveErrorBanner').count(),0);
  assert.equal(await page.evaluate(()=>JSON.parse(syntheticDisk).records.some(r=>r.media?.includes('synthetic-draft'))),false,
   'An unrelated retry must not silently confirm the old ghost');
  await page.click('#galleryBtn');const retry=await page.evaluate(()=>pickCalls.at(-1).id);
  await page.evaluate(id=>onNativeMedia('synthetic-retry','application/pdf','Opakovaná příloha',null,id),retry);
  assert.equal(await page.evaluate(()=>JSON.parse(syntheticDisk).records.find(r=>r.media?.includes('synthetic-retry')).parentId),await page.evaluate(()=>folderA));
 });
});
