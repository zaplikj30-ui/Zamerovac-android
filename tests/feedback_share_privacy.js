/* Feedback export: executable JS consent contract + native source guards.
 * Native source checks are STRUCTURAL, not a substitute for Android runtime tests.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const native=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const begin=source.indexOf(' function sendBatch(saveToFile){');
const end=source.indexOf('\n window.onReportBundleSaved=',begin);
assert.ok(begin>=0&&end>begin,'Test must execute the real sendBatch handler');
const actual=source.slice(begin,end);
function run(saveToFile,approved,hasSave=true,selected=true){
 const calls={asked:[],shared:[],saved:[],notices:[]};
 const report={id:'report-001',title:'Chyba kóty',description:'Tajný text ve snímku',screen:'Editor',
  screenshotId:'image-001',annotatedId:'image-002',videos:[{id:'video-001',name:'rodinne-video.mp4',mime:'video/mp4'}]};
 const ctx={native:true,Native:{
  shareIssueBundle:x=>calls.shared.push(JSON.parse(x)),
  ...(hasSave?{saveIssueBundle:x=>calls.saved.push(JSON.parse(x))}:{})
 },window:{confirm:t=>{calls.asked.push(t);return approved}},
 selectedReports:()=>selected?[report]:[],notify:m=>calls.notices.push(m),now:()=> '2026-11-19T00:00:00Z'};
 vm.createContext(ctx);vm.runInContext(actual,ctx);vm.runInContext('sendBatch('+saveToFile+')',ctx);
 return calls;
}
let s=run(false,false);
assert.equal(s.asked.length,1,'Share must request explicit, informed review');
assert.match(s.asked[0],/Chyba kóty/,'Review must name each report');
assert.match(s.asked[0],/rodinne-video/,'Review must name video attachments');
assert.match(s.asked[0],/snímk|obrázk|fotograf/i,'Review must warn about visible screenshots');
assert.equal(s.shared.length,0,'Cancel must not transmit a bundle');
s=run(false,true);
assert.equal(s.shared.length,1,'Explicit approval shares exactly once');
assert.equal(s.saved.length,0);
s=run(true,false);
assert.equal(s.asked.length,0,'Saving a local ZIP does not need external-sharing consent');
assert.equal(s.saved.length,1,'Local save still works');
s=run(true,true,false);
assert.equal(s.saved.length,0,'Never call missing native save bridge');
assert.ok(s.notices.length>0,'Missing save function must show a message');
s=run(false,true,true,false);
assert.equal(s.asked.length,0,'No reports: no share prompt');
assert.equal(s.shared.length,0,'No reports: no share');
assert.match(native,/MAX_ISSUE_BUNDLE_BYTES/,'Native bundle size preflight must exist');
assert.match(native,/checkedIssueMedia/,'Native must fail closed for missing attachments');
assert.match(native,/issuezip-/,'Temporary ZIP files must have a dedicated namespace');
assert.match(native,/deleteIssueZip/,'Temporary ZIP cleanup must be implemented');
assert.match(native,/sanitizedReports/,'Published JSON must be explicitly sanitized');
console.log('PASS: feedback share consent/cancel, local save, missing method and native source guards');
