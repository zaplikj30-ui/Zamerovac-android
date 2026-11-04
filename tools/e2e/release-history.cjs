'use strict';
const {suite,assert,createCanvas}=require('./harness.cjs');
(async()=>suite('release-history',async test=>{
 await test('versioned_history_main_menu_offline_and_help_navigation',async({page,step,evidence})=>{
  await createCanvas(page,'Historie změn – zkušební náčrt');
  await page.click('#editorBack');
  const before=await page.evaluate(()=>JSON.stringify(state));
  await step('History in hamburger shows actual versions and categorized fixes',async()=>{
   await page.click('#back');
   await page.locator('#navMenu button').filter({hasText:'Historie změn'}).click();
   assert.equal(await page.locator('#modalTitle').innerText(),'Novinky a historie změn');
   assert.equal(await page.locator('details.releaseTimeline').count(),8);
   assert(await page.locator('details.releaseTimeline').first().getByText('Verze 1.2.152').isVisible());
   assert(await page.locator('details.releaseTimeline').first().innerText().then(t=>t.includes('chybné přiřazování')));
   assert.equal(await page.locator('details.releaseTimeline').first().locator('h3').first().innerText(),'Opraveno');
   await page.locator('details.releaseTimeline').nth(2).locator('summary').click();
   assert((await page.locator('details.releaseTimeline').nth(2).innerText()).includes('Bluetooth Bosch'));
   assert((await page.locator('details.releaseTimeline').nth(2).innerText()).includes('Zákaznické PDF'));
  });
  await step('Offline versioned fixes are readable without modifying records',async()=>{
   await page.context().setOffline(true);
   assert((await page.locator('details.releaseTimeline').nth(2).innerText()).includes('Načítání fotografií'));
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   await page.context().setOffline(false);
  });
  await step('Navigate from 1.2.151 to real offline help',async()=>{
   const helpVersion=page.locator('details.releaseTimeline').nth(1);
   await helpVersion.locator('summary').click();
   await helpVersion.locator('[data-feature="0"]').first().click();
   assert.equal(await page.locator('#modal').isVisible(),false);
   assert(await page.locator('#helpPanel').isVisible());
   assert.equal(await page.evaluate(()=>window.handleAndroidBack()),'handled');
   assert.equal(await page.locator('#helpPanel').isVisible(),false);
   assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  });
  evidence({testedVersions:['1.2.152','1.2.151','1.2.150'],menu:true,offline:true,dataUnchanged:true});
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
    assert.equal(await page.locator('details.releaseTimeline').count(),8);
    await page.click('#okModal');
    assert.equal(await page.locator('#modal').isVisible(),false);
    await page.click('#closeSettings');
   });
  }
  assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
  evidence({viewports:['320x568','1000x760'],dataUnchanged:true});
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
