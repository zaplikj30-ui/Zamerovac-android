'use strict';
const {suite,assert}=require('./harness.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const request={sessionId:A,peerId:B,name:'Syntetický tablet',code:'0123456789abcdef'.repeat(4)};
async function mock(page){await page.evaluate(()=>{window.peerCalls=[];window.Native={directSyncControl:(name,arg)=>peerCalls.push({name,arg}),directSyncState:()=>JSON.stringify({enabled:false,active:false,peers:{},candidates:[]})};});}
suite('peer-sync',async run=>{
 await run('offline-folder-cycle-repair-is-visible-reachable-and-exact',async({page})=>{
  await page.evaluate(()=>{
   const make=(id,parentId)=>({id,kind:'folder',title:id,parentId,items:[{measure:'1585,800001000000000123',unit:'mm'}]});
   const base={schema:1,records:[make('folder-a',null),make('folder-b',null)]};
   const local=JSON.parse(JSON.stringify(base)),remote=JSON.parse(JSON.stringify(base));local.records[0].parentId='folder-b';remote.records[1].parentId='folder-a';
   applySavedState(reconcileSavedState(base,local,remote));showFolder(null);save();
  });
  assert.match(await page.locator('.entry[data-id="folder-a"]').innerText(),/OPRAVENÝ CYKLUS SLOŽEK/);
  await page.locator('.entry[data-id="folder-a"] .entry-title').click();
  assert.equal(await page.locator('.entry[data-id="folder-b"]').count(),1);
  assert.deepEqual(await page.evaluate(()=>state.records.map(r=>r.items[0].measure)),['1585,800001000000000123','1585,800001000000000123']);
  await page.reload();await page.waitForFunction(()=>typeof showFolder==='function');await page.evaluate(()=>showFolder(null));
  assert.match(await page.locator('.entry[data-id="folder-a"]').innerText(),/OPRAVENÝ CYKLUS SLOŽEK/);
 });
 await run('menu-settings-offline-and-data-preserved',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state));await page.click('#back');await page.getByText('⇄  Synchronizace zařízení',{exact:true}).click();await page.locator('#peerSyncPanel').waitFor({state:'visible'});assert.match(await page.locator('#peerProblem').innerText(),/Android/);await page.click('#peerPair');assert.match(await page.locator('#peerProblem').innerText(),/Android/);await page.keyboard.press('Escape');assert.equal(await page.locator('#peerSyncPanel').isVisible(),false);
  await page.evaluate(()=>{toggleSettings()});
  // The settings home shows categories; the peer button is hidden until Sync is opened.
  assert.equal(await page.locator('#peerSettings').isVisible(),false);
  await page.locator('.settings-category[data-category="sync"]').click();
  assert.equal(await page.locator('#settingsPage-sync').isVisible(),true);
  assert.equal(await page.locator('#peerSettings').isVisible(),true);
  await page.locator('#peerSettings').click();
  await page.locator('#peerSyncPanel').waitFor({state:'visible'});
  await page.locator('#peerClose').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await run('explicit-approval-full-code-reject-back-and-stale-session',async({page})=>{
  await mock(page);const before=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>openZamerovacPeers());await page.click('#peerPair');assert.equal((await page.evaluate(()=>peerCalls)).at(-1).name,'pair');
  await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),request);assert.equal((await page.locator('#peerPairCode').innerText()).replaceAll(' ',''),request.code);assert.equal(await page.evaluate(()=>document.activeElement.id),'peerReject');await page.keyboard.press('Escape');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'reject',arg:A});assert.equal(await page.locator('#peerSyncPanel').isVisible(),true);
  await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),request);await page.click('#peerApprove');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'approve',arg:A});assert.equal(await page.locator('#peerApprove').isDisabled(),true);assert.match(await page.locator('#peerApproval').innerText(),/Čekám na potvrzení/);
  const next={...request,sessionId:B,name:'Druhé zařízení'};await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),next);await page.click('#peerReject');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'reject',arg:B});assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await run('untrusted-names-pending-errors-and-cloud-isolation',async({page})=>{
  await mock(page);await page.evaluate(()=>openZamerovacPeers());const before=await page.evaluate(()=>JSON.stringify(state));const hostile='<img src=x onerror="window.peerInjected=true">';
  await page.evaluate(({id,hostile})=>onNativePeerState(JSON.stringify({enabled:true,active:true,pairing:true,pairingSeconds:60,wifiDirectSupported:false,problem:'Spojení přerušeno; čeká na další pokus',peers:{[id]:{name:hostile,pending:12,state:{route:'nearby',phase:'error',error:'Nesprávný kontrolní součet'}}},candidates:[{key:'lan:synthetic',name:hostile,route:'lan'}]})),{id:B,hostile});
  assert.equal(await page.locator('#peerSyncPanel img').count(),0);assert.equal(await page.evaluate(()=>!!window.peerInjected),false);assert.match(await page.locator('#peerSyncPanel').innerText(),/Čekajících potvrzení: 12/);assert.match(await page.locator('#peerSyncPanel').innerText(),/Přenos přes Wi-Fi Direct/);assert.match(await page.locator('#peerSyncPanel').innerText(),/Přenos se nepodařil/);assert.match(await page.locator('#peerSyncPanel').innerText(),/službou Androidu s oznámením/);assert.match(await page.locator('#peerSyncPanel').innerText(),/omezit nebo ukončit/);await page.locator('#peerCandidates button').click();assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'connect',arg:'lan:synthetic'});
  await page.evaluate(()=>onNativeSync(JSON.stringify({transport:'cloud-v2',pending:true,message:'Synchronizace čeká na potvrzení'})));assert.equal(await page.locator('#cloudBtn').getAttribute('data-status'),'waiting');
  const cloud=await page.locator('#cloudBtn').getAttribute('data-status');await page.evaluate(()=>onNativeSync(JSON.stringify({transport:'direct',message:'Přímá synchronizace přijata'})));assert.equal(await page.locator('#cloudBtn').getAttribute('data-status'),cloud);assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
});
