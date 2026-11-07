'use strict';
// Measurements, not invented speed limits. Native timings below are a JS bridge
// model; Android filesystem/Bitmap/IME/CPU measurements still require Android.
const {suite,assert,chooseFiles,createCanvas,tool,drag,editSelected}=require('./harness.cjs');
const nativeStorage=require('./native-storage-fixture.cjs');
async function png(page,w,h){return Buffer.from(await page.evaluate(([w,h])=>{
 const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d'),p=x.createImageData(w,h);
 let seed=12345;for(let i=0;i<p.data.length;i+=4){seed=(Math.imul(seed,1664525)+1013904223)>>>0;p.data[i]=p.data[i+1]=p.data[i+2]=seed>>>16&255;p.data[i+3]=255}
 x.putImageData(p,0,0);return c.toDataURL().split(',')[1];
},[w,h]),'base64')}
suite('latency',async test=>{
 await test('project_1_10_50_editable_documents',async({page,evidence})=>{
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
 });
 for(const size of [[1200,800],[6000,4000]])await test('photo_and_gallery_'+size.join('x'),async({page,evidence})=>{
  const bytes=await png(page,...size),samples=[];
  for(let i=0;i<3;i++){
   await page.evaluate(()=>window.latencyStart=performance.now());
   await chooseFiles(page,'#galleryBtn',{name:'latency.png',mimeType:'image/png',buffer:bytes});
   await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
   const open=await page.evaluate(()=>performance.now()-latencyStart);
   await page.evaluate(()=>{latencyStart=performance.now();document.querySelector('#galleryMode').click()});
   await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>1);
   const gallery=await page.evaluate(()=>performance.now()-latencyStart);
   await page.click('.gallery-top [data-action="close"]');
   const save=await page.evaluate(()=>{const start=performance.now();if(!commitEditor())throw Error('save failed');const disk=JSON.parse(localStorage.getItem('zamerovac-data'));if(!disk.records.find(r=>r.id===current.id))throw Error('missing durable record');return performance.now()-start});
   samples.push({iteration:i,openMs:open,galleryMs:gallery,confirmedSaveReadbackMs:save});await page.click('#editorBack');
  }
  await page.reload();assert.equal(await page.evaluate(()=>state.records.filter(r=>r.kind==='photo').length),3);
  evidence({size,pngBytes:bytes.length,platform:'Linux Chromium/localStorage/IndexedDB; open includes UI file chooser automation',samples});
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
   assert.equal(result.saved.resolved,true);assert.equal(result.saved.screenshotId,'synthetic-screen');assert.equal(result.stats.finish,1,'Double click must publish only once');
   samples.push({iteration:i,...result});
  }
  await page.reload();await page.evaluate(()=>window.__openFeedbackList());assert.equal(await page.locator('[data-feedback-edit]').count(),1);
  evidence({size,originalPngBytes:bytes.length,platform:'Chromium with Native bridge model; no Android disk delay',samples});
 });
}).catch(e=>{console.error(e);process.exitCode=1});
