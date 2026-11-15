'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const runner=require('../tools/local-browser-qa.cjs');
const integrity=require('../tools/qa-integrity.cjs');
const {profiles,verifyFile,canonicalPathMatches}=require('../tools/qa-browser-identity.cjs');
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
  GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/heads/qa/browser-smoke-winfix-20261113-run',ZAMEROVAC_EXPECTED_QA_SHA:sha};
 assert.deepEqual(integrity.executionIdentity(sha,env),{runId:'123',runAttempt:1});
 for(const change of [{GITHUB_ACTOR:'other'},{GITHUB_TRIGGERING_ACTOR:'other'},
  {GITHUB_RUN_ATTEMPT:'2'},{GITHUB_RUN_ID:undefined},{GITHUB_EVENT_NAME:'pull_request'},
  {GITHUB_REF:'refs/heads/qa/other'},{GITHUB_REPOSITORY:'other/fork'},{ZAMEROVAC_EXPECTED_QA_SHA:'c'.repeat(40)}])
  assert.throws(()=>integrity.executionIdentity(sha,{...env,...change}));
});
test('offline browser bootstrap is pinned and rejects missing isolation, cache, identity and artifact guards',()=>{
 const repo=path.resolve(__dirname,'..');
 // Keep the original adversarial reference test without installing its spent
 // one-shot workflow into this integration branch. Missing evidence is FAIL.
 const workflow=require('./helpers/qa-reference-bootstrap.cjs').referenceBootstrap();
 const pkg=JSON.parse(fs.readFileSync(path.join(repo,'tools/qa-browser/package.json'),'utf8'));
 const lock=JSON.parse(fs.readFileSync(path.join(repo,'tools/qa-browser/package-lock.json'),'utf8'));
 assert.equal(pkg.dependencies.playwright,'1.62.1');
 assert.equal(lock.packages[''].dependencies.playwright,'1.62.1');
 for(const name of ['playwright','playwright-core']){
  const record=lock.packages['node_modules/'+name];
  assert.equal(record.version,'1.62.1');
  assert.match(record.integrity,/^sha512-[A-Za-z0-9+/]+={0,2}$/);
 }
 for(const [filename,blob] of [
  ['tools/qa-browser/package.json','cd80df5950316c233785c4c96768d836689c79f5'],
  ['tools/qa-browser/package-lock.json','2901dfe9699efa4edbeab7e9655f4462228c39e9']]){
  assert.equal(execFileSync('git',['hash-object',filename],{cwd:repo,encoding:'utf8'}).trim(),blob);
 }
 const required=[
  "refs/heads/qa/browser-smoke-winfix-20261113-run",
  "docs/qa/browser-smoke-winfix-20261113.trigger",
  "github.run_number == 1",
  "github.run_attempt == 1",
  "if exist \"%DEPS%\" (",
  "%RUNNER_TEMP%\\zamerovac-qa-playwright-%GITHUB_RUN_ID%-%GITHUB_RUN_ATTEMPT%",
  "npm.cmd ci --offline --ignore-scripts --omit=optional --no-audit --no-fund",
  "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1",
  "npm_config_offline=true",
  "if errorlevel 1 (\n            echo BLOCKED: pinned Playwright packages missing from offline cache",
  "echo NODE_PATH=%NODE_PATH%>>\"%GITHUB_ENV%\"",
  ">>\"%GITHUB_ENV%\" echo PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1",
  "if not \"%PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD%\"==\"1\" exit /b 1",
  "if-no-files-found: error",
  "node tools/local-browser-qa.cjs --smoke",
  "persist-credentials: false",
  "runs-on: [self-hosted, Windows, X64, zamerovac-qa]",
 ];
 const safe=source=>required.every(fragment=>source.includes(fragment))
  && !source.includes('--no-sandbox')&&!source.includes('workflow_dispatch:')
  && !source.includes('pull_request:');
 assert.equal(safe(workflow),true);
 for(const must of required){
  const mutated=workflow.split(must).join('DISABLED-EXPECTED-NEGATIVE');
  assert.notEqual(mutated,workflow,'expected fixture fragment absent: '+must);
  assert.equal(safe(mutated),false,'must fail closed when guard removed: '+must);
 }
 assert.equal(safe(workflow.replace('npm.cmd ci --offline','npm.cmd ci')),false);
 assert.equal(safe(workflow.replace('if-no-files-found: error','if-no-files-found: warn')),false);
 assert.equal(safe(workflow+'\n  workflow_dispatch:\n'),false);
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
test('Windows namespaced canonical paths keep strict target identity',()=>{
 const file='C:\\qa\\fixture.exe',prefixed='\\\\?\\C:\\qa\\fixture.exe';
 assert.equal(canonicalPathMatches(file,prefixed,'win32'),true);
 assert.equal(canonicalPathMatches(file,file.toUpperCase(),'win32'),true);
 assert.equal(canonicalPathMatches(file,'C:\\qa\\different.exe','win32'),false);
 assert.equal(canonicalPathMatches(file,'D:\\qa\\fixture.exe','win32'),false);
 assert.equal(canonicalPathMatches('/tmp/fixture','/tmp/other','linux'),false);
});
// Synthetic files must be created under native canonical TEMP spelling. Portable
// realpath can retain a Windows 8.3 ancestor alias. Resolve only the newly made
// directory, before creating bytes/profile; never normalize an approved binary.
function binaryFixtureDirectory(prefix){
 const created=fs.mkdtempSync(path.join(os.tmpdir(),prefix));
 try{return fs.realpathSync.native(created)}
 catch(error){fs.rmSync(created,{recursive:true,force:true});throw error}
}
test('pin verifier rejects changed bytes, wrong paths, symlinks and hardlinks',()=>{
 const dir=binaryFixtureDirectory('qa-pin-');
 try{
  const binary=path.join(dir,'fixture'),bytes=Buffer.from('7f454c4601020304','hex');fs.writeFileSync(binary,bytes);
  const profile={path:binary,sha256:crypto.createHash('sha256').update(bytes).digest('hex'),magic:'7f454c46'};
  assert.equal(verifyFile(binary,profile).sha256,profile.sha256);
  assert.throws(()=>verifyFile(binary,{...profile,sha256:'0'.repeat(64)}),/hash/);
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
// Exercise the production module with deterministic filesystem observations. These
// Windows API models are not a Windows runtime result; real fixtures remain above.
function identityWithFs(overrides){
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/qa-browser-identity.cjs'),'utf8'),{
  module,exports:module.exports,Buffer,process,require(id){
   if(id==='node:fs')return new Proxy(fs,{get(target,key){return key in overrides?overrides[key]:target[key]}});
   if(id==='./qa-browser-profiles.json')return profiles;
   return require(id);
  }
 });
 return module.exports;
}
function mismatchDiagnostic(file,canonical,{portable=canonical,same=true,probeError=false,zeroId=false}={}){
 const stat={isSymbolicLink:()=>false,isFile:()=>true,dev:1n,ino:2n,nlink:1n};
 const realpath=Object.assign(()=>{if(probeError)throw Object.assign(Error('PRIVATE ERROR '+file),{code:'EACCES'});return portable},{native:()=>canonical});
 const model=identityWithFs({realpathSync:realpath,lstatSync(value){
  if(probeError&&value===canonical)throw Error('PRIVATE ERROR '+value);
  return {...stat,ino:zeroId?0n:!same&&value===canonical?3n:2n};
 },openSync(){throw Error('must block before open')}});
 let failure;
 try{model.verifyFile(file,{path:file},'win32')}catch(e){failure=e}
 assert.equal(failure?.code,'HOME_BLOCKED');
 assert.match(failure.message,/Chromium path resolves elsewhere; pathDiagnostic=/);
 const diagnostic=JSON.parse(failure.message.split('; pathDiagnostic=')[1]);
 assert(failure.message.length<3000,'bounded diagnostic');
 for(const secret of ['PrivateUser','SecretFolder','fixture.exe','PRIVATE ERROR'])assert(!failure.message.includes(secret));
 return diagnostic;
}
test('canonical mismatch reports redacted alias, API and file-identity evidence without permitting it',()=>{
 const file='C:\\Users\\PRIVAT~1\\SecretFolder\\fixture.exe';
 const canonical='C:\\Users\\PrivateUser\\SecretFolder\\fixture.exe';
 const d=mismatchDiagnostic(file,canonical,{portable:file});
 assert.equal(d.schema,1);
 assert.equal(d.inputNamespace,'dos');
 assert.equal(d.nativeNamespace,'dos');
 assert.equal(d.comparison.equivalent,false);
 assert.deepEqual(Array.from(d.comparison.differentComponents),[1]);
 assert.deepEqual(Array.from(d.comparison.shortNameInputComponents),[1]);
 assert.equal(d.comparison.leafSame,true);
 assert.equal(d.portable.inputEquivalent,true);
 assert.equal(d.portable.nativeEquivalent,false);
 assert.equal(d.fileIdentity.same,true);
 // This proves a modelled same-file spelling mismatch, not the cause on HOME.
 assert.equal(mismatchDiagnostic(file,canonical,{same:false}).fileIdentity.same,false);
 const other=mismatchDiagnostic('C:\\SecretFolder\\fixture.exe','D:\\SecretFolder\\different.exe');
 assert.equal(other.comparison.rootSame,false);assert.equal(other.comparison.leafSame,false);
 const unavailable=mismatchDiagnostic(file,canonical,{probeError:true});
 assert.equal(unavailable.portable.available,false);
 assert.equal(unavailable.fileIdentity.available,false);
 assert.equal(mismatchDiagnostic(file,canonical,{zeroId:true}).fileIdentity.available,false);
 for(const [value,kind] of [
  ['\\\\?\\C:\\Users\\PrivateUser\\SecretFolder\\fixture.exe','extended-dos'],
  ['\\\\?\\UNC\\PrivateServer\\SecretFolder\\fixture.exe','extended-unc'],
  ['\\??\\C:\\SecretFolder\\fixture.exe','nt'],
  ['\\\\.\\C:\\SecretFolder\\fixture.exe','device'],
  ['\\\\PrivateServer\\SecretFolder\\fixture.exe','unc']]){
  assert.equal(mismatchDiagnostic(file,value).nativeNamespace,kind);
 }
});
test('Windows equivalent canonical spellings pass all binary checks; changed target and reparse points block (API model)',()=>{
 const file='C:\\qa\\fixture.exe',bytes=Buffer.from('4d5a010203040506','hex');
 const stat={isSymbolicLink:()=>false,isFile:()=>true,nlink:1,dev:1,ino:2,size:bytes.length,mtimeMs:1};
 const profile={path:file,magic:'4d5a',sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
 const readSync=(fd,buffer,offset,length,position)=>bytes.copy(buffer,offset,position,position+length);
 function model(canonical,redirected,overrides={}){
  const realpath=Object.assign(()=>canonical,{native:()=>canonical});
  return identityWithFs({realpathSync:realpath,lstatSync:p=>({...stat,isSymbolicLink:()=>p===redirected}),
   openSync:()=>7,fstatSync:()=>stat,readSync,closeSync:()=>{},...overrides});
 }
 for(const canonical of [file,'\\\\?\\C:\\qa\\fixture.exe','c:\\QA\\FIXTURE.EXE','C:/qa/fixture.exe'])
  assert.equal(model(canonical).verifyFile(file,profile,'win32').sha256,profile.sha256);
 for(const canonical of ['C:\\qa\\other.exe','D:\\qa\\fixture.exe'])
  assert.throws(()=>model(canonical).verifyFile(file,profile,'win32'),/resolves elsewhere/);
 for(const redirected of [file,'C:\\qa'])
  assert.throws(()=>model(file,redirected).verifyFile(file,profile,'win32'),/redirected/);
 for(const overrides of [{fstatSync:()=>({...stat,nlink:2})},{lstatSync:()=>({...stat,ino:3})}])
  assert.throws(()=>model(file,undefined,overrides).verifyFile(file,profile,'win32'),/one regular non-linked file/);
 assert.throws(()=>model(file).verifyFile(file,{...profile,magic:'7f454c46'},'win32'),/format mismatch/);
 assert.throws(()=>model(file).verifyFile(file,{...profile,sha256:'0'.repeat(64)},'win32'),/bytes\/hash changed/);
 for(const changed of [{size:stat.size+1},{mtimeMs:stat.mtimeMs+1}]){
  let reads=0;
  assert.throws(()=>model(file,undefined,{fstatSync:()=>++reads===1?stat:{...stat,...changed}})
   .verifyFile(file,profile,'win32'),/bytes\/hash changed/);
 }
 // The approved input remains literal, even when an alternative spelling could
 // identify the same file. Only realpath's equivalent output is normalized.
 assert.throws(()=>model(file).verifyFile(file.toUpperCase(),profile,'win32'),/unapproved/);
});
test('real binary mutation during hashing and name replacement fail closed',()=>{
 const dir=binaryFixtureDirectory('qa-identity-race-');
 try{
  const file=path.join(dir,'fixture'),other=path.join(dir,'other');
  const bytes=Buffer.from('7f454c4601020304','hex');fs.writeFileSync(file,bytes);
  const profile={path:file,magic:'7f454c46',sha256:crypto.createHash('sha256').update(bytes).digest('hex')};
  let changed=false;
  const mutating=identityWithFs({readSync(...args){const count=fs.readSync(...args);
   if(!changed&&args[3]>4){changed=true;fs.appendFileSync(file,'changed-during-read')}
   return count;
  }});
  assert.throws(()=>mutating.verifyFile(file,profile),/bytes\/hash changed/);assert(changed);
  fs.writeFileSync(file,bytes);fs.writeFileSync(other,bytes);
  let stats=0;
  const replacing=identityWithFs({fstatSync(fd){const stat=fs.fstatSync(fd);
   if(++stats===2){fs.renameSync(file,path.join(dir,'retained'));fs.renameSync(other,file)}
   return stat;
  }});
  assert.throws(()=>replacing.verifyFile(file,profile),/replaced during verification/);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('junction fixture rejects directory redirection without Windows symlink privilege', {skip:process.platform!=='win32'?'native Windows junction requires Windows':false},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-junction-'));
 try{
  const target=path.join(dir,'target'),junction=path.join(dir,'junction');fs.mkdirSync(target);
  const file=path.join(target,'fixture'),bytes=Buffer.from('4d5a01020304','hex');fs.writeFileSync(file,bytes);
  fs.symlinkSync(target,junction,'junction');
  const redirected=path.join(junction,'fixture');
  assert.throws(()=>verifyFile(redirected,{path:redirected,magic:'4d5a',sha256:crypto.createHash('sha256').update(bytes).digest('hex')}),/redirected/);
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
  // The independent fixture checkout must preserve approved source bytes on Windows.
  // Match the production actions/checkout process-local core.autocrlf=false.
  git(['-c','core.autocrlf=false','checkout','--detach',integrity.manifest.sourceSha]);
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
