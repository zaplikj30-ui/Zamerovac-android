/* #195 debug-only trace contract. Static Java checks do NOT substitute for
 * Gradle/Android compilation or timing. The browser helper is VM-executed.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const java=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const helper=fs.readFileSync('tools/diagnostics/issue195-folder-save-devtools.js','utf8');
const start=java.indexOf('@JavascriptInterface public String saveDataChecked(String text,String expected)');
const end=java.indexOf('@JavascriptInterface public boolean beginMedia(',start);
assert(start>=0&&end>start,'actual Native bridge boundary exists');
const bridge=java.slice(start,end);
assert(java.includes('import android.os.Trace;'),'Android Trace import missing');
const sections=['Z195-bridge','Z195-lock-wait','Z195-readDb','Z195-writeDb','Z195-generation','Z195-recoverPrimary'];
for(const name of sections)assert(bridge.includes('Trace.beginSection("'+name+'")'),'missing '+name);
assert(bridge.includes('final boolean perf=BuildConfig.DEBUG;'), 'test-only BuildConfig.DEBUG gate missing');
assert.equal((bridge.match(/if\(perf\)Trace\.beginSection\(/g)||[]).length,sections.length,
 'every profiling section must be guarded by the debug flag');
assert.equal((bridge.match(/if\(perf\)Trace\.endSection\(/g)||[]).length,sections.length,
 'every end section must be guarded by the debug flag');
const order=['Z195-lock-wait','Z195-readDb','Z195-writeDb','Z195-generation','Z195-recoverPrimary'];
for(let i=1;i<order.length;i++)
 assert(bridge.indexOf('Trace.beginSection("'+order[i]+'")')>bridge.indexOf('Trace.beginSection("'+order[i-1]+'")'),
 'observed Native ordering unexpectedly changed: '+order[i]);
assert.equal((bridge.match(/Trace\.beginSection\(/g)||[]).length,(bridge.match(/Trace\.endSection\(/g)||[]).length,
 'begin/end sections count must be balanced, incl error paths');
for(const required of [
 'synchronized(TrashPurger.LOCK)','readDbForCas()','current.equals(expected)',
 'writeDb(text)','LocalDatabase.generation(getFilesDir())','recoverPrimary().length()',
 'put("ok",false)','put("ok",true)','catch(Exception uncertainty)',
 'return "{\\\"ok\\\":true,\\\"audioPending\\\":true}"'
])assert(bridge.includes(required),'original durable/uncertain CAS contract lost: '+required);
assert(!/Log\.(?:d|i|w|e|v)\(/.test(bridge),'no logcat with user content');
assert(!/setWebContentsDebuggingEnabled|JavascriptInterface public (?:long|int|boolean) (?:trace|profile)/.test(bridge),
 'no new debugging bridge or release debugging');
let clock=0;const events=[],raf=[],out=[],button={
 addEventListener(kind,cb,capture){events.push({kind,cb,capture})},
 removeEventListener(kind,cb,capture){events.splice(events.findIndex(e=>e.kind===kind&&e.cb===cb&&e.capture===capture),1)}
};
let fail=false;
const window={save(){clock+=7;return !fail},showFolder(){clock+=3;return true}},
 firstSave=window.save,firstFolder=window.showFolder;
const modal={hidden:false},title={textContent:'Nová složka'};
const document={getElementById:id=>id==='modal'?modal:id==='modalTitle'?title:id==='okModal'?button:null};
const console={info(msg){out.push(msg)},table(rows){out.push(rows)}};
vm.runInNewContext(helper,{window,document,performance:{now:()=>clock},requestAnimationFrame:fn=>raf.push(fn),console});
const probe=window.__z195FolderProbe;
assert(probe,'Chrome DevTools hook not installed');
const click=()=>events.filter(e=>e.kind==='click').forEach(e=>e.cb());
const flush=()=>{for(let n=0;n<4&&raf.length;n++){const batch=raf.splice(0);batch.forEach(fn=>fn())}};
click();assert.equal(window.save(),true);assert.equal(window.showFolder(),true);flush();
assert.equal(probe.samples.length,1);assert.equal(probe.samples[0].jsSaveReturnedTrue,true);
assert.equal(probe.samples[0].jsSaveMs,7);
assert.equal(probe.samples[0].showFolderMs,3);
assert.equal(probe.samples[0].clickToTwoFramesMs,10);
assert(!JSON.stringify(probe.samples).includes('Nová složka'),'personal names never captured');
fail=true;click();assert.equal(window.save(),false);flush();
assert.equal(probe.samples.length,2);
assert.equal(probe.samples[1].jsSaveReturnedTrue,false);
assert.equal(probe.samples[1].jsSaveMs,7);
assert.equal(probe.samples[1].showFolderMs,null,'false JS return must never infer a rendered folder');
assert.equal(probe.samples[1].clickToTwoFramesMs,null);
fail=false;
click();assert.equal(window.save(),true);flush(); // successful JS return, but no showFolder
assert.equal(probe.samples.length,3,'missing render must not leave an incomplete sample');
assert.equal(probe.samples[2].jsSaveReturnedTrue,true);
assert.equal(probe.samples[2].showFolderMs,null);
assert.equal(probe.samples[2].clickToTwoFramesMs,null);
title.textContent='Jiný dialog';click();assert.equal(probe.samples.length,3,'other dialogs ignored');
probe.stop();assert.equal(window.save,firstSave);
assert.equal(window.showFolder,firstFolder);
assert.equal(window.__z195FolderProbe,undefined);assert.equal(events.length,0);
console.info('PASS #195: trace source contract + opt-in DevTools measurements/cleanup (STATIC Java, VM browser mock)');
