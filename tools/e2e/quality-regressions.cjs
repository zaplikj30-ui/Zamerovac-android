'use strict';
const fs=require('node:fs'),path=require('node:path');
const {suite,assert,createCanvas,chooseFiles,tool,drag,editSelected,redo}=require('./harness.cjs');
const nativeStorage=require('./native-storage-fixture.cjs');
async function addNote(page,text){
 await tool(page,'note');await drag(page,{x:130,y:230},{x:220,y:290});
 await editSelected(page);await page.fill('#richText',text);await page.click('#okModal');
 return page.evaluate(()=>selected);
}
async function image(page,width=1200,height=800){
 return Buffer.from(await page.evaluate(({width,height})=>{
  const c=document.createElement('canvas');c.width=width;c.height=height;
  c.getContext('2d').fillStyle='#666';c.getContext('2d').fillRect(0,0,width,height);
  return c.toDataURL().split(',')[1];
 },{width,height}),'base64');
}
async function files(page){return page.evaluate(async()=>{
 const db=await mediaDb();return new Promise((resolve,reject)=>{
  const r=db.transaction('files').objectStore('files').getAllKeys();r.onsuccess=()=>resolve(r.result);r.onerror=reject;
 });
})}
async function originals(page){return page.evaluate(async()=>{
 const result={};for(const id of await new Promise(async resolve=>{
  const db=await mediaDb(),r=db.transaction('files').objectStore('files').getAllKeys();r.onsuccess=()=>resolve(r.result);
 })){
  const db=await mediaDb(),blob=await new Promise(resolve=>{const r=db.transaction('files').objectStore('files').get(id);r.onsuccess=()=>resolve(r.result)});
  result[id]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
 }return result;
})}
suite('quality-regressions',async test=>{
 for(const close of ['save','back'])await test('existing_note_undo_redo_'+close,async({page,step,evidence})=>{
  await createCanvas(page,'Historie poznámky');await addNote(page,'Původní Č/Ř 1250,000001');
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
  await editSelected(page);await page.fill('#richText','Upravený text 999,000002');
  if(close==='save')await page.click('#okModal');else await page.evaluate(()=>handleAndroidBack());
  const after=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items)));
  assert.equal(after[0].text,'Upravený text 999,000002');
  await step('Undo restores the entire existing note; Redo restores the edit',async()=>{
   await page.click('#undo');assert.deepEqual(await page.evaluate(()=>current.items),before);
   await redo(page);assert.deepEqual(await page.evaluate(()=>current.items),after);
  });
  await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();
  assert.deepEqual(await page.evaluate(()=>current.items),after);evidence({close,undoRestoredWholeObject:true});
 });
 await test('audio_play_pause_must_not_focus_text',async({page,step,evidence})=>{
  await createCanvas(page,'Audio focus');await addNote(page,'Text bez klávesnice');await editSelected(page);
  // A real local WAV through the file input, no microphone permission or network.
  const wav=Buffer.alloc(44+16000);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);
  wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(8000,24);
  wav.writeUInt32LE(16000,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(16000,40);
  await chooseFiles(page,'#richPhotoPick',{name:'synthetic.wav',mimeType:'audio/wav',buffer:wav});
  await page.locator('#richAttachments audio').waitFor();await page.click('#okModal');await editSelected(page);
  await step('Allow modal focus timer to run; text is focused only after explicit text action',async()=>{
   await page.waitForTimeout(160);
   assert.notEqual(await page.evaluate(()=>document.activeElement.id),'richText','Opening an audio note must not request a keyboard');
   const audio=page.locator('#richAttachments audio');await audio.waitFor();
   await page.waitForFunction(()=>document.querySelector('#richAttachments audio')?.readyState>=2);
   const r=await audio.boundingBox();await page.mouse.click(r.x+18,r.y+r.height/2);
   await page.waitForFunction(()=>!document.querySelector('#richAttachments audio').paused);
   assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'TEXTAREA');
   await page.mouse.click(r.x+18,r.y+r.height/2);await page.waitForFunction(()=>document.querySelector('#richAttachments audio').paused);
   assert.notEqual(await page.evaluate(()=>document.activeElement.tagName),'TEXTAREA');
   await page.click('#richText');assert.equal(await page.evaluate(()=>document.activeElement.id),'richText');
   evidence({realWavPlayback:true,androidIME:'NOT RUN; Chromium focus assertion only'});
  });
 });
 await test('two_notes_explicit_picker_double_click_cancel_back_and_late_result',async({page,evidence})=>{
  await nativeStorage(page);await createCanvas(page,'Vlastník dialogu');
  const a=await addNote(page,'Poznámka A'),b=await addNote(page,'Poznámka B');
  await page.evaluate(()=>{window.picks=[];Native.selectFilesForRequest=(type,id)=>picks.push({type,id});Native.takePhotoForRequest=id=>picks.push({type:'camera',id})});
  for(const id of [a,b,a,b]){
   await page.evaluate(id=>selected=id,id);await editSelected(page);await page.click('#cancelModal');
  }
  assert.equal(await page.evaluate(()=>picks.length),0,'Opening/closing notes must never launch a picker');
  await page.evaluate(id=>selected=id,a);await editSelected(page);await page.locator('#richPhotoPick').dblclick();
  assert.equal(await page.evaluate(()=>picks.length),1,'Double click launches only one request');
  const old=await page.evaluate(()=>picks[0].id);await page.click('#cancelModal');
  await page.evaluate(id=>selected=id,b);await editSelected(page);
  assert.equal(await page.evaluate(id=>onNativeMedia('late-a','image/png','Late A',null,id),old),false);
  await page.evaluate(id=>onNativeMediaDone(id),old);
  assert.equal(await page.evaluate(()=>current.items.some(i=>i.media?.includes('late-a'))),false);
  await page.click('#richPhotoCamera');const next=await page.evaluate(()=>picks.at(-1));assert.equal(next.type,'camera');
  await page.evaluate(id=>onNativeMediaDone(id),old); // stale completion must not unlock the current picker
  await page.click('#richPhotoCamera');assert.equal(await page.evaluate(()=>picks.length),2);
  await page.evaluate(()=>handleAndroidBack());
  assert.equal(await page.evaluate(id=>onNativeMedia('late-b','image/png','Late B',null,id),next.id),false);
  await page.evaluate(id=>onNativeMediaDone(id),next.id);
  assert.deepEqual(await page.evaluate(()=>JSON.parse(syntheticDisk).records[0].items.map(i=>i.text)),['Poznámka A','Poznámka B']);
  evidence({nativePicker:'model only',lateCallbacksRejected:true,explicitRequests:2});
 });
 await test('cancelled_attachment_has_no_unprotected_orphan',async({page,step,evidence})=>{
  await createCanvas(page,'Zrušená příloha');await addNote(page,'Zachovat poznámku');
  const before=await files(page),data=await page.evaluate(()=>JSON.stringify(current.items));
  await editSelected(page);await chooseFiles(page,'#richPhotoPick',{name:'cancelled.png',mimeType:'image/png',buffer:await image(page,64,64)});
  await page.waitForFunction(()=>document.querySelectorAll('[data-attachment]').length===1);
  await page.click('#cancelModal');assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),data);
  await step('Cancelled imported bytes must be removed or tracked by a durable retention owner',async()=>{
   // Current implementation has no staging/retention owner for these IDs. Never clean up here:
   // a test deleting the leaked file would mask N4 and could destroy history/sync references.
   const after=await files(page);evidence({before,after});assert.deepEqual(after,before,'Cancel leaked a published file without a reference or retention owner (N4)');
  });
 });
 await test('project_photo_dimension_note_reopen_and_export',async({page,step,evidence,directory})=>{
  await page.click('#createBtn');await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
  await page.fill('#promptValue','QA zakázka');await page.click('#okModal');await page.locator('.entry-title',{hasText:'QA zakázka'}).click();
  await chooseFiles(page,'#galleryBtn',{name:'original.png',mimeType:'image/png',buffer:await image(page)});
  await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
  await page.evaluate(()=>{prefs.snapPoints=false;prefs.snapHorizontal=false;save()});
  await tool(page,'dimension');await drag(page,{x:140,y:280},{x:460,y:350});await editSelected(page);
  await page.fill('#measureInput','1585,800001');await page.selectOption('#measureUnit','mm');await page.click('#okModal');
  await addNote(page,'Původní text');await editSelected(page);await page.fill('#richText','Finální Č/Ř poznámka');await page.click('#okModal');
  const before=await page.evaluate(()=>JSON.parse(JSON.stringify(current.items))),hashes=await originals(page);
  await page.click('#editorBack');await page.reload();await page.locator('.entry-title',{hasText:'QA zakázka'}).click();
  await page.locator('.entry-title',{hasText:'original.png'}).click();assert.deepEqual(await page.evaluate(()=>current.items),before);
  await step('Reopened note and measurement remain editable; exported PNG contains real yellow pixels',async()=>{
   await page.evaluate(()=>selected=current.items.find(i=>i.type==='dimension').id);await editSelected(page);
   assert.equal(await page.inputValue('#measureInput'),'1585,800001');await page.click('#cancelModal');
   await page.evaluate(()=>selected=current.items.find(i=>i.type==='note').id);await editSelected(page);
   assert.equal(await page.inputValue('#richText'),'Finální Č/Ř poznámka');await page.click('#cancelModal');
   await page.click('#editorTopMenu');await page.getByText('Exportovat obrázek nebo PDF',{exact:true}).click();
   const pending=page.waitForEvent('download');await page.click('#exportPng');const download=await pending;
   const output=path.join(directory,'workflow-export.png');await download.saveAs(output);
   const pixels=await page.evaluate(async data=>{
    const img=new Image();img.src=data;await img.decode();const c=document.createElement('canvas');c.width=img.width;c.height=img.height;
    const x=c.getContext('2d');x.drawImage(img,0,0);const p=x.getImageData(0,0,c.width,c.height).data;let yellow=0;
    for(let i=0;i<p.length;i+=4)if(p[i]>180&&p[i+1]>150&&p[i+2]<100)yellow++;return yellow;
   },'data:image/png;base64,'+fs.readFileSync(output).toString('base64'));
   assert(pixels>100,'Export must contain visible annotation strokes/glyphs');
   assert.deepEqual(await page.evaluate(()=>current.items),before);assert.deepEqual(await originals(page),hashes);
   evidence({exportYellowPixels:pixels,originalSHA256:hashes,exactMeasure:before[0].measure});
  });
 });
}).catch(e=>{console.error(e);process.exitCode=1});
