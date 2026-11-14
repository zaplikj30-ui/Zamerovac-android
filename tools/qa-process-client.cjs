'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const diagnosticSpec=require('./qa-process-diagnostic.json');
const nativeStages=new Set(diagnosticSpec.win32Stages),stages=new Set([...diagnosticSpec.stages,...nativeStages]);
function safeDiagnostic(value,fallback='unknown'){
 const stage=stages.has(value?.stage)?value.stage:stages.has(fallback)?fallback:'unknown';
 const code=value?.win32Error;
 return {stage,win32Error:nativeStages.has(stage)&&Number.isInteger(code)&&code>=0&&code<=0xffffffff?code:null};
}
const errorTypes=new Set(['ScopeError','OSError','FileNotFoundError','PermissionError','TimeoutError','ValueError','TypeError','KeyError','RuntimeError','NotImplementedError','AssertionError','Error','SyntaxError','RangeError','OtherError']);
function safeErrorType(value){return errorTypes.has(value)?value:'OtherError'}
function isNativeStage(stage){return nativeStages.has(stage)}
function safeFailure(value,fallback='owner-exit'){
 const diagnostic=safeDiagnostic(value,fallback);
 return {...diagnostic,errorType:safeErrorType(value?.errorType)};
}
const supervisor=path.join(__dirname,'qa_process_supervisor.py');
async function ownedWorker(command,cwd,env,log,token,timeoutMs=480000,signal){
 const configFile=log+'.owner.json';
 fs.writeFileSync(configFile,JSON.stringify({command,cwd,log,token,timeout:timeoutMs/1000,heartbeatTimeout:5,
  browser:command[1]===path.join(__dirname,'qa-browser-worker.cjs')}),{flag:'wx'});
 return new Promise(resolve=>{
  let stdout='',finished=false,protocolOverflow=false,child;
  const finish=result=>{if(finished)return;finished=true;clearInterval(heartbeat);signal?.removeEventListener('abort',cancel);resolve(result)};
  const cancel=()=>{if(child?.stdin?.writable)child.stdin.end('CANCEL '+token+'\n')};
  // Killing just this supervisor is deliberately not a timeout strategy: EOF
  // lets it contain/reap the full workload; Windows also has kernel Job cleanup.
  const heartbeat=setInterval(()=>{if(child?.stdin?.writable)child.stdin.write('ALIVE '+token+'\n')},1000);
  try{
   child=spawn(env.ZAMEROVAC_PYTHON||(process.platform==='win32'?'python':'python3'),[supervisor,'--config',configFile],
    {cwd:__dirname,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
   child.stdin.on('error',()=>{});
   child.stdout.on('data',data=>{
    if(protocolOverflow)return;
    const chunk=data.toString();
    if(stdout.length+chunk.length>1024*1024){protocolOverflow=true;cancel();return}
    stdout+=chunk;
   });
   // stderr may contain private paths/tokens; never include it in any result.
   child.stderr.on('data',()=>{});
   child.once('error',()=>finish({status:'BLOCKED',cleanupVerified:false,error:'OtherError',diagnostic:safeDiagnostic(null,'owner-launch')}));
   child.once('close',(code,exitSignal)=>{
    let report;
    try{
     if(protocolOverflow)throw Error('supervisor output limit exceeded');
     report=JSON.parse(stdout.trim().split('\n').at(-1));
     const authentic=report.event==='result'&&report.token===token&&report.platform===process.platform;
     report.diagnostic=authentic?
      report.status==='PASS'&&report.diagnostic==null?null:safeDiagnostic(report.diagnostic,'owner-exit'):safeDiagnostic(null,'owner-protocol');
     report.firstFailure=authentic&&report.status!=='PASS'&&report.firstFailure?
      safeFailure(report.firstFailure,'owner-exit'):null;
     report.cleanupErrorType=authentic&&report.cleanupErrorType?safeErrorType(report.cleanupErrorType):null;
     report.privateTracebackWritten=authentic&&report.privateTracebackWritten===true;
     if(exitSignal||![0,77].includes(code))report={...report,error:'OtherError'};
     if(report.event!=='result'||report.token!==token||report.cleanupVerified!==true||code!==0||report.status!=='PASS'||report.diagnostic!=null)
      report={...report,status:'BLOCKED'};
    }catch{
     report={status:'BLOCKED',cleanupVerified:false,error:'OtherError',
      diagnostic:safeDiagnostic(null,protocolOverflow?'owner-overflow':'owner-protocol'),
      firstFailure:null,cleanupErrorType:null,privateTracebackWritten:false};
    }
    finish({...report,supervisorExit:code,signal:exitSignal});
   });
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  }catch{finish({status:'BLOCKED',cleanupVerified:false,error:'OtherError',diagnostic:safeDiagnostic(null,'owner-launch')})}
 });
}
module.exports={ownedWorker,safeDiagnostic,safeErrorType,safeFailure,isNativeStage};