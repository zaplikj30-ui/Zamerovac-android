'use strict';
// SOURCE/mocked preexec tests; no actual Python owner, browser or process is created.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const file=path.resolve(__dirname,'../tools/qa-process-client.cjs');
const source=fs.readFileSync(file,'utf8');
function harness(runtime){
 let spawnCount=0,fileWrites=0;
 const mod={exports:{}};
 vm.runInNewContext(source,{
  module:mod,process:{platform:'linux',env:{}},
  __dirname:path.resolve(__dirname,'../tools'),setInterval,clearInterval,
  require(id){
   if(id==='node:fs')return {writeFileSync(){fileWrites++}};
   if(id==='node:path')return path;
   if(id==='node:child_process')return {spawn(){spawnCount++;throw Error('native spawn forbidden')}};
   if(id==='./qa-cloud-runtime.cjs')return runtime;
   if(id==='./qa-process-diagnostic.json')return require('../tools/qa-process-diagnostic.json');
   return require(id);
  }
 });
 return {ownedWorker:mod.exports.ownedWorker,counts:()=>({spawnCount,fileWrites})};
}
const worker=path.resolve(__dirname,'../tools/qa-browser-worker.cjs');
const env={ZAMEROVAC_QA_MODE:'cloud',ZAMEROVAC_CLOUD_TRUST:'trusted-host/change-detection'};
const policy={browser:true,kind:'browser'};
const command=['/reviewed/node',worker,'preflight','/private/sandbox.json'];
function run(h,argv=command,approval=policy){
 return h.ownedWorker(argv,'/product',env,'/private/sandbox.log','a'.repeat(32),1000,null,0,approval);
}
test('unreviewed R blocks before touching config file or launching Python',async()=>{
 let probes=0;
 const h=harness({approvedRuntime(){probes++;throw Error('QA CLOUD BLOCKED: R not approved')}});
 await assert.rejects(run(h),/QA CLOUD BLOCKED/);
 assert.equal(probes,1);assert.deepEqual(h.counts(),{spawnCount:0,fileWrites:0});
});
test('typed command guards forbid a fake/nonbrowser/flagged/preload launch without spawn',async()=>{
 const h=harness({approvedRuntime(){return {node:{path:'/reviewed/node'}}}});
 for(const [argv,approval] of [
  [['/other/node',...command.slice(1)],policy],
  [['/reviewed/node','--require','preload',worker,'preflight','/private/file'],policy],
  [['/reviewed/node',worker,'other','/private/file'],policy],
  [['/reviewed/node',worker,'suite','relative.js'],policy],
  [command,{browser:false,kind:'browser'}],
  [command,{browser:true,kind:'other'}],
  [command,null]
 ])await assert.rejects(run(h,argv,approval),/QA CLOUD BLOCKED/);
 assert.deepEqual(h.counts(),{spawnCount:0,fileWrites:0});
});
test('hosted R manifest stays deliberately unapproved until independent inventory',()=>{
 const manifest=require('../tools/qa-cloud-runtime.json');
 assert.equal(manifest.runtimeApproved,false);
 assert.equal(manifest.trustModel,'trusted-host/change-detection');
 assert.equal(manifest.chromium,null);assert.equal(manifest.playwright.root,null);
 assert.equal(manifest.validatorSha,null);assert.equal(manifest.eventSha,null);
});

test("Playwright nested core resolution must match approved root core before import",()=>{
 const script=fs.readFileSync(path.resolve(__dirname,'../tools/qa-cloud-runtime.cjs'),'utf8');
 const start=script.indexOf('function loadPlaywright(){');
 const end=script.indexOf('\nfunction cloudBrowserIdentity',start);
 assert(start>=0&&end>start,'reviewed loader function must exist');
 // Execute the actual reviewed loader function with a fake resolver; no real
 // Playwright, Node child, Python supervisor or Chromium is loaded.
 const factory=new Function('Module','path','approvedRuntime','need',
  script.slice(start,end)+'\nreturn loadPlaywright;');
 const original='/reviewed/node_modules/playwright/index.js';
 const core='/reviewed/node_modules/playwright-core/index.js';
 const shadow='/reviewed/node_modules/playwright/node_modules/playwright-core/index.js';
 const runtime={playwright:{root:'/reviewed',files:{
  'node_modules/playwright/index.js':'a'.repeat(64),
  'node_modules/playwright-core/index.js':'b'.repeat(64)
 }}};
 for(const fake of [core,shadow]){
  let actualImports=0;
  const Module={createRequire(from){
   const loader=()=>{actualImports++;return {chromium:'synthetic-only'}};
   loader.resolve=name=>name==='playwright'?original:name==='playwright-core'?
    from===original?fake:core:undefined;
   return loader;
  }};
  const load=factory(Module,path,()=>runtime,ok=>{if(!ok)throw Error('R core resolver mismatch')});
  if(fake===core){assert.equal(load().chromium,'synthetic-only');assert.equal(actualImports,1)}
  else {assert.throws(load,/R core resolver mismatch/);assert.equal(actualImports,0)}
 }
});

test('B1 all four historical guards and exact 23 c7 suites resolve without git history',()=>{
 const history=require('./helpers/qa-historical.cjs');
 const manifest=require('../tools/qa-pr121-manifest.json'),proof=history.snapshot();
 assert.equal(proof.history.baseline,'a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a');
 assert.equal(Object.keys(proof.originalFiles).length,66);
 assert.equal(Object.keys(proof.c7SuiteBlobs).length,23);
 const old=JSON.parse(history.historicalBytes('manifest'));
 assert.equal(old.sourceSha,proof.history.original);
 assert(history.historicalBytes('integrity').toString().includes('executionIdentity'));
 assert(history.historicalBytes('workflow').toString().includes('home_qa_version_preflight'));
 assert(history.historicalBytes('fixtureGate').toString().includes('ownedWorker'));
 for(const suite of Object.keys(manifest.cases)) {
  const bytes=history.c7Suite(suite,manifest);
  assert(bytes.length>0,suite); // loader already verified historical Git SHA1 and PR121 SHA256
 }
});

test('B1 missing, wrong bytes, wrong tree SHA, symlink and hardlink cannot be historical PASS',()=>{
 const history=require('./helpers/qa-historical.cjs'),os=require('node:os');
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-b1-fixture-'));
 const orig=path.resolve(__dirname,'fixtures/qa-history');
 try {
  assert.throws(()=>history.snapshot(root));
  assert.throws(()=>history.historicalBytes('integrity',root));
  assert.throws(()=>history.historicalBytes('unknown',orig));
  fs.mkdirSync(path.join(root,'a3cc8eb3'),{recursive:true});
  const p=path.join(root,'a3cc8eb3/qa-integrity.cjs.txt');
  fs.copyFileSync(path.join(orig,'a3cc8eb3/qa-integrity.cjs.txt'),p);
  assert.equal(history.historicalBytes('integrity',root).length,4776);
  fs.appendFileSync(p,'\\nINVALID');
  assert.throws(()=>history.historicalBytes('integrity',root));
  fs.unlinkSync(p);
  fs.symlinkSync(path.join(orig,'a3cc8eb3/qa-integrity.cjs.txt'),p);
  assert.throws(()=>history.historicalBytes('integrity',root));
  fs.unlinkSync(p);
  fs.linkSync(path.join(orig,'a3cc8eb3/qa-integrity.cjs.txt'),p);
  assert.throws(()=>history.historicalBytes('integrity',root));
  fs.unlinkSync(p);
  fs.copyFileSync(path.join(orig,'commit-blobs.json'),path.join(root,'commit-blobs.json'));
  assert.equal(Object.keys(history.snapshot(root).c7SuiteBlobs).length,23);
  fs.appendFileSync(path.join(root,'commit-blobs.json'),' ');
  assert.throws(()=>history.snapshot(root));
  // A product suite body changed with the same name must not be substituted.
  const product=fs.mkdtempSync(path.join(os.tmpdir(),'qa-b1-product-'));
  try {
   const suiteDir=path.join(product,'tools/e2e');fs.mkdirSync(suiteDir,{recursive:true});
   fs.writeFileSync(path.join(suiteDir,'drawing.cjs'),'fake code');
   assert.throws(()=>history.c7Suite('drawing',require('../tools/qa-pr121-manifest.json'),product,orig));
   assert.throws(()=>history.c7Suite('../unreviewed',require('../tools/qa-pr121-manifest.json')));
  }finally{fs.rmSync(product,{recursive:true,force:true})}
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
