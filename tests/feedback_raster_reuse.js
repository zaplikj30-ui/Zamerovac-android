/* Regression #53: unchanged annotated reports reuse their media; changed images still persist. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const start=source.indexOf(' async function saveReport(){');
const end=source.indexOf(' // Android Zpět',start);
assert.ok(start>=0&&end>start,'Actual saveReport() must be tested');
const implementation=source.slice(start,end);
const persistenceStart=source.indexOf(' const persist=next=>');
const persistenceEnd=source.indexOf('\n const q=',persistenceStart);
assert.ok(persistenceStart>=0&&persistenceEnd>persistenceStart,'Real persistence helper must be present');
const persistenceCode=source.slice(persistenceStart,persistenceEnd);
const deleteStart=source.indexOf("  overlay.querySelector('#feedbackDeleteResolved').onclick=()=>{");
const deleteEnd=source.indexOf("\n  overlay.querySelector('#feedbackShareZip')",deleteStart);
assert.ok(deleteStart>=0&&deleteEnd>deleteStart,'Real resolved-report deletion handler must be present');
const deleteCode=source.slice(deleteStart,deleteEnd);

function report(){
 return {id:'report_001',title:'Old',description:'Description',type:'bug',
  screenshotId:'original001',annotatedId:'raster001',resolved:false,
  annotations:[{type:'rect',points:[[0.1,0.2],[0.4,0.5]]}],videos:[]};
}
async function scenario({stored=report(),change,blobNull=false,finishOk=true,storageFailure=null}={}){
 const reports=stored?[JSON.parse(JSON.stringify(stored))]:[];
 const edited=stored?JSON.parse(JSON.stringify(stored)):report();
 if(!stored){edited.id='report_002';edited.annotatedId=null;}
 if(change)change(edited);
 const calls={blob:0,begin:0,append:0,finish:0,persist:0,list:0,errors:[]};
 const KEY='zamerovac-feedback-v1';
 const disk=new Map([[KEY,JSON.stringify(reports)]]);
 const localStorage={
  setItem(key,value){
   calls.persist++;
   if(storageFailure==='write')throw new Error('Storage quota exceeded');
   if(storageFailure!=='ignored')disk.set(key,value);
  },
  getItem(key){
   if(storageFailure==='read')throw new Error('Failed readback');
   return disk.get(key)||null;
  }
 };
 const fields={
  '#feedbackType':{value:edited.type},
  '#feedbackTitle':{value:edited.title},
  '#feedbackDescription':{value:edited.description},
  '#feedbackResolved':{checked:edited.resolved},
  '#feedbackSave':{disabled:false,textContent:'Uložit připomínku'}
 };
 const scope={
  active:{report:edited,image:{naturalWidth:100},canvas:{toBlob(cb,format){
   calls.blob++;assert.equal(format,'image/png');
   cb(blobNull?null:{arrayBuffer:async()=>Uint8Array.from([1,2,3,4]).buffer});
  }}},
  overlay:{querySelector:s=>fields[s]||null},
  reports,busy:false,native:true,KEY,localStorage,
  validId:s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(s),
  now:()=> '2026-11-07T00:00:00.000Z',
  makeId:()=> 'newRaster001',
  notify:msg=>calls.errors.push(msg),
  showReportList:()=>{calls.list++},
  Native:{
   beginMediaChecked:(id,mime,name,length)=>{calls.begin++;assert.equal(id,'newRaster001');assert.equal(mime,'image/png');assert.ok(length>0);return true;},
   appendMedia:()=>{calls.append++;return true;},
   finishMedia:()=>{calls.finish++;return finishOk;}
  },
  Uint8Array,btoa,console
 };
 vm.createContext(scope);
 vm.runInContext(persistenceCode,scope);
 vm.runInContext(implementation,scope);
 await vm.runInContext('saveReport()',scope);
 return {reports:scope.reports,calls,edited,scope,fields,disk};
}
(async()=>{
 // The observed case: change only the status of a large existing screenshot.
 let s=await scenario({change:r=>{r.resolved=true;r.title='Resolved';}});
 assert.equal(s.calls.blob,0,'Status-only save must not recompress PNG');
 assert.equal(s.calls.begin,0,'Status-only save must not upload duplicate media');
 assert.equal(s.calls.persist,1,'Status-only save must persist metadata');
 assert.equal(s.reports.length,1,'Status-only save must not duplicate reports');
 assert.equal(s.reports[0].annotatedId,'raster001','Existing raster reference must survive');
 assert.equal(s.reports[0].resolved,true);

 s=await scenario({change:r=>{r.description='Changed text';}});
 assert.equal(s.calls.blob,0,'Description-only save must reuse the image');
 assert.equal(s.calls.persist,1);

 s=await scenario({change:r=>r.annotations.push({type:'arrow',points:[[0,0],[1,1]]})});
 assert.equal(s.calls.blob,1,'Annotation changes must produce a fresh PNG');
 assert.equal(s.calls.begin,1);
 assert.equal(s.calls.append,1);
 assert.equal(s.calls.finish,1);
 assert.equal(s.reports[0].annotatedId,'newRaster001');
 assert.equal(s.reports[0].annotations.length,2);

 s=await scenario({change:r=>{r.screenshotId='anotherOriginal';}});
 assert.equal(s.calls.blob,1,'Changed original image must trigger a new raster');

 s=await scenario({stored:null});
 assert.equal(s.calls.blob,1,'New reports must get their first annotated image');

 s=await scenario({change:r=>r.annotations.push({type:'text',text:'new',points:[[0,0]]}),blobNull:true});
 assert.equal(s.calls.persist,0,'A missing generated image must not falsely save changed annotations');
 assert.equal(s.calls.list,0);
 assert.equal(s.reports[0].annotatedId,'raster001','Failed save must preserve old metadata');
 assert.equal(s.scope.busy,false);
 assert.equal(s.fields['#feedbackSave'].disabled,false);

 s=await scenario({change:r=>r.annotations.push({type:'text',text:'new',points:[[0,0]]}),finishOk:false});
 assert.equal(s.calls.persist,0,'Failed native media finish must prevent metadata publication');
 assert.equal(s.reports[0].annotatedId,'raster001');
 assert.equal(s.scope.busy,false);
 // Actual localStorage failures must preserve the previous confirmed list and
 // keep the unsaved draft on screen instead of displaying a false success.
 for(const storageFailure of ['write','ignored','read']){
  s=await scenario({change:r=>{r.title='Rozpracovaná připomínka';r.resolved=true},storageFailure});
  assert.equal(s.calls.persist,1,'Exactly one storage attempt');
  assert.equal(s.reports[0].title,'Old','Failed storage must not replace the in-memory confirmed report');
  assert.equal(s.reports[0].resolved,false);
  assert.equal(s.calls.list,0,'Failed storage must leave the edit dialog open');
  assert.equal(s.fields['#feedbackSave'].disabled,false,'User must be able to retry');
  assert.equal(s.scope.active.report.title,'Rozpracovaná připomínka','Unsaved draft must stay editable');
  assert.equal(s.scope.busy,false);
  assert.ok(!s.calls.errors.includes('Připomínka uložena'),'False storage success');
  assert.ok(s.calls.errors.some(x=>x.includes('nepodařilo uložit')),'Failure must be visible');
 }
 s=await scenario({stored:null,storageFailure:'write'});
 assert.equal(s.reports.length,0,'Failed first save must not create a ghost report');
 assert.equal(s.calls.list,0);
 assert.ok(s.scope.active.report.annotatedId,'Generated media remains recoverable in the draft for retry');
 // The resolved-delete action must not lose records if localStorage refuses
 // to acknowledge deletion. Use the actual handler and the same persistence.
 const deleted={...report(),resolved:true};
 for(const storageFailure of ['write','ignored']){
  const previous=[deleted,{...report(),id:'report_002',resolved:false}];
  const disk=new Map([['zamerovac-feedback-v1',JSON.stringify(previous)]]);
  const calls={list:0,errors:[]};
  const button={dataset:{confirm:'yes'},textContent:'Smazat vyřešené'};
  const ctx={reports:previous,KEY:'zamerovac-feedback-v1',notify:m=>calls.errors.push(m),
   showReportList:()=>{calls.list++},overlay:{querySelector:()=>button},
   localStorage:{
    setItem:(k,v)=>{if(storageFailure==='write')throw new Error('quota');if(storageFailure!=='ignored')disk.set(k,v)},
    getItem:k=>disk.get(k)||null
   }
  };
  vm.createContext(ctx);
  vm.runInContext(persistenceCode,ctx);
  vm.runInContext(deleteCode,ctx);
  vm.runInContext("overlay.querySelector('#feedbackDeleteResolved').onclick()",ctx);
  assert.equal(ctx.reports.length,2,'Failed deletion must retain confirmed records');
  assert.equal(calls.list,0,'Failed deletion must not close the list');
  assert.ok(calls.errors.some(x=>x.includes('Nepodařilo se uložit')),'Deletion failure must be reported');
 }
 console.log('PASS: feedback raster reuse, transactional localStorage save/readback, failed writes, draft retention and safe deletion');
})().catch(e=>{console.error(e);process.exitCode=1});
