'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function windowsDispatch(source){
 const registered=[];
 let nativeCalls=0;
 const blocked=()=>{nativeCalls++;throw Error('native launch forbidden in this test')};
 vm.runInNewContext(source,{
  __dirname,process:{platform:'win32',execPath:'NOT_EXECUTED'},
  require(id){
   // Inspect registration only: never invoke a native workload, even when
   // checking the deliberately unsafe old registration in the negative case.
   if(id==='node:test')return {test(name,options){registered.push({name,options:typeof options==='function'?{}:options})}};
   if(id==='node:child_process')return {spawn:blocked};
   if(id==='../tools/qa-process-client.cjs')return {ownedWorker:blocked};
   return require(id);
  },
 });
 assert.equal(nativeCalls,0);
 return registered;
}
function assertSkipped(items){
 assert.equal(items.length,3);
 for(const item of items)assert.match(item.options.skip,/native Windows fault testing requires separate isolated approval/);
}
test('Windows automatic client suite registers only explicit skips and never launches a process',()=>{
 const source=fs.readFileSync(path.join(__dirname,'qa_process_client.js'),'utf8');
 assertSkipped(windowsDispatch(source));
});
test('unguarded native registration is rejected without running its fault payload',()=>{
 const source=fs.readFileSync(path.join(__dirname,'qa_process_client.js'),'utf8');
 const guard=" {skip:process.platform!=='linux'?'Linux process proof; native Windows fault testing requires separate isolated approval':false},";
 assert(source.includes(guard));
 assert.throws(()=>assertSkipped(windowsDispatch(source.replace(guard,''))));
});
