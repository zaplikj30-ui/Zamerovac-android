'use strict';
// B1: historical source material is inert, byte-for-byte reviewed Git data.
// GitHub-hosted QUICK must NEVER resolve missing historical commits, fetch,
// install dependencies, or silently substitute current HEAD for old guards.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const directory=path.resolve(__dirname,'../fixtures/qa-history');
const INDEX_BLOB='722591e8bc72b0769b4f1cc296bebe7e909d1dcf';
const refs=Object.freeze({
  manifest:{name:'a3cc8eb3/qa-pr121-manifest.json',blob:'cde59d6282dac2a4928e3387ab0cba7312991e49'},
  integrity:{name:'a3cc8eb3/qa-integrity.cjs.txt',blob:'f25616f9751d701339e92195d7913176a4827980'},
  workflow:{name:'a3cc8eb3/windows-self-hosted-qa.yml.txt',blob:'12e820d4664d1ff8f696fb9e67d1e1095ade841f'},
  fixtureGate:{name:'6f98ce/qa-fixture-gate.cjs.txt',blob:'25d6ad6cd684a7fb4ffb0605a3db2f8ca95d15a9'}
});
const gitBlob=bytes=>crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
function demand(ok){if(!ok)throw Error('QA HISTORICAL BLOCKED: corrupt/missing pinned reference')}
function byteFile(base,relative,expected,maxBytes=131072){
  demand(/^[a-f0-9]{40}$/.test(expected)&&path.isAbsolute(base));
  const file=path.join(base,relative),stat=fs.lstatSync(file);
  demand(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1&&stat.size>0&&stat.size<=maxBytes);
  // A symlinked parent would bypass lstat of the leaf.
  demand(fs.realpathSync.native(file)===file);
  const before=fs.statSync(file),bytes=fs.readFileSync(file),after=fs.statSync(file);
  demand(bytes.length===before.size&&before.dev===after.dev&&before.ino===after.ino&&
   before.size===after.size&&before.mtimeMs===after.mtimeMs&&gitBlob(bytes)===expected);
  return bytes;
}
function historicalBytes(key,base=directory){
  demand(Object.hasOwn(refs,key));const ref=refs[key];
  return byteFile(base,ref.name,ref.blob);
}
function snapshot(base=directory){
  const data=JSON.parse(byteFile(base,'commit-blobs.json',INDEX_BLOB).toString('utf8'));
  demand(data.schema===1&&data.history.baseline==='a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a'&&
   data.history.original==='ae3b4df53c25557f28b4a25ccb65adc2abdff639'&&
   data.history.c7==='c7e71327d69bfe87f622ff6293422e2e15332a11');
  demand(Object.keys(data.baselineFiles).length===66&&Object.keys(data.originalFiles).length===66&&
   Object.keys(data.c7SuiteBlobs).length===23);
  const checked=(x,absent=false)=>Object.values(x).every(v=>v===null&&absent||/^[a-f0-9]{40}$/.test(v||''));
  demand(checked(data.baselineFiles,true)&&checked(data.originalFiles)&&checked(data.c7SuiteBlobs));
  demand(JSON.stringify(Object.keys(data.baselineFiles))===JSON.stringify(Object.keys(data.originalFiles)));
  return data;
}
function c7Suite(suite,manifest,root=path.resolve(__dirname,'../..'),base=directory){
  const index=snapshot(base);
  demand(Object.hasOwn(index.c7SuiteBlobs,suite)&&Object.hasOwn(manifest.cases,suite));
  const name='tools/e2e/'+suite+'.cjs',digest=manifest.files[name];
  demand(/^[a-f0-9]{64}$/.test(digest||''));
  const bytes=byteFile(root,name,index.c7SuiteBlobs[suite],2*1024*1024);
  demand(crypto.createHash('sha256').update(bytes).digest('hex')===digest);
  return bytes.toString('utf8');
}
module.exports={gitBlob,historicalBytes,snapshot,c7Suite};
