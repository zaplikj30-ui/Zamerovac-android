'use strict';
// Exact source-code QUICK registry; no grep of "PASS" from arbitrary console text.
// Node's structured test protocol is already used by the existing HOME4 tool;
// cloud invokes the same reporter in isolated, bounded non-browser child tests.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const registry=require('./qa/home4-quick.json');
const root=path.resolve(__dirname,'..');
const EXTRA=['tests/qa_cloud_admission.js','tests/qa_cloud_workflow_policy.js','tests/qa_cloud_runtime_guard.js','tests/qa_cloud_cleanup_gate.js'];
// Reviewed, exact TAP names for each EXTRA file. Never infer names from its stdout.
const EXTRA_CASES=Object.freeze({
  "tests/qa_cloud_admission.js": [
    "cloud model uses reviewed P/V/E without inheriting HOME guard",
    "all owner/ref/event/P/V/E/sudo-trust negative mutations fail before any launch",
    "cloud original 67-pin manifest and all 23/96 content names are unchanged"
  ],
  "tests/qa_cloud_workflow_policy.js": [
    "only inert owner/main public hosted dispatch with pinned P/V/E and no installs/outputs",
    "time arithmetic fits job without shrinking 23/96 or cleanup time",
    "negative mutations reject activation, native after UNKNOWN, install or other runner",
    "EXTRA Node exact TAP registry rejects every false-PASS mutation",
    "real Node test reporter rejects empty auto-PASS and requires exact EXTRA TAP names"
  ],
  "tests/qa_cloud_runtime_guard.js": [
    "unreviewed R blocks before touching config file or launching Python",
    "typed command guards forbid a fake/nonbrowser/flagged/preload launch without spawn",
    "hosted R manifest stays deliberately unapproved until independent inventory",
    "Playwright nested core resolution must match approved root core before import",
    "B1 all four historical guards and exact 23 c7 suites resolve without git history",
    "B1 missing, wrong bytes, wrong tree SHA, symlink and hardlink cannot be historical PASS"
  ],
  "tests/qa_cloud_cleanup_gate.js": [
    "full reviewed failure is a real FAIL, never a 23/96 PASS",
    "missing/renamed/stale/counterfeit/partial suite never obtains safe-failure proof"
  ]
});
function demand(ok){if(!ok)throw Error('QA CLOUD QUICK BLOCKED: registry or case result');}
function checkFiles(){
 const names=fs.readdirSync(path.join(root,'tests'),{withFileTypes:true})
  .filter(e=>e.name.endsWith('.js')).map(e=>{demand(e.isFile()&&!e.isSymbolicLink());return 'tests/'+e.name}).sort();
 const expected=[...Object.keys(registry.node),...EXTRA].sort();
 demand(new Set(expected).size===expected.length);
 demand(JSON.stringify(names)===JSON.stringify(expected));
 demand(JSON.stringify(Object.keys(EXTRA_CASES).sort())===JSON.stringify(EXTRA.slice().sort()));
 const extraNames=Object.values(EXTRA_CASES).flat();
 demand(extraNames.length===16&&new Set(extraNames).size===extraNames.length);
 demand(Object.values(EXTRA_CASES).every(c=>Array.isArray(c)&&c.length>0));
 demand(Object.keys(registry.node).length===74);
 const caseNames=Object.values(registry.node).flatMap(x=>x.cases);
 demand(caseNames.length===190&&new Set(caseNames).size===190);
 return expected;
}
function checkExtraEnvelope(file,envelope){
 const expected=EXTRA_CASES[file];
 demand(Object.hasOwn(EXTRA_CASES,file)&&Array.isArray(expected)&&expected.length>0);
 demand(envelope&&envelope.protocol==='home4-node-v1'&&envelope.complete===true&&
  Array.isArray(envelope.cases)&&envelope.cases.length===expected.length);
 const ids=envelope.cases.map(c=>c?.id);
 demand(ids.every(id=>typeof id==='string'&&id.length>0&&id.length<=512)&&
  new Set(ids).size===ids.length);
 demand(JSON.stringify(ids.slice().sort())===JSON.stringify(expected.slice().sort()));
 demand(envelope.cases.every(c=>c?.status==='PASS'));
 const counts=envelope.counts;
 demand(counts&&typeof counts==='object'&&!Array.isArray(counts)&&
  JSON.stringify(Object.keys(counts).sort())===JSON.stringify(['FAIL','PASS','SKIP','TODO'])&&
  counts.PASS===expected.length&&counts.FAIL===0&&counts.SKIP===0&&counts.TODO===0);
 // A Node file-level auto-PASS reports the filename rather than a declared test
 // name. The exact set above therefore rejects even a clean zero-test file.
 return {passed:expected.length,platformNotRun:0};
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
 return checkExtraEnvelope(file,envelope);
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
module.exports={checkFiles,runGroup,checkExtraEnvelope,EXTRA_CASES};
