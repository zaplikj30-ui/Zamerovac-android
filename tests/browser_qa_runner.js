'use strict';
// Runs in existing fast Node regression, no Playwright download, no Android/APK.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {initialRecords,statusReport,killTreeArgs,checkedCases,modes}=require('../tools/local-browser-qa.cjs');
const approvedCases=require('../tools/sync116_case_manifest.json').chromium;
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zamerovac-browser-qa-'));
try{
 const records=initialRecords('--all');
 assert.equal(records.length,23);
 assert(records.some(x=>x.suite==='pending-audio'));
 assert(records.some(x=>x.suite==='legacy-conflict-persistence'));
 assert(records.every(x=>x.status==='NOT RUN'));
 let report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts['NOT RUN'],23);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8')).sourceSha,'a'.repeat(40));
 records[0]={...records[0],status:'FAIL',error:'interrupted during execution'};
 report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts.FAIL,1);
 assert.equal(report.counts['NOT RUN'],22);
 assert.equal(fs.existsSync(path.join(dir,'results.json.tmp')),false);
 records[0]={...records[0],status:'PASS',error:null};
 report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts.PASS,1);
 assert.equal(report.counts['NOT RUN'],22);
 assert.deepEqual(killTreeArgs(1234,'win32'),['taskkill.exe',['/PID','1234','/T','/F']]);
 assert.equal(killTreeArgs(1234,'linux'),null);
 assert.throws(()=>killTreeArgs(-1,'win32'),/PID/);
 assert.equal(modes['--all'].length,23);

 const fake=records.map(r=>({...r,status:'PASS',
  scenarioTotal:approvedCases[r.suite].length,
  scenarioPassed:approvedCases[r.suite].length,
  scenarioNames:[...approvedCases[r.suite]],error:null}));
 const verifiedIntegrity={status:'PASS',digest:'synthetic-only'};
 report=statusReport('--all',fake,dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.actualCases,92);
 assert.equal(report.coverage.status,'PASS');
 report=statusReport('--all',fake.map((r,i)=>i===0?{...r,scenarioTotal:r.scenarioTotal+1,scenarioPassed:r.scenarioPassed+1}:r),
  dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.status,'FAIL','93 cases cannot impersonate 92');
 report=statusReport('--all',fake.map((r,i)=>i===0?{...r,scenarioPassed:r.scenarioPassed-1}:r),
  dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.status,'FAIL','incomplete cases must not PASS');
 report=statusReport('--all',fake,dir,'a'.repeat(40),{status:'FAIL',error:'dirty source'});
 assert.equal(report.coverage.status,'FAIL','source mutation cannot PASS');
 const fakeSuites=fake.map((r,i)=>({...r,suite:'suite'+i}));
 report=statusReport('--all',fakeSuites,dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.status,'FAIL','23 fabricated suites cannot PASS');
 const substituted=fake.map((r,i)=>i===0?{...r,
  scenarioNames:['unapproved-scenario',...r.scenarioNames.slice(1)]}:r);
 report=statusReport('--all',substituted,dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.status,'FAIL','renamed scenario at 92 cannot PASS');
 const reordered=fake.map((r,i)=>i===0?{...r,
  scenarioNames:[...r.scenarioNames].reverse()}:r);
 report=statusReport('--all',reordered,dir,'a'.repeat(40),verifiedIntegrity);
 assert.equal(report.coverage.status,'FAIL','reordered required cases cannot PASS');
 const e2eReport=path.join(dir,'evidence','pending-audio','report.json');
 fs.mkdirSync(path.dirname(e2eReport),{recursive:true});
 const valid={suite:'pending-audio',sha:'a'.repeat(40),syntheticOnly:true,
              cases:approvedCases['pending-audio'].map(name=>({name,status:'passed'}))};
 fs.writeFileSync(e2eReport,JSON.stringify(valid));
 assert.deepEqual(checkedCases('pending-audio',dir,'a'.repeat(40)),
                  {scenarioTotal:8,scenarioPassed:8,
                   scenarioNames:approvedCases['pending-audio']});
 assert.throws(()=>checkedCases('pending-audio',dir,'b'.repeat(40)),/Untrusted/);
 fs.writeFileSync(e2eReport,JSON.stringify({...valid,cases:valid.cases.map((v,i)=>
  i===0?{...v,status:'failed'}:v)}));
 assert.throws(()=>checkedCases('pending-audio',dir,'a'.repeat(40)),/Incomplete|unapproved/);
 fs.writeFileSync(e2eReport,JSON.stringify({...valid,cases:valid.cases.map((v,i)=>
  i===0?{...v,name:'replaced-scenario'}:v)}));
 assert.throws(()=>checkedCases('pending-audio',dir,'a'.repeat(40)),/Missing|unapproved/);
 fs.writeFileSync(e2eReport,JSON.stringify({...valid,cases:valid.cases.slice(1)}));
 assert.throws(()=>checkedCases('pending-audio',dir,'a'.repeat(40)),/Missing|unapproved/);

 const gateRunner=path.join(__dirname,'..','tools','local-browser-qa.cjs');

 // A real synthetic local Git commit: tracked bytes change while HEAD stays identical.
 const fixture=path.join(dir,'fixture-repo');
 fs.mkdirSync(path.join(fixture,'app','src','main','assets'),{recursive:true});
 fs.mkdirSync(path.join(fixture,'tools','e2e'),{recursive:true});
 for(let i=0;i<22;i++)fs.writeFileSync(
  path.join(fixture,'tools','e2e','fixture-'+i+'.cjs'),'module.exports='+i+'\n');
 fs.writeFileSync(path.join(fixture,'app','src','main','assets','index.html'),'<title>original</title>');
 const git=args=>spawnSync('git',args,{cwd:fixture,encoding:'utf8',timeout:10000});
 assert.equal(git(['init']).status,0);
 assert.equal(git(['add','app/src/main/assets','tools/e2e']).status,0);
 assert.equal(git(['-c','user.name=QA-test','-c','user.email=qa@example.invalid',
                   'commit','-m','synthetic fixture']).status,0);
 const testScript=path.join(dir,'git-integrity.cjs');
 const testBody=[
  'const {sourceSnapshot,stableSnapshot}=require('+JSON.stringify(gateRunner)+');',
  "const fs=require('fs'),path=require('path'),assert=require('assert/strict');",
  'const start=sourceSnapshot();',
  "const file=path.join(process.env.ZAMEROVAC_SOURCE_ROOT,'app/src/main/assets/index.html');",
  "fs.appendFileSync(file,'tampered but HEAD unchanged');",
  "assert.throws(()=>stableSnapshot(start),/Dirty browser source|changed/);"
 ].join('\n');
 fs.writeFileSync(testScript,testBody);
 const dirtyProbe=spawnSync(process.execPath,[testScript],{
  cwd:fixture,encoding:'utf8',timeout:10000,
  env:{...process.env,ZAMEROVAC_SOURCE_ROOT:fixture,
       TESTED_SHA:git(['rev-parse','HEAD']).stdout.trim()}});
 assert.equal(dirtyProbe.status,0,'Dirty tracked source was accepted: '+dirtyProbe.stderr);

 // The pinned runner's real localhost HTTP path is exercised, not only its CLI shape.
 const serverProbe=spawnSync(process.execPath,[gateRunner,'--self-test'],{
  cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:15000,
  env:{...process.env,ZAMEROVAC_SOURCE_ROOT:path.resolve(__dirname,'..')}});
 assert.equal(serverProbe.status,0,'Local HTTP server self-test failed: '+serverProbe.stderr);
 assert.match(serverProbe.stdout,/PASS local Chromium server/);

 const sourceDir=path.join(dir,'approved-product-source');
 const probe=spawnSync(process.execPath,['-e',
  'process.stdout.write(require(process.argv[1]).sourceRoot)',gateRunner],
  {cwd:path.resolve(__dirname,'..'),encoding:'utf8',timeout:10000,
   env:{...process.env,ZAMEROVAC_SOURCE_ROOT:sourceDir}});
 assert.equal(probe.status,0,probe.stderr);
 assert.equal(probe.stdout,path.resolve(sourceDir),
  'Pinned runner must execute the explicitly approved product checkout');

 console.log('PASS browser durable checkpoint / NOT RUN / process-tree kill contract');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
