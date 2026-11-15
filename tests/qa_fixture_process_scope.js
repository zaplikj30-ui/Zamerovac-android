'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const vm=require('node:vm'),{EventEmitter}=require('node:events');
const {ownedWorker}=require('../tools/qa-process-client.cjs');
const {caseNames}=require('../tools/qa-fixture-tap.cjs');
const tapGate=require('../tools/qa-fixture-tap.cjs');
const {copyGate}=require('./helpers/qa-fixture-checkout.cjs');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));

// The OUTER existing supervisor is a test safety net, including for a broken
// implementation under test. Only the gate's INNER cleanup counts as success.
for(const mode of ['normal','fail','timeout','overflow','cancel','parent-eof','cleanup-noop'])
test('real gate owns and cleans detached descendants: '+mode,{skip:process.platform!=='linux'?'Linux process proof; native Windows Job runtime NOT RUN':false},async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-fixture-scope-'));
 const neighbour=spawn(process.execPath,['-e','setTimeout(()=>{},60000)'],{stdio:'ignore'});
 let outcome;
 try{
  const root=path.join(dir,'checkout');fs.mkdirSync(root);copyGate(root);
  if(mode==='cleanup-noop')fs.appendFileSync(path.join(root,'tools/qa_owned_processes.py'),
   '\n_fixture_factory=new_scope\ndef new_scope():\n scope=_fixture_factory()\n scope.cleanup=lambda:True\n return scope\n');
  const work=path.join(dir,'owned');fs.mkdirSync(work);
  const privateTemp=path.join(dir,'temp');fs.mkdirSync(privateTemp);
  const sentinel=path.join(dir,'outside.bin');fs.writeFileSync(sentinel,Buffer.from([0,255,42]));
  const descendants=path.join(work,'descendants.cjs');
  fs.writeFileSync(descendants,`const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const [role,dir]=process.argv.slice(2);process.on('SIGTERM',()=>{});
if(role==='child'){const child=cp.spawn(process.execPath,[__filename,'leaf',dir],{detached:true,stdio:'ignore'});child.unref()}
// Deliberate startup latency proves the timeout fixture cannot assume instant
// child/grandchild readiness. This changes no production timeout or workload.
setTimeout(()=>fs.writeFileSync(path.join(dir,role+'.json'),JSON.stringify({pid:process.pid})),role==='leaf'?${mode==='normal'?3500:mode==='timeout'?1500:0}:0);setInterval(()=>{},1000);`);
  const setup=`const fs=require('node:fs'),cp=require('node:child_process'),path=require('node:path');
const {test}=require('node:test');process.on('SIGTERM',()=>{});
const work=${JSON.stringify(work)};
fs.writeFileSync(path.join(work,'test.json'),JSON.stringify({pid:process.pid,runner:process.ppid,owner:Number(process.env.ZAMEROVAC_SUPERVISOR_PID)}));
fs.writeFileSync(path.join(require('node:os').tmpdir(),'interrupted-fixture.tmp'),'owned synthetic bytes');
`;
  const first=`async()=>{
const child=cp.spawn(process.execPath,[${JSON.stringify(descendants)},'child',work],{detached:true,stdio:'ignore'});child.unref();
const deadline=Date.now()+10000;while(!fs.existsSync(path.join(work,'leaf.json'))){if(Date.now()>deadline)throw Error('tree startup');await new Promise(r=>setTimeout(r,10))}
${mode==='fail'?"throw Error('PRIVATE FAILURE');":''}
${mode==='overflow'?"process.stdout.write('X'.repeat(2*1024*1024));":''}
${['timeout','cancel','parent-eof'].includes(mode)?'await new Promise(()=>{setInterval(()=>{},1000)});':''}
}`;
  fs.writeFileSync(path.join(root,'tests/home_qa_integrity.js'),setup+caseNames.map((name,i)=>
   `test(${JSON.stringify(name)},${i===0?first:'()=>{}'});`).join('\n'));
  const driver=path.join(root,'driver.cjs');
  fs.writeFileSync(driver,`const fs=require('node:fs'),path=require('node:path');
const task=require('./tools/qa-fixture-gate.cjs').main(${mode==='timeout'?5000:15000});
${['cancel','parent-eof'].includes(mode)?`const poll=setInterval(()=>{if(fs.existsSync(${JSON.stringify(path.join(work,'leaf.json'))})){clearInterval(poll);${mode==='cancel'?"process.kill(process.pid,'SIGTERM')":'process.exit(0)'}}},10);`:''}
Promise.resolve(task).then(result=>fs.writeFileSync(${JSON.stringify(path.join(work,'gate-result.json'))},JSON.stringify(result)));`);
  const env={...process.env,TMPDIR:privateTemp};delete env.NODE_TEST_CONTEXT;
  let command=driver;
  if(mode==='parent-eof'){
   command=path.join(root,'eof-witness.cjs');
   fs.writeFileSync(command,`const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const child=cp.spawn(process.execPath,[${JSON.stringify(driver)}],{stdio:['ignore','inherit','inherit']});
child.on('close',()=>{const deadline=Date.now()+10000;const timer=setInterval(()=>{
const dir=${JSON.stringify(work)},t=JSON.parse(fs.readFileSync(path.join(dir,'test.json')));
const ids=['test','child','leaf'].map(n=>JSON.parse(fs.readFileSync(path.join(dir,n+'.json'))).pid).concat(t.runner);
let ownerFinished=!fs.existsSync('/proc/'+t.owner);
try{const stat=fs.readFileSync('/proc/'+t.owner+'/stat','utf8');ownerFinished=stat.slice(stat.lastIndexOf(')')+2).startsWith('Z ')}catch{}
if(ownerFinished&&ids.every(pid=>!fs.existsSync('/proc/'+pid))){clearInterval(timer);fs.writeFileSync(path.join(dir,'eof-proof.json'),JSON.stringify({innerCleanup:true}));}
else if(Date.now()>deadline){clearInterval(timer);process.exitCode=77}
},10)});`);
  }
  outcome=ownedWorker([process.execPath,command],root,env,path.join(dir,'outer.log'),'d'.repeat(32),25000);
  const outer=await outcome;
  const present=['test','child','leaf'].map(role=>fs.existsSync(path.join(work,role+'.json')));
  if(!present.every(Boolean)){
   const gateFile=path.join(work,'gate-result.json');
   const gateResult=fs.existsSync(gateFile)?JSON.parse(fs.readFileSync(gateFile)):null;
   const diagnostics=fs.readFileSync(path.join(dir,'outer.log'),'utf8').split('\n').filter(line=>line.startsWith('FIXTURE_DIAGNOSTIC '));
   assert.fail(JSON.stringify({fixtureReady:present,outerReason:outer.reason,gateResult,diagnostics}));
  }
  const pids=['test','child','leaf'].map(role=>JSON.parse(fs.readFileSync(path.join(work,role+'.json'))));
  const testProcess=pids[0];
  // EOF cleanup is asynchronous after the gate parent is forcibly gone.
  for(let i=0;i<300&&[testProcess.owner,...pids.map(p=>p.pid),testProcess.runner].some(pid=>fs.existsSync('/proc/'+pid));i++)await sleep(10);
  for(const pid of [testProcess.owner,...pids.map(p=>p.pid),testProcess.runner])assert(!fs.existsSync('/proc/'+pid),'owned process/zombie survived: '+pid);
  if(mode!=='parent-eof'){
   const result=JSON.parse(fs.readFileSync(path.join(work,'gate-result.json')));
   assert.equal(result.cleanupVerified,mode!=='cleanup-noop','must be the inner gate proof, not the outer safety net');
   assert.equal(result.temporaryFilesRemoved,true);
   assert.equal(result.passed,mode==='normal');
   assert.equal(result.timedOut,mode==='timeout','overflow/fail must finish through worker failure, not the test timeout');
   assert.equal(outer.reason,mode==='normal'?'normal':'crash','outer timeout cannot count as inner cleanup');
   assert.deepEqual(fs.readdirSync(privateTemp),[]);
  }else{
   assert.equal(outer.reason,'normal','witness must complete before outer cleanup starts');
   assert.equal(JSON.parse(fs.readFileSync(path.join(work,'eof-proof.json'))).innerCleanup,true);
  }
  const output=fs.readFileSync(path.join(dir,'outer.log'),'utf8');
  assert.equal(output.includes('WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP'),mode==='normal');
  assert(!output.includes('PRIVATE'));assert(!output.includes(root));
  assert.equal(neighbour.exitCode,null);assert.deepEqual(fs.readFileSync(sentinel),Buffer.from([0,255,42]));
  if(mode==='overflow')assert.equal(JSON.parse(output.split('\n')[0].slice('FIXTURE_GATE_BLOCKED '.length)).processOk,false);
  console.log(JSON.stringify({mode,innerCleanup:mode==='parent-eof'?'EOF verified':mode==='cleanup-noop'?'BLOCKED after recovery':true,ownedRemaining:0,outsideProcess:'alive',sentinel:'unchanged'}));
 }finally{
  if(outcome)await outcome;
  neighbour.kill();await new Promise(resolve=>neighbour.exitCode!==null?resolve():neighbour.once('close',resolve));
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('supervisor output limit cannot be cancelled and then reported as PASS',async()=>{
 const module={exports:{}},child=new EventEmitter();let cancellations=0;
 child.stdin=Object.assign(new EventEmitter(),{writable:true,write(){},end(){cancellations++;this.writable=false}});
 child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/qa-process-client.cjs'),'utf8'),{
  module,process,__dirname:path.resolve(__dirname,'../tools'),setInterval,clearInterval,
  require(id){if(id==='node:fs')return {writeFileSync(){}};if(id==='node:child_process')return {spawn:()=>child};if(id==='./qa-process-diagnostic.json')return require('../tools/qa-process-diagnostic.json');return require(id)},
 });
 const token='e'.repeat(32),task=module.exports.ownedWorker([process.execPath,'fixed-worker'],__dirname,process.env,'not-written',token);
 child.stdout.emit('data',Buffer.alloc(1024*1024+1,0x58));
 child.stderr.emit('data',Buffer.alloc(1024*1024,0x58));
 child.stdout.emit('data',Buffer.from('\n'+JSON.stringify({event:'result',token,status:'PASS',cleanupVerified:true})+'\n'));
 child.emit('close',0,null);
 const result=await task;
 assert.equal(result.status,'BLOCKED','overflow must not be undone by an otherwise valid final line');
 assert(result.error.length<16448,'stderr storage must remain bounded even for one oversized chunk');
 assert.equal(cancellations,1);
});

async function modeledGate(mode,timeoutMs=120000,diagnostic){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-scope-model-'));
 const processModel=Object.assign(new EventEmitter(),{argv:['node','qa-fixture-gate.cjs'],execPath:process.execPath,
  platform:process.platform,env:process.env,stdout:{write(value){output+=value}}});
 let output='',launches=0,invocation;
 const module={exports:{}};
 const sentinel=path.join(root,'outside.bin');fs.writeFileSync(sentinel,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
 try{
  const fsModel=new Proxy(fs,{get(target,key){
   if(key==='rmSync'&&mode==='remove-error')return ()=>{throw Error('PRIVATE REMOVE PATH')};
   if(key==='rmSync'&&mode==='remove-noop')return ()=>{};
   return target[key];
  }});
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/qa-fixture-gate.cjs'),'utf8'),{
   module,process:processModel,__dirname:path.resolve(__dirname,'../tools'),Buffer,AbortController,
   require(id){
    if(id==='node:fs')return fsModel;
    if(id==='node:os')return {...os,tmpdir:()=>root};
    if(id==='./qa-fixture-tap.cjs')return tapGate;
    if(id==='./qa-process-client.cjs')return {...require('../tools/qa-process-client.cjs'),async ownedWorker(...args){
     launches++;invocation=args;
     const [command,cwd,env,log,token]=args;
     if(mode==='startup-error')throw Error('PRIVATE EXEC PATH');
     let text='WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n';
     if(mode==='bad-report')text='PRIVATE RAW ERROR';
     if(mode==='large-report')text='X'.repeat(20000);
     if(mode==='blocked-report')text='FIXTURE_GATE_BLOCKED '+JSON.stringify({...tapGate.evaluateTap(undefined),status:'PASS',secret:'PRIVATE RAW PATH'});
     if(mode==='hardlink')fs.linkSync(sentinel,log);else fs.writeFileSync(log,text);
     if(mode==='cancel')processModel.emit('SIGTERM');
     const result={event:'result',token,platform:process.platform,status:'PASS',reason:'normal',exitCode:0,error:null,
      supervisorExit:0,signal:null,cleanupVerified:true,cleanupEvidence:{remainingProcesses:0},diagnostic};
     if(mode==='cleanup-false')result.cleanupVerified=false;
     if(mode==='remaining')result.cleanupEvidence.remainingProcesses=1;
     if(mode==='missing-evidence')delete result.cleanupEvidence;
     if(mode==='token')result.token='wrong';
     if(mode==='platform')result.platform='wrong';
     if(mode==='exit')result.exitCode=7;
     if(mode==='supervisor-exit')result.supervisorExit=77;
     if(mode==='signal')result.signal='SIGTERM';
     if(mode==='scope-status')result.status='BLOCKED';
     if(mode==='reason')result.reason='timeout';
     if(mode==='owner-error')result.error='PRIVATE OWNER PATH';
     if(mode==='native-error'){
      result.status='BLOCKED';result.error='PRIVATE OWNER PATH';result.cleanupVerified=false;
      result.diagnostic={stage:'CreateProcessW',win32Error:87,message:'PRIVATE OWNER PATH'};
     }
     return result;
    }};
    return require(id);
   },
  });
  if(mode==='argv')processModel.argv.push('PRIVATE ARG');
  const result=await module.exports.main(timeoutMs);
  if(invocation){
   assert.notEqual(invocation[2],processModel.env);
   const temporary=path.join(path.dirname(invocation[3]),'work');
   for(const key of ['TEMP','TMP','TMPDIR'])assert.equal(invocation[2][key],temporary);
   for(const [key,value] of Object.entries(processModel.env))
    if(!['TEMP','TMP','TMPDIR'].includes(key))assert.equal(invocation[2][key],value);
  }
  assert.equal(fs.readFileSync(sentinel,'utf8'),'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
  assert.equal(processModel.listenerCount('SIGTERM'),0);
  assert(!output.includes(root));assert(!output.includes('PRIVATE'));
  return {result,output,exitCode:processModel.exitCode,launches,invocation};
 }finally{fs.rmSync(root,{recursive:true,force:true})}
}
test('PASS is withheld unless owner, zero descendants and temporary-file cleanup all succeed',async()=>{
 const success=await modeledGate('success');
 assert.equal(success.result.passed,true);assert.equal(success.exitCode,0);
 assert.equal(success.output,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
 assert.equal(success.invocation[0][0],process.execPath);
 assert.equal(success.invocation[0][1],path.resolve(__dirname,'../tools/qa-fixture-worker.cjs'));
 assert.equal(success.invocation[5],120000);
 for(const mode of ['cleanup-false','remaining','missing-evidence','token','platform','exit','supervisor-exit','signal',
  'scope-status','reason','owner-error','startup-error','bad-report','large-report','blocked-report','hardlink','cancel','remove-error','remove-noop','argv']){
  const outcome=await modeledGate(mode);
  assert.equal(outcome.result.passed,false,mode);assert.equal(outcome.exitCode,1,mode);
  assert(!outcome.output.includes('WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP'),mode);
  assert(outcome.output.includes('FIXTURE_SCOPE_BLOCKED '),mode);
  if(mode.startsWith('remove-'))assert.equal(outcome.result.temporaryFilesRemoved,false);
  if(mode==='argv')assert.equal(outcome.launches,0);
 }
 for(const timeout of [249,120001,NaN,'1000'])assert.equal((await modeledGate('success',timeout)).launches,0);
});

test('public diagnostic identifies the early layer and does not overwrite a native failure with verdict-read',async()=>{
 for(const [mode,expected] of [['argv','gate-input'],['startup-error','owner-launch'],
  ['native-error','CreateProcessW'],['remove-noop','temp-cleanup'],['large-report','verdict-read']]){
  const result=await modeledGate(mode);
  assert.equal(result.exitCode,1);
  const line=result.output.split('\n').find(line=>line.startsWith('FIXTURE_DIAGNOSTIC '));
  const diagnostic=JSON.parse(line.slice('FIXTURE_DIAGNOSTIC '.length));
  assert.equal(diagnostic.stage,expected);
  assert.equal(diagnostic.win32Error,mode==='native-error'?87:null);
  assert.deepEqual(Object.keys(diagnostic),['stage','win32Error']);
 }
});

test('public PASS remains unchanged with null or absent owner diagnostics',async()=>{
 for(const diagnostic of [null,undefined]){
  const result=await modeledGate('success',120000,diagnostic);
  assert.equal(result.exitCode,0);assert.equal(result.result.passed,true);
  assert.equal(result.output,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
 }
});

test('public gate blocks an otherwise valid PASS verdict carrying owner error diagnostics',async()=>{
 for(const diagnostic of [{stage:'CreateProcessW',win32Error:5},{},false,0,'PRIVATE DIAGNOSTIC']){
  const result=await modeledGate('success',120000,diagnostic);
  assert.equal(result.exitCode,1);assert.equal(result.result.passed,false);
  assert.equal(result.result.cleanupVerified,true);assert.equal(result.result.temporaryFilesRemoved,true);
  assert(!result.output.includes('WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP'));
  assert(result.output.includes('FIXTURE_SCOPE_BLOCKED '));
  const line=result.output.split('\n').find(line=>line.startsWith('FIXTURE_DIAGNOSTIC '));
  assert.deepEqual(JSON.parse(line.slice('FIXTURE_DIAGNOSTIC '.length)),
   require('../tools/qa-process-client.cjs').safeDiagnostic(diagnostic,'owner-exit'));
 }
});
