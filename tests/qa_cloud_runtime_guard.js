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
  fs.copyFileSync(path.join(orig,'a3cc8eb3/qa-integrity.cjs.txt'),p);
  const sibling=path.join(root,'a3cc8eb3/hardlink-copy');
  fs.linkSync(p,sibling); // same temp filesystem: no cross-device EXDEV
  assert.throws(()=>history.historicalBytes('integrity',root));
  fs.unlinkSync(sibling);fs.unlinkSync(p);
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

test('CLOUD-DIAG child allowlist excludes credentials proxy npmrc and preload sentinels',()=>{
 const {childEnv}=require('../tools/qa-cloud-diag.cjs');
 const e=childEnv({PATH:'/safe',GITHUB_SHA:'a'.repeat(40),GH_TOKEN:'PRIVATE',GITHUB_TOKEN:'PRIVATE',ACTIONS_RUNTIME_TOKEN:'PRIVATE',HTTPS_PROXY:'PRIVATE',NODE_PATH:'PRIVATE',NODE_OPTIONS:'PRIVATE',npm_config_userconfig:'PRIVATE'},'/scratch');
 assert.equal(e.PATH,'/safe');assert.equal(e.HOME,'/scratch');assert(!JSON.stringify(e).includes('PRIVATE'));
 assert.equal(e.NPM_CONFIG_USERCONFIG,'/dev/null');assert.equal(e.NPM_CONFIG_GLOBALCONFIG,'/dev/null');
});
test('CLOUD-DIAG drawing17 and full96 require independent complete named reports',()=>{
 const {verifyStage}=require('../tools/qa-cloud-diag.cjs'),m=require('../tools/qa-pr121-manifest.json');
 const e={ZAMEROVAC_EXPECTED_PRODUCT_SHA:'p',ZAMEROVAC_CLOUD_REVIEWED_V_SHA:'q',ZAMEROVAC_CLOUD_EVENT_SHA:'e'};
 function report(mode){const names=mode==='--all'?Object.keys(m.cases):['drawing'];return {status:'PASS',mode,cleanupVerdict:'KNOWN_CLEAN',identity:{sourceSha:'p',validatorSha:'q',eventSha:'e',mode:'cloud',finalized:true},coverage:{status:'PASS',suites:names.length,cases:names.reduce((n,s)=>n+m.cases[s].length,0)},records:names.map(s=>({suite:s,status:'PASS',cleanupVerified:true,caseCount:m.cases[s].length,cases:m.cases[s].map(name=>({name,status:'passed'}))}))}}
 for(const mode of ['--drawing-diagnostic','--all']){
  const good=report(mode);assert(verifyStage(good,mode,e));
  for(const change of [r=>r.records.pop(),r=>r.records[0].cases.pop(),r=>r.records[0].cases[0].status='failed',r=>r.cleanupVerdict='UNKNOWN',r=>r.identity.validatorSha='wrong',r=>r.identity.finalized=false,r=>r.records[0].cases[1]=r.records[0].cases[0]]){const bad=structuredClone(good);change(bad);assert.throws(()=>verifyStage(bad,mode,e))}
 }
 assert.throws(()=>verifyStage(report('--drawing-diagnostic'),'--all',e));
 assert.equal(m.cases.drawing.length,17);
});
test('CLOUD-DIAG context blocks WS external HTTP DNS IPv6 and external redirects',async()=>{
 const policy=require('../tools/qa-cloud-network.cjs');let handler,ws,closed=0;
 await policy.install({async routeWebSocket(_,fn){ws=fn},async route(_,fn){handler=fn}},'http://127.0.0.1:8081');ws({close(){closed++}});assert.equal(closed,1);
 for(const [url,redirect,expected] of [['http://127.0.0.1:8081/a',null,'fulfilled'],['http://127.0.0.1:8081/a','/b','fulfilled'],['http://127.0.0.1:8081/a','https://external.invalid','aborted'],['https://external.invalid',null,'aborted'],['http://localhost:8081',null,'aborted'],['http://[::1]:8081',null,'aborted'],['ws://127.0.0.1:8081',null,'aborted']]){
  let state,fetches=0;await handler({request:()=>({url:()=>url}),abort(){state='aborted'},async fetch(opts){fetches++;assert.equal(opts.maxRedirects,0);return {headers:()=>redirect?{location:redirect}:{}}},fulfill(){state='fulfilled'}});assert.equal(state,expected);if(!policy.local(url,'http://127.0.0.1:8081'))assert.equal(fetches,0);
 }
 const src=fs.readFileSync(path.join(__dirname,'../tools/e2e/harness.cjs'),'utf8');assert(src.includes("serviceWorkers:'block'"));assert(src.indexOf('qa-cloud-network.cjs')<src.indexOf('const page=await context.newPage()'));
});
test('CLOUD-DIAG preparation requires owned preexec scope before any install',()=>{
 const {prepare}=require('../tools/qa-cloud-diag.cjs');const saved=process.env.ZAMEROVAC_DIAG_PREPARE;delete process.env.ZAMEROVAC_DIAG_PREPARE;
 const cp=require('node:child_process'),old=cp.spawnSync;let starts=0;cp.spawnSync=()=>{starts++;throw Error('must not spawn')};
 try{assert.throws(prepare);assert.equal(starts,0)}finally{cp.spawnSync=old;if(saved!==undefined)process.env.ZAMEROVAC_DIAG_PREPARE=saved}
});
