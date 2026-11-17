'use strict';
// Local SOURCE fault injection only: no browser/owner/npm, no GitHub Actions.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const modulePath=path.join(__dirname,'qa-cloud-handoff.cjs');
const source=fs.readFileSync(modulePath,'utf8');
const P='3886fcf80213e4693464d3f30104885c1c58f53e',Q='b'.repeat(40),E='c'.repeat(40);
const digest='a'.repeat(64);
const root='/tmp/qa-c-local',stage=root+'/zamerovac-cloud-stage',
 finalRoot=root+'/zamerovac-cloud-final';
function harness(opts={}){
 let rename=0,moved=false,python=0;
 const inv={schema:1,complete:true,productSha:P,validatorSha:Q,eventSha:E};
 const fakeFs={
  realpathSync:Object.assign(x=>x,{native:x=>x}),
  lstatSync(p){
   if(p===root)return {isDirectory:()=>true,isSymbolicLink:()=>false,
    uid:1001,dev:10,ino:11,mode:0o040755,nlink:2};
   if(p===stage||p===finalRoot)return {isDirectory:()=>true,
    isSymbolicLink:()=>false,uid:opts.wrongUid?1:1001,dev:10,ino:12,
    mode:opts.badMode?0o040777:0o040700,nlink:2};
   throw Error('unexpected lstat '+p);
  },
  existsSync(p){if(p===finalRoot)return opts.collision===true||moved;
   if(p===stage)return !moved;throw Error('unexpected exists '+p)},
  renameSync(a,b){rename++;assert.equal(a,stage);assert.equal(b,finalRoot);
   if(opts.exdev)throw Object.assign(Error('different filesystem'),{code:'EXDEV'});
   moved=true},
  readdirSync(p){if(p===finalRoot)return [];throw Error('unexpected dir '+p)},
  readFileSync(){throw Error('unexpected read')},
  statSync(){throw Error('unexpected stat')}
 };
 const fakeRuntime={
  checked(){return JSON.stringify(inv)},
  exactlyTree(){throw Error('unexpected module verification')},
  approvedRuntime(){throw Error('unexpected runtime approval')}
 };
 const fakeCrypto={createHash(){return{update(){return this},digest(){return digest}}}};
 const fakeProcess={platform:'linux',getuid:()=>1001,execPath:'/node'};
 const mod={exports:{}};
 vm.runInNewContext(source,{module:mod,__dirname:'/tools',process:fakeProcess,
  Buffer,Date,require(k){
   if(k==='node:fs')return fakeFs;
   if(k==='node:path')return path.posix;
   if(k==='node:crypto')return fakeCrypto;
   if(k==='node:child_process')return{execFileSync(){python++;throw Error('must not run Python')}};
   if(k==='./qa-cloud-runtime.cjs')return fakeRuntime;
   if(k==='./qa-browser/package-lock.json')return{};
   throw Error('unexpected import '+k);
  }});
 const env={RUNNER_TEMP:root,ZAMEROVAC_CLOUD_STAGE:stage,
  ZAMEROVAC_CLOUD_SCRATCH:finalRoot,ZAMEROVAC_CLOUD_INVENTORY_SHA256:digest,
  ZAMEROVAC_EXPECTED_PRODUCT_SHA:P,ZAMEROVAC_CLOUD_REVIEWED_V_SHA:Q,
  ZAMEROVAC_CLOUD_EVENT_SHA:E,GITHUB_SHA:E,GITHUB_RUN_ID:'123',
  GITHUB_RUN_ATTEMPT:'1',ZAMEROVAC_CLOUD_DEADLINE:String(Date.now()+600000)};
 return {accept:mod.exports.acceptPrepared,env,stats:()=>({rename,python,moved})};
}
test('wrong P/Q/E, attempt, expired deadline and unapproved inventory all stop before rename',()=>{
 for(const edit of [
  {ZAMEROVAC_EXPECTED_PRODUCT_SHA:'f'.repeat(40)},
  {ZAMEROVAC_CLOUD_REVIEWED_V_SHA:'z'.repeat(40)},
  {ZAMEROVAC_CLOUD_EVENT_SHA:'d'.repeat(40)},
  {GITHUB_SHA:'d'.repeat(40)},
  {GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_RUN_ID:'0'},
  {ZAMEROVAC_CLOUD_INVENTORY_SHA256:'0'.repeat(64)},
  {ZAMEROVAC_CLOUD_DEADLINE:'1'}
 ]){
  const h=harness();assert.throws(()=>h.accept({...h.env,...edit}));
  assert.deepEqual(h.stats(),{rename:0,python:0,moved:false});
 }
});
test('foreign owner, unsafe mode and preexisting target collision never overwrite',()=>{
 for(const cfg of [{wrongUid:true},{badMode:true},{collision:true}]){
  const h=harness(cfg);assert.throws(()=>h.accept(h.env));
  assert.deepEqual(h.stats(),{rename:0,python:0,moved:false});
 }
});
test('EXDEV from the only whole-root rename is STOP with no copy retry',()=>{
 const h=harness({exdev:true});assert.throws(()=>h.accept(h.env));
 assert.deepEqual(h.stats(),{rename:1,python:0,moved:false});
});
test('post-rename missing/extra content cannot be mistaken for PASS',()=>{
 const h=harness();assert.throws(()=>h.accept(h.env));
 assert.deepEqual(h.stats(),{rename:1,python:0,moved:true});
});
test('no second npm or browser CLI exists inside Q orchestrator or handoff',()=>{
 const diag=fs.readFileSync(path.join(__dirname,'qa-cloud-diag.cjs'),'utf8');
 const provision=fs.readFileSync(path.join(__dirname,'qa_cloud_provision.py'),'utf8');
 assert(!diag.includes("run('npm'")&&!diag.includes('spawnSync(exe,args'));
 assert(!source.includes('npm ci')&&!source.includes('playwright/cli.js'));
 assert.equal((provision.match(/run_group\(\[npm, 'ci'/g)||[]).length,1);
 assert.equal((provision.match(/'install', 'chromium', '--no-shell'/g)||[]).length,1);
});
test('token must not cross into Python verifier environment',()=>{
 assert(source.includes("const pyEnv={PATH:"));
 assert(!source.includes('QA_CLOUD_METADATA_TOKEN'));
 assert(!source.includes('ACTIONS_RUNTIME_TOKEN'));
 assert(!source.includes('GITHUB_TOKEN'));
});
