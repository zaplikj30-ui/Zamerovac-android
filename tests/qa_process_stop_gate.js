'use strict';
// Execute the actual CLI in a VM with stub filesystem/process observations.
// No child process, Windows call, Gradle or browser is launched by this model.
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const source=fs.readFileSync(path.join(__dirname,'../tools/local-qa.cjs'),'utf8');
function model({marker=false,unreadable=false,code=0,faultAt='first',markerAfter=Infinity,writeFailure=false}={}){
 const launches=[],output=[],written={};
 const processModel={argv:['node','local-qa.cjs','--native'],platform:'linux',getuid:()=>1000,execPath:'/synthetic-node',env:{}};
 const fakeFs={mkdirSync(){},existsSync(){return true},readdirSync(){return []},
  lstatSync(file){
   assert.equal(file,'/tmp/zamerovac-qa-process-tests-1000.blocked');
   if(unreadable)throw Object.assign(Error('PRIVATE_PATH'),{code:'EACCES'});
   if(marker||launches.length>=markerAfter)return {};
   throw Object.assign(Error('absent'),{code:'ENOENT'});
  },writeFileSync(file,value){if(writeFailure&&file.endsWith('.log'))throw Error('PRIVATE_PATH');written[path.basename(file)]=value}};
 vm.runInNewContext(source,{__dirname:'/synthetic-repo/tools',process:processModel,
  console:{log(...v){output.push(v.join(' '))},error(...v){output.push(v.join(' '))}},
  require(id){
   if(id==='node:fs')return fakeFs;
   if(id==='node:path')return path;
   if(id==='node:os')return {homedir:()=>'/synthetic-home'};
   if(id==='node:child_process')return {spawnSync(cmd,args){
    launches.push([cmd,...args]);
    const fault=faultAt==='first'?launches.length===1:args.includes('--version');
    return {status:fault?code:0,stdout:code===78?'PRIVATE_PATH_TOKEN_PID':'',stderr:''};
   }};
   throw Error('unexpected import');
  }},{timeout:1000});
 return {launches,output:output.join('\n'),exitCode:processModel.exitCode||0,
  report:JSON.parse(written['results.json']),logs:Object.entries(written).filter(([name])=>name.endsWith('.log')).map(([,value])=>value)};
}
test('known command completion and ordinary failure allow the remaining commands',()=>{
 for(const code of [0,1]){
  const r=model({code});assert(r.launches.length>2);
  assert(r.launches.some(args=>args.includes('Gradle')||args.includes('gradle')||args.includes(':app:testPreviewUnitTest')));
  assert.equal(r.exitCode,code);
 }
});
test('blocked child status stops all subsequent Node/Python/Gradle launches without retry',()=>{
 const r=model({code:78});assert.equal(r.exitCode,1);assert.equal(r.launches.length,1);
 assert(r.report.counts.FAIL>0);assert(r.output.includes('PROCESS_TESTS_BLOCKED_STOP_NO_RETRY'));
 assert(!r.output.includes('PRIVATE_PATH_TOKEN_PID'));
 assert(r.logs.every(value=>!value.includes('PRIVATE_PATH_TOKEN_PID')));
});
test('preexisting or unreadable quarantine blocks before even Python discovery',()=>{
 for(const observation of [{marker:true},{unreadable:true}]){
  const r=model(observation);assert.equal(r.exitCode,1);assert.equal(r.launches.length,0);
  assert(r.report.counts.FAIL>0);assert(!r.output.includes('PRIVATE_PATH'));
 }
});
test('Python discovery propagates blocked status without fallback or native launch',()=>{
 const r=model({code:78,faultAt:'python'});
 assert.equal(r.exitCode,1);assert.equal(r.launches.length,3);
 assert.equal(r.launches.filter(args=>args.includes('--version')).length,1);
 assert(!r.launches.some(args=>args.includes(':app:testPreviewUnitTest')));
});
test('exit zero with a retained marker cannot pass or launch the next command',()=>{
 const r=model({markerAfter:1});assert.equal(r.exitCode,1);assert.equal(r.launches.length,1);
 assert(r.output.includes('PROCESS_TESTS_BLOCKED_STOP_NO_RETRY'));
});
test('blocked diagnostic write failure still stops and never prints private error',()=>{
 const r=model({code:78,writeFailure:true});assert.equal(r.exitCode,1);assert.equal(r.launches.length,1);
 assert(r.output.includes('PROCESS_TESTS_BLOCKED_STOP_NO_RETRY'));assert(!r.output.includes('PRIVATE_PATH'));
});
