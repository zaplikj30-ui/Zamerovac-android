'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const client=require('../tools/qa-process-client.cjs');
const gateId=require.resolve('../tools/qa-fixture-gate.cjs');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';
function gateFor(stub){
 const old=client.ownedWorker;client.ownedWorker=stub;
 delete require.cache[gateId];const gate=require(gateId);client.ownedWorker=old;
 return gate;
}
async function runWith(stub,enabled){
 const had=Object.hasOwn(process.env,'ZAMEROVAC_DIAGNOSTICS'),old=process.env.ZAMEROVAC_DIAGNOSTICS;
 const oldExit=process.exitCode,oldArgv=process.argv;const lines=[];
 process.argv=['node','fixture'];if(enabled)process.env.ZAMEROVAC_DIAGNOSTICS='1';else delete process.env.ZAMEROVAC_DIAGNOSTICS;
 try{
  const {main}=gateFor(stub);
  const result=await main(1000,x=>lines.push(x));
  return {result,lines:lines.join(''),exit:process.exitCode};
 }finally{process.argv=oldArgv;process.exitCode=oldExit;if(had)process.env.ZAMEROVAC_DIAGNOSTICS=old;else delete process.env.ZAMEROVAC_DIAGNOSTICS;}
}
function response({token,log,mode='error'}){
 if(mode==='pass')fs.writeFileSync(log,passLine);
 return {event:'result',token,platform:process.platform,supervisorExit:mode==='pass'?0:77,signal:null,
  status:mode==='pass'?'PASS':'BLOCKED',reason:mode==='pass'?'normal':'startup-error',
  exitCode:mode==='pass'?0:null,error:mode==='pass'?null:'ScopeError',
  diagnostic:mode==='pass'?null:{stage:'CreateProcessW',win32Error:5},
  firstFailure:mode==='pass'?null:{stage:'CreateProcessW',win32Error:5,errorType:'ScopeError',secret:'TOKEN secret'},
  cleanupErrorType:mode==='pass'?null:'OSError',privateTracebackWritten:false,
  cleanupVerified:true,cleanupEvidence:{remainingProcesses:0}};
}
test('safe failure allowlists type and API; no arbitrary fields leak',()=>{
 assert.deepEqual(client.safeFailure({stage:'CreateProcessW',win32Error:5,errorType:'ScopeError',private:'XYZ'}),
  {stage:'CreateProcessW',win32Error:5,errorType:'ScopeError'});
 assert.deepEqual(client.safeFailure({stage:'owner-launch',win32Error:123,errorType:'TOKEN SECRET'}),
  {stage:'owner-launch',win32Error:null,errorType:'OtherError'});
});
test('default OFF preserves original PASS bytes (no diagnostic line)',async()=>{
 const {result,lines,exit}=await runWith(async(cmd,cwd,env,log,token)=>response({token,log,mode:'pass'}),false);
 assert.equal(exit,0);assert.equal(result.passed,true);assert.equal(lines,passLine);
});
test('default OFF failure has no private debug fields',async()=>{
 const {result,lines,exit}=await runWith(async(cmd,cwd,env,log,token)=>response({token,log}),false);
 assert.equal(exit,1);assert.equal(result.passed,false);assert(!lines.includes('FIXTURE_FAILURE_SAFE'));
 assert(!lines.includes('SECRET'));
});
test('enabled preserves first Win32 API/code/type despite secondary gate read error',async()=>{
 const {result,lines,exit}=await runWith(async(cmd,cwd,env,log,token)=>response({token,log}),true);
 assert.equal(exit,1);assert.equal(result.passed,false);
 const row=lines.split('\n').find(x=>x.startsWith('FIXTURE_FAILURE_SAFE '));
 assert(row);const safe=JSON.parse(row.slice('FIXTURE_FAILURE_SAFE '.length));
 assert.equal(safe.stage,'CreateProcessW');assert.equal(safe.api,'CreateProcessW');
 assert.equal(safe.win32Error,5);assert.equal(safe.errorType,'ScopeError');assert.equal(safe.cleanupErrorType,'OSError');
 for(const secret of ['TOKEN secret','SECRET','file path','PID=','C:\\SECRET'])assert(!lines.includes(secret));
});
test('spoofed token refuses forged API detail and never PASS',async()=>{
 const {lines,result,exit}=await runWith(async(cmd,cwd,env,log,token)=>({...response({token,log} ),token:'fake'}),true);
 assert.equal(exit,1);assert.equal(result.passed,false);
 const row=lines.split('\n').find(x=>x.startsWith('FIXTURE_FAILURE_SAFE '));
 const safe=JSON.parse(row.slice('FIXTURE_FAILURE_SAFE '.length));
 assert.notEqual(safe.api,'CreateProcessW');assert.equal(safe.errorType,'Error');assert.equal(safe.reason,'unknown');
});
test('unverified job cleanup never results in PASS',async()=>{
 const {result,lines,exit}=await runWith(async(cmd,cwd,env,log,token)=>({
  ...response({token,log}),cleanupVerified:false,cleanupEvidence:{remainingProcesses:null}
 }),true);
 assert.equal(exit,1);assert.equal(result.cleanupVerified,false);
 const row=lines.split('\n').find(x=>x.startsWith('FIXTURE_FAILURE_SAFE '));
 assert(row);const safe=JSON.parse(row.slice('FIXTURE_FAILURE_SAFE '.length));
 assert.equal(safe.cleanupVerified,false);assert.equal(safe.ownedRemaining,null);
});
test('forged PASS with diagnostic is BLOCKED',async()=>{
 const {result,exit,lines}=await runWith(async(cmd,cwd,env,log,token)=>{
  const r=response({token,log,mode:'pass'});return {...r,diagnostic:{stage:'CreateProcessW',win32Error:5}};
 },true);
 assert.equal(exit,1);assert.equal(result.passed,false);assert(!lines.startsWith(passLine));
});
test('gate read error is FIRST when owner has no first failure',async()=>{
 const {lines}=await runWith(async(cmd,cwd,env,log,token)=>{
  const r=response({token,log});return {...r,firstFailure:null,diagnostic:{stage:'worker-result',win32Error:null}};
 },true);
 const row=lines.split('\n').find(x=>x.startsWith('FIXTURE_FAILURE_SAFE '));
 const safe=JSON.parse(row.slice('FIXTURE_FAILURE_SAFE '.length));
 assert.equal(safe.stage,'verdict-read');assert.equal(safe.errorType,'Error');assert.equal(safe.win32Error,null);
});
test('arbitrary injected native code and type do not escape whitelist',async()=>{
 const {lines}=await runWith(async(cmd,cwd,env,log,token)=>{
  const r=response({token,log});return {...r,firstFailure:{stage:'owner-launch',win32Error:999,errorType:'SECRET_TOKEN_PATH'}};
 },true);
 const row=lines.split('\n').find(x=>x.startsWith('FIXTURE_FAILURE_SAFE '));
 const safe=JSON.parse(row.slice('FIXTURE_FAILURE_SAFE '.length));
 assert.equal(safe.stage,'owner-launch');assert.equal(safe.api,null);assert.equal(safe.win32Error,null);
 assert.equal(safe.errorType,'OtherError');assert(!lines.includes('SECRET_TOKEN_PATH'));
});

test('contradictory authenticated PASS with a first failure is BLOCKED',async()=>{
 const {result,exit,lines}=await runWith(async(cmd,cwd,env,log,token)=>{
  const r=response({token,log,mode:'pass'});return {...r,firstFailure:{stage:'CreateProcessW',win32Error:5,errorType:'ScopeError'}};
 },true);
 assert.equal(exit,1);assert.equal(result.passed,false);assert(!lines.startsWith(passLine));
});
