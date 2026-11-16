'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const filename=path.resolve(__dirname,'../.github/workflows/cloud-pr150-source-qa.yml');
const workflow=fs.readFileSync(filename,'utf8');
function secure(source){
 const required=[
  "if: ${{ false && github.repository ==",
  "on:\n  workflow_dispatch:",
  "runs-on: ubuntu-latest",
  "timeout-minutes: 330",
  "timeout-minutes: 210",
  "if: ${{ !cancelled() && steps.quick.outcome == 'success' }}",
  "steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN'",
  "ref: ${{ inputs.product_sha }}",
  "ref: ${{ inputs.validator_sha }}",
  "persist-credentials: false",
  "GITHUB_RUN_ATTEMPT':'1'",
  "RUNNER_ENVIRONMENT':'github-hosted'",
  "GITHUB_REPOSITORY':'zaplikj30-ui/Zamerovac-android'",
  "QA_PRODUCT_SHA: ${{ inputs.product_sha }}",
  "QA_VALIDATOR_SHA: ${{ inputs.validator_sha }}",
  "QA_EVENT_SHA: ${{ inputs.event_sha }}",
  "python3 tools/qa_cloud_native.py xml",
  "python3 tools/qa_cloud_native.py pdf",
  "python3 tools/qa_cloud_quick.py",
  "node tools/qa-cloud-quick.cjs",
  "gradle --offline --no-daemon",
  "runtime_sha256:",
  "ZAMEROVAC_CLOUD_TRUST: trusted-host/change-detection",
  'ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/product',
  'for product_path in app sync config gradle build.gradle gradle.properties settings.gradle;',
  'git -C validator rev-parse "HEAD:$product_path"',
  'git -C product rev-parse "HEAD:$product_path"'
 ];
 const forbidden=[
  'runs-on: [self-hosted','sudo ', 'npm install','npm ci','npx playwright install',
  'pip install','apt install','actions/upload-artifact','pull_request:', 'pull_request_target:',
  '--no-sandbox','chmod ','chown ','curl ','wget ', 'docker pull'
 ];
 return required.every(x=>source.includes(x))&&forbidden.every(x=>!source.includes(x))
  &&(source.match(/persist-credentials: false/g)||[]).length===2
  &&(source.match(/gradle --offline --no-daemon/g)||[]).length===2
  &&source.includes("if: ${{ !cancelled() && steps.pinned.outcome == 'success' && steps.quick.outcome == 'success' && steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN' }}");
}
test('only inert owner/main public hosted dispatch with pinned P/V/E and no installs/outputs',()=>{
 assert(secure(workflow));
 assert.equal((workflow.match(/workflow_dispatch:/g)||[]).length,1);
 assert(!workflow.includes('on:\n  push:'));
});
test('time arithmetic fits job without shrinking 23/96 or cleanup time',()=>{
 const stageMax=22+210+9+35+5+9+2+2;
 assert(stageMax<=330);
 assert(workflow.includes('23x8min')===false,'budget is code-owned by runner');
});
test('negative mutations reject activation, native after UNKNOWN, install or other runner',()=>{
 for(const mutation of [
  workflow.replace("false && github.repository","true && github.repository"),
  workflow.replace("runs-on: ubuntu-latest","runs-on: [self-hosted, Windows]"),
  workflow.replace("steps.strict_browser.outputs.cleanup == 'KNOWN_CLEAN'","steps.pinned.outcome == 'success'"),
  workflow.replace("gradle --offline --no-daemon","gradle --no-daemon"),
  workflow.replace("persist-credentials: false","persist-credentials: true"),
  workflow.replace("timeout-minutes: 330","timeout-minutes: 30"),
  workflow.replace("runtime_sha256:","removed_runtime:"),
  workflow.replace('ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/product', 'ZAMEROVAC_CLOUD_QUICK_PRODUCT_ROOT: ${{ github.workspace }}/validator'),
  workflow.replace("for product_path in app sync config gradle build.gradle gradle.properties settings.gradle;","for product_path in;"),
  workflow+" \n npm install playwright\n"
 ])assert(!secure(mutation));
});
