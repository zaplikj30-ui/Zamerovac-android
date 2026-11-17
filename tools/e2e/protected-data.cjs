'use strict';
const {suite,assert}=require('./harness.cjs');
const nativeStorage=require('./native-storage-fixture.cjs');
(async()=>suite('protected-data',async test=>{
 await test('trash_retention_status_and_registry_failure',async({page,step,evidence})=>{
  await nativeStorage(page);
  await page.evaluate(()=>{
   Native.trashCleanupCount=()=>0;
   Native.protectedDataStatus=()=>JSON.stringify({revisions:3,media:2,mediaBytes:1048576,message:'Chráněné původní přílohy zůstávají uložené i po vysypání koše. Ochranu nelze zrušit potvrzením synchronizace.'});
  });
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const viewport of [{width:320,height:568},{width:1000,height:760}]){
   await step('Read-only retention status at '+viewport.width+'px',async()=>{
    await page.setViewportSize(viewport);await page.evaluate(()=>showTrash());
    assert.match(await page.locator('#modalBody').innerText(),/Chráněné revize: 3.*původní přílohy: 2.*1.0 MiB/s);
    assert.match(await page.locator('#modalBody').innerText(),/nelze zrušit potvrzením synchronizace/);
    assert.equal(await page.locator('#emptyTrash').isDisabled(),true);
    const box=await page.locator('#modal .dialog').boundingBox();assert(box&&box.x>=-1&&box.x+box.width<=viewport.width+1);
    assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
    await page.click('#okModal');
   });
  }
  await step('Corrupt registry is visible and cannot offer release',async()=>{
   await page.evaluate(()=>{Native.protectedDataStatus=()=>JSON.stringify({error:'Ochranu původních dat nelze potvrdit. Operace byla zastavena.'});showTrash()});
   assert.match(await page.locator('#modalBody [role="alert"]').innerText(),/Operace byla zastavena/);
   assert.equal(await page.locator('#modalBody button').count(),1);
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  });
  evidence({syntheticNativeBridge:true,viewports:[320,1000],readOnly:true,releaseControl:false});
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
