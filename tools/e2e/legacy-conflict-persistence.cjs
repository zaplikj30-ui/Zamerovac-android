'use strict';
/**
 * Browser/WebView-style E2E using actual app.js, persistent localStorage and
 * IndexedDB. Browser callbacks are synthetic; NOT a real Android CAS/SAF test.
 * A clockless legacy original may survive a non-authoritative purge ONLY as a
 * marked copy. Repeated callbacks may never remove/duplicate that durable copy.
 */
const {suite,assert}=require('./harness.cjs');
const ORIGINAL='legacy-photo',PHOTO='legacy-photo-original',VIDEO='legacy-video-original';
const DIMENSION='1585,800001234567890123456789',LASER='1585.800001234567890123456789';
const A='11111111-1111-4111-8111-111111111111';
const PURGE={schema:1,syncProtocol:2,records:[],trashPurgedIds:[ORIGINAL],
  syncTombstones:{[ORIGINAL]:{[A]:42}}};

suite('legacy-conflict-persistence',async run=>{
 await run('clockless-legacy-copy-persists-reopen-media-editor-and-repeat-callback',async({page,step,evidence})=>{
  const before=await step('seed genuine browser persistent media and legacy photo',async()=>page.evaluate(async({ORIGINAL,PHOTO,VIDEO,DIMENSION,LASER})=>{
   if(!!window.Native)throw Error('This test needs the non-authoritative browser path');
   const canvas=document.createElement('canvas');canvas.width=40;canvas.height=30;
   const context=canvas.getContext('2d');context.fillStyle='#324c76';context.fillRect(0,0,40,30);
   context.fillStyle='#fed45c';context.fillRect(6,5,17,14);
   const photo=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));
   if(!photo?.size)throw Error('Original photo blob unavailable');
   const video=new Blob([new Uint8Array([0,0,0,28,102,116,121,112,105,115,111,109,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,101,120,97,99,116,45,118,105,100,101,111,45,98,121,116,101,115])],{type:'video/mp4'});
   const db=await mediaDb();
   await new Promise((resolve,reject)=>{const tx=db.transaction('files','readwrite');
    tx.objectStore('files').put(photo,PHOTO);tx.objectStore('files').put(video,VIDEO);
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});
   const digest=async blob=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
   const mediaHashes={photo:await digest(photo),video:await digest(video)};
   const record={id:ORIGINAL,kind:'photo',title:'Původní zaměření',rev:'legacy-rev',
    parentId:null,createdAt:'2026-11-09T10:00:00.000Z',updatedAt:'2026-11-09T10:01:00.000Z',
    width:40,height:30,deleted:false,media:[PHOTO,VIDEO],
    items:[{id:'exact-dimension',type:'dimension',measure:DIMENSION,
      laserMeasuredMm:LASER,unit:'mm'}],
    history:{past:[{measure:'1250,000000000000001',media:[PHOTO]}]},
    checks:[],text:'',syncClock:undefined};
   delete record.syncClock;
   state.records=[record];state.trashPurgedIds=[];state.syncTombstones={};
   if(!save())throw Error('initial browser save failed');
   showFolder();
   return {mediaHashes,originalRecord:JSON.parse(JSON.stringify(record)),
     persisted:localStorage.getItem('zamerovac-data')};
  },{ORIGINAL,PHOTO,VIDEO,DIMENSION,LASER}));
  assert.equal(JSON.parse(before.persisted).records[0].id,ORIGINAL);
  assert.equal(JSON.parse(before.persisted).records[0].syncClock,undefined);

  await step('open legacy photo using actual app UI before callback',async()=>{
   await page.locator('.entry[data-id="'+ORIGINAL+'"]').click();
   await page.waitForFunction(()=>screen==='editor'&&current?.id==='legacy-photo');
  });
  const snapshot=await step('reconcile real callback and persist marked conflict',async()=>page.evaluate(({PURGE})=>{
   const first=window.onNativeSync(JSON.stringify({data:PURGE,message:'synthetic browser callback'}));
   const disk=localStorage.getItem('zamerovac-data');
   return {first,copy:JSON.parse(JSON.stringify(state.records[0])),
    currentId:current?.id,linked:current===state.records[0],
    recordIds:state.records.map(r=>r.id),disk,
    failed:window.__lastSaveFailed===true};
  },{PURGE}));
  assert.equal(snapshot.first,true,'callback returned failure');
  assert.equal(snapshot.failed,false,'callback reported unsaved data');
  assert.equal(snapshot.recordIds.length,1,'purge must produce one marked copy');
  assert.notEqual(snapshot.copy.id,ORIGINAL,'confirmed removed identifier resurrected');
  assert.equal(snapshot.copy.conflictOf,ORIGINAL);
  assert.equal(snapshot.copy.conflict,true);
  assert.equal(snapshot.copy.items[0].measure,DIMENSION);
  assert.equal(snapshot.copy.items[0].laserMeasuredMm,LASER);
  assert.deepEqual(snapshot.copy.media,[PHOTO,VIDEO]);
  assert.deepEqual(snapshot.copy.history,before.originalRecord.history);
  assert.equal(snapshot.currentId,snapshot.copy.id,'editor not rebound to copy');
  assert.equal(snapshot.linked,true,'editor references another instance');
  assert.equal(JSON.parse(snapshot.disk).records.length,1,'copy was not durably persisted');
  const copyId=snapshot.copy.id;

  await step('reload actual browser page and reopen persisted copy via UI',async()=>{
   await page.reload();
   await page.waitForFunction(()=>typeof window.onNativeSync==='function');
   await page.locator('.entry[data-id="'+copyId+'"]').click();
   await page.waitForFunction(id=>screen==='editor'&&current?.id===id,copyId);
  });
  const reopened=await page.evaluate(()=>({copy:JSON.parse(JSON.stringify(state.records[0])),
   editorId:current?.id,linked:current===state.records[0],
   dataLoadFailed, disk:localStorage.getItem('zamerovac-data'),
   originalExists:state.records.some(r=>r.id==='legacy-photo')}));
  assert.equal(reopened.dataLoadFailed,false);
  assert.equal(reopened.originalExists,false);
  assert.equal(reopened.editorId,copyId);
  assert.equal(reopened.linked,true);
  assert.equal(reopened.copy.items[0].measure,DIMENSION);
  assert.equal(reopened.copy.items[0].laserMeasuredMm,LASER);
  assert.deepEqual(reopened.copy.media,[PHOTO,VIDEO]);
  assert.deepEqual(reopened.copy.history,before.originalRecord.history);

  const repeated=await step('replay callback twice against reopened editor',async()=>page.evaluate(({PURGE})=>{
   const acknowledgements=[window.onNativeSync(JSON.stringify({data:PURGE,message:'retry 1'})),
     window.onNativeSync(JSON.stringify({data:PURGE,message:'retry 2'}))];
   return {acknowledgements,copyCount:state.records.filter(r=>r.conflictOf==='legacy-photo').length,
    ids:state.records.map(r=>r.id),editorId:current?.id,
    linked:current===state.records[0],disk:localStorage.getItem('zamerovac-data'),
    failed:window.__lastSaveFailed===true};
  },{PURGE}));
  assert.deepEqual(repeated.acknowledgements,[true,true]);
  assert.equal(repeated.failed,false);
  assert.deepEqual(repeated.ids,[copyId],'repeated callbacks removed or duplicated the copy');
  assert.equal(repeated.copyCount,1);
  assert.equal(repeated.editorId,copyId);
  assert.equal(repeated.linked,true);
  assert.deepEqual(JSON.parse(repeated.disk).records.map(r=>r.id),[copyId]);

  const mediaAfter=await step('verify both original media blobs remain byte-exact in IndexedDB',async()=>page.evaluate(async ({PHOTO,VIDEO})=>{
   const db=await mediaDb(),result={};
   for(const [name,id] of [['photo',PHOTO],['video',VIDEO]]){
    const blob=await new Promise((resolve,reject)=>{const tx=db.transaction('files','readonly');
     const req=tx.objectStore('files').get(id);req.onsuccess=()=>resolve(req.result);
     req.onerror=()=>reject(req.error)});
    if(!blob)throw Error('Original '+name+' missing');
    result[name]=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer())),v=>v.toString(16).padStart(2,'0')).join('');
   }
   return result;
  },{PHOTO,VIDEO}));
  assert.deepEqual(mediaAfter,before.mediaHashes,'photo/video original bytes changed');
  await step('final durable restart verifies no resurrection or duplicate',async()=>{
   await page.reload();await page.waitForFunction(()=>typeof window.onNativeSync==='function');
   const final=await page.evaluate(()=>({records:state.records.map(r=>({id:r.id,conflictOf:r.conflictOf,
      media:r.media,items:r.items,history:r.history})),disk:localStorage.getItem('zamerovac-data')}));
   assert.deepEqual(final.records.map(r=>r.id),[copyId]);
   assert.equal(final.records[0].conflictOf,ORIGINAL);
   assert.equal(final.records[0].items[0].measure,DIMENSION);
   assert.deepEqual(final.records[0].media,[PHOTO,VIDEO]);
   assert.deepEqual(final.records[0].history,before.originalRecord.history);
   assert.deepEqual(JSON.parse(final.disk).records.map(r=>r.id),[copyId]);
  });
  evidence({source:'actual app.js in Chromium browser-only synthetic callback',
   oldIdNeverRevived:true,copyId,editorRebound:true,persistAndReopen:true,
   repeatedCallbacks:2,mediaSHA256Unchanged:mediaAfter,androidCas:'NOT RUN'});
 });
});
