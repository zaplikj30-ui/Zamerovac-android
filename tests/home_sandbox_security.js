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
 const {launchSandboxed}=require('../tools/e2e/sandbox.cjs');let launched=0;
 for(const change of [{chromiumSandbox:false},{chromiumSandbox:undefined},
  {args:['--no-sandbox']},{args:['--no-sandbox=true']},{args:['--disable-setuid-sandbox']},
  {args:'--no-sandbox'},{ignoreDefaultArgs:true},{env:{}},{headless:'yes'},
  {executablePath:'relative/chrome'},{executablePath:undefined},{executablePath:''}, {unknown:true}]){
  await assert.rejects(launchSandboxed({async launch(){launched++}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[],...change}),
   e=>e.code==='HOME_BLOCKED');
 }
 assert.equal(launched,0);
});
test('launch error blocks once, no retry or downgrade',async()=>{
 const {launchSandboxed}=require('../tools/e2e/sandbox.cjs');let launched=0;
 await assert.rejects(launchSandboxed({async launch(){launched++;throw Error('sandbox unavailable')}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[]}),
  e=>e.code==='HOME_BLOCKED'&&/sandbox unavailable/.test(e.message));
 assert.equal(launched,1);
});
test('unverifiable or disabled runtime sandbox closes browser and blocks',async()=>{
 const {launchSandboxed}=require('../tools/e2e/sandbox.cjs');
 for(const [proof,args] of [[null,[]],[{...linuxProof,evaluation:'You are NOT adequately sandboxed.'},[]],
  [linuxProof,['--no-sandbox']],[{...linuxProof,rows:[]},[]]]){
  const b=fakeBrowser(proof,args);
  await assert.rejects(launchSandboxed({async launch(){return b}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[]}),e=>e.code==='HOME_BLOCKED');
  assert.equal(b.closed,1);
 }
});
test('positive fixtures keep Linux and Windows evidence separate',async()=>{
 const {launchSandboxed,checkEvidence}=require('../tools/e2e/sandbox.cjs');const b=fakeBrowser();
 assert.equal(checkEvidence(linuxProof,'linux').platform,'linux');
 assert.throws(()=>checkEvidence(linuxProof,'win32'),e=>e.code==='HOME_BLOCKED');
 const r=await launchSandboxed({async launch(){return b}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[]});
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
 const {checkEvidence}=require('../tools/e2e/sandbox.cjs');
 const proof=windowsProof;
 assert.equal(checkEvidence(proof,'win32').platform,'win32');
 for(const bad of [{...proof,rows:[]},{...proof,platform:'linux'},
  {...proof,rows:[['123','Renderer','','Not Sandboxed','','']]},
  {...proof,rows:[['123','Renderer','','Renderer','None','S-1-16-8192 Medium']]},
  {...proof,rows:[['0','Renderer','','Renderer','Lockdown','S-1-16-0 Untrusted']]}])
  assert.throws(()=>checkEvidence(bad,'win32'),e=>e.code==='HOME_BLOCKED');
});
test('CDP/diagnostic failure closes the browser and never invokes application body',async()=>{
 const {launchSandboxed}=require('../tools/e2e/sandbox.cjs');
 for(const method of ['newBrowserCDPSession','newContext']){
  const b=fakeBrowser();b[method]=async()=>{throw Error('unavailable '+method)};
  await assert.rejects(launchSandboxed({async launch(){return b}},
   {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[]}),e=>e.code==='HOME_BLOCKED');
  assert.equal(b.closed,1);
 }
});
test('stalled diagnostics are bounded, close browser and return BLOCKED',async()=>{
 const {launchSandboxed}=require('../tools/e2e/sandbox.cjs');
 const b=fakeBrowser();b.newBrowserCDPSession=()=>new Promise(()=>{});
 const start=Date.now();
 await assert.rejects(launchSandboxed({async launch(){return b}},
  {executablePath:'/safe/chromium',chromiumSandbox:true,headless:true,args:[]}),
  e=>e.code==='HOME_BLOCKED'&&/timed out/.test(e.message));
 assert.equal(b.closed,1);assert(Date.now()-start<10000);
});
test('real runner CLI checkpoints BLOCKED for each sandbox preflight failure',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-runner-negative-'));
 try{
  const stub=path.join(dir,'playwright.cjs'),preload=path.join(dir,'preload.cjs');
  fs.writeFileSync(path.join(dir,'package.json'),JSON.stringify({version:'1.62.1'}));
  fs.writeFileSync(preload,[
   "const M=require('node:module'),original=M._resolveFilename;",
   'M._resolveFilename=function(request,...args){',
   " if(request==='playwright')return process.env.QA_STUB;",
   ' return original.call(this,request,...args);};'
  ].join('\n'));
  fs.writeFileSync(stub,[
   "const fs=require('node:fs');",
   'exports.chromium={executablePath:()=>__filename,async launch(options){',
   "fs.appendFileSync(process.env.QA_CALLS,JSON.stringify(options)+'\\n');",
   "if(process.env.QA_FAULT==='launch')throw Error('synthetic launch failure');",
   'return {async close(){},async newBrowserCDPSession(){return {async detach(){},async send(){',
   " if(process.env.QA_FAULT==='cdp')throw Error('CDP unavailable');",
   " return {arguments:['--enable-automation',...(process.env.QA_FAULT==='flag'?['--no-sandbox']:[])]};}}},",
   "async newContext(){return {async close(){},async newPage(){return {setDefaultTimeout(){},async goto(){},async waitForFunction(){},async evaluate(){return null}}}}}};}};"
  ].join('\n'));
  for(const fault of ['launch','cdp','flag','diagnostics']){
   const calls=path.join(dir,fault+'-calls');
   const r=spawnSync(process.execPath,['--require',preload,
    path.resolve(__dirname,'../tools/local-browser-qa.cjs'),'--smoke'],{
    encoding:'utf8',timeout:12000,env:{...process.env,QA_STUB:stub,QA_CALLS:calls,
     QA_FAULT:fault,CHROMIUM_PATH:stub,LOCALAPPDATA:path.join(dir,fault)}});
   assert.equal(r.status,1,r.stderr);assert.match(r.stderr,/HOME BLOCKED/);
   const root=path.join(dir,fault,'Zamerovac-QA','browser');
   const reports=fs.readdirSync(root);assert.equal(reports.length,1);
   const report=JSON.parse(fs.readFileSync(path.join(root,reports[0],'results.json')));
   assert.equal(report.status,'BLOCKED');assert.equal(report.counts.BLOCKED,3);
   assert.equal(report.counts.PASS,0);
   assert.equal(fs.existsSync(path.join(root,reports[0],'evidence')),false);
   const launches=fs.readFileSync(calls,'utf8').trim().split('\n');
   assert.equal(launches.length,1,'never retry without sandbox');
   assert.equal(JSON.parse(launches[0]).chromiumSandbox,true);
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
test('suite exit 0 cannot pass runner without validated sandbox report',async()=>{
 const runner=path.resolve(__dirname,'../tools/local-browser-qa.cjs');
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-suite-proof-'));
 const {EventEmitter}=require('node:events');const m={exports:{}};
 let spawns=0;
 try{
  vm.runInNewContext(fs.readFileSync(runner,'utf8'),{module:m,__dirname:path.dirname(runner),
   process,console,setTimeout,clearTimeout,require(id){
    if(id==='node:child_process')return {spawn(){
     spawns++;const child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();
     queueMicrotask(()=>child.emit('close',0,null));return child;
    }};
    return createRequire(runner)(id);
   }},{filename:runner});
  const destination=path.join(dir,'synthetic','report.json');
  fs.mkdirSync(path.dirname(destination));
  for(const proof of [null,{sandbox:null},{sandbox:{...hostProof,rows:[]}},{sandbox:hostProof}]){
   if(proof)fs.writeFileSync(destination,JSON.stringify(proof));
   const outcome=await m.exports.execute('synthetic',{ZAMEROVAC_E2E_DIR:dir},path.join(dir,'suite.log'));
   assert.equal(outcome.exitCode,0);
   assert.equal(outcome.status,proof?.sandbox===hostProof?'PASS':'BLOCKED');
  }
  assert.equal(spawns,4);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
