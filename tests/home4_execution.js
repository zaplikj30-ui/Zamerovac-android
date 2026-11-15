'use strict';
// Actual contract functions; synthetic Node events / private temp only, no HOME.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const reporter=require('../tools/qa/home4-node-reporter.cjs'),p=require('../tools/qa/home4-policy.cjs');
const {reserve,checkLease,release}=require('../tools/qa/home4.cjs');
function events(){return [{type:'test:pass',data:{name:'case',nesting:0,details:{type:'test'}}},{type:'test:summary',data:{counts:{tests:1,topLevel:1,passed:1,failed:0,skipped:0,todo:0,cancelled:0,suites:0}}}]}
async function report(rows){let text='';for await(const chunk of reporter(rows))text+=chunk;return JSON.parse(text)}
test('HOME4 structured reporter accepts complete supported Node events',async()=>{
 const r=await report(events());assert.equal(r.complete,true);assert.deepEqual(r.cases,[{id:'case',status:'PASS'}]);
});
test('HOME4 missing duplicate or forged summary never completes',async()=>{
 for(const edit of [r=>r.pop(),r=>r.push(r[1]),r=>r[1].data.counts.tests=2,r=>r[1].data.counts.cancelled=1,r=>r[1].data.counts.skipped=1,r=>r.unshift(r[0])]){
  const r=events();edit(r);assert.equal((await report(r)).complete,false);
 }
});
test('HOME4 structured FAIL SKIP TODO and nesting cannot become required PASS',async()=>{
 for(const flag of ['FAIL','SKIP','TODO','nested']){
  const r=events();if(flag==='FAIL')r[0].type='test:fail';else if(flag==='nested')r[0].data.nesting=1;else r[0].data[flag.toLowerCase()]=true;
  const out=await report(r);assert(out.complete===false||out.cases[0].status!=='PASS');
  assert.throws(()=>p.structuredCases(out,{cases:['case'],windowsNotRun:[]},'home4-node-v1'));
 }
});
test('HOME4 required names reject missing extra duplicate SKIP and FAIL',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'home4-json-'));try{const file=path.join(dir,'pin.json');fs.writeFileSync(file,'{"verified":true}');const digest=p.hash(fs.readFileSync(file));assert.equal(p.json(file,digest).verified,true);assert.throws(()=>p.json(file,'0'.repeat(64)));fs.writeFileSync(file,'{"verified":false}');assert.throws(()=>p.json(file,digest))}finally{fs.rmSync(dir,{recursive:true})}
 assert.equal(p.exactCases([{id:'x',status:'PASS'},{id:'linux',status:'NOT RUN'}],['x'],['linux']).required,1);
 for(const rows of [[],[{id:'other',status:'PASS'}],[{id:'x',status:'PASS'},{id:'x',status:'PASS'}],[{id:'x',status:'SKIP'}],[{id:'x',status:'FAIL'}]])assert.throws(()=>p.exactCases(rows,['x']));
});
const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zaplikj30-ui/Zamerovac-android',GITHUB_ACTOR:'zaplikj30-ui',GITHUB_TRIGGERING_ACTOR:'zaplikj30-ui',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1',GITHUB_SHA:'c'.repeat(40),HOME4_APPROVED_MAIN_SHA:'c'.repeat(40),GITHUB_RUN_ID:'123'};
test('HOME4 separate source validator event pins require owner main manual attempt one',()=>{
 assert.equal(p.execution(env,{sourceSha:'a'.repeat(40),validatorSha:'b'.repeat(40)}).eventSha,env.GITHUB_SHA);
 for(const [key,value] of Object.entries({GITHUB_ACTOR:'other',GITHUB_TRIGGERING_ACTOR:'other',GITHUB_EVENT_NAME:'push',GITHUB_REF:'refs/pull/1/merge',GITHUB_REPOSITORY:'fork/repo',GITHUB_RUN_ATTEMPT:'2',HOME4_APPROVED_MAIN_SHA:'d'.repeat(40)}))assert.throws(()=>p.execution({...env,[key]:value},{sourceSha:'a'.repeat(40),validatorSha:'b'.repeat(40)}));
});
test('HOME4 I88 does not authorize preview or release',()=>assert.throws(()=>p.previewAllowed(),e=>e.phase==='I88-preview-release-mapping-unapproved'));
test('HOME4 admission normal known cleanup permits continuation and preserves neighbour bytes',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'home4-lease-')),sentinel=path.join(d,'sentinel');fs.writeFileSync(sentinel,Buffer.from([0,255,42]));
 try{for(let i=0;i<2;i++){const lease=reserve(d);fs.writeFileSync(path.join(lease.path,'evidence.json'),'{}',{flag:'wx'});release(lease)}assert.deepEqual(fs.readFileSync(sentinel),Buffer.from([0,255,42]))}finally{fs.rmSync(d,{recursive:true})}
});
test('HOME4 unknown admission blocks every later start without retry or auto reset',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'home4-stop-'));let starts=0;
 try{const lease=reserve(d);for(let i=0;i<2;i++)assert.throws(()=>{reserve(d);starts++});assert.equal(starts,0);assert(fs.existsSync(lease.path))}finally{fs.rmSync(d,{recursive:true})} // Only model-created files, no processes exist.
});
test('HOME4 changed admission identity cannot be released',()=>{
 const d=fs.mkdtempSync(path.join(os.tmpdir(),'home4-change-'));
 try{const lease=reserve(d);assert.throws(()=>checkLease({...lease,ino:lease.ino+1}));assert(fs.existsSync(lease.path))}finally{fs.rmSync(d,{recursive:true})}
});
test('HOME4 platform and unavailable WSL proof block before spawning',async()=>{
 const client=require('../tools/qa-process-client.cjs');
 await assert.rejects(client.ownedWslWorker({profile:{wsl:{}}},{},'unused','a'.repeat(32),'probes'));
});
test('HOME4 four jobs stay inert manual-only offline with immutable source validator pins',()=>{
 const yaml=fs.readFileSync(path.join(__dirname,'../.github/workflows/windows-self-hosted-qa.yml'),'utf8');
 assert.equal((yaml.match(/if: \$\{\{ false &&/g)||[]).length,4);
 assert.equal((yaml.match(/runs-on: \[self-hosted, Windows, X64, zamerovac-qa\]/g)||[]).length,4);
 assert.equal(yaml.split('on:\n')[1].split('\npermissions:')[0].trim(),'workflow_dispatch:');
 for(const text of ['github.triggering_actor','github.run_attempt == 1','persist-credentials: false','HOME4_PROFILE_SHA256: UNVERIFIED','HOME4_APPROVED_MAIN_SHA: \'\''])assert(yaml.includes(text));
 assert(!/\b(curl|setup-java|npm (?:ci|install)|pip install|playwright install|gradlew)\b/.test(yaml));
});
test('HOME4 actual client rejects contradictory PASS and malformed protocol without retry or PID kill',async()=>{
 const cp=require('node:child_process'),{EventEmitter}=require('node:events'),id=require.resolve('../tools/qa-process-client.cjs');
 const original=cp.spawn,d=fs.mkdtempSync(path.join(os.tmpdir(),'home4-client-'));let starts=0,kills=0;
 try{
  for(const [index,change] of [null,{error:'PRIVATE ERROR'},{reason:'crash'},{exitCode:1},{cleanupEvidence:{remainingProcesses:1}},'duplicate','garbage'].entries()){
   const token='a'.repeat(32);
   cp.spawn=()=>{starts++;const child=new EventEmitter();child.stdin=Object.assign(new EventEmitter(),{writable:true,write:()=>true,end:()=>{}});child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.kill=()=>{kills++};
    queueMicrotask(()=>{const r={event:'result',token,platform:process.platform,status:'PASS',reason:'normal',exitCode:0,error:null,diagnostic:null,cleanupVerified:true,cleanupEvidence:{remainingProcesses:0},...(typeof change==='object'&&change?change:{})};let text=JSON.stringify(r)+'\n';if(change==='duplicate')text+=text;if(change==='garbage')text='PRIVATE GARBAGE\n'+text;child.stdout.emit('data',Buffer.from(text));child.emit('close',0,null)});return child};
   delete require.cache[id];const result=await require(id).ownedWorker([process.execPath,'model-only'],d,process.env,path.join(d,String(index)+'.log'),token,1000);
   assert.equal(result.status,change===null?'PASS':'BLOCKED');assert(!JSON.stringify(result).includes('PRIVATE'));assert.equal(starts,index+1);assert.equal(kills,0);
  }
 }finally{cp.spawn=original;delete require.cache[id];fs.rmSync(d,{recursive:true})}
});
