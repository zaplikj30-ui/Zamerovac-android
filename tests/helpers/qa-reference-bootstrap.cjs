'use strict';
// Read-only historical test input, never a file under .github/workflows.
// A shallow checkout must explicitly stage this reviewed Git object before QA.
// No fetch/install, caller-selected revision, shell, fallback or workflow write.
const path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process');
const blob='ec8a2664d2d051f2ef40ee4b51564cc95dcb7485';
const sha256='e31e02bc0938a6ba28c514765380c5bbd1b99c230117d0b0128618d562431120';
function referenceBootstrap(){
 let bytes;
 try{
  bytes=execFileSync('git',['cat-file','blob',blob],{
   cwd:path.resolve(__dirname,'../..'),shell:false,timeout:15000,maxBuffer:65536,
   stdio:['ignore','pipe','pipe'],windowsHide:true,
  });
 }catch{throw Error('QA reference bootstrap object unavailable; no automatic fetch')}
 const actual=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
 if(actual!==blob||crypto.createHash('sha256').update(bytes).digest('hex')!==sha256)
  throw Error('QA reference bootstrap bytes changed');
 return bytes.toString('utf8');
}
module.exports={referenceBootstrap};
