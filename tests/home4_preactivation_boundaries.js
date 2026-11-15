'use strict';
// Read-only evidence for the proposal. No suite body, browser, process fault,
// workflow or HOME payload is executed. sourceSnapshot only reads local Git.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const integrity=require('../tools/qa-integrity.cjs');
const root=path.resolve(__dirname,'..');

test('current main cannot masquerade as the pinned 66-file PR121 product',()=>{
 const missing=[],changed=[];
 for(const [name,digest] of Object.entries(integrity.manifest.files)){
  const file=path.join(root,name);
  if(!fs.existsSync(file)){missing.push(name);continue}
  if(crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')!==digest)changed.push(name);
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
  .filter(name=>!fs.existsSync(path.join(root,'tools/e2e',name+'.cjs')));
 assert.deepEqual(absentSuites,['legacy-conflict-persistence','pending-audio']);
 assert.equal(absentSuites.reduce((n,name)=>n+integrity.manifest.cases[name].length,0),9);
 assert.throws(()=>integrity.sourceSnapshot(root),/expected exact PR121 source SHA/);
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
 assert.deepEqual(integrity.executionIdentity(validator,{...env,GITHUB_EVENT_NAME:'push',
  GITHUB_REF:'refs/heads/qa/browser-smoke-winfix-20261113-run'}),{runId:'12345678',runAttempt:1});
});
