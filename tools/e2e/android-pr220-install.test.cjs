'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require.resolve('./android-pr220.cjs'),'utf8');
const open=source.slice(source.indexOf('async function open('),source.indexOf('(async()=>'));
const helper=source.match(/function assertInstall\(output\)\{[\s\S]*?\n\}/)?.[0]||'';
async function run(output,installed='package:/data/app/test/base.apk',failure=false){
 const calls=[];
 const context={assert, pkg:'cz.zamerovac.app.preview',adb:(...args)=>{
  calls.push(args);
  if(args[0]==='install'){if(failure)throw Error('exit 1');return output;}
  if(args[2]==='path')return installed;
  if(args[2]==='clear')return 'Success';
  return 'Status: ok';
 }};
 vm.createContext(context);
 vm.runInContext(helper+'\n'+open+'\nthis.open=open;',context);
 const page={setDefaultTimeout(){},locator:()=>({waitFor:async()=>{},isVisible:async()=>false}),evaluate:async()=>true};
 await context.open({webView:async()=>({page:async()=>page})},'fixture.apk');
 assert(calls.some(args=>args.join(' ')==='shell pm path cz.zamerovac.app.preview'));
}
(async()=>{
 for(const out of ['Success','Performing Streamed Install\nSuccess','Performing Streamed Install\r\nSuccess','Performing Push Install\nSuccess'])await run(out);
 for(const out of ['','Failure [INSTALL_FAILED]','Success\nFailure [x]','Failure [x]\nSuccess','NotSuccess','Success extra','Success\nunknown'])await assert.rejects(run(out));
 await assert.rejects(run('Success',''));
 await assert.rejects(run('Success','package:bad'));
 await assert.rejects(run('Success',undefined,true));
 console.log('PASS install output, package presence and nonzero exit; no ADB/APK executed');
})().catch(error=>{console.error(error);process.exitCode=1;});
