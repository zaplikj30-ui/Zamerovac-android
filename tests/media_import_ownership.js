/* N4-A: deterministic receipt contracts with an asynchronous IndexedDB model. */
'use strict';
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const code=fs.readFileSync('app/src/main/assets/media-import-ownership.js','utf8');
function fakeIndexedDB(){
 const files=new Map();
 const database={
  objectStoreNames:{contains:()=>true},createObjectStore(){},
  transaction(){
   let pending=0,aborted=false;
   const tx={
    oncomplete:null,onabort:null,onerror:null,error:null,
    abort(){aborted=true;queueMicrotask(()=>tx.onabort?.())},
    objectStore(){return {
      add:(value,id)=>run(()=>{if(files.has(id))throw Error('Duplicate');files.set(id,value)}),
      put:(value,id)=>run(()=>files.set(id,value)),
      get:id=>run(()=>files.get(id))
    }}
   };
   function run(action){
    const request={};pending++;
    queueMicrotask(()=>{
     try{if(aborted)return;request.result=action();request.onsuccess?.()}
     catch(error){aborted=true;tx.error=error;request.error=error;request.onerror?.();tx.onerror?.()}
     finally{pending--;if(!pending&&!aborted)queueMicrotask(()=>{if(!pending&&!aborted)tx.oncomplete?.()})}
    });
    return request;
   }
   return tx;
  }
 };
 return {files,open(){const request={result:database};queueMicrotask(()=>{request.onupgradeneeded?.();request.onsuccess?.()});return request}};
}
(async()=>{
 const indexedDB=fakeIndexedDB(),ctx={indexedDB,queueMicrotask};
 vm.createContext(ctx);vm.runInContext(code,ctx);
 const ownership=ctx.MediaImportOwnership;
 assert.equal(await ownership.inspect('image-101'),null);
 await ownership.reserve('image-101','request-101');
 assert.equal((await ownership.inspect('image-101')).owner,'request-101');
 assert.equal((await ownership.inspect('image-101')).phase,'reserved');
 await assert.rejects(()=>ownership.reserve('image-101','request-202'));
 await assert.rejects(()=>ownership.published('image-101','request-202'));
 assert.equal((await ownership.inspect('image-101')).phase,'reserved');
 await ownership.published('image-101','request-101');
 assert.equal((await ownership.inspect('image-101')).phase,'published');
 const restarted={indexedDB,queueMicrotask};vm.createContext(restarted);vm.runInContext(code,restarted);
 assert.equal((await restarted.MediaImportOwnership.inspect('image-101')).owner,'request-101');
 await assert.rejects(()=>ownership.reserve('../bad','request-101'));
 await assert.rejects(()=>ownership.reserve('image-404','bad/token'));
 const unavailable={};vm.createContext(unavailable);vm.runInContext(code,unavailable);
 await assert.rejects(()=>unavailable.MediaImportOwnership.reserve('image-404','request-404'));
 assert.equal(indexedDB.files.size,1);
 const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
 assert.ok(html.indexOf('src="media-import-ownership.js"')<html.indexOf('src="app.js"'));
 const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
 assert.ok(app.includes('await MediaImportOwnership.reserve(id,importToken)'));
 assert.ok(app.includes('await MediaImportOwnership.published(id,importToken)'));
 console.log('PASS N4-A: reserve, duplicate owner, stale token, publish, restart and fail closed');
})().catch(error=>{console.error(error);process.exitCode=1});
