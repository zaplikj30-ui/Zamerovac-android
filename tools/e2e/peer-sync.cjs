'use strict';
const {suite,assert}=require('./harness.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
const request={sessionId:A,peerId:B,name:'Syntetický tablet',code:'0123456789abcdef'.repeat(4)};
async function mock(page){await page.evaluate(()=>{window.peerCalls=[];window.Native={directSyncControl:(name,arg)=>peerCalls.push({name,arg}),directSyncState:()=>JSON.stringify({enabled:false,active:false,peers:{},candidates:[]})};});}
suite('peer-sync',async run=>{
 await run('menu-settings-offline-and-data-preserved',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state));await page.click('#back');await page.getByText('⇄  Synchronizace zařízení',{exact:true}).click();await page.locator('#peerSyncPanel').waitFor({state:'visible'});assert.match(await page.locator('#peerProblem').innerText(),/Android/);await page.click('#peerPair');assert.match(await page.locator('#peerProblem').innerText(),/Android/);await page.keyboard.press('Escape');assert.equal(await page.locator('#peerSyncPanel').isVisible(),false);
  await page.evaluate(()=>{toggleSettings()});await page.click('#peerSettings');await page.locator('#peerClose').click();assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await run('explicit-approval-full-code-reject-back-and-stale-session',async({page})=>{
  await mock(page);const before=await page.evaluate(()=>JSON.stringify(state));await page.evaluate(()=>openZamerovacPeers());await page.click('#peerPair');assert.equal((await page.evaluate(()=>peerCalls)).at(-1).name,'pair');
  await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),request);assert.equal((await page.locator('#peerPairCode').innerText()).replaceAll(' ',''),request.code);assert.equal(await page.evaluate(()=>document.activeElement.id),'peerReject');await page.keyboard.press('Escape');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'reject',arg:A});assert.equal(await page.locator('#peerSyncPanel').isVisible(),true);
  await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),request);await page.click('#peerApprove');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'approve',arg:A});assert.equal(await page.locator('#peerApprove').isDisabled(),true);assert.match(await page.locator('#peerApproval').innerText(),/Čekám na potvrzení/);
  const next={...request,sessionId:B,name:'Druhé zařízení'};await page.evaluate(r=>onNativePeerPairing(JSON.stringify(r)),next);await page.click('#peerReject');assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'reject',arg:B});assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
 await run('untrusted-names-pending-errors-and-cloud-isolation',async({page})=>{
  await mock(page);await page.evaluate(()=>openZamerovacPeers());const before=await page.evaluate(()=>JSON.stringify(state));const hostile='<img src=x onerror="window.peerInjected=true">';
  await page.evaluate(({id,hostile})=>onNativePeerState(JSON.stringify({enabled:true,active:true,pairing:true,pairingSeconds:60,wifiDirectSupported:false,problem:'Spojení přerušeno; čeká na další pokus',peers:{[id]:{name:hostile,pending:12,state:{phase:'error',error:'Nesprávný kontrolní součet'}}},candidates:[{key:'lan:synthetic',name:hostile,route:'lan'}]})),{id:B,hostile});
  assert.equal(await page.locator('#peerSyncPanel img').count(),0);assert.equal(await page.evaluate(()=>!!window.peerInjected),false);assert.match(await page.locator('#peerSyncPanel').innerText(),/Čekajících potvrzení: 12/);assert.match(await page.locator('#peerSyncPanel').innerText(),/Přenos se nepodařil/);assert.match(await page.locator('#peerSyncPanel').innerText(),/službou Androidu s oznámením/);assert.match(await page.locator('#peerSyncPanel').innerText(),/omezit nebo ukončit/);await page.locator('#peerCandidates button').click();assert.deepEqual((await page.evaluate(()=>peerCalls)).at(-1),{name:'connect',arg:'lan:synthetic'});
  await page.evaluate(()=>onNativeSync(JSON.stringify({transport:'cloud-v2',pending:true,message:'Synchronizace čeká na potvrzení'})));assert.equal(await page.locator('#cloudBtn').getAttribute('data-status'),'waiting');
  const cloud=await page.locator('#cloudBtn').getAttribute('data-status');await page.evaluate(()=>onNativeSync(JSON.stringify({transport:'direct',message:'Přímá synchronizace přijata'})));assert.equal(await page.locator('#cloudBtn').getAttribute('data-status'),cloud);assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
});
