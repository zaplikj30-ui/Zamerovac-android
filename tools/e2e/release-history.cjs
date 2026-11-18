'use strict';
const {suite,assert,createCanvas}=require('./harness.cjs');
const path=require('node:path');
// In the hosted QA fallback the reviewed test runner is separate from the
// checked-out product. Resolve release metadata from the product worktree.
const productRoot=process.cwd();
const catalog=require(path.join(productRoot,'app/src/main/assets/release-history.js'));
const {read:configuredVersion}=require(path.join(productRoot,'tools/release/versioning.js'));
// Only the historical suffix is fixed; every future release adds a new leading entry.
const historicalVersions=['1.4.0','1.3.0','1.2.153','1.2.152','1.2.151','1.2.150',
 '1.2.149','1.2.148','1.2.147','1.2','1.1'];
const expectedVersions=catalog.releases.map(release=>release.version);
assert.deepEqual(expectedVersions.slice(-historicalVersions.length),historicalVersions,
 'Published historical versions must remain unchanged and in order');
assert.equal(expectedVersions[0],configuredVersion(),'Newest notes must match app version');
function historicalIndex(version){
 const index=expectedVersions.indexOf(version);
 assert(index>=0,'Missing historical release '+version);
 return index;
}
(async()=>suite('release-history',async test=>{
 await test('versioned_history_main_menu_offline_and_help_navigation',async({page,step,evidence})=>{
  await createCanvas(page,'Historie změn – zkušební náčrt');
  await page.click('#editorBack');
  const before=await page.evaluate(()=>JSON.stringify(state));
  await step('History in hamburger shows actual versions and categorized fixes',async()=>{
   await page.click('#back');
   await page.locator('#navMenu button').filter({hasText:'Historie změn'}).click();
   assert.equal(await page.locator('#modalTitle').innerText(),'Novinky a historie změn');
   const timeline=page.locator('details.releaseTimeline');
   assert.equal(await timeline.count(),expectedVersions.length);
   for(let i=0;i<expectedVersions.length;i++){
    const entry=timeline.nth(i);
    assert.equal(await entry.locator('summary b').innerText(),'Verze '+expectedVersions[i],
     'Wrong release at index '+i+': '+expectedVersions[i]);
    assert.equal(await entry.evaluate(el=>el.open),i===0,
     'Unexpected default open state at release index '+i);
   }
   const previous=timeline.nth(historicalIndex('1.4.0'));
   assert(await previous.getByText('Verze 1.4.0').isVisible());
   if(!(await previous.evaluate(el=>el.open)))await previous.locator('summary').click();
   assert((await previous.innerText()).includes('Samostatná místní ochrana'));
   const release13=timeline.nth(historicalIndex('1.3.0'));
   assert(await release13.getByText('Verze 1.3.0').isVisible());
   await release13.locator('summary').click();
   assert.equal(await release13.evaluate(el=>el.open),true,'Version 1.3.0 did not expand');
   assert((await release13.innerText()).includes('smysluplná čísla vydání'));
   assert((await timeline.nth(historicalIndex('1.2.153')).innerText()).includes('Verze 1.2.153'));
   const release152=timeline.nth(historicalIndex('1.2.152'));
   assert((await release152.innerText()).includes('Verze 1.2.152'));
   await release152.locator('summary').click();
   assert.equal(await release152.evaluate(el=>el.open),true,'Version 1.2.152 did not expand');
   assert((await release152.innerText()).includes('chybné přiřazování'));
   assert.equal(await release152.locator('h3').first().innerText(),'Opraveno');
   const release150=timeline.nth(historicalIndex('1.2.150'));
   await release150.locator('summary').click();
   assert.equal(await release150.evaluate(el=>el.open),true);
   assert((await release150.innerText()).includes('Bluetooth Bosch'));
   assert((await release150.innerText()).includes('Zákaznické PDF'));
  });
  await step('Offline versioned fixes are readable without modifying records',async()=>{
   await page.context().setOffline(true);
   assert((await page.locator('details.releaseTimeline').nth(historicalIndex('1.2.150')).innerText()).includes('Načítání fotografií'));
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   await page.context().setOffline(false);
  });
  await step('Navigate from 1.2.151 to real offline help',async()=>{
   const helpVersion=page.locator('details.releaseTimeline').nth(historicalIndex('1.2.151'));
   await helpVersion.locator('summary').click();
   assert.equal(await helpVersion.evaluate(el=>el.open),true,'Version 1.2.151 did not expand');
   await helpVersion.locator('[data-feature="0"]').first().click();
   assert.equal(await page.locator('#modal').isVisible(),false);
   assert(await page.locator('#helpPanel').isVisible());
   assert.equal(await page.evaluate(()=>window.handleAndroidBack()),'handled');
   assert.equal(await page.locator('#helpPanel').isVisible(),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  });
  evidence({testedVersions:[expectedVersions[0],'1.4.0','1.3.0','1.2.153','1.2.152','1.2.151','1.2.150'],menu:true,offline:true,dataUnchanged:true});
 });
 await test('settings_history_and_responsive_layout',async({page,step,evidence})=>{
  const before=await page.evaluate(()=>JSON.stringify(state));
  for(const viewport of [{width:320,height:568},{width:1000,height:760}]){
   await step('History fits '+viewport.width+'px display',async()=>{
    await page.setViewportSize(viewport);
    await page.click('#back');
    await page.locator('#navMenu button').filter({hasText:'Nastavení'}).click();
    await page.locator('#openHistory').click();
    assert(await page.locator('#modal').isVisible());
    const dialog=await page.locator('#modal .dialog').boundingBox();
    assert(dialog&&dialog.x>=-1&&dialog.x+dialog.width<=viewport.width+1,
     'Release dialog must not overflow viewport');
    assert.equal(await page.locator('details.releaseTimeline').count(),expectedVersions.length);
    assert.equal(await page.locator('details.releaseTimeline').first().locator('summary b').innerText(),'Verze '+expectedVersions[0]);
    assert.equal(await page.locator('details.releaseTimeline').last().locator('summary b').innerText(),'Verze 1.1');

    await page.click('#okModal');
    assert.equal(await page.locator('#modal').isVisible(),false);
    await page.click('#closeSettings');
   });
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  evidence({viewports:['320x568','1000x760'],dataUnchanged:true});
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
