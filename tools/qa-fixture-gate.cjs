'use strict';
// Run only after the enclosing owner/ref/SHA/clean-checkout trust gate.
// No TAP files, shell interpolation, caller-supplied suite or expected counts.
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const {evaluateTap,formatReport,maxTapBytes}=require('./qa-fixture-tap.cjs');
function main(){
 let child={};
 if(process.argv.length===2){
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
