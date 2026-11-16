'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const integrity=require('../tools/qa-integrity.cjs'),runner=require('../tools/local-browser-qa.cjs');
const {profiles}=require('../tools/qa-browser-identity.cjs');
// Independently reviewed values from original PR121 SHA ae3b4df….
// Never require an unavailable historical git object on a depth-1 checkout.
const ORIGINAL_MODES=Object.freeze({
 '--smoke':['drawing','quality-regressions','gallery-readability'],
 '--legacy-conflict':['legacy-conflict-persistence'],
 '--all':['legacy-conflict-persistence','drawing','gallery-visual','workflows',
  'interactions','zoom-grid','update39','gallery-state','peer-sync','drive-accounts',
  'sync-cadence','backup-history','read-only-sync','sync-edit-guard','note-sync',
  'web-content-policy','media-import','pending-audio','help','release-history',
  'latency','quality-regressions','gallery-readability']
});
test('all PR121 product suite modes equal the frozen reviewed reference',()=>{
  for(const mode of Object.keys(ORIGINAL_MODES))assert.deepEqual(runner.modes[mode],ORIGINAL_MODES[mode]);
  assert.equal(Object.values(integrity.manifest.cases).flat().length,96);
});
test('successful legacy diagnostic stays 1/1 and cannot be accepted as full 23/96 evidence',()=>{
 const suite='legacy-conflict-persistence';
 const identity={sourceSha:integrity.manifest.sourceSha,validatorSha:'b'.repeat(40),runToken:'a'.repeat(32),finalized:true};
 const proof=process.platform==='win32'?{platform:'win32',rows:[['123','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]}:
  {platform:'linux',evaluation:'You are adequately sandboxed.',rows:[['Layer 1 Sandbox','Namespace'],['PID namespaces','Yes'],['Network namespaces','Yes'],['Seccomp-BPF sandbox','Yes'],['Seccomp-BPF sandbox supports TSYNC','Yes']]};
 const report={suite,sha:identity.sourceSha,validatorSha:identity.validatorSha,runToken:identity.runToken,
  syntheticOnly:true,filtered:false,status:'COMPLETE',sandbox:{...proof,binary:profiles[process.platform]},
  cases:integrity.manifest.cases[suite].map(name=>({name,status:'passed'}))};
 const records=[{suite,status:'PASS',cleanupVerified:true,report}];
 assert.deepEqual(integrity.complete('--legacy-conflict',records,identity,{}),{status:'PASS',suites:1,cases:1});
 assert.equal(integrity.complete('--all',records,identity,{}).status,'BLOCKED');
 assert.equal(integrity.complete('--legacy-conflict',records,identity,{ZAMEROVAC_CASES:'anything'}).status,'BLOCKED');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-legacy-mode-'));
 try{
  const result=runner.statusReport('--legacy-conflict',records,dir,identity);
  assert.equal(result.mode,'--legacy-conflict');assert.equal(result.coverage.cases,1);assert.equal(result.coverage.suites,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
