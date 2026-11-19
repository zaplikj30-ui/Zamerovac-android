'use strict';
const {execFileSync,spawnSync}=require('node:child_process');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {deflateSync}=require('node:zlib');
const assert=require('node:assert/strict');
const serial=process.env.ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial||''));
const adb=(...args)=>spawnSync('adb',['-s',serial,...args],{encoding:'utf8',timeout:15000});
const dir=mkdtempSync(path.join(tmpdir(),'media-probe-'));
const local=path.join(dir,'pr220-probe.png');
const remote='/data/local/tmp/pr220-probe.png';
const uriRoot='content://media/external/images/media';
let uri;
try{
 // One fixed, synthetic PNG; no customer data or application package.
 const pixel=Buffer.from([0,255,0,0]);
 const crc=bytes=>{let c=-1;for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=(c>>>1)^((c&1)?0xedb88320:0)}return(c^(-1))>>>0};
 const chunk=(name,data)=>{const body=Buffer.concat([Buffer.from(name),data]);const n=Buffer.alloc(4),sum=Buffer.alloc(4);n.writeUInt32BE(data.length);sum.writeUInt32BE(crc(body));return Buffer.concat([n,body,sum])};
 const ihdr=Buffer.from('00000001000000010802000000','hex');
 writeFileSync(local,Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(pixel)),chunk('IEND',Buffer.alloc(0))]));
 const push=adb('push',local,remote);assert.equal(push.status,0,'ADB staging failed');
 const result=adb('shell','content','insert','--uri',uriRoot,'--bind','_display_name:s:pr220-probe.png','--bind','mime_type:s:image/png','--bind','relative_path:s:Pictures/');
 const output=(result.stdout||'').trim();
 uri=/^Inserted (content:\/\/media\/external\/images\/media\/\d+)$/.exec(output)?.[1];
 console.log(JSON.stringify({phase:'insert',exit:result.status,stdoutClass:uri?'expected-uri':output===''?'empty':/^Inserted /.test(output)?'other-insert':'other',stdoutLength:output.length,stderrClass:result.stderr?.trim()?'present':'empty'}));
 if(result.status!==0||!uri)process.exitCode=1;
 else{
  const write=adb('shell','sh','-c','content write --uri '+uri+' < '+remote);
  const query=adb('shell','content','query','--uri',uri);
  console.log(JSON.stringify({phase:'write-query',writeExit:write.status,queryExit:query.status,listed:query.stdout?.includes('pr220-probe.png')}));
  if(write.status!==0||query.status!==0||!query.stdout?.includes('pr220-probe.png'))process.exitCode=1;
 }
}finally{
 if(uri)adb('shell','content','delete','--uri',uri);
 adb('shell','rm','-f',remote);
 rmSync(dir,{recursive:true,force:true});
}
