'use strict';
const fs=require('node:fs');
const path=require('node:path');
const {test}=require('node:test');
const assert=require('node:assert/strict');
const workflowPath=path.join(__dirname,'..','.github','workflows','windows-fixture15-20261114.yml');
const source=fs.readFileSync(workflowPath,'utf8');

// These checks are source-only; they cannot establish Windows runtime safety.
// The complete workflow still requires independent review before activation.
const must=[
  "on:\n  push:\n    branches:\n      - 'qa/windows-fixture15-20261114-run'",
  "      - 'docs/qa/windows-fixture15-20261114.trigger'",
  'permissions:\n  contents: read',
  '  cancel-in-progress: false',
  "github.repository == 'zaplikj30-ui/Zamerovac-android'",
  "github.actor == 'zaplikj30-ui'",
  "github.triggering_actor == 'zaplikj30-ui'",
  "github.ref == 'refs/heads/qa/windows-fixture15-20261114-run'",
  "github.event_name == 'push'",
  'github.run_number == 1',
  'github.run_attempt == 1',
  'github.event.created == false',
  "github.event.head_commit.message == 'OWNER-APPROVED-WINDOWS-FIXTURE15-20261114'",
  'runs-on: [self-hosted, Windows, X64, zamerovac-qa]',
  'timeout-minutes: 15',
  "ZAMEROVAC_PYTHON: 'C:\\actions-runner\\tools\\Python313\\python.exe'",
  'if /i not "%QA_USER%"=="%COMPUTERNAME%\\ZamerovacQA" exit /b 1',
  'if not exist "C:\\actions-runner\\tools\\Python313\\python.exe" exit /b 1',
  'uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
  'persist-credentials: false',
  'submodules: false',
  'lfs: false',
  'ref: 6f98ceffff50d337f7c2999fed0e0878d20a582e',
  'ref: ae3b4df53c25557f28b4a25ccb65adc2abdff639',
  'if /i not "%ACTUAL_QA%"=="6f98ceffff50d337f7c2999fed0e0878d20a582e" exit /b 1',
  'if /i not "%ACTUAL_PRODUCT%"=="ae3b4df53c25557f28b4a25ccb65adc2abdff639" exit /b 1',
  'status --porcelain --untracked-files=all',
  'node -e "if(!process.version.startsWith(\'v26.13.\'))process.exit(1)"',
  'call tools\\qa-fixture-gate.cmd',
  'if errorlevel 1 exit /b 1',
  'if not errorlevel 0 exit /b 1',
];
function safe(s){
 return must.every(fragment=>s.includes(fragment))
  && /^on:\n  push:/m.test(s)
  && !/^  (workflow_dispatch|pull_request|schedule|repository_dispatch):/m.test(s)
  && !s.includes('--no-sandbox')
  && !s.includes('continue-on-error:')
  && !s.includes('ubuntu-latest')
  && !s.includes('npm install')
  && !s.includes('npm ci')
  && !s.includes('actions/checkout@v')
  && !s.includes('run: node tools/local-browser-qa')
  && (s.match(/uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/g)||[]).length===2
  && (s.match(/call tools\\qa-fixture-gate\.cmd/g)||[]).length===1
  && (s.match(/persist-credentials: false/g)||[]).length===2
  && (s.match(/submodules: false/g)||[]).length===2
  && (s.match(/lfs: false/g)||[]).length===2;
}
test('inert owner-only Windows fixture15 PREP workflow invariants',()=>{
 assert.equal(safe(source),true);
 assert.equal(fs.existsSync(path.join(__dirname,'..','docs','qa','windows-fixture15-20261114.trigger')),false);
});
test('all required guard removals and insecure modifications fail the source-only gate',()=>{
 for(const fragment of must){
  const mutated=source.split(fragment).join('REMOVED-NEGATIVE-CHECK');
  assert.notEqual(mutated,source,'missing expected guard: '+fragment);
  assert.equal(safe(mutated),false,'missing guard accepted: '+fragment);
 }
 for(const append of [
  '\n  workflow_dispatch:\n',
  '\n  pull_request:\n',
  '\n  schedule:\n',
  '\n      continue-on-error: true\n',
  '\n      run: npm install\n',
  '\n      run: node tools/local-browser-qa.cjs --smoke\n',
  '\n      runs-on: ubuntu-latest\n',
 ])assert.equal(safe(source+append),false,append);
 assert.equal(safe(source.replace('call tools\\qa-fixture-gate.cmd','call tools\\qa-fixture-gate.cmd\n          call tools\\qa-fixture-gate.cmd')),false);
});
