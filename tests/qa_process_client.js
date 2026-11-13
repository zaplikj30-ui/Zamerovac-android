'use strict';
// Real production JS->Python supervisor path, fixed disposable Node descendants.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {ownedWorker}=require('../tools/qa-process-client.cjs');
const fixture=`const fs=require('fs'),cp=require('child_process'),p=require('path');
const [role,dir,mode]=process.argv.slice(2);process.on('SIGTERM',()=>{});
if(role!=='leaf'){const child=cp.spawn(process.execPath,[__filename,role==='leader'?'child':'leaf',dir,mode],{detached:process.platform!=='win32',stdio:'ignore'});child.unref()}
fs.writeFileSync(p.join(dir,role+'.tmp'),JSON.stringify({pid:process.pid}));fs.renameSync(p.join(dir,role+'.tmp'),p.join(dir,role+'.json'));
if(role==='leader'&&mode==='normal'){const t=setInterval(()=>{if(fs.existsSync(p.join(dir,'leaf.json'))){clearInterval(t);setTimeout(()=>process.exit(0),120)}},10)}
setTimeout(()=>process.exit(0),6000);`;
for(const mode of ['normal','timeout','cancel'])test('actual runner process client: '+mode,async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-client-'));
 const neighbour=spawn(process.execPath,['-e','setTimeout(()=>{},12000)'],{stdio:'ignore'});
 let poll;
 try{
  const sentinel=path.join(dir,'outside.bin');fs.writeFileSync(sentinel,Buffer.from([0,255,42]));
  const work=path.join(dir,'work');fs.mkdirSync(work);
  const file=path.join(work,'fixture.cjs');fs.writeFileSync(file,fixture);
  const controller=new AbortController();
  const outcome=ownedWorker([process.execPath,file,'leader',work,mode],work,process.env,path.join(work,'node.log'),'b'.repeat(32),1100,controller.signal);
  const pids=await new Promise((resolve,reject)=>{
   const deadline=Date.now()+3000;
   poll=setInterval(()=>{
    if(['leader','child','leaf'].every(r=>fs.existsSync(path.join(work,r+'.json')))){
     clearInterval(poll);resolve(['leader','child','leaf'].map(r=>JSON.parse(fs.readFileSync(path.join(work,r+'.json'))).pid));
    }else if(Date.now()>deadline){clearInterval(poll);reject(Error('fixture failed to form tree'))}
   },10);
  });
  if(mode==='cancel')controller.abort();
  const result=await outcome;
  assert.equal(result.status,mode==='normal'?'PASS':'BLOCKED',JSON.stringify(result));
  assert.equal(result.cleanupVerified,true);
  if(process.platform==='linux')for(const pid of pids)assert(!fs.existsSync('/proc/'+pid),'original descendant/zombie survived: '+pid);
  assert.equal(neighbour.exitCode,null);assert.deepEqual(fs.readFileSync(sentinel),Buffer.from([0,255,42]));
  console.log(JSON.stringify({mode,pids,result,outsideProcess:'alive',sentinel:'unchanged'}));
 }finally{clearInterval(poll);neighbour.kill();await new Promise(resolve=>neighbour.exitCode!==null?resolve():neighbour.once('close',resolve));fs.rmSync(dir,{recursive:true,force:true})}
});
