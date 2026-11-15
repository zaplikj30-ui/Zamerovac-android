'use strict';
// A narrow, fail-closed contract for the reviewed flat 15-case fixture suite.
// This is not a general TAP parser. Unknown reporter structure requires review.
const {TextDecoder}=require('node:util');
const maxTapBytes=1024*1024;
const caseNames=Object.freeze([
 'integration preserves all 23 PR121 suites',
 'Actions identity preserves owner, exact ref/SHA and first-attempt protections',
 'offline browser bootstrap is pinned and rejects missing isolation, cache, identity and artifact guards',
 '21 exit-zero suite records without named scenarios cannot be full PASS',
 'a case filter cannot be labelled complete PASS',
 'untrusted existing executable is rejected before any launch',
 'full positive control is exactly 23/96; missing, extra, renamed, duplicated and stale evidence blocks',
 'Windows namespaced canonical paths keep strict target identity',
 'pin verifier rejects changed bytes, wrong paths, symlinks and hardlinks',
 'canonical mismatch reports redacted alias, API and file-identity evidence without permitting it',
 'Windows equivalent canonical spellings pass all binary checks; changed target and reparse points block (API model)',
 'real binary mutation during hashing and name replacement fail closed',
 'junction fixture rejects directory redirection without Windows symlink privilege',
 'real product registration and bytes agree with all 96 pinned scenario identities',
 'separate product checkout is unchanged by QA staging; actual byte tampering blocks',
]);
const expected=Object.freeze({tests:15,pass:15,fail:0,skipped:0});
const keys=Object.keys(expected);
function evaluateTap(bytes,child={}){
 child=child||{};
 const report={status:'BLOCKED',nodeExitOk:child.status===0,
  processOk:child.signal===null&&!child.error,
  stderrEmpty:Buffer.isBuffer(child.stderr)&&child.stderr.length===0,
  encodingOk:false,structureOk:false,planOk:false,casesOk:false,
  summary:Object.fromEntries(keys.map(key=>[key,{available:false,unique:false,integer:false,matches:false}])),
  cases:caseNames.map(name=>({name,available:false,passed:false}))};
 let source;
 try{
  if(!Buffer.isBuffer(bytes)||bytes.length>maxTapBytes)return report;
  source=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replaceAll('\r\n','\n');
  if(/[\r\0]/.test(source))return report;
  report.encodingOk=true;
 }catch{return report}
 const counts=Object.fromEntries([...keys,'suites','cancelled','todo'].map(key=>[key,[]]));
 const seen=caseNames.map(()=>0);
 let valid=true,header=0,plan=0,results=0,pending=null,details=false,canStartDetails=false,duration=0;
 for(const line of source.split('\n')){
  if(details){
   if(line==='  ...')details=false;
   else if(!line.startsWith('  '))valid=false;
   continue;
  }
  if(line==='')continue;
  if(line==='TAP version 13'){
   if(header||results||plan||pending!==null)valid=false;
   header++;continue;
  }
  if(header!==1)valid=false;
  if(line==='  ---'){
   if(!canStartDetails)valid=false;
   details=true;canStartDetails=false;continue;
  }
  canStartDetails=false;
  if(line.startsWith('# Subtest: ')){
   const name=line.slice('# Subtest: '.length);
   if(plan||pending!==null||name!==caseNames[results])valid=false;
   pending=name;continue;
  }
  const result=/^(ok|not ok) ([1-9][0-9]*) - (.+)$/.exec(line);
  if(result){
   const [,status,index,name]=result;
   const position=caseNames.indexOf(name);
   const agrees=!plan&&Number(index)===results+1&&name===caseNames[results]&&pending===name;
   if(!agrees||status!=='ok')valid=false;
   if(position!==-1){
    seen[position]++;
    report.cases[position].available=true;
    report.cases[position].passed=seen[position]===1&&agrees&&status==='ok';
   }
   results++;pending=null;canStartDetails=true;continue;
  }
  const testPlan=/^1\.\.([0-9]+)$/.exec(line);
  if(testPlan){
   plan++;
   report.planOk=plan===1&&testPlan[1]==='15'&&results===15&&pending===null;
   if(!report.planOk)valid=false;
   continue;
  }
  const count=/^# (tests|pass|fail|skipped|suites|cancelled|todo)(?: (.*))?$/.exec(line);
  if(count){
   if(plan!==1)valid=false;
   counts[count[1]].push(count[2]);continue;
  }
  if(/^# duration_ms (?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(line)){
   if(plan!==1||++duration!==1)valid=false;
   continue;
  }
  // Test stdout/stderr is TAP-commented by Node. Never print these comments.
  if(line.startsWith('# ')||line==='#')continue;
  valid=false; // Includes bailouts, nested results, directives and raw output.
 }
 for(const key of keys){
  const values=counts[key];
  report.summary[key]={available:values.length>0,
   unique:values.length===1,
   integer:values.length>0&&values.every(value=>/^(?:0|[1-9][0-9]*)$/.test(value)&&Number.isSafeInteger(Number(value))),
   matches:values.length===1&&values[0]===String(expected[key])};
 }
 for(const key of ['suites','cancelled','todo'])
  if(counts[key].length&&(counts[key].length!==1||counts[key][0]!=='0'))valid=false;
 report.structureOk=valid&&header===1&&!details&&pending===null;
 report.planOk=report.planOk&&plan===1;
 report.casesOk=results===15&&report.cases.every(item=>item.available&&item.passed);
 if(report.nodeExitOk&&report.processOk&&report.stderrEmpty&&report.encodingOk&&report.structureOk&&report.planOk&&report.casesOk
  &&keys.every(key=>report.summary[key].matches))report.status='PASS';
 return report;
}
function formatReport(report){
 if(report.status==='PASS')return 'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';
 // Rebuild the output from constants/booleans, never echo TAP/error/OS metadata.
 const safe={};
 for(const key of ['nodeExitOk','processOk','stderrEmpty','encodingOk','structureOk','planOk','casesOk'])safe[key]=report[key]===true;
 safe.summary=Object.fromEntries(keys.map(key=>[key,{
  available:report.summary?.[key]?.available===true,unique:report.summary?.[key]?.unique===true,
  integer:report.summary?.[key]?.integer===true,matches:report.summary?.[key]?.matches===true}]));
 safe.cases=caseNames.map((name,i)=>({name,available:report.cases?.[i]?.available===true,passed:report.cases?.[i]?.passed===true}));
 return 'FIXTURE_GATE_BLOCKED '+JSON.stringify(safe)+'\n';
}
module.exports={caseNames,maxTapBytes,evaluateTap,formatReport};
