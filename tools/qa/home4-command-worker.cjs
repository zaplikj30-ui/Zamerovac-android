'use strict';
// Internal payload inside the EXISTING Windows Job owner. Raw output is private.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const policy=require('./home4-policy.cjs');
async function main(){
 const [phase,group,configFile]=process.argv.slice(2),cfg=policy.json(configFile),root=path.resolve(__dirname,'../..');
 policy.demand(process.platform==='win32'&&process.env.ZAMEROVAC_SCOPE==='windows-private-job'&&process.env.ZAMEROVAC_SUPERVISOR_PID===String(process.ppid),'owned-command-required');
 let report;
 if(phase==='preflight'){
  const child=cp.spawnSync(cfg.python,[path.join(__dirname,'home4_preflight.py'),configFile],{cwd:root,encoding:'utf8',shell:false,windowsHide:true,timeout:120000,maxBuffer:1024*1024,env:{...process.env,HOME4_COMMAND_WORKER_PID:String(process.pid)}});
  policy.demand(!child.error&&!child.signal&&child.status===0&&!child.stderr,'preflight-exit');report=JSON.parse(child.stdout);
  policy.demand(report.status==='PASS','preflight-report');
 }else if(phase==='quick'){
  const registry=require('./home4-quick.json');let args,executable;
  if(group==='python'){
   executable=cfg.python;args=['tools/qa/home4-unittest.py'];
  }else{
   policy.demand(Object.hasOwn(registry.node,group),'quick-group');
   const item=registry.node[group],required=item.cases.filter(n=>!item.windowsNotRun.includes(n));
   const escape=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
   executable=process.execPath;args=['--test',...(item.windowsNotRun.length?['--test-name-pattern=^(?:'+required.map(escape).join('|')+')$']:[]),'--test-reporter=./tools/qa/home4-node-reporter.cjs',group];
  }
  const child=cp.spawnSync(executable,args,{cwd:root,windowsHide:true,shell:false,encoding:'utf8',timeout:360000,maxBuffer:16*1024*1024,
   env:{...process.env,HOME4_COMMAND_WORKER_PID:String(process.pid),HOME4_PRIVATE_DIR:cfg.privateDir,TMP:cfg.privateDir,TEMP:cfg.privateDir,TMPDIR:cfg.privateDir,LOCALAPPDATA:cfg.privateDir,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1'}});
  policy.demand(!child.error&&!child.signal&&child.status===0&&!child.stderr,'quick-process-exit');
  const evidence=JSON.parse(child.stdout.trim());
  const item=group==='python'?registry.python:registry.node[group];
  report={status:'PASS',...policy.structuredCases(evidence,item,group==='python'?'home4-python-v1':'home4-node-v1'),binding:cfg.binding};
 }else if(phase==='native'){
  const {ownedWslWorker}=require('../qa-process-client.cjs');
  const result=await ownedWslWorker(cfg,process.env,path.join(cfg.privateDir,'wsl-owner-'+group+'.log'),cfg.token,group);
  policy.demand(result.status==='PASS'&&result.cleanupVerified===true&&result.cleanupEvidence?.remainingProcesses===0,'wsl-owner-cleanup');
  report=policy.json(path.join(cfg.privateDir,group+'.json'));
  policy.demand(JSON.stringify(report.binding)===JSON.stringify(cfg.binding)&&report.token===cfg.token&&report.status==='PASS','native-report-binding');
 }else if(phase==='native-final'){
  const child=cp.spawnSync(cfg.python,[path.join(__dirname,'home4-finalize.py'),configFile],{cwd:root,encoding:'utf8',shell:false,windowsHide:true,timeout:120000,maxBuffer:1024*1024,env:{...process.env,HOME4_COMMAND_WORKER_PID:String(process.pid)}});
  policy.demand(!child.error&&!child.signal&&child.status===0&&!child.stderr,'native-final-exit');report=JSON.parse(child.stdout);
 }else policy.fail('unknown-command');
 process.stdout.write(JSON.stringify(report)+'\n');
}
if(require.main===module)main().catch(()=>{process.stdout.write('{"status":"BLOCKED","phase":"command-worker"}\n');process.exitCode=1});
module.exports={main};
