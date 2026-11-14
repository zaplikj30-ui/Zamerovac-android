'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {diagnose,recordFor,evidence,MAX_ATTEMPTS,ATTEMPT_MS,TOTAL_MS}=require('../tools/qa-fixture-attempts.cjs');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP';
const success=()=>({passed:true,cleanupVerified:true,ownedRemaining:0,temporaryFilesRemoved:true,
 workerPassed:true,ownerSucceeded:true,timedOut:false,cancelled:false,diagnostic:null,publicReport:passLine});
const failed=()=>({passed:false,cleanupVerified:true,ownedRemaining:0,temporaryFilesRemoved:true,
 workerPassed:false,ownerSucceeded:false,timedOut:false,cancelled:false,
 diagnostic:{stage:'owner-launch',win32Error:5},publicReport:'FIXTURE_GATE_BLOCKED {"nodeExitOk":false,"planOk":false}'});
const run=async(sequence,options={})=>{
 const lines=[];let count=0;let duration=0;
 const result=await diagnose({runOne:async(ms,writer)=>{assert.equal(ms,60000);assert.equal(typeof writer,'function');count++;duration+=3000;const next=sequence.shift();if(next instanceof Error)throw next;if(typeof next==='function')return next();return next;},
 print:s=>lines.push(s),clock:()=>duration,...options});
 return {result,lines,count};
};
test('positive: first attempt PASS prints exactly one original success marker',async()=>{
 const {result,lines,count}=await run([success()]);
 assert.equal(count,1);assert.equal(result.success,true);assert.equal(result.status,'PASS_FIRST_ATTEMPT');
 assert.deepEqual(lines.filter(x=>x===passLine),[passLine]);
 assert.equal(JSON.parse(lines.find(x=>x.startsWith('QA_FINAL ')).slice(9)).exitCode,0);
});
test('one safe early BLOCKED then PASS: original failure retained and FINAL never clean PASS',async()=>{
 const {result,lines,count}=await run([failed(),success()]);
 assert.equal(count,2);assert.equal(result.success,false);assert.equal(result.status,'RECOVERED_WITH_PRIOR_BLOCKED');
 assert.equal(lines.filter(x=>x.startsWith('QA_ATTEMPT ')).length,2);
 const first=JSON.parse(lines.find(x=>x.startsWith('QA_ATTEMPT ')).slice(11));
 assert.equal(first.diagnostic.stage,'owner-launch');assert.equal(first.diagnostic.win32Error,5);
 assert(lines.some(x=>x.startsWith('QA_ATTEMPT_FIXED_CASES ')));
 assert(!lines.includes(passLine));assert.equal(result.records[0].status,'BLOCKED');
 assert.equal(result.records[1].status,'PASS');
});
test('3 sequential safe failures hard cap: no fourth attempt',async()=>{
 const {result,count,lines}=await run([failed(),failed(),failed(),success()]);
 assert.equal(count,3);assert.equal(MAX_ATTEMPTS,3);assert.equal(result.success,false);
 assert.equal(result.attempts,3);assert.equal(result.status,'BLOCKED');assert(!lines.includes(passLine));
});
test('unverified cleanup OR surviving owned process stops immediately',async()=>{
 for(const altered of [{cleanupVerified:false},{ownedRemaining:1},{ownedRemaining:null},
                       {temporaryFilesRemoved:false}]){
  const {result,count}=await run([{...failed(),...altered},success()]);
  assert.equal(count,1);assert.equal(result.status,'STOP_UNVERIFIED_CLEANUP');
 }
});
test('timeout with proven cleanup still STOP; timeout with uncertain cleanup is never retried',async()=>{
 for(const cleaned of [true,false]){
  const {result,count}=await run([{...failed(),timedOut:true,cleanupVerified:cleaned},success()]);
  assert.equal(count,1);assert.equal(result.status,cleaned?'STOP_TIMEOUT':'STOP_UNVERIFIED_CLEANUP');
 }
});
test('interrupt / cancellation before first and during first stops next',async()=>{
 const pre=new AbortController();pre.abort();
 const before=await run([success()],{signal:pre.signal});assert.equal(before.count,0);
 assert.equal(before.result.status,'STOP_CANCELLED');
 const inRun=new AbortController();let count=0;
 const lines=[];
 const value=await diagnose({signal:inRun.signal,print:s=>lines.push(s),
  runOne:async()=>{count++;inRun.abort();return failed()}});
 assert.equal(count,1);assert.equal(value.status,'STOP_CANCELLED');
});
test('invalid/missing contradictory PASS never accepted or retried',async()=>{
 for(const item of [null,new Error('PRIVATE PATH TOKEN'),{...success(),diagnostic:{stage:'owner-launch',win32Error:5}},
  {...success(),ownerSucceeded:false},{...success(),publicReport:'FIXTURE_GATE_BLOCKED {}'},
  {...failed(),workerPassed:true,ownerSucceeded:true}, {...failed(),cleanupVerified:'true'}]){
  const {result,count,lines}=await run([item,success()]);assert.equal(count,1);assert(!result.success);
  assert(!lines.includes(passLine));
 }
});
test('no raw sensitive metadata, arbitrary report is rebuilt from known booleans',async()=>{
 const privateText='PRIVATE_ACCOUNT=ZamerovacQA C:\\SECRET\\USER TOKEN=abcd PID=1234';
 const {result,lines}=await run([{...failed(),publicReport:'FIXTURE_GATE_BLOCKED '+JSON.stringify({nodeExitOk:false,planOk:false,privateText}),
  diagnostic:{stage:'unknown',win32Error:null},error:privateText},success()]);
 assert.equal(result.status,'RECOVERED_WITH_PRIOR_BLOCKED');
 const full=lines.join('\n');assert(!full.includes('PRIVATE'));assert(!full.includes('TOKEN='));assert(!full.includes('PID='));
 assert(!full.includes('SECRET'));assert(!full.includes('ZamerovacQA'));
});
test('deadline prevents new attempt without allowing background or concurrency',async()=>{
 let time=0;let active=0,maxActive=0,count=0;
 const result=await diagnose({clock:()=>time,print:()=>{},runOne:async()=>{
  active++;maxActive=Math.max(maxActive,active);count++;time+=95000;active--;return failed();}});
 assert.equal(count,2);assert.equal(maxActive,1);assert.equal(result.status,'STOP_TOTAL_DEADLINE');
 assert.equal(ATTEMPT_MS,60000);assert.equal(TOTAL_MS,240000);
});
