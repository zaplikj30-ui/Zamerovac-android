/* Async feedback PNG write: actual production close/list/back/save code. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
function extract(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing production code: '+start);
 return src.slice(a,b);
}
const code=[
 extract(' let feedbackWriteUncertain=false;','\n // Never truncate'),
 extract(' const persist=next=>','\n const q='),
 extract(' function closeOverlay(){','\n function makeOverlay('),
 extract(' async function saveReport(){','\n // Android Zpět'),
 extract(' const previousBack=window.handleAndroidBack;','\n window.__openFeedbackList=')
].join('\n');
const nav=extract("  overlay.querySelector('#feedbackToList').onclick=()=>{",
 '\n  overlay.querySelector(\'#feedbackTitle\').value=');
assert(nav.includes('showReportList();'),'Actual ToList handler required');
function scenario(){
 const report={id:'report_abc',type:'bug',title:'Pomalé uložení',description:'Original',screenshotId:'screen_abc',
  annotatedId:null,annotations:[{type:'pen',points:[[.1,.2],[.3,.4]]}],videos:[]};
 const stats={removed:0,list:0,writes:0,begin:0,finish:0,messages:[]};
 const disk=new Map([['zamerovac-feedback-v1','[]']]);
 let done=null;
 const fields={
  '#feedbackType':{value:'bug'},'#feedbackTitle':{value:report.title},
  '#feedbackDescription':{value:report.description},
  '#feedbackResolved':{checked:false},
  '#feedbackSave':{disabled:false,textContent:'Uložit připomínku'},
  '#feedbackToList':{onclick:null}
 };
 const overlay={remove:()=>{stats.removed++},querySelector:key=>fields[key]||null};
 const scope={KEY:'zamerovac-feedback-v1',reports:[],busy:false,
  active:{report,image:{naturalWidth:100},canvas:{toBlob:cb=>{done=cb}}},
  overlay,flag:{hidden:true},window:{handleAndroidBack:()=> 'root'},
  native:true,validId:id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(id),
  now:()=> '2026-11-07T00:00:00.000Z',makeId:()=> 'raster_abc',
  showReportList:()=>{stats.list++},notify:x=>stats.messages.push(x),
  localStorage:{setItem:(k,v)=>{stats.writes++;disk.set(k,v)},getItem:k=>disk.get(k)||null},
  Native:{beginMediaChecked:()=>{stats.begin++;return true},appendMedia:()=>true,
   finishMedia:()=>{stats.finish++;return true}},
  Uint8Array,btoa,console
 };
 vm.createContext(scope);vm.runInContext(code+'\n'+nav,scope);
 return {scope,stats,fields,disk,overlay,finish:()=>{
  assert.equal(typeof done,'function','toBlob must be pending');
  done({arrayBuffer:async()=>Uint8Array.from([1,2,3,4]).buffer});
 }};
}
(async()=>{
 let s=scenario();
 const work=vm.runInContext('saveReport()',s.scope);
 assert.equal(s.scope.busy,true);
 assert.equal(s.fields['#feedbackSave'].disabled,true);
 vm.runInContext('closeOverlay()',s.scope);
 assert.strictEqual(s.scope.overlay,s.overlay,'Close during save must retain dialog');
 assert.ok(s.scope.active,'Keep active draft until confirmed');
 assert.equal(s.stats.removed,0);
 s.fields['#feedbackToList'].onclick();
 assert.equal(s.stats.list,0,'ToList must not replace the editor during save');
 assert.equal(vm.runInContext('window.handleAndroidBack()',s.scope),'handled');
 assert.equal(s.stats.removed,0,'Android Back must not discard pending report');
 assert.equal(s.stats.writes,0,'No record before PNG is ready');
 s.finish();await work;
 assert.deepEqual([s.stats.begin,s.stats.finish,s.stats.writes,s.stats.list],[1,1,1,1]);
 assert.equal(JSON.parse(s.disk.get('zamerovac-feedback-v1')).length,1);
 assert.ok(s.stats.messages.includes('Připomínka uložena'));
 assert.equal(s.scope.busy,false);
 vm.runInContext('closeOverlay()',s.scope);
 assert.equal(s.stats.removed,1,'Close must work after saving');
 assert.equal(s.scope.active,null);
 // Defensive case: an unexpected external callback replaces the active view.
 s=scenario();
 const stale=vm.runInContext('saveReport()',s.scope);
 s.scope.active={report:{id:'another_report'}};
 s.finish();await stale;
 assert.deepEqual([s.stats.begin,s.stats.writes,s.stats.list],[0,0,0],
  'Stale async completion must never publish old data');
 assert.equal(s.scope.busy,false);
 assert.ok(!s.stats.messages.includes('Připomínka uložena'));
 console.log('PASS: slow feedback Save blocks close/list/Back, stale callbacks cannot publish');
})().catch(e=>{console.error(e);process.exitCode=1});
