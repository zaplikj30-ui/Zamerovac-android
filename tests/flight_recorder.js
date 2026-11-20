/* Opt-in flight recorder contract. Runs production JS under a synthetic
 * browser environment; NOT Android, Perfetto, or a physical performance test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/flight-recorder.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const help=fs.readFileSync('app/src/main/assets/help.js','utf8');
const java=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const revisions=fs.readFileSync('app/src/main/java/cz/zamerovac/app/ProtectedRevisions.java','utf8');
const media=fs.readFileSync('app/src/main/java/cz/zamerovac/app/ImmutableMediaProof.java','utf8');
const database=fs.readFileSync('app/src/main/java/cz/zamerovac/app/LocalDatabase.java','utf8');
const storage=new Map(),shares=[];let time=0,intervals=[];
function el(tag){return {tag,children:[],style:{},textContent:'',value:'',append(...children){this.children.push(...children)},focus(){},select(){},remove(){}}}
function boot(){
 const panel=el('section');panel.querySelector=selector=>selector==='#flightSettings'?panel.children.find(c=>c.id==='flightSettings')||null:null;
 const doc={visibilityState:'visible',addEventListener(){},createElement:el,body:el('body'),getElementById:()=>null};
 const win={localStorage:{getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)},
  document:doc,addEventListener(){},Native:{shareText:(title,value)=>shares.push({title,value})}};
 const pending=[];
 const context={window:win,performance:{now:()=>time},Date,JSON,Object,Number,
  setTimeout:fn=>{pending.push(fn);return pending.length},clearTimeout(){},
  setInterval:fn=>{intervals.push(fn);return intervals.length},clearInterval(){}};
 vm.runInNewContext(source,context);
 return {api:win.ZFlight,win,panel};
}
function run(){
 storage.set('zamerovac-perf-diagnostics-v1',JSON.stringify({version:1,enabled:false,events:[{time:'Private client name 123',type:'native-save',values:{bridgeMs:1}}]}));
 let {api,panel}=boot();
 assert.equal(api.isEnabled(),false);
 assert.equal(api.snapshot().events.length,0,'invalid stored timestamps must not be shared');
 api.toggle(true);
 api.record('native-save',{bridgeMs:30.234,writeMs:27.78,validationMs:1.2,revisionProtectMs:22.42,databaseCommitMs:3.4,serializeMs:2.14,success:1,name:'Secret',foo:111,readMs:-1},true);
 api.record('hidden-unknown',{secret:50},true);
 assert.equal(api.snapshot().events.at(-1).values.writeMs,27.8);
 assert.equal(api.snapshot().events.at(-1).values.revisionProtectMs,22.4);
 assert.equal(api.snapshot().events.at(-1).values.serializeMs,2.1);
 assert.equal(Object.hasOwn(api.snapshot().events.at(-1).values,'name'),false);
 assert.equal(Object.hasOwn(api.snapshot().events.at(-1).values,'foo'),false);
 assert.equal(Object.hasOwn(api.snapshot().events.at(-1).values,'readMs'),false);
 assert.equal(api.snapshot().events.some(row=>row.type==='hidden-unknown'),false);
 for(let i=0;i<180;i++)api.record('editor-commit',{savePathMs:i},false);
 api.flush();assert.equal(api.snapshot().events.length,120);
 assert.equal(shares.length,0,'no automatic transmission');
 api.attachSettings(panel);api.attachSettings(panel);
 assert.equal(panel.children.length,1,'settings controls must not duplicate');
 const buttons=panel.children[0].children.filter(e=>e.tag==='button');
 assert.equal(buttons.length,3);
 assert.equal(buttons[0].textContent,'Vypnout záznam');
 buttons[1].onclick();assert.equal(shares.length,1);
 assert(!shares[0].value.includes('Secret'),'no untrusted text may appear in report');
 assert(!shares[0].value.includes('foo'),'unknown field may not appear in report');
 ({api}=boot());assert.equal(api.isEnabled(),true);
 assert.equal(api.snapshot().events.length,120,'restart must retain bounded events');
 time=3000;intervals.at(-1)();assert.equal(api.snapshot().events.at(-1).type,'ui-stall');
 api.toggle(false);api.record('native-save',{bridgeMs:555},true);
 assert.equal(api.snapshot().events.at(-1).type,'disabled');
 api.clear();assert.equal(api.snapshot().events.length,0);
 assert(html.indexOf('flight-recorder.js')<html.indexOf('app.js'),'flight recorder must exist before app.js');
 assert.match(app,/ZFlight\.record\('native-save'/);
 assert.match(app,/ZFlight\?\.attachSettings/);
 assert.match(editor,/ZFlight\?\.record\('drag-release'/);
 assert.match(editor,/ZFlight\.record\('editor-commit'/);
 assert(help.includes('Diagnostika výkonu')&&help.includes('120 událostí'),'offline help must explain new diagnostic controls');
 for(const label of ['lockWaitMs','readMs','writeMs','generationMs','recoveryMs','revisionCount','cacheHits','cacheMisses','mediaChecks'])
  assert(java.includes('.put("'+label+'",'),'missing Native phase '+label);
 for(const key of ['validationMs','casRecheckMs','revisionProtectMs','evidenceMs','databaseCommitMs'])
  assert(java.includes('.put("'+key+'",'),'missing native write phase '+key);
 assert(database.includes('DEBUG_WRITE_TIMES')&&database.includes('beginDebugWrite()')&&database.includes('takeDebugWrite()'),'missing scoped Native phase timing');
 assert(java.includes('if(perf)LocalDatabase.takeDebugWrite();'),'missing failure cleanup of debug timings');
 for(const key of ['dimensionCount','projectPhotoCount','projectItemCount','projectDimensionCount'])
  assert(editor.includes(key),'missing scoped photo/project count '+key);
 assert(help.includes('na různých fotografiích'),'offline help photo distinction');
 for(const marker of ['Z195-revision-inventory','Z195-media-proof'])
  assert((revisions+media).includes(marker),'missing debug trace '+marker);
 console.log('PASS flight recorder: opt-in, privacy, 120 bound, local persistence, restart, stall, manual share, UI, integration and phase-source contracts');
}
run();
