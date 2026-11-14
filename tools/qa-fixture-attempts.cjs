'use strict';
// Sequencer only. The existing qa-fixture-gate owns each private JobObject,
// verifies zero descendants, and removes its own TEMP before this may retry.
// Never use this module to re-run a GitHub Actions workflow.
const {main:gateMain}=require('./qa-fixture-gate.cjs');
const {safeDiagnostic}=require('./qa-process-client.cjs');
const {formatReport}=require('./qa-fixture-tap.cjs');
const {performance}=require('node:perf_hooks');
// 60s is the supervisor worker timeout, not the whole startup/cleanup wall time.
const MAX_ATTEMPTS=3,ATTEMPT_MS=60000,MAX_ATTEMPT_WALL_MS=90000,TOTAL_MS=240000;
const PASS_LINE='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP';

function evidence(text){
 if(typeof text!=='string'||text.length>16384)return null;
 if(text===PASS_LINE)return PASS_LINE;
 if(!text.startsWith('FIXTURE_GATE_BLOCKED '))return null;
 try{return formatReport({...JSON.parse(text.slice('FIXTURE_GATE_BLOCKED '.length)),status:'BLOCKED'}).trimEnd()}
 catch{return null}
}
function recordFor(attempt,result){
 const keys=['passed','cleanupVerified','temporaryFilesRemoved','workerPassed',
  'ownerSucceeded','cancelled','timedOut'];
 const typed=result&&typeof result==='object'&&keys.every(k=>typeof result[k]==='boolean');
 const clean=typed&&result.cleanupVerified===true&&result.ownedRemaining===0&&
  result.temporaryFilesRemoved===true;
 const publicReport=evidence(result?.publicReport);
 const diagnostic=result?.diagnostic==null?null:safeDiagnostic(result.diagnostic,'unknown');
 const pass=typed&&clean&&result.retryEligible!==true&&result.passed===true&&result.workerPassed===true&&
  result.ownerSucceeded===true&&result.cancelled===false&&result.timedOut===false&&
  diagnostic===null&&publicReport===PASS_LINE;
 const validBlocked=typed&&result.passed===false&&publicReport?.startsWith('FIXTURE_GATE_BLOCKED ')===true;
 // Retry is only for the *existing gate's* authenticated pre-test startup
 // evidence, never a completed/failed TAP case, unknown IPC or missing cleanup.
 let noTapCases=false;
 if(validBlocked){
  const tap=JSON.parse(publicReport.slice('FIXTURE_GATE_BLOCKED '.length));
  noTapCases=tap.nodeExitOk===false&&tap.planOk===false&&tap.casesOk===false&&
   tap.summary?.tests?.available===false&&tap.summary?.pass?.available===false&&
   Array.isArray(tap.cases)&&tap.cases.every(x=>x.available===false);
 }
 const startup=diagnostic?.stage==='verdict-open'&&diagnostic.win32Error===null||
               diagnostic?.stage==='CreateProcessW'&&Number.isInteger(diagnostic.win32Error);
 const retryEligible=validBlocked&&clean&&result.retryEligible===true&&startup&&noTapCases&&
   result.workerPassed===false&&result.ownerSucceeded===false&&
   result.cancelled===false&&result.timedOut===false;
 return {
  attempt,status:pass?'PASS':validBlocked?'BLOCKED':'INVALID',
  cleanupVerified:result?.cleanupVerified===true,ownedRemaining:result?.ownedRemaining===0?0:null,
  temporaryFilesRemoved:result?.temporaryFilesRemoved===true,
  workerPassed:result?.workerPassed===true,ownerSucceeded:result?.ownerSucceeded===true,
  timedOut:result?.timedOut===true,cancelled:result?.cancelled===true,
  diagnostic:pass?null:safeDiagnostic(diagnostic,'unknown'),
  publicReport:validBlocked?publicReport:null,retryEligible,clean
 };
}
async function diagnose({runOne=gateMain,print=line=>process.stdout.write(line+'\n'),
                       clock=()=>performance.now(),signal}={}){
 const ctrl=new AbortController(),cancel=()=>ctrl.abort();
 const interrupt=['SIGINT','SIGTERM','SIGHUP'];
 for(const name of interrupt)process.on(name,cancel);
 signal?.addEventListener('abort',cancel,{once:true});
 if(signal?.aborted)cancel();
 const started=clock(),records=[];
 let final='BLOCKED';
 try{
  for(let attempt=1;attempt<=MAX_ATTEMPTS;attempt++){
   if(ctrl.signal.aborted){final='STOP_CANCELLED';break}
   const before=clock()-started;
   if(!Number.isFinite(before)||before<0){final='STOP_INVALID_CLOCK';break}
   if(before+MAX_ATTEMPT_WALL_MS>TOTAL_MS){final='STOP_TOTAL_DEADLINE';break}
   const attemptStarted=clock();
   let result;
   try{result=await runOne(ATTEMPT_MS,()=>{});
   }catch{result=null}
   const elapsed=clock()-attemptStarted,overall=clock()-started;
   const item=recordFor(attempt,result);
   item.elapsedMs=Number.isFinite(elapsed)&&elapsed>=0?Math.round(elapsed):null;
   // Only whitelisted booleans and native stage/code; never raw TAP, stderr,
   // paths, token, PID, process information, exceptions or user data.
   const {publicReport,clean,...visible}=item;
   print('QA_ATTEMPT '+JSON.stringify(visible));
   if(publicReport)print('QA_ATTEMPT_FIXED_CASES '+JSON.stringify({attempt,evidence:publicReport}));
   records.push(visible);
   if(!clean){final='STOP_UNVERIFIED_CLEANUP';break}
   if(item.elapsedMs===null||!Number.isFinite(overall)||overall<0){final='STOP_INVALID_CLOCK';break}
   if(elapsed>MAX_ATTEMPT_WALL_MS){final='STOP_ATTEMPT_DEADLINE';break}
   if(overall>TOTAL_MS){final='STOP_TOTAL_DEADLINE';break}
   if(ctrl.signal.aborted||item.cancelled){final='STOP_CANCELLED';break}
   if(item.timedOut){final='STOP_TIMEOUT';break}
   if(item.status==='INVALID'||
      (item.status==='BLOCKED'&&item.workerPassed&&item.ownerSucceeded)){
    final='STOP_INVALID_RESULT';break
   }
   if(item.status==='PASS'){
    final=attempt===1?'PASS_FIRST_ATTEMPT':'RECOVERED_WITH_PRIOR_BLOCKED';break
   }
   if(item.status==='BLOCKED'&&!item.retryEligible){final='STOP_NOT_EARLY_DIAGNOSTIC';break}
   // Only after cleanup of this exact attempt and an authenticated, pre-test
   // startup diagnostic may the next serial attempt begin.
  }
 }finally{
  signal?.removeEventListener('abort',cancel);
  for(const name of interrupt)process.removeListener(name,cancel);
 }
 const success=final==='PASS_FIRST_ATTEMPT'&&records.length===1;
 print('QA_FINAL '+JSON.stringify({status:final,attempts:records.length,
  blocked:records.filter(x=>x.status!=='PASS').length,exitCode:success?0:1}));
 if(success)print(PASS_LINE);
 return {status:final,success,attempts:records.length,records};
}
if(require.main===module){
 if(process.argv.length!==2){process.stderr.write('QA DIAGNOSTIC STOP: unexpected arguments\n');process.exitCode=1}
 else void diagnose().then(result=>{process.exitCode=result.success?0:1},()=>{process.exitCode=1});
}
module.exports={diagnose,recordFor,evidence,MAX_ATTEMPTS,ATTEMPT_MS,MAX_ATTEMPT_WALL_MS,TOTAL_MS};
