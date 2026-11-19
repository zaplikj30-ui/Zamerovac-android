'use strict';
const assert=require('node:assert/strict');
const {createHash}=require('node:crypto');
const {performance}=require('node:perf_hooks');
const {setTimeout:delay}=require('node:timers/promises');
const {deflateSync,crc32}=require('node:zlib');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {tool,drag,projected,editSelected,midpoint}=require('./harness.cjs');

const filename='pr220-synthetic.png';
const remote='/sdcard/Download/'+filename;

// Deterministic 1200 x 1000 RGB PNG with high-entropy pixels and no metadata.
function fixture(){
 const u32=n=>{const b=Buffer.alloc(4);b.writeUInt32BE(n);return b};
 const chunk=(name,bytes)=>{
  const data=Buffer.concat([Buffer.from(name),bytes]);
  return Buffer.concat([u32(bytes.length),data,u32(crc32(data))]);
 };
 const width=1200,height=1000,stride=1+3*width;
 const pixels=Buffer.alloc(stride*height);
 let random=123456789;
 for(let y=0;y<height;y++)for(let x=1;x<stride;x++){
  random ^= random<<13;random ^= random>>>17;random ^= random<<5;
  pixels[y*stride+x]=random&255;
 }
 return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),
  chunk('IHDR',Buffer.concat([u32(width),u32(height),Buffer.from([8,2,0,0,0])])),
  chunk('IDAT',deflateSync(pixels)),chunk('IEND',Buffer.alloc(0))]);
}

function pickerControl(adb,label){
 adb('shell','uiautomator','dump','/sdcard/pr220-window.xml');
 const xml=adb('shell','cat','/sdcard/pr220-window.xml');
 for(const node of xml.matchAll(/<node\b[^>]*>/g)){
  if(!node[0].includes('text="'+label+'"')&&!node[0].includes('content-desc="'+label+'"'))continue;
  const b=/bounds="\[(\d+),(\d+)\]\[(\d+),(\d+)\]"/.exec(node[0]);
  if(b&&Number(b[3])>Number(b[1])&&Number(b[4])>Number(b[2]))
   return [Math.floor((+b[1]+ +b[3])/2),Math.floor((+b[2]+ +b[4])/2)].map(String);
 }
 return null;
}

async function folder(page,title){
 await page.click('#createBtn');
 await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
 await page.fill('#promptValue',title);
 await page.click('#okModal');
 await page.getByText(title,{exact:true}).waitFor({state:'visible'});
}

async function sample({device,adb,open,apk,count,hash}){
 const page=await open(device,apk);
 for(let i=0;i<count;i++)await folder(page,'QA položka '+i);
 // Measure the existing save entry point and canvas draw, without changing the Native bridge.
 await page.evaluate(()=>{
  window.__qa={saves:[],pointer:null,dragDraw:null,photoDraw:null};
  const saveRecord=save,draw=paint,loadImage=loadPhotoImage;
  loadPhotoImage=async function(...args){
   const started=performance.now();
   const image=await loadImage.apply(this,args);
   __qa.loadImageMs=performance.now()-started;
   return image;
  };
  save=function(...args){
   const started=performance.now(),accepted=saveRecord.apply(this,args);
   __qa.saves.push({ms:performance.now()-started,accepted});
   return accepted;
  };
  paint=function(...args){
   const result=draw.apply(this,args),end=performance.now();
   if(current?.kind==='photo'&&stageImg&&__qa.photoDraw===null)__qa.photoDraw=end;
   if(__qa.pointer!==null&&selectedHandle?.dragged&&__qa.dragDraw===null)
    __qa.dragDraw=end-__qa.pointer;
   return result;
  };
  document.querySelector('#drawCanvas').addEventListener('pointerdown',()=>{
   if(__qa.trackDrag)__qa.pointer=performance.now();
  },true);
 });
 await folder(page,'QA potvrzené uložení');
 const folderSave=await page.evaluate(()=>__qa.saves.at(-1));
 assert.equal(folderSave?.accepted,true,'Folder write not acknowledged');

 await page.click('#createBtn');
 await page.locator('#newMenu .choice').filter({hasText:'Importovat obrázek / PDF / video'}).click();
 const picker=/mResumedActivity[^\n]*(?:documentsui|DocumentsActivity)/i;
 const pickerDeadline=performance.now()+10000;
 while(!picker.test(adb('shell','dumpsys','activity','activities'))){
  assert(performance.now()<pickerDeadline,'Android picker did not become active');
  await delay(150);
 }
 let target=pickerControl(adb,filename);
 if(!target){
  const roots=pickerControl(adb,'Show roots');
  assert(roots,'DocumentsUI navigation unavailable');
  adb('shell','input','tap',...roots);
  const downloads=pickerControl(adb,'Downloads');
  assert(downloads,'Downloads location unavailable');
  adb('shell','input','tap',...downloads);
  target=pickerControl(adb,filename);
 }
 assert(target,'Synthetic fixture not visible in Android picker');
 const started=performance.now();
 adb('shell','input','tap',...target);
 await page.waitForFunction(()=>screen==='editor'&&!!stageImg&&__qa.photoDraw!==null,null,{timeout:25000});
 const pickerToCanvasObservedMs=performance.now()-started;
 const imageLoadAndDecodeMs=await page.evaluate(()=>__qa.loadImageMs);
 assert(Number.isFinite(imageLoadAndDecodeMs)&&imageLoadAndDecodeMs>=0);
 await tool(page,'dimension');
 const bounds=await page.locator('#drawCanvas').boundingBox();
 assert(bounds&&bounds.width>100&&bounds.height>100);
 await drag(page,{x:bounds.width*.25,y:bounds.height*.42},{x:bounds.width*.68,y:bounds.height*.52});
 await editSelected(page);
 await page.fill('#measureInput','1585,800001');
 await page.click('#okModal');
 const initial=await page.evaluate(()=>structuredClone(current.items[0]));
 const endpoint=await projected(page,initial.b);
 await page.evaluate(()=>{__qa.trackDrag=true});
 await drag(page,endpoint,{x:endpoint.x+28,y:endpoint.y+16});
 const endpointProof=await page.evaluate(()=>({item:structuredClone(current.items[0]),ms:__qa.dragDraw}));
 assert.notDeepEqual(endpointProof.item.b,initial.b);
 assert.deepEqual(endpointProof.item.a,initial.a);
 assert(Number.isFinite(endpointProof.ms)&&endpointProof.ms>=0);
 const first=await projected(page,endpointProof.item.a),last=await projected(page,endpointProof.item.b);
 const body=midpoint(first,midpoint(first,last),.86);
 await page.evaluate(()=>{__qa.dragDraw=null});
 await drag(page,body,{x:body.x+18,y:body.y-23});
 const proof=await page.evaluate(()=>{
  const record=JSON.parse(Native.loadData()).records.find(r=>r.id===current.id);
  return {item:structuredClone(current.items[0]),record,dragMs:__qa.dragDraw};
 });
 assert.notDeepEqual(proof.item.a,endpointProof.item.a);
 for(const axis of ['x','y'])assert(Math.abs(
  (proof.item.a[axis]-endpointProof.item.a[axis])-(proof.item.b[axis]-endpointProof.item.b[axis]))<1e-8);
 assert.equal(proof.item.id,initial.id);
 assert.equal(proof.item.measure,'1585,800001');
 assert.deepEqual(proof.record.items[0],proof.item);
 assert(Number.isFinite(proof.dragMs)&&proof.dragMs>=0);
 const mediaHash=await page.evaluate(async id=>{
  const response=await fetch(await assetUrl(id));
  if(!response.ok)throw Error('Imported media unavailable');
  const digest=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());
  return [...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('');
 },proof.record.media[0]);
 assert.equal(mediaHash,hash);
 await page.reload();
 const restored=await page.evaluate(id=>recById(id),proof.record.id);
 assert.deepEqual(restored?.media,proof.record.media);
 assert.deepEqual(restored?.items,proof.record.items);
 return {pickerToCanvasObservedMs,imageLoadAndDecodeMs,folderSaveMs:folderSave.ms,endpointToCanvasDrawMs:endpointProof.ms,bodyToCanvasDrawMs:proof.dragMs};
}

async function compare({device,adb,open,apks}){
 const dir=mkdtempSync(path.join(tmpdir(),'pr220-'));
 const bytes=fixture(),hash=createHash('sha256').update(bytes).digest('hex');
 assert(bytes.length>=3*1024*1024&&bytes.length<=6*1024*1024);
 const local=path.join(dir,filename);
 try{
  writeFileSync(local,bytes);
  adb('shell','mkdir','-p','/sdcard/Download');
  adb('push',local,remote);
  console.log('Synthetic PNG',bytes.length,hash);
  for(const count of [1,10,50]){
   const rows={before:[],after:[]};
   for(let repetition=0;repetition<=5;repetition++){
    for(const side of repetition%2?['after','before']:['before','after']){
     const result=await sample({device,adb,open,apk:apks[side],count,hash});
     if(repetition>0){
      rows[side].push(result);
      console.log(JSON.stringify({count,repetition,side,...result}));
     }
    }
   }
   for(const [side,results] of Object.entries(rows)){
    const summary=Object.fromEntries(Object.keys(results[0]).map(key=>{
     const values=results.map(r=>r[key]).sort((a,b)=>a-b);
     return [key,{min:values[0],median:values[2],max:values[4]}];
    }));
    console.log(JSON.stringify({count,side,samples:results.length,summary}));
   }
  }
 }finally{
  try{adb('shell','rm','-f',remote,'/sdcard/pr220-window.xml')}
  finally{rmSync(dir,{recursive:true,force:true})}
 }
}

module.exports={compare,fixture};
