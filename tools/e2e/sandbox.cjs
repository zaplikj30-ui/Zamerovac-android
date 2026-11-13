'use strict';
// One launch policy for the harness and local runner. No persistent user profile.
const path=require('node:path');
function blocked(message){return Object.assign(Error('HOME BLOCKED: '+message),{code:'HOME_BLOCKED'})}
function launchOptions(executablePath){
 return {executablePath,chromiumSandbox:true,headless:true,args:[],timeout:15000};
}
function checkOptions(options){
 const allowed=['executablePath','chromiumSandbox','headless','args','timeout'];
 if(!options||Object.keys(options).some(k=>!allowed.includes(k))||
    options.chromiumSandbox!==true||options.headless!==true||
    !Array.isArray(options.args)||options.args.length!==0||
    typeof options.executablePath!=='string'||!path.isAbsolute(options.executablePath)||
    (options.timeout!==undefined&&options.timeout!==15000))
  throw blocked('invalid Chromium sandbox launch configuration');
}
function checkCommandLine(args){
 if(!Array.isArray(args)||!args.length||args.some(x=>typeof x!=='string')||
    !args.includes('--enable-automation')||args.some(x=>
     /^--(?:no-.*sandbox|disable-.*sandbox|single-process|no-zygote|allow-sandbox-debugging)(?:=|$)/i.test(x)))
  throw blocked('Chromium command line missing or disables sandbox');
}
function checkEvidence(proof,platform){
 if(!proof||proof.platform!==platform||!Array.isArray(proof.rows))
  throw blocked('sandbox diagnostics unavailable');
 if(platform==='linux'){
  const rows=new Map(proof.rows);
  if(proof.evaluation!=='You are adequately sandboxed.'||
     !['Namespace','SUID'].includes(rows.get('Layer 1 Sandbox'))||
     ['PID namespaces','Network namespaces','Seccomp-BPF sandbox',
      'Seccomp-BPF sandbox supports TSYNC'].some(k=>rows.get(k)!=='Yes'))
   throw blocked('Linux sandbox diagnostics not adequate');
 }else if(platform==='win32'){
  // Chromium's own sandbox internals: a Renderer row without a policy is
  // explicitly "Not Sandboxed". Unknown schema/policy fails closed.
  const renderers=proof.rows.filter(r=>r[1]==='Renderer');
  if(!renderers.length||renderers.some(r=>r[3]!=='Renderer'||
     !/^[1-9][0-9]*$/.test(r[0])||r[4]!=='Lockdown'||r[5]!=='S-1-16-0 Untrusted'))
   throw blocked('Windows renderer lockdown/integrity unverified');
 }else throw blocked('unsupported sandbox platform: '+platform);
 return {...proof,status:'PASS',platform,method:'chrome://sandbox'};
}
async function boundedVerification(browser){
 let timer;
 try{return await Promise.race([verifySandbox(browser),new Promise((_,reject)=>{
  timer=setTimeout(()=>reject(blocked('sandbox verification timed out')),7000);
 })])}finally{clearTimeout(timer)}
}
async function verifySandbox(browser){
 const platform=process.platform;
 if(!['linux','win32'].includes(platform))throw blocked('unsupported sandbox platform');
 const session=await browser.newBrowserCDPSession();
 try{checkCommandLine((await session.send('Browser.getBrowserCommandLine')).arguments)}
 finally{await session.detach()}
 const context=await browser.newContext();
 try{
  const page=await context.newPage();page.setDefaultTimeout(7000);
  await page.goto('chrome://sandbox',{timeout:7000});
  await page.waitForFunction(()=>document.querySelectorAll('#sandbox-status tr').length>1,{},{timeout:7000});
  const proof=await page.evaluate(platform=>({platform,
   evaluation:document.querySelector('#evaluation')?.textContent.trim()||null,
   rows:Array.from(document.querySelectorAll('#sandbox-status tr'),r=>
    Array.from(r.querySelectorAll('td'),c=>c.textContent.trim()))}),platform);
  return checkEvidence(proof,platform);
 }finally{await context.close()}
}
async function launchSandboxed(chromium,options){
 let browser;
 try{
  checkOptions(options);
  browser=await chromium.launch(options);
  const evidence=await boundedVerification(browser);
  return {browser,evidence};
 }catch(error){
  if(browser)await browser.close().catch(()=>{});
  throw error.code==='HOME_BLOCKED'?error:blocked(String(error.message||error));
 }
}
module.exports={blocked,launchOptions,launchSandboxed,checkEvidence,checkCommandLine};
