'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {referenceBootstrap}=require('./helpers/qa-reference-bootstrap.cjs');
const file=path.join(__dirname,'helpers/qa-reference-bootstrap.cjs');
const source=fs.readFileSync(file,'utf8');
function withFs(override){
  const context={module:{exports:{}},__dirname:path.dirname(file),Buffer,
    require(id){return id==='node:fs'?override:require(id)}};
  vm.runInNewContext(source,context,{filename:file});
  return context.module.exports.referenceBootstrap;
}
test('historical reviewed bootstrap survives a depth-one Git checkout as inert data',()=>{
  const content=referenceBootstrap();
  assert(content.includes('npm.cmd ci --offline --ignore-scripts --omit=optional --no-audit --no-fund'));
  assert(content.includes('if-no-files-found: error'));
  assert(!fs.existsSync(path.join(__dirname,'../.github/workflows/browser-smoke-winfix-20261113.yml')));
});
test('frozen original Git blob has both exact content hashes; no fetch or shell',()=>{
  let calls=0;
  const bytes=Buffer.from(referenceBootstrap());
  const run=withFs({
    lstatSync(){calls++;return {isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:bytes.length}},
    readFileSync(){calls++;return bytes}
  });
  assert.equal(run(),referenceBootstrap());assert.equal(calls,2);
});
test('missing, linked, oversized and corrupt frozen fixture fail closed',()=>{
  const bytes=Buffer.from(referenceBootstrap());
  const cases=[
    {lstatSync(){throw Error('PRIVATE PATH TOKEN')}},
    {lstatSync(){return {isFile:()=>true,isSymbolicLink:()=>true,nlink:1,size:bytes.length}}},
    {lstatSync(){return {isFile:()=>true,isSymbolicLink:()=>false,nlink:2,size:bytes.length}}},
    {lstatSync(){return {isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:65537}}},
    {lstatSync(){return {isFile:()=>true,isSymbolicLink:()=>false,nlink:1,size:bytes.length}},
      readFileSync(){return Buffer.concat([bytes,Buffer.from('X')])}}
  ];
  for(const input of cases)assert.throws(withFs(input),/fixture unavailable|bytes changed/);
});
