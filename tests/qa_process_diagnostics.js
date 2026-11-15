'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events');
const os=require('node:os'),{spawnSync,execFileSync}=require('node:child_process');
const {copyGate}=require('./helpers/qa-fixture-checkout.cjs');
const client=require('../tools/qa-process-client.cjs');
const secret='PRIVATE ACCOUNT C:\\Users\\PrivateUser\\SecretFolder stderr=123456789';

test('diagnostic whitelist emits only a stage and a genuine typed Win32 code',()=>{
 assert.deepEqual(client.safeDiagnostic({stage:'AssignProcessToJobObject',win32Error:5,message:secret}),{stage:'AssignProcessToJobObject',win32Error:5});
 for(const value of [null,{},secret,{stage:secret,win32Error:5},{stage:'AssignProcessToJobObject',win32Error:secret}]){
  const d=client.safeDiagnostic(value);assert(!JSON.stringify(d).includes('PRIVATE'));
  assert.deepEqual(Object.keys(d),['stage','win32Error']);
 }
 for(const value of [-1,2**32,NaN,Infinity,true,'5'])assert.equal(client.safeDiagnostic({stage:'CreateProcessW',win32Error:value}).win32Error,null);
 assert.equal(client.safeDiagnostic({stage:'worker-image-check',win32Error:122}).win32Error,null,'logical failures must not expose stale GetLastError');
});

async function protocol(message,{code=77,token='a'.repeat(32),noise=false,spawnError=false,ending='\n'}={}){
 const module={exports:{}},child=new EventEmitter();
 child.stdin=Object.assign(new EventEmitter(),{writable:true,write(){},end(){this.writable=false}});
 child.stdout=new EventEmitter();child.stderr=new EventEmitter();
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../tools/qa-process-client.cjs'),'utf8'),{
  module,process,__dirname:path.resolve(__dirname,'../tools'),setInterval,clearInterval,
  require(id){
   if(id==='node:fs')return {writeFileSync(){}};
   if(id==='node:child_process')return {spawn:()=>child};
   if(id==='./qa-process-diagnostic.json')return require('../tools/qa-process-diagnostic.json');
   return require(id);
  },
 });
 const task=module.exports.ownedWorker([process.execPath,'fixed'],__dirname,process.env,'not-written',token);
 if(spawnError)child.emit('error',Error(secret));
 else{
  child.stderr.emit('data',Buffer.from(secret));
  child.stdout.emit('data',noise?Buffer.from(secret):Buffer.from(JSON.stringify({event:'ready',token})+ending+JSON.stringify(message)+ending));
  child.emit('close',code,null);
 }
 return task;
}
test('a failed owner preserves a structured native stage/code without accepting PASS or parsing stderr',async()=>{
 const token='a'.repeat(32),d={stage:'AssignProcessToJobObject',win32Error:5};
 const result=await protocol({event:'result',token,platform:process.platform,status:'BLOCKED',cleanupVerified:false,error:secret,diagnostic:d});
 assert.equal(result.status,'BLOCKED');assert.equal(result.cleanupVerified,false);
 assert.deepEqual(JSON.parse(JSON.stringify(result.diagnostic)),d);
 const windows=await protocol({event:'result',token,platform:process.platform,status:'BLOCKED',cleanupVerified:false,error:secret,diagnostic:d},{ending:'\r\n'});
 assert.deepEqual(JSON.parse(JSON.stringify(windows.diagnostic)),d);
 const positive=await protocol({event:'result',token,platform:process.platform,status:'PASS',reason:'normal',exitCode:0,error:null,cleanupVerified:true,cleanupEvidence:{remainingProcesses:0},diagnostic:null},{code:0,ending:'\r\n'});
 assert.equal(positive.status,'PASS');assert.equal(positive.diagnostic,null);
 assert.equal((await protocol(null,{noise:true})).diagnostic.stage,'owner-protocol');
 assert.equal((await protocol(null,{spawnError:true})).diagnostic.stage,'owner-launch');
 const wrong=await protocol({event:'result',token:'wrong',diagnostic:d,status:'PASS',cleanupVerified:true},{code:0});
 assert.equal(wrong.status,'BLOCKED');assert.equal(wrong.diagnostic.stage,'owner-protocol');
});

test('an otherwise valid owner PASS accepts null or absent diagnostics',async()=>{
 for(const ending of ['\n','\r\n'])for(const diagnostic of [null,undefined]){
  const result=await protocol({event:'result',token:'a'.repeat(32),platform:process.platform,
   status:'PASS',reason:'normal',exitCode:0,error:null,cleanupVerified:true,
   cleanupEvidence:{remainingProcesses:0},diagnostic},{code:0,ending});
  assert.equal(result.status,'PASS');assert.equal(result.diagnostic,null);
 }
});

test('an otherwise valid owner PASS with any non-null diagnostic is BLOCKED',async()=>{
 for(const diagnostic of [{stage:'CreateProcessW',win32Error:5},{},false,0,secret]){
  const result=await protocol({event:'result',token:'a'.repeat(32),platform:process.platform,
   status:'PASS',reason:'normal',exitCode:0,error:null,cleanupVerified:true,
   cleanupEvidence:{remainingProcesses:0},diagnostic},{code:0,ending:'\r\n'});
  assert.equal(result.status,'BLOCKED');
  assert(!JSON.stringify(result.diagnostic).includes('PRIVATE'));
 }
});

test('the whole new launch chain exposes an injected owner failure that the previous public gate hid',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'qa-diagnostic-chain-'));
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 try{
  copyGate(root);
  fs.appendFileSync(path.join(root,'tools/qa_owned_processes.py'),
   "\ndef new_scope():\n raise ScopeError('PRIVATE ACCOUNT PATH',stage='AssignProcessToJobObject',win32_error=5)\n");
  const gatePath=path.join(root,'tools/qa-fixture-gate.cjs');
  const current=fs.readFileSync(gatePath);
  const previous=execFileSync('git',['show','6f98ceffff50d337f7c2999fed0e0878d20a582e:tools/qa-fixture-gate.cjs'],{
   cwd:path.resolve(__dirname,'..'),encoding:'utf8'});
  fs.writeFileSync(gatePath,previous);
  const before=spawnSync(process.execPath,[gatePath],{env,timeout:10000,maxBuffer:65536});
  assert.ifError(before.error);assert.equal(before.status,1);assert.equal(before.stderr.length,0);
  assert(!before.stdout.toString().includes('FIXTURE_DIAGNOSTIC'));
  fs.writeFileSync(gatePath,current);
  const after=spawnSync(process.execPath,[gatePath],{env,timeout:10000,maxBuffer:65536});
  assert.ifError(after.error);assert.equal(after.status,1);assert.equal(after.stderr.length,0);
  const lines=after.stdout.toString().trim().split('\n');
  const diagnostic=lines.find(line=>line.startsWith('FIXTURE_DIAGNOSTIC '));
  assert.deepEqual(JSON.parse(diagnostic.slice('FIXTURE_DIAGNOSTIC '.length)),{stage:'AssignProcessToJobObject',win32Error:5});
  assert(!after.stdout.toString().includes('PRIVATE'));assert(!after.stdout.toString().includes(root));
  assert(!after.stdout.toString().includes('WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP'));
 }finally{fs.rmSync(root,{recursive:true,force:true})}
});
