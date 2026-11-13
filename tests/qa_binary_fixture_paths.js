'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const crypto=require('node:crypto');
const repo=path.resolve(__dirname,'..');
const fixtureTests=[
 'pin verifier rejects changed bytes, wrong paths, symlinks and hardlinks',
 'real binary mutation during hashing and name replacement fail closed',
];

// Deterministic filesystem API model, not native Windows/8.3 runtime evidence.
// The two spellings access the same real files without a symlink. Portable
// realpath preserves the alias; native realpath returns the long spelling.
function withAliasModel(body){
 const root=fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(),'qa-alias-model-')));
 const canonical=path.join(root,'PrivateUser'),alias=path.join(root,'PRIVAT~1');
 fs.mkdirSync(canonical);
 const translate=(value,from,to)=>typeof value==='string'&&(value===from||value.startsWith(from+path.sep))
  ?to+value.slice(from.length):value;
 const native=value=>translate(value,alias,canonical),short=value=>translate(value,canonical,alias);
 const calls={native:0,portable:0};
 const realpath=Object.assign(value=>{calls.portable++;return short(fs.realpathSync(native(value)))},{
  native(value){calls.native++;return fs.realpathSync.native(native(value))},
 });
 const modeledFs=new Proxy(fs,{get(target,key){
  if(key==='realpathSync')return realpath;
  if(key==='mkdtempSync')return (...args)=>short(fs.mkdtempSync(...args.map(native)));
  const value=target[key];
  return typeof value==='function'?(...args)=>value(...args.map(native)):value;
 }});
 const modeledOs={...os,tmpdir:()=>alias};
 const modeledRequire=id=>{
  if(id==='node:fs')return modeledFs;
  if(id==='node:os')return modeledOs;
  if(id==='../tools/qa-browser-identity.cjs'){
   const module={exports:{}};
   vm.runInNewContext(fs.readFileSync(path.join(repo,'tools/qa-browser-identity.cjs'),'utf8'),{
    module,Buffer,process,require(name){
     if(name==='./qa-browser-profiles.json')return require('../tools/qa-browser-profiles.json');
     return modeledRequire(name);
    },
   });
   return module.exports;
  }
  return require(id);
 };
 try{return body({modeledFs,modeledRequire,alias,canonical,calls})}
 finally{fs.rmSync(root,{recursive:true,force:true})}
}

// Run the actual test callbacks, including their mutation/rename assertions;
// do not replace the verifier or duplicate those security checks here.
for(const name of fixtureTests)test(name+' (portable/native alias model)',()=>withAliasModel(({modeledRequire,calls})=>{
 const callbacks=new Map();
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'home_qa_integrity.js'),'utf8'),{
  __dirname,Buffer,process,console,require(id){
   if(id==='node:test')return {test(title,...args){callbacks.set(title,args.at(-1))}};
   if(id==='../tools/qa-browser-identity.cjs')return modeledRequire(id);
   if(id.startsWith('../'))return require(path.resolve(__dirname,id));
   return modeledRequire(id);
  },
 });
 assert.equal(callbacks.size,15,'the fixture suite inventory must be reviewed when it changes');
 assert.equal(typeof callbacks.get(name),'function');
 callbacks.get(name)();
 assert(calls.native>1,'must exercise native directory and binary resolution');
}));

test('same-file short spelling remains BLOCKED before open in the production verifier',()=>withAliasModel(({modeledFs,alias,canonical})=>{
 const bytes=Buffer.from('4d5a01020304','hex'),file=path.join(alias,'fixture.exe');
 fs.writeFileSync(path.join(canonical,'fixture.exe'),bytes);
 let opens=0;
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(path.join(repo,'tools/qa-browser-identity.cjs'),'utf8'),{
  module,Buffer,process,require(id){
   if(id==='node:fs')return new Proxy(modeledFs,{get(target,key){
    if(key==='openSync')return ()=>{opens++;throw Error('must block before open')};
    return target[key];
   }});
   if(id==='./qa-browser-profiles.json')return require('../tools/qa-browser-profiles.json');
   return require(id);
  },
 });
 assert.throws(()=>module.exports.verifyFile(file,{path:file,magic:'4d5a',
  sha256:crypto.createHash('sha256').update(bytes).digest('hex')}),error=>{
  assert.equal(error.code,'HOME_BLOCKED');
  assert.match(error.message,/path resolves elsewhere/);
  const diagnostic=JSON.parse(error.message.split('; pathDiagnostic=')[1]);
  assert.equal(diagnostic.fileIdentity.same,true);
  assert.equal(diagnostic.portable.inputEquivalent,true);
  assert.equal(diagnostic.portable.nativeEquivalent,false);
  return true;
 });
 assert.equal(opens,0);
}));
