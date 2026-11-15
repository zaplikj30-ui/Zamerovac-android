'use strict';
// Exercise the REAL client parser and gate, not a replacement for client.ownedWorker.
// Only the child_process.spawn boundary is modelled: no Windows/JobObject runtime claim.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),cp=require('node:child_process');
const {EventEmitter}=require('node:events');
const clientId=require.resolve('../tools/qa-process-client.cjs');
const gateId=require.resolve('../tools/qa-fixture-gate.cjs');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';

async function runCase(mutate=(_,base)=>base,ownerExit=0,enabled=true){
 const originalSpawn=cp.spawn,oldArgv=process.argv,oldExit=process.exitCode;
 const had=Object.hasOwn(process.env,'ZAMEROVAC_DIAGNOSTICS');
 const oldEnv=process.env.ZAMEROVAC_DIAGNOSTICS;
 const output=[];let calls=0;
 cp.spawn=(exe,args)=>{
  calls++;
  const child=new EventEmitter();
  child.stdin=Object.assign(new EventEmitter(),{writable:true,write:()=>true,end:()=>{}});
  child.stdout=new EventEmitter();
  child.stderr=new EventEmitter();
  queueMicrotask(()=>{
   const cfg=JSON.parse(fs.readFileSync(args.at(-1),'utf8'));
   fs.writeFileSync(cfg.log,passLine);
   const baseline={event:'result',token:cfg.token,platform:process.platform,
    status:'PASS',reason:'normal',exitCode:0,error:null,diagnostic:null,
    firstFailure:null,cleanupErrorType:null,privateTracebackWritten:false,
    cleanupVerified:true,cleanupEvidence:{remainingProcesses:0}};
   child.stdout.emit('data',Buffer.from(JSON.stringify(mutate(cfg,baseline))+'\n'));
   child.emit('close',ownerExit,null);
  });
  return child;
 };
 process.argv=['node','fixture'];
 if(enabled)process.env.ZAMEROVAC_DIAGNOSTICS='1';else delete process.env.ZAMEROVAC_DIAGNOSTICS;
 try{
  delete require.cache[clientId];delete require.cache[gateId];
  const gate=require(gateId); // picks up the actual client with mocked SPAWN only
  const result=await gate.main(1000,s=>output.push(s));
  return {result,output:output.join(''),exit:process.exitCode,calls};
 }finally{
  cp.spawn=originalSpawn;process.argv=oldArgv;process.exitCode=oldExit;
  if(had)process.env.ZAMEROVAC_DIAGNOSTICS=oldEnv;
  else delete process.env.ZAMEROVAC_DIAGNOSTICS;
  delete require.cache[gateId];delete require.cache[clientId];
 }
}
function blocked(r){
 assert.equal(r.calls,1);
 assert.equal(r.exit,1);
 assert.equal(r.result.passed,false);
 assert.equal(r.result.retryEligible,false);
 assert(!r.output.startsWith(passLine),'forged PASS marker');
}
test('real client->gate: uncontested owner PASS is byte-exact',async()=>{
 const r=await runCase(undefined,0,false);
 assert.equal(r.calls,1);assert.equal(r.exit,0);
 assert.equal(r.result.passed,true);assert.equal(r.output,passLine);
});
test('real client->gate: authenticated PASS+firstFailure fails closed',async()=>{
 const r=await runCase((_,x)=>({...x,firstFailure:{stage:'CreateProcessW',win32Error:5,errorType:'ScopeError',secret:'NEVER_LEAK'}}));
 blocked(r);
 assert(!r.output.includes('NEVER_LEAK'));
});
test('real client->gate: authenticated PASS+cleanupErrorType fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,cleanupErrorType:'PermissionError'})));
});
test('real client->gate: authenticated PASS+diagnostic fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,diagnostic:{stage:'CreateProcessW',win32Error:5}})));
});
test('real client->gate: authenticated PASS+private traceback fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,privateTracebackWritten:true})));
});
test('real client->gate: wrong protocol token fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,token:'WRONG_TOKEN',firstFailure:{stage:'CreateProcessW',win32Error:5,errorType:'ScopeError'}})));
});
test('real client->gate: wrong platform fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,platform:'unauthenticated'})));
});
test('real client->gate: owner exit mismatch fails closed',async()=>{
 blocked(await runCase((_,x)=>x,77));
});
test('real client->gate: cleanup evidence not zero fails closed',async()=>{
 blocked(await runCase((_,x)=>({...x,cleanupEvidence:{remainingProcesses:1}})));
});
