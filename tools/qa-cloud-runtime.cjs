'use strict';
// Cloud-only reviewed R and D; HOME keeps its historical profiles and admission.
// All paths/bytes must be pre-existing, independently reviewed; no provisioning.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const Module=require('node:module');
const file=path.join(__dirname,'qa-cloud-runtime.json');
const lock=require('./qa-browser/package-lock.json');
const sha=(b,algorithm='sha256')=>crypto.createHash(algorithm).update(b).digest(algorithm==='sha512'?'base64':'hex');
function stop(){throw Error('QA CLOUD BLOCKED: pre-exec runtime/provenance unavailable')}
function need(value){if(!value)stop()}
function checked(filePath,max=128*1024*1024){
  need(typeof filePath==='string'&&path.isAbsolute(filePath));
  const absolute=path.resolve(filePath),stat=fs.lstatSync(absolute);
  need(filePath===absolute);
  need(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=max);
  need(fs.realpathSync.native(absolute)===absolute);
  const before=fs.statSync(absolute),bytes=fs.readFileSync(absolute),after=fs.statSync(absolute);
  need(before.dev===after.dev&&before.ino===after.ino&&before.size===after.size&&before.mtimeMs===after.mtimeMs);
  return bytes;
}
function exactlyTree(root,files){
  need(typeof root==='string'&&path.isAbsolute(root)&&
    fs.realpathSync.native(root)===path.resolve(root));
  need(files&&typeof files==='object'&&!Array.isArray(files)&&Object.keys(files).length>10);
  const actual=[];
  function walk(base){
    for(const dirent of fs.readdirSync(base,{withFileTypes:true})){
      need(!dirent.isSymbolicLink());
      const filename=path.join(base,dirent.name);
      if(dirent.isDirectory())walk(filename);
      else {need(dirent.isFile());actual.push(path.relative(root,filename).split(path.sep).join('/'))}
    }
  }
  const modules=path.join(root,'node_modules');
  need(fs.realpathSync.native(modules)===modules);
  walk(modules);
  const expected=Object.keys(files).sort();
  need(actual.sort().join('\n')===expected.join('\n'));
  need(expected.some(x=>x.startsWith('node_modules/playwright/'))&&
    expected.some(x=>x.startsWith('node_modules/playwright-core/')));
  for(const relative of expected){
    need(relative.startsWith('node_modules/playwright/')||
      relative.startsWith('node_modules/playwright-core/'));
    need(/^[a-f0-9]{64}$/.test(files[relative]));
    need(sha(checked(path.join(root,relative)))===files[relative]);
  }
}
function approvedRuntime(env=process.env){
  need(env.ZAMEROVAC_QA_MODE==='cloud'&&env.ZAMEROVAC_CLOUD_TRUST==='trusted-host/change-detection');
  need(!env.ZAMEROVAC_CLOUD_IMMUTABLE_CLAIM&&!env.NODE_OPTIONS&&!env.NODE_PATH);
  const ephemeral=env.ZAMEROVAC_CLOUD_RUNTIME_FILE;
  if(ephemeral){need(ephemeral===path.join(env.ZAMEROVAC_CLOUD_SCRATCH||'', 'runtime.json'));const st=fs.statSync(env.ZAMEROVAC_CLOUD_SCRATCH);need(st.uid===process.getuid()&&(st.mode&511)===448&&fs.realpathSync.native(env.ZAMEROVAC_CLOUD_SCRATCH)===env.ZAMEROVAC_CLOUD_SCRATCH)}
  const bytes=checked(ephemeral||file,4*1024*1024);
  need(/^[a-f0-9]{64}$/.test(env.ZAMEROVAC_CLOUD_RUNTIME_SHA256||'')&&
    sha(bytes)===env.ZAMEROVAC_CLOUD_RUNTIME_SHA256);
  const r=JSON.parse(bytes.toString('utf8'));
  need(r.schema===(ephemeral?2:1)&&r.runtimeApproved===true&&r.trustModel==='trusted-host/change-detection');
  need(r.productSha==='3886fcf80213e4693464d3f30104885c1c58f53e'&&
    r.validatorSha===env.ZAMEROVAC_CLOUD_REVIEWED_V_SHA&&
    r.eventSha===env.ZAMEROVAC_CLOUD_EVENT_SHA);
  need(process.platform==='linux'&&typeof process.getuid==='function'&&process.getuid()>0&&
    process.getuid()===r.linuxUid);
  need(r.imageOS===env.ImageOS&&r.imageVersion===env.ImageVersion);
  for(const [key,exe] of Object.entries({node:r.node,python:r.python})){
    need(exe&&typeof exe.path==='string'&&/^[a-f0-9]{64}$/.test(exe.sha256));
    if(key==='node')need(path.resolve(exe.path)===path.resolve(process.execPath));
    need(sha(checked(exe.path))===exe.sha256);
  }
  const browser=r.chromium;
  need(browser&&typeof browser.path==='string'&&
    /^[a-f0-9]{64}$/.test(browser.sha256)&&browser.magic==='7f454c46');
  // Chromium ELF file and every parent are additionally checked by BrowserLock.
  const pw=r.playwright;
  need(pw&&typeof pw.root==='string'&&pw.files&&pw.archives);
  exactlyTree(pw.root,pw.files);
  for(const packageName of ['playwright','playwright-core']){
    const archive=pw.archives[packageName],locked=lock.packages['node_modules/'+packageName];
    need(archive&&locked?.version==='1.62.1'&&archive.integrity===locked.integrity&&
      /^sha512-[A-Za-z0-9+/]+={0,2}$/.test(archive.integrity));
    need('sha512-'+sha(checked(archive.path,64*1024*1024),'sha512')===archive.integrity);
    const packageFile=path.join(pw.root,'node_modules',packageName,'package.json');
    need(JSON.parse(checked(packageFile).toString('utf8')).version==='1.62.1');
  }
  if(ephemeral){
    need(r.scratch===env.ZAMEROVAC_CLOUD_SCRATCH&&r.playwright.root===path.join(r.scratch,'deps'));
    need(r.lockSha256===sha(fs.readFileSync(path.join(__dirname,'qa-browser/package-lock.json'))));
    const spec=JSON.parse(checked(path.join(pw.root,'node_modules/playwright-core/browsers.json'))).browsers.find(x=>x.name==='chromium');
    need(spec?.revision===browser.revision&&browser.path.startsWith(path.join(r.scratch,'browsers')+path.sep)&&browser.path.includes('chromium-'+browser.revision+path.sep));
    const st=fs.statSync(browser.path,{bigint:true});need(Object.entries(browser.identity||{}).length===5&&Object.entries(browser.identity).every(([k,v])=>String(st[k==='mtimeNs'?'mtimeNs':k])===v));
    need(checked(browser.path,1024*1024*1024).subarray(0,4).toString('hex')===browser.magic&&sha(checked(browser.path,1024*1024*1024))===browser.sha256);
  }
  return r;
}
function loadPlaywright(){
  const r=approvedRuntime();
  const loader=Module.createRequire(path.join(r.playwright.root,'qa-reviewed-entry.cjs'));
  const pwMain=loader.resolve('playwright'),coreMain=loader.resolve('playwright-core');
  // The Playwright package itself must resolve exactly that same reviewed core.
  // A nested shadow playwright/node_modules/playwright-core may be hash-listed
  // in a broad tree yet would violate this single-runtime closure contract.
  need(Module.createRequire(pwMain).resolve('playwright-core')===coreMain);
  for(const [name,filename] of [['playwright',pwMain],['playwright-core',coreMain]]){
    const relative=path.relative(r.playwright.root,filename).split(path.sep).join('/');
    need(relative.startsWith('node_modules/'+name+'/')&&
      Object.hasOwn(r.playwright.files,relative));
  }
  return loader('playwright');
}
function cloudBrowserIdentity(filename){
  const r=approvedRuntime();
  const {verifyFile}=require('./qa-browser-identity.cjs');
  return verifyFile(filename,r.chromium,'linux');
}
module.exports={approvedRuntime,loadPlaywright,cloudBrowserIdentity,checked,exactlyTree};
