'use strict';
const {suite,assert}=require('./harness.cjs');
suite('sync-cadence',async run=>{
 await run('frequency-selection-persists-without-changing-records-and-old-switch-can-reenable',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state.records));await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'auto');assert.equal(await page.locator('#syncFrequency option').count(),5);
  for(const mode of ['15','30','60','manual']){await page.selectOption('#syncFrequency',mode);assert.deepEqual(await page.evaluate(()=>({mode:prefs.syncFrequency,enabled:prefs.autoSync})),{mode,enabled:mode!=='manual'});}
  await page.reload();await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'manual');assert.match(await page.locator('#peerSyncPanel').innerText(),/příchozím místním spojením/);await page.click('#peerClose');await page.evaluate(()=>{toggleSettings()});
  assert.equal(await page.locator('[data-setting="autoSync"]').isVisible(),false);
  await page.locator('.settings-category[data-category="sync"]').click();
  assert.equal(await page.locator('#settingsPage-sync').isVisible(),true);
  assert.equal(await page.locator('[data-setting="autoSync"]').isVisible(),true);
  assert.equal(await page.locator('#feedbackFlag').isVisible(),true);
  // Real pointer interaction: temporary header placement must not disable dragging.
  const flag=page.locator('#feedbackFlag'),start=await flag.boundingBox();
  assert(start,'Report flag is missing');
  const viewport=page.viewportSize();
  // Simulate browser cancellation during real Settings presentation, then click
  // the *actual* synchronization checkbox without forcing the pointer action.
  const initialPosition=await page.evaluate(()=>localStorage.getItem('zamerovac-feedback-flag-position-v1'));
  await page.evaluate(({x,y})=>{
   const el=document.getElementById('feedbackFlag'),r=el.getBoundingClientRect(),pointerId=172;
   const fire=(name,px,py)=>el.dispatchEvent(new PointerEvent(name,{bubbles:true,pointerId,pointerType:'touch',isPrimary:true,button:0,clientX:px,clientY:py}));
   fire('pointerdown',r.left+r.width/2,r.top+r.height/2);
   fire('pointermove',x,y);
   fire('pointercancel',x,y);
  },{x:Math.round(viewport.width*.20),y:Math.round(viewport.height*.68)});
  assert.equal(await flag.getAttribute('data-settings-moved'),null,'Canceled first drag must restore header CSS');
  const canceledBox=await flag.boundingBox();
  assert(canceledBox&&Math.abs(canceledBox.x-start.x)<3&&Math.abs(canceledBox.y-start.y)<3,'Canceled drag must return to safe Settings header');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zamerovac-feedback-flag-position-v1')),initialPosition);
  await page.evaluate(()=>{toggleSettings();toggleSettings()});
  await page.locator('.settings-category[data-category="sync"]').click();
  assert.equal(await flag.getAttribute('data-settings-moved'),null,'Reopened Settings must retain safe pin');
  await page.check('[data-setting="autoSync"]');await page.uncheck('[data-setting="autoSync"]');
  await page.mouse.move(start.x+start.width/2,start.y+start.height/2);
  await page.mouse.down();
  await page.mouse.move(Math.round(viewport.width*.20),Math.round(viewport.height*.68),{steps:8});
  await page.mouse.up();
  const moved=await flag.boundingBox();
  assert(moved&&Math.abs(moved.x-start.x)>35,'Report flag did not follow the drag in Settings');
  assert.equal(await flag.getAttribute('data-settings-moved'),'true');
  // Cancel a second drag *after* a completed one: retain the saved location
  // and the intentional settings-moved attribute from the completed gesture.
  const committed=await page.evaluate(()=>localStorage.getItem('zamerovac-feedback-flag-position-v1'));
  await page.evaluate(({x,y})=>{
   const el=document.getElementById('feedbackFlag'),r=el.getBoundingClientRect(),pointerId=173;
   const fire=(name,px,py)=>el.dispatchEvent(new PointerEvent(name,{bubbles:true,pointerId,pointerType:'touch',isPrimary:true,button:0,clientX:px,clientY:py}));
   fire('pointerdown',r.left+r.width/2,r.top+r.height/2);
   fire('pointermove',x,y);fire('pointercancel',x,y);
  },{x:Math.round(viewport.width*.80),y:Math.round(viewport.height*.32)});
  assert.equal(await flag.getAttribute('data-settings-moved'),'true','Canceled second drag retains completed drag marker');
  assert.equal(await page.evaluate(()=>localStorage.getItem('zamerovac-feedback-flag-position-v1')),committed,'Canceled second drag cannot rewrite saved position');
  const afterSecondCancel=await flag.boundingBox();
  assert(afterSecondCancel&&Math.abs(afterSecondCancel.x-moved.x)<3&&Math.abs(afterSecondCancel.y-moved.y)<3,'Second canceled drag restores committed location');
  assert.equal(await page.evaluate(()=>{
   const flag=document.getElementById('feedbackFlag'),control=document.querySelector('[data-setting="autoSync"]');
   const f=flag.getBoundingClientRect(),c=control.getBoundingClientRect();
   return !(f.left<c.right&&c.left<f.right&&f.top<c.bottom&&c.top<f.bottom);
  }),true,'Fialová vlaječka nesmí překrývat přepínač synchronizace');
  // Real pointer movement back to the opposite edge must remain available.
  const fromLeft=await flag.boundingBox();
  assert(fromLeft,'Flag missing after left drag');
  await page.mouse.move(fromLeft.x+fromLeft.width/2,fromLeft.y+fromLeft.height/2);
  await page.mouse.down();
  await page.mouse.move(Math.round(viewport.width*.80),Math.round(viewport.height*.80),{steps:8});
  await page.mouse.up();
  const fromRight=await flag.boundingBox();
  assert(fromRight&&fromRight.x>fromLeft.x+35,'Report flag did not follow reverse drag to the right');
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-feedback-flag-position-v1')).edge),'right');
  assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),before,'Dragging flag cannot change saved project data');
  await page.check('[data-setting="autoSync"]');assert.equal(await page.evaluate(()=>prefs.syncFrequency),'auto');await page.uncheck('[data-setting="autoSync"]');await page.evaluate(()=>openZamerovacPeers());assert.equal(await page.locator('#syncFrequency').inputValue(),'manual');await page.selectOption('#syncFrequency','30');assert.equal(await page.locator('[data-setting="autoSync"]').isChecked(),true);assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),before);

 });
 await run('failed-persistence-does-not-activate-new-frequency',async({page})=>{
  await page.evaluate(()=>{prefs.syncFrequency='15';prefs.autoSync=true;save();window.cadenceCalls=0;applyNativePrefs=()=>{cadenceCalls++;return true};window.cadenceSave=save;save=()=>false;openZamerovacPeers()});await page.selectOption('#syncFrequency','manual');assert.equal(await page.locator('#syncFrequency').inputValue(),'15');assert.equal(await page.evaluate(()=>prefs.autoSync),true);assert.equal(await page.evaluate(()=>cadenceCalls),0);
  await page.evaluate(()=>{save=cadenceSave;applyNativePrefs=()=>false});await page.selectOption('#syncFrequency','60');assert.equal(await page.locator('#syncFrequency').inputValue(),'15');assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('zamerovac-data')).prefs.syncFrequency),'15');
 });
});
