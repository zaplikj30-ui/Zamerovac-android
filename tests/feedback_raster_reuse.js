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

function report(){
 return {id:'report_001',title:'Old',description:'Description',type:'bug',
  screenshotId:'original001',annotatedId:'raster001',resolved:false,
  annotations:[{type:'rect',points:[[0.1,0.2],[0.4,0.5]]}],videos:[]};
}
async function scenario({stored=report(),change,blobNull=false,finishOk=true}={}){
 const reports=stored?[JSON.parse(JSON.stringify(stored))]:[];
 const edited=stored?JSON.parse(JSON.stringify(stored)):report();
 if(!stored){edited.id='report_002';edited.annotatedId=null;}
 if(change)change(edited);
 const calls={blob:0,begin:0,append:0,finish:0,persist:0,list:0,errors:[]};
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
  reports,busy:false,native:true,
  validId:s=>typeof s==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(s),
  now:()=> '2026-11-07T00:00:00.000Z',
  makeId:()=> 'newRaster001',
  notify:msg=>calls.errors.push(msg),
  persist:()=>{calls.persist++},
  showReportList:()=>{calls.list++},
  Native:{
   beginMediaChecked:(id,mime,name,length)=>{calls.begin++;assert.equal(id,'newRaster001');assert.equal(mime,'image/png');assert.ok(length>0);return true;},
   appendMedia:()=>{calls.append++;return true;},
   finishMedia:()=>{calls.finish++;return finishOk;}
  },
  Uint8Array,btoa,console
 };
 vm.createContext(scope);
 vm.runInContext(implementation,scope);
 await vm.runInContext('saveReport()',scope);
 return {reports,calls,edited,scope,fields};
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
 console.log('PASS: feedback #53 raster reuse, metadata, changed annotations, failed media writes');
})().catch(e=>{console.error(e);process.exitCode=1});
