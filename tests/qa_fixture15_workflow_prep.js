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

const preflightCommands=[
 'git -C "%GITHUB_WORKSPACE%\\gate" status --porcelain --untracked-files=all >"%QA_STATUS%"',
 'git -C "%GITHUB_WORKSPACE%\\source" status --porcelain --untracked-files=all >"%PRODUCT_STATUS%"',
 'where node >nul',
 'node -e "if(!process.version.startsWith(\'v26.13.\'))process.exit(1)"',
 '"%ZAMEROVAC_PYTHON%" --version',
];
const checkPositive='if errorlevel 1 exit /b 1';
const checkNegative='if not errorlevel 0 exit /b 1';
function pairedZeroGuards(text){
 const lines=text.split(/\r?\n/).map(line=>line.trim());
 const gateIndex=lines.indexOf('call tools\\qa-fixture-gate.cmd');
 if(gateIndex<0)return false;
 return preflightCommands.every(cmd=>{
  const indices=lines.flatMap((line,i)=>line===cmd?[i]:[]);
  return indices.length===1&&indices[0]<gateIndex&&
   lines[indices[0]+1]===checkPositive&&lines[indices[0]+2]===checkNegative;
 }) && lines.every((line,i)=>line!==checkPositive||lines[i+1]===checkNegative);
}
// CMD semantics: IF ERRORLEVEL 1 means signed status >= 1;
// IF NOT ERRORLEVEL 0 means signed status < 0.
function modeledZeroExit(status){return !(status>=1)&&status>=0}

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
  && (s.match(/lfs: false/g)||[]).length===2
  && pairedZeroGuards(s);
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


test('all mandatory external preflights check exactly exit 0 before fixture gate',()=>{
 assert.equal(pairedZeroGuards(source),true);
 for(const command of preflightCommands){
  const originalLines=source.split(/\r?\n/);
  const index=originalLines.findIndex(line=>line.trim()===command);
  assert(index>=0,'missing mandatory preflight: '+command);
  // A missing or delayed negative-code check is unsafe even if a later gate fails.
  const mutation=originalLines.slice();
  assert.equal(mutation[index+1].trim(),checkPositive);
  assert.equal(mutation[index+2].trim(),checkNegative);
  mutation.splice(index+2,1);
  assert.equal(pairedZeroGuards(mutation.join('\n')),false,command);
  assert.equal(safe(mutation.join('\n')),false,command);
 }
});
test('signed nonzero exits STOP before gate, even with an empty redirected git status',()=>{
 const exits=[0,1,9009,-1,-1073741819];
 for(const command of preflightCommands){
  assert.equal(pairedZeroGuards(source),true);
  for(const code of exits){
   // Model the two actual consecutive CMD guards, not a Linux shell exit.
   const continueToFixture=modeledZeroExit(code);
   assert.equal(continueToFixture,code===0,command+' status '+code);
   if(command.includes('git -C')&&command.includes('status --porcelain')){
    const redirectedOutput=''; // Created by redirection even if git crashed.
    const cleanCheckoutConfirmed=continueToFixture&&redirectedOutput.length===0;
    assert.equal(cleanCheckoutConfirmed,code===0,'empty status file must not mask '+code);
   }
  }
 }
});
test('no lone positive-only errorlevel guards remain anywhere in workflow',()=>{
 const lines=source.split(/\r?\n/).map(line=>line.trim());
 for(let i=0;i<lines.length;i++)if(lines[i]===checkPositive)
  assert.equal(lines[i+1],checkNegative,'positive-only guard at source line '+(i+1));
});
