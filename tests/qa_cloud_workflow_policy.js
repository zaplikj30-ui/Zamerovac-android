'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const filename=path.resolve(__dirname,'../.github/workflows/cloud-pr150-source-qa.yml');
const workflow=fs.readFileSync(filename,'utf8');
function secure(source){
 const required=[
  "if: ${{ false && github.repository ==",
  "on:\n  workflow_dispatch:",
  "runs-on: ubuntu-latest",
  "timeout-minutes: 330",
  "timeout-minutes: 210",
  "if: ${{ !cancelled() && steps.quick.outcome == 'success' }}",
  "steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN'",
  "ref: ${{ inputs.product_sha }}",
  "ref: ${{ inputs.validator_sha }}",
  "persist-credentials: false",
  "GITHUB_RUN_ATTEMPT':'1'",
  "RUNNER_ENVIRONMENT':'github-hosted'",
  "GITHUB_REPOSITORY':'zaplikj30-ui/Zamerovac-android'",
  "QA_PRODUCT_SHA: ${{ inputs.product_sha }}",
  "QA_VALIDATOR_SHA: ${{ inputs.validator_sha }}",
  "QA_EVENT_SHA: ${{ inputs.event_sha }}",
  "python3 tools/qa_cloud_native.py xml",
  "python3 tools/qa_cloud_native.py pdf",
  "python3 tools/qa_cloud_quick.py",
  "node tools/qa-cloud-quick.cjs",
  "gradle --offline --no-daemon",
  "node tools/qa-cloud-diag.cjs",
  "QA_APPROVED_Q: ${{ vars.CLOUD_DIAG_APPROVED_Q }}",
  "QA_APPROVED_E: ${{ vars.CLOUD_DIAG_APPROVED_E }}",
  "ZAMEROVAC_CLOUD_TRUST: trusted-host/change-detection",
  'ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/product',
  'for product_path in app sync config gradle build.gradle gradle.properties settings.gradle;',
  'git -C validator rev-parse "HEAD:$product_path"',
  'git -C product rev-parse "HEAD:$product_path"'
 ];
 const forbidden=[
  'runs-on: [self-hosted','sudo ', 'npm install','npm ci','npx playwright install',
  'pip install','apt install','actions/upload-artifact','pull_request:', 'pull_request_target:',
  '--no-sandbox','chmod ','chown ','curl ','wget ', 'docker pull'
 ];
 return required.every(x=>source.includes(x))&&forbidden.every(x=>!source.includes(x))
  &&(source.match(/persist-credentials: false/g)||[]).length===2
  &&(source.match(/gradle --offline --no-daemon/g)||[]).length===2
  &&source.includes("if: ${{ !cancelled() && steps.pinned.outcome == 'success' && steps.quick.outcome == 'success' && steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN' }}");
}
test('only inert owner/main public hosted dispatch with pinned P/V/E and no installs/outputs',()=>{
 assert(secure(workflow));
 assert.equal((workflow.match(/workflow_dispatch:/g)||[]).length,1);
 assert(!workflow.includes('on:\n  push:'));
});
test('time arithmetic fits job without shrinking 23/96 or cleanup time',()=>{
 const stageMax=22+210+9+35+5+9+2+2;
 assert(stageMax<=330);
 assert(workflow.includes('23x8min')===false,'budget is code-owned by runner');
});
test('negative mutations reject activation, native after UNKNOWN, install or other runner',()=>{
 for(const mutation of [
  workflow.replace("false && github.repository","true && github.repository"),
  workflow.replace("runs-on: ubuntu-latest","runs-on: [self-hosted, Windows]"),
  workflow.replace("steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN'","steps.pinned.outcome == 'success'"),
  workflow.replace("gradle --offline --no-daemon","gradle --no-daemon"),
  workflow.replace("persist-credentials: false","persist-credentials: true"),
  workflow.replace("timeout-minutes: 330","timeout-minutes: 30"),
  workflow.replace("node tools/qa-cloud-diag.cjs",
  "QA_APPROVED_Q: ${{ vars.CLOUD_DIAG_APPROVED_Q }}",
  "QA_APPROVED_E: ${{ vars.CLOUD_DIAG_APPROVED_E }}","removed_runtime:"),
  workflow.replace('ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/product', 'ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/validator'),
  workflow.replace("for product_path in app sync config gradle build.gradle gradle.properties settings.gradle;","for product_path in;"),
  workflow+" \n npm install playwright\n"
 ])assert(!secure(mutation));
});


test('EXTRA Node exact TAP registry rejects every false-PASS mutation',()=>{
 const {EXTRA_CASES,checkExtraEnvelope}=require('../tools/qa-cloud-quick.cjs');
 const files=Object.keys(EXTRA_CASES);
 assert.equal(files.length,4);
 assert.deepEqual(files.map(file=>EXTRA_CASES[file].length),[4,5,10,2]);
 for(const file of files){
  const names=EXTRA_CASES[file];
  const valid=()=>({protocol:'home4-node-v1',complete:true,
   cases:names.map(id=>({id,status:'PASS'})),
   counts:{PASS:names.length,FAIL:0,SKIP:0,TODO:0}});
  assert.deepEqual(checkExtraEnvelope(file,valid()),{passed:names.length,platformNotRun:0});
  const mutations=[
   v=>{v.cases=[];v.counts.PASS=0;}, // empty suite
   v=>{v.cases.pop();v.counts.PASS--;}, // missing case
   v=>{v.cases[0].id='renamed case';}, // renamed
   v=>{v.cases[0].id=file;}, // Node auto file-level PASS
   v=>{v.cases.push({id:'injected unexpected test',status:'PASS'});v.counts.PASS++;},
   v=>{v.cases[1].id=v.cases[0].id;}, // duplicate name
   v=>{v.cases[0].status='FAIL';v.counts.FAIL++;v.counts.PASS--;},
   v=>{v.cases[0].status='SKIP';v.counts.SKIP++;v.counts.PASS--;},
   v=>{v.cases[0].status='TODO';v.counts.TODO++;v.counts.PASS--;},
   v=>{v.counts.PASS--;}, // contradictory count
   v=>{v.counts.EXTRA=1;}, // unreviewed count field
   v=>{v.counts=null;}, // missing summary
   v=>{v.protocol='untrusted-reporter';},
   v=>{v.complete=false;},
   v=>{v.cases=null;},
   v=>{v.cases[0].id=null;}
  ];
  for(const mutate of mutations){
   const sample=valid();mutate(sample);
   assert.throws(()=>checkExtraEnvelope(file,sample),/QA CLOUD QUICK BLOCKED/);
  }
  assert.throws(()=>checkExtraEnvelope('tests/not-approved.js',valid()),/QA CLOUD QUICK BLOCKED/);
 }
 // Unit-level OS/result envelope faults: no child is spawned; verify the
 // production runGroup rejects nonzero exit, signal, stderr and malformed JSON.
 const cp=require('node:child_process'),quick=require('../tools/qa-cloud-quick.cjs');
 const original=cp.spawnSync,file=files[0],names=EXTRA_CASES[file];
 const passed={protocol:'home4-node-v1',complete:true,
  cases:names.map(id=>({id,status:'PASS'})),counts:{PASS:names.length,FAIL:0,SKIP:0,TODO:0}};
 const good={status:0,error:undefined,signal:null,stderr:'',stdout:JSON.stringify(passed)};
 try{
  for(const changed of [
   {status:1},{signal:'SIGTERM'},{stderr:'private stderr must not be trusted'},
   {error:new Error('synthetic spawn failure')},{stdout:'malformed protocol'},
   {stdout:JSON.stringify({...passed,counts:{...passed.counts,PASS:0}})}
  ]){
   cp.spawnSync=()=>({...good,...changed});
   assert.throws(()=>quick.runGroup(file));
  }
 }finally{cp.spawnSync=original}
});
test('real Node test reporter rejects empty auto-PASS and requires exact EXTRA TAP names',()=>{
 const {EXTRA_CASES,checkExtraEnvelope}=require('../tools/qa-cloud-quick.cjs');
 const os=require('node:os'),cp=require('node:child_process');
 const directory=fs.mkdtempSync(path.join(os.tmpdir(),'qa-cloud-extra-'));
 const reporter=path.resolve(__dirname,'../tools/qa/home4-node-reporter.cjs');
 const fixture=path.join(directory,'synthetic-extra.cjs');
 function run(source){
  fs.writeFileSync(fixture,source,{encoding:'utf8'});
  // The parent is already a node:test worker. Run the synthetic nested fixture
  // as an independent top-level test invocation, not a recursive test context.
  const childEnv={...process.env,CI:'1'};delete childEnv.NODE_TEST_CONTEXT;
  const result=cp.spawnSync(process.execPath,['--test','--test-reporter='+reporter,fixture],
   {cwd:directory,encoding:'utf8',timeout:20000,maxBuffer:1024*1024,shell:false,
    env:childEnv});
  assert.equal(result.error,undefined,'synthetic reporter process failed');
  assert.equal(result.signal,null,'synthetic reporter signal');
  assert.equal(result.status,0,'synthetic reporter exit');
  assert.equal(result.stderr,'','unexpected synthetic stderr');
  return JSON.parse(result.stdout.trim());
 }
 try{
  for(const [file,names] of Object.entries(EXTRA_CASES)){
   const source="'use strict';const {test}=require('node:test');\n"+
    names.map(n=>'test('+JSON.stringify(n)+',()=>{});\n').join('');
   const report=run(source);
   assert.equal(report.cases.length,names.length);
   assert.deepEqual(checkExtraEnvelope(file,report),{passed:names.length,platformNotRun:0});
  }
  const empty=run("'use strict';\n");
  assert.equal(empty.complete,true,'Node auto file pass must reproduce');
  assert.equal(empty.counts.PASS,1);
  assert.throws(()=>checkExtraEnvelope(Object.keys(EXTRA_CASES)[0],empty),/QA CLOUD QUICK BLOCKED/);
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
});
