'use strict';
const fs=require('node:fs'),path=require('node:path');
const {spawn}=require('node:child_process');
const supervisor=path.join(__dirname,'qa_process_supervisor.py');
async function ownedWorker(command,cwd,env,log,token,timeoutMs=480000,signal){
 const configFile=log+'.owner.json';
 fs.writeFileSync(configFile,JSON.stringify({command,cwd,log,token,timeout:timeoutMs/1000,heartbeatTimeout:5,
  browser:command[1]===path.join(__dirname,'qa-browser-worker.cjs')}),{flag:'wx'});
 return new Promise(resolve=>{
  let stdout='',stderr='',finished=false,child;
  const finish=result=>{if(finished)return;finished=true;clearInterval(heartbeat);signal?.removeEventListener('abort',cancel);resolve(result)};
  const cancel=()=>{if(child?.stdin?.writable)child.stdin.end('CANCEL '+token+'\n')};
  // Killing just this supervisor is deliberately not a timeout strategy: EOF
  // lets it contain/reap the full workload; Windows also has kernel Job cleanup.
  const heartbeat=setInterval(()=>{if(child?.stdin?.writable)child.stdin.write('ALIVE '+token+'\n')},1000);
  try{
   child=spawn(env.ZAMEROVAC_PYTHON||(process.platform==='win32'?'python':'python3'),[supervisor,'--config',configFile],
    {cwd:__dirname,env,windowsHide:true,stdio:['pipe','pipe','pipe']});
   child.stdin.on('error',()=>{});
   child.stdout.on('data',data=>{stdout+=data;if(stdout.length>1024*1024)cancel()});
   child.stderr.on('data',data=>{if(stderr.length<16000)stderr+=data});
   child.once('error',e=>finish({status:'BLOCKED',cleanupVerified:false,error:e.message}));
   child.once('close',(code,exitSignal)=>{
    let report;
    try{
     report=JSON.parse(stdout.trim().split('\n').at(-1));
     if(exitSignal||![0,77].includes(code))report={...report,error:'supervisor failed: '+String(code||exitSignal)+' '+stderr};
     if(report.event!=='result'||report.token!==token||report.cleanupVerified!==true||code!==0||report.status!=='PASS')
      report={...report,status:'BLOCKED'};
    }catch(e){report={status:'BLOCKED',cleanupVerified:false,error:'missing owned-process evidence: '+stderr}}
    finish({...report,supervisorExit:code,signal:exitSignal});
   });
   signal?.addEventListener('abort',cancel,{once:true});
   if(signal?.aborted)cancel();
  }catch(e){finish({status:'BLOCKED',cleanupVerified:false,error:e.message})}
 });
}
module.exports={ownedWorker};
