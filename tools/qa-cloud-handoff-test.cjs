'use strict';
// Local SOURCE fault injection only: no browser/owner/npm, no GitHub Actions.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const crypto=require('node:crypto');
const modulePath=path.join(__dirname,'qa-cloud-handoff.cjs');
const source=fs.readFileSync(modulePath,'utf8');
const P='3886fcf80213e4693464d3f30104885c1c58f53e',Q='b'.repeat(40),E='c'.repeat(40);
const digest='a'.repeat(64);
const root='/tmp/qa-c-local',stage=root+'/zamerovac-cloud-stage',
 finalRoot=root+'/zamerovac-cloud-final';
function harness(opts={}){
 let rename=0,moved=false,python=0;
 const inv={schema:1,complete:true,productSha:P,validatorSha:Q,eventSha:E};
 const fakeFs={
  realpathSync:Object.assign(x=>x,{native:x=>x}),
  lstatSync(p){
   if(p===root)return {isDirectory:()=>true,isSymbolicLink:()=>false,
    uid:1001,dev:10,ino:11,mode:0o040755,nlink:2};
   if(p===stage&&moved)throw Object.assign(Error('gone'),{code:'ENOENT'});
   if(p===finalRoot&&!moved&&!opts.collision&&!opts.dangling)
    throw Object.assign(Error('absent'),{code:'ENOENT'});
   if(p===stage||p===finalRoot)return {isDirectory:()=>true,
    isSymbolicLink:()=>false,uid:opts.wrongUid?1:1001,dev:10,ino:12,
    mode:opts.badMode?0o040777:0o040700,nlink:2};
   throw Error('unexpected lstat '+p);
  },
  existsSync(p){if(p===finalRoot)return opts.collision===true||moved;
   if(p===stage)return !moved;throw Error('unexpected exists '+p)},
  renameSync(a,b){rename++;assert.equal(a,stage);assert.equal(b,finalRoot);
   if(opts.exdev)throw Object.assign(Error('different filesystem'),{code:'EXDEV'});
   moved=true},
  readdirSync(p){if(p===finalRoot)return [];throw Error('unexpected dir '+p)},
  readFileSync(){throw Error('unexpected read')},
  statSync(){throw Error('unexpected stat')}
 };
 const fakeRuntime={
  checked(){return JSON.stringify(inv)},
  exactlyTree(){throw Error('unexpected module verification')},
  approvedRuntime(){throw Error('unexpected runtime approval')}
 };
 const fakeCrypto={createHash(){return{update(){return this},digest(){return digest}}}};
 const fakeProcess={platform:'linux',getuid:()=>1001,execPath:'/node'};
 const mod={exports:{}};
 vm.runInNewContext(source,{module:mod,__dirname:'/tools',process:fakeProcess,
  Buffer,Date,require(k){
   if(k==='node:fs')return fakeFs;
   if(k==='node:path')return path.posix;
   if(k==='node:crypto')return fakeCrypto;
   if(k==='node:child_process')return{execFileSync(){python++;throw Error('must not run Python')}};
   if(k==='./qa-cloud-runtime.cjs')return fakeRuntime;
   if(k==='./qa-browser/package-lock.json')return{};
   throw Error('unexpected import '+k);
  }});
 const env={RUNNER_TEMP:root,ZAMEROVAC_CLOUD_STAGE:stage,
  ZAMEROVAC_CLOUD_SCRATCH:finalRoot,ZAMEROVAC_CLOUD_INVENTORY_SHA256:digest,
  ZAMEROVAC_EXPECTED_PRODUCT_SHA:P,ZAMEROVAC_CLOUD_REVIEWED_V_SHA:Q,
  ZAMEROVAC_CLOUD_EVENT_SHA:E,GITHUB_SHA:E,GITHUB_RUN_ID:'123',
  GITHUB_RUN_ATTEMPT:'1',ZAMEROVAC_CLOUD_DEADLINE:String(Date.now()+600000)};
 return {accept:mod.exports.acceptPrepared,env,stats:()=>({rename,python,moved})};
}
test('wrong P/Q/E, attempt, expired deadline and unapproved inventory all stop before rename',()=>{
 for(const edit of [
  {ZAMEROVAC_EXPECTED_PRODUCT_SHA:'f'.repeat(40)},
  {ZAMEROVAC_CLOUD_REVIEWED_V_SHA:'z'.repeat(40)},
  {ZAMEROVAC_CLOUD_EVENT_SHA:'d'.repeat(40)},
  {GITHUB_SHA:'d'.repeat(40)},
  {GITHUB_RUN_ATTEMPT:'2'},
  {GITHUB_RUN_ID:'0'},
  {ZAMEROVAC_CLOUD_INVENTORY_SHA256:'0'.repeat(64)},
  {ZAMEROVAC_CLOUD_DEADLINE:'1'}
 ]){
  const h=harness();assert.throws(()=>h.accept({...h.env,...edit}));
  assert.deepEqual(h.stats(),{rename:0,python:0,moved:false});
 }
});
test('foreign owner, unsafe mode and preexisting target collision never overwrite',()=>{
 for(const cfg of [{wrongUid:true},{badMode:true},{collision:true},{dangling:true}]){
  const h=harness(cfg);assert.throws(()=>h.accept(h.env));
  assert.deepEqual(h.stats(),{rename:0,python:0,moved:false});
 }
});
test('EXDEV from the only whole-root rename is STOP with no copy retry',()=>{
 const h=harness({exdev:true});assert.throws(()=>h.accept(h.env));
 assert.deepEqual(h.stats(),{rename:1,python:0,moved:false});
});
test('post-rename missing/extra content cannot be mistaken for PASS',()=>{
 const h=harness();assert.throws(()=>h.accept(h.env));
 assert.deepEqual(h.stats(),{rename:1,python:0,moved:true});
});
test('no second npm or browser CLI exists inside Q orchestrator or handoff',()=>{
 const diag=fs.readFileSync(path.join(__dirname,'qa-cloud-diag.cjs'),'utf8');
 const provision=fs.readFileSync(path.join(__dirname,'qa_cloud_provision.py'),'utf8');
 assert(!diag.includes("run('npm'")&&!diag.includes('spawnSync(exe,args'));
 assert(!source.includes('npm ci')&&!source.includes('playwright/cli.js'));
 assert.equal((provision.match(/provision_step\('NPM_CI', run_group, \[npm, 'ci'/g)||[]).length,1);
 assert.equal((provision.match(/'install', 'chromium', '--no-shell'/g)||[]).length,1);
});
test('token must not cross into Python verifier environment',()=>{
 assert(source.includes("const pyEnv={PATH:"));
 assert(!source.includes('QA_CLOUD_METADATA_TOKEN'));
 assert(!source.includes('ACTIONS_RUNTIME_TOKEN'));
 assert(!source.includes('GITHUB_TOKEN'));
});

// S1/S2: these use the REAL Linux filesystem after rename, unlike the earlier
// six model tests. They never install npm or run Chromium.
function actualVerifier(fsOverride=fs){
 const mod={exports:{}};
 vm.runInNewContext(source,{module:mod,__dirname:'/tools',process,Buffer,Date,
  require(k){if(k==='node:fs')return fsOverride;if(k==='node:path')return path;
   if(k==='node:crypto')return crypto;
   if(k==='node:child_process')return require('node:child_process');
   if(k==='./qa-cloud-runtime.cjs'||k==='./qa-browser/package-lock.json')return{};
   throw Error('Unexpected dependency '+k);
  }});
 return mod.exports;
}
function realFixture(){
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'qa-c-real-'));
 const stage=path.join(temp,'stage'),finalRoot=path.join(temp,'final');
 fs.mkdirSync(stage,{mode:0o700});
 for(const n of ['home','tmp','npm-cache'])fs.mkdirSync(path.join(stage,n),{mode:0o700});
 fs.renameSync(stage,finalRoot); // ACTUAL one-root same-device rename
 return {temp,finalRoot,close(){fs.rmSync(temp,{recursive:true,force:true})}};
}
test('S1 real post-rename HOME/TMP/npm-cache rejects symlink and path escape',()=>{
 const f=realFixture(),v=actualVerifier();
 try{
  for(const n of ['home','tmp','npm-cache'])v.privateSubtree(f.finalRoot,n);
  const outside=path.join(f.temp,'outside');fs.mkdirSync(outside,{mode:0o700});
  for(const n of ['home','tmp','npm-cache']){
   const p=path.join(f.finalRoot,n);fs.rmdirSync(p);fs.symlinkSync(outside,p);
   assert.throws(()=>v.privateSubtree(f.finalRoot,n));fs.unlinkSync(p);fs.mkdirSync(p,{mode:0o700});
  }
  const nested=path.join(f.finalRoot,'home','escape');fs.symlinkSync(outside,nested);
  assert.throws(()=>v.privateSubtree(f.finalRoot,'home'));fs.unlinkSync(nested);
 }finally{f.close()}
});
test('S1 real post-rename rejects wrong mode, hardlink and simulated wrong UID',()=>{
 const f=realFixture(),v=actualVerifier();
 try{
  const h=path.join(f.finalRoot,'home'),t=path.join(f.finalRoot,'tmp');
  fs.chmodSync(h,0o777);assert.throws(()=>v.privateSubtree(f.finalRoot,'home'));fs.chmodSync(h,0o700);
  fs.chmodSync(t,0o755);assert.throws(()=>v.privateSubtree(f.finalRoot,'tmp'));fs.chmodSync(t,0o700);
  const p=path.join(h,'a');fs.writeFileSync(p,'content',{mode:0o600});
  const l=path.join(h,'hardlink');fs.linkSync(p,l);
  assert.throws(()=>v.privateSubtree(f.finalRoot,'home'));fs.unlinkSync(l);
  const fsAlien=Object.create(fs);
  fsAlien.lstatSync=filename=>{const st=fs.lstatSync(filename);
   if(filename===h){const modified=Object.create(st);modified.uid=process.getuid()+1;return modified}
   return st};
  assert.throws(()=>actualVerifier(fsAlien).privateSubtree(f.finalRoot,'home'));
  v.privateSubtree(f.finalRoot,'home');
 }finally{f.close()}
});
function ffFixture(){
 const f=realFixture(),dir=path.join(f.finalRoot,'browsers','ffmpeg-1011');
 fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const binary=path.join(dir,'ffmpeg-linux'),bytes=Buffer.alloc(80);
 bytes.set([127,69,76,70,2,1,1],0);
 bytes.writeUInt16LE(2,16);
 bytes.writeUInt16LE(process.arch==='arm64'?183:62,18);
 fs.writeFileSync(binary,bytes,{mode:0o700});fs.chmodSync(binary,0o700);
 const hash=crypto.createHash('sha256').update(bytes).digest('hex');
 const inventory={chromium:{files:{'ffmpeg-1011/ffmpeg-linux':{sha256:hash,size:bytes.length}}},
   ffmpeg:{relative:'browsers/ffmpeg-1011/ffmpeg-linux',revision:'1011',magic:'7f454c46',sha256:hash,size:bytes.length}};
 return {...f,dir,binary,hash,inventory};
}
test('S2 real FFmpeg executable/ELF/inventory rejects missing, empty, symlink, mode, hash, revision',()=>{
 const f=ffFixture(),v=actualVerifier();
 try{
  assert.equal(v.verifyFfmpeg(f.finalRoot,f.inventory,'1011').sha256,f.hash);
  for(const mut of [m=>m.ffmpeg.sha256='0'.repeat(64),m=>m.ffmpeg.size++,
   m=>m.ffmpeg.relative='browsers/ffmpeg-1011/other',m=>m.ffmpeg.revision='1012',
   m=>m.chromium.files['ffmpeg-1011/ffmpeg-linux'].sha256='0'.repeat(64)]){
   const bad=structuredClone(f.inventory);mut(bad);
   assert.throws(()=>v.verifyFfmpeg(f.finalRoot,bad,'1011'));
  }
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1012'));
  fs.chmodSync(f.binary,0o600);
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1011'));fs.chmodSync(f.binary,0o700);
  const link=path.join(f.dir,'hard');fs.linkSync(f.binary,link);
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1011'));fs.unlinkSync(link);
  fs.writeFileSync(f.binary,'not an ELF');
  // Even a self-consistent hash/size inventory must not authorize non-ELF bytes.
  const invalid=structuredClone(f.inventory),bad=fs.readFileSync(f.binary);
  const badHash=crypto.createHash('sha256').update(bad).digest('hex');
  invalid.ffmpeg.sha256=badHash;invalid.ffmpeg.size=bad.length;
  invalid.chromium.files['ffmpeg-1011/ffmpeg-linux']={sha256:badHash,size:bad.length};
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,invalid,'1011'));
  fs.unlinkSync(f.binary); // empty FFmpeg folder
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1011'));
  const other=path.join(f.temp,'outside');fs.writeFileSync(other,'fake');fs.symlinkSync(other,f.binary);
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1011'));
 }finally{f.close()}
});
test('S1/S2 positive REAL Node rename -> Python subprocess validates bytes/paths -> Node rechecks',()=>{
 const f=ffFixture(),v=actualVerifier(),cp=require('node:child_process');
 const python=`import os,sys,hashlib,stat,json
root,expected=sys.argv[1:]
for name in ('home','tmp','npm-cache'):
 p=os.path.join(root,name); s=os.lstat(p)
 assert stat.S_ISDIR(s.st_mode) and stat.S_IMODE(s.st_mode)==0o700
 assert os.path.realpath(p)==p and s.st_uid==os.getuid()
p=os.path.join(root,'browsers','ffmpeg-1011','ffmpeg-linux')
s=os.lstat(p); b=open(p,'rb').read()
assert stat.S_ISREG(s.st_mode) and s.st_nlink==1 and s.st_mode&0o100
assert b[:4]==b'\\x7fELF' and hashlib.sha256(b).hexdigest()==expected
print(json.dumps({'pythonVerified':True,'size':len(b)}))`;
 try{
  for(const name of ['home','tmp','npm-cache'])v.privateSubtree(f.finalRoot,name);
  assert.equal(v.verifyFfmpeg(f.finalRoot,f.inventory,'1011').sha256,f.hash);
  const output=JSON.parse(cp.execFileSync('python3',['-c',python,f.finalRoot,f.hash],
   {encoding:'utf8',timeout:12000,env:{PATH:process.env.PATH}}));
  assert.deepEqual(output,{pythonVerified:true,size:80});
  assert.equal(v.verifyFfmpeg(f.finalRoot,f.inventory,'1011').sha256,f.hash);
 }finally{f.close()}
});

function dataFixture(){
 const temp=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'qa-c-data-'));
 const stage=path.join(temp,'stage'),finalRoot=path.join(temp,'final');
 const browser=path.join(stage,'chromium-1234');
 fs.mkdirSync(browser,{recursive:true,mode:0o700});
 for(let i=0;i<11;i++)fs.writeFileSync(path.join(browser,'data-'+i),'data',{mode:0o600});
 for(const name of ['INSTALLATION_COMPLETE','DEPENDENCIES_VALIDATED','empty-data'])
  fs.writeFileSync(path.join(browser,name),'',{mode:0o600});
 // Execute the actual producer, without npm, Playwright, browser or network.
 const script=`import sys,json
sys.path.insert(0,sys.argv[1])
import qa_cloud_provision as q
print(json.dumps(q.browser_data_tree(sys.argv[2],('chromium-1234',))))`;
 try{
  const records=JSON.parse(require('node:child_process').execFileSync('python3',
   ['-I','-S','-B','-c',script,__dirname,stage],
   {encoding:'utf8',timeout:12000,env:{PATH:process.env.PATH}}));
  fs.renameSync(stage,finalRoot);
  return {temp,finalRoot,records,marker:path.join(finalRoot,'chromium-1234/INSTALLATION_COMPLETE'),
   close(){fs.rmSync(temp,{recursive:true,force:true})}};
 }catch(error){fs.rmSync(temp,{recursive:true,force:true});throw error}
}
test('D actual Python DATA inventory -> atomic rename -> Node exact closure accepts empty vendor markers',()=>{
 const f=dataFixture(),v=actualVerifier();
 try{
  v.exactlyFiles(f.finalRoot,f.records,'chromium-1234/');
  const spec=f.records['chromium-1234/INSTALLATION_COMPLETE'];
  assert.deepEqual(spec,{size:0,sha256:crypto.createHash('sha256').update('').digest('hex')});
  // All executable/metadata APIs retain nonempty defaults.
  assert.throws(()=>v.checkedHash(f.marker));
  assert.throws(()=>require('./qa-cloud-runtime.cjs').checked(f.marker));
  assert.equal(v.checkedHash(f.marker,1024,true).size,0);
 }finally{f.close()}
});
test('D empty DATA rejects forged hash/size, tamper, missing/extra, link escape, unsafe mode and limits',()=>{
 const f=dataFixture(),v=actualVerifier(),key='chromium-1234/INSTALLATION_COMPLETE';
 const check=records=>v.exactlyFiles(f.finalRoot,records||f.records,'chromium-1234/');
 try{
  for(const change of [x=>x[key].sha256='0'.repeat(64),x=>x[key].size=1,
   x=>x[key].size=-1,x=>x[key].size=0.5,x=>x[key].size=Number.MAX_SAFE_INTEGER+1,
   x=>delete x[key],x=>x['chromium-1234/../escape']=x[key]]){
   const bad=structuredClone(f.records);change(bad);assert.throws(()=>check(bad));
  }
  fs.writeFileSync(f.marker,'changed');assert.throws(()=>check());
  assert.throws(()=>v.checkedHash(f.marker,1,true));fs.writeFileSync(f.marker,'');
  fs.chmodSync(f.marker,0o666);assert.throws(()=>check());fs.chmodSync(f.marker,0o600);
  const other=path.join(f.temp,'other');fs.linkSync(f.marker,other);
  assert.throws(()=>check());fs.unlinkSync(other);
  fs.unlinkSync(f.marker);assert.throws(()=>check());
  fs.writeFileSync(other,'',{mode:0o600});fs.symlinkSync(other,f.marker);
  assert.throws(()=>check());fs.unlinkSync(f.marker);
  fs.writeFileSync(f.marker,'',{mode:0o600});
  const extra=path.join(f.finalRoot,'chromium-1234/extra');fs.writeFileSync(extra,'');
  assert.throws(()=>check());fs.unlinkSync(extra);
  check();
 }finally{f.close()}
});
test('D empty FFmpeg with self-consistent DATA inventory remains blocked as executable',()=>{
 const f=ffFixture(),v=actualVerifier();
 try{
  fs.writeFileSync(f.binary,'');
  const empty={size:0,sha256:crypto.createHash('sha256').update('').digest('hex')};
  f.inventory.chromium.files['ffmpeg-1011/ffmpeg-linux']=empty;
  Object.assign(f.inventory.ffmpeg,empty);
  assert.throws(()=>v.verifyFfmpeg(f.finalRoot,f.inventory,'1011'));
  assert.throws(()=>v.checkedHash(f.binary));
 }finally{f.close()}
});
test('D empty DATA hash detects mutation after descriptor admission',()=>{
 const f=dataFixture(),changedFs=Object.create(fs);
 let changed=false;
 changedFs.readSync=(fd,...args)=>{
  if(!changed){changed=true;fs.writeFileSync(f.marker,'tampered')}
  return fs.readSync(fd,...args);
 };
 try{assert.throws(()=>actualVerifier(changedFs).checkedHash(f.marker,1024,true))}
 finally{f.close()}
});
