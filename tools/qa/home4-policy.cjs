'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const {verifyFile,canonicalPathMatches}=require('../qa-browser-identity.cjs');
const fail=phase=>{throw Object.assign(Error('HOME4_BLOCKED'),{phase})};
const demand=(ok,phase)=>{if(!ok)fail(phase)};
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
function json(file,digest){
 for(let at=file;;at=path.dirname(at)){demand(!fs.lstatSync(at).isSymbolicLink(),'json-redirection');if(at===path.dirname(at))break}
 demand(canonicalPathMatches(file,fs.realpathSync.native(file)),'json-canonical');
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const a=fs.fstatSync(fd,{bigint:true}),named=fs.lstatSync(file,{bigint:true});
  demand(a.isFile()&&a.nlink===1n&&a.ino!==0n&&a.size<=4n*1024n*1024n&&a.ino===named.ino&&a.dev===named.dev,'json-identity');
  const bytes=fs.readFileSync(fd),b=fs.fstatSync(fd,{bigint:true}),c=fs.lstatSync(file,{bigint:true});
  for(const meta of [b,c])demand(a.ino===meta.ino&&a.dev===meta.dev&&a.size===meta.size&&a.mtimeNs===meta.mtimeNs,'json-changed');
  demand(BigInt(bytes.length)===a.size,'json-size');
  if(digest!==undefined)demand(/^[a-f0-9]{64}$/.test(digest)&&hash(bytes)===digest,'json-pin');
  return JSON.parse(bytes.toString('utf8'));
 }finally{fs.closeSync(fd)}
}
function execution(env,pins){
 for(const [key,value] of Object.entries({GITHUB_ACTIONS:'true',GITHUB_REPOSITORY:'zaplikj30-ui/Zamerovac-android',GITHUB_ACTOR:'zaplikj30-ui',GITHUB_TRIGGERING_ACTOR:'zaplikj30-ui',GITHUB_REF:'refs/heads/main',GITHUB_EVENT_NAME:'workflow_dispatch',GITHUB_RUN_ATTEMPT:'1'}))demand(env[key]===value,'owner-main-manual-first-attempt');
 demand(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA||'')&&env.HOME4_APPROVED_MAIN_SHA===env.GITHUB_SHA,'event-sha');
 demand(/^[a-f0-9]{40}$/.test(pins.sourceSha||'')&&/^[a-f0-9]{40}$/.test(pins.validatorSha||''),'source-validator-pins');
 demand(/^[1-9][0-9]{0,19}$/.test(env.GITHUB_RUN_ID||''),'run-id');
 return {...pins,eventSha:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,attempt:1};
}
function executable(component){
 demand(component&&typeof component.entry==='string'&&!component.entry.includes('..')&&!path.isAbsolute(component.entry),'tool-entry');
 const file=path.join(component.root,component.entry),sha256=component.files?.[component.entry.replaceAll('\\','/')];
 demand(/^[a-f0-9]{64}$/.test(sha256||''),'tool-unverified');
 return verifyFile(file,{path:file,sha256,magic:process.platform==='win32'?'4d5a':'7f454c46'}).path;
}
function snapshot(root,expected,git){
 const run=args=>cp.execFileSync(git,['-c','core.hooksPath=/dev/null','-c','core.fsmonitor=false',...args],{cwd:root,encoding:'utf8',timeout:15000,windowsHide:true,maxBuffer:16*1024*1024});
 demand(run(['rev-parse','HEAD']).trim()===expected,'checkout-sha');
 demand(!run(['status','--porcelain','--untracked-files=all']).trim(),'checkout-dirty');
 const names=run(['ls-tree','-r','--name-only',expected]).trim().split('\n');
 const actual=[];function walk(dir,relative=''){for(const e of fs.readdirSync(dir,{withFileTypes:true})){if(relative===''&&e.name==='.git')continue;const n=relative?relative+'/'+e.name:e.name;demand(!e.isSymbolicLink(),'checkout-redirection');if(e.isDirectory())walk(path.join(dir,e.name),n);else actual.push(n)}}walk(root);
 demand(JSON.stringify(actual.sort())===JSON.stringify([...names].sort()),'checkout-ignored-or-extra');
 for(const name of names){
  const file=path.join(root,name),stat=fs.lstatSync(file);
  demand(stat.isFile()&&!stat.isSymbolicLink()&&stat.nlink===1,'checkout-file-identity');
  const expectedBytes=cp.execFileSync(git,['show',expected+':'+name],{cwd:root,timeout:15000,maxBuffer:32*1024*1024,windowsHide:true});
  demand(hash(fs.readFileSync(file))===hash(expectedBytes),'checkout-byte-change');
 }
 return hash(JSON.stringify(names));
}
function contentManifest(root,expected,git){
 const names=cp.execFileSync(git,['ls-tree','-r','--name-only',expected],{cwd:root,encoding:'utf8',timeout:15000}).trim().split('\n');
 const files={};for(const name of names)files[name]=hash(fs.readFileSync(path.join(root,name)));
 return files; // Only called immediately after snapshot verified all these bytes.
}
function exactCases(rows,required,optional=[]){
 demand(Array.isArray(rows)&&new Set(rows.map(r=>r.id)).size===rows.length,'quick-duplicate');
 demand(rows.length===required.length+optional.length&&rows.every(r=>required.includes(r.id)?r.status==='PASS':optional.includes(r.id)&&r.status==='NOT RUN'),'quick-case-registry');
 return {required:required.length,pass:required.length,fail:0,skip:0,optionalNotRun:optional.length};
}
function structuredCases(evidence,item,protocol){
 demand(evidence?.complete===true&&evidence.protocol===protocol&&Array.isArray(evidence.cases),'quick-protocol');
 demand(new Set(evidence.cases.map(r=>r.id)).size===evidence.cases.length,'quick-duplicate');
 const optional=item.windowsNotRun;
 demand(evidence.cases.every(r=>!optional.includes(r.id)||['SKIP','NOT RUN'].includes(r.status)),'optional-payload-executed');
 const rows=evidence.cases.filter(r=>!optional.includes(r.id)).concat(optional.map(id=>({id,status:'NOT RUN'})));
 return {counts:exactCases(rows,item.cases.filter(n=>!optional.includes(n)),optional),caseIdsSha256:hash(JSON.stringify(rows))};
}
function previewAllowed(){fail('I88-preview-release-mapping-unapproved')}
module.exports={fail,demand,hash,json,execution,executable,snapshot,contentManifest,exactCases,structuredCases,previewAllowed};
