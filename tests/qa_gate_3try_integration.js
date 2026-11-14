'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const {diagnose}=require('../tools/qa-fixture-attempts.cjs');
const gateCode=fs.readFileSync(path.join(__dirname,'../tools/qa-fixture-gate.cjs'),'utf8');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';
const formatReport=r=>'FIXTURE_GATE_BLOCKED '+JSON.stringify({nodeExitOk:r.nodeExitOk===true,planOk:r.planOk===true})+'\n';
const safeDiagnostic=(input,fallback='unknown')=>({stage:input?.stage||fallback,win32Error:Number.isInteger(input?.win32Error)?input.win32Error:null});
function controlledGate(outcomes){
 const events=new EventEmitter(),tempPaths=[];
 const fakeProcess={argv:['node','qa-fixture-attempts.cjs'],env:{},platform:process.platform,
  execPath:process.execPath,exitCode:undefined,stdout:{write(){}},
  on:(...a)=>events.on(...a),removeListener:(...a)=>events.removeListener(...a)};
 const requireModel=name=>{
  if(name==='./qa-process-client.cjs')return {ownedWorker:async(_cmd,_cwd,env,log,token,timeout)=>{
   assert.equal(timeout,60000);assert(fs.existsSync(env.TEMP));tempPaths.push(env.TEMP);
   const mode=outcomes.shift();assert(mode,'a fourth attempt was started');
   fs.writeFileSync(log,mode==='PASS'?passLine:formatReport({nodeExitOk:false,planOk:false}));
   return {event:'result',token,platform:process.platform,
    status:mode==='PASS'?'PASS':'BLOCKED',reason:mode==='PASS'?'normal':'crash',
    exitCode:mode==='PASS'?0:1,supervisorExit:mode==='PASS'?0:77,signal:null,error:null,
    diagnostic:mode==='PASS'?null:{stage:'owner-exit',win32Error:null},
    cleanupVerified:mode!=='UNVERIFIED',cleanupEvidence:{remainingProcesses:mode==='UNVERIFIED'?1:0}};
  },safeDiagnostic};
  if(name==='./qa-fixture-tap.cjs')return {evaluateTap:()=>({status:'BLOCKED',nodeExitOk:false,planOk:false}),formatReport};
  return require(name);
 };
 const exports={};const module={exports};
 vm.runInNewContext(gateCode,{require:requireModel,module,exports,__dirname:path.resolve(__dirname,'../tools'),
  process:fakeProcess,Buffer,AbortController,JSON,console},
  {filename:'qa-fixture-gate.cjs'});
 return {main:module.exports.main,tempPaths,getExit:()=>fakeProcess.exitCode};
}
test('actual SHA-identical gate module: a passing first attempt preserves original CLI PASS',async()=>{
 const gate=controlledGate(['PASS']),lines=[];
 const result=await diagnose({runOne:gate.main,print:x=>lines.push(x)});
 assert.equal(result.success,true);assert.equal(result.attempts,1);
 assert.deepEqual(lines.filter(x=>x===passLine.trim()),[passLine.trim()]);
 assert.equal(gate.getExit(),0);assert.equal(gate.tempPaths.length,1);
 for(const p of gate.tempPaths)assert(!fs.existsSync(p),'gate must remove own TEMP');
});
test('actual gate: two distinct private TEMPs, first BLOCKED retained, later PASS remains final exit1',async()=>{
 const gate=controlledGate(['BLOCKED','PASS']),lines=[];
 const result=await diagnose({runOne:gate.main,print:x=>lines.push(x)});
 assert.equal(result.status,'RECOVERED_WITH_PRIOR_BLOCKED');assert.equal(result.success,false);
 assert.equal(gate.tempPaths.length,2);assert.notEqual(gate.tempPaths[0],gate.tempPaths[1]);
 assert.equal(gate.getExit(),0,'gate attempt2 is locally PASS: outer sequencer must still refuse global PASS');
 for(const p of gate.tempPaths)assert(!fs.existsSync(p));
 assert.equal(lines.filter(x=>x.startsWith('QA_ATTEMPT ')).length,2);
 assert.equal(lines.filter(x=>x===passLine.trim()).length,0);
 assert.equal(JSON.parse(lines.find(x=>x.startsWith('QA_FINAL ')).slice(9)).exitCode,1);
});
test('actual gate: unverified descendant cleanup STOPs immediately and later PASS is not attempted',async()=>{
 const gate=controlledGate(['UNVERIFIED','PASS']),lines=[];
 const result=await diagnose({runOne:gate.main,print:x=>lines.push(x)});
 assert.equal(result.status,'STOP_UNVERIFIED_CLEANUP');assert.equal(gate.tempPaths.length,1);
 assert(!lines.includes(passLine.trim()));for(const p of gate.tempPaths)assert(!fs.existsSync(p));
});
