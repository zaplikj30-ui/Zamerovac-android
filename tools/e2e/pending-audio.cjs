'use strict';
// Real Chromium/UI/persistence; Native microphone/journal are explicitly a model here.
// Real filesystem + AtomicFile + bridge coverage is PendingAudioTest/StorageLifecycleTest.
const {suite,assert,createCanvas,tool,drag,editSelected,redo}=require('./harness.cjs');
async function install(page){
 await page.addInitScript(()=>{
  const disk=()=>localStorage.getItem('audio-ui-disk')||'';
  const entries=()=>JSON.parse(localStorage.getItem('audio-ui-journal')||'[]');
  const put=items=>localStorage.setItem('audio-ui-journal',JSON.stringify(items));
  let recording=null;window.rejectWrite=false;window.rejectBind=false;window.rejectStop=false;window.confirmCalls=[];window.exports=[];
  localStorage.setItem('zamerovac-last-seen-app-version','1.2.152-test');
  const referenced=(data,id)=>data.records.some(r=>!r.deleted&&((r.kind==='note'&&r.media?.includes(id))||r.items?.some(n=>n.media?.includes(id)&&n.audioMedia?.includes(id))));
  window.Native={
   getAppVersion:()=> '1.2.152-test',getSyncDeviceId:()=> '11111111-1111-4111-8111-111111111111',configure:()=>true,
   loadData:disk,saveDataChecked:(text,expected)=>{
    if(rejectWrite)return JSON.stringify({ok:false,error:'synthetic ENOSPC'});
    if(expected!==disk())return JSON.stringify({ok:false,current:disk()});localStorage.setItem('audio-ui-disk',text);
    if(!rejectBind)put(entries().map(e=>({...e,bound:referenced(JSON.parse(text),e.id)})));
    return JSON.stringify({ok:true,audioPending:entries().some(e=>!e.bound),pendingAudioCount:entries().filter(e=>!e.bound).length});
   },
   startAudio:id=>{recording=id;return true},stopAudio:()=>{if(!recording)return false;put([...entries(),{id:recording,token:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',state:'pending',available:true}]);recording=null;return !rejectStop},cancelAudio:()=>{recording=null},
   pendingAudio:()=>JSON.stringify(entries().filter(e=>!e.bound)),
   confirmPendingAudio:(expected,r,n,id)=>{confirmCalls.push({expected,r,n,id});return !rejectBind&&expected===disk()&&referenced(JSON.parse(disk()),id)},
   openMedia:()=>{},exportPendingAudio:token=>exports.push(token)
  };
 });
 await page.route('https://appassets.androidplatform.net/media/**',route=>route.fulfill({status:200,contentType:'audio/mp4',body:Buffer.from([0,1,2,3])}));
 await page.reload();
}
async function prepare(page){await createCanvas(page,'Audio 1250,123456789 in');await tool(page,'note');await drag(page,{x:140,y:240},{x:230,y:290});await editSelected(page);await page.fill('#richText','Původní poznámka');await page.click('#okModal');await page.evaluate(()=>{current.items[0].measure='1250,123456789';current.items[0].unit='in';save()});await editSelected(page);}
async function stop(page){await page.click('#richVoice');await page.click('#richVoice');}
suite('pending-audio',async run=>{
 await run('ordinary-save-uses-native-summary-without-requesting-another-full-media-scan',async({page})=>{
  await install(page);await prepare(page);
  const calls=await page.evaluate(()=>{let calls=0;const previous=Native.pendingAudio;Native.pendingAudio=()=>{calls++;return previous()};save();return calls});
  assert.equal(calls,0,'UI must not request another full recovery after Native already checked the save');
 });

 await run('stop-is-only-a-draft-before-cancel-and-failed-save',async({page})=>{
  await install(page);await prepare(page);const before=await page.evaluate(()=>localStorage.getItem('audio-ui-disk'));await stop(page);
  assert.match(await page.locator('#toast').innerText(),/Uložit/);assert.doesNotMatch(await page.locator('#toast').innerText(),/Hlas připojen k poznámce/);
  await page.evaluate(()=>rejectWrite=true);await page.click('#okModal');assert.equal(await page.evaluate(()=>localStorage.getItem('audio-ui-disk')),before);await page.click('#cancelModal');
 });
 await run('unknown-journal-warning-preserves-two-independent-copy-actions',async({page})=>{
  await install(page);await page.evaluate(()=>{localStorage.setItem('audio-ui-journal',JSON.stringify([
   {id:'voice-one',token:'one-token',state:'pending',available:true,attachable:false},
   {id:'voice-two',token:'two-token',state:'pending',available:true,attachable:false},
   {issue:'journal-uncertain',state:'needs-review',available:false}
  ]));PendingAudio.refresh()});
  await page.click('#pendingAudioBanner');assert.match(await page.locator('#retainedAudioList').innerText(),/Evidence.*kontrolu/);
  const buttons=page.locator('#retainedAudioList').getByText('Uložit kopii originálu',{exact:true});assert.equal(await buttons.count(),2);
  await buttons.nth(0).click();await buttons.nth(1).click();assert.deepEqual(await page.evaluate(()=>exports),['one-token','two-token']);
  await page.click('#okModal');await prepare(page);assert.equal(await page.locator('#richRetainedAudio').getByText('Připojit k této poznámce',{exact:true}).count(),0);
  const saved=await page.evaluate(()=>localStorage.getItem('audio-ui-disk'));await page.fill('#richText','Neuložená změna');await page.evaluate(()=>rejectWrite=true);await page.click('#okModal');await page.click('#cancelModal');
  assert.equal(await page.evaluate(()=>localStorage.getItem('audio-ui-disk')),saved);await page.reload();await page.click('#pendingAudioBanner');assert.equal(await page.locator('#retainedAudioList').getByText('Uložit kopii originálu',{exact:true}).count(),2);

 });

 await run('stop-cancel-restart-reattach-save-preserves-exact-values',async({page,evidence})=>{
  await install(page);await prepare(page);await stop(page);assert.equal(await page.evaluate(()=>current.items[0].audioMedia?.length||0),0);await page.click('#cancelModal');
  const saved=await page.evaluate(()=>localStorage.getItem('audio-ui-disk'));await page.reload();assert.equal(await page.locator('#pendingAudioBanner').isVisible(),true);
  await page.click('#pendingAudioBanner');assert.equal(await page.locator('#retainedAudioList').getByText('Přehrát',{exact:true}).count(),1);await page.click('#okModal');
  await page.locator('.entry-title',{hasText:'Audio 1250,123456789 in'}).click();await page.evaluate(()=>{selected=current.items[0].id});await editSelected(page);
  await page.locator('#richRetainedAudio').getByText('Připojit k této poznámce',{exact:true}).click();assert.equal(await page.evaluate(()=>current.items[0].audioMedia?.length||0),0);
  await page.click('#okModal');const item=await page.evaluate(()=>JSON.parse(localStorage.getItem('audio-ui-disk')).records.find(r=>r.kind==='canvas').items[0]);
  assert.equal(item.audioMedia.length,1);assert.equal(item.measure,'1250,123456789');assert.equal(item.unit,'in');assert.equal(item.text,'Původní poznámka');assert.notEqual(await page.evaluate(()=>localStorage.getItem('audio-ui-disk')),saved);
  await page.click('#undo');assert.equal(await page.evaluate(()=>PendingAudio.list().length),1);assert.equal(await page.evaluate(()=>current.items[0].measure),'1250,123456789');await redo(page);assert.equal(await page.evaluate(()=>PendingAudio.list().length),0);
  await page.reload();assert.equal(await page.locator('#pendingAudioBanner').count(),0);evidence({nativeModel:true,originalBytes:'Covered by Robolectric, not this browser test',measure:item.measure,unit:item.unit});
 });
 await run('failed-save-cancel-keeps-pending-across-reload',async({page})=>{
  await install(page);await prepare(page);const saved=await page.evaluate(()=>localStorage.getItem('audio-ui-disk'));await stop(page);await page.evaluate(()=>rejectWrite=true);await page.click('#okModal');assert.equal(await page.locator('#modal').isVisible(),true);assert.equal(await page.evaluate(()=>confirmCalls.length),0);await page.click('#cancelModal');assert.equal(await page.evaluate(()=>localStorage.getItem('audio-ui-disk')),saved);await page.reload();assert.equal(await page.locator('#pendingAudioBanner').isVisible(),true);
 });
 await run('android-back-and-bind-failure-do-not-undo-saved-note',async({page})=>{
  await install(page);await prepare(page);await stop(page);await page.evaluate(()=>rejectBind=true);await page.evaluate(()=>handleAndroidBack());assert.equal(await page.locator('#modal').isVisible(),false);
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('audio-ui-disk')).records.find(r=>r.kind==='canvas').items[0].audioMedia.length),1);assert.equal(await page.evaluate(()=>confirmCalls.length),1);
  await page.reload();assert.equal(await page.locator('#pendingAudioBanner').isVisible(),true);assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('audio-ui-disk')).records.find(r=>r.kind==='canvas').items[0].audioMedia.length),1);
 });
 await run('failed-stop-retains-recovery-and-uncertain-export-never-attaches',async({page})=>{
  await install(page);await prepare(page);await page.evaluate(()=>rejectStop=true);await stop(page);await page.click('#cancelModal');await page.evaluate(()=>exitEditor());assert.equal(await page.locator('#pendingAudioBanner').isVisible(),true);
  await page.evaluate(()=>{localStorage.setItem('audio-ui-journal',JSON.stringify([{state:'needs-review',available:false,token:'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'}]));PendingAudio.refresh()});
  const before=await page.evaluate(()=>localStorage.getItem('audio-ui-disk'));await page.click('#pendingAudioBanner');assert.equal(await page.locator('#retainedAudioList').getByText('Přehrát',{exact:true}).count(),0);
  await page.locator('#retainedAudioList').getByText('Uložit kopii originálu',{exact:true}).click();assert.equal(await page.evaluate(()=>exports.length),1);assert.equal(await page.evaluate(()=>localStorage.getItem('audio-ui-disk')),before);
 });
});
