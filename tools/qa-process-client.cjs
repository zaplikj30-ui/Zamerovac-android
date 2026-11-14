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
const supervisor=path.join(__dirname,'qa_process_supervisor.py');
async function ownedWorker(command,cwd,env,log,token,timeoutMs=480000,signal){
 const configFile=log+'.owner.json';
 fs.writeFileSync(configFile,JSON.stringify({command,cwd,log,token,timeout:timeoutMs/1000,heartbeatTimeout:5,
  browser:command[1]===path.join(__dirname,'qa-browser-worker.cjs')}),{flag:'wx'});
 return new Promise(resolve=>{
  let stdout='',stderr='',finished=false,protocolOverflow=false,child;
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
   child.stderr.on('data',data=>{stderr+=data.toString().slice(0,Math.max(0,16000-stderr.length))});
   child.once('error',e=>finish({status:'BLOCKED',cleanupVerified:false,error:e.message,diagnostic:safeDiagnostic(null,'owner-launch')}));
   child.once('close',(code,exitSignal)=>{
    let report;
    try{
     if(protocolOverflow)throw Error('supervisor output limit exceeded');
     report=JSON.parse(stdout.trim().split('\n').at(-1));
     report.diagnostic=report.event==='result'&&report.token===token&&report.platform===process.platform?
      report.status==='PASS'&&report.diagnostic==null?null:safeDiagnostic(report.diagnostic,'owner-exit'):safeDiagnostic(null,'owner-protocol');
     if(exitSignal||![0,77].includes(code))report={...report,error:'supervisor failed: '+String(code||exitSignal)+' '+stderr};
     if(report.event!=='result'||report.token!==token||report.cleanupVerified!==true||code!==0||report.status!=='PASS')
      report={...report,status:'BLOCKED'};
    }catch(e){report={status:'BLOCKED',cleanupVerified:false,error:'missing owned-process evidence: '+stderr,
     diagnostic:safeDiagnostic(null,protocolOverflow?'owner-overflow':'owner-protocol')}}
    finish({...report,supervisorExit:code,signal:exitSignal});
   });
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  }catch(e){finish({status:'BLOCKED',cleanupVerified:false,error:e.message,diagnostic:safeDiagnostic(null,'owner-launch')})}
 });
}
module.exports={ownedWorker,safeDiagnostic};
