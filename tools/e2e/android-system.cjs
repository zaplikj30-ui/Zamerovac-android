'use strict';
// Run only by the existing emulator workflow, against its real preview WebView.
// No Native mock and no extra framework. Missing CDP/IME evidence is a failure,
// never a successful screenshot-only smoke. Creates synthetic records only.
const {execFileSync}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require('playwright');
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
 let browser,page;
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
   adb('forward','tcp:9222','localabstract:webview_devtools_remote_'+pid);
   browser=await chromium.connectOverCDP('http://127.0.0.1:9222');
   page=browser.contexts()[0]?.pages()[0];assert(page,'Real WebView page missing');page.setDefaultTimeout(7000);
   assert(await page.evaluate(()=>typeof Native==='object'&&native),'Must use the real Android bridge');
   if(await page.locator('#modal').isVisible()){
    if(await page.locator('#cancelModal').isVisible())await page.click('#cancelModal');
    else await page.click('#okModal'); // Read-only release notes hide Cancel.
   }
   if(await page.locator('#editorView').isVisible())await page.click('#editorBack');
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
 }finally{if(browser)await browser.close();try{adb('forward','--remove','tcp:9222')}catch{}}
})().catch(e=>{console.error(e);process.exitCode=1});
