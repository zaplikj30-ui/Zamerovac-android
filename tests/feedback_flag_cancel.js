/* PR #215 P3: exercise actual pointer handlers with a synthetic DOM.
 * No customer data, browser, or Android device is used in this Node VM test.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const css=fs.readFileSync('app/src/main/assets/settings-navigation.css','utf8');
const from=src.indexOf(" const flag=document.createElement('button');");
const to=src.indexOf(" let overlay=null,active=null,busy=false;",from);
assert(from>=0&&to>from,'Use exact production flag handlers');
assert.match(css,/#settingsPanel:not\(\[hidden\]\)\s*~\s*#feedbackFlag:not\(\[data-settings-moved\]\)/);
const code=src.slice(from,to),POS='zamerovac-feedback-flag-position-v1';
function setup({settings=true,previous={edge:'right',top:.3}}={}){
 const disk=new Map(previous?[[POS,JSON.stringify(previous)]]:[]);
 const timers=new Map(),handlers={},calls={click:0,list:0};
 let nextTimer=0;
 const flag={style:{},dataset:{},setAttribute(){},addEventListener(k,fn){handlers[k]=fn},
  setPointerCapture(){},releasePointerCapture(){}};
 const panel={hidden:!settings};
 const scope={POS,innerWidth:390,innerHeight:800,Math,Date,JSON,
  document:{createElement(){return flag},body:{appendChild(){}},getElementById:id=>id==='settingsPanel'?panel:null},
  localStorage:{getItem:key=>disk.get(key)||null,setItem:(key,value)=>disk.set(key,value)},
  setTimeout:fn=>{const id=++nextTimer;timers.set(id,fn);return id},
  clearTimeout:id=>timers.delete(id),
  startNewReport(){calls.click++},showReportList(){calls.list++}
 };
 scope.window=scope;
 vm.runInNewContext(code+'\nwindow.testFlag=flag;',scope,{filename:'feedback-reports:flag'});
 assert.equal(scope.testFlag,flag);
 const emit=(type,x=365,y=8)=>{assert.equal(typeof handlers[type],'function',type);
  handlers[type]({button:0,pointerId:31,clientX:x,clientY:y,preventDefault(){}})};
 const flush=()=>{for(const [id,fn] of [...timers]){timers.delete(id);fn()}};
 return {flag,panel,disk,calls,emit,flush,
  saved:()=>disk.get(POS)||null,
  pinned:()=>!panel.hidden&&flag.dataset.settingsMoved===undefined};
}
{
 const t=setup(),saved=t.saved();
 assert.equal(t.pinned(),true);
 t.emit('pointerdown');t.emit('pointermove',66,540);
 assert.equal(t.flag.dataset.settingsMoved,'true');
 t.emit('pointercancel',66,540);
 assert.equal(t.flag.dataset.settingsMoved,undefined,'Cancel restores prior absent marker');
 assert.equal(t.pinned(),true,'Header CSS re-activates after cancellation');
 assert.equal(t.flag.style.top,'30%');assert.equal(t.flag.style.right,'9px');
 assert.equal(t.saved(),saved,'Cancel may not persist a changed position');
 t.emit('pointerup',66,540);t.flush();
 assert.deepEqual(t.calls,{click:0,list:0},'Cancel may not activate report actions');
 t.panel.hidden=true;t.panel.hidden=false;
 assert.equal(t.pinned(),true,'Reopened Settings still pins flag');
}
{
 const t=setup({previous:{edge:'left',top:.42}}),saved=t.saved();
 t.emit('pointerdown',10,336);t.emit('pointercancel',10,336);
 assert.equal(t.flag.dataset.settingsMoved,undefined,'Cancel without move must be inert');
 assert.equal(t.saved(),saved);assert.equal(t.flag.style.left,'9px');
 assert.equal(t.flag.style.top,'42%');
}
{
 const t=setup({previous:{edge:'right',top:.25}});
 t.emit('pointerdown');t.emit('pointermove',65,540);t.emit('pointerup',65,540);
 assert.equal(t.flag.dataset.settingsMoved,'true');
 assert.equal(JSON.parse(t.saved()).edge,'left','Completed drag left persists');
 const left=t.saved(),top=t.flag.style.top;
 t.emit('pointerdown',10,540);t.emit('pointermove',345,700);t.emit('pointercancel',345,700);
 assert.equal(t.flag.dataset.settingsMoved,'true','Cancel after completed drag preserves marker');
 assert.equal(t.saved(),left,'Second cancel restores last persisted position');
 assert.equal(t.flag.style.left,'9px');assert.equal(t.flag.style.top,top);
 t.emit('pointerdown',10,540);t.emit('pointermove',365,445);t.emit('pointerup',365,445);
 assert.equal(JSON.parse(t.saved()).edge,'right','Completed reverse drag right persists');
 assert.equal(t.flag.style.right,'9px');
}
{
 const t=setup({settings:false,previous:{edge:'right',top:.2}}),saved=t.saved();
 t.emit('pointerdown');t.emit('pointermove',65,470);t.emit('pointercancel',65,470);
 assert.equal(t.flag.dataset.settingsMoved,undefined);
 assert.equal(t.saved(),saved);
 t.emit('pointerdown');t.emit('pointermove',65,470);t.emit('pointerup',65,470);
 assert.equal(JSON.parse(t.saved()).edge,'left','Normal drag outside Settings still works');
}
{
 const t=setup();
 t.emit('pointerdown');t.emit('pointerup');t.flush();
 assert.deepEqual(t.calls,{click:1,list:0},'Tap must still open a report');
 t.emit('pointerdown');t.flush();t.emit('pointerup');
 assert.deepEqual(t.calls,{click:1,list:1},'Long hold must still open the list');
 t.emit('pointerdown');t.emit('pointercancel');t.flush();
 assert.deepEqual(t.calls,{click:1,list:1},'Cancel must stop long hold');
}
console.log('PASS #215 P3: first/repeated cancellation, saved position, both edges, reopening, tap/hold 5/5');
