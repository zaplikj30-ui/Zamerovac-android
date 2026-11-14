'use strict';
// QA36: real production client with ONLY spawn mocked. No Windows worker.
const {test}=require('node:test');
const assert=require('node:assert/strict');
const cp=require('node:child_process');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const clientId=require.resolve('../tools/qa-process-client.cjs');

test('soft timeout requests cooperative cancellation, never kills owner in CreateProcessW',async()=>{
 const originalSpawn=cp.spawn;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa36-soft-timeout-'));
 const log=path.join(dir,'verdict.log'),token='a'.repeat(32),requests=[];
 let killed=0,settled=false,child;
 cp.spawn=()=>{
  child=new EventEmitter();
  child.stdin=Object.assign(new EventEmitter(),{
   writable:true,write:()=>true,
   end:(line)=>{requests.push(line);child.stdin.writable=false;}
  });
  child.stdout=new EventEmitter();
  child.stderr=new EventEmitter();
  child.kill=()=>{killed++;return true;};
  return child;
 };
 try{
  delete require.cache[clientId];
  const {ownedWorker}=require(clientId);
  const promise=ownedWorker([process.execPath,path.join(__dirname,'../tools/qa35-noop-worker.cjs')],
    dir,{...process.env},log,token,7000,undefined,1000).then(value=>{settled=true;return value;});
  await new Promise(resolve=>setTimeout(resolve,1150));
  assert.deepEqual(requests,['CANCEL '+token+'\n']);
  assert.equal(killed,0,'no unverified force-kill of native owner');
  assert.equal(settled,false,'missing close must not forge verified cleanup');
  // A later real owner close cannot turn an expired attempt into PASS.
  const forged={event:'result',token,platform:process.platform,status:'PASS',
   reason:'normal',exitCode:0,error:null,diagnostic:null,
   cleanupVerified:true,cleanupEvidence:{remainingProcesses:0}};
  child.stdout.emit('data',Buffer.from(JSON.stringify(forged)+'\n'));
  child.emit('close',0,null);
  const result=await promise;
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.cleanupVerified,false);
  assert.equal(result.diagnostic.stage,'owner-hard-timeout');
  assert.equal(killed,0);
 }finally{
  cp.spawn=originalSpawn;
  delete require.cache[clientId];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});

test('heartbeat IPC write exception cannot crash the gate or become PASS',async()=>{
 const originalSpawn=cp.spawn;
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa36-heartbeat-'));
 const log=path.join(dir,'verdict.log'),token='b'.repeat(32);
 let child,kills=0,writes=0;
 cp.spawn=()=>{
  child=new EventEmitter();
  child.stdin=Object.assign(new EventEmitter(),{
   writable:true,
   write:()=>{writes++;throw Error('PRIVATE CHANNEL ERROR');},
   end:()=>{child.stdin.writable=false;}
  });
  child.stdout=new EventEmitter();
  child.stderr=new EventEmitter();
  child.kill=()=>{kills++;return true;};
  return child;
 };
 try{
  delete require.cache[clientId];
  const {ownedWorker}=require(clientId);
  const promise=ownedWorker([process.execPath,path.join(__dirname,'../tools/qa35-noop-worker.cjs')],
    dir,{...process.env},log,token,7000,undefined,0);
  await new Promise(resolve=>setTimeout(resolve,1120));
  assert(writes>=1,'heartbeat must exercise the failed IPC write');
  const forged={event:'result',token,platform:process.platform,status:'PASS',
    reason:'normal',exitCode:0,error:null,diagnostic:null,firstFailure:null,
    cleanupErrorType:null,cleanupVerified:true,cleanupEvidence:{remainingProcesses:0}};
  child.stdout.emit('data',Buffer.from(JSON.stringify(forged)+'\n'));
  child.emit('close',0,null);
  const result=await promise;
  assert.equal(kills,0,'must not force-kill owner');
  assert.equal(result.status,'BLOCKED');
  assert.equal(result.cleanupVerified,false);
  assert.equal(result.diagnostic.stage,'owner-channel');
  assert(!JSON.stringify(result).includes('PRIVATE CHANNEL ERROR'));
 }finally{
  cp.spawn=originalSpawn;delete require.cache[clientId];
  fs.rmSync(dir,{recursive:true,force:true});
 }
});
