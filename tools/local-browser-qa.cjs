'use strict';
// Run existing Chromium pixel/UI suites on Windows without consuming Actions minutes.
// This process does not build, install or alter an Android APK.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const os = require('node:os');
const {spawn, spawnSync} = require('node:child_process');
// Pinned QA runner lives in the gate checkout; the product under test is separate.
const root = process.env.ZAMEROVAC_SOURCE_ROOT ?
 path.resolve(process.env.ZAMEROVAC_SOURCE_ROOT) : path.resolve(__dirname, '..');
const assetRoot = path.join(root, 'app', 'src', 'main', 'assets');
const modes = Object.freeze({
 '--smoke': ['drawing', 'quality-regressions', 'gallery-readability'],
 '--all': ['legacy-conflict-persistence','drawing','gallery-visual','workflows','interactions','zoom-grid',
  'update39','gallery-state','peer-sync','drive-accounts','sync-cadence',
  'backup-history','read-only-sync','sync-edit-guard','note-sync',
  'web-content-policy','media-import','pending-audio','help','release-history',
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
function statusReport(mode,records,dir,sourceSha=null){
 const counts={PASS:0,FAIL:0,SKIP:0,'NOT RUN':0};
 for(const record of records){if(!Object.hasOwn(counts,record.status))throw Error('Unknown QA state '+record.status);counts[record.status]++}
 const expectedCases=mode==='--all'?92:null;
 const cases=records.reduce((sum,r)=>sum+(Number.isInteger(r.scenarioTotal)?r.scenarioTotal:0),0);
 const complete=!counts['NOT RUN']&&!counts.FAIL&&!counts.SKIP &&
  records.length===modes[mode].length &&
  records.every(r=>r.status==='PASS'&&Number.isInteger(r.scenarioTotal)&&
   r.scenarioTotal>0&&r.scenarioPassed===r.scenarioTotal);
 const coverage={status:counts['NOT RUN']?'NOT RUN':
  complete&&(expectedCases===null||cases===expectedCases)?'PASS':'FAIL',
  expectedCases,actualCases:cases};
 const report={schema:3,mode,sourceSha,createdAt:new Date().toISOString(),counts,coverage,records,
  scope:'Local Chromium synthetic-data tests, not Android/WebView/device acceptance'};
 const destination=path.join(dir,'results.json'),temp=destination+'.tmp';
 fs.writeFileSync(temp,JSON.stringify(report,null,2)+'\n','utf8');
 fs.renameSync(temp,destination);
 return report;
}
function checkedCases(name,dir,sha){
 const file=path.join(dir,'evidence',name,'report.json');
 const report=JSON.parse(fs.readFileSync(file,'utf8'));
 if(report.suite!==name||report.sha!==sha||report.syntheticOnly!==true||
    !Array.isArray(report.cases)||report.cases.length===0)throw Error('Untrusted/empty case report '+name);
 const names=report.cases.map(x=>x.name);
 if(names.some(x=>typeof x!=='string'||!x)||new Set(names).size!==names.length||
    report.cases.some(x=>x.status!=='passed'))throw Error('Incomplete/failed Chromium cases '+name);
 return {scenarioTotal:report.cases.length,scenarioPassed:report.cases.length};
}
function initialRecords(mode){
 return modes[mode].map(suite=>({suite,status:'NOT RUN',exitCode:null,signal:null,
  elapsedMs:0,error:'not yet executed',timedOut:false,log:null}));
}
function killTreeArgs(pid,platform=process.platform){
 if(!Number.isInteger(pid)||pid<=0)throw Error('Invalid PID');
 return platform==='win32'?['taskkill.exe',['/PID',String(pid),'/T','/F']]:null;
}
async function terminateTree(child){
 if(!child?.pid)return;
 const cmd=killTreeArgs(child.pid);
 if(cmd){
  await new Promise(resolve=>{
   const killer=spawn(cmd[0],cmd[1],{windowsHide:true,stdio:'ignore'});
   const timer=setTimeout(()=>{killer.kill();resolve()},10000);
   killer.once('error',()=>{clearTimeout(timer);child.kill('SIGKILL');resolve()});
   killer.once('close',exitCode=>{
    clearTimeout(timer);
    if(exitCode!==0)child.kill('SIGKILL');
    resolve();
   });
  });
 }else{
  try{process.kill(-child.pid,'SIGKILL')}catch(_){child.kill('SIGKILL')}
 }
}
function testedSha(){
 const result=spawnSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8',timeout:10000,windowsHide:true});
 if(result.error||result.status!==0)throw Error('Cannot verify Git checkout SHA');
 const sha=String(result.stdout||'').trim();
 if(!/^[0-9a-f]{40}$/.test(sha))throw Error('Invalid checkout SHA');
 if(process.env.TESTED_SHA&&sha!==process.env.TESTED_SHA)throw Error('Wrong browser source SHA');
 return sha;
}

function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port)})})}
function close(server){return new Promise(resolve=>server.close(resolve))}
function verifyBrowser(){
 let p;try{p=require.resolve('playwright',{paths:[root]})}
 catch(error){throw Error('Playwright 1.62.1 missing: reviewed offline lockfile required; no auto-install')}
 const version=require(path.join(path.dirname(p),'package.json')).version;
 if(version!=='1.62.1')throw Error('Wrong Playwright version: '+version);
 const chromium=require(p).chromium;
 const executable=process.env.CHROMIUM_PATH||chromium.executablePath();
 if(!fs.existsSync(executable))throw Error('Verified Chromium missing: '+executable+'; no runtime install');
 return executable;
}
async function execute(script,env,logFile,maxDurationMs=8*60*1000){
 return new Promise(resolve=>{
  const started=Date.now(),out=fs.createWriteStream(logFile,{flags:'w'});
  const child=spawn(process.execPath,[path.join(root,'tools/e2e',script+'.cjs')],
   {cwd:root,env,detached:process.platform!=='win32',windowsHide:true,stdio:['ignore','pipe','pipe']});
  let error=null,timedOut=false,settled=false;
  const finish=(exitCode,signal)=>{
   if(settled)return;
   settled=true;clearTimeout(timer);
   const outcome={status:!timedOut&&!error&&exitCode===0?'PASS':'FAIL',
    exitCode,signal,elapsedMs:Date.now()-started,error:error?.message||null,timedOut};
   // Complete the log write BEFORE a synchronous failed-suite read or PASS marker.
   out.end(()=>resolve(outcome));
  };
  const timer=setTimeout(async()=>{
   timedOut=true;
   try{await terminateTree(child)}catch(e){error=e}
   setTimeout(()=>{child.kill('SIGKILL');finish(null,'TIMEOUT')},12000).unref();
  },maxDurationMs);
  child.on('error',e=>{error=e;out.write(String(e)+'\n');finish(null,'SPAWN_ERROR')});
  child.stdout?.on('data',data=>{if(!settled)out.write(data)});
  child.stderr?.on('data',data=>{if(!settled)out.write(data)});
  child.on('close',finish);
 });
}
async function run(mode){
 if(!fs.existsSync(path.join(assetRoot,'index.html')))throw Error('Chybí pracovní kopie aplikace: '+assetRoot);
 const sourceSha=testedSha();
 const date=new Date().toISOString().replace(/[:.]/g,'-');
 const dir=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),
  'Zamerovac-QA','browser','run-'+date+'-'+process.pid);
 fs.mkdirSync(dir,{recursive:true});
 const records=initialRecords(mode);
 statusReport(mode,records,dir,sourceSha); // durable NOT RUN before browser setup
 const server=createStaticServer(assetRoot);
 let port,failed=false;
 const deadline=Date.now()+38*60*1000; // shorter than 50-minute workflow timeout
 try{
  const browser=verifyBrowser();
  port=await listen(server);
  const env={...process.env,CI:'1',CHROMIUM_PATH:browser,
   ZAMEROVAC_BASE_URL:'http://127.0.0.1:'+port,
   ZAMEROVAC_E2E_DIR:path.join(dir,'evidence')};
  for(let i=0;i<records.length;i++){
   if(Date.now()+5000>=deadline){failed=true;break}
   const name=records[i].suite,file=path.join(dir,name+'.log');
   records[i]={...records[i],status:'FAIL',error:'interrupted during execution',log:file};
   statusReport(mode,records,dir,sourceSha); // interrupted work is never PASS
   const outcome=await execute(name,env,file,Math.min(8*60*1000,deadline-Date.now()));
   if(outcome.status==='PASS'){
    try{Object.assign(outcome,checkedCases(name,dir,sourceSha))}
    catch(e){outcome.status='FAIL';outcome.error='Case evidence rejected: '+e.message}
   }
   records[i]={suite:name,...outcome,log:file};
   statusReport(mode,records,dir,sourceSha);
   console.log(outcome.status+' '+name+' ('+Math.round(outcome.elapsedMs/1000)+' s)');
   if(outcome.status==='FAIL'){
    failed=true;
    const log=fs.existsSync(file)?fs.readFileSync(file,'utf8'):'';
    console.error(log.slice(-1500));
   }
  }
 }finally{
  if(port){
   // Do not let a failed browser keep HTTP keepalive sockets alive indefinitely.
   if(typeof server.closeAllConnections==='function')server.closeAllConnections();
   await Promise.race([close(server),new Promise(resolve=>setTimeout(resolve,3000))]);
  }
  statusReport(mode,records,dir,sourceSha);
 }
 const report=statusReport(mode,records,dir,sourceSha);
 console.log('Výsledky Chromium: '+path.join(dir,'results.json'));
 console.log('SUITES: PASS '+report.counts.PASS+' / FAIL '+report.counts.FAIL+
             ' / NOT RUN '+report.counts['NOT RUN']);
 console.log('CASES: '+report.coverage.actualCases+
             ' expected='+report.coverage.expectedCases+' '+report.coverage.status);
 if(failed||report.coverage.status!=='PASS'||report.counts.FAIL||
    report.counts['NOT RUN'])process.exitCode=1;
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
 if(!modes[mode])throw Error('Neplatný režim; použij --smoke, --all, --self-test nebo --help');
 await run(mode);
}
if(require.main===module)main().catch(error=>{console.error('FAIL local browser QA: '+String(error.stack||error));process.exitCode=1});
module.exports={createStaticServer,statusReport,initialRecords,killTreeArgs,modes,sourceRoot:root};
