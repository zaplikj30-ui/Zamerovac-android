'use strict';
// Synthetic complete-report contract: no browser, owner, R or HOME workload.
const {test}=require('node:test'),assert=require('node:assert/strict');
const {manifest,checkedFailedReport}=require('../tools/qa-integrity.cjs');
const {profiles}=require('../tools/qa-browser-identity.cjs');
const linux={platform:'linux',evaluation:'You are adequately sandboxed.',rows:[
 ['Layer 1 Sandbox','Namespace'],['PID namespaces','Yes'],['Network namespaces','Yes'],
 ['Seccomp-BPF sandbox','Yes'],['Seccomp-BPF sandbox supports TSYNC','Yes']]};
const win={platform:'win32',rows:[['123','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]};
const identity={sourceSha:manifest.sourceSha,validatorSha:'b'.repeat(40),runToken:'a'.repeat(32)};
function valid(){
 const cases=manifest.cases.drawing.map(name=>({name,status:'passed'}));
 cases[3].status='failed';
 return {suite:'drawing',sha:identity.sourceSha,validatorSha:identity.validatorSha,
  runToken:identity.runToken,syntheticOnly:true,filtered:false,status:'FAIL',
  sandbox:{...(process.platform==='win32'?win:linux),binary:profiles[process.platform]},cases};
}
test('full reviewed failure is a real FAIL, never a 23/96 PASS',()=>{
 const proof=checkedFailedReport(valid(),'drawing',identity);
 assert.deepEqual(proof,{status:'KNOWN_TEST_FAILURE',cases:17});
});
test('missing/renamed/stale/counterfeit/partial suite never obtains safe-failure proof',()=>{
 const bad=[
  row=>row.cases.pop(),
  row=>{row.cases[3].name='invented'},
  row=>{row.cases[3].status='skipped'},
  row=>{row.cases[3].status='passed'},
  row=>{row.sha='c'.repeat(40)},
  row=>{row.validatorSha='c'.repeat(40)},
  row=>{row.runToken='c'.repeat(32)},
  row=>{row.filtered=true},
  row=>{row.status='PARTIAL'},
  row=>{row.sandbox.binary.sha256='0'.repeat(64)},
  row=>{row.sandbox.rows=[]}
 ];
 for(const mutate of bad){
  const record=JSON.parse(JSON.stringify(valid()));mutate(record);
  assert.throws(()=>checkedFailedReport(record,'drawing',identity));
 }
});
