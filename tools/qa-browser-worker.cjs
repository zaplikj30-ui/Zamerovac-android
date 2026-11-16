'use strict';
// The public runner starts this worker only inside its owned OS process scope.
const fs=require('node:fs'),path=require('node:path');
async function main(){
 const {launchOptions,launchSandboxed}=require('./e2e/sandbox.cjs');
 if(!/^[a-f0-9]{32}$/.test(process.env.ZAMEROVAC_RUN_TOKEN||''))throw Error('HOME BLOCKED: missing supervisor run identity');
 const cloud=process.env.ZAMEROVAC_QA_MODE==='cloud';
 const playwright=cloud?require('./qa-cloud-runtime.cjs').loadPlaywright():require('playwright');
 if(!cloud&&require('playwright/package.json').version!=='1.62.1')throw Error('HOME BLOCKED: Playwright version mismatch');
 if(process.argv[2]==='preflight'){
  const {browser,evidence}=await launchSandboxed(playwright.chromium,launchOptions(process.env.CHROMIUM_PATH));
  await browser.close();
  fs.writeFileSync(process.argv[3],JSON.stringify({sandbox:evidence,runToken:process.env.ZAMEROVAC_RUN_TOKEN}),{flag:'wx'});
 }else if(process.argv[2]==='suite'){
  require(path.resolve(process.argv[3]));
 }else throw Error('HOME BLOCKED: invalid browser worker');
}
main().catch(error=>{console.error(error.stack||error);process.exitCode=1});
