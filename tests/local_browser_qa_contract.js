'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const http=require('node:http');
const {createStaticServer,statusReport,modes}=require('../tools/local-browser-qa.cjs');
(async()=>{
 const fixture=fs.mkdtempSync(path.join(os.tmpdir(),'zamerovac-browser-qa-'));
 const assets=path.join(fixture,'assets');fs.mkdirSync(assets);
 fs.writeFileSync(path.join(assets,'index.html'),'<html>TEST APP</html>');
 fs.writeFileSync(path.join(assets,'style.css'),'html { color: blue; }');
 const secret=path.join(fixture,'PRIVATE-DO-NOT-SERVE.txt');fs.writeFileSync(secret,'PRIVATE-SECRET-2481');
 let symlinkSupported=false;
 try{fs.symlinkSync(secret,path.join(assets,'leak.txt'));symlinkSupported=true}catch(error){if(!['EPERM','EACCES','ENOTSUP'].includes(error.code))throw error}
 const server=createStaticServer(assets);
 try{
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve)});
  const port=server.address().port;
  const request=(route,method='GET')=>new Promise((resolve,reject)=>{
   const req=http.request({host:'127.0.0.1',port,path:route,method},res=>{
    const chunks=[];res.on('data',x=>chunks.push(x));res.on('end',()=>resolve({code:res.statusCode,headers:res.headers,body:Buffer.concat(chunks).toString()}));
   });req.on('error',reject);req.end();
  });
  let r=await request('/');assert.equal(r.code,200);assert.match(r.body,/TEST APP/);
  assert.match(r.headers['content-type'],/text\/html/);
  assert.equal(r.headers['cache-control'],'no-store');
  assert.equal((await request('/style.css?case=1')).code,200);
  assert.equal((await request('/style.css','HEAD')).body,'');
  assert.equal((await request('/missing')).code,404);
  assert.equal((await request('/..%5cPRIVATE-DO-NOT-SERVE.txt')).code,403);
  assert.equal((await request('/','POST')).code,405);
  if(symlinkSupported){r=await request('/leak.txt');assert.equal(r.code,403);assert.ok(!r.body.includes('PRIVATE-SECRET-2481'))}
  const report=statusReport('--smoke',[
   {suite:'geometry',status:'PASS'},{suite:'pixels',status:'FAIL'},
   {suite:'android',status:'NOT RUN'}],fixture);
  assert.deepEqual(report.counts,{PASS:1,FAIL:1,SKIP:0,'NOT RUN':1});
  assert.equal(JSON.parse(fs.readFileSync(path.join(fixture,'results.json'))).counts.FAIL,1);
  assert.deepEqual(modes['--smoke'],['drawing','quality-regressions','gallery-readability']);
  assert.equal(modes['--all'].includes('android-system'),false);
  console.log('PASS: local Chromium server isolates assets/symlinks, correct HTTP/MIME, strict statuses, exact suite allowlist');
 }finally{
  await new Promise(resolve=>server.close(resolve));
  fs.rmSync(fixture,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1});
