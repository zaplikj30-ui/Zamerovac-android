'use strict';
// CLOUD-C: one atomic stage-root handoff. No npm, browser or network here.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const cp=require('node:child_process');
const runtime=require('./qa-cloud-runtime.cjs');
const lock=require('./qa-browser/package-lock.json');
const need=x=>{if(!x)throw Error('CLOUD HANDOFF BLOCKED; STOP NO RETRY')};
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
function privateDir(folder){
 need(typeof folder==='string'&&path.isAbsolute(folder)&&
  fs.realpathSync.native(folder)===folder);
 const s=fs.lstatSync(folder);
 need(s.isDirectory()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&
  (s.mode&0o777)===0o700);
 return s;
}
// Never hand a redirected HOME/TMP/npm-cache to Python or browser children.
// Top-level homes are exactly 0700; descendants must be same-UID, non-writable
// by others, regular files (one link) or canonical directories on the same FS.
function privateSubtree(root,name){
 const parent=privateDir(root),folder=path.join(root,name);
 need(['home','tmp','npm-cache'].includes(name)&&path.dirname(folder)===root);
 const top=privateDir(folder);
 need(top.dev===parent.dev);
 let visited=0;
 const walk=base=>{
  for(const entry of fs.readdirSync(base,{withFileTypes:true})){
   need(++visited<=50000);
   const file=path.join(base,entry.name),s=fs.lstatSync(file);
   const relative=path.relative(folder,file);
   need(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&
    !path.isAbsolute(relative)&&s.uid===process.getuid()&&s.dev===parent.dev&&
    (s.mode&0o022)===0&&!s.isSymbolicLink()&&
    fs.realpathSync.native(file)===file);
   if(s.isDirectory()){
    need((s.mode&0o700)===0o700);
    walk(file);
   }else need(s.isFile()&&s.nlink===1);
  }
 };
 walk(folder);
}
function presentNoFollow(file){
 try{fs.lstatSync(file);return true}
 catch(error){if(error?.code==='ENOENT')return false;throw error}
}
function runnerDir(folder){
 need(typeof folder==='string'&&path.isAbsolute(folder)&&
  fs.realpathSync.native(folder)===folder);
 const st=fs.lstatSync(folder);
 need(st.isDirectory()&&!st.isSymbolicLink()&&st.uid===process.getuid()&&
  (st.mode&0o022)===0);
 return st;
}
function checkedHash(file,limit=1024*1024*1024,allowEmpty=false){
 const s=fs.lstatSync(file);
 need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&
  s.size>=(allowEmpty?0:1)&&s.size<=limit&&(s.mode&0o022)===0&&
  fs.realpathSync.native(file)===file);
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=fs.fstatSync(fd),d=crypto.createHash('sha256'),buf=Buffer.alloc(1024*1024);
  let offset=0,n;
  while((n=fs.readSync(fd,buf,0,buf.length,offset))>0){
   offset+=n;d.update(buf.subarray(0,n));
  }
  const after=fs.fstatSync(fd),last=fs.lstatSync(file);
  for(const key of ['dev','ino','size','mtimeMs'])
   need(before[key]===after[key]&&before[key]===last[key]);
  need(offset===before.size);
  return {sha256:d.digest('hex'),size:before.size};
 }finally{fs.closeSync(fd)}
}
function exactlyFiles(root,expected,requiredPrefix){
 const approved=Array.isArray(requiredPrefix)?requiredPrefix:[requiredPrefix];
 need(approved.every(p=>typeof p==='string'&&p.includes('/')));
 need(expected&&typeof expected==='object'&&!Array.isArray(expected));
 const names=Object.keys(expected);
 need(names.length>10&&names.length<=20000);
 const actual=[];
 const walk=base=>{
  for(const entry of fs.readdirSync(base,{withFileTypes:true})){
   const file=path.join(base,entry.name),stat=fs.lstatSync(file);
   need(!entry.isSymbolicLink()&&(stat.mode&0o022)===0);
   if(entry.isDirectory())walk(file);
   else{
    need(entry.isFile()&&stat.nlink===1);
    actual.push(path.relative(root,file).split(path.sep).join('/'));
   }
  }
 };
 walk(root);
 need(JSON.stringify(actual.sort())===JSON.stringify(names.sort()));
 let size=0;
 for(const relative of names){
  need(approved.some(prefix=>relative.startsWith(prefix))&&
   !relative.split('/').includes('..')&&!relative.split('/').includes('.')&&
   !relative.startsWith('/'));
  const spec=expected[relative];
  need(spec&&typeof spec==='object'&&/^[a-f0-9]{64}$/.test(spec.sha256)&&
   Number.isSafeInteger(spec.size)&&spec.size>=0);
  // This is the browser DATA closure, including empty vendor markers. All
  // executable and metadata readers retain their nonempty default contract.
  const found=checkedHash(path.join(root,relative),1024*1024*1024,true);
  need(found.sha256===spec.sha256&&found.size===spec.size);
  size+=found.size;need(size<=2*1024*1024*1024);
 }
}
function verifyFfmpeg(finalRoot,manifest,revision){
 need(/^[0-9]{3,7}$/.test(revision||''));
 // Playwright 1.62.1 registry/index.ts Linux x64/arm64 FFmpeg executable.
 const ffmpegRel='ffmpeg-'+revision+'/ffmpeg-linux';
 const ffmpegEntry=manifest.chromium.files?.[ffmpegRel];
 const ffmpegProfile=manifest.ffmpeg;
 need(ffmpegProfile?.relative==='browsers/'+ffmpegRel&&
  ffmpegProfile.revision===revision&&ffmpegProfile.magic==='7f454c46'&&
  /^[a-f0-9]{64}$/.test(ffmpegProfile.sha256||'')&&
  Number.isSafeInteger(ffmpegProfile.size)&&ffmpegProfile.size>=64&&
  ffmpegEntry?.sha256===ffmpegProfile.sha256&&
  ffmpegEntry?.size===ffmpegProfile.size);
 const ffmpegExe=path.join(finalRoot,'browsers',ffmpegRel);
 const ffmpegStat=fs.lstatSync(ffmpegExe);
 need(ffmpegStat.isFile()&&!ffmpegStat.isSymbolicLink()&&
  ffmpegStat.nlink===1&&ffmpegStat.uid===process.getuid()&&
  (ffmpegStat.mode&0o100)===0o100);
 const ffmpegHash=checkedHash(ffmpegExe);
 need(ffmpegHash.sha256===ffmpegProfile.sha256&&
  ffmpegHash.size===ffmpegProfile.size);
 const ffmpegFd=fs.openSync(ffmpegExe,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const elf=Buffer.alloc(64),machine=process.arch==='x64'?62:process.arch==='arm64'?183:null;
  need(machine!==null&&fs.readSync(ffmpegFd,elf,0,64,0)===64&&
   elf.subarray(0,7).toString('hex')==='7f454c46020101'&&
   [2,3].includes(elf.readUInt16LE(16))&&elf.readUInt16LE(18)===machine);
 }finally{fs.closeSync(ffmpegFd)}
 return {path:ffmpegExe,...ffmpegHash,magic:'7f454c46',revision};
}
function checkPrepared(finalRoot,manifest,env){
 privateDir(finalRoot);
 const top=fs.readdirSync(finalRoot).sort();
 need(JSON.stringify(top)===JSON.stringify([
  'archives','browsers','deps','home','inventory.json','npm-cache',
  'provision.log','tmp'].sort()));
 for(const name of ['home','tmp','npm-cache'])privateSubtree(finalRoot,name);
 const locked=fs.readFileSync(path.join(__dirname,'qa-browser/package-lock.json'));
 const pkg=fs.readFileSync(path.join(__dirname,'qa-browser/package.json'));
 need(sha(locked)===manifest.lockSha256&&sha(pkg)===manifest.packageSha256);
 const pinned=JSON.parse(locked).packages;
 const deps=path.join(finalRoot,'deps');
 need(sha(runtime.checked(path.join(deps,'package-lock.json'),64*1024))===manifest.lockSha256&&
  sha(runtime.checked(path.join(deps,'package.json'),64*1024))===manifest.packageSha256);
 runtime.exactlyTree(deps,manifest.playwright.files);
 for(const name of ['playwright','playwright-core']){
  const archive=manifest.playwright.archives[name];
  need(archive?.rel==='archives/'+name+'.tgz'&&
   archive.integrity===pinned['node_modules/'+name]?.integrity);
  const bytes=runtime.checked(path.join(finalRoot,archive.rel),64*1024*1024);
  need('sha512-'+crypto.createHash('sha512').update(bytes).digest('base64')===archive.integrity);
 }
 const revision=manifest.chromium?.revision;
 const ffmpeg=manifest.chromium?.ffmpegRevision;
 need(/^[0-9]{3,7}$/.test(revision||'')&&/^[0-9]{3,7}$/.test(ffmpeg||''));
 const expectedExe='browsers/chromium-'+revision+'/chrome-linux64/chrome';
 need(manifest.chromium.relative===expectedExe&&
  /^[a-f0-9]{64}$/.test(manifest.chromium.sha256));
 const spec=JSON.parse(runtime.checked(path.join(deps,'node_modules/playwright-core/browsers.json')));
 need(spec.browsers.find(e=>e.name==='chromium')?.revision===revision&&
  spec.browsers.find(e=>e.name==='ffmpeg')?.revision===ffmpeg);
 const roots=fs.readdirSync(path.join(finalRoot,'browsers')).sort();
 need(JSON.stringify(roots)===JSON.stringify(['chromium-'+revision,'ffmpeg-'+ffmpeg].sort()));
 exactlyFiles(path.join(finalRoot,'browsers'),manifest.chromium.files,
  ['chromium-'+revision+'/','ffmpeg-'+ffmpeg+'/']);
 const ffmpegVerified=verifyFfmpeg(finalRoot,manifest,ffmpeg);
 const chromium=path.join(finalRoot,expectedExe);
 need(checkedHash(chromium).sha256===manifest.chromium.sha256);
 const fd=fs.openSync(chromium,'r');try{
  const magic=Buffer.alloc(4);fs.readSync(fd,magic,0,4,0);
  need(magic.toString('hex')==='7f454c46');
 }finally{fs.closeSync(fd)}
 const node=process.execPath,python=env.ZAMEROVAC_PYTHON;
 need(typeof python==='string'&&path.isAbsolute(python));
 const nodeBinary=checkedHash(node),pythonBinary=checkedHash(python);
 const identity=fs.statSync(chromium,{bigint:true}),strings={};
 for(const field of ['dev','ino','size','mtimeNs','mode'])strings[field]=String(identity[field]);
 return {schema:2,runtimeApproved:true,trustModel:'trusted-host/change-detection',
  scratch:finalRoot,productSha:env.ZAMEROVAC_EXPECTED_PRODUCT_SHA,
  validatorSha:env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA,
  eventSha:env.ZAMEROVAC_CLOUD_EVENT_SHA,imageOS:env.ImageOS,
  imageVersion:env.ImageVersion,linuxUid:process.getuid(),
  lockSha256:manifest.lockSha256,
  node:{path:node,...nodeBinary},python:{path:python,...pythonBinary},
  chromium:{path:chromium,...checkedHash(chromium),magic:'7f454c46',
   revision,identity:strings},
  ffmpeg:ffmpegVerified,
  playwright:{root:deps,files:manifest.playwright.files,
   archives:Object.fromEntries(['playwright','playwright-core'].map(n=>[n,{
    path:path.join(finalRoot,'archives',n+'.tgz'),
    integrity:manifest.playwright.archives[n].integrity}]))}};
}
function acceptPrepared(env=process.env){
 need(process.platform==='linux'&&typeof process.getuid==='function'&&process.getuid()>0);
 const temp=env.RUNNER_TEMP,stage=env.ZAMEROVAC_CLOUD_STAGE;
 const finalRoot=env.ZAMEROVAC_CLOUD_SCRATCH;
 need(typeof temp==='string'&&path.isAbsolute(temp)&&
  stage===path.join(temp,'zamerovac-cloud-stage')&&
  finalRoot===path.join(temp,'zamerovac-cloud-final'));
 const runner=runnerDir(temp),src=privateDir(stage);
 need(runner.dev===src.dev&&src.nlink>=2&&!presentNoFollow(finalRoot));
 need(/^[a-f0-9]{64}$/.test(env.ZAMEROVAC_CLOUD_INVENTORY_SHA256||''));
 need(/^[a-f0-9]{40}$/.test(env.ZAMEROVAC_EXPECTED_PRODUCT_SHA||'')&&
  /^[a-f0-9]{40}$/.test(env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA||'')&&
  /^[a-f0-9]{40}$/.test(env.ZAMEROVAC_CLOUD_EVENT_SHA||'')&&
  env.GITHUB_SHA===env.ZAMEROVAC_CLOUD_EVENT_SHA);
 need(/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID||'')&&
  env.GITHUB_RUN_ATTEMPT==='1'&&Number(env.ZAMEROVAC_CLOUD_DEADLINE)-Date.now()>30000);
 const raw=runtime.checked(path.join(stage,'inventory.json'),8*1024*1024);
 need(sha(raw)===env.ZAMEROVAC_CLOUD_INVENTORY_SHA256);
 const manifest=JSON.parse(raw);
 need(manifest.schema===1&&manifest.complete===true&&
  manifest.productSha===env.ZAMEROVAC_EXPECTED_PRODUCT_SHA&&
  manifest.validatorSha===env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA&&
  manifest.eventSha===env.ZAMEROVAC_CLOUD_EVENT_SHA);
 // One rename of the whole prepared root. EXDEV/collision = STOP; no copy.
 const before=fs.lstatSync(stage);
 need(before.dev===runner.dev&&!presentNoFollow(finalRoot));
 fs.renameSync(stage,finalRoot);
 const after=privateDir(finalRoot);
 need(after.dev===before.dev&&after.ino===before.ino&&!presentNoFollow(stage));
 const r=checkPrepared(finalRoot,manifest,env);
 const runtimeFile=path.join(finalRoot,'runtime.json');
 fs.writeFileSync(runtimeFile,JSON.stringify(r),{flag:'wx',mode:0o600});
 const digest=sha(runtime.checked(runtimeFile,4*1024*1024));
 const approved={...env,ZAMEROVAC_QA_MODE:'cloud',
  ZAMEROVAC_CLOUD_TRUST:'trusted-host/change-detection',
  ZAMEROVAC_CLOUD_RUNTIME_FILE:runtimeFile,
  ZAMEROVAC_CLOUD_RUNTIME_SHA256:digest};
 const checked=runtime.approvedRuntime(approved);
 need(checked.chromium.path===r.chromium.path);
 // Python reads the final profile independently, without metadata/OIDC token.
 const pyEnv={PATH:env.PATH||'/usr/bin',ImageOS:env.ImageOS,ImageVersion:env.ImageVersion,
  PYTHONDONTWRITEBYTECODE:'1',PYTHONNOUSERSITE:'1',
  ZAMEROVAC_QA_MODE:'cloud',ZAMEROVAC_CLOUD_TRUST:'trusted-host/change-detection',
  ZAMEROVAC_CLOUD_RUNTIME_FILE:runtimeFile,
  ZAMEROVAC_CLOUD_RUNTIME_SHA256:digest,
  ZAMEROVAC_CLOUD_SCRATCH:finalRoot,
  ZAMEROVAC_CLOUD_REVIEWED_V_SHA:env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA,
  ZAMEROVAC_CLOUD_EVENT_SHA:env.ZAMEROVAC_CLOUD_EVENT_SHA};
 cp.execFileSync(python,[ '-E','-s','-B','-c',
  'import sys;from pathlib import Path;sys.path.insert(0,sys.argv[1]);from qa_cloud_runtime import verified_runtime;from qa_cloud_provision import verify_tarball_contents;r=verified_runtime();verify_tarball_contents(Path(r["scratch"]),r["playwright"]["files"])',
  __dirname],{cwd:__dirname,env:pyEnv,encoding:'utf8',timeout:60000,
  maxBuffer:8192,stdio:['ignore','pipe','pipe']});
 return {scratch:finalRoot,runtimeFile,runtimeSha:digest,
  chromium:r.chromium.path};
}
module.exports={acceptPrepared,checkedHash,exactlyFiles,privateDir,privateSubtree,checkPrepared,verifyFfmpeg};
