'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {verifyFile}=require('../qa-browser-identity.cjs');
const p=require('./home4-policy.cjs'),{ownedWorker}=require('../qa-process-client.cjs');
const root=path.resolve(__dirname,'../..');
function diskBytes(folder){let n=0;for(const e of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,e.name),s=fs.lstatSync(file);p.demand(!s.isSymbolicLink(),'workspace-redirection');n+=s.isDirectory()?diskBytes(file):s.size}return n}
function reserve(folder){
 const marker=path.join(folder,'home4.STOP');fs.mkdirSync(marker);const s=fs.lstatSync(marker);
 p.demand(s.isDirectory()&&!s.isSymbolicLink()&&s.ino!==0,'admission-identity');
 return {path:marker,dev:s.dev,ino:s.ino}; // no reuse/TTL/reset
}
function checkLease(lease){const s=fs.lstatSync(lease.path);p.demand(s.isDirectory()&&!s.isSymbolicLink()&&s.dev===lease.dev&&s.ino===lease.ino,'admission-changed')}
function release(lease){checkLease(lease);fs.unlinkSync(path.join(lease.path,'evidence.json'));fs.rmdirSync(lease.path);p.demand(!fs.existsSync(lease.path),'admission-release')}
async function run(phase,sourceRoot,inventoryFile,inventoryHash,pins,env=process.env){
 const identity=p.execution(env,pins);
 if(phase==='preview')p.previewAllowed();
 p.demand(process.platform==='win32','windows-home-only');
 const profile=p.json(inventoryFile,inventoryHash);p.demand(profile.verified===true&&profile.platform==='win32'&&profile.diskEvidence?.verified===true,'inventory-unverified');
 const node=p.executable(profile.components.node),python=p.executable(profile.components.python),git=p.executable(profile.components.git);
 const expectedNode=fs.lstatSync(node,{bigint:true});
 verifyFile(process.execPath,{path:process.execPath,sha256:profile.components.node.files[profile.components.node.entry.replaceAll('\\','/')],magic:'4d5a'});
 const runningNode=fs.lstatSync(process.execPath,{bigint:true});
 p.demand(expectedNode.ino!==0n&&runningNode.ino===expectedNode.ino&&runningNode.dev===expectedNode.dev,'node-identity');
 p.snapshot(root,pins.validatorSha,git);p.snapshot(sourceRoot,pins.sourceSha,git);
 // Trusted single read-only metadata bootstrap: no workload or child creation.
 const acl=cp.spawnSync(python,[path.join(__dirname,'home4-private.py'),profile.privateRoot],{encoding:'utf8',timeout:15000,windowsHide:true,shell:false});
 p.demand(!acl.error&&acl.status===0&&!acl.stderr&&JSON.parse(acl.stdout).private===true,'private-root-acl');
 const marker=reserve(profile.privateRoot),token=crypto.randomBytes(16).toString('hex');
 const privateDir=path.join(profile.privateRoot,'run-'+identity.runId+'-'+token);fs.mkdirSync(privateDir);
 const childAcl=cp.spawnSync(python,[path.join(__dirname,'home4-private.py'),marker.path,privateDir],{encoding:'utf8',timeout:15000,windowsHide:true,shell:false});
 p.demand(!childAcl.error&&childAcl.status===0&&!childAcl.stderr&&JSON.parse(childAcl.stdout).private===true,'private-child-acl');
 const pointer=fs.openSync(path.join(marker.path,'evidence.json'),'wx');
 try{fs.writeFileSync(pointer,JSON.stringify({privateDirectory:privateDir,binding:identity}));fs.fsyncSync(pointer)}finally{fs.closeSync(pointer)}
 let known=false;
 try{
  const cfg={phase,startedNs:String(BigInt(Date.now())*1000000n),binding:identity,sourceRoot,validatorRoot:root,profileFile:inventoryFile,profileHash:inventoryHash,profile,privateDir,token,python,
   sourceFiles:p.contentManifest(sourceRoot,pins.sourceSha,git),validatorFiles:p.contentManifest(root,pins.validatorSha,git)};
  const file=path.join(privateDir,'config.json');fs.writeFileSync(file,JSON.stringify(cfg),{flag:'wx'});
  const controller=new AbortController();let exceeded=false;
  function checkBudget(){try{const disk=fs.statfsSync(privateDir);if(diskBytes(privateDir)>2*1024**3||disk.bavail*disk.bsize<10*1024**3){exceeded=true;controller.abort()}}catch{exceeded=true;controller.abort()}}
  const timer=setInterval(checkBudget,500);
  async function command(kind,group){
   checkLease(marker);checkBudget();p.demand(!controller.signal.aborted,'stopped-no-retry');
   const log=path.join(privateDir,'command-'+crypto.randomBytes(8).toString('hex')+'.log');
   const outcome=await ownedWorker([node,path.join(__dirname,'home4-command-worker.cjs'),kind,group,file],root,
    {...env,ZAMEROVAC_PYTHON:python,PATH:path.join(profile.components.jdk.root,'bin')+';'+path.dirname(node)+';'+path.dirname(python)+';'+path.dirname(git)+';'+env.PATH},log,token,420000,controller.signal);
   p.demand(!exceeded&&outcome.cleanupVerified===true&&outcome.cleanupEvidence?.remainingProcesses===0,'command-cleanup');
   p.demand(outcome.status==='PASS','command-failed');
   const report=JSON.parse(fs.readFileSync(log,'utf8').trim());p.demand(JSON.stringify(report.binding)===JSON.stringify(identity),'report-binding');return report;
  }
  let report;
  try{
   // Full inventory/cache verification occurs inside the existing owned scope.
   if(phase==='quick'){
    await command('preflight','');
    const registry=require('./home4-quick.json'),groups=Object.entries(registry.node).filter(([,v])=>v.cases.length>v.windowsNotRun.length).map(([f])=>f);
    const results=[];for(const group of [...groups,'python'])results.push(await command('quick',group));
    report={status:'PASS',groups:results.length,required:results.reduce((n,r)=>n+r.counts.required,0),fail:0,skip:0};
   }else if(phase==='browser'){
    await command('preflight','');
    p.executable(profile.components.chromium);
    const saved={...process.env};Object.assign(process.env,{ZAMEROVAC_SOURCE_ROOT:sourceRoot,ZAMEROVAC_QA_RESULT_PARENT:path.join(privateDir,'browser'),ZAMEROVAC_EXPECTED_QA_SHA:pins.validatorSha,ZAMEROVAC_PYTHON:python,CHROMIUM_PATH:path.join(profile.components.chromium.root,profile.components.chromium.entry),NODE_PATH:profile.components.playwright.root,LOCALAPPDATA:privateDir,HOME4_SOURCE_SHA:pins.sourceSha,HOME4_VALIDATOR_SHA:pins.validatorSha});
    const originalLog=console.log,originalError=console.error;
    console.log=console.error=(...args)=>{const text=args.map(String).join(' ').slice(0,8192)+'\n';const log=path.join(privateDir,'browser-private.log');if(fs.existsSync(log)&&fs.statSync(log).size+Buffer.byteLength(text)>16*1024**2){controller.abort();p.fail('browser-log-limit')}fs.appendFileSync(path.join(privateDir,'browser-private.log'),text,{mode:0o600})};
    try{
     const result=await require('../local-browser-qa.cjs').run('--all',controller.signal);
     p.demand(result.status==='PASS'&&result.coverage.suites===23&&result.coverage.cases===96,'browser-complete');report={status:'PASS',suites:23,cases:96};
    }finally{console.log=originalLog;console.error=originalError;for(const key of Object.keys(process.env))if(!(key in saved))delete process.env[key];Object.assign(process.env,saved)}
   }else if(phase==='native'){
    await command('preflight','');
    await command('native','probes');
    for(const name of Object.keys(require('./home4-jvm.json').xml))await command('native',name);
    report=await command('native-final','');
   }else if(phase==='preview')p.previewAllowed();
   else p.fail('phase');
  }finally{clearInterval(timer)}
  p.demand(!exceeded,'disk-log-budget');p.snapshot(root,pins.validatorSha,git);p.snapshot(sourceRoot,pins.sourceSha,git);known=true;
  return {...report,binding:identity,cleanupVerified:true};
 }finally{
  // No deletion or PID recovery on unknown state; next run sees the STOP lease.
  if(known){checkLease(marker);fs.rmSync(privateDir,{recursive:true});p.demand(!fs.existsSync(privateDir),'private-cleanup');release(marker)}
 }
}
if(require.main===module){
 const [phase,source,inventory,digest,sourceSha,validatorSha]=process.argv.slice(2);
 run(phase,source,inventory,digest,{sourceSha,validatorSha}).then(r=>console.log(JSON.stringify(r))).catch(e=>{
  console.log(JSON.stringify({status:'BLOCKED',phase:/^[a-z0-9-]+$/.test(e.phase||'')?e.phase:'home4-gate',retry:false}));process.exitCode=78;
 });
}
module.exports={run,reserve,checkLease,release,diskBytes};
