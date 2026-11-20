'use strict';
const fs=require('node:fs'),path=require('node:path');
// Measurements, not invented speed limits. Native timings below are a JS bridge
// model; Android filesystem/Bitmap/IME/CPU measurements still require Android.
const {suite,assert,chooseFiles,createCanvas,tool,drag,editSelected}=require('./harness.cjs');
const {checkFolderSaveAndListDates,checkPhotoImportAndImmediateGrip}=require('./editor-response-checks.cjs');
const nativeStorage=require('./native-storage-fixture.cjs');
async function png(page,w,h){return Buffer.from(await page.evaluate(([w,h])=>{
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),p=x.createImageData(w,h);
 let seed=12345;for(let i=0;i<p.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;p.data[i]=p.data[i+1]=p.data[i+2]=seed>>>16&255;p.data[i+3]=255}
 x.putImageData(p,0,0);return c.toDataURL().split(',')[1];
},[w,h]),'base64')}
suite('latency',async test=>{
 await test('project_1_10_50_editable_documents',async({page,step,evidence})=>{
  await createCanvas(page,'Syntetická zakázka');await tool(page,'dimension');await drag(page,{x:100,y:240},{x:450,y:320});await editSelected(page);
  await page.fill('#measureInput','1585,800001');await page.click('#okModal');
  const samples=await page.evaluate(()=>{
   const template=JSON.parse(JSON.stringify(current)),folder=newRecord('folder','Zakázka – baseline'),rows=[];
   for(const count of [1,10,50]){
    state.records=[folder,...Array.from({length:count},(_,i)=>({...template,id:'latency-document-'+i,parentId:folder.id,
     items:Array.from({length:20},(_,j)=>({...template.items[0],id:'dimension-'+i+'-'+j}))}))];
    for(let iteration=0;iteration<3;iteration++){
     const start=performance.now();if(!save())throw Error('project save failed');
     const text=localStorage.getItem('zamerovac-data'),disk=JSON.parse(text);
     if(disk.records.length!==count+1||disk.records.at(-1).items[19].measure!=='1585,800001')throw Error('project readback mismatch');
     rows.push({count,iteration,itemsPerDocument:20,jsonBytes:new TextEncoder().encode(text).length,confirmedSaveReadbackMs:performance.now()-start});
    }
   }return rows;
  });
  await page.reload();assert.equal(await page.evaluate(()=>state.records.length),51);
  evidence({platform:'Linux Chromium/localStorage; synthetic hierarchy and exact editable dimensions',samples});

  // Real Chromium UI click/commit/render/readback. Browser localStorage is not Android disk.
  const folderUi=[];
  await page.evaluate(()=>{
   window.__folderProbe={saves:[],renders:[],clickAt:null};
   document.querySelector('#okModal').addEventListener('click',()=>{__folderProbe.clickAt=performance.now()},true);
   const save0=window.save,render0=window.showFolder;
   if(typeof save0!=='function'||typeof render0!=='function')throw Error('Missing app save/render functions');
   window.save=function(...a){
    const start=performance.now(),ok=save0.apply(this,a);
    __folderProbe.saves.push({ms:performance.now()-start,ok});return ok;
   };
   window.showFolder=function(...a){
    const start=performance.now(),result=render0.apply(this,a);
    __folderProbe.renders.push({ms:performance.now()-start,clickToRenderedMs:__folderProbe.clickAt===null?null:performance.now()-__folderProbe.clickAt});return result;
   };
  });
  for(let i=0;i<3;i++){
   const title='Složka UI '+i;
   await page.click('#createBtn');
   await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
   await page.fill('#promptValue',title);
   await page.click('#okModal');
   assert.equal(await page.locator('.entry-title',{hasText:title}).count(),1);
   const info=await page.evaluate(name=>{
    const records=JSON.parse(localStorage.getItem('zamerovac-data')).records;
    return {count:records.filter(r=>r.title===name).length,save:__folderProbe.saves.at(-1),paint:__folderProbe.renders.at(-1)};
   },title);
   assert.equal(info.count,1,'Folder was displayed but not saved');
   assert.equal(info.save.ok,true,'Save was not acknowledged');
   folderUi.push({case:i,saveJsMs:info.save.ms,showFolderJsMs:info.paint.ms,clickToRenderedMs:info.paint.clickToRenderedMs});
  }
  // Two synthetic DOM click dispatches during the same modal must not duplicate a record.
  await page.click('#createBtn');
  await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
  await page.fill('#promptValue','Složka dvojklik');
  await page.evaluate(()=>{const button=document.querySelector('#okModal');button.click();button.click()});
  assert.equal(await page.locator('.entry-title',{hasText:'Složka dvojklik'}).count(),1);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-data')).records.filter(r=>r.title==='Složka dvojklik').length),1);
  await page.reload();
  for(const title of ['Složka UI 0','Složka UI 1','Složka UI 2','Složka dvojklik'])
   assert.equal(await page.locator('.entry-title',{hasText:title}).count(),1,'Folder missing after real browser reload');
  evidence({platform:'Chromium localStorage (no Android I/O)',folderUi,doubleDomClick:true,reload:true});
  await step('Folder save and Czech list dates in projects with 1, 10 and 50 items',
   ()=>checkFolderSaveAndListDates({page,evidence}));
  // A separate synthetic native CAS bridge: negative failure must leave the modal and disk unchanged.
  await nativeStorage(page);
  await page.evaluate(()=>{
   window.__folderBridge={calls:[],pendingRequests:0};
   Native.pendingAudio=()=>{__folderBridge.pendingRequests++;return JSON.stringify([{issue:'journal-uncertain',state:'needs-review',available:false}])};
   const saved=Native.saveDataChecked;
   Native.saveDataChecked=function(text,expected){
    const t=performance.now(),response=JSON.parse(saved.call(this,text,expected));
    __folderBridge.calls.push({ok:response.ok,bridgeModelMs:performance.now()-t});
    return JSON.stringify(response.ok?{...response,audioPending:true,pendingAudioCount:1}:response);
   };
  });
  await page.click('#createBtn');
  await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
  await page.fill('#promptValue','Složka chyba disku');
  await page.evaluate(()=>{syntheticWriteFailure=true});
  await page.click('#okModal');
  assert.equal(await page.locator('#modal').isVisible(),true,'Disk failure closed folder form');
  assert.equal(await page.evaluate(()=>state.records.some(r=>r.title==='Složka chyba disku')),false,'Rejected folder escaped into live state');
  await page.evaluate(()=>{syntheticWriteFailure=false});
  await page.click('#okModal');
  assert.equal(await page.locator('.entry-title',{hasText:'Složka chyba disku'}).count(),1);
  const bridge=await page.evaluate(()=>({
   calls:__folderBridge.calls,
   pendingRequests:__folderBridge.pendingRequests,
   diskCount:JSON.parse(syntheticDisk).records.length,
   pendingVisible:!!document.querySelector('#pendingAudioBanner')
  }));
  assert.equal(bridge.calls.length,2,'Expected one failed and one accepted model CAS');
  assert.equal(bridge.calls[0].ok,false);assert.equal(bridge.calls[1].ok,true);
  assert.equal(bridge.diskCount,1,'Retry created duplicate folder');
  assert(bridge.pendingVisible,'Uncertain audio warning must remain visible');
  evidence({platform:'Chromium + mock Native CAS/audio (NOT Android)',bridge});

 });
 for(const size of [[1200,800],[6000,4000]])await test('photo_and_gallery_'+size.join('x'),async({page,step,evidence,directory})=>{
  const bytes=await png(page,...size),samples=[];
  // Use a real local file. Sending a 37 MB Buffer through Playwright's protocol
  // exceeded the CI fileChooser timeout before the app could handle the input.
  const fixture=path.join(directory,'synthetic-'+size.join('x')+'.png');fs.writeFileSync(fixture,bytes);
  try{
  for(let i=0;i<3;i++){
   await page.evaluate(()=>window.latencyStart=performance.now());
   await chooseFiles(page,'#galleryBtn',fixture);
   await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
   const open=await page.evaluate(()=>performance.now()-latencyStart);
   await page.evaluate(()=>{latencyStart=performance.now();document.querySelector('#galleryMode').click()});
   await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>1);
   const gallery=await page.evaluate(()=>performance.now()-latencyStart);
   await page.click('.gallery-top [data-action="close"]');
   const save=await page.evaluate(()=>{const start=performance.now();if(!commitEditor())throw Error('save failed');const disk=JSON.parse(localStorage.getItem('zamerovac-data'));if(!disk.records.find(r=>r.id===current.id))throw Error('missing durable record');return performance.now()-start});
   samples.push({iteration:i,openMs:open,galleryMs:gallery,confirmedSaveReadbackMs:save});await page.click('#editorBack');
  }
  }finally{fs.rmSync(fixture,{force:true})}
  await page.reload();assert.equal(await page.evaluate(()=>state.records.filter(r=>r.kind==='photo').length),3);
  evidence({size,pngBytes:bytes.length,fixtureDelivery:'local file path',platform:'Linux Chromium/localStorage/IndexedDB; open includes UI file chooser automation',samples});
  if(size[0]===1200)await step('JPEG import, immediate grip drag and durable readback',
   ()=>checkPhotoImportAndImmediateGrip({page,evidence}));
 });
 for(const size of [[320,240],[1440,2800]])await test('existing_feedback_'+size.join('x'),async({page,evidence})=>{
  const bytes=await png(page,...size);await nativeStorage(page);
  await page.route('https://appassets.androidplatform.net/media/**',route=>route.fulfill({status:200,contentType:'image/png',headers:{'access-control-allow-origin':'*'},body:bytes}));
  await page.addInitScript(()=>{const ImageOriginal=window.Image;window.Image=class extends ImageOriginal{constructor(...args){super(...args);this.crossOrigin='anonymous'}}});
  await page.evaluate(()=>{
   const time=new Date().toISOString();localStorage.setItem('zamerovac-feedback-v1',JSON.stringify([{id:'feedback-latency',title:'Syntetická připomínka',description:'Výkon',screenshotId:'synthetic-screen',annotations:[{type:'pen',points:[[.1,.1],[.4,.4]],color:'#f7dc27',width:3}],videos:[],createdAt:time,updatedAt:time}]));
  });await page.reload();
  await page.evaluate(()=>{
   window.mediaStats={begin:0,chunks:0,finish:0,bytes:0,bridgeMs:0,encodeMs:0};
   Native.beginMediaChecked=()=>{mediaStats.begin++;return true};
   Native.appendMedia=(id,data)=>{const start=performance.now();mediaStats.chunks++;mediaStats.bytes+=atob(data).length;mediaStats.bridgeMs+=performance.now()-start;return true};
   Native.finishMedia=()=>{mediaStats.finish++;return true};
   const original=HTMLCanvasElement.prototype.toBlob;
   HTMLCanvasElement.prototype.toBlob=function(callback,...args){const start=performance.now();return original.call(this,b=>{mediaStats.encodeMs+=performance.now()-start;callback(b)},...args)};
  });
  const samples=[];
  let firstRasterId=null;
  for(let i=0;i<3;i++){
   await page.evaluate(()=>window.__openFeedbackList());await page.click('[data-feedback-edit="feedback-latency"]');
   await page.waitForFunction(([w,h])=>{const c=document.querySelector('#feedbackCanvas');return c?.width===w&&c?.height===h},size);
   if(!await page.locator('#feedbackResolved').isVisible())await page.click('#feedbackFieldsToggle');
   await page.check('#feedbackResolved');
   const result=await page.evaluate(()=>new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(Error('Save did not finish: '+document.querySelector('#toast').textContent)),60000);
    const start=performance.now(),before={...mediaStats},button=document.querySelector('#feedbackSave');
    const watch=new MutationObserver(()=>{
     if(!document.querySelector('[data-feedback-edit="feedback-latency"]'))return;
     clearTimeout(timer);watch.disconnect();const saved=JSON.parse(localStorage.getItem('zamerovac-feedback-v1'))[0];
     resolve({totalMs:performance.now()-start,saved,stats:Object.fromEntries(Object.entries(mediaStats).map(([k,v])=>[k,v-before[k]]))});
    });watch.observe(document.body,{childList:true,subtree:true});button.click();button.click();
   }));
   assert.equal(result.saved.resolved,true);
   assert.equal(result.saved.screenshotId,'synthetic-screen');
   assert.ok(result.saved.annotatedId,'Annotated original must stay linked');
   // Legacy reports without an annotatedId get one PNG on first save.
   // After that, status-only edits must reuse it and do zero re-encoding/uploads.
   const expectedUploads=i===0?1:0;
   assert.equal(result.stats.begin,expectedUploads,'Unexpected media staging for status-only edit');
   assert.equal(result.stats.finish,expectedUploads,'Double click or reuse caused an unexpected media publish');
   if(i===0)firstRasterId=result.saved.annotatedId;
   else{
    assert.equal(result.saved.annotatedId,firstRasterId,'Status-only edit replaced original annotated screenshot');
    assert.equal(result.stats.chunks,0,'Unchanged annotation must not reupload chunks');
    assert.equal(result.stats.bytes,0,'Unchanged annotation must not send raster over the Android bridge');
   }
   assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-feedback-v1')).length),1,
    'Double click must not duplicate feedback records');
   samples.push({iteration:i,...result});
  }
  await page.reload();await page.evaluate(()=>window.__openFeedbackList());assert.equal(await page.locator('[data-feedback-edit]').count(),1);
  evidence({size,originalPngBytes:bytes.length,platform:'Chromium with Native bridge model; no Android disk delay',samples});
 });

 await test('feedback_slow_save_blocks_close_list_and_android_back',async({page,evidence})=>{
  const screenshot=await png(page,480,800);
  await nativeStorage(page);
  await page.route('https://appassets.androidplatform.net/media/**',route=>route.fulfill({
   status:200,contentType:'image/png',
   headers:{'access-control-allow-origin':'*'},body:screenshot
  }));
  await page.addInitScript(()=>{
   const ImageOriginal=window.Image;
   window.Image=class extends ImageOriginal{constructor(...args){super(...args);this.crossOrigin='anonymous'}};
  });
  await page.evaluate(()=>{
   const now=new Date().toISOString();
   localStorage.setItem('zamerovac-feedback-v1',JSON.stringify([{
    id:'feedback-save-guard',title:'Pomalá připomínka',description:'Rozpracovaný snímek',
    screenshotId:'save-guard-screen',annotatedId:null,
    annotations:[{type:'pen',points:[[.1,.1],[.3,.4]]}],videos:[],resolved:false,createdAt:now,updatedAt:now
   }]));
  });
  await page.reload();
  await page.evaluate(()=>{
   window.__feedbackSaveCounts={begin:0,finish:0};
   Native.beginMediaChecked=()=>{__feedbackSaveCounts.begin++;return true};
   Native.appendMedia=()=>true;
   Native.finishMedia=()=>{__feedbackSaveCounts.finish++;return true};
   const original=HTMLCanvasElement.prototype.toBlob;
   HTMLCanvasElement.prototype.toBlob=function(callback,...args){
    if(this.id==='feedbackCanvas'){
     const c=this;
     window.__resumeFeedbackSave=()=>original.call(c,callback,...args);
     return;
    }
    return original.call(this,callback,...args);
   };
  });
  await page.evaluate(()=>window.__openFeedbackList());
  await page.click('[data-feedback-edit="feedback-save-guard"]');
  await page.waitForFunction(()=>document.querySelector('#feedbackCanvas')?.width===480);
  await page.click('#feedbackSave');
  await page.waitForFunction(()=>typeof window.__resumeFeedbackSave==='function');
  await page.click('#feedbackClose');
  await page.click('#feedbackToList');
  assert.equal(await page.locator('#feedbackSave').count(),1,'Editor must remain visible while writing');
  assert.equal(await page.locator('#feedbackSave').isDisabled(),true,'Prevent duplicate Save');
  assert.equal(await page.evaluate(()=>window.handleAndroidBack()),'handled');
  assert.equal(await page.locator('#feedbackSave').count(),1,'Android Back must not discard the pending draft');
  assert.equal(await page.evaluate(()=>{
   const r=JSON.parse(localStorage.getItem('zamerovac-feedback-v1'))[0];
   return r.annotatedId||null;
  }),null,'No annotated media must be published before PNG encoding completes');
  await page.evaluate(()=>{
   const complete=window.__resumeFeedbackSave;
   window.__resumeFeedbackSave=null;
   complete();
  });
  await page.waitForFunction(()=>{
   const r=JSON.parse(localStorage.getItem('zamerovac-feedback-v1'))[0];
   return !!r?.annotatedId&&!!document.querySelector('[data-feedback-edit="feedback-save-guard"]');
  });
  const result=await page.evaluate(()=>({
   reports:JSON.parse(localStorage.getItem('zamerovac-feedback-v1')),
   counts:window.__feedbackSaveCounts
  }));
  assert.equal(result.reports.length,1,'Delayed Save must not duplicate records');
  assert.equal(result.reports[0].screenshotId,'save-guard-screen');
  assert.ok(result.reports[0].annotatedId,'Original annotation must be saved after completion');
  assert.equal(result.counts.begin,1);
  assert.equal(result.counts.finish,1);
  evidence({scenario:'actual Chromium clicks while PNG encode deliberately delayed',result});
 });
}).catch(e=>{console.error(e);process.exitCode=1});
