'use strict';
// Immutable reviewed profiles, never an environment-supplied expected digest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const profiles=Object.freeze(require('./qa-browser-profiles.json'));
function fail(message){throw Object.assign(Error('HOME BLOCKED: '+message),{code:'HOME_BLOCKED'})}
// Win32 native realpath may spell the same absolute path with an extended namespace
// prefix. Compare equivalent spellings only; do not accept changed target paths.
function canonicalPathMatches(file,canonical,platform=process.platform){
 if(platform!=='win32')return file===canonical;
 const norm=value=>path.win32.normalize(path.win32.toNamespacedPath(value)).toLowerCase();
 return norm(file)===norm(canonical);
}
// Evidence only: never used to authorize a path. Do not log path components,
// hashes of paths, account names, environment variables or raw OS errors.
function pathDiagnostic(file,canonical,platform){
 const paths=platform==='win32'?path.win32:path.posix;
 const namespace=value=>platform!=='win32'?'posix':
  /^\\\\\?\\UNC\\/i.test(value)?'extended-unc':/^\\\\\?\\[a-z]:\\/i.test(value)?'extended-dos':
  /^\\\?\?\\/.test(value)?'nt':/^\\\\\.\\/.test(value)?'device':
  /^[a-z]:[\\/]/i.test(value)?'dos':/^\\\\/.test(value)?'unc':'other';
 const parts=value=>{
  const normalized=platform==='win32'?paths.normalize(paths.toNamespacedPath(value)).toLowerCase():value;
  const root=paths.parse(normalized).root;
  return {root,components:normalized.slice(root.length).split(platform==='win32'?/[\\/]/:/\//).filter(Boolean)};
 };
 const a=parts(file),b=parts(canonical),different=[];
 for(let i=0;i<Math.max(a.components.length,b.components.length);i++)if(a.components[i]!==b.components[i])different.push(i);
 const d={schema:1,platform,node:process.versions.node,inputNamespace:namespace(file),nativeNamespace:namespace(canonical),
  comparison:{equivalent:canonicalPathMatches(file,canonical,platform),rootSame:a.root===b.root,
   componentCounts:[a.components.length,b.components.length],leafSame:a.components.at(-1)===b.components.at(-1),
   differentComponents:different.slice(0,16),truncated:different.length>16,
   shortNameInputComponents:a.components.flatMap((s,i)=>/~[0-9]+(?:\.|$)/.test(s)?[i]:[]).slice(0,16)},
  portable:{available:false},fileIdentity:{available:false}};
 try{
  const portable=fs.realpathSync(file);
  d.portable={available:true,namespace:namespace(portable),inputEquivalent:canonicalPathMatches(file,portable,platform),
   nativeEquivalent:canonicalPathMatches(canonical,portable,platform)};
 }catch{} // A failed diagnostic must still report the original BLOCKED.
 try{
  const input=fs.lstatSync(file,{bigint:true}),resolved=fs.lstatSync(canonical,{bigint:true});
  // Some filesystems do not expose a useful file ID. Do not call zero a match.
  if(input.ino!==0n&&resolved.ino!==0n)d.fileIdentity={available:true,same:input.dev===resolved.dev&&input.ino===resolved.ino,
   regular:input.isFile()&&resolved.isFile(),singleLink:input.nlink===1n&&resolved.nlink===1n};
 }catch{}
 return d;
}
function verifyFile(file,profile,platform=process.platform){
 const paths=platform==='win32'?path.win32:path.posix;
 if(!profile||typeof file!=='string'||file!==profile.path||!paths.isAbsolute(file))fail('unapproved Chromium path/platform');
 // Check every component: no symlink/junction/reparse redirection. Node realpath
 // resolves Windows junctions too; exact normalized path must remain identical.
 for(let current=file;;current=paths.dirname(current)){
  const stat=fs.lstatSync(current);
  if(stat.isSymbolicLink())fail('redirected Chromium path');
  if(current===paths.dirname(current))break;
 }
 const canonical=fs.realpathSync.native(file);
 if(!canonicalPathMatches(file,canonical,platform)){
  let diagnostic={schema:1,available:false};
  try{diagnostic=pathDiagnostic(file,canonical,platform)}catch{}
  fail('Chromium path resolves elsewhere; pathDiagnostic='+JSON.stringify(diagnostic));
 }
 const fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  const before=fs.fstatSync(fd),named=fs.lstatSync(file);
  if(!before.isFile()||before.nlink!==1||before.dev!==named.dev||before.ino!==named.ino)fail('Chromium must be one regular non-linked file');
  const hash=crypto.createHash('sha256'),block=Buffer.alloc(1024*1024),magic=Buffer.alloc(4);
  fs.readSync(fd,magic,0,4,0);
  if(!magic.toString('hex').startsWith(profile.magic))fail('Chromium executable format mismatch (wrapper forbidden)');
  let offset=0,n;
  while((n=fs.readSync(fd,block,0,block.length,offset))>0){hash.update(block.subarray(0,n));offset+=n}
  const after=fs.fstatSync(fd);
  if(before.size!==after.size||before.mtimeMs!==after.mtimeMs||hash.digest('hex')!==profile.sha256)fail('Chromium bytes/hash changed or unapproved');
  const last=fs.lstatSync(file);
  if(last.dev!==before.dev||last.ino!==before.ino||last.size!==before.size||last.mtimeMs!==before.mtimeMs)fail('Chromium replaced during verification');
  return {path:file,sha256:profile.sha256,size:before.size,dev:before.dev,ino:before.ino,mtimeMs:before.mtimeMs};
 }finally{fs.closeSync(fd)}
}
function verifyBrowserIdentity(file){
 try{return verifyFile(file,profiles[process.platform])}
 catch(e){if(e.code==='HOME_BLOCKED')throw e;fail('Chromium identity unavailable: '+e.message)}
}
module.exports={profiles,verifyBrowserIdentity,verifyFile,canonicalPathMatches};
