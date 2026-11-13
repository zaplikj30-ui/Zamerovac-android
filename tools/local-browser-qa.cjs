'use strict';
// Run existing Chromium pixel/UI suites on Windows without consuming Actions minutes.
// This process does not build, install or alter an Android APK.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const {spawn} = require('node:child_process');
const {launchSandboxed,launchOptions,checkEvidence,blocked}=require('./e2e/sandbox.cjs');
const root = path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'app', 'src', 'main', 'assets');
const modes = Object.freeze({
 '--smoke': ['drawing', 'quality-regressions', 'gallery-readability'],
 '--all': ['drawing','gallery-visual','workflows','interactions','zoom-grid',
  'update39','gallery-state','peer-sync','drive-accounts','sync-cadence',
  'backup-history','read-only-sync','sync-edit-guard','note-sync',
  'web-content-policy','media-import','help','release-history',
  'latency','quality-regressions','gallery-readability']
});
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8',
 '.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8',
 '.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg',
 '.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif',
 '.woff2':'font/woff2','.ttf':'font/ttf','.mp3':'audio/mpeg',
 '.mp4':'video/mp4','.wav':'audio/wav','.pdf':'application/pdf'};
function createStaticServer(assets){
 const base=fs.realpathSync(path.resolve(assets));
 return http.createServer((req,res)=>{
  function done(code,message){res.writeHead(code,{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(message)}
  if(req.method!=='GET'&&req.method!=='HEAD')return done(405,'Method not allowed');
  let target;
  try{
   const raw=new URL(req.url,'http://127.0.0.1').pathname;
   const decoded=decodeURIComponent(raw);
   if(decoded.includes('\\')||decoded.includes('\0'))return done(403,'Forbidden path');
   target=path.resolve(base,'.'+decoded);
   if(target!==base&&!target.startsWith(base+path.sep))return done(403,'Forbidden path');
   if(target===base)target=path.join(base,'index.html');
  }catch(error){return done(400,'Invalid path')}
  fs.realpath(target,(realError,real)=>{
   if(realError)return done(404,'Not found');
   if(real!==base&&!real.startsWith(base+path.sep))return done(403,'Forbidden path');
   fs.stat(real,(error,stat)=>{
   if(error||!stat.isFile())return done(404,'Not found');
   res.writeHead(200,{'Content-Type':types[path.extname(target).toLowerCase()]||'application/octet-stream',
    'Content-Length':stat.size,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});
   if(req.method==='HEAD')return res.end();
   const input=fs.createReadStream(real);
   input.on('error',()=>res.destroy());input.pipe(res);
   });
  });
 });
}
function statusReport(mode,records,dir){
 const counts={PASS:0,FAIL:0,SKIP:0,'NOT RUN':0};
 for(const record of records){
  if(record.status==='BLOCKED'&&!Object.hasOwn(counts,'BLOCKED'))counts.BLOCKED=0;
  if(!Object.hasOwn(counts,record.status))throw Error('Unknown QA status '+record.status);
  counts[record.status]++;
 }
 const status=counts.BLOCKED?'BLOCKED':counts.FAIL?'FAIL':
  counts.SKIP||counts['NOT RUN']||!records.length?'NOT RUN':'PASS';
 const report={schema:2,status,mode,createdAt:new Date().toISOString(),counts,records,
  evidencePath:dir,scope:'Local Chromium synthetic-data tests, not Android/WebView/device acceptance'};
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port)})})}
function close(server){return new Promise(resolve=>server.close(resolve))}
function verifyBrowser(){
 let p;try{p=require.resolve('playwright',{paths:[root]})}
 catch(error){throw Error('Playwright 1.62.1 unavailable; HOME BLOCKED, no runtime install')}
 if(require(path.join(path.dirname(p),'package.json')).version!=='1.62.1')
  throw Error('Playwright version mismatch; HOME BLOCKED');
 const chromium=require(p).chromium;
 const executable=process.env.CHROMIUM_PATH;
 if(typeof executable!=='string'||!path.isAbsolute(executable))
  throw blocked('Explicit absolute CHROMIUM_PATH required; no automatic browser selection');
 if(!fs.existsSync(executable))throw Error('Verified Chromium unavailable: '+executable+'; HOME BLOCKED, no runtime install');
 return {chromium,executable};
}
async function execute(script,env,logFile){
 return new Promise(resolve=>{
  const started=Date.now(),out=fs.createWriteStream(logFile,{flags:'w'});
  const child=spawn(process.execPath,[path.join(root,'tools/e2e',script+'.cjs')],{cwd:root,env,windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error=null,timedOut=false;
  const timer=setTimeout(()=>{timedOut=true;child.kill()},8*60*1000);
  child.on('error',e=>{error=e;out.write(String(e)+'\n')});
  child.stdout?.on('data',data=>out.write(data));child.stderr?.on('data',data=>out.write(data));
  child.on('close',(exitCode,signal)=>{clearTimeout(timer);out.end(()=>{
   let sandbox=null,sandboxError=null;
   try{
    const report=JSON.parse(fs.readFileSync(path.join(env.ZAMEROVAC_E2E_DIR,script,'report.json'),'utf8'));
    if(report.status==='BLOCKED')throw Error(report.error);
    sandbox=checkEvidence(report.sandbox,process.platform);
   }catch(e){sandboxError=e.message}
   resolve({status:sandboxError?'BLOCKED':!timedOut&&!error&&exitCode===0?'PASS':'FAIL',sandbox,
    exitCode,signal,elapsedMs:Date.now()-started,error:sandboxError||error?.message||null,timedOut});
  })});
 });
}
async function run(mode){
 if(!fs.existsSync(path.join(assetRoot,'index.html')))throw Error('Chybí pracovní kopie aplikace: '+assetRoot);
 const date=new Date().toISOString().replace(/[:.]/g,'-');
 const dir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),
  'Zamerovac-QA','browser','run-'+date+'-'+process.pid);
 fs.mkdirSync(dir,{recursive:true});
 let browser;
 try{
  const verified=verifyBrowser();browser=verified.executable;
  const check=await launchSandboxed(verified.chromium,launchOptions(browser));
  await check.browser.close();
 }catch(error){
  statusReport(mode,modes[mode].map(suite=>({suite,status:'BLOCKED',error:error.message})),dir);
  console.error('HOME BLOCKED: Chromium sandbox preflight: '+error.message);
  console.log('Výsledky Chromium: '+path.join(dir,'results.json'));
  process.exitCode=1;return;
 }
 const server=createStaticServer(assetRoot);
 const records=[];
 let port;
 try{
  port=await listen(server);
  const env={...process.env,CI:'1',CHROMIUM_PATH:browser,
   ZAMEROVAC_BASE_URL:'http://127.0.0.1:'+port,
   ZAMEROVAC_E2E_DIR:path.join(dir,'evidence')};
  for(const name of modes[mode]){
   const file=path.join(dir,name+'.log');
   const outcome=await execute(name,env,file);
   records.push({suite:name,...outcome,log:file});
   console.log(outcome.status+' '+name+' ('+Math.round(outcome.elapsedMs/1000)+' s)');
   if(outcome.status==='FAIL'||outcome.status==='BLOCKED'){
    const log=fs.readFileSync(file,'utf8');console.error(log.slice(-1500));
   }
  }
 }finally{await close(server)}
 const report=statusReport(mode,records,dir);
 console.log('Výsledky Chromium: '+path.join(dir,'results.json'));
 console.log('PASS '+report.counts.PASS+' / FAIL '+report.counts.FAIL);
 if(report.status!=='PASS')process.exitCode=1;
}
async function main(){
 const mode=process.argv[2]||'--smoke';
 if(mode==='--help'){
  console.log('node tools/local-browser-qa.cjs --smoke | --all | --self-test');
  console.log('Vyžaduje instalovaný Playwright 1.62.1 a Chromium, nevydává APK ani nespouští Actions.');
  return;
 }
 if(mode==='--self-test'){
  const server=createStaticServer(assetRoot);const port=await listen(server);
  try{
   async function request(url,method='GET'){
    return new Promise((resolve,reject)=>{
     const req=http.request({hostname:'127.0.0.1',port,path:url,method},res=>{
      const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks).toString('utf8'),headers:res.headers}));
     });req.on('error',reject);req.end();
    });
   }
   const home=await request('/'),css=await request('/does-not-exist.test');
   const secret=await request('/..%5CAGENTS.md'),post=await request('/','POST');
   if(home.status!==200||!home.headers['content-type'].includes('text/html')||
      css.status!==404||secret.status!==403||post.status!==405)
    throw Error('Local static server security/self-test failed: '+JSON.stringify([home.status,css.status,secret.status,post.status]));
   console.log('PASS local Chromium server (HTTP 200/404/403/405), no browser or APK');
  }finally{await close(server)}
  return;
 }
 if(!modes[mode])throw blocked('Neplatný režim; použij --smoke, --all, --self-test nebo --help');
 await run(mode);
}
if(require.main===module)main().catch(error=>{console.error('FAIL local browser QA: '+String(error.stack||error));process.exitCode=1});
module.exports={createStaticServer,statusReport,modes,execute};
