'use strict';
const fs=require('node:fs'),path=require('node:path');
const {test}=require('node:test'),assert=require('node:assert/strict');
const file=path.join(__dirname,'..','.github','workflows','windows-3try-20261114.yml');
const source=fs.readFileSync(file,'utf8');
const launch='node tools\\qa-fixture-attempts.cjs';
const qaSha='14d282c2254a99762cd8bce7e86ac2cea047e52d';
const product='ae3b4df53c25557f28b4a25ccb65adc2abdff639';
const required=[
 "on:\n  push:\n    branches:\n      - 'qa/windows-3try-20261114-v1-run'\n    paths:\n      - 'docs/qa/windows-3try-20261114.trigger'",
 'permissions:\n  contents: read','cancel-in-progress: false',
 "github.repository == 'zaplikj30-ui/Zamerovac-android'",
 "github.actor == 'zaplikj30-ui'","github.triggering_actor == 'zaplikj30-ui'",
 "github.ref == 'refs/heads/qa/windows-3try-20261114-v1-run'",
 "github.event_name == 'push'",'github.run_number == 1','github.run_attempt == 1',
 'github.event.created == false',
 "github.event.head_commit.message == 'OWNER-APPROVED-WINDOWS-3TRY-20261114-V1'",
 'runs-on: [self-hosted, Windows, X64, zamerovac-qa]',
 'timeout-minutes: 5',"ZAMEROVAC_PYTHON: 'C:\\actions-runner\\tools\\Python313\\python.exe'",
 'if /i not "%QA_USER%"=="%COMPUTERNAME%\\ZamerovacQA" exit /b 1',
 'uses: actions/checkout@11d5960a326750d5838078e36cf38b85af677262',
 'persist-credentials: false','submodules: false','lfs: false',
 'ref: '+qaSha,'ref: '+product,
 'if /i not "%ACTUAL_QA%"=="'+qaSha+'" exit /b 1',
 'if /i not "%ACTUAL_PRODUCT%"=="'+product+'" exit /b 1',
 'status --porcelain --untracked-files=all',
 'node -e "if(!process.version.startsWith(\'v26.13.\'))process.exit(1)"',
 launch,'if errorlevel 1 exit /b 1','if not errorlevel 0 exit /b 1',
];
const preflight=[
 'git -C "%GITHUB_WORKSPACE%\\gate" status --porcelain --untracked-files=all >"%QA_STATUS%"',
 'git -C "%GITHUB_WORKSPACE%\\source" status --porcelain --untracked-files=all >"%PRODUCT_STATUS%"',
 'where node >nul',
 'node -e "if(!process.version.startsWith(\'v26.13.\'))process.exit(1)"',
 '"%ZAMEROVAC_PYTHON%" --version',
];
function zeroGuard(text){
 const lines=text.split(/\r?\n/).map(x=>x.trim()),runIndex=lines.indexOf(launch);
 return runIndex>=0&&preflight.every(cmd=>{
  const at=lines.flatMap((line,i)=>line===cmd?[i]:[]);
  return at.length===1&&at[0]<runIndex&&
   lines[at[0]+1]==='if errorlevel 1 exit /b 1'&&
   lines[at[0]+2]==='if not errorlevel 0 exit /b 1';
 })&&lines.every((line,i)=>line!=='if errorlevel 1 exit /b 1'||
  lines[i+1]==='if not errorlevel 0 exit /b 1');
}
function safe(text){
 return required.every(x=>text.includes(x))&&zeroGuard(text)
 && (text.match(/node tools\\qa-fixture-attempts\.cjs/g)||[]).length===1
 && (text.match(/uses: actions\/checkout@11d5960a326750d5838078e36cf38b85af677262/g)||[]).length===2
 && (text.match(/persist-credentials: false/g)||[]).length===2
 && (text.match(/submodules: false/g)||[]).length===2
 && (text.match(/lfs: false/g)||[]).length===2
 && !/\n  (?:workflow_dispatch|pull_request|schedule|repository_dispatch):/.test(text)
 && !/ubuntu-latest|windows-latest|npm install|npm ci|--no-sandbox|continue-on-error:/.test(text)
 && !/qa\/windows-fixture15-20261114-run|call tools\\qa-fixture-gate\.cmd/.test(text)
 && !/chromium|assemblePreview|gradle |chmod |icacls |user mod/i.test(text);
}
test('only inert new owner RUN ref/marker, pinned QA + product, 5min and one job',()=>{
 assert.equal(safe(source),true);
 assert.equal(fs.existsSync(path.join(__dirname,'..','docs','qa','windows-3try-20261114.trigger')),false);
});
test('required guards, SHA and owner/run identity cannot be weakened',()=>{
 for(const fragment of required){
  const changed=source.replace(fragment,'REMOVED');
  assert.notEqual(changed,source,fragment);
  assert.equal(safe(changed),false,'removed guard accepted: '+fragment);
 }
 for(const attack of ['\n  workflow_dispatch:\n','\n  pull_request:\n','\n  schedule:\n',
   '\n      continue-on-error: true\n','\n    runs-on: ubuntu-latest\n',
   '\n      run: npm install\n','\n      run: chromium\n',
   '\n      run: call tools\\qa-fixture-gate.cmd\n'])
   assert.equal(safe(source+attack),false,attack);
 assert.equal(safe(source.replace(launch,launch+'\n          '+launch)),false);
});
test('all actual CMD preflight exit codes including negative must STOP before Node',()=>{
 assert(zeroGuard(source));
 for(const cmd of preflight){
  const lines=source.split(/\r?\n/);const i=lines.findIndex(s=>s.trim()===cmd);
  assert(i>=0);const tampered=[...lines];tampered.splice(i+2,1);
  assert.equal(zeroGuard(tampered.join('\n')),false,cmd);
  for(const status of [0,1,9009,-1,-1073741819]){
   const canRun=!(status>=1)&&status>=0;
   assert.equal(canRun,status===0,cmd+' status '+status);
  }
 }
});
