'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict');
const qa=require('../tools/qa-integrity.cjs');
const P='3886fcf80213e4693464d3f30104885c1c58f53e';
const V='b'.repeat(40),E='c'.repeat(40);
function approved(){
  return {
    ZAMEROVAC_QA_MODE:'cloud', ZAMEROVAC_CLOUD_TRUST:'trusted-host/change-detection',
    ZAMEROVAC_EXPECTED_PRODUCT_SHA:P,ZAMEROVAC_CLOUD_REVIEWED_V_SHA:V,
    ZAMEROVAC_CLOUD_EVENT_SHA:E,
    GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zaplikj30-ui/Zamerovac-android',
    GITHUB_ACTOR:'zaplikj30-ui',GITHUB_TRIGGERING_ACTOR:'zaplikj30-ui',
    GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_REF:'refs/heads/main',
    GITHUB_RUN_ATTEMPT:'1',RUNNER_OS:'Linux',RUNNER_ENVIRONMENT:'github-hosted',
    GITHUB_SHA:E,GITHUB_RUN_ID:'12345'
  };
}
test('cloud model uses reviewed P/V/E without inheriting HOME guard',()=>{
  assert.equal(qa.CLOUD_PRODUCT_SHA,P);
  assert.equal(qa.manifest.sourceSha,'c7e71327d69bfe87f622ff6293422e2e15332a11');
  const actual=qa.executionIdentity(V,approved());
  assert.deepEqual(actual,{runId:'12345',runAttempt:1,mode:'cloud',eventSha:E});
});
test('all owner/ref/event/P/V/E/sudo-trust negative mutations fail before any launch',()=>{
  const edits=[
    {GITHUB_ACTIONS:'false'},{GITHUB_REPOSITORY:'untrusted/fork'},
    {GITHUB_ACTOR:'foreign'},{GITHUB_TRIGGERING_ACTOR:'foreign'},
    {GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REF:'refs/heads/test'},
    {GITHUB_RUN_ATTEMPT:'2'},{RUNNER_OS:'Windows'},
    {RUNNER_ENVIRONMENT:'self-hosted'},{GITHUB_RUN_ID:'0'},
    {GITHUB_SHA:'d'.repeat(40)},{ZAMEROVAC_CLOUD_EVENT_SHA:'d'.repeat(40)},
    {ZAMEROVAC_CLOUD_REVIEWED_V_SHA:'d'.repeat(40)},
    {ZAMEROVAC_EXPECTED_PRODUCT_SHA:'d'.repeat(40)},
    {ZAMEROVAC_CLOUD_TRUST:'unmodifiable-by-test-identity'},
    {ZAMEROVAC_QA_MODE:'home'},{HOME4_APPROVED_MAIN_SHA:E},
    {HOME4_SOURCE_SHA:P},{HOME4_VALIDATOR_SHA:V}
  ];
  for(const edit of edits)assert.throws(()=>qa.executionIdentity(V,{...approved(),...edit}),
    undefined,JSON.stringify(edit));
  assert.throws(()=>qa.executionIdentity('unreviewed',approved()));
});
test('cloud original 67-pin manifest and all 23/96 content names are unchanged',()=>{
  assert.equal(Object.keys(qa.manifest.files).length,66);
  assert.equal(Object.keys(qa.manifest.sourceDependencies).length,1);
  assert.equal(Object.keys(qa.manifest.cases).length,23);
  const ids=Object.values(qa.manifest.cases).flat();
  assert.equal(ids.length,96);assert.equal(new Set(ids).size,96);
});
test('CLOUD-DIAG live approved P Q E rejects fork drift closed PR and API failure',async()=>{
 const {live}=require('../tools/qa-cloud-diag.cjs');
 const env={ZAMEROVAC_EXPECTED_PRODUCT_SHA:'p',ZAMEROVAC_CLOUD_REVIEWED_V_SHA:'q',ZAMEROVAC_CLOUD_EVENT_SHA:'e'};
 const data={'':{private:false},'git/ref/heads/main':{object:{sha:'e'}}};
 for(const [n,sha,ref] of [[150,'p','main'],[155,'9f733b24194a7870fa1377b256076bca7a71eb5a','implement/home4-p1-p4-20261115'],[156,'q','programator/cloud-qa-a1-a3-20261116']])data['pulls/'+n]={state:'open',head:{sha,repo:{full_name:'zaplikj30-ui/Zamerovac-android'}},base:{ref}};
 const request=rows=>async url=>({ok:true,json:async()=>rows[url.split('Zamerovac-android/')[1]]});
 await live(env,request(data));
 for(const edit of [r=>r[''].private=true,r=>r['git/ref/heads/main'].object.sha='wrong',r=>r['pulls/156'].head.sha='wrong',r=>r['pulls/150'].state='closed',r=>r['pulls/156'].head.repo.full_name='fork',r=>r['pulls/156'].base.ref='main']){const rows=structuredClone(data);edit(rows);await assert.rejects(live(env,request(rows)))}
 await assert.rejects(live(env,async()=>({ok:false})));
});
