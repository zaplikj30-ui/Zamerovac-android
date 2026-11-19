/* Regression for PR #210 P1/P2: use production startup, persist and list/delete.
 * A synthetic DOM/localStorage hosts the exact source segments; no app data touched.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
function segment(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Production segment unavailable: '+start);
 return source.slice(a,b);
}
const startup=segment(" const KEY='zamerovac-feedback-v1'"," // Commit the proposed list");
const persistence=segment(' const persist=next=>','\n const q=');
const escapeHtml=segment(' const q=','\n const now=');
const summary=segment(' function summary(r){','\n function selectedReports(){');
const list=segment(' function showReportList(){','\n function sendBatch(saveToFile){');
const share=segment(' function sendBatch(saveToFile){','\n window.onReportBundleSaved=');
const capture=segment(' function startNewReport(){','\n window.onReportScreenshot=');
const KEY='zamerovac-feedback-v1';
const makeReport=i=>({
 id:'fb-'+String(i).padStart(3,'0'), title:'Hlášení '+i,description:'Popis '+i,
 type:'bug',screen:'Editor',createdAt:'2026-11-18T12:00:00.000Z',
 screenshotId:'original-'+i,annotatedId:'annotated-'+i,videos:[{id:'video-'+i}],
 resolved:false,annotations:[]
});
function boot(disk,{approve=true,fault='none'}={}){
 const calls={prompts:[],notices:[],writes:0,buttons:[],markup:'',nativeCalls:0};
 let wrote=false,oneReadbackFailure=false;
 const ctx={
  localStorage:{
   getItem(key){
    if(fault==='readback'&&wrote)throw new Error('Readback unavailable');
    if(fault==='readback-once'&&oneReadbackFailure){
     oneReadbackFailure=false;throw new Error('Transient readback unavailable');
    }
    return disk.get(key)||null;
   },
   setItem(key,value){calls.writes++;if(fault==='throw')throw new Error('QuotaExceeded');
    if(fault!=='ignored')disk.set(key,value);wrote=true;
    if(fault==='readback-once')oneReadbackFailure=true;}
  },
  notify:message=>calls.notices.push(message),
  window:{confirm:message=>{calls.prompts.push(message);return approve}},
  makeOverlay:markup=>{
   calls.markup=markup;
   calls.buttons=[...markup.matchAll(/data-feedback-delete="([^"]+)"/g)]
      .map(m=>({dataset:{feedbackDelete:m[1]}}));
   const controls=new Map();
   ctx.overlay={
    querySelector:selector=>{if(!controls.has(selector))controls.set(selector,{dataset:{},textContent:''});return controls.get(selector)},
    querySelectorAll:selector=>selector==='[data-feedback-delete]'?calls.buttons:[]
   };
  },
  closeOverlay:()=>{},
  sendBatch:()=>{calls.nativeCalls++;},
  Native:{cleanupFinishedIssueBundles:()=>{calls.nativeCalls++},
   shareIssueBundle:()=>{calls.nativeCalls++},saveIssueBundle:()=>{calls.nativeCalls++},
   captureReportScreenshot:()=>{calls.nativeCalls++}},
  now:()=> '2026-11-19T09:00:00.000Z',
  selectedReports:()=>JSON.parse(vm.runInContext('JSON.stringify(reports)',ctx)),
  native:true,busy:false,flag:{style:{}},current:null,
  screenName:()=> 'Editor',requestAnimationFrame:fn=>fn()
 };
 vm.createContext(ctx);
 vm.runInContext('var overlay=null;\n'+startup+persistence+escapeHtml+summary+list+share+capture,ctx);
 const read=()=>JSON.parse(vm.runInContext('JSON.stringify(reports)',ctx));
 const commit=next=>vm.runInContext('persist('+JSON.stringify(next)+')',ctx);
 const exportBatch=save=>vm.runInContext('sendBatch('+!!save+')',ctx);
 const startCapture=()=>vm.runInContext('startNewReport()',ctx);
 const draw=()=>vm.runInContext('showReportList()',ctx);
 const click=id=>{
  draw();
  const button=calls.buttons.find(b=>b.dataset.feedbackDelete===id);
  assert.ok(button,'Expected delete button for '+id);
  button.onclick();
 };
 return {calls,read,click,commit,exportBatch,startCapture};
}
function data(rows){return new Map([[KEY,JSON.stringify(rows)]])}
function fromDisk(disk){return JSON.parse(disk.get(KEY))}
const failures=[];
function scenario(name,fn){
 try{fn();console.log('PASS',name)}
 catch(e){failures.push(name+': '+e.message);console.error('FAIL',name,e.message)}
}
scenario('301 stored -> restart -> exactly one deletion -> 300 preserved -> restart',()=>{
 const disk=data(Array.from({length:301},(_,i)=>makeReport(i)));
 const original=fromDisk(disk);
 const session=boot(disk);
 assert.equal(session.read().length,301,'Startup must not silently discard the oldest item');
 assert.equal(session.read()[0].id,'fb-000');
 session.click('fb-001');
 const after=fromDisk(disk);
 assert.equal(session.calls.prompts.length,1);
 assert.equal(after.length,300,'Exactly one report may be deleted');
 assert.equal(after.some(r=>r.id==='fb-000'),true,'Oldest report must survive');
 assert.equal(after.some(r=>r.id==='fb-001'),false);
 assert.equal(after.some(r=>r.id==='fb-300'),true);
 assert.deepEqual(after,original.filter(r=>r.id!=='fb-001'),'Only confirmed report may change');
 const reboot=boot(disk);
 assert.deepEqual(reboot.read(),after,'Restart must preserve all remaining reports');
 reboot.click('fb-300');
 assert.deepEqual(fromDisk(disk),after.filter(r=>r.id!=='fb-300'),'Another save after restart must preserve oldest');
});
scenario('duplicate ID: fail closed without prompt, write or media change',()=>{
 const a=makeReport(1),b=makeReport(2),c=makeReport(3);
 b.id=a.id;
 const disk=data([a,b,c]),before=disk.get(KEY);
 const session=boot(disk);
 session.click(a.id);
 assert.equal(session.calls.prompts.length,0,'Ambiguous deletion must not request a misleading one-item confirmation');
 assert.equal(session.calls.writes,0,'Ambiguous deletion must not write anything');
 assert.equal(disk.get(KEY),before);
 assert.equal(session.read().length,3);
 assert.ok(session.calls.notices.some(m=>/stejné ID|duplicit|jednoznačn/i.test(m)),'Explain the duplicate-ID refusal');
 assert.equal(session.calls.nativeCalls,0);
 assert.deepEqual(boot(disk).read(),[a,b,c],'Restart must preserve both duplicates and other records');
});
scenario('cancel: entire 301-record list remains unchanged',()=>{
 const disk=data(Array.from({length:301},(_,i)=>makeReport(i))),before=disk.get(KEY);
 const session=boot(disk,{approve:false});
 session.click('fb-001');
 assert.equal(session.calls.prompts.length,1);
 assert.equal(session.calls.writes,0);
 assert.equal(disk.get(KEY),before);
 assert.equal(session.read().length,301);
});
for(const fault of ['throw','ignored']){
 scenario('disk failure '+fault+': no RAM loss, no falsely confirmed deletion',()=>{
  const disk=data(Array.from({length:301},(_,i)=>makeReport(i))),before=disk.get(KEY);
  const session=boot(disk,{fault});
  session.click('fb-001');
  assert.equal(session.calls.writes,1);
  assert.equal(session.read().length,301,'Failed delete must retain full in-memory list');
  assert.equal(disk.get(KEY),before,'Failed delete must preserve stored records');
  assert.ok(session.calls.notices.some(m=>/Nepodařilo se uložit/i.test(m)),'Show write failure');
  assert.ok(!session.calls.notices.includes('Hlášení smazáno'),'Never report false deletion success');
  assert.deepEqual(boot(disk).read(),JSON.parse(before),'Restart after error must preserve all reports');
 });
}
scenario('readback error after successful write: no unapproved data loss',()=>{
 const originals=Array.from({length:301},(_,i)=>makeReport(i));
 const disk=data(originals);
 const session=boot(disk,{fault:'readback'});
 session.click('fb-001');
 assert.equal(session.calls.writes,1);
 assert.equal(session.read().length,301,'Unacknowledged write must preserve RAM snapshot for retry');
 assert.ok(session.calls.notices.some(m=>/Nepodařilo se uložit/i.test(m)),'Storage readback failure must be reported');
 const stored=fromDisk(disk);
 assert.deepEqual(stored,originals.filter(r=>r.id!=='fb-001'),
  'A write that completed before readback failure must still remove ONLY the confirmed record');
 assert.deepEqual(boot(disk).read(),stored,'Reload must reflect actual durable bytes, not a false success');
});
scenario('P2-A uncertain write: next confirmed delete cannot resurrect deleted report',()=>{
 const rows=[makeReport(1),makeReport(2),makeReport(3)],disk=data(rows);
 const session=boot(disk,{fault:'readback-once'});
 session.click('fb-001'); // setItem committed, getItem failed once
 assert.deepEqual(fromDisk(disk),[rows[1],rows[2]],'First write physically removed only confirmed entry');
 assert.deepEqual(session.read(),rows,'RAM is deliberately not marked successful after failed readback');
 assert.ok(session.calls.notices.some(m=>/Nepodařilo se uložit/i.test(m)));
 session.click('fb-003'); // same session; stale RAM must NOT overwrite the new disk state
 assert.deepEqual(fromDisk(disk),[rows[1],rows[2]],
  'Second mutation must not resurrect fb-001 from stale RAM');
 assert.equal(session.calls.writes,1,'No second write before a trusted reload');
 assert.ok(!session.calls.notices.includes('Hlášení smazáno'),
  'Do not claim success during uncertain save');
 const reboot=boot(disk);
 assert.deepEqual(reboot.read(),[rows[1],rows[2]],'Restart recovers confirmed disk baseline');
 reboot.click('fb-003');
 assert.deepEqual(fromDisk(disk),[rows[1]],'A new confirmed mutation after restart may continue safely');
 assert.equal(session.calls.nativeCalls,0,'Do not use native media bridge for deletion');
});
scenario('P3-B 301 reports, incomplete oldest: render, delete healthy, restart, retain all others',()=>{
 const rows=Array.from({length:301},(_,i)=>makeReport(i));
 delete rows[0].description;
 rows[0].title='';
 const disk=data(rows);
 const session=boot(disk);
 assert.equal(session.read().length,301);
 session.click('fb-001'); // this calls real summary() for the old damaged record
 assert.equal(session.calls.prompts.length,1);
 assert.equal(fromDisk(disk).length,300);
 assert.deepEqual(fromDisk(disk),rows.filter(r=>r.id!=='fb-001'),
  'Preserve incomplete oldest verbatim, never repair or delete it implicitly');
 assert.match(session.calls.markup,/\(Bez popisu\)/,'Render a safe visible fallback');
 assert.deepEqual(boot(disk).read(),fromDisk(disk),'Restart keeps the legacy record and valid reports');
 assert.equal(session.calls.nativeCalls,0);
});
scenario('P3-B legacy non-text fields and invalid date render without rewriting source',()=>{
 const rows=Array.from({length:301},(_,i)=>makeReport(i));
 rows[0].title={label:'bad'};
 rows[0].description=17;
 rows[0].screen={toString:null};
 rows[0].createdAt={toString:null,valueOf:null};
 const disk=data(rows),before=JSON.stringify(rows[0]),session=boot(disk);
 session.click('fb-001');
 assert.equal(fromDisk(disk).length,300);
 assert.equal(JSON.stringify(fromDisk(disk)[0]),before,'Corrupt legacy report bytes must remain unchanged');
 assert.match(session.calls.markup,/\(Bez popisu\)/,'Legacy text fallback is visible');
 assert.match(session.calls.markup,/Datum neuvedeno/,'Invalid date cannot crash list rendering');
 assert.deepEqual(boot(disk).read(),fromDisk(disk));
});
scenario('broken startup storage payload blocks all overwrites',()=>{
 const invalid='{not JSON';
 const disk=new Map([[KEY,invalid]]);
 const session=boot(disk);
 assert.equal(session.read().length,0,'Loader may display empty list but must not rewrite corruption');
 assert.equal(session.commit([makeReport(1)]),false,'Corrupt startup data must lock writes');
 assert.equal(session.calls.writes,0);
 assert.equal(disk.get(KEY),invalid,'Never overwrite damaged original storage');
 assert.ok(session.calls.notices.some(m=>/nejistý/i.test(m)),'Warn about unsafe storage');
});
scenario('uncertain write locks another metadata save and external/local ZIP',()=>{
 const rows=[makeReport(1),makeReport(2),makeReport(3)],disk=data(rows);
 const session=boot(disk,{fault:'readback-once'});
 session.click('fb-001');
 const confirmed=JSON.stringify([rows[1],rows[2]]);
 assert.equal(disk.get(KEY),confirmed,'First write reached storage despite readback failure');
 const submitted=[rows[1],{...rows[2],title:'Another edit'}];
 assert.equal(session.commit(submitted),false,'A later metadata edit must not overwrite uncertain storage');
 session.exportBatch(false);session.exportBatch(true);
 assert.equal(session.calls.nativeCalls,0,'Neither external share nor local ZIP may export stale RAM');
 assert.equal(session.calls.writes,1,'No second storage writes');
 assert.equal(disk.get(KEY),confirmed,'Keep confirmed disk contents');
 const reboot=boot(disk);
 assert.equal(reboot.commit(submitted),true,'After successful reload, edits are allowed');
 assert.deepEqual(fromDisk(disk),submitted);
});
scenario('mixed malformed legacy array cannot silently discard an entry on next save',()=>{
 const items=[null,...Array.from({length:300},(_,i)=>makeReport(i))];
 const disk=data(items),previous=disk.get(KEY);
 const session=boot(disk);
 assert.equal(session.read().length,300,'Valid reports remain visible to aid recovery');
 assert.equal(session.commit(session.read().slice(1)),false,'Block rewrite of mixed unsupported legacy data');
 assert.equal(disk.get(KEY),previous,'Never erase the malformed entry without owner consent');
 assert.ok(session.calls.notices.some(m=>/nejistý/i.test(m)));
 assert.deepEqual(boot(disk).read(),session.read());
});
scenario('untrusted report IDs may not reach external/local share',()=>{
 const wrong={...makeReport(1),id:{toString:null,valueOf:null}},other=makeReport(2);
 const disk=data([wrong,other]);
 const session=boot(disk);
 session.exportBatch(false);session.exportBatch(true);
 assert.equal(session.calls.nativeCalls,0,'Malformed ID must not be sent to native share or save bridge');
 assert.equal(session.calls.prompts.length,0,'Refuse malformed identity before external share consent');
 assert.ok(session.calls.notices.some(m=>/neplatné|duplicit|ID/i.test(m)),'Explain refusal');
 assert.deepEqual(fromDisk(disk),[wrong,other]);
});
scenario('ambiguous duplicate IDs cannot reach Native ZIP without review',()=>{
 const a=makeReport(1),b=makeReport(2);
 b.id=a.id;
 const disk=data([a,b]);
 const session=boot(disk);
 session.exportBatch(false);session.exportBatch(true);
 assert.equal(session.calls.nativeCalls,0,'Duplicate report identity must not be exported');
 assert.equal(session.calls.prompts.length,0,'Reject before sharing dialog');
 assert.ok(session.calls.notices.some(m=>/duplicit/i.test(m)));
 assert.deepEqual(fromDisk(disk),[a,b]);
});
scenario('malformed legacy description cannot crash or disclose unreviewed ZIP',()=>{
 const a={...makeReport(1),title:'',description:{toString:null,valueOf:null}},b=makeReport(2);
 const disk=data([a,b]),session=boot(disk);
 session.exportBatch(false);
 assert.equal(session.calls.nativeCalls,0,'Malformed legacy text must not reach Native');
 assert.equal(session.calls.prompts.length,0,'Do not show misleading confirmation after invalid metadata');
 assert.ok(session.calls.notices.some(m=>/neplatn/i.test(m)),'Explain invalid report text');
 assert.deepEqual(fromDisk(disk),[a,b]);
});
scenario('uncertain storage cannot create a new orphan screenshot via purple flag',()=>{
 const rows=[makeReport(1),makeReport(2)],disk=data(rows);
 const session=boot(disk,{fault:'readback-once'});
 session.click('fb-001');
 assert.deepEqual(fromDisk(disk),[rows[1]],'First delete committed with uncertain readback');
 session.startCapture();
 assert.equal(session.calls.nativeCalls,0,'Do not capture screenshot when subsequent report save is blocked');
 assert.ok(session.calls.notices.some(m=>/nejistý/i.test(m)));
 assert.deepEqual(fromDisk(disk),[rows[1]],'Do not alter confirmed data');
});
scenario('one normal report: explicit confirmation deletes only selected ID',()=>{
 const rows=[makeReport(1),makeReport(2),makeReport(3)],disk=data(rows);
 const session=boot(disk);
 session.click('fb-002');
 assert.equal(session.calls.prompts.length,1);
 assert.equal(session.calls.writes,1);
 assert.deepEqual(fromDisk(disk),[rows[0],rows[2]]);
 assert.equal(session.calls.nativeCalls,0,'Delete must never touch native/media bridge');
});
if(failures.length){console.error(failures.join('\n'));process.exitCode=1}
else console.log('PASS: 17 feedback deletion integrity scenarios, no media writes');
