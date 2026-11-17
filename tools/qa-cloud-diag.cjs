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
// Provisioning is owned exclusively by the preceding token-free cloud step.
// No npm/Playwright CLI is reachable from the Q browser orchestrator.
function prepare(){need(false)}
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
 const evidence=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'zamerovac-diag-evidence-'));fs.chmodSync(evidence,0o700);
 const output=process.env.GITHUB_OUTPUT;
 const summary={smoke:'NOT RUN',full:'NOT RUN',status:'BLOCKED',cleanup:'UNKNOWN',stage:'handoff'};
 let success=false,known=false,home=null,env=null;
 try{
  // Stage was independently provisioned ONCE after QUICK; only a single
  // whole-root rename and full runtime revalidation are allowed here.
  const accepted=require('./qa-cloud-handoff.cjs').acceptPrepared(process.env);
  home=accepted.scratch;
  env=childEnv(process.env,path.join(home,'home'));
  env.ZAMEROVAC_CLOUD_SCRATCH=home;
  env.ZAMEROVAC_CLOUD_RUNTIME_FILE=accepted.runtimeFile;
  env.ZAMEROVAC_CLOUD_RUNTIME_SHA256=accepted.runtimeSha;
  env.CHROMIUM_PATH=accepted.chromium;
  need(/^[1-9][0-9]*$/.test(env.ZAMEROVAC_CLOUD_DEADLINE||'')&&
       Number(env.ZAMEROVAC_CLOUD_DEADLINE)-Date.now()>30000);
  // Repeat live P/Q/E/main SHA validation after transfer, before any browser.
  await approvedLive(env);
  for(const key of Object.keys(process.env))delete process.env[key];
  Object.assign(process.env,env); // only childEnv() allowlisted browser descendants.
  const runner=require('./local-browser-qa.cjs');
  for(const [folder,mode] of [['smoke','--drawing-diagnostic'],['full','--all']]){
   summary.stage=folder;await approvedLive(env);process.env.ZAMEROVAC_QA_RESULT_PARENT=path.join(home,folder);
   known=false;const report=await runner.run(mode);known=report.cleanupVerdict==='KNOWN_CLEAN';summary[folder]=report.status;fs.writeFileSync(path.join(evidence,folder+'.json'),JSON.stringify(report),{flag:'wx',mode:0o600});if(report.status==='FAIL'&&known){const error=Error('CLOUD named failure');error.code='CLOUD_TEST_FAIL';summary.status='FAIL';throw error}verifyStage(report,mode);
  }
  await approvedLive(env);success=true;
 }finally{
  try{if(known&&home)fs.rmSync(home,{recursive:true})}catch(error){known=false;throw error}
  finally{summary.cleanup=known?'KNOWN_CLEAN':'UNKNOWN';if(success&&known)summary.status='PASS';fs.writeFileSync(path.join(evidence,'summary.json'),JSON.stringify(summary),{flag:'wx',mode:0o600})}
 }
 if(output)fs.appendFileSync(output,'cleanup=KNOWN_CLEAN\nfull_verified=true\n');
 console.log('PASS CLOUD-DIAG drawing17 and FULL23/96; KNOWN_CLEAN');
}
if(require.main===module)main().catch(error=>{console.error(error.code==='CLOUD_TEST_FAIL'?'FAIL CLOUD-DIAG named assertions; no further payload':'BLOCKED CLOUD-DIAG; STOP NO RETRY');process.exitCode=error.code==='CLOUD_TEST_FAIL'?1:78});
module.exports={childEnv,verifyStage,identity,prepare,live};
