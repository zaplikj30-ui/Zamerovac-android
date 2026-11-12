'use strict';
// Runs in existing fast Node regression, no Playwright download, no Android/APK.
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {initialRecords,statusReport,killTreeArgs,modes}=require('../tools/local-browser-qa.cjs');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'zamerovac-browser-qa-'));
try{
 const records=initialRecords('--all');
 assert.equal(records.length,21);
 assert(records.every(x=>x.status==='NOT RUN'));
 let report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts['NOT RUN'],21);
 assert.equal(JSON.parse(fs.readFileSync(path.join(dir,'results.json'),'utf8')).sourceSha,'a'.repeat(40));
 records[0]={...records[0],status:'FAIL',error:'interrupted during execution'};
 report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts.FAIL,1);
 assert.equal(report.counts['NOT RUN'],20);
 assert.equal(fs.existsSync(path.join(dir,'results.json.tmp')),false);
 records[0]={...records[0],status:'PASS',error:null};
 report=statusReport('--all',records,dir,'a'.repeat(40));
 assert.equal(report.counts.PASS,1);
 assert.equal(report.counts['NOT RUN'],20);
 assert.deepEqual(killTreeArgs(1234,'win32'),['taskkill.exe',['/PID','1234','/T','/F']]);
 assert.equal(killTreeArgs(1234,'linux'),null);
 assert.throws(()=>killTreeArgs(-1,'win32'),/PID/);
 assert.equal(modes['--all'].length,21);
 console.log('PASS browser durable checkpoint / NOT RUN / process-tree kill contract');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
