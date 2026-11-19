'use strict';
const nativeStorage=require('./native-storage-fixture.cjs');
const {suite,assert,chooseFiles,tool,drag,projected,editSelected,midpoint}=require('./harness.cjs');

suite('editor-response',async test=>{
 await test('status_icons_fit_small_phone_and_open_details',async({page,evidence})=>{
  await nativeStorage(page);
  await page.setViewportSize({width:320,height:640});
  const mic=page.locator('#pendingAudioBanner'),cloud=page.locator('#cloudBtn');
  await page.evaluate(()=>{Native.pendingAudio=()=> '[]';PendingAudio.refresh()});
  assert.equal(await mic.count(),0);
  for(const journal of [
   '[{"id":"voice-fixture","available":true,"state":"pending"}]',
   '[{"issue":"journal-uncertain","available":false}]',
   '{broken'
  ]){
   await page.evaluate(raw=>{Native.pendingAudio=()=>raw;PendingAudio.refresh()},journal);
   assert.equal(await mic.isVisible(),true);
   const placement=await mic.evaluate(el=>{
    const r=el.getBoundingClientRect(),hits=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
    return {width:r.width,height:r.height,inside:el.parentElement.id==='browserFoot',clickable:el.contains(hits)};
   });
   assert(placement.width>=44&&placement.height>=44&&placement.inside&&placement.clickable);
   assert.equal(await mic.getAttribute('aria-label'),'Nahrávky vyžadují kontrolu');
   await mic.click();assert.equal(await page.locator('#retainedAudioList').isVisible(),true);
   if(journal.includes('uncertain')||journal==='{broken')
    assert.match(await page.locator('#retainedAudioList').innerText(),/vyžaduje kontrolu/);
   await page.click('#okModal');
  }
  await page.click('#back');
  await page.locator('#navMenu button').filter({hasText:'Nastavení'}).click();
  await page.locator('.settings-category[data-category="maintenance"]').click();
  await page.click('#openPendingAudioRecovery');
  assert.match(await page.locator('#retainedAudioList').innerText(),/vyžaduje kontrolu/);
  await page.click('#okModal');
  await page.click('#closeSettings');
  await page.click('#closeSettings');
  const states=[['unset','Nenastaveno'],['pending','Čeká'],['confirmed','Potvrzeno'],['failed','Selhalo']];
  for(const [phase,label] of states){
   await page.evaluate(phase=>{
    const api=ZamerovacSyncStatus;
    if(phase==='pending')api.peerState({peers:{fixture:{}}});
    if(phase==='confirmed'){
     Native.syncLedgerState=()=>JSON.stringify({localSaved:true,targets:[{kind:'drive',state:'transport-ack',contentState:'not-required'}]});
     api.cloud({transport:'cloud-v2',pending:false});
    }
    if(phase==='failed')api.peerProblem('Syntetická chyba');
   },phase);
   assert.equal(await cloud.getAttribute('aria-label'),'Synchronizace: '+label);
   const marker=await cloud.locator('.sync-mark').evaluateAll(paths=>paths.filter(p=>getComputedStyle(p).display!=='none').map(p=>p.getAttribute('class')));
   assert.deepEqual(marker,['sync-mark sync-mark-'+phase]);
  }
  await cloud.click();assert.match(await page.locator('#modalTitle').innerText(),/Synchronizace · Selhalo/);
  await page.click('#okModal');
  await page.evaluate(()=>{Native.pendingAudio=()=> '[]';PendingAudio.refresh()});
  assert.equal(await mic.count(),0);
  evidence({viewport:320,states:states.map(([state])=>state),journals:['empty','pending','uncertain','unreadable']});
 });
 await test('folder_save_and_list_dates',async({page,evidence})=>{
  const results=[];
  for(const count of [1,10,50]){
   await page.reload();
   const expected=await page.evaluate(n=>{
    state.records=Array.from({length:n},(_,i)=>({
     ...newRecord('folder','Projekt '+i,null),updatedAt:new Date(Date.UTC(2025,2,i+1,23,30)).toISOString()
    }));
    currentFolder=null;showFolder();
    const dates=Object.fromEntries(state.records.map(r=>[r.id,dateText(r.updatedAt)]));
    window.folderProbe={dateCalls:0};
    const format=Date.prototype.toLocaleDateString;
    Date.prototype.toLocaleDateString=function(...args){
     folderProbe.dateCalls++;return format.apply(this,args);
    };
    for(const [name,fn] of Object.entries({save,showFolder}))window[name]=function(...args){
     const start=performance.now();try{return fn.apply(this,args)}finally{folderProbe[name]=performance.now()-start}
    };
    return dates;
   },count);
   await page.click('#createBtn');
   await page.locator('#newMenu .choice').filter({hasText:'Nová složka'}).click();
   await page.fill('#promptValue','Nová zakázka');
   await page.evaluate(()=>{$('okModal').click();$('okModal').click()});
   const proof=await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('zamerovac-data')).records.filter(r=>r.title==='Nová zakázka');
    const dates=Object.fromEntries([...document.querySelectorAll('.entry')].map(e=>[e.dataset.id,e.querySelector('.entry-date').textContent]));
    return {...folderProbe,saved,dates};
   });
   assert.equal(proof.saved.length,1);
   for(const [id,date] of Object.entries(expected))assert.equal(proof.dates[id],date);
   await page.reload();
   assert.deepEqual(await page.evaluate(id=>recById(id),proof.saved[0].id),proof.saved[0]);
   results.push({count,dateCalls:proof.dateCalls,saveMs:proof.save,renderMs:proof.showFolder});
  }
  evidence(results);
  for(const result of results)assert.equal(result.dateCalls,0,'Date formatter should be reused within list render');
 });
 await test('photo_import_save_and_immediate_grip',async({page,evidence})=>{
  const bytes=Buffer.from(await page.evaluate(()=>{
   const c=document.createElement('canvas');c.width=4000;c.height=3000;
   const ctx=c.getContext('2d'),g=ctx.createLinearGradient(0,0,4000,3000);
   g.addColorStop(0,'#935e44');g.addColorStop(1,'#567d83');
   ctx.fillStyle=g;ctx.fillRect(0,0,c.width,c.height);
   return c.toDataURL('image/jpeg',.9).split(',')[1];
  }),'base64');
  const results=[];
  for(const count of [1,10,50]){
   await page.reload();
   await page.evaluate(n=>{
    state.records=Array.from({length:n},(_,i)=>newRecord('folder','Test '+i,null));
    currentFolder=null;showFolder();
    window.probe={renders:[],paints:[],saves:[],start:null,grips:[]};
    const load=loadPhotoImage;
    loadPhotoImage=async id=>{
     const start=performance.now();
     try{return await load(id)}finally{probe.loadMs=performance.now()-start}
    };
    $('drawCanvas').addEventListener('pointerdown',()=>{probe.grips.push(performance.now())},true);
    const render=showFolder;showFolder=function(){
     const t=performance.now();try{return render()}finally{probe.renders.push(performance.now()-t)}
    };
    const saveOriginal=save;save=function(...args){
     const t=performance.now();try{return saveOriginal(...args)}finally{probe.saves.push(performance.now()-t)}
    };
    const paintOriginal=paint;paint=function(){
     const ready=!!stageImg,t=performance.now();
     try{return paintOriginal()}finally{probe.paints.push({ready,ms:performance.now()-t,end:performance.now()})}
    };
    $('filePick').addEventListener('change',()=>{probe.start=performance.now()},true);
   },count);
   await chooseFiles(page,'#galleryBtn',{name:'synthetic.jpg',mimeType:'image/jpeg',buffer:bytes});
   await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
   const open=await page.evaluate(()=>({listRenders:probe.renders.length,listMs:probe.renders.reduce((a,b)=>a+b,0),
    imagePaints:probe.paints.filter(p=>p.ready).length,openMs:probe.paints.find(p=>p.ready).end-probe.start,
    importSaveMs:probe.saves[0],imageLoadMs:probe.loadMs}));
   await page.evaluate(()=>{for(const key of Object.keys(prefs))if(key.startsWith('snap'))prefs[key]=false});
   await tool(page,'dimension');
   const box=await page.locator('#drawCanvas').boundingBox();
   const a={x:box.width*.25,y:box.height*.42},b={x:box.width*.68,y:box.height*.52};
   await drag(page,a,b);
   await editSelected(page);
   await page.fill('#measureInput','1585,800001');
   await page.click('#okModal');
   const initial=await page.evaluate(()=>structuredClone(current.items[0]));
   const end=await projected(page,initial.b);
   await page.mouse.move(box.x+end.x,box.y+end.y);
   const downBefore=await page.evaluate(()=>probe.paints.length);
   await page.mouse.down();
   const downToDrawMs=await page.evaluate(index=>probe.paints[index].end-probe.grips.at(-1),downBefore);
   const before=await page.evaluate(()=>probe.paints.length);
   for(let i=1;i<=4;i++)await page.mouse.move(box.x+end.x+i,box.y+end.y);
   const jitter=await page.evaluate(start=>({paints:probe.paints.length-start,ms:probe.paints.slice(start).reduce((n,p)=>n+p.ms,0)}),before);
   assert.deepEqual(await page.evaluate(()=>current.items[0].b),initial.b);
   await page.mouse.move(box.x+end.x+32,box.y+end.y+16);
   await page.mouse.up();
   const endpoint=await page.evaluate(()=>structuredClone(current.items[0]));
   assert.deepEqual(endpoint.a,initial.a);
   assert.notDeepEqual(endpoint.b,initial.b);
   const center=midpoint(await projected(page,endpoint.a),await projected(page,endpoint.b));
   // Off the caption, within the middle move zone of the dimension.
   const body=midpoint(await projected(page,endpoint.a),center,.86);
   await drag(page,body,{x:body.x+18,y:body.y-23});
   const saved=await page.evaluate(()=>({
    item:structuredClone(current.items[0]),id:current.id,media:current.media[0],
    record:JSON.parse(localStorage.getItem('zamerovac-data')).records.find(r=>r.id===current.id)
   }));
   assert.equal(saved.item.id,initial.id);
   assert.notDeepEqual(saved.item.a,endpoint.a);
   assert.notDeepEqual(saved.item.b,endpoint.b);
   for(const axis of ['x','y'])assert(Math.abs(
    (saved.item.a[axis]-endpoint.a[axis])-(saved.item.b[axis]-endpoint.b[axis]))<1e-8);
   assert.equal(saved.item.measure,'1585,800001');
   assert.deepEqual(saved.record.items[0],saved.item);
   await page.click('#editorBack');
   assert.equal(await page.locator('.entry-title',{hasText:'synthetic.jpg'}).count(),1);
   await page.reload();
   assert.deepEqual(await page.evaluate(id=>recById(id),saved.id),saved.record);
   const original=await page.evaluate(async id=>{
    const url=await assetUrl(id);
    try{return [...new Uint8Array(await (await fetch(url)).arrayBuffer())]}
    finally{URL.revokeObjectURL(url)}
   },saved.media);
   assert.deepEqual(Buffer.from(original),bytes);
   results.push({count,...open,downToDrawMs,jitter});
  }
  evidence({jpegBytes:bytes.length,results});
  for(const result of results){
   assert.equal(result.listRenders,0,'Photo opened through an unnecessary folder rebuild');
   assert.equal(result.imagePaints,1,'Decoded photo must paint once at the final viewport');
   assert.equal(result.jitter.paints,0,'Touch jitter must not repaint unchanged geometry');
  }
 });
}).catch(e=>{console.error(e);process.exitCode=1});
