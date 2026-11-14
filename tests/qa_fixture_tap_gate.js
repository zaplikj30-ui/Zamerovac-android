'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
const {spawnSync}=require('node:child_process');
const {copyGate}=require('./helpers/qa-fixture-checkout.cjs');
const gate=require('../tools/qa-fixture-tap.cjs');
const repo=path.resolve(__dirname,'..');
const names=Array.from(fs.readFileSync(path.join(__dirname,'home_qa_integrity.js'),'utf8')
 .matchAll(/^test\('([^']+)'/gm),match=>match[1]);
const success={status:0,signal:null,stderr:Buffer.alloc(0)};
function tap(){
 return 'TAP version 13\n'+names.map((name,i)=>`# Subtest: ${name}\nok ${i+1} - ${name}\n  ---\n  duration_ms: 1.25\n  type: 'test'\n  ...\n`).join('')+
  '1..15\n# tests 15\n# suites 0\n# pass 15\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n# duration_ms 100.25\n';
}
const evaluate=(text,state=success)=>gate.evaluateTap(Buffer.isBuffer(text)?text:Buffer.from(text),state);
function blocked(text,state=success){const report=evaluate(text,state);assert.equal(report.status,'BLOCKED');return report}

test('fixed whitelist agrees with all 15 reviewed fixture identities',()=>{
 assert.equal(names.length,15);assert.deepEqual(gate.caseNames,names);
 assert(Object.isFrozen(gate.caseNames));
});
test('complete LF, CRLF, mixed newlines and UTF-8 BOM evidence passes',()=>{
 for(const text of [tap(),tap().replaceAll('\n','\r\n'),'\ufeff'+tap(),tap().replace('# pass 15\n','# pass 15\r\n')]){
  const report=evaluate(text);assert.equal(report.status,'PASS');
  for(const key of ['tests','pass','fail','skipped'])assert.deepEqual(report.summary[key],{available:true,unique:true,integer:true,matches:true});
 }
});
test('every required summary key must occur exactly once with the correct integer',()=>{
 for(const [key,value] of [['tests',15],['pass',15],['fail',0],['skipped',0]]){
  const line=`# ${key} ${value}\n`;
  assert.deepEqual(blocked(tap().replace(line,'')).summary[key],{available:false,unique:false,integer:false,matches:false});
  assert.equal(blocked(tap()+line).summary[key].matches,false);
  assert.equal(blocked(tap()+`# ${key} 99\n`).summary[key].matches,false);
  for(const invalid of ['99','-1','NaN','15.0','015','1e1','15 extra',''])
   assert.equal(blocked(tap().replace(line,`# ${key} ${invalid}\n`)).summary[key].matches,false);
 }
});
test('per-key diagnostics distinguish missing, duplicate, malformed and wrong count evidence',()=>{
 const line='# tests 15\n';
 for(const [text,flags] of [[tap().replace(line,''),[false,false,false,false]],
  [tap()+line,[true,false,true,false]],
  [tap().replace(line,'# tests NaN\n'),[true,true,false,false]],
  [tap().replace(line,'# tests 14\n'),[true,true,true,false]]])
  assert.deepEqual(Object.values(blocked(text).summary.tests),flags);
});
test('15 ok lines alone cannot replace summaries, plan or actual child success',()=>{
 blocked(tap().split('1..15')[0]);
 blocked(tap().replace('1..15\n',''));
 blocked(tap().replace('1..15\n','1..14\n'));
 blocked(tap()+'1..15\n');
 for(const state of [{...success,status:1},{...success,status:null},{...success,status:'0'},
  {...success,signal:'SIGTERM'},{...success,error:Error('PRIVATE PATH')},
  {...success,stderr:Buffer.from('PRIVATE PATH')},{status:0}])blocked(tap(),state);
});
test('missing, extra, duplicate, renamed, reordered, failing and skipped cases block',()=>{
 const line=`ok 1 - ${names[0]}`;
 for(const replacement of ['',`not ok 1 - ${names[0]}`,`ok 1 - ${names[1]}`,`ok 2 - ${names[0]}`,
  `${line} # SKIP secret`,`${line} # TODO secret`,`${line} # EXPECTED FAILURE secret`,`${line} extra`,line+'\n'+line])
  blocked(tap().replace(line,replacement));
 blocked(tap()+`ok 16 - ${names[0]}\n`);
 blocked(tap()+'not ok 16 - PRIVATE PATH\n');
 blocked(tap()+`    ok 1 - ${names[0]}\n`);
 blocked(tap().replace(`# Subtest: ${names[0]}`,`# Subtest: PRIVATE PATH`));
 blocked(tap().replace(`# Subtest: ${names[0]}\n`,''));
});
test('bailout, cancelled/todo suites, hidden summaries and truncated diagnostics block',()=>{
 for(const change of [s=>s+'Bail out! PRIVATE PATH\n',s=>s.replace('# cancelled 0','# cancelled 1'),
  s=>s.replace('# todo 0','# todo 1'),s=>s.replace('# suites 0','# suites 1'),
  s=>s.replace('  ...\n',''),s=>s.replace('# tests 15\n','  # tests 15\n'),
  s=>s.replace('1..15\n','1..15\n# pass 15\n'),s=>s.replace('TAP version 13','TAP version 14'),
  s=>s.replace('# tests 15\n','').replace('  duration_ms: 1.25','  duration_ms: 1.25\n# tests 15')])blocked(change(tap()));
});
test('invalid encodings, NUL, oversized output and unsupported text fail closed',()=>{
 for(const bytes of [Buffer.from(tap(),'utf16le'),Buffer.from([0xff,0xfe]),
  Buffer.concat([Buffer.from(tap()),Buffer.from([0xc3,0x28])]),Buffer.from(tap()+'\0'),
  Buffer.alloc(gate.maxTapBytes+1,0x61)])blocked(bytes);
 blocked(tap().replace('\n','\r'));
 blocked(tap()+'PRIVATE PATH\n');
});
test('blocked output contains only constant labels, whitelisted names and booleans',()=>{
 const secret='C:\\Users\\PrivateAccount\\SecretFolder\\123456789.exe';
 const report=blocked(tap().replace(`ok 1 - ${names[0]}`,'not ok 1 - '+secret)+secret+'\n',
  {...success,status:1,stderr:Buffer.from(secret),error:Error(secret)});
 const log=gate.formatReport(report);
 assert(!log.includes(secret));assert(!log.includes('PrivateAccount'));assert(!log.includes('123456789'));
 const parsed=JSON.parse(log.slice('FIXTURE_GATE_BLOCKED '.length));
 assert.equal(parsed.nodeExitOk,false);
 for(const key of ['tests','pass','fail','skipped']){
  assert.deepEqual(Object.keys(parsed.summary[key]),['available','unique','integer','matches']);
  for(const value of Object.values(parsed.summary[key]))assert.equal(typeof value,'boolean');
 }
 assert.deepEqual(parsed.cases.map(c=>c.name),names);
 assert.equal(gate.formatReport(evaluate(tap())),'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
});

// Real Node TAP fixtures: no browser, product code or Windows processes.
test('real Node TAP child pass, fail, skip and todo evidence is classified correctly',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-tap-contract-'));
 try{
  // The outer node --test context must not serialize/skip the independent child
  // fixture. The production gate does not alter its inherited environment.
  const env={...process.env};delete env.NODE_TEST_CONTEXT;
  for(const mode of ['pass','fail','skip','todo']){
   const script="const {test}=require('node:test');\n"+names.map((name,i)=>
    `test(${JSON.stringify(name)},${i===0&&['skip','todo'].includes(mode)?JSON.stringify({[mode]:true})+',':''}()=>{${i===0&&mode==='fail'?"throw Error('PRIVATE FAILURE')":''}});`).join('\n');
   const file=path.join(dir,'fixture.cjs');fs.writeFileSync(file,script);
   const child=spawnSync(process.execPath,['--test','--test-reporter=tap',file],{env,maxBuffer:1024*1024,timeout:10000});
   assert.ifError(child.error);
   const report=gate.evaluateTap(child.stdout,child);
   assert.equal(report.status,mode==='pass'?'PASS':'BLOCKED',mode);
   if(mode==='pass')assert(!child.stdout.includes(Buffer.from('\r')),'Node emits LF TAP in this Linux runtime');
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
function runCli(child,args=[],supervised=true){
 let output='',launches=0,invocation;
 const module={exports:{}},modeledProcess={argv:['node','qa-fixture-worker.cjs',...args],execPath:process.execPath,
  platform:process.platform,ppid:42,env:{ZAMEROVAC_SUPERVISOR_PID:'42',ZAMEROVAC_SCOPE:process.platform==='win32'?'windows-private-job':'linux-pidfd-subreaper'},
  stdout:{write(value){output+=value}},exitCode:undefined};
 const requireModel=Object.assign(id=>{
  if(id==='node:child_process')return {spawnSync(...values){launches++;invocation=values;if(child instanceof Error)throw child;return child}};
  if(id==='./qa-fixture-tap.cjs')return gate;
  return require(id);
 },{main:module});
 if(!supervised)modeledProcess.env={};
 vm.runInNewContext(fs.readFileSync(path.join(repo,'tools/qa-fixture-worker.cjs'),'utf8'),{
  module,require:requireModel,__dirname:path.join(repo,'tools'),process:modeledProcess,Buffer,
 });
 return {output,exitCode:modeledProcess.exitCode,launches,invocation};
}
test('owned worker captures the actual exit code and invokes only the pinned 15-case suite without a shell',()=>{
 const result=runCli({...success,stdout:Buffer.from(tap())});
 assert.equal(result.exitCode,0);assert.equal(result.launches,1);
 assert.equal(result.output,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
 const [binary,args,options]=result.invocation;
 assert.equal(binary,process.execPath);
 assert.deepEqual(Array.from(args),['--test','--test-reporter=tap',path.join(repo,'tests/home_qa_integrity.js')]);
 assert.equal(options.cwd,repo);assert.equal(options.shell,false);
 assert.equal(options.maxBuffer,gate.maxTapBytes);assert(options.timeout>0&&options.timeout<=120000);
 assert.deepEqual(Array.from(options.stdio),['ignore','pipe','pipe']);
 for(const child of [{...success,status:1,stdout:Buffer.from(tap())},{...success,status:-1073741819,stdout:Buffer.from(tap())},
  {...success,signal:'SIGTERM',stdout:Buffer.from(tap())},{...success,stderr:Buffer.from('PRIVATE STDERR'),stdout:Buffer.from(tap())},
  {...success,stdout:Buffer.alloc(gate.maxTapBytes+1,0x61)},{...success,stdout:Buffer.from('PRIVATE RAW TAP')},
  {...success,stdout:Buffer.from(tap()),error:Error('PRIVATE EXEC ERROR')},Error('PRIVATE EXEC ERROR')]){
  const failure=runCli(child);assert.equal(failure.exitCode,1);assert(failure.output.startsWith('FIXTURE_GATE_BLOCKED '));
  assert(!failure.output.includes('PRIVATE'));
 }
 const extra=runCli({...success,stdout:Buffer.from(tap())},['PRIVATE ARG']);
 assert.equal(extra.exitCode,1);assert.equal(extra.launches,0);assert(!extra.output.includes('PRIVATE'));
 const unscoped=runCli({...success,stdout:Buffer.from(tap())},[],false);
 assert.equal(unscoped.exitCode,1);assert.equal(unscoped.launches,0);
});

test('retained Windows 15-ok evidence without the original summaries remains BLOCKED',()=>{
 const retained=fs.readFileSync(path.join(__dirname,'fixtures/windows-fixture-43524071686.txt'));
 const report=gate.evaluateTap(retained,success);
 assert.equal(report.status,'BLOCKED');assert.equal(report.planOk,false);
 for(const key of ['tests','pass','fail','skipped'])assert.equal(report.summary[key].available,false);
});

// This interpreter covers only the fixed adapter below; it is not cmd.exe.
function cmdContract(code){
 const source=fs.readFileSync(path.join(repo,'tools/qa-fixture-gate.cmd'),'utf8');
 const lines=source.trim().split(/\r?\n/);
 assert.equal(lines.shift(),'@echo off');assert.equal(lines.shift(),'node "%~dp0qa-fixture-gate.cjs"');
 assert(!source.toLowerCase().includes('%errorlevel%'),'no stale or environment-shadowed expansion');
 for(const line of lines){
  const check=/^if (not )?errorlevel ([0-9]+) exit \/b ([01])$/.exec(line);
  if(check){if((code>=Number(check[2]))!==Boolean(check[1]))return Number(check[3]);continue}
  assert.equal(line,'exit /b 0');return 0;
 }
 throw Error('adapter must return an explicit status');
}
test('CMD job adapter propagates zero only, including negative process and missing-node codes (model)',()=>{
 for(const [child,job] of [[0,0],[1,1],[7,1],[77,1],[9009,1],[-1,1],[-1073741819,1]])assert.equal(cmdContract(child),job);
});
test('real CLI launches Node and passes or blocks the whole synthetic checkout, then job adapter agrees',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-gate-chain-'));
 const env={...process.env};delete env.NODE_TEST_CONTEXT;
 try{
  copyGate(dir);
  for(const mode of ['pass','fail','skip','todo','exit-error']){
   const body="const {test}=require('node:test'); console.log('PRIVATE STDOUT PATH');\n"+names.map((name,i)=>
    `test(${JSON.stringify(name)},${i===0&&['skip','todo'].includes(mode)?JSON.stringify({[mode]:true})+',':''}()=>{${i===0&&mode==='fail'?"throw Error('PRIVATE RAW FAILURE')":''}});`).join('\n')+
    (mode==='exit-error'?"\nprocess.on('exit',()=>{process.exitCode=7});":'');
   fs.writeFileSync(path.join(dir,'tests/home_qa_integrity.js'),body);
   const child=spawnSync(process.execPath,[path.join(dir,'tools/qa-fixture-gate.cjs')],{env,timeout:15000,maxBuffer:1024*1024});
   assert.ifError(child.error);assert.equal(child.stderr.length,0);
   const expected=mode==='pass'?0:1;assert.equal(child.status,expected,mode);
   assert.equal(cmdContract(child.status),expected,mode);
   const output=child.stdout.toString();assert(!output.includes('PRIVATE'));assert(!output.includes(dir));
   if(mode==='pass')assert.equal(output,'WINDOWS_FIXTURE_15_PASS_0_FAIL_0_SKIP\n');
   else assert(output.startsWith('FIXTURE_GATE_BLOCKED '));
  }
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
