/* Regression: Windows self-hosted Git CLI absence must fail before Chromium launch.
 * No Playwright install, network, device or real browser required. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const source=fs.readFileSync(path.resolve(__dirname,'../tools/e2e/harness.cjs'),'utf8');
const directory=fs.mkdtempSync(path.join(os.tmpdir(),'zamerovac-preflight-'));
let launches=0,gitChecks=0;
const moduleForTest={exports:{}};
const sandbox={
 module:moduleForTest,
 process:{argv:[],env:{ZAMEROVAC_E2E_DIR:directory}},
 require(id){
  if(id==='playwright')return {chromium:{async launch(){launches++;return {async close(){}}}}};
  if(id==='node:child_process')return {execFileSync(cmd,args){
   gitChecks++;
   assert.equal(cmd,'git');
   assert.equal(Array.from(args).join(' '),'rev-parse HEAD');
   const error=new Error('spawnSync git ENOENT');error.code='ENOENT';throw error;
  }};
  return require(id);
 }
};
(async()=>{
 try{
  vm.runInNewContext(source,sandbox,{filename:'tools/e2e/harness.cjs'});
  assert.equal(typeof moduleForTest.exports.suite,'function');
  await assert.rejects(
   moduleForTest.exports.suite('missing-git',async()=>{throw Error('Should never run cases')}),
   error=>error.code==='ENOENT'&&String(error.message).includes('git'));
  assert.equal(gitChecks,1,'The exact checked-out SHA must be checked');
  assert.equal(launches,0,'Missing Git must never start a potentially orphaned Chromium process');
  console.log('PASS: git ENOENT fails before Chromium launch; no 8-minute timeout');
 }finally{fs.rmSync(directory,{recursive:true,force:true})}
})().catch(error=>{console.error(error);process.exitCode=1});
