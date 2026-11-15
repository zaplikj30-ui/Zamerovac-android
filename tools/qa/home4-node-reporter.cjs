'use strict';
// Node's supported structured test-event stream, not a grep of console output.
module.exports=async function*(events){
 const cases=[];let summary=null,valid=true;
 for await(const event of events){
  const d=event.data;
  if(event.type==='test:pass'||event.type==='test:fail'){
   if(d.nesting!==0||d.details?.type!=='test'||typeof d.name!=='string'||d.name.length>512||cases.length>=5000)valid=false;
   cases.push({id:String(d.name).replaceAll('\\','/'),status:d.skip?'SKIP':d.todo?'TODO':event.type==='test:pass'?'PASS':'FAIL'});
  }
  if(event.type==='test:summary'&&!d.file){if(summary)valid=false;summary=d.counts}
 }
 const states=Object.fromEntries(['PASS','FAIL','SKIP','TODO'].map(s=>[s,cases.filter(c=>c.status===s).length]));
 valid=valid&&!!summary&&new Set(cases.map(c=>c.id)).size===cases.length&&summary.tests===cases.length&&summary.topLevel===cases.length
  &&summary.passed===states.PASS&&summary.failed===states.FAIL&&summary.skipped===states.SKIP&&summary.todo===states.TODO
  &&summary.cancelled===0&&summary.suites===0;
 yield JSON.stringify({protocol:'home4-node-v1',complete:valid,cases,counts:states})+'\n';
};
