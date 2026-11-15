'use strict';
// Import the actual production modules via Node's resolver, not a VM copy.
// Only the privileged ownedWorker boundary is modeled: native Windows NOT RUN.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const client=require('../tools/qa-process-client.cjs');
const tap=require('../tools/qa-fixture-tap.cjs');
let scenarios=[],temps=[];
client.ownedWorker=async (_cmd,_cwd,env,log,token,timeout)=>{
 assert.equal(timeout,60000);assert(fs.existsSync(env.TEMP));temps.push(env.TEMP);
 const s=scenarios.shift();assert(s,'unexpected additional attempt');
 if(s==='PASS')fs.writeFileSync(log,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
 if(s==='TAP_FAIL'){
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa130-tap-fail-'));
  try{
   const file=path.join(dir,'real-failed-15.cjs');
   fs.writeFileSync(file,"const {test}=require('node:test');\n"+tap.caseNames.map((name,i)=>
    'test('+JSON.stringify(name)+',()=>{'+(i===0?"throw Error('PRIVATE FAIL')":'')+'});').join('\n'));
   const env={...process.env};delete env.NODE_TEST_CONTEXT;
   const actual=spawnSync(process.execPath,['--test','--test-reporter=tap',file],
    {encoding:null,env,timeout:12000,maxBuffer:1024*1024});
   assert.equal(actual.status,1);assert.equal(actual.signal,null);
   const report=tap.evaluateTap(actual.stdout,actual);
   assert.equal(report.status,'BLOCKED');
   assert.equal(report.cases.filter(x=>x.available).length,15);
   assert.equal(report.cases.filter(x=>!x.passed).length,1);
   fs.writeFileSync(log,tap.formatReport(report));
  }finally{fs.rmSync(dir,{recursive:true,force:true})}
 }
 return {event:'result',token,platform:process.platform,
  status:s==='PASS'?'PASS':'BLOCKED',reason:s==='PASS'?'normal':s==='TAP_FAIL'?'crash':'startup-error',
  exitCode:s==='PASS'?0:s==='TAP_FAIL'?1:null,supervisorExit:s==='PASS'?0:77,signal:null,
  error:s==='PASS'||s==='TAP_FAIL'?null:'ScopeError: PRIVATE STARTUP',
  diagnostic:s==='PASS'?null:s==='TAP_FAIL'?{stage:'worker-result',win32Error:null}:s==='CREATE'?{stage:'CreateProcessW',win32Error:5}:{stage:'verdict-open',win32Error:null},
  cleanupVerified:s!=='NO_CLEAN',cleanupEvidence:{remainingProcesses:s==='NO_CLEAN'?1:0}};
};
const gate=require('../tools/qa-fixture-gate.cjs');
const qa=require('../tools/qa-fixture-attempts.cjs');
async function run(items,options={}){
 scenarios=[...items];temps=[];const messages=[];
 const prev=process.exitCode;process.argv=['node','qa-fixture-attempts.cjs'];
 try{return {result:await qa.diagnose({runOne:gate.main,print:s=>messages.push(s),...options}),messages,temps:[...temps]};}
 finally{process.exitCode=prev;}
}
test('SEC01 actual imported Win32 whitelist cannot leak numeric code on logical stages',()=>{
 assert.deepEqual(client.safeDiagnostic({stage:'owner-launch',win32Error:5}),{stage:'owner-launch',win32Error:null});
 assert.deepEqual(client.safeDiagnostic({stage:'CreateProcessW',win32Error:5}),{stage:'CreateProcessW',win32Error:5});
});
test('SEC02 pre-test log-open BLOCKED with owner zero-process proof may retry, but never mask old BLOCKED',async()=>{
 const {result,messages,temps}=await run(['EARLY','PASS']);
 assert.equal(result.status,'RECOVERED_WITH_PRIOR_BLOCKED');assert.equal(result.success,false);
 assert.equal(result.attempts,2);assert.notEqual(temps[0],temps[1]);
 assert(temps.every(t=>!fs.existsSync(t)));
 assert.equal(messages.filter(x=>x==='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP').length,0);
 assert.equal(result.records[0].diagnostic.stage,'verdict-open');assert.equal(result.records[0].retryEligible,true);
});
test('R44-01 native CreateProcessW failure stops despite Job zero-process report',async()=>{
 const {result,temps}=await run(['CREATE','PASS']);
 assert.equal(result.attempts,1);
 assert.equal(result.status,'STOP_NOT_EARLY_DIAGNOSTIC');
 assert.equal(result.records[0].retryEligible,false);
 assert.deepEqual(result.records[0].diagnostic,{stage:'CreateProcessW',win32Error:5});
 assert(temps.every(t=>!fs.existsSync(t)));
});
test('SEC02 real runner TAP failure with owner clean MUST STOP at one attempt',async()=>{
 const {result,temps}=await run(['TAP_FAIL','PASS']);
 assert.equal(result.attempts,1);assert.equal(result.status,'STOP_NOT_EARLY_DIAGNOSTIC');
 assert.equal(result.records[0].retryEligible,false);
 assert(temps.every(t=>!fs.existsSync(t)));
});
test('SEC02 owner cleanup missing STOP, never start next attempt',async()=>{
 const {result}=await run(['NO_CLEAN','PASS']);
 assert.equal(result.attempts,1);assert.equal(result.status,'STOP_UNVERIFIED_CLEANUP');
});
test('QA130-TIME actual imported modules: 95s modeled wall time stops, no second attempt',async()=>{
 let now=0,idx=0;
 const out=await qa.diagnose({clock:()=>now,print:()=>{},runOne:async()=>{
  idx++;now+=95000;return {passed:false,cleanupVerified:true,ownedRemaining:0,temporaryFilesRemoved:true,
  workerPassed:false,ownerSucceeded:false,timedOut:false,cancelled:false,retryEligible:true,
  diagnostic:{stage:'verdict-open',win32Error:null},publicReport:tap.formatReport(tap.evaluateTap(undefined)).trimEnd()};}});
 assert.equal(idx,1);assert.equal(out.status,'STOP_ATTEMPT_DEADLINE');
});
