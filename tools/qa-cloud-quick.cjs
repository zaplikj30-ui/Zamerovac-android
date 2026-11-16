'use strict';
// Exact source-code QUICK registry; no grep of "PASS" from arbitrary console text.
// Node's structured test protocol is already used by the existing HOME4 tool;
// cloud invokes the same reporter in isolated, bounded non-browser child tests.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const registry=require('./qa/home4-quick.json');
const root=path.resolve(__dirname,'..');
const EXTRA=['tests/qa_cloud_admission.js','tests/qa_cloud_workflow_policy.js','tests/qa_cloud_runtime_guard.js'];
function demand(ok){if(!ok)throw Error('QA CLOUD QUICK BLOCKED: registry or case result');}
function checkFiles(){
 const names=fs.readdirSync(path.join(root,'tests'),{withFileTypes:true})
  .filter(e=>e.name.endsWith('.js')).map(e=>{demand(e.isFile()&&!e.isSymbolicLink());return 'tests/'+e.name}).sort();
 const expected=[...Object.keys(registry.node),...EXTRA].sort();
 demand(new Set(expected).size===expected.length);
 demand(JSON.stringify(names)===JSON.stringify(expected));
 demand(Object.keys(registry.node).length===74);
 const caseNames=Object.values(registry.node).flatMap(x=>x.cases);
 demand(caseNames.length===190&&new Set(caseNames).size===190);
 return expected;
}
function runGroup(file){
 const args=['--test','--test-reporter=./tools/qa/home4-node-reporter.cjs',file];
 const result=cp.spawnSync(process.execPath,args,{cwd:root,encoding:'utf8',shell:false,
  timeout:120000,maxBuffer:2*1024*1024,
  env:{...process.env,CI:'1',PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}});
 demand(result.status===0&&!result.error&&!result.signal&&!result.stderr);
 const envelope=JSON.parse(result.stdout.trim());
 demand(envelope.protocol==='home4-node-v1'&&envelope.complete===true&&Array.isArray(envelope.cases));
 const item=registry.node[file];
 const seen=envelope.cases.map(c=>c.id),optional=item?.linuxNotRun||[];
 if(item){
  demand(seen.length===item.cases.length&&new Set(seen).size===seen.length);
  demand(JSON.stringify(seen.slice().sort())===JSON.stringify(item.cases.slice().sort()));
  demand(envelope.cases.every(c=>c.status==='PASS'||(optional.includes(c.id)&&c.status==='SKIP')));
  return {passed:envelope.cases.filter(c=>c.status==='PASS').length,
   platformNotRun:envelope.cases.filter(c=>c.status==='SKIP').length};
 }
 demand(envelope.cases.length>0&&envelope.cases.every(c=>c.status==='PASS'));
 return {passed:envelope.cases.length,platformNotRun:0};
}
function main(){
 demand(process.env.ZAMEROVAC_CLOUD_QUICK==='1'&&process.platform==='linux');
 const expected=checkFiles();let cases=0,skips=0;
 for(const file of expected){
  const result=runGroup(file);
  cases+=result.passed;skips+=result.platformNotRun;
  // Only names from the static reviewed test registry; no raw stdout/stderr.
  process.stdout.write('PASS/PLATFORM-SKIP '+file+'\n');
 }
 process.stdout.write('QA CLOUD QUICK named Node cases PASS='+cases+' PLATFORM_NOT_RUN='+skips+'\n');
}
if(require.main===module)try{main()}catch(error){
 process.stderr.write('BLOCKED cloud QUICK Node registry/case/exit (redacted)\n');
 process.exitCode=78;
}
module.exports={checkFiles,runGroup};
