'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {diagnose,recordFor,evidence,MAX_ATTEMPTS,ATTEMPT_MS,TOTAL_MS}=require('../tools/qa-fixture-attempts.cjs');
const {safeDiagnostic}=require('../tools/qa-process-client.cjs');
const tap=require('../tools/qa-fixture-tap.cjs');
const passLine='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP';
const success=()=>({passed:true,cleanupVerified:true,ownedRemaining:0,temporaryFilesRemoved:true,
 workerPassed:true,ownerSucceeded:true,timedOut:false,cancelled:false,diagnostic:null,publicReport:passLine});
const failed=()=>({passed:false,cleanupVerified:true,ownedRemaining:0,temporaryFilesRemoved:true,
 workerPassed:false,ownerSucceeded:false,timedOut:false,cancelled:false,
 retryEligible:true,diagnostic:{stage:'verdict-open',win32Error:null},
 publicReport:tap.formatReport(tap.evaluateTap(undefined)).trimEnd()});
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
 assert.equal(first.diagnostic.stage,'verdict-open');assert.equal(first.diagnostic.win32Error,null);
 assert.equal(first.retryEligible,true);
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
  diagnostic:{stage:'verdict-open',win32Error:null},error:privateText},success()]);
 assert.equal(result.status,'RECOVERED_WITH_PRIOR_BLOCKED');
 const full=lines.join('\n');assert(!full.includes('PRIVATE'));assert(!full.includes('TOKEN='));assert(!full.includes('PID='));
 assert(!full.includes('SECRET'));assert(!full.includes('ZamerovacQA'));
});
test('deadline prevents new attempt without allowing background or concurrency',async()=>{
 let time=0;let active=0,maxActive=0,count=0;
 const result=await diagnose({clock:()=>time,print:()=>{},runOne:async()=>{
  active++;maxActive=Math.max(maxActive,active);count++;time+=80000;active--;return failed();}});
 assert.equal(count,2);assert.equal(maxActive,1);assert.equal(result.status,'STOP_TOTAL_DEADLINE');
 assert.equal(ATTEMPT_MS,60000);assert.equal(TOTAL_MS,240000);
});

test('SEC01 real production diagnostic whitelist: logical code null, native code5 retained',()=>{
 assert.deepEqual(safeDiagnostic({stage:'owner-launch',win32Error:5}),{stage:'owner-launch',win32Error:null});
 assert.deepEqual(safeDiagnostic({stage:'CreateProcessW',win32Error:5}),{stage:'CreateProcessW',win32Error:5});
 const {diagnostic}=recordFor(1,{...failed(),diagnostic:{stage:'owner-launch',win32Error:5}});
 assert.deepEqual(diagnostic,{stage:'owner-launch',win32Error:null});
});
test('R44-01 sequencer ignores forged retry eligibility after native creation error',async()=>{
 const native={...failed(),retryEligible:true,
  diagnostic:{stage:'CreateProcessW',win32Error:5}};
 const {result,count}=await run([native,success()]);
 assert.equal(count,1);
 assert.equal(result.status,'STOP_NOT_EARLY_DIAGNOSTIC');
 assert.equal(result.records[0].retryEligible,false);
 assert.deepEqual(result.records[0].diagnostic,{stage:'CreateProcessW',win32Error:5});
});
test('SEC02 a real TAP failure with verified cleanup must not trigger another attempt',async()=>{
 const tapFailure={...failed(),retryEligible:false,diagnostic:{stage:'worker-result',win32Error:null},
  publicReport:tap.formatReport(tap.evaluateTap(undefined,{status:1,signal:null,stderr:Buffer.alloc(0)})).trimEnd()};
 const {result,count}=await run([tapFailure,success()]);
 assert.equal(count,1);assert.equal(result.status,'STOP_NOT_EARLY_DIAGNOSTIC');
 const spoofed=await run([{...tapFailure,retryEligible:true},success()]);
 assert.equal(spoofed.count,1);assert.equal(spoofed.result.status,'STOP_NOT_EARLY_DIAGNOSTIC');
});
test('QA130-TIME monotonic elapsed after each return: 95s early BLOCKED prevents retry',async()=>{
 let time=0,count=0;
 const result=await diagnose({clock:()=>time,print:()=>{},runOne:async()=>{
  count++;time+=95000;return failed();}});
 assert.equal(count,1);assert.equal(result.status,'STOP_ATTEMPT_DEADLINE');
});
