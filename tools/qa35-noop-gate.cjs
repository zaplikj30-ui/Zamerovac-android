'use strict';
// One inert worker through CMD -> Node -> Python -> Windows Job -> CreateProcessW.
// No customer files, browser, external program, retries, or full 15-case TAP.
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),crypto=require('node:crypto');
const {ownedWorker,safeDiagnostic}=require('./qa-process-client.cjs');
async function main(){
 let dir=null,result=null,workerStarted=false,temporaryFilesRemoved=false,logRead=false;
 let errorStage=null,errorCode=null,errorType=null;
 try{
  if(process.platform!=='win32'||process.argv.length!==2)throw Error('bad-platform-or-invocation');
  dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa35-noop-'));
  const work=path.join(dir,'work');fs.mkdirSync(work);
  const log=path.join(dir,'verdict.log');
  const token=crypto.randomBytes(16).toString('hex');
  const env={...process.env,TEMP:work,TMP:work,TMPDIR:work,ZAMEROVAC_DIAGNOSTICS:'1'};
  result=await ownedWorker([process.execPath,path.join(__dirname,'qa35-noop-worker.cjs')],
    path.resolve(__dirname,'..'),env,log,token,7000,undefined,20000);
  // The only valid worker output is our inert sentinel; never print raw log.
  let verdict='';
  try{verdict=fs.readFileSync(log,'utf8');logRead=true;}catch{}
  workerStarted=verdict==='QA35_NOOP_EXIT0\n';
  const failure=result?.firstFailure||result?.diagnostic;
  errorStage=safeDiagnostic(failure,'unknown').stage;
  errorCode=safeDiagnostic(failure,'unknown').win32Error;
  errorType=result?.firstFailure?.errorType||result?.error||null;
  const trustworthy=result?.event==='result'&&result?.token===token&&
    result?.platform==='win32'&&result?.supervisorExit===0&&result?.signal===null;
  result._oneShotPass=trustworthy&&result.status==='PASS'&&
    result.reason==='normal'&&result.exitCode===0&&result.error===null&&
    result.diagnostic===null&&result.firstFailure==null&&result.cleanupErrorType==null&&
    result.cleanupVerified===true&&result.cleanupEvidence?.remainingProcesses===0&&
    workerStarted;
 }catch{
  errorStage=errorStage||'owner-protocol';errorType=errorType||'OtherError';
 }finally{
  if(dir){
   try{
    fs.rmSync(dir,{recursive:true,force:true});
    temporaryFilesRemoved=!fs.existsSync(dir);
   }catch{temporaryFilesRemoved=false}
  }
 }
 const passed=result?._oneShotPass===true&&temporaryFilesRemoved;
 const report={
  status:passed?'PASS':'BLOCKED',workerStarted,cleanupVerified:result?.cleanupVerified===true,
  ownedRemaining:result?.cleanupEvidence?.remainingProcesses===0?0:null,
  temporaryFilesRemoved,logRead,
  stage:passed?null:errorStage,win32Error:passed?null:errorCode,
  errorType:passed?null:errorType,
  ownerStatus:result?.status==='PASS'?'PASS':'BLOCKED',
  hardTimeout:result?.diagnostic?.stage==='owner-hard-timeout'
 };
 process.stdout.write('QA35_NOOP_RESULT '+JSON.stringify(report)+'\n');
 if(!passed)process.exitCode=1;
 return passed;
}
if(require.main===module)main().catch(()=>{process.stdout.write('QA35_NOOP_RESULT {"status":"BLOCKED","stage":"owner-protocol"}\n');process.exitCode=1});
module.exports={main};
