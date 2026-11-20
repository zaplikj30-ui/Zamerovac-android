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
const storage=new Map(),shares=[];let time=0,intervals=[],confirmDelete=true;
function el(tag){let text='';return {tag,children:[],style:{},get textContent(){return text},set textContent(v){text=v;this.children.length=0},value:'',append(...children){this.children.push(...children)},setAttribute(key,val){this[key]=val},focus(){},select(){},remove(){}}}
function boot(override={}){
 const panel=el('section');panel.querySelector=selector=>selector==='#flightSettings'?panel.children.find(c=>c.id==='flightSettings')||null:null;
 const doc={visibilityState:'visible',addEventListener(){},createElement:el,body:el('body'),getElementById:()=>null};
 const win={localStorage:{getItem:key=>storage.get(key)??null,setItem:(key,value)=>storage.set(key,value),removeItem:key=>storage.delete(key),...override},
  document:doc,addEventListener(){},confirm:()=>confirmDelete,Native:{shareText:(title,value)=>shares.push({title,value})}};
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
 buttons[1].onclick();assert.equal(shares.length,0,'share must wait for session selection');
 const history=panel.children[0].children.at(-1);
 assert.equal(history.hidden,false);
 assert.equal(history.children.length,1);
 history.children[0].children[1].onclick();assert.equal(shares.length,1);
 assert(!shares[0].value.includes('Secret'),'no untrusted text may appear in report');
 assert(!shares[0].value.includes('foo'),'unknown field may not appear in report');
 ({api}=boot());assert.equal(api.isEnabled(),true);
 assert.equal(api.snapshot().events.length,120,'restart must retain bounded events');
 time=3000;intervals.at(-1)();assert.equal(api.snapshot().events.at(-1).type,'ui-stall');
 api.toggle(false);api.record('native-save',{bridgeMs:555},true);
 assert.equal(api.snapshot().events.at(-1).type,'disabled');
 api.clear();assert.equal(api.snapshot().events.length,0);
 api.toggle(true);api.record('native-save',{bridgeMs:111,clientName:'Secret'},true);api.toggle(false);
 api.toggle(true);api.record('native-save',{bridgeMs:222},true);
 let list=api.sessionList();assert.equal(list.length,2,'each recording creates a session');
 assert.equal(api.snapshot(list[0].id).events.some(e=>e.values.bridgeMs===111),true);
 assert.equal(api.snapshot(list[1].id).events.some(e=>e.values.bridgeMs===111),false);
 const rowPanel=el('section');rowPanel.querySelector=selector=>selector==='#flightSettings'?rowPanel.children.find(c=>c.id==='flightSettings')||null:null;
 api.attachSettings(rowPanel);
 const rowButtons=rowPanel.children[0].children.filter(e=>e.tag==='button');
 rowButtons[1].onclick();
 const rowHistory=rowPanel.children[0].children.at(-1);
 assert.equal(rowHistory.children.length,2,'both dated measurements must be visible');
 confirmDelete=false;
 rowHistory.children[1].children[2].onclick();
 assert.equal(api.sessionList().length,2,'cancelled trash must preserve measurement');
 confirmDelete=true;
 rowHistory.children[1].children[2].onclick();
 assert.equal(api.sessionList().length,1,'trash must delete only selected measurement');
 assert.equal(rowHistory.children.length,1,'history must rerender after deletion');
 assert.equal(api.removeSession(list[0].id),false,'deleted measurement is no longer present');
 list=api.sessionList();assert.equal(list.length,1);
 assert.equal(api.snapshot(list[0].id).events.some(e=>e.values.bridgeMs===222),true);
 api.share(list[0].id);assert.equal(shares.length,2);
 assert(!shares[1].value.includes('Secret'),'share must not expose unknown keys');
 ({api}=boot());assert.equal(api.sessionList().length,1,'session history must survive reload');
 api.clear();assert.equal(api.sessionList().length,1,'while recording, clear creates a fresh active session');
 api.toggle(false);
 for(let i=api.sessionList().length;i<20;i++){assert.equal(api.toggle(true),true);api.toggle(false)}
 assert.equal(api.sessionList().length,20,'history has explicit bounded capacity');
 assert.equal(api.toggle(true),false,'full history must not silently delete old measurements');
 assert.equal(api.removeSession(api.sessionList()[0].id),true);
 assert.equal(api.toggle(true),true,'deleting one allows a new recording');
 api.toggle(false);
 const clearPanel=el('section');clearPanel.querySelector=selector=>selector==='#flightSettings'?clearPanel.children.find(c=>c.id==='flightSettings')||null:null;
 api.attachSettings(clearPanel);
 const clearButton=clearPanel.children[0].children.filter(e=>e.tag==='button')[2];
 confirmDelete=false;clearButton.onclick();assert.equal(api.sessionList().length,20,'cancelled clear-all must preserve all');
 confirmDelete=true;clearButton.onclick();assert.equal(api.sessionList().length,0,'confirmed clear-all deletes only diagnostic sessions');
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
 for(const key of ['dimensionCount','databasePhotoCount','databaseItemCount','databaseDimensionCount'])
  assert(editor.includes(key),'missing scoped photo/project count '+key);
 const fallback=boot();fallback.win.confirm=undefined;
 fallback.api.toggle(true);fallback.api.attachSettings(fallback.panel);
 const fallbackButtons=fallback.panel.children[0].children.filter(e=>e.tag==='button');
 fallbackButtons[1].onclick();
 const fallbackHistory=fallback.panel.children[0].children.at(-1);
 const beforeFallback=fallback.api.sessionList().length;
 fallbackHistory.children[0].children[2].onclick();
 assert.equal(fallback.api.sessionList().length,beforeFallback,'missing native confirm must not silently delete');
 assert.equal(fallbackHistory.children[0].children[2].textContent,'Potvrdit smazání');
 fallbackHistory.children[0].children[2].onclick();
 assert.equal(fallback.api.sessionList().length,beforeFallback-1,'explicit second tap authorizes deletion');
 assert(help.includes('na různých fotografiích'),'offline help photo distinction');
 for(const marker of ['Z195-revision-inventory','Z195-media-proof'])
  assert((revisions+media).includes(marker),'missing debug trace '+marker);
 console.log('PASS flight recorder: opt-in, privacy, 120 bound, local persistence, restart, stall, manual share, UI, integration and phase-source contracts');
}
run();

const key='zamerovac-perf-diagnostics-v2', legacyKey='zamerovac-perf-diagnostics-v1';
const stamp='2026-11-20T00:00:00.000Z';
const fixture=(count,enabled=false)=>JSON.stringify({version:2,enabled,activeId:enabled?'s1':null,
 sessions:Array.from({length:count},(_,i)=>({id:'s'+(i+1),startedAt:stamp,endedAt:null,events:[]}))});
const checks=[];
for(const raw of ['{broken JSON',fixture(21),JSON.stringify({version:2,enabled:false,activeId:null,sessions:[{}]})]){
 checks.push(()=>{storage.clear();storage.set(key,raw);const {api}=boot();
  assert.equal(api.toggle(true),false);api.flush();assert.equal(storage.get(key),raw);assert.equal(api.snapshot().persistenceOk,false);});
}
checks.push(()=>{storage.clear();const raw=fixture(2);storage.set(key,raw);
 const {api}=boot({getItem(){throw Error('unavailable')}});api.toggle(true);api.flush();
 assert.equal(storage.get(key),raw);assert.equal(api.snapshot().persistenceOk,false);});
for(const setItem of [()=>{throw Object.assign(Error('full'),{name:'QuotaExceededError'})},()=>{}]){
 for(const [enabled,action] of [[false,a=>a.removeSession('s1')],[false,a=>a.clear()],
  [false,a=>a.toggle(true)],[true,a=>a.toggle(false)],[true,a=>a.removeSession('s1')]]){
  checks.push(()=>{storage.clear();const raw=fixture(2,enabled);storage.set(key,raw);
   const {api}=boot({setItem});assert.equal(action(api),false);
   assert.equal(api.isEnabled(),enabled);assert.equal(api.sessionList().length,2);
   assert.equal(storage.get(key),raw);assert.equal(api.snapshot().persistenceOk,false);});
 }
}
for(const override of [{setItem(){throw Error('full')}},{setItem(){}},{removeItem(){throw Error('denied')}}]){
 checks.push(()=>{storage.clear();const raw=JSON.stringify({version:1,enabled:false,events:[{time:stamp,type:'native-save',values:{writeMs:12}}]});
  storage.set(legacyKey,raw);const {api}=boot(override);
  assert.equal(storage.get(legacyKey),raw);assert.equal(api.snapshot().persistenceOk,false);
  if(override.removeItem)assert.equal(JSON.parse(storage.get(key)).sessions[0].events[0].values.writeMs,12);
  else assert.equal(storage.has(key),false);});
}
checks.push(()=>{
 storage.clear();const raw=fixture(2);storage.set(key,raw);
 let failRead=false,writes=0;
 const {api}=boot({
  setItem(k,v){storage.set(k,v);if(++writes===1)failRead=true},
  getItem(k){if(failRead){failRead=false;throw Error('readback unavailable')}return storage.get(k)??null}
 });
 assert.equal(api.removeSession('s1'),false);
 assert.equal(storage.get(key),raw);assert.equal(api.sessionList().length,2);
 assert.equal(api.snapshot().persistenceOk,false);
});
checks.push(()=>{
 storage.clear();storage.set(key,fixture(2));const {api,panel}=boot({setItem(){throw Error('full')}});
 api.attachSettings(panel);const section=panel.children[0];
 section.children.filter(e=>e.tag==='button')[1].onclick();
 const history=section.children.at(-1);
 history.children[0].children[2].onclick();
 assert.equal(history.children.length,2);
 assert(section.children.some(e=>e.textContent.includes('nepodařilo potvrdit')));
});
let failures=0;
for(const [i,check] of checks.entries())try{check()}catch(e){failures++;console.error('Persistence case',i+1,e.message);}
console.log('Persistence fault cases:',checks.length-failures+'/'+checks.length);
if(failures)process.exitCode=1;
