'use strict';
// Trusted QA checkout drives a separate immutable PR121 product checkout.
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),os=require('node:os');
const crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {blocked,checkEvidence}=require('./e2e/sandbox.cjs');
const {verifyBrowserIdentity}=require('./qa-browser-identity.cjs');
const integrity=require('./qa-integrity.cjs');
const {ownedWorker}=require('./qa-process-client.cjs');
const modes=integrity.modes;
const gateRoot=path.resolve(__dirname,'..');
const root=path.resolve(process.env.ZAMEROVAC_SOURCE_ROOT||gateRoot);
const assetRoot=path.join(root,'app','src','main','assets');
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
function statusReport(mode,records,dir,identity={}){
 const counts={PASS:0,FAIL:0,SKIP:0,'NOT RUN':0};
 for(const record of records){
  if(record.status==='BLOCKED'&&!Object.hasOwn(counts,'BLOCKED'))counts.BLOCKED=0;
  if(!Object.hasOwn(counts,record.status))throw blocked('Unknown QA state');
  counts[record.status]++;
 }
 const coverage=integrity.complete(mode,records,identity);
 const status=counts.BLOCKED?'BLOCKED':counts.FAIL?'FAIL':coverage.status;
 const report={schema:3,status,mode,identity,coverage,createdAt:new Date().toISOString(),counts,records,
  scope:'Synthetic browser QA; Linux/Windows identity explicit, never Android or HOME acceptance by inheritance'};
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
 return report;
}
function listen(server){return new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port)})})}
function close(server){return new Promise(resolve=>server.close(resolve))}
function gateSnapshot(){
 const git=args=>execFileSync('git',args,{cwd:gateRoot,encoding:'utf8',timeout:15000,windowsHide:true});
 if(git(['status','--porcelain','--untracked-files=all']).trim())throw blocked('QA validator checkout must be clean');
 const sha=git(['rev-parse','HEAD']).trim();
 if(!/^[a-f0-9]{40}$/.test(sha))throw blocked('QA validator SHA missing');
 const names=['tools/local-browser-qa.cjs','tools/e2e/harness.cjs','tools/e2e/sandbox.cjs',
  'tools/qa-browser-identity.cjs','tools/qa-browser-profiles.json','tools/qa-pr121-manifest.json',
  'tools/qa-integrity.cjs','tools/qa-process-client.cjs','tools/qa-browser-worker.cjs',
  'tools/qa_owned_processes.py','tools/qa_process_supervisor.py','tools/qa_browser_lock.py'];
 const entries=git(['ls-tree','-rz','HEAD','--',...names]).split('\0').filter(Boolean);
 if(entries.length!==names.length)throw blocked('validator files missing from reviewed commit');
 for(const entry of entries){
  const [metadata,name]=entry.split('\t'),expected=metadata.split(' ')[2],file=path.join(gateRoot,name);
  if(!fs.lstatSync(file).isFile())throw blocked('validator file redirected');
  const bytes=fs.readFileSync(file),actual=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(actual!==expected)throw blocked('validator bytes changed: '+name);
 }
 return sha;
}
function stageProduct(work,source=root){
 const stage=path.join(work,'stage','tools','e2e');fs.mkdirSync(stage,{recursive:true});
 for(const name of Object.keys(integrity.manifest.files).filter(n=>n.startsWith('tools/e2e/'))){
  if(name==='tools/e2e/harness.cjs')continue;
  fs.copyFileSync(path.join(source,name),path.join(stage,path.basename(name)),fs.constants.COPYFILE_EXCL);
 }
 for(const name of ['harness.cjs','sandbox.cjs'])fs.copyFileSync(path.join(__dirname,'e2e',name),path.join(stage,name),fs.constants.COPYFILE_EXCL);
 fs.copyFileSync(path.join(__dirname,'qa-browser-identity.cjs'),path.join(stage,'..','qa-browser-identity.cjs'),fs.constants.COPYFILE_EXCL);
 fs.copyFileSync(path.join(__dirname,'qa-browser-profiles.json'),path.join(stage,'..','qa-browser-profiles.json'),fs.constants.COPYFILE_EXCL);
 return stage;
}
function identityFrom(env){return {sourceSha:env.ZAMEROVAC_SOURCE_SHA,validatorSha:env.ZAMEROVAC_QA_GATE_SHA,runToken:env.ZAMEROVAC_RUN_TOKEN,platform:process.platform}}
async function execute(suite,env,log,maxDurationMs=480000,signal){
 let life;
 try{
  integrity.noFilter(env);
  if(!Object.hasOwn(integrity.manifest.cases,suite)||!env.ZAMEROVAC_STAGED_E2E_DIR)throw blocked('unapproved/unstaged suite');
  life=await ownedWorker([process.execPath,path.join(__dirname,'qa-browser-worker.cjs'),'suite',path.join(env.ZAMEROVAC_STAGED_E2E_DIR,suite+'.cjs')],root,env,log,env.ZAMEROVAC_RUN_TOKEN,maxDurationMs,signal);
  let report;
  try{report=JSON.parse(fs.readFileSync(path.join(env.ZAMEROVAC_E2E_DIR,suite,'report.json'),'utf8'))}
  catch(_){throw blocked('missing current suite report; lifecycle='+JSON.stringify(life))}
  integrity.checkedReport(report,suite,identityFrom(env));
  if(life.status!=='PASS'||life.cleanupVerified!==true)throw blocked('owned process lifecycle failed: '+JSON.stringify(life));
  return {status:'PASS',report,cleanupVerified:true,lifecycle:life,exitCode:life.exitCode};
 }catch(e){return {status:'BLOCKED',cleanupVerified:life?.cleanupVerified===true,lifecycle:life,error:e.message}}
}
async function run(mode){
 const parent=process.env.ZAMEROVAC_QA_RESULT_PARENT||path.join(process.env.LOCALAPPDATA||os.tmpdir(),'Zamerovac-QA','browser');
 fs.mkdirSync(parent,{recursive:true});
 const dir=fs.mkdtempSync(path.join(parent,'run-'));
 const identity={sourceSha:integrity.manifest.sourceSha,validatorSha:null,runToken:crypto.randomBytes(16).toString('hex'),platform:process.platform,finalized:false};
 const records=modes[mode].map(suite=>({suite,status:'NOT RUN'}));
 const controller=new AbortController();const cancel=()=>controller.abort();
 for(const sig of ['SIGINT','SIGTERM',...(process.platform==='win32'?[]:['SIGHUP'])])process.on(sig,cancel);
 let server,work,preflight,allClean=true,succeeded=false;
 const deadline=setTimeout(cancel,38*60*1000);
 try{
  statusReport(mode,records,dir,identity);
  integrity.noFilter();identity.validatorSha=gateSnapshot();
  if(process.env.ZAMEROVAC_EXPECTED_QA_SHA&&process.env.ZAMEROVAC_EXPECTED_QA_SHA!==identity.validatorSha)throw blocked('approved validator SHA mismatch');
  Object.assign(identity,integrity.executionIdentity(identity.validatorSha));
  integrity.sourceSnapshot(root);verifyBrowserIdentity(process.env.CHROMIUM_PATH);
  work=fs.mkdtempSync(path.join(dir,'owned-'));const stage=stageProduct(work);
  const env={...process.env,CI:'1',ZAMEROVAC_RUN_TOKEN:identity.runToken,ZAMEROVAC_QA_GATE_SHA:identity.validatorSha,
   ZAMEROVAC_SOURCE_SHA:identity.sourceSha,ZAMEROVAC_E2E_DIR:path.join(dir,'evidence'),ZAMEROVAC_STAGED_E2E_DIR:stage};
  const temp=path.join(work,'temp');fs.mkdirSync(temp);
  for(const key of ['TMPDIR','TMP','TEMP'])env[key]=temp;
  env.XDG_CONFIG_HOME=path.join(work,'config');env.XDG_CACHE_HOME=path.join(work,'cache');
  env.LOCALAPPDATA=path.join(work,'localappdata');
  for(const name of [env.XDG_CONFIG_HOME,env.XDG_CACHE_HOME,env.LOCALAPPDATA])fs.mkdirSync(name);
  preflight=await ownedWorker([process.execPath,path.join(__dirname,'qa-browser-worker.cjs'),'preflight',path.join(work,'sandbox.json')],root,env,path.join(dir,'sandbox.log'),identity.runToken,35000,controller.signal);
  allClean=preflight.cleanupVerified===true;
  if(preflight.status!=='PASS'||!allClean)throw blocked('sandbox preflight: '+JSON.stringify(preflight));
  const proof=JSON.parse(fs.readFileSync(path.join(work,'sandbox.json'),'utf8'));
  if(proof.runToken!==identity.runToken)throw blocked('stale sandbox preflight');
  checkEvidence(proof.sandbox,process.platform);
  server=createStaticServer(assetRoot);const port=await listen(server);
  env.ZAMEROVAC_BASE_URL='http://127.0.0.1:'+port;
  for(let i=0;i<records.length;i++){
   if(controller.signal.aborted)throw blocked('QA cancelled or overall timeout');
   integrity.sourceSnapshot(root);if(gateSnapshot()!==identity.validatorSha)throw blocked('validator changed');
   const suite=records[i].suite;records[i]= {suite,...await execute(suite,env,path.join(dir,suite+'.log'),480000,controller.signal)};
   allClean=allClean&&records[i].cleanupVerified===true;
   statusReport(mode,records,dir,identity);
   console.log(records[i].status+' '+suite);
   if(records[i].status!=='PASS')throw blocked(records[i].error);
  }
  integrity.sourceSnapshot(root);if(gateSnapshot()!==identity.validatorSha)throw blocked('validator changed after tests');
  succeeded=true;
 }catch(e){
  for(let i=0;i<records.length;i++)if(records[i].status==='NOT RUN')records[i]={...records[i],status:'BLOCKED',error:e.message};
  // If an integrity error follows all suites, preserve the failure independently.
  identity.error=e.message;
  console.error('HOME BLOCKED: '+e.message);
 }finally{
  clearTimeout(deadline);
  for(const sig of ['SIGINT','SIGTERM',...(process.platform==='win32'?[]:['SIGHUP'])])process.off(sig,cancel);
  try{
   if(server){server.closeAllConnections?.();await close(server)}
   // Preserve scratch evidence on any unverified cleanup. Never clean a caller path.
   if(work&&allClean)fs.rmSync(work,{recursive:true,force:true});
  }catch(error){allClean=false;identity.error='runner cleanup failed: '+error.message}
 }
 identity.finalized=succeeded&&!identity.error&&allClean&&!controller.signal.aborted;
 const report=statusReport(mode,records,dir,identity);
 report.preflight=preflight||{status:'NOT RUN'};
 if(identity.error)report.status='BLOCKED';
 fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n');
 console.log('Current QA report: '+path.join(dir,'results.json'));
 console.log(report.status+' '+JSON.stringify(report.counts));
 if(report.status!=='PASS')process.exitCode=1;
}
async function main(){
 const mode=process.argv[2]||'--smoke';
 if(mode==='--help'){console.log('node tools/local-browser-qa.cjs --all | --legacy-conflict | --smoke | --self-test; explicit trusted PR121 checkout and pinned Chromium, no installs');return}
 if(mode==='--self-test'){
  const server=createStaticServer(assetRoot),port=await listen(server);
  try{
   const request=(route,method='GET')=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port,path:route,method},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end();
   });
   const actual=await Promise.all([request('/'),request('/missing'),request('/..%5CAGENTS.md'),request('/','POST')]);
   if(JSON.stringify(actual)!=='[200,404,403,405]')throw blocked('static server contract failed');
   console.log('PASS local Chromium server (HTTP 200/404/403/405), no browser or APK');
  }finally{await close(server)}
  return;
 }
 if(!modes[mode])throw blocked('invalid QA mode');
 await run(mode);
}
if(require.main===module)main().catch(e=>{console.error('HOME BLOCKED: '+e.message);process.exitCode=1});
module.exports={createStaticServer,statusReport,modes,execute,stageProduct};
