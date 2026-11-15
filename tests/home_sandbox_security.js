'use strict';
// Configuration/runtime negatives never launch an unsafe real browser.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {createRequire}=require('node:module');
const {spawnSync}=require('node:child_process');
const harness=path.resolve(__dirname,'../tools/e2e/harness.cjs');
const localRequire=createRequire(harness);
const linuxProof={platform:'linux',evaluation:'You are adequately sandboxed.',rows:[
 ['Layer 1 Sandbox','Namespace'],['PID namespaces','Yes'],['Network namespaces','Yes'],
 ['Seccomp-BPF sandbox','Yes'],['Seccomp-BPF sandbox supports TSYNC','Yes']]};
const windowsProof={platform:'win32',rows:[['123','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]};
const hostProof=process.platform==='win32'?windowsProof:linuxProof;
test('pinned Playwright launch explicitly enables its read-only command-line diagnostics',()=>{
 assert.deepEqual(require('../tools/e2e/sandbox.cjs').launchOptions('/safe/chromium').args,['--enable-automation']);
});
// Synthetic policy tests inject only the disk-identity boundary; no real executable is launched.
function policy(){
 const filename=path.resolve(__dirname,'../tools/e2e/sandbox.cjs'),m={exports:{}};
 const runtime={platform:process.platform,ppid:12345,env:{ZAMEROVAC_SUPERVISOR_PID:'12345',
  ZAMEROVAC_SCOPE:process.platform==='win32'?'windows-private-job':'linux-pidfd-subreaper',ZAMEROVAC_RUN_TOKEN:'a'.repeat(32)}};
 vm.runInNewContext(fs.readFileSync(filename,'utf8'),{module:m,process:runtime,setTimeout,clearTimeout,require(id){
  if(id==='../qa-browser-identity.cjs')return {verifyBrowserIdentity(file){assert.equal(file,'/safe/chromium');return {path:file,sha256:'synthetic-only'}}};
  return createRequire(filename)(id);
 }},{filename});
 return m.exports;
}
function fakeBrowser(proof=hostProof,args=['--enable-automation']){
 let closed=0;
 return {get closed(){return closed},async close(){closed++},
  async newBrowserCDPSession(){return {async send(){return {arguments:args}},async detach(){}}},
  async newContext(){return {async newPage(){return {async goto(){},async evaluate(){return proof},
   async waitForFunction(){},setDefaultTimeout(){}}},async close(){}}}};
}
test('harness explicitly enables sandbox before any application case',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-sandbox-'));
 let options,bodyRan=false;const b=fakeBrowser();const m={exports:{}};
 try{
  vm.runInNewContext(fs.readFileSync(harness,'utf8'),{module:m,
   process:{platform:'linux',argv:[],env:{ZAMEROVAC_E2E_DIR:dir,CHROMIUM_PATH:'/safe/chromium'}},
   require(id){
    if(id==='./sandbox.cjs')return policy();
    if(id==='playwright')return {chromium:{async launch(o){options=o;return b}}};
    if(id==='node:child_process')return {execFileSync(){return 'a'.repeat(40)}};
    return localRequire(id);
   }},{filename:harness});
  await assert.rejects(m.exports.suite('security',async()=>{bodyRan=true;throw Error('TEST_BODY')}),/TEST_BODY/);
  assert.equal(options.chromiumSandbox,true,'Playwright default false is unsafe');
  assert(!options.args?.includes('--no-sandbox'),'explicit no-sandbox is unsafe');
  assert(bodyRan);assert.equal(b.closed,1);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('launch policy rejects disabled sandbox, flags and malformed options before spawn',async()=>{
 const {launchSandboxed}=policy();let launched=0;
 for(const change of [{chromiumSandbox:false},{chromiumSandbox:undefined},
  {args:['--no-sandbox']},{args:['--no-sandbox=true']},{args:['--disable-setuid-sandbox']},
  {args:[]},{args:'--no-sandbox'},{ignoreDefaultArgs:true},{env:{}},{headless:'yes'},
  {executablePath:'relative/chrome'},{executablePath:undefined},{executablePath:''}, {unknown:true}]){
  await assert.rejects(launchSandboxed({async launch(){launched++}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation'],...change}),
   e=>e.code==='HOME_BLOCKED');
 }
 assert.equal(launched,0);
});
test('launch error blocks once, no retry or downgrade',async()=>{
 const {launchSandboxed}=policy();let launched=0;
 await assert.rejects(launchSandboxed({async launch(){launched++;throw Error('sandbox unavailable')}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']}),
  e=>e.code==='HOME_BLOCKED'&&/sandbox unavailable/.test(e.message));
 assert.equal(launched,1);
});
test('unverifiable or disabled runtime sandbox closes browser and blocks',async()=>{
 const {launchSandboxed}=policy();
 for(const [proof,args] of [[null,[]],[{...linuxProof,evaluation:'You are NOT adequately sandboxed.'},[]],
  [linuxProof,['--no-sandbox']],[{...linuxProof,rows:[]},[]]]){
  const b=fakeBrowser(proof,args);
  await assert.rejects(launchSandboxed({async launch(){return b}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']}),e=>e.code==='HOME_BLOCKED');
  assert.equal(b.closed,1);
 }
});
test('positive fixtures keep Linux and Windows evidence separate',async()=>{
 const {launchSandboxed,checkEvidence}=policy();const b=fakeBrowser();
 assert.equal(checkEvidence(linuxProof,'linux').platform,'linux');
 assert.throws(()=>checkEvidence(linuxProof,'win32'),e=>e.code==='HOME_BLOCKED');
 const r=await launchSandboxed({async launch(){return b}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']});
 assert.equal(r.evidence.platform,process.platform);assert.equal(r.evidence.status,'PASS');
 await r.browser.close();
});
test('runner reports sandbox failure as BLOCKED and cannot count it as PASS',()=>{
 const {statusReport}=require('../tools/local-browser-qa.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-sandbox-report-'));
 try{
  const r=statusReport('--smoke',[{suite:'drawing',status:'BLOCKED',error:'sandbox unverified'}],dir);
  assert.equal(r.status,'BLOCKED');assert.equal(r.counts.BLOCKED,1);assert.equal(r.counts.PASS,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('Windows policy diagnostics require live renderer IDs, Lockdown and Untrusted integrity',()=>{
 const {checkEvidence}=policy();
 const proof=windowsProof;
 assert.equal(checkEvidence(proof,'win32').platform,'win32');
 for(const bad of [{...proof,rows:[]},{...proof,platform:'linux'},
  {...proof,rows:[['123','Renderer','','Not Sandboxed','','']]},
  {...proof,rows:[['123','Renderer','','Renderer','None','S-1-16-8192 Medium']]},
  {...proof,rows:[['0','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]}])
  assert.throws(()=>checkEvidence(bad,'win32'),e=>e.code==='HOME_BLOCKED');
});
test('CDP/diagnostic failure closes the browser and never invokes application body',async()=>{
 const {launchSandboxed}=policy();
 for(const method of ['newBrowserCDPSession','newContext']){
  const b=fakeBrowser();b[method]=async()=>{throw Error('unavailable '+method)};
  await assert.rejects(launchSandboxed({async launch(){return b}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']}),e=>e.code==='HOME_BLOCKED');
  assert.equal(b.closed,1);
 }
});
test('stalled diagnostics are bounded, close browser and return BLOCKED',async()=>{
 const {launchSandboxed}=policy();
 const b=fakeBrowser();b.newBrowserCDPSession=()=>new Promise(()=>{});
 const start=Date.now();
 await assert.rejects(launchSandboxed({async launch(){return b}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']}),
  e=>e.code==='HOME_BLOCKED'&&/timed out/.test(e.message));
 assert.equal(b.closed,1);assert(Date.now()-start<10000);
});
test('supervised worker checkpoints launch/diagnostic failures without unsafe browser execution',async()=>{
 const {ownedWorker}=require('../tools/qa-process-client.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-worker-negative-'));
 try{
  const stub=path.join(dir,'playwright.cjs'),preload=path.join(dir,'preload.cjs');
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'1.62.1'}));
  fs.writeFileSync(preload,[
   "const M=require('node:module'),resolve=M._resolveFilename,load=M._load;",
   "M._resolveFilename=function(r,...a){if(r==='playwright')return process.env.QA_STUB;if(r==='playwright/package.json')return require('path').join(require('path').dirname(process.env.QA_STUB),'package.json');return resolve.call(this,r,...a)};",
   "M._load=function(r,...a){if(r.endsWith('qa-browser-identity.cjs'))return {verifyBrowserIdentity(){return {path:'/safe/chromium',sha256:'synthetic-only'}}};return load.call(this,r,...a)};"
  ].join('\n'));
  fs.writeFileSync(stub,[
   "const fs=require('node:fs');",
   'exports.chromium={async launch(options){',
   "fs.appendFileSync(process.env.QA_CALLS,JSON.stringify(options)+'\\n');",
   "if(process.env.QA_FAULT==='launch')throw Error('synthetic launch failure');",
   'return {async close(){},async newBrowserCDPSession(){return {async detach(){},async send(){',
   "if(process.env.QA_FAULT==='cdp')throw Error('CDP unavailable');",
   "return {arguments:['--enable-automation',...(process.env.QA_FAULT==='flag'?['--no-sandbox']:[])]};}}},",
   "async newContext(){return {async close(){},async newPage(){return {setDefaultTimeout(){},async goto(){},async waitForFunction(){},async evaluate(){return null}}}}}};}};"
  ].join('\n'));
  for(const fault of ['launch','cdp','flag','diagnostics']){
   const token='a'.repeat(32),calls=path.join(dir,fault+'-calls');
   const env={...process.env,QA_STUB:stub,QA_CALLS:calls,QA_FAULT:fault,
    CHROMIUM_PATH:'/safe/chromium',ZAMEROVAC_RUN_TOKEN:token};
   const r=await ownedWorker([process.execPath,'--require',preload,
    path.resolve(__dirname,'../tools/qa-browser-worker.cjs'),'preflight',path.join(dir,fault+'.json')],
    dir,env,path.join(dir,fault+'.log'),token,12000);
   assert.equal(r.status,'BLOCKED');assert.equal(r.cleanupVerified,true);
   assert.equal(fs.existsSync(path.join(dir,fault+'.json')),false);
   const launches=fs.readFileSync(calls,'utf8').trim().split('\n');
   assert.equal(launches.length,1);assert.equal(JSON.parse(launches[0]).chromiumSandbox,true);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('suite exit 0 cannot pass without a full fresh named report',()=>{
 const {checkedReport,manifest}=require('../tools/qa-integrity.cjs');
 const {profiles}=require('../tools/qa-browser-identity.cjs');
 const identity={sourceSha:manifest.sourceSha,validatorSha:'b'.repeat(40),runToken:'a'.repeat(32)};
 const valid={suite:'drawing',sha:identity.sourceSha,validatorSha:identity.validatorSha,runToken:identity.runToken,
  filtered:false,status:'COMPLETE',syntheticOnly:true,sandbox:{...hostProof,binary:profiles[process.platform]},
  cases:manifest.cases.drawing.map(name=>({name,status:'passed'}))};
 for(const report of [null,{sandbox:null},{...valid,cases:[]},{...valid,cases:valid.cases.slice(1)}])
  assert.throws(()=>checkedReport(report,'drawing',identity));
 assert.equal(checkedReport(valid,'drawing',identity).scenarioTotal,manifest.cases.drawing.length);
});
test('hung browser.close is bounded and remains BLOCKED',async()=>{
 const {launchSandboxed}=policy(),b=fakeBrowser();
 b.newBrowserCDPSession=async()=>{throw Error('diagnostic failure')};
 b.close=()=>new Promise(()=>{});
 const start=Date.now();
 await assert.rejects(launchSandboxed({async launch(){return b}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:['--enable-automation']}),e=>e.code==='HOME_BLOCKED'&&/close timed out/.test(e.message));
 assert(Date.now()-start<4000);
});
