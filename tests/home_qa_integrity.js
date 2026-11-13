'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const runner=require('../tools/local-browser-qa.cjs');
const integrity=require('../tools/qa-integrity.cjs');
const {profiles,verifyFile}=require('../tools/qa-browser-identity.cjs');
const crypto=require('node:crypto'),vm=require('node:vm'),{execFileSync}=require('node:child_process');
const linuxProof={platform:'linux',evaluation:'You are adequately sandboxed.',rows:[
 ['Layer 1 Sandbox','Namespace'],['PID namespaces','Yes'],['Network namespaces','Yes'],
 ['Seccomp-BPF sandbox','Yes'],['Seccomp-BPF sandbox supports TSYNC','Yes']]};
const windowsProof={platform:'win32',rows:[['123','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]};
const proof=process.platform==='win32'?windowsProof:linuxProof;
function positive(){
 const identity={sourceSha:integrity.manifest.sourceSha,validatorSha:'b'.repeat(40),runToken:'a'.repeat(32),finalized:true};
 const records=integrity.modes['--all'].map(suite=>({suite,status:'PASS',cleanupVerified:true,report:{
  suite,sha:identity.sourceSha,validatorSha:identity.validatorSha,runToken:identity.runToken,filtered:false,
  status:'COMPLETE',syntheticOnly:true,sandbox:{...proof,binary:profiles[process.platform]},
  cases:integrity.manifest.cases[suite].map(name=>({name,status:'passed'}))}}));
 return {records,identity};
}
test('integration preserves all 23 PR121 suites',()=>assert.equal(runner.modes['--all'].length,23));
test('Actions identity preserves owner, exact ref/SHA and first-attempt protections',()=>{
 const sha='b'.repeat(40),env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zaplikj30-ui/Zamerovac-android',
  GITHUB_ACTOR:'zaplikj30-ui',GITHUB_TRIGGERING_ACTOR:'zaplikj30-ui',GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'123',
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/qa/browser-smoke-offline-20261113-run',ZAMEROVAC_EXPECTED_QA_SHA:sha};
 assert.deepEqual(integrity.executionIdentity(sha,env),{runId:'123',runAttempt:1});
 for(const change of [{GITHUB_ACTOR:'other'},{GITHUB_TRIGGERING_ACTOR:'other'},
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ID:undefined},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REF:'refs/heads/qa/other'},{GITHUB_REPOSITORY:'other/fork'},{ZAMEROVAC_EXPECTED_QA_SHA:'c'.repeat(40)}])
  assert.throws(()=>integrity.executionIdentity(sha,{...env,...change}));
});
test('21 exit-zero suite records without named scenarios cannot be full PASS',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-incomplete-'));
 try{
  const records=runner.modes['--all'].map(suite=>({suite,status:'PASS'}));
  assert.notEqual(runner.statusReport('--all',records,dir).status,'PASS');
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('a case filter cannot be labelled complete PASS',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-filter-')),old=process.env.ZAMEROVAC_CASES;
 try{
  process.env.ZAMEROVAC_CASES='dimension';
  const records=runner.modes['--all'].map(suite=>({suite,status:'PASS'}));
  assert.notEqual(runner.statusReport('--all',records,dir).status,'PASS');
 }finally{if(old===undefined)delete process.env.ZAMEROVAC_CASES;else process.env.ZAMEROVAC_CASES=old;fs.rmSync(dir,{recursive:true,force:true})}
});
test('untrusted existing executable is rejected before any launch',async()=>{
 const {launchSandboxed,launchOptions}=require('../tools/e2e/sandbox.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-untrusted-'));let launches=0;
 const saved={...process.env};
 try{
  process.env.ZAMEROVAC_SUPERVISOR_PID=String(process.ppid);
  process.env.ZAMEROVAC_SCOPE=process.platform==='win32'?'windows-private-job':'linux-pidfd-subreaper';
  process.env.ZAMEROVAC_RUN_TOKEN='a'.repeat(32);
  const binary=path.join(dir,'chromium');fs.writeFileSync(binary,'untrusted executable bytes');
  await assert.rejects(launchSandboxed({async launch(){launches++;throw Error('must not reach launch')}},launchOptions(binary)));
  assert.equal(launches,0,'CDP after execution is too late to establish executable trust');
 }finally{for(const key of ['ZAMEROVAC_SUPERVISOR_PID','ZAMEROVAC_SCOPE','ZAMEROVAC_RUN_TOKEN']){if(saved[key]===undefined)delete process.env[key];else process.env[key]=saved[key]}fs.rmSync(dir,{recursive:true,force:true})}
});
test('full positive control is exactly 23/96; missing, extra, renamed, duplicated and stale evidence blocks',()=>{
 const {records,identity}=positive();
 assert.deepEqual(integrity.complete('--all',records,identity,{}),{status:'PASS',suites:23,cases:96});
 const bad=[r=>r.pop(),r=>r.push(r[0]),r=>r[1]=r[0],r=>r[1].report.cases.pop(),
  r=>r[1].report.cases.push(r[1].report.cases[0]),r=>r[1].report.cases[1]=r[1].report.cases[0],
  r=>r[1].report.cases[0].name='renamed',r=>r[1].report.cases[0].status='skipped',
  r=>r[1].report.cases[0].status='failed',r=>r[1].report.sha='c'.repeat(40),
  r=>r[1].report.runToken='c'.repeat(32),r=>r[1].report.validatorSha='c'.repeat(40),
  r=>r[1].report.filtered=true,r=>r[1].report.status='PARTIAL',r=>delete r[1].report.status,
  r=>r[1].cleanupVerified=false,r=>delete r[1].report.sandbox.binary];
 for(const mutate of bad){const copy=JSON.parse(JSON.stringify(records));mutate(copy);assert.equal(integrity.complete('--all',copy,identity,{}).status,'BLOCKED')}
 assert.equal(integrity.complete('--all',records,identity,{ZAMEROVAC_CASES:''}).status,'BLOCKED');
 assert.equal(integrity.complete('--all',records,{...identity,error:'source changed'},{}).status,'BLOCKED');
 assert.equal(integrity.complete('--all',records,{...identity,finalized:false},{}).status,'BLOCKED');
 assert.equal(integrity.complete('--all',records,{...identity,platform:process.platform==='linux'?'win32':'linux'},{}).status,'BLOCKED');
});
test('pin verifier rejects changed bytes, wrong paths, symlinks and hardlinks',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-pin-'));
 try{
  const binary=path.join(dir,'fixture'),bytes=Buffer.from('7f454c4601020304','hex');fs.writeFileSync(binary,bytes);
  const profile={path:binary,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),magic:'7f454c46'};
  assert.equal(verifyFile(binary,profile).sha256,profile.sha256);
  assert.throws(()=>verifyFile(binary,{...profile,path:binary+'-other'}));
  fs.appendFileSync(binary,'changed');assert.throws(()=>verifyFile(binary,profile),/hash/);
  fs.writeFileSync(binary,bytes);
  const link=path.join(dir,'hard');fs.linkSync(binary,link);assert.throws(()=>verifyFile(binary,profile),/linked/);fs.unlinkSync(link);
  if(process.platform!=='win32'){
   fs.symlinkSync(binary,path.join(dir,'redirect'));assert.throws(()=>verifyFile(path.join(dir,'redirect'),{...profile,path:path.join(dir,'redirect')}),/redirected/);
   fs.symlinkSync(dir,path.join(dir,'parent-link'));const redirected=path.join(dir,'parent-link','fixture');
   assert.throws(()=>verifyFile(redirected,{...profile,path:redirected}),/redirected/);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('real product registration and bytes agree with all 96 pinned scenario identities',async()=>{
 const sha=integrity.manifest.sourceSha,root=process.env.ZAMEROVAC_SOURCE_ROOT||path.resolve(__dirname,'..');
 const registered={};const pending=[];
 for(const suite of integrity.modes['--all']){
  const source=execFileSync('git',['show',sha+':tools/e2e/'+suite+'.cjs'],{cwd:root,encoding:'utf8'});
  assert.equal(crypto.createHash('sha256').update(source).digest('hex'),integrity.manifest.files['tools/e2e/'+suite+'.cjs']);
  const harness=new Proxy({suite(name,body){registered[name]=[];const task=Promise.resolve(body(async title=>{registered[name].push(title)}));pending.push(task);return task},assert},
   {get(target,key){return target[key]||(()=>{throw Error('Unexpected pre-case work: '+String(key))})}});
  vm.runInNewContext(source,{Buffer,console,process:{env:{},argv:[]},require(id){
   if(id==='./harness.cjs')return harness;
   if(id==='./native-storage-fixture.cjs')return ()=>{throw Error('must not execute scenario bodies')};
   if(['node:fs','node:path','node:assert/strict'].includes(id))return require(id);
   throw Error('unexpected registration import '+id);
  }},{filename:suite+'.cjs'});
 }
 await Promise.all(pending);
 for(const suite of integrity.modes['--all'])assert.deepEqual(Array.from(registered[suite]),integrity.manifest.cases[suite],suite);
 assert.equal(Object.values(registered).reduce((n,names)=>n+names.length,0),96);
});
test('separate product checkout is unchanged by QA staging; actual byte tampering blocks',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-source-'));
 const source=path.join(dir,'product'),stage=path.join(dir,'scratch');
 const git=(args,cwd=source)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 try{
  git(['clone','--shared','--no-checkout',process.env.ZAMEROVAC_SOURCE_ROOT||path.resolve(__dirname,'..'),source],dir);
  git(['checkout','--detach',integrity.manifest.sourceSha]);
  assert.equal(integrity.sourceSnapshot(source),integrity.manifest.sourceSha);
  fs.writeFileSync(path.join(source,'app/src/main/assets/ignored.apk'),'unexpected ignored bytes');
  assert.equal(git(['status','--porcelain']).trim(),'');
  assert.throws(()=>integrity.sourceSnapshot(source),/extra\/missing source file/);
  fs.unlinkSync(path.join(source,'app/src/main/assets/ignored.apk'));
  fs.mkdirSync(stage);const staged=runner.stageProduct(stage,source);
  assert(fs.readFileSync(path.join(staged,'harness.cjs'),'utf8').includes('launchSandboxed'));
  assert(!fs.readFileSync(path.join(staged,'harness.cjs'),'utf8').includes("args:['--no-sandbox']"));
  assert.equal(integrity.sourceSnapshot(source),integrity.manifest.sourceSha);
  git(['update-index','--assume-unchanged','app/src/main/assets/index.html']);
  fs.appendFileSync(path.join(source,'app/src/main/assets/index.html'),'tamper');
  assert.equal(git(['status','--porcelain']).trim(),'');
  assert.throws(()=>integrity.sourceSnapshot(source),/source bytes changed/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
