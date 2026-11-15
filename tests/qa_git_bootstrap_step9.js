'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),cp=require('node:child_process'),os=require('node:os');
const yaml=fs.readFileSync(path.join(__dirname,'../.github/workflows/qa141-normal-third-owner-once.yml'),'utf8');
const block=yaml.split('      - name: Import only pinned')[1].split('      - name: Original exact')[0];
const program=/node -e "([^\n]+)"\n/.exec(block)[1];
const pins={EXPECTED_QA_SHA:'58b456c8ad3f603c57cf2ee8c6d784c76c2446fb',EXPECTED_REFERENCE_SHA:'7445ebc456e59ea735a377fc98c83542066a88b8',EXPECTED_PRODUCT_SHA:'ae3b4df53c25557f28b4a25ccb65adc2abdff639'};
function model(change={}){
 const env={...pins,GITHUB_RUN_ID:'123',GITHUB_WORKSPACE:'/approved',...change.env},messages=[],calls=[];
 const process={env,exitCode:0};
 vm.runInNewContext(program,{process,console:{log(s){messages.push(s)}},require(id){
  if(id==='node:path')return path;
  if(id==='node:fs')return {existsSync:p=>!change.missing||!p.includes('reference'),lstatSync:p=>({isDirectory:()=>true,isSymbolicLink:()=>change.link&&p.includes('reference')})};
  if(id==='node:child_process')return {execFileSync(cmd,args){calls.push(args);assert.equal(cmd,'git');
   const dir=args[1],op=args[2],sha=dir.includes('gate')?pins.EXPECTED_QA_SHA:dir.includes('reference')?pins.EXPECTED_REFERENCE_SHA:pins.EXPECTED_PRODUCT_SHA;
   if(change.gitError&&op==='rev-parse'){const e=Error('PRIVATE PATH TOKEN');e.status=128;e.stderr='PRIVATE';throw e}
   let answer=op==='rev-parse'?change.wrongHead&&dir.includes('reference')?'0'.repeat(40):sha:op==='status'?change.dirty&&dir.includes('product')?'?? changed':'':op==='cat-file'?args[4]==='ec8a2664d2d051f2ef40ee4b51564cc95dcb7485'?'blob':'commit':'';
   if(change.badType&&op==='cat-file')answer='tree';
   return answer+(change.crlf?'\r\n':'\n');
  }};
  throw Error(id);
 }});return {code:process.exitCode,messages,calls};
}
for(const crlf of [false,true])test('exact SHA/type comparisons accept '+(crlf?'CRLF':'LF'),()=>{const r=model({crlf});assert.equal(r.code,0);assert.deepEqual(r.messages,['QA141_LOCAL_GIT_REFERENCES=PASS'])});
for(const [name,change,stage] of [['wrong reference HEAD',{wrongHead:true},'reference-head'],['missing source even with cached objects',{missing:true},'reference-path'],['junction source',{link:true},'reference-path'],['dirty product',{dirty:true},'product-clean'],['Git nonzero status',{gitError:true},'qa-head'],['wrong object type',{badType:true},'reference-object'],['invalid run ID',{env:{GITHUB_RUN_ID:'../123'}},'context'],['invalid pin',{env:{EXPECTED_PRODUCT_SHA:'bad'}},'context']])
 test('reject '+name,()=>{const r=model(change);assert.equal(r.code,1);const line=r.messages.at(-1);assert(!line.includes('PRIVATE'));assert(!line.includes('/approved'));assert.equal(JSON.parse(line.slice('QA141_LOCAL_GIT_BLOCKED '.length)).stage,stage);if(stage.endsWith('head')||stage.endsWith('path')||stage==='context')assert(!r.calls.some(x=>x.includes('fetch')))});
test('old STEP9 has silent CMD pipelines; replacement keeps shallow and exact object checks',()=>{assert(!block.includes('| findstr'));assert(block.includes('--update-shallow'));assert(block.includes('qa-post-head'));assert(block.includes('bootstrap'));assert(yaml.includes('github.run_number == 1'));assert(yaml.includes('github.run_attempt == 1'));assert(!fs.existsSync(path.join(__dirname,'../docs/qa/qa141-authorized-normal-third-run.trigger')))});
test('real depth1 local Git import and cached-source negative controls',{skip:process.platform!=='linux'?'Linux Git integration; not Windows runtime':false},()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'qa-step9-')),seed=path.join(dir,'seed.git'),root=path.join(dir,'work');fs.mkdirSync(root);
 const git=(args,cwd)=>cp.execFileSync('git',args,{cwd,stdio:['ignore','pipe','pipe']});
 try{
  git(['init','--bare','--quiet',seed]);
  const repo=path.resolve(__dirname,'..');
  for(const [name,sha] of [['qa',pins.EXPECTED_QA_SHA],['reference',pins.EXPECTED_REFERENCE_SHA],['product',pins.EXPECTED_PRODUCT_SHA]]){
   git(['fetch','--quiet','--no-tags',repo,sha+':refs/heads/'+name],seed);
   git(['clone','--quiet','--depth=1','--branch',name,'file://'+seed,path.join(root,'qa141-'+(name==='qa'?'gate':name)+'-123')]);
  }
  const script=path.join(dir,'bootstrap.cjs');fs.writeFileSync(script,program);
  const run=(extra={})=>cp.spawnSync(process.execPath,[script],{env:{...process.env,...pins,GITHUB_RUN_ID:'123',GITHUB_WORKSPACE:root,...extra},encoding:'utf8'});
  assert.equal(run().status,0);
  const qa=path.join(root,'qa141-gate-123');assert.equal(git(['rev-parse','HEAD'],qa).toString().trim(),pins.EXPECTED_QA_SHA);assert.equal(git(['status','--porcelain'],qa).toString(),'');
  const ref=path.join(root,'qa141-reference-123');fs.renameSync(ref,ref+'-away');let r=run();assert.equal(r.status,1);assert(r.stdout.includes('reference-path'));fs.renameSync(ref+'-away',ref);
  fs.writeFileSync(path.join(ref,'dirty'),'synthetic');r=run();assert.equal(r.status,1);assert(r.stdout.includes('reference-clean'));fs.unlinkSync(path.join(ref,'dirty'));
  r=run({EXPECTED_PRODUCT_SHA:'0'.repeat(40)});assert.equal(r.status,1);assert(r.stdout.includes('product-head'));
  assert.equal(run().status,0);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});
