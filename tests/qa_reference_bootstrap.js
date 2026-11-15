'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {referenceBootstrap}=require('./helpers/qa-reference-bootstrap.cjs');
const file=path.join(__dirname,'helpers/qa-reference-bootstrap.cjs');
const source=fs.readFileSync(file,'utf8');
function withGit(git){
 const context={module:{exports:{}},__dirname:path.dirname(file),Buffer,
  require(id){return id==='node:child_process'?{execFileSync:git}:require(id)}};
 vm.runInNewContext(source,context,{filename:file});return context.module.exports.referenceBootstrap;
}
test('reviewed original bootstrap is available as immutable data, without an active workflow',()=>{
 const text=referenceBootstrap();
 assert(text.includes('npm.cmd ci --offline --ignore-scripts --omit=optional --no-audit --no-fund'));
 assert(text.includes('if-no-files-found: error'));
 assert(!fs.existsSync(path.join(__dirname,'../.github/workflows/browser-smoke-winfix-20261113.yml')));
});
test('Git input is fixed, bounded, no shell or network; approved data passes',()=>{
 let calls=0;
 const read=withGit((command,args,options)=>{
  calls++;assert.equal(command,'git');
  assert.deepEqual(Array.from(args),['cat-file','blob','ec8a2664d2d051f2ef40ee4b51564cc95dcb7485']);
  assert.equal(options.shell,false);assert.equal(options.timeout,15000);assert.equal(options.maxBuffer,65536);
  return Buffer.from(referenceBootstrap());
 });
 assert.equal(read(),referenceBootstrap());assert.equal(calls,1);
});
test('missing object or Git error fails closed once without leaking the underlying error',()=>{
 let calls=0;
 const read=withGit(()=>{calls++;throw Error('PRIVATE PATH TOKEN')});
 assert.throws(read,error=>error.message==='QA reference bootstrap object unavailable; no automatic fetch');
 assert.equal(calls,1);
});
test('replaced reference bytes never become accepted test evidence',()=>{
 const original=Buffer.from(referenceBootstrap());
 for(const bytes of [Buffer.from(''),Buffer.from('invented offline policy'),Buffer.concat([original,Buffer.from('\n')])]){
  assert.throws(withGit(()=>bytes),/reference bootstrap bytes changed/);
 }
});
