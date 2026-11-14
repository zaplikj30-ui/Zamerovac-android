'use strict';
// Public entry point, after the enclosing owner/ref/SHA/clean-checkout gate.
// Reuse the existing pidfd/subreaper or private Job owner for the ENTIRE tree.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const {ownedWorker}=require('./qa-process-client.cjs');
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
async function main(timeoutMs=120000){
 let dir,result,token,workerPassed=false,ownerSucceeded=false,temporaryFilesRemoved=true;
 let report=evaluateTap(undefined),cleanupVerified=false;
 const abort=new AbortController(),cancel=()=>abort.abort();
 const signals=['SIGINT','SIGTERM','SIGHUP'];
 try{
  if(process.argv.length!==2||!Number.isInteger(timeoutMs)||timeoutMs<250||timeoutMs>120000)throw Error('invalid invocation');
  for(const name of signals)process.on(name,cancel);
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-fixture-gate-'));
  token=crypto.randomBytes(16).toString('hex');
  const log=path.join(dir,'verdict.log');
  const temporary=path.join(dir,'work');fs.mkdirSync(temporary);
  const env={...process.env,TEMP:temporary,TMP:temporary,TMPDIR:temporary};
  result=await ownedWorker([process.execPath,path.join(__dirname,'qa-fixture-worker.cjs')],path.join(__dirname,'..'),
   env,log,token,timeoutMs,abort.signal);
  const ownResult=result?.event==='result'&&result.token===token&&result.platform===process.platform&&
   [0,77].includes(result.supervisorExit)&&result.signal===null&&result.error===null;
  cleanupVerified=ownResult&&result.cleanupVerified===true&&result.cleanupEvidence?.remainingProcesses===0;
  const text=readVerdict(log);
  workerPassed=text===passLine;
  ownerSucceeded=result.event==='result'&&result.token===token&&result.platform===process.platform&&
   result.status==='PASS'&&result.reason==='normal'&&result.exitCode===0&&result.error===null&&
   result.supervisorExit===0&&result.signal===null;
  if(text.startsWith('FIXTURE_GATE_BLOCKED '))report={...JSON.parse(text.slice('FIXTURE_GATE_BLOCKED '.length)),status:'BLOCKED'};
 }catch{} // Only constant/boolean diagnostics leave this boundary.
 finally{
  if(dir){
   temporaryFilesRemoved=false;
   try{
    fs.rmSync(dir,{recursive:true,force:true});
    try{fs.lstatSync(dir)}catch(error){if(error.code==='ENOENT')temporaryFilesRemoved=true}
   }catch{}
  }
  for(const name of signals)process.removeListener(name,cancel);
 }
 const passed=workerPassed&&ownerSucceeded&&cleanupVerified&&temporaryFilesRemoved&&!abort.signal.aborted;
 process.stdout.write(passed?passLine:formatReport({...report,status:'BLOCKED'}));
 if(!passed)process.stdout.write('FIXTURE_SCOPE_BLOCKED '+JSON.stringify({cleanupVerified,temporaryFilesRemoved,workerPassed,ownerSucceeded,cancelled:abort.signal.aborted})+'\n');
 process.exitCode=passed?0:1;
 return {passed,cleanupVerified,temporaryFilesRemoved,timedOut:result?.reason==='timeout'};
}
if(require.main===module)void main();
module.exports={main};
