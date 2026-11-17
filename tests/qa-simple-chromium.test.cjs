'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module');
const temp=fs.mkdtempSync(path.join(os.tmpdir(),'qa-simple-chromium-'));
const previous={dir:process.env.ZAMEROVAC_E2E_DIR,hosted:process.env.ZAMEROVAC_SIMPLE_CHROMIUM,cases:process.env.ZAMEROVAC_CASES,CI:process.env.CI,GITHUB_ACTIONS:process.env.GITHUB_ACTIONS};
process.env.ZAMEROVAC_E2E_DIR=temp;
const loaded=()=>{
 let launched=0,sandboxed=0,closed=0,contextsClosed=0;
 const scenario={launchFail:false,testFail:false,closeFail:false};
 const browser={
  newContext:async()=>({
   tracing:{start:async()=>{},stop:async()=>{}},
   newPage:async()=>({
    setDefaultTimeout:()=>{},on:()=>{},goto:async()=>{},waitForTimeout:async()=>{},
    screenshot:async()=>{},evaluate:async()=>null,content:async()=>''
   }),
   close:async()=>{contextsClosed++}
  }),
  close:async()=>{closed++;if(scenario.closeFail)throw Error('synthetic browser.close failure')}
 };
 const original=Module._load;
 Module._load=function(id,parent,isMain){
  if(id==='playwright')return {chromium:{launch:async()=>{launched++;if(scenario.launchFail)throw Error('synthetic launch failure');return browser}}};
  if(id==='./sandbox.cjs')return {launchSandboxed:async()=>{sandboxed++;return {browser,evidence:{mode:'old'}}},launchOptions:()=>({})};
  return original.call(this,id,parent,isMain)
 };
 let harness;
 try{delete require.cache[require.resolve('../tools/e2e/harness.cjs')];harness=require('../tools/e2e/harness.cjs')}
 finally{Module._load=original}
 return {harness,scenario,stats:()=>({launched,sandboxed,closed,contextsClosed})};
};
let seq=0;
const run=async ({harness,scenario},failure=false)=>{
 const name='mock-'+(++seq);
 const result=harness.suite(name,async runCase=>{
  await runCase('dimension',async()=>{if(failure||scenario.testFail)throw Error('synthetic assertion failure')});
 });
 return {result,file:path.join(temp,name,'report.json')};
};
test('explicit simple switch uses ordinary Chromium, closes browser, records case result',async()=>{
 process.env.ZAMEROVAC_SIMPLE_CHROMIUM='1';delete process.env.ZAMEROVAC_CASES;
 const ctx=loaded(),{result,file}=await run(ctx);await result;
 assert.deepEqual(ctx.stats(),{launched:1,sandboxed:0,closed:1,contextsClosed:1});
 const r=JSON.parse(fs.readFileSync(file));assert.equal(r.status,'COMPLETE');assert.deepEqual(r.cases.map(c=>[c.name,c.status]),[['dimension','passed']]);
});
test('generic CI and GITHUB_ACTIONS never select new mode; default is original sandbox',async()=>{
 delete process.env.ZAMEROVAC_SIMPLE_CHROMIUM;process.env.CI='true';process.env.GITHUB_ACTIONS='true';
 const ctx=loaded(),{result}=await run(ctx);await result;
 assert.deepEqual(ctx.stats(),{launched:0,sandboxed:1,closed:1,contextsClosed:1});
});
test('browser launch failure is BLOCKED not PASS',async()=>{
 process.env.ZAMEROVAC_SIMPLE_CHROMIUM='1';const ctx=loaded();ctx.scenario.launchFail=true;
 const {result,file}=await run(ctx);await assert.rejects(result,/synthetic launch failure/);
 assert.equal(JSON.parse(fs.readFileSync(file)).status,'BLOCKED');
});
test('failed assertion closes browser and reports FAIL',async()=>{
 process.env.ZAMEROVAC_SIMPLE_CHROMIUM='1';const ctx=loaded();const {result,file}=await run(ctx,true);
 await assert.rejects(result,/failed 1 cases/);
 assert.equal(JSON.parse(fs.readFileSync(file)).status,'FAIL');
 assert.equal(ctx.stats().closed,1);
});
test('browser close failure must not report PASS',async()=>{
 process.env.ZAMEROVAC_SIMPLE_CHROMIUM='1';const ctx=loaded();ctx.scenario.closeFail=true;
 const {result,file}=await run(ctx);await assert.rejects(result,/synthetic browser.close failure/);
 assert.equal(JSON.parse(fs.readFileSync(file)).status,'FAIL');
});
test('filtered case results are marked PARTIAL, not COMPLETE',async()=>{
 process.env.ZAMEROVAC_SIMPLE_CHROMIUM='1';process.env.ZAMEROVAC_CASES='dimension';
 const ctx=loaded(),{result,file}=await run(ctx);await result;
 assert.equal(JSON.parse(fs.readFileSync(file)).status,'PARTIAL');
});
test.after(()=>{
 for(const [name,value] of Object.entries({ZAMEROVAC_E2E_DIR:previous.dir,ZAMEROVAC_SIMPLE_CHROMIUM:previous.hosted,ZAMEROVAC_CASES:previous.cases,CI:previous.CI,GITHUB_ACTIONS:previous.GITHUB_ACTIONS})){
  if(value===undefined)delete process.env[name];else process.env[name]=value;
 }
 fs.rmSync(temp,{recursive:true,force:true});
});
