'use strict';
// Immutable reviewed profiles, never an environment-supplied expected digest.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const profiles=Object.freeze(require('./qa-browser-profiles.json'));
function fail(message){throw Object.assign(Error('HOME BLOCKED: '+message),{code:'HOME_BLOCKED'})}
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
 if((platform==='win32'?paths.normalize(canonical).toLowerCase():canonical)!==(platform==='win32'?paths.normalize(file).toLowerCase():file))fail('Chromium path resolves elsewhere');
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
module.exports={profiles,verifyBrowserIdentity,verifyFile};
