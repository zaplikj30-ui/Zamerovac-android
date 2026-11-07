'use strict';
// Run only by the existing emulator workflow, against its real preview WebView.
// No Native mock and no extra framework. Missing CDP/IME evidence is a failure,
// never a successful screenshot-only smoke. Creates synthetic records only.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {_android:android}=require('playwright');
const {assert,createCanvas,tool,drag,editSelected}=require('./harness.cjs');
const out=path.resolve('emulator-results/system-dialogs');fs.mkdirSync(out,{recursive:true});
const report={syntheticOnly:true,layer:'real-android-webview-and-adb',cases:[]};
const adb=(...args)=>execFileSync('adb',args,{encoding:'utf8',timeout:15000});
async function until(check){for(let i=0;i<35;i++){if(await check())return;await new Promise(r=>setTimeout(r,200))}throw Error('Timed out waiting for Android state')}
function ime(){
 const dump=adb('shell','dumpsys','input_method');fs.writeFileSync(path.join(out,'input-method.txt'),dump);
 const flags=[...dump.matchAll(/(?:mInputShown|mIsInputViewShown|isInputViewShown\(\))\s*[=:]\s*(true|false)/g)].map(m=>m[1]);
 assert(flags.length,'NOT VERIFIED: Android did not expose a recognized IME visibility flag');
 return flags.includes('true');
}
function picker(){return /mResumedActivity[^\n]*(?:documentsui|DocumentsActivity)/i.test(adb('shell','dumpsys','activity','activities'))}
(async()=>{
 let device,page;
 const run=async(name,body)=>{
  const entry={name,status:'running'};report.cases.push(entry);
  try{await body();entry.status='PASS';console.log('PASS android-system/'+name)}
  catch(e){entry.status='FAIL';entry.error=String(e.stack||e);throw e}
  finally{
   fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));
   fs.writeFileSync(path.join(out,name+'.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:15000}));
  }
 };
 try{
  await run('connect_real_preview_webview',async()=>{
   const pid=adb('shell','pidof','cz.zamerovac.app.preview').trim().split(/\s+/)[0];assert(/^\d+$/.test(pid));
   // Debuggable preview WebView >=113 exposes this endpoint automatically.
   const sockets=adb('shell','cat','/proc/net/unix');
   assert(sockets.includes('@webview_devtools_remote_'+pid),'NOT RUN: preview WebView has no debugging endpoint; IME/picker gate cannot be verified');
   // WebView rejects Browser.setDownloadBehavior/context management used by a
   // desktop connectOverCDP session. Use the Android adapter already shipped
   // in this pinned Playwright, which connects through the same real adb.
   const devices=await android.devices();
   device=devices.find(d=>d.serial().startsWith('emulator-'));assert(device,'Real Android emulator missing');
   const webview=await device.webView({pkg:'cz.zamerovac.app.preview'});
   page=await webview.page();assert(page,'Real WebView page missing');page.setDefaultTimeout(7000);
   assert(await page.evaluate(()=>typeof Native==='object'&&native),'Must use the real Android bridge');
   const windows=adb('shell','dumpsys','window','windows');
   fs.writeFileSync(path.join(out,'windows-before-ui.txt'),windows);
   assert(!/mCurrentFocus=Window\{[^\n]*Application Not Responding/i.test(windows),
    'NOT VERIFIED: a native ANR dialog blocks device input; see windows-before-ui.txt');
   if(await page.locator('#modal').isVisible()){
    if(await page.locator('#cancelModal').isVisible())await page.click('#cancelModal');
    else await page.click('#okModal'); // Read-only release notes hide Cancel.
   }
   if(await page.locator('#editorView').isVisible())await page.click('#editorBack');
  });
  await run('gallery_pixels_exact_value_and_live_session',async()=>{
   const expected=await page.evaluate(async()=>{
    const canvas=document.createElement('canvas');canvas.width=6000;canvas.height=4000;
    const c=canvas.getContext('2d');c.fillStyle='#666';c.fillRect(0,0,6000,4000);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve));
    const hash=bytes=>crypto.subtle.digest('SHA-256',bytes).then(b=>Array.from(new Uint8Array(b)).join(','));
    const original=await hash(await blob.arrayBuffer()),id=await storeMedia(new File([blob],'qa-gallery.png',{type:'image/png'}));
    const record=newRecord('photo','QA Android galerie');record.media=[id];state.records.push(record);
    if(!save())throw Error('Native photo fixture save failed');openRecord(record.id);
    window.__androidOriginalHash=hash;return {original,id};
   });
   await page.waitForFunction(()=>!!stageImg);
   await page.evaluate(()=>{prefs.snapPoints=false;prefs.snapHorizontal=false;prefs.snapGrid=false;prefs.color='#f7dc27';save()});
   await tool(page,'dimension');const points=await page.evaluate(()=>({
    a:{x:view.dx+photoSize.w*view.zoom*.2,y:view.dy+photoSize.h*view.zoom*.45},
    b:{x:view.dx+photoSize.w*view.zoom*.8,y:view.dy+photoSize.h*view.zoom*.55}
   }));await drag(page,points.a,points.b);await editSelected(page);
   await page.fill('#measureInput','1250,500001');await page.click('#okModal');
   const before=await page.evaluate(()=>{
    window.__androidGallerySession={current,view,selected,editStack,redoStack};
    const fill=CanvasRenderingContext2D.prototype.fillText;window.__androidGalleryFill=fill;
    CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...args){
     const result=fill.call(this,text,x,y,...args);
     if(this.canvas.classList.contains('gallery-img')&&String(text).includes('1250,500001')){
      const m=this.measureText(text),t=this.getTransform();
      const a=t.transformPoint({x:x-m.actualBoundingBoxLeft,y:y-m.actualBoundingBoxAscent});
      const b=t.transformPoint({x:x+m.actualBoundingBoxRight,y:y+m.actualBoundingBoxDescent});
      window.__androidGalleryInk={x:Math.floor(a.x),y:Math.floor(a.y),w:Math.ceil(b.x-a.x),h:Math.ceil(b.y-a.y)};
     }return result;
    };return Native.loadData();
   });
   await page.click('#galleryMode');
   for(const zoom of [1,2]){
    if(zoom===2)await page.locator('.gallery-img').dblclick();
    await page.waitForFunction(zoom=>{const c=document.querySelector('.gallery-img');return !!window.__androidGalleryInk&&c?.dataset.galleryView&&JSON.parse(c.dataset.galleryView).zoom===zoom},zoom);
    const pixels=await page.evaluate(()=>{
     const c=document.querySelector('.gallery-img'),s=__androidGalleryInk,x=c.getContext('2d');
     const left=Math.max(0,s.x),top=Math.max(0,s.y),w=Math.min(c.width-left,s.w),h=Math.min(c.height-top,s.h);
     if(w<=0||h<=0)return {yellow:0,inkHeight:0};
     const p=x.getImageData(left,top,w,h).data;let yellow=0,minY=h,maxY=-1;
     for(let row=0;row<h;row++)for(let col=0;col<w;col++){
      const i=(row*w+col)*4;if(p[i]>180&&p[i+1]>150&&p[i+2]<100){yellow++;minY=Math.min(minY,row);maxY=Math.max(maxY,row)}
     }return {yellow,inkHeight:(maxY-minY+1)*c.clientWidth/c.width};
    });assert(pixels.yellow>15&&pixels.inkHeight>=8,'Actual Android gallery glyph ink must remain readable at '+zoom+'x');
    fs.writeFileSync(path.join(out,'gallery-'+zoom+'x.png'),execFileSync('adb',['exec-out','screencap','-p'],{timeout:15000}));
   }
   await page.click('.gallery-top [data-action="edit"]');
   assert(await page.evaluate(()=>Object.entries(__androidGallerySession).every(([k,v])=>({current,view,selected,editStack,redoStack})[k]===v)));
   assert.equal(await page.evaluate(()=>Native.loadData()),before,'Gallery must not write native project data');
   const original=await page.evaluate(async id=>__androidOriginalHash(await(await fetch(await assetUrl(id))).arrayBuffer()),expected.id);
   assert.equal(original,expected.original,'Native original PNG bytes must remain unchanged');
   await editSelected(page);assert.equal(await page.inputValue('#measureInput'),'1250,500001');await page.click('#cancelModal');
   await page.evaluate(()=>CanvasRenderingContext2D.prototype.fillText=window.__androidGalleryFill);
   await page.click('#editorBack');
  });
  let noteId;
  await run('audio_play_pause_and_explicit_text_ime',async()=>{
   await createCanvas(page,'QA Android '+Date.now());await tool(page,'note');await drag(page,{x:100,y:210},{x:180,y:260});
   await editSelected(page);await page.fill('#richText','Syntetická hlasová poznámka');await page.click('#okModal');
   // Seed only the audio fixture through the actual checked native ingest API.
   // Playback, text, picker and Back below use UI/system actions.
   noteId=await page.evaluate(async()=>{
    const b=new Uint8Array(44+160000),v=new DataView(b.buffer),ascii=(s,o)=>[...s].forEach((c,i)=>b[o+i]=c.charCodeAt(0));
    ascii('RIFF',0);v.setUint32(4,b.length-8,true);ascii('WAVEfmt ',8);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);
    v.setUint32(24,8000,true);v.setUint32(28,16000,true);v.setUint16(32,2,true);v.setUint16(34,16,true);ascii('data',36);v.setUint32(40,b.length-44,true);
    const id=await storeMedia(new File([b],'qa-tone.wav',{type:'audio/wav'})),item=current.items.find(i=>i.id===selected);
    item.media=[id];item.audioMedia=[id];if(!commitEditor())throw Error('Native fixture save failed');return item.id;
   });
   await editSelected(page);await page.waitForTimeout(160);assert.equal(ime(),false,'Opening audio note must keep IME closed');
   const audio=page.locator('#richAttachments audio');await audio.waitFor();await page.waitForFunction(()=>document.querySelector('#richAttachments audio')?.readyState>=2);
   const r=await audio.boundingBox();await page.mouse.click(r.x+18,r.y+r.height/2);
   await page.waitForFunction(()=>!document.querySelector('#richAttachments audio').paused);assert.equal(ime(),false,'Play opened IME');
   await page.mouse.click(r.x+18,r.y+r.height/2);await page.waitForFunction(()=>document.querySelector('#richAttachments audio').paused);assert.equal(ime(),false,'Pause opened IME');
   await page.click('#richText');await until(()=>ime());
   adb('shell','input','keyevent','4');await until(()=>!ime());
   assert.equal(await page.locator('#richText').isVisible(),true,'First Back hides the IME, preserving the note');
  });
  await run('explicit_system_picker_cancel_back_and_reopen',async()=>{
   assert.equal(picker(),false);await page.locator('#richPhotoPick').dblclick();await until(()=>picker());
   adb('shell','input','keyevent','4');await until(()=>!picker());
   assert.equal(await page.locator('#richText').inputValue(),'Syntetická hlasová poznámka');
   await page.click('#cancelModal');await page.waitForTimeout(300);assert.equal(picker(),false);
   await page.evaluate(id=>selected=id,noteId);await editSelected(page);await page.waitForTimeout(300);
   assert.equal(picker(),false,'Reopening must not launch a delayed picker');assert.equal(ime(),false);
   adb('shell','input','keyevent','4');await until(async()=>!(await page.locator('#modal').isVisible()));
   assert.equal(picker(),false);assert.equal(await page.evaluate(id=>current.items.find(i=>i.id===id).media.length,noteId),1,'Cancelled system selection must not attach another file');
  });
 }finally{if(device)await device.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
