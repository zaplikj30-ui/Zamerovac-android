'use strict';
// CLOUD-DIAG orchestration. Network preparation is invoked ONLY by a future
// separately approved hosted workflow; importing this module never provisions.
const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process'),crypto=require('node:crypto');
const runtime=require('./qa-cloud-runtime.cjs');
const need=x=>{if(!x)throw Error('CLOUD-DIAG BLOCKED')};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const identity=file=>{const s=fs.statSync(file,{bigint:true});return {dev:String(s.dev),ino:String(s.ino),size:String(s.size),mtimeNs:String(s.mtimeNs),mode:String(s.mode)}};
function childEnv(source,home){
 const keys=['PATH','LANG','LC_ALL','ImageOS','ImageVersion','CI','GITHUB_ACTIONS','GITHUB_REPOSITORY','GITHUB_ACTOR','GITHUB_TRIGGERING_ACTOR','GITHUB_EVENT_NAME','GITHUB_REF','GITHUB_RUN_ATTEMPT','GITHUB_RUN_ID','GITHUB_SHA','GITHUB_WORKFLOW_SHA','RUNNER_OS','RUNNER_ENVIRONMENT'];
 const env={};for(const k of keys)if(source[k]!==undefined)env[k]=source[k];
 for(const [k,v] of Object.entries(source))if(k.startsWith('ZAMEROVAC_')&&['ZAMEROVAC_QA_MODE','ZAMEROVAC_CLOUD_TRUST','ZAMEROVAC_EXPECTED_PRODUCT_SHA','ZAMEROVAC_CLOUD_REVIEWED_V_SHA','ZAMEROVAC_CLOUD_EVENT_SHA','ZAMEROVAC_SOURCE_ROOT','ZAMEROVAC_EXPECTED_QA_SHA','ZAMEROVAC_PYTHON','ZAMEROVAC_CLOUD_RUNTIME_FILE','ZAMEROVAC_CLOUD_RUNTIME_SHA256','ZAMEROVAC_CLOUD_SCRATCH','ZAMEROVAC_CLOUD_DEADLINE'].includes(k))env[k]=v;
 if(source.ZAMEROVAC_CLOUD_SCRATCH)env.PLAYWRIGHT_BROWSERS_PATH=path.join(source.ZAMEROVAC_CLOUD_SCRATCH,'browsers');
 return {...env,HOME:home,TMPDIR:home,TMP:home,TEMP:home,PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',GIT_CONFIG_NOSYSTEM:'1',GIT_CONFIG_GLOBAL:'/dev/null',NPM_CONFIG_USERCONFIG:'/dev/null',NPM_CONFIG_GLOBALCONFIG:'/dev/null'};
}
function verifyStage(report,mode,env=process.env){
 need(['--drawing-diagnostic','--all'].includes(mode));
 need(report?.identity?.sourceSha===env.ZAMEROVAC_EXPECTED_PRODUCT_SHA&&report.identity.validatorSha===env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA&&report.identity.eventSha===env.ZAMEROVAC_CLOUD_EVENT_SHA&&report.identity.mode==='cloud');
 const suites=mode==='--drawing-diagnostic'?['drawing']:Object.keys(require('./qa-pr121-manifest.json').cases);
 const cases=require('./qa-pr121-manifest.json').cases;
 need(report?.status==='PASS'&&report.mode===mode&&report.cleanupVerdict==='KNOWN_CLEAN'&&report.identity?.finalized===true);
 need(report.coverage?.status==='PASS'&&report.coverage.suites===suites.length&&report.coverage.cases===suites.reduce((n,s)=>n+cases[s].length,0));
 need(report.records?.length===suites.length&&report.records.every((r,i)=>r.suite===suites[i]&&r.status==='PASS'&&r.cleanupVerified===true&&r.caseCount===cases[r.suite].length&&r.cases?.length===cases[r.suite].length&&r.cases.every((c,j)=>c.name===cases[r.suite][j]&&c.status==='passed')));
 return true;
}
function prepare(){
 const e=process.env,root=e.ZAMEROVAC_CLOUD_SCRATCH;
 need(e.ZAMEROVAC_DIAG_PREPARE==='1'&&e.ZAMEROVAC_SUPERVISOR_PID===String(process.ppid)&&e.ZAMEROVAC_SCOPE==='linux-pidfd-subreaper');
 need(root&&fs.realpathSync(root)===root&&fs.statSync(root).uid===process.getuid());
 const checkpoint=stage=>fs.writeFileSync(path.join(root,'preparation.json'),JSON.stringify({stage,status:'RUNNING'}),{mode:0o600});
 checkpoint('npm-ci');const deps=path.join(root,'deps');fs.mkdirSync(deps);
 for(const name of ['package.json','package-lock.json'])fs.copyFileSync(path.join(__dirname,'qa-browser',name),path.join(deps,name),fs.constants.COPYFILE_EXCL);
 const lock=JSON.parse(fs.readFileSync(path.join(deps,'package-lock.json')));
 need(Object.keys(lock.packages).every(k=>['','node_modules/playwright','node_modules/playwright-core','node_modules/fsevents'].includes(k)));
 for(const [k,v] of Object.entries(lock.packages))if(k)need(v.resolved?.startsWith('https://registry.npmjs.org/')&&/^sha512-/.test(v.integrity));
 const env={...e,npm_config_cache:path.join(root,'npm-cache'),npm_config_registry:'https://registry.npmjs.org/',PLAYWRIGHT_BROWSERS_PATH:path.join(root,'browsers')};
 process.env.PLAYWRIGHT_BROWSERS_PATH=env.PLAYWRIGHT_BROWSERS_PATH;
 function run(exe,args,timeout){const r=cp.spawnSync(exe,args,{cwd:deps,env,encoding:'utf8',timeout,maxBuffer:2*1024*1024});if(r.status!==0||r.error||r.signal){const old=JSON.parse(fs.readFileSync(path.join(root,'preparation.json')));fs.writeFileSync(path.join(root,'preparation.json'),JSON.stringify({...old,status:'FAIL',exit:r.status,signal:r.signal||null}));need(false)}}
 run('npm',['ci','--ignore-scripts','--no-audit','--no-fund'],180000);
 checkpoint('archives');const archives={};fs.mkdirSync(path.join(root,'archives'));
 for(const name of ['playwright','playwright-core']){
  const item=lock.packages['node_modules/'+name];need(item.version==='1.62.1');
  const hex=Buffer.from(item.integrity.slice(7),'base64').toString('hex');
  const bytes=fs.readFileSync(path.join(env.npm_config_cache,'_cacache/content-v2/sha512',hex.slice(0,2),hex.slice(2,4),hex.slice(4)));
  need('sha512-'+crypto.createHash('sha512').update(bytes).digest('base64')===item.integrity);
  const file=path.join(root,'archives',name+'.tgz');fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});archives[name]={path:file,integrity:item.integrity};
 }
 // npm-generated launch symlink/metadata are not executable dependency inputs.
 const bin=path.join(deps,'node_modules/.bin');if(fs.existsSync(bin)){for(const n of fs.readdirSync(bin)){need(['playwright','playwright-core'].includes(n)&&fs.lstatSync(path.join(bin,n)).isSymbolicLink());fs.unlinkSync(path.join(bin,n))}fs.rmdirSync(bin)}
 fs.unlinkSync(path.join(deps,'node_modules/.package-lock.json'));
 checkpoint('module-tree');const files={};function walk(d){for(const n of fs.readdirSync(d)){const f=path.join(d,n),s=fs.lstatSync(f);need(!s.isSymbolicLink());if(s.isDirectory())walk(f);else{need(s.isFile()&&s.nlink===1);files[path.relative(deps,f)]=hash(fs.readFileSync(f))}}}walk(path.join(deps,'node_modules'));
 runtime.exactlyTree(deps,files);
 const loader=require('node:module').createRequire(path.join(deps,'entry.cjs'));
 const entry=loader.resolve('playwright'),core=loader.resolve('playwright-core');need(require('node:module').createRequire(entry).resolve('playwright-core')===core);
 checkpoint('browser-install');run(process.execPath,[path.join(deps,'node_modules/playwright/cli.js'),'install','chromium','--no-shell'],240000);
 checkpoint('browser-identity');const browserPath=loader('playwright').chromium.executablePath();need(fs.realpathSync(browserPath)===browserPath);
 const revision=JSON.parse(fs.readFileSync(path.join(deps,'node_modules/playwright-core/browsers.json'))).browsers.find(b=>b.name==='chromium').revision;
 need(browserPath.includes('chromium-'+revision+path.sep));
 const binary=file=>({path:file,sha256:hash(runtime.checked(file,1024*1024*1024))});
 const chromium={...binary(browserPath),magic:'7f454c46',identity:identity(browserPath),revision};need(runtime.checked(browserPath,1024*1024*1024).subarray(0,4).toString('hex')===chromium.magic);
 const r={schema:2,runtimeApproved:true,trustModel:'trusted-host/change-detection',scratch:root,productSha:e.ZAMEROVAC_EXPECTED_PRODUCT_SHA,validatorSha:e.ZAMEROVAC_CLOUD_REVIEWED_V_SHA,eventSha:e.ZAMEROVAC_CLOUD_EVENT_SHA,imageOS:e.ImageOS,imageVersion:e.ImageVersion,linuxUid:process.getuid(),node:binary(fs.realpathSync(process.execPath)),python:binary(fs.realpathSync(e.ZAMEROVAC_PYTHON)),chromium,playwright:{root:deps,files,archives},lockSha256:hash(fs.readFileSync(path.join(__dirname,'qa-browser/package-lock.json')))};
 checkpoint('profile-write');fs.writeFileSync(path.join(root,'runtime.json'),JSON.stringify(r),{flag:'wx',mode:0o600});
 fs.writeFileSync(path.join(root,'preparation.json'),JSON.stringify({stage:'complete',status:'PASS'}),{mode:0o600});
}
async function live(env,request=fetch){
 const token=env.QA_CLOUD_METADATA_TOKEN||'';
 if(request===fetch)need(token.length>0);
 const get=async suffix=>{
  const url='https://api.github.com/repos/zaplikj30-ui/Zamerovac-android'+(suffix?'/'+suffix:'');
  const headers={'User-Agent':'zamerovac-cloud-diag'};
  if(token)headers.Authorization='Bearer '+token;
  const r=await request(url,{headers,signal:AbortSignal.timeout(12000)});
  // Log only a fixed resource path and status; never response body, URL query or auth header.
  if(!r.ok)console.error('CLOUD-DIAG metadata BLOCKED '+(suffix||'repository')+' HTTP '+r.status);
  need(r.ok);
  console.log('CLOUD-DIAG metadata HTTP PASS '+(suffix||'repository'));
  return r.json();
 };
 const repo=await get('');need(repo.private===false);
 const main=await get('git/ref/heads/main');need(main.object?.sha===env.ZAMEROVAC_CLOUD_EVENT_SHA);
 const validatorBranch=await get('git/ref/heads/fix/cloud-validator-owner-comment-live-20261117');
 need(validatorBranch.object?.sha===env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA);
 for(const [n,sha,base] of [[150,env.ZAMEROVAC_EXPECTED_PRODUCT_SHA,'main'],[155,'9f733b24194a7870fa1377b256076bca7a71eb5a','implement/home4-p1-p4-20261115'],[156,'ca6c23727f692e26811d9e7f3b346116533aa6b5','programator/cloud-qa-a1-a3-20261116']]){
  const pr=await get('pulls/'+n);need(pr.state==='open'&&pr.head?.sha===sha&&pr.head?.repo?.full_name==='zaplikj30-ui/Zamerovac-android'&&pr.base?.ref===base);
 }
}
async function main(){
 const root=path.resolve(__dirname,'..'),integrity=require('./qa-integrity.cjs');
 console.log('CLOUD-DIAG gateSnapshot START');
 const q=require('./local-browser-qa.cjs').gateSnapshot();
 console.log('CLOUD-DIAG gateSnapshot PASS');
 integrity.cloudIdentity(q,process.env);
 console.log('CLOUD-DIAG cloudIdentity PASS');
 integrity.sourceSnapshot(process.env.ZAMEROVAC_SOURCE_ROOT);
 console.log('CLOUD-DIAG sourceSnapshot PASS');
 const metadataToken=process.env.QA_CLOUD_METADATA_TOKEN;
 need(metadataToken);
 const approvedLive=env=>live({...env,QA_CLOUD_METADATA_TOKEN:metadataToken});
 need(process.env.GITHUB_WORKFLOW_SHA===process.env.GITHUB_SHA);
 need(process.env.QA_APPROVED_Q===q&&process.env.QA_APPROVED_E===process.env.GITHUB_SHA);
 console.log('CLOUD-DIAG external SHA consent PASS');
 await approvedLive(process.env);
 console.log('CLOUD-DIAG live metadata PASS');
 const home=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'zamerovac-diag-'));fs.chmodSync(home,0o700);
 const evidence=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'zamerovac-diag-evidence-'));fs.chmodSync(evidence,0o700);
 const env=childEnv(process.env,home);env.ZAMEROVAC_CLOUD_SCRATCH=home;env.ZAMEROVAC_CLOUD_DEADLINE=String(Date.now()+200*60000);
 const {ownedWorker}=require('./qa-process-client.cjs');const token=crypto.randomBytes(16).toString('hex');
 const prepEnv={...env,ZAMEROVAC_DIAG_PREPARE:'1'};delete prepEnv.ZAMEROVAC_QA_MODE;
 const output=process.env.GITHUB_OUTPUT;const summary={smoke:'NOT RUN',full:'NOT RUN',status:'BLOCKED',cleanup:'UNKNOWN',stage:'prepare'};let success=false;
 let known=false;
 try{
  console.log('CLOUD-DIAG prepare START');
  const life=await ownedWorker([process.execPath,__filename,'--prepare'],root,prepEnv,path.join(home,'prepare.log'),token,480000);
  // Only allowlisted technical status/stage/type, no raw stdout, stderr, token or paths.
  const {safeDiagnostic,safeErrorType}=require('./qa-process-client.cjs');
  const telemetry={
    status:life.status==='PASS'?'PASS':'BLOCKED',
    cleanupVerified:life.cleanupVerified===true,
    stage:safeDiagnostic(life.diagnostic).stage,
    firstFailureStage:life.firstFailure?safeDiagnostic(life.firstFailure).stage:null,
    errorType:life.error?safeErrorType(life.error):null,
    cleanupErrorType:life.cleanupErrorType?safeErrorType(life.cleanupErrorType):null,
    supervisorExit:Number.isInteger(life.supervisorExit)?life.supervisorExit:null
  };
  console.log('CLOUD-DIAG supervisor telemetry '+JSON.stringify(telemetry));
  // Parent reads only the child's fixed-stage result, not its private stderr/log.
  const prepStateFile=path.join(home,'preparation.json');
  const allowedPrepStages=new Set(['npm-ci','archives','module-tree','browser-install','browser-identity','profile-write','complete']);
  let prepStage='missing',prepStatus='unknown',prepExit=null;
  if(fs.existsSync(prepStateFile)){
    try{
      const state=JSON.parse(fs.readFileSync(prepStateFile,'utf8'));
      prepStage=allowedPrepStages.has(state.stage)?state.stage:'unknown';
      prepStatus=['RUNNING','FAIL','PASS'].includes(state.status)?state.status:'unknown';
      prepExit=Number.isInteger(state.exit)&&state.exit>=0&&state.exit<=255?state.exit:null;
    }catch{prepStage='unreadable'}
  }
  console.log('CLOUD-DIAG preparation telemetry '+JSON.stringify({stage:prepStage,status:prepStatus,exitCode:prepExit}));
  known=life.cleanupVerified===true;if(known&&fs.existsSync(path.join(home,'preparation.json')))fs.copyFileSync(path.join(home,'preparation.json'),path.join(evidence,'preparation.json'),fs.constants.COPYFILE_EXCL);need(life.status==='PASS'&&known);
  console.log('CLOUD-DIAG prepare and cleanup PASS');
  env.ZAMEROVAC_CLOUD_RUNTIME_FILE=path.join(home,'runtime.json');env.ZAMEROVAC_CLOUD_RUNTIME_SHA256=hash(fs.readFileSync(env.ZAMEROVAC_CLOUD_RUNTIME_FILE));
  const r=runtime.approvedRuntime(env);env.CHROMIUM_PATH=r.chromium.path;
  for(const key of Object.keys(process.env))delete process.env[key];Object.assign(process.env,env); // run() creates only allowlisted descendants.
  const runner=require('./local-browser-qa.cjs');
  for(const [folder,mode] of [['smoke','--drawing-diagnostic'],['full','--all']]){
   summary.stage=folder;await approvedLive(env);process.env.ZAMEROVAC_QA_RESULT_PARENT=path.join(home,folder);
   known=false;const report=await runner.run(mode);known=report.cleanupVerdict==='KNOWN_CLEAN';summary[folder]=report.status;fs.writeFileSync(path.join(evidence,folder+'.json'),JSON.stringify(report),{flag:'wx',mode:0o600});if(report.status==='FAIL'&&known){const error=Error('CLOUD named failure');error.code='CLOUD_TEST_FAIL';summary.status='FAIL';throw error}verifyStage(report,mode);
  }
  await approvedLive(env);success=true;
 }finally{
  try{if(known)fs.rmSync(home,{recursive:true})}catch(error){known=false;throw error}
  finally{summary.cleanup=known?'KNOWN_CLEAN':'UNKNOWN';if(success&&known)summary.status='PASS';fs.writeFileSync(path.join(evidence,'summary.json'),JSON.stringify(summary),{flag:'wx',mode:0o600})}
 }
 if(output)fs.appendFileSync(output,'cleanup=KNOWN_CLEAN\nfull_verified=true\n');
 console.log('PASS CLOUD-DIAG drawing17 and FULL23/96; KNOWN_CLEAN');
}
if(require.main===module){if(process.argv[2]==='--prepare'){try{prepare()}catch{process.exitCode=78}}else main().catch(error=>{console.error(error.code==='CLOUD_TEST_FAIL'?'FAIL CLOUD-DIAG named assertions; no further payload':'BLOCKED CLOUD-DIAG; STOP NO RETRY');process.exitCode=error.code==='CLOUD_TEST_FAIL'?1:78})}
module.exports={childEnv,verifyStage,identity,prepare,live};
