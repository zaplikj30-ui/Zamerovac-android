'use strict';
const {suite,assert,createCanvas}=require('./harness.cjs');
(async()=>suite('help',async test=>{
 await test('main_menu_search_offline_and_android_back',async({page,step,evidence})=>{
  await createCanvas(page,'Kontrola nápovědy – syntetická');
  await page.click('#editorBack');
  const before=await page.evaluate(()=>JSON.stringify(state));
  await step('Open directly from main hamburger menu',async()=>{
   await page.click('#back');
   await page.locator('#navMenu button').filter({hasText:'Nápověda'}).click();
   assert(await page.locator('#helpPanel').isVisible());
   assert.equal(await page.locator('#helpPanel').getAttribute('role'),'dialog');
   assert.equal(await page.locator('#helpPanel').getAttribute('aria-modal'),'true');
   assert.equal(await page.locator('#helpPanel details[data-help-topic]').count(),25);
  });
  await step('Search Czech text including diacritic-free query',async()=>{
   const search=page.locator('#helpSearch');
   const magnifier=page.locator('#helpSearchToggle');
   assert.equal(await magnifier.getAttribute('aria-label'),'Hledat v nápovědě');
   await search.fill('něco');
   await magnifier.click();
   assert.equal(await search.evaluate(el=>document.activeElement===el),true,'Magnifier must focus search field');
   await search.fill('mrizka');
   assert(await page.locator('#helpPanel details[data-help-topic="zoom"]').isVisible());
   assert.equal(await page.locator('#helpPanel details[data-help-topic="backup"]').isVisible(),false);
   await search.fill('Bosch');
   assert(await page.locator('#helpPanel details[data-help-topic="bosch"]').isVisible());
   await search.fill('zzzzzzneexistuje');
   assert.equal(await page.locator('#helpPanel details[data-help-topic]:visible').count(),0);
   assert.match(await page.locator('.z-help-count').innerText(),/Nic jsme nenašli/);
   await search.fill('');
   assert.equal(await page.locator('#helpPanel details[data-help-topic]:visible').count(),25);
  });
  await step('Guide stays functional offline and Android Back closes it',async()=>{
   await page.context().setOffline(true);
   await page.locator('#helpSearch').fill('zaloha');
   assert(await page.locator('#helpPanel details[data-help-topic="backup"]').isVisible());
   assert.equal(await page.evaluate(()=>window.handleAndroidBack()),'handled');
   assert.equal(await page.locator('#helpPanel').isVisible(),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before,'Help may not change projects or settings');
   await page.context().setOffline(false);
  });
  evidence({topics:25,offline:true,search:true,androidBack:true,dataUnchanged:true});
 });
 await test('overflow_menu_and_small_large_screens',async({page,step,evidence})=>{
  await createCanvas(page,'Bosch – zkušební soubor');
  await page.click('#editorBack');
  const before=await page.evaluate(()=>JSON.stringify(state));
  await step('Global search finds records, not help articles',async()=>{
   await page.click('#searchBtn');
   assert.equal(await page.locator('#modalTitle').innerText(),'Hledat zakázku');
   await page.fill('#promptValue','Bosch');
   await page.click('#okModal');
   assert(await page.locator('.entry-title',{hasText:'Bosch – zkušební soubor'}).isVisible(),
    'Global search should find a matching actual record');
   assert.equal(await page.locator('#helpPanel').count(),0,
    'Global search must not open or search the help');
  });
  for(const viewport of [{width:320,height:568},{width:1000,height:750}]){
   await step('Help on '+viewport.width+'px display',async()=>{
    await page.setViewportSize(viewport);
    await page.click('#settingsBtn');
    await page.locator('#overflowMenu button').filter({hasText:'Nápověda'}).click();
    assert(await page.locator('#helpPanel').isVisible());
    const rect=await page.locator('#helpSearch').boundingBox();
    assert(rect&&rect.x>=-1&&rect.x+rect.width<=viewport.width+1,'Search fits viewport');
    await page.locator('#helpSearch').fill('kota');
    assert(await page.locator('#helpPanel details[data-help-topic="dimension"]').isVisible());
    await page.locator('#helpBack').click();
    assert.equal(await page.locator('#helpPanel').isVisible(),false);
   });
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  evidence({viewports:['320x568','1000x750'],dataUnchanged:true});
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
