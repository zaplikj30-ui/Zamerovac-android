'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const integrity=require('../tools/qa-integrity.cjs'),runner=require('../tools/local-browser-qa.cjs');
const {profiles}=require('../tools/qa-browser-identity.cjs');
test('all PR121 product suite modes survive the security integration',()=>{
 const source=execFileSync('git',['show',integrity.manifest.sourceSha+':tools/local-browser-qa.cjs'],{cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
 for(const mode of ['--all','--smoke','--legacy-conflict']){
  const match=new RegExp("'"+mode+"': \\[([\\s\\S]*?)\\]").exec(source);assert(match,mode);
  const expected=Array.from(match[1].matchAll(/'([^']+)'/g),x=>x[1]);
  assert.deepEqual(runner.modes[mode],expected,mode);
 }
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
