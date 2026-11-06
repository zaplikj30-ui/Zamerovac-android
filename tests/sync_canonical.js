'use strict';
const assert=require('node:assert/strict'),crypto=require('node:crypto'),fs=require('node:fs'),p=require('../sync/protocol-v2');
const hash=async bytes=>crypto.createHash('sha256').update(bytes).digest('hex');
(async()=>{
 const f=JSON.parse(fs.readFileSync('app/src/test/resources/sync-canonical-v2.json','utf8'));
 assert.equal(p.canonical(f.input),f.canonical);assert.equal(await hash(f.canonical),f.hash);assert.equal(await p.jobId(hash,f.job),f.jobId);
 for(const text of ['\ud800','\udc00','abc\ud800x'])assert.throws(()=>p.canonical({text}),/Unicode/);
 let state={version:2,revision:0,jobs:[]};const q=new p.PersistentQueue({readQueue:async()=>structuredClone(state),compareAndSwapQueue:async(expected,next)=>{if(expected!==state.revision)return false;state=structuredClone(next);return true}},hash);
 assert.equal(await q.enqueue({...f.job,size:100,sourceRef:f.hash}),f.jobId);assert.equal(state.jobs[0].sourceRef,f.hash);assert.equal(state.jobs[0].payload,null);
 console.log('PASS shared RFC8785 canonical bytes, job IDs, source references and invalid Unicode');
})().catch(e=>{console.error(e);process.exit(1)});
