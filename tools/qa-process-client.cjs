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
async function runOwned(command,cwd,env,log,token,timeoutMs=480000,signal,hardStopMs=0,transport=null){
 const configFile=log+'.owner.json';
 fs.writeFileSync(configFile,JSON.stringify({command,cwd,log,token,timeout:timeoutMs/1000,heartbeatTimeout:5,
  browser:command[1]===path.join(__dirname,'qa-browser-worker.cjs')}),{flag:'wx'});
 return new Promise(resolve=>{
  let stdout='',finished=false,protocolOverflow=false,channelWriteFailed=false,child,hardTimedOut=false,hardTimer;
  const finish=result=>{if(finished)return;finished=true;clearInterval(heartbeat);if(hardTimer)clearTimeout(hardTimer);signal?.removeEventListener('abort',cancel);resolve(result)};
  const cancel=()=>{try{if(child?.stdin?.writable)child.stdin.end('CANCEL '+token+'\n')}catch{}};
  // Killing just this supervisor is deliberately not a timeout strategy: EOF
  // lets it contain/reap the full workload; Windows also has kernel Job cleanup.
  // An IPC write can throw synchronously as the supervisor channel closes.
  // Never let that crash the gate while a native worker might exist.
  const heartbeat=setInterval(()=>{
   try{if(child?.stdin?.writable)child.stdin.write('ALIVE '+token+'\n')}
   catch{channelWriteFailed=true;cancel()}
  },1000);
  // Soft deadline only. CreateProcessW may be running when this fires:
  // killing the owner then has no proven rollback for a partly-created child.
  // Request cooperative cancellation, NEVER force-kill the owner by PID.
  // If the native API does not return there is no bounded cleanup guarantee:
  // the attempt remains BLOCKED and must NOT be retried or run as HOME fault QA.
  if(Number.isInteger(hardStopMs)&&hardStopMs>=1000&&hardStopMs<=180000){
   hardTimer=setTimeout(()=>{if(finished)return;hardTimedOut=true;cancel()},hardStopMs);
  }
  try{
   child=spawn(transport?.executable||env.ZAMEROVAC_PYTHON||(process.platform==='win32'?'python':'python3'),transport?.args(configFile)||[supervisor,'--config',configFile],
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
     const messages=stdout.trim().split('\n').map(line=>JSON.parse(line));
     if(![1,2].includes(messages.length)||(messages.length===2&&(messages[0].event!=='ready'||messages[0].token!==token)))throw Error('owner protocol');
     report=messages.at(-1);
     const authentic=report.event==='result'&&report.token===token&&report.platform===(transport?'linux':process.platform);
     // A genuine protocol envelope may still contain a contradictory PASS.
     // Capture this before normalizing diagnostics; never erase failure evidence.
     const contradictoryPass=authentic&&report.status==='PASS'&&
      (report.error!=null||report.reason!=='normal'||report.exitCode!==0||report.cleanupEvidence?.remainingProcesses!==0||
       report.firstFailure!=null||report.cleanupErrorType!=null||
       report.diagnostic!=null||report.privateTracebackWritten===true);
     report.diagnostic=authentic?
      report.status==='PASS'&&report.diagnostic==null?null:safeDiagnostic(report.diagnostic,'owner-exit'):safeDiagnostic(null,'owner-protocol');
     report.firstFailure=authentic&&report.firstFailure!=null?
      safeFailure(report.firstFailure,'owner-exit'):null;
     report.cleanupErrorType=authentic&&report.cleanupErrorType?safeErrorType(report.cleanupErrorType):null;
     report.error=authentic&&report.error!=null?safeErrorType(report.error):null;
     report.privateTracebackWritten=authentic&&report.privateTracebackWritten===true;
     if(exitSignal||![0,77].includes(code))report={...report,error:'OtherError'};
     if(report.event!=='result'||report.token!==token||report.cleanupVerified!==true||code!==0||report.status!=='PASS'||report.diagnostic!=null||
        contradictoryPass||report.firstFailure!=null||report.cleanupErrorType!=null)
      report={...report,status:'BLOCKED'};
    }catch{
     report={status:'BLOCKED',cleanupVerified:false,error:'OtherError',
      diagnostic:safeDiagnostic(null,protocolOverflow?'owner-overflow':'owner-protocol'),
      firstFailure:null,cleanupErrorType:null,privateTracebackWritten:false};
    }
    if(hardTimedOut)report={status:'BLOCKED',cleanupVerified:false,error:'TimeoutError',
     diagnostic:safeDiagnostic(null,'owner-hard-timeout'),firstFailure:null,cleanupErrorType:null};
    if(channelWriteFailed&&!hardTimedOut)report={...report,status:'BLOCKED',cleanupVerified:false,
     error:'OtherError',diagnostic:safeDiagnostic(null,'owner-channel')};
    finish({...report,supervisorExit:code,signal:exitSignal});
   });
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  }catch{finish({status:'BLOCKED',cleanupVerified:false,error:'OtherError',diagnostic:safeDiagnostic(null,'owner-launch')})}
 });
}
async function ownedWorker(command,cwd,env,log,token,timeoutMs=480000,signal,hardStopMs=0){return runOwned(command,cwd,env,log,token,timeoutMs,signal,hardStopMs)}
async function ownedWslWorker(cfg,env,log,token,group){
 const p=require('./qa/home4-policy.cjs');
 p.demand(process.platform==='win32'&&env.ZAMEROVAC_SCOPE==='windows-private-job'&&env.ZAMEROVAC_SUPERVISOR_PID===String(process.ppid),'wsl-outer-job');
 p.demand(cfg.profile.wsl.containmentEvidence?.verified===true&&cfg.profile.wsl.diskEvidence?.verified===true,'wsl-runtime-proof-required');
 const wsl=p.executable(cfg.profile.components.wsl),w=cfg.profile.wsl;
 p.demand(w.distribution==='Zamerovac-Ubuntu-QA'&&typeof w.user==='string'&&/^[a-z_][a-z0-9_-]*$/.test(w.user)&&w.user!=='root'&&Number.isSafeInteger(w.uid)&&w.uid>0,'wsl-identity');
 const linuxPython=cfg.profile.linux?.components?.python;
 p.demand(linuxPython&&w.python===path.posix.join(linuxPython.root,linuxPython.entry)&&/^[a-f0-9]{64}$/.test(linuxPython.files?.[linuxPython.entry]||''),'wsl-python-pin');
 const map=file=>{const parsed=path.win32.parse(file),base=w.driveMap?.[parsed.root.toUpperCase()];p.demand(typeof base==='string'&&/^\/mnt\/[a-z]$/.test(base),'wsl-drive-map');return base+'/'+path.win32.relative(parsed.root,file).replaceAll('\\','/')};
 const config=path.join(cfg.privateDir,'wsl-config-'+group+'.json');
 fs.writeFileSync(config,JSON.stringify({...cfg,group}),{flag:'wx'});
 const bridge=path.join(__dirname,'qa','home4_wsl.py'),digest=cfg.validatorFiles['tools/qa/home4_wsl.py'];
 const bootstrap="import hashlib,runpy,sys; p=sys.argv[1]; b=open(p,'rb').read(); assert hashlib.sha256(b).hexdigest()==sys.argv[2]; sys.path.insert(0,str(__import__('pathlib').Path(p).parent)); sys.argv=[p,*sys.argv[3:]]; runpy.run_path(p,run_name='__main__')";
 const transport={executable:wsl,args:owner=>['--distribution',w.distribution,'--user',w.user,'--exec',w.python,'-I','-c',bootstrap,map(bridge),digest,map(config),map(owner)]};
 return runOwned([w.python,'home4-native-partition'],cfg.sourceRoot,env,log,token,400000,null,0,transport);
}
module.exports={ownedWslWorker,ownedWorker,safeDiagnostic,safeErrorType,safeFailure,isNativeStage};
