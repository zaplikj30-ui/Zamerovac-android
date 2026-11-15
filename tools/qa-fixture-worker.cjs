'use strict';
// Internal payload: the public gate runs this only inside the existing owned
// supervisor. Its stdout contains only the redacted TAP verdict, never raw TAP.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {evaluateTap,formatReport,maxTapBytes}=require('./qa-fixture-tap.cjs');
function main(){
 let child={};
 const backend=process.platform==='win32'?'windows-private-job':'linux-pidfd-subreaper';
 if(process.argv.length===2&&process.env.ZAMEROVAC_SUPERVISOR_PID===String(process.ppid)&&process.env.ZAMEROVAC_SCOPE===backend){
  try{
   child=spawnSync(process.execPath,['--test','--test-reporter=tap',path.join(__dirname,'../tests/home_qa_integrity.js')],{
    cwd:path.join(__dirname,'..'),shell:false,windowsHide:true,
    stdio:['ignore','pipe','pipe'],maxBuffer:maxTapBytes,timeout:120000,
   });
  }catch{child={error:true}}
 }
 const report=evaluateTap(child.stdout,child);
 process.stdout.write(formatReport(report));
 process.exitCode=report.status==='PASS'?0:1;
}
if(require.main===module)main();
module.exports={main};
