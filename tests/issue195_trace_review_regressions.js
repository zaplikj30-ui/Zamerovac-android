/* #195 independent-review regressions. Production modal/promptText handlers and
 * unchanged opt-in DevTools helper run under a synthetic DOM/RAF only.
 * Java lock/finally assertions are SOURCE contracts, not an Android run.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const helper=fs.readFileSync('tools/diagnostics/issue195-folder-save-devtools.js','utf8');
const java=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const extract=(a,b)=>{const i=app.indexOf(a),j=app.indexOf(b,i+a.length);
 assert(i>=0&&j>i,'production app.js boundary missing '+a);return app.slice(i,j)};
const realModal=extract("$('okModal').onclick=()=>","// ImageMeter-style browser previews.");
const bridge=java.slice(java.indexOf('@JavascriptInterface public String saveDataChecked('),
 java.indexOf('@JavascriptInterface public boolean beginMedia('));
function fixture(){
 let clock=0,failed=false,saves=0,renders=0;
 const notice=[],micro=[],raf=[],listeners=[];
 const modal={hidden:true},title={textContent:''},prompt={value:''};
 const ok={onclick:null,
  addEventListener:(kind,cb,capture)=>{if(kind==='click')listeners.push({cb,capture})},
  removeEventListener:(kind,cb,capture)=>{const i=listeners.findIndex(v=>v.cb===cb&&v.capture===capture);if(i>=0)listeners.splice(i,1)}};
 const cancel={onclick:null},els={modal,modalTitle:title,promptValue:prompt,okModal:ok,cancelModal:cancel};
 const win={modalOK:null,modalBackHandler:null,
  save(){saves++;clock+=5;return !failed},
  showFolder(){renders++;clock+=2;return true}};
 const originalSave=win.save,originalFolder=win.showFolder;
 const env={window:win,$:id=>els[id],document:{getElementById:id=>els[id]||null},
  modal:(name,html,cb)=>{title.textContent=name;modal.hidden=false;win.modalOK=cb},
  notify:message=>notice.push(String(message)),escapeHtml:value=>String(value),
  queueMicrotask:cb=>micro.push(cb),requestAnimationFrame:cb=>{raf.push(cb);return raf.length},
  performance:{now:()=>clock},console:{info(){},table(){}}};
 vm.createContext(env);
 vm.runInContext(realModal,env);
 vm.runInContext(helper,env);
 const probe=win.__z195FolderProbe;assert(probe);
 const prepare=(text='',name='Nová složka')=>{
  env.promptText(name,'Jméno','',()=>{
   const saved=win.save();if(saved===true)win.showFolder();return saved;
  });prompt.value=text;
 };
 // Browser target: capture listener, already-registered production onclick,
 // then the DevTools noncapturing afterClick listener on the same button.
 assert.equal(listeners.filter(x=>x.capture===false).length,1,
  'post-onclick validation listener must be installed');
 const click=()=>{
  for(const l of [...listeners].filter(x=>x.capture===true))l.cb();
  ok.onclick();
  for(const l of [...listeners].filter(x=>x.capture===false))l.cb();
 };
 const microFlush=()=>{for(let n=0;n<6&&micro.length;n++)micro.splice(0).forEach(fn=>fn())};
 const rafFlush=()=>{for(let n=0;n<6&&raf.length;n++)raf.splice(0).forEach(fn=>fn())};
 return {win,env,modal,cancel,notice,probe,prepare,click,microFlush,rafFlush,
  inc:ms=>{clock+=ms},setFailed:v=>{failed=v},originalSave,originalFolder,
  get saves(){return saves},get renders(){return renders},
  get queuedRaf(){return raf.length},get listeners(){return listeners.length}};
}
const cases=[
 ['rejected blank then unrelated save after 4000ms',()=>{
  const f=fixture();f.prepare('  ');f.click();
  assert.equal(f.modal.hidden,false);assert.equal(f.saves,0);
  assert(f.notice.includes('Vyplň hodnotu'),'actual promptText validation not executed');
  f.microFlush();f.inc(4000);f.win.save();f.win.showFolder();f.rafFlush();
  assert.equal(f.probe.samples.length,0,'stale blank-folder click captured unrelated save');f.probe.stop();
 }],
 ['cancel after invalid folder must not capture subsequent action',()=>{
  const f=fixture();f.prepare('');f.click();f.cancel.onclick();f.microFlush();f.inc(1000);
  f.win.save();f.win.showFolder();f.rafFlush();assert.equal(f.probe.samples.length,0);f.probe.stop();
 }],
 ['valid retry after blank records only one correlated click',()=>{
  const f=fixture();f.prepare('');f.click();f.microFlush();
  f.env.$('promptValue').value='Syntetická A';f.click();f.microFlush();f.rafFlush();
  assert.equal(f.saves,1);assert.equal(f.probe.samples.length,1);
  const item=f.probe.samples[0];assert.equal(item.jsSaveMs,5);
  assert.equal(item.showFolderMs,2);assert.equal(item.clickToTwoFramesMs,7);
  assert(!JSON.stringify(item).includes('Syntetická A'));f.probe.stop();
 }],
 ['late RAF after stop cannot mutate samples',()=>{
  const f=fixture();f.prepare('Syntetická B');f.click();assert(f.queuedRaf>0);
  const samples=f.probe.samples;f.probe.stop();f.microFlush();f.rafFlush();
  assert.equal(samples.length,0,'late RAF wrote after stop');
  assert.equal(f.win.save,f.originalSave);assert.equal(f.win.showFolder,f.originalFolder);
  assert.equal(f.listeners,0);f.win.save();f.win.showFolder();assert.equal(samples.length,0);
 }],
 ['late missing-render RAF after stop cannot mutate samples',()=>{
  const f=fixture();f.env.modal('Nová složka','',()=>f.win.save());f.click();
  assert(f.queuedRaf>0);f.probe.stop();f.microFlush();f.rafFlush();
  assert.equal(f.probe.samples.length,0,'late incomplete-render sample after stop');
 }],
 ['unrelated modal does not count',()=>{
  const f=fixture();f.prepare('Syntetická C','Jiný dialog');f.click();f.microFlush();f.rafFlush();
  assert.equal(f.probe.samples.length,0);f.probe.stop();
 }],
 ['positive actual prompt save and paint',()=>{
  const f=fixture();f.prepare('Syntetická D');f.click();f.microFlush();f.rafFlush();
  assert.equal(f.probe.samples.length,1);
  assert.equal(f.probe.samples[0].jsSaveReturnedTrue,true);
  assert.equal(f.probe.samples[0].jsSaveMs,5);assert.equal(f.probe.samples[0].showFolderMs,2);
  f.probe.stop();
 }],
 ['negative failed save has no render',()=>{
  const f=fixture();f.setFailed(true);f.prepare('Syntetická E');f.click();f.microFlush();f.rafFlush();
  assert.equal(f.probe.samples.length,1);
  assert.equal(f.probe.samples[0].jsSaveReturnedTrue,false);
  assert.equal(f.probe.samples[0].showFolderMs,null);f.probe.stop();
 }],
 ['actual modal double click does not duplicate save',()=>{
  const f=fixture();f.prepare('Syntetická F');f.click();f.click();f.microFlush();f.rafFlush();
  assert.equal(f.saves,1);assert.equal(f.probe.samples.length,1);f.probe.stop();
 }],
 ['lock-wait Trace closes on exceptional monitor entry',()=>{
  const s=bridge.slice(bridge.indexOf('Trace.beginSection("Z195-lock-wait")'));
  assert.match(s,/Trace\.beginSection\("Z195-lock-wait"\);\s*try\s*\{\s*synchronized\(TrashPurger\.LOCK\)\s*\{/,
   'lock acquisition must be under try, not before try');
  assert.match(s,/lockWaitOpen\s*=\s*false;\s*Trace\.endSection\(\);/,
   'normal lock entry must close trace once');
  assert.match(s,/\}\s*finally\s*\{\s*(?:\/\/[^\n]*\n\s*)?if\(lockWaitOpen\)Trace\.endSection\(\);\s*\}\s*\}\s*finally\s*\{\s*if\(perf\)Trace\.endSection\(\);/,
   'lock wait must have own finally before bridge finally');
 }]
];
(async()=>{let ok=0,fail=0;for(const [name,run] of cases){
 if(process.env.Z195_CASE&&!name.toLowerCase().includes(process.env.Z195_CASE.toLowerCase()))continue;
 try{await run();ok++;console.log('PASS '+name)}catch(e){fail++;console.error('FAIL '+name+': '+e.message)}
}console.log((fail?'FAIL':'PASS')+' #195 reviewer '+ok+' PASS / '+fail+' FAIL');if(fail)process.exitCode=1})();
