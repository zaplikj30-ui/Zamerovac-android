'use strict';
// Read-only evidence for the proposal. No suite body, browser, process fault,
// workflow or HOME payload is executed. sourceSnapshot only reads local Git.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const vm=require('node:vm'),{execFileSync}=require('node:child_process');
const historical='a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a';
const read=name=>execFileSync('git',['show',historical+':'+name],{cwd:path.resolve(__dirname,'..'),stdio:['ignore','pipe','pipe']});
const historicalManifest=JSON.parse(read('tools/qa-pr121-manifest.json'));
const context={module:{exports:{}},require:id=>id==='./qa-pr121-manifest.json'?historicalManifest:id.startsWith('.')?require(path.resolve(__dirname,'../tools',id)):require(id),process,Buffer};
vm.runInNewContext(read('tools/qa-integrity.cjs').toString(),context);
const integrity=context.module.exports;
const root=path.resolve(__dirname,'..');

test('current main cannot masquerade as the pinned 66-file PR121 product',()=>{
 const missing=[],changed=[];
 for(const [name,digest] of Object.entries(integrity.manifest.files)){
  let bytes;try{bytes=read(name)}catch{missing.push(name);continue}
  if(crypto.createHash('sha256').update(bytes).digest('hex')!==digest)changed.push(name);
 }
 assert.equal(Object.keys(integrity.manifest.files).length,66);
 assert.equal(Object.keys(integrity.manifest.cases).length,23);
 assert.equal(Object.values(integrity.manifest.cases).flat().length,96);
 assert.deepEqual(missing,[
  'app/src/main/assets/pending-audio.js',
  'tools/e2e/legacy-conflict-persistence.cjs',
  'tools/e2e/pending-audio.cjs',
  'tools/e2e/protected-data.cjs',
 ]);
 assert.equal(changed.length,15);
 const absentSuites=Object.keys(integrity.manifest.cases)
  .filter(name=>{try{read('tools/e2e/'+name+'.cjs');return false}catch{return true}});
 assert.deepEqual(absentSuites,['legacy-conflict-persistence','pending-audio']);
 assert.equal(absentSuites.reduce((n,name)=>n+integrity.manifest.cases[name].length,0),9);
 assert.notEqual(historical,integrity.manifest.sourceSha);
});

test('unchanged production browser validator blocks main manual dispatch',()=>{
 const validator='a3cc8eb3a14a9a6710664b73ba8a5c70ed1a340a';
 const env={GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zaplikj30-ui/Zamerovac-android',
  GITHUB_ACTOR:'zaplikj30-ui',GITHUB_TRIGGERING_ACTOR:'zaplikj30-ui',
  GITHUB_RUN_ATTEMPT:'1',GITHUB_RUN_ID:'12345678',
  GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',
  ZAMEROVAC_EXPECTED_QA_SHA:validator};
 assert.throws(()=>integrity.executionIdentity(validator,env),/unapproved owner/);
 // Positive control is the unchanged historical predicate only, never a run.
 assert.deepEqual(JSON.parse(JSON.stringify(integrity.executionIdentity(validator,{...env,GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/qa/browser-smoke-winfix-20261113-run'}))),{runId:'12345678',runAttempt:1});
});
