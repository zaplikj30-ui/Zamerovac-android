'use strict';
// Runs in existing fast Node regression, no Playwright download, no Android/APK.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {initialRecords,statusReport,killTreeArgs,modes}=require('../tools/local-browser-qa.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zamerovac-browser-qa-'));
try{
 const records=initialRecords('--all');
 assert.equal(records.length,23)
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
 assert.equal(modes['--all'].length,21);
 const gateRunner=path.join(__dirname,'..','tools','local-browser-qa.cjs');
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
