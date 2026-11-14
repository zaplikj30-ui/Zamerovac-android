'use strict';
// Public entry point, after the enclosing owner/ref/SHA/clean-checkout gate.
// Reuse the existing pidfd/subreaper or private Job owner for the ENTIRE tree.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ownedWorker,safeDiagnostic,safeErrorType,safeFailure,isNativeStage}=require('./qa-process-client.cjs');
const {evaluateTap,formatReport}=require('./qa-fixture-tap.cjs');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';
function readVerdict(file){
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=fs.fstatSync(fd),named=fs.lstatSync(file);
  if(!before.isFile()||before.nlink!==1||!named.isFile()||before.dev!==named.dev||before.ino!==named.ino||before.size>16384)throw Error('invalid verdict');
  const bytes=Buffer.alloc(16385),length=fs.readSync(fd,bytes,0,bytes.length,0);
  const after=fs.fstatSync(fd),last=fs.lstatSync(file);
  if(length!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||last.dev!==before.dev||last.ino!==before.ino||last.nlink!==1)throw Error('changed verdict');
  return bytes.subarray(0,length).toString('utf8');
 }finally{fs.closeSync(fd)}
}
// A shorter bounded deadline is available to process tests through this module
// API only. The CLI has no configurable arguments and always uses 120 seconds.
async function main(timeoutMs=120000, emit=chunk=>process.stdout.write(chunk)){
 let dir,result,token,workerPassed=false,ownerSucceeded=false,temporaryFilesRemoved=true;
 let report=evaluateTap(undefined),cleanupVerified=false,verifiedStartup=false,ownerIdentity=false;
 let stage='gate-input',diagnostic=null,firstFailure=null,cleanupFailureType=null;
 const diagnosticEnabled=process.env.ZAMEROVAC_DIAGNOSTICS==='1';
 const abort=new AbortController(),cancel=()=>abort.abort();
 const signals=['SIGINT','SIGTERM','SIGHUP'];
 try{
  if(process.argv.length!==2||!Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>120000)throw Error('invalid invocation');
  stage='gate-signals';
  for(const name of signals)process.on(name,cancel);
  stage='gate-temp';
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-fixture-gate-'));
  token=crypto.randomBytes(16).toString('hex');
  const log=path.join(dir,'verdict.log');
  const temporary=path.join(dir,'work');fs.mkdirSync(temporary);
  const env={...process.env,TEMP:temporary,TMP:temporary,TMPDIR:temporary};
  stage='owner-launch';
  result=await ownedWorker([process.execPath,path.join(__dirname,'qa-fixture-worker.cjs')],path.join(__dirname,'..'),
   env,log,token,timeoutMs,abort.signal);
  if(result?.status!=='PASS'||result?.diagnostic!=null)diagnostic=safeDiagnostic(result?.diagnostic,'owner-exit');
  ownerIdentity=result?.event==='result'&&result.token===token&&
   result.platform===process.platform&&[0,77].includes(result.supervisorExit)&&
   result.signal===null;
  if(ownerIdentity&&diagnosticEnabled){
   if(result.firstFailure)firstFailure=safeFailure(result.firstFailure,'owner-exit');
   cleanupFailureType=result.cleanupErrorType?safeErrorType(result.cleanupErrorType):null;
  }
  // Only a scope-created but pre-test startup failure may have a private error
  // yet still prove zero descendants. The Python owner uses its original
  // cleanup+verify_empty+close APIs; no new worker or process owner is added.
  verifiedStartup=ownerIdentity&&result.status==='BLOCKED'&&
   result.reason==='startup-error'&&result.exitCode===null&&
   result.supervisorExit===77&&typeof result.error==='string'&&result.error.length>0&&
   (result.diagnostic?.stage==='verdict-open'&&result.diagnostic.win32Error===null||
    result.diagnostic?.stage==='CreateProcessW'&&Number.isInteger(result.diagnostic.win32Error))&&
   result.cleanupVerified===true&&result.cleanupEvidence?.remainingProcesses===0;
  const ownResult=ownerIdentity&&(result.error===null||verifiedStartup);
  cleanupVerified=ownResult&&result.cleanupVerified===true&&result.cleanupEvidence?.remainingProcesses===0;
  if(!cleanupVerified&&diagnostic===null)diagnostic=safeDiagnostic(null,'owner-exit');
  stage='verdict-read';
  const text=readVerdict(log);
  workerPassed=text===passLine;
  ownerSucceeded=result.event==='result'&&result.token===token&&result.platform===process.platform&&
   result.status==='PASS'&&result.diagnostic==null&&result.reason==='normal'&&result.exitCode===0&&result.error===null&&
   result.supervisorExit===0&&result.signal===null;
  stage='verdict-result';
  if(text.startsWith('FIXTURE_GATE_BLOCKED '))report={...JSON.parse(text.slice('FIXTURE_GATE_BLOCKED '.length)),status:'BLOCKED'};
 }catch(e){
  if(diagnostic===null)diagnostic=safeDiagnostic(null,stage);
  // Preserve authenticated owner first failure over secondary gate read error.
  if(firstFailure===null)firstFailure={...safeDiagnostic(null,stage),errorType:safeErrorType(e?.name)};
 }
 finally{
  if(dir){
   temporaryFilesRemoved=false;
   try{
    fs.rmSync(dir,{recursive:true,force:true});
    try{fs.lstatSync(dir)}catch(error){if(error.code==='ENOENT')temporaryFilesRemoved=true}
   }catch(e){
    if(cleanupFailureType===null)cleanupFailureType=safeErrorType(e?.name);
   }
   if(!temporaryFilesRemoved&&diagnostic===null)diagnostic=safeDiagnostic(null,'temp-cleanup');
  }
  for(const name of signals)process.removeListener(name,cancel);
 }
 const passed=workerPassed&&ownerSucceeded&&cleanupVerified&&temporaryFilesRemoved&&!abort.signal.aborted;
 const publicReport=passed?passLine:formatReport({...report,status:'BLOCKED'});
 emit(publicReport);
 if(!passed)emit('FIXTURE_SCOPE_BLOCKED '+JSON.stringify({cleanupVerified,temporaryFilesRemoved,workerPassed,ownerSucceeded,cancelled:abort.signal.aborted})+'\n');
 if(!passed)emit('FIXTURE_DIAGNOSTIC '+JSON.stringify(safeDiagnostic(diagnostic,stage))+'\n');
 if(!passed&&diagnosticEnabled){
  const failure=firstFailure||{...safeDiagnostic(diagnostic,stage),errorType:'OtherError'};
  const reason=ownerIdentity&&['normal','startup-error','crash','timeout','cancel','eof','heartbeat-timeout','communication-error'].includes(result?.reason)?result.reason:'unknown';
  emit('FIXTURE_FAILURE_SAFE '+JSON.stringify({stage:failure.stage,
   api:isNativeStage(failure.stage)?failure.stage:null,
   win32Error:failure.win32Error,errorType:failure.errorType,reason,
   cleanupErrorType:cleanupFailureType,cleanupVerified,ownedRemaining:cleanupVerified?0:null,
   temporaryFilesRemoved,privateTracebackWritten:ownerIdentity&&result.privateTracebackWritten===true})+'\n');
 }
 process.exitCode=passed?0:1;
 // Only the existing audited gate knows whether the worker tree was empty and
 // its own TEMP removed. Expose the same redacted facts to the serial caller.
 return {passed,cleanupVerified,ownedRemaining:cleanupVerified?0:null,
  temporaryFilesRemoved,workerPassed,ownerSucceeded,
  cancelled:abort.signal.aborted,timedOut:result?.reason==='timeout',
  diagnostic:passed?null:safeDiagnostic(diagnostic,stage),
  publicReport:publicReport.trimEnd(),
  retryEligible:verifiedStartup&&cleanupVerified&&temporaryFilesRemoved&&!workerPassed&&
    !ownerSucceeded&&!abort.signal.aborted&&result?.status==='BLOCKED'};
}
if(require.main===module)void main();
module.exports={main};
