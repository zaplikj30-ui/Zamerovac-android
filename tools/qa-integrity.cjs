'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const manifest=require('./qa-pr121-manifest.json');
const {checkEvidence,blocked}=require('./e2e/sandbox.cjs');
const {profiles}=require('./qa-browser-identity.cjs');
// Preserve PR121's explicit diagnostic mode; it is never full --all coverage.
const modes=Object.freeze({'--legacy-conflict':['legacy-conflict-persistence'],
 '--smoke':['drawing','quality-regressions','gallery-readability'],'--all':Object.keys(manifest.cases)});
function demand(ok,message){if(!ok)throw blocked(message)}
function noFilter(env=process.env){demand(!Object.hasOwn(env,'ZAMEROVAC_CASES'),'case filter forbidden in complete/smoke QA')}
function executionIdentity(validatorSha,env=process.env){
 if(env.GITHUB_ACTIONS!=='true')return {runId:null,runAttempt:null};
 demand(env.GITHUB_REPOSITORY==='zaplikj30-ui/Zamerovac-android'&&env.GITHUB_ACTOR==='zaplikj30-ui'&&
  env.GITHUB_TRIGGERING_ACTOR==='zaplikj30-ui'&&env.GITHUB_RUN_ATTEMPT==='1'&&
  env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.GITHUB_REF==='refs/heads/main'&&
  /^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')&&env.HOME4_APPROVED_MAIN_SHA===env.GITHUB_SHA&&
  env.HOME4_SOURCE_SHA===manifest.sourceSha&&env.HOME4_VALIDATOR_SHA===validatorSha&&
  env.ZAMEROVAC_EXPECTED_QA_SHA===validatorSha&&/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID||''),
  'unapproved owner/ref/SHA/run attempt; no rerun or arbitrary PR/fork');
 return {runId:env.GITHUB_RUN_ID,runAttempt:1};
}
function sourceSnapshot(root){
 const git=args=>execFileSync('git',args,{cwd:root,encoding:'utf8',timeout:15000,windowsHide:true});
 demand(git(['rev-parse','HEAD']).trim()===manifest.sourceSha,'expected exact integrated source SHA');
 demand(!git(['status','--porcelain','--untracked-files=all']).trim(),'source checkout must be clean');
 const found=[];
 function walk(relative){
  for(const entry of fs.readdirSync(path.join(root,relative),{withFileTypes:true})){
   const name=relative+'/'+entry.name;
   demand(!entry.isSymbolicLink(),'redirected source entry');
   if(entry.isDirectory())walk(name);else found.push(name);
  }
 }
 for(const name of ['app/src/main/assets','tools/e2e'])walk(name);
 const expected=Object.keys({...manifest.files,...manifest.sourceDependencies}).filter(n=>n.startsWith('app/src/main/assets/')||n.startsWith('tools/e2e/'));
 demand(JSON.stringify(found.sort())===JSON.stringify(expected.sort()),'extra/missing source file (including ignored files)');
 for(const [name,expected] of Object.entries({...manifest.files,...manifest.sourceDependencies})){
  const file=path.join(root,name),stat=fs.lstatSync(file);
  demand(stat.isFile()&&!stat.isSymbolicLink(),'source file redirected: '+name);
  demand(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')===expected,'source bytes changed: '+name);
 }
 return manifest.sourceSha;
}
function checkedReport(report,suite,identity){
 demand(report&&report.suite===suite&&report.sha===identity.sourceSha&&
  report.validatorSha===identity.validatorSha&&report.runToken===identity.runToken&&
  report.syntheticOnly===true&&report.filtered===false&&report.status==='COMPLETE','stale/mismatched/filtered/incomplete suite identity');
 checkEvidence(report.sandbox,identity.platform||process.platform);
 const binary=profiles[identity.platform||process.platform];
 demand(binary&&report.sandbox.binary?.path===binary.path&&report.sandbox.binary?.sha256===binary.sha256,'untrusted suite browser identity');
 const expected=manifest.cases[suite];
 demand(expected&&Array.isArray(report.cases)&&report.cases.length===expected.length,'missing/extra suite cases');
 demand(report.cases.every((c,i)=>c.name===expected[i]&&c.status==='passed'),'duplicate/renamed/reordered/failed case');
 return {scenarioNames:report.cases.map(c=>c.name),scenarioTotal:report.cases.length};
}
function complete(mode,records,identity,env=process.env){
 try{
  noFilter(env);const expected=modes[mode];demand(expected&&records.length===expected.length,'incomplete suite manifest');
  demand(!identity?.error,'run integrity failed');
  demand(identity?.finalized===true,'run has not completed final integrity/cleanup checks');
  demand(!identity?.platform||identity.platform===process.platform,'platform evidence cannot be inherited from another OS');
  demand(identity?.sourceSha===manifest.sourceSha&&/^[a-f0-9]{40}$/.test(identity.validatorSha)&&/^[a-f0-9]{32}$/.test(identity.runToken),'missing run/source/validator identity');
  records.forEach((r,i)=>{
   demand(r.suite===expected[i]&&r.status==='PASS'&&r.cleanupVerified===true,'suite missing/duplicate/failed cleanup');
   checkedReport(r.report,r.suite,identity);
  });
  return {status:'PASS',suites:records.length,cases:records.reduce((n,r)=>n+r.report.cases.length,0)};
 }catch(e){return {status:'BLOCKED',error:e.message}}
}
module.exports={manifest,modes,noFilter,executionIdentity,sourceSnapshot,checkedReport,complete};
