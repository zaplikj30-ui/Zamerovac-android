'use strict';
const {suite,assert}=require('./harness.cjs');
suite('sync-cadence',async run=>{
 await run('frequency-selection-persists-without-changing-records-and-old-switch-can-reenable',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state.records));await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'auto');assert.equal(await page.locator('#syncFrequency option').count(),5);
  for(const mode of ['15','30','60','manual']){await page.selectOption('#syncFrequency',mode);assert.deepEqual(await page.evaluate(()=>({mode:prefs.syncFrequency,enabled:prefs.autoSync})),{mode,enabled:mode!=='manual'});}
  await page.reload();await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'manual');assert.match(await page.locator('#peerSyncPanel').innerText(),/příchozím místním spojením/);await page.click('#peerClose');await page.evaluate(()=>{renderSettings();document.getElementById('settingsPanel').hidden=false});await page.check('[data-setting="autoSync"]');assert.equal(await page.evaluate(()=>prefs.syncFrequency),'auto');await page.uncheck('[data-setting="autoSync"]');await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'manual');await page.selectOption('#syncFrequency','30');assert.equal(await page.locator('[data-setting="autoSync"]').isChecked(),true);assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),before);
 });
 await run('failed-persistence-does-not-activate-new-frequency',async({page})=>{
  await page.evaluate(()=>{prefs.syncFrequency='15';prefs.autoSync=true;save();window.cadenceCalls=0;applyNativePrefs=()=>{cadenceCalls++;return true};window.cadenceSave=save;save=()=>false;openZamerovacPeers()});await page.selectOption('#syncFrequency','manual');assert.equal(await page.locator('#syncFrequency').inputValue(),'15');assert.equal(await page.evaluate(()=>prefs.autoSync),true);assert.equal(await page.evaluate(()=>cadenceCalls),0);
  await page.evaluate(()=>{save=cadenceSave;applyNativePrefs=()=>false});await page.selectOption('#syncFrequency','60');assert.equal(await page.locator('#syncFrequency').inputValue(),'15');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-data')).prefs.syncFrequency),'15');
 });
});
