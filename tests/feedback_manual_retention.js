/* New owner contract: manually delete one stored report, preserve originals,
 * never auto-expire a ZIP handed to ACTION_SEND without acknowledgement.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const java=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const listStart=source.indexOf(' function showReportList(){');
const listEnd=source.indexOf('\n function sendBatch(saveToFile){',listStart);
const persistStart=source.indexOf(' const persist=next=>');
const persistEnd=source.indexOf('\n const q=',persistStart);
assert.ok(listStart>=0&&listEnd>listStart&&persistStart>=0&&persistEnd>persistStart);
const listCode=source.slice(listStart,listEnd),persistCode=source.slice(persistStart,persistEnd);
function caseOf({confirmed,storageFails=false}){
 const report={id:'fb-001',title:'Staré hlášení',description:'Popis',resolved:false,screen:'Editor',
  createdAt:'2026-11-01T00:00:00Z',videos:[{id:'video001'}]};
 const second={...report,id:'fb-002',title:'Novější hlášení'};
 const original=[report,second];
 const KEY='zamerovac-feedback-v1';
 const disk=new Map([[KEY,JSON.stringify(original)]]);
 const calls={prompt:0,notices:[],markup:'',deletes:[],nativeCalls:[]};
 const buttons=new Map();
 const overlay={querySelector(selector){
  if(!buttons.has(selector))buttons.set(selector,{dataset:{},textContent:''});
  return buttons.get(selector);
 },querySelectorAll(selector){
  if(selector==='[data-feedback-delete]')return calls.deletes;
  return [];
 }};
 const context={reports:original,overlay,KEY,
  localStorage:{
   getItem:k=>disk.get(k),
   setItem:(k,v)=>{if(storageFails)throw new Error('Disk full');disk.set(k,v)}
  },
  q:s=>String(s),summary:r=>r.title,notify:m=>calls.notices.push(m),
  makeOverlay:markup=>{calls.markup=markup;
   calls.deletes=[{dataset:{feedbackDelete:'fb-001'}}];
  },
  window:{confirm:()=>{calls.prompt++;return confirmed}},
  closeOverlay:()=>{},showReportList:null,sendBatch:()=>{},
 };
 vm.createContext(context);
 vm.runInContext(persistCode,context);
 vm.runInContext(listCode,context);
 vm.runInContext('showReportList()',context);
 assert.match(calls.markup,/data-feedback-delete="fb-001"/);
 calls.deletes[0].onclick();
 return {calls,reports:context.reports,disk,KEY};
}
let t=caseOf({confirmed:false});
assert.equal(t.calls.prompt,1);
assert.equal(t.reports.length,2,'Cancel must retain both reports');
t=caseOf({confirmed:true});
assert.equal(t.reports.length,1,'Delete one report only');
assert.equal(t.reports[0].id,'fb-002');
assert.equal(JSON.parse(t.disk.get(t.KEY)).length,1,'Persistent list must match');
t=caseOf({confirmed:true,storageFails:true});
assert.equal(t.reports.length,2,'Failed storage must keep both reports');
assert.equal(JSON.parse(t.disk.get(t.KEY)).length,2);
assert.match(t.calls.notices.join(' '),/Nepodařilo se uložit/);

const cleanupStart=java.indexOf('    private void cleanupIssueZips(){');
const cleanupEnd=java.indexOf('    /** Preflight all selected attachments',cleanupStart);
assert.ok(cleanupStart>0&&cleanupEnd>cleanupStart);
const autoCleanup=java.slice(cleanupStart,cleanupEnd);
assert.match(autoCleanup,/issuezip-state-/);
assert.match(autoCleanup,/building|ready/);
assert.doesNotMatch(autoCleanup,/\.equals\("shared"\)/,'Share-pending ZIP must never be auto-deleted by age');
assert.match(java,/@JavascriptInterface public void cleanupFinishedIssueBundles\(/);
assert.match(java,/AlertDialog\.Builder/,'Manual shared-ZIP cleanup needs native confirmation');
assert.match(java,/pendingIssueZipId!=null/,'Must not cleanup during pending local export');
assert.doesNotMatch(listCode,/mediaFile\(|deleteMedia\(/,'Deleting report must never delete any source media');
console.log('PASS: confirmed individual report deletion, cancel, disk-full, shared ZIP safety and original preservation checks');
