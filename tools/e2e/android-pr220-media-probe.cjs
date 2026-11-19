'use strict';
const {spawnSync}=require('node:child_process');
const {randomUUID}=require('node:crypto');
const {mkdtempSync,writeFileSync,rmSync}=require('node:fs');
const {tmpdir}=require('node:os');
const path=require('node:path');
const {deflateSync}=require('node:zlib');
const assert=require('node:assert/strict');
const serial=process.env.ANDROID_SERIAL;
assert(/^emulator-\d+$/.test(serial||''));
const adb=(...args)=>spawnSync('adb',['-s',serial,...args],{encoding:'utf8',timeout:15000});
const dir=mkdtempSync(path.join(tmpdir(),'media-probe-'));
const filename='pr220-probe-'+randomUUID()+'.png';
const local=path.join(dir,filename);
const remote='/data/local/tmp/'+filename;
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
 const result=adb('shell','content','insert','--uri',uriRoot,'--bind','_display_name:s:'+filename,'--bind','mime_type:s:image/png','--bind','relative_path:s:Pictures/');
 const output=(result.stdout||'').trim();
 console.log(JSON.stringify({phase:'insert',exit:result.status,stdoutClass:output===''?'empty':/^Inserted /.test(output)?'insert-message':'other',stdoutLength:output.length,stderrClass:result.stderr?.trim()?'present':'empty'}));
 if(result.status!==0)process.exitCode=1;
 else{
  const lookup=adb('shell','content','query','--uri',uriRoot,'--projection','_id:_display_name');
  const ids=[...(lookup.stdout||'').matchAll(/^Row: \d+ (.+)$/gm)].map(x=>({
   id:/(?:^|, )_id=(\d+)(?:,|$)/.exec(x[1])?.[1],
   name:/(?:^|, )_display_name=([^,\r\n]+)(?:,|$)/.exec(x[1])?.[1]
  })).filter(x=>x.name===filename&&/^\d+$/.test(x.id||'')).map(x=>x.id);
  console.log(JSON.stringify({phase:'lookup',exit:lookup.status,matches:ids.length,rows:(lookup.stdout||'').split(/\r?\n/).filter(x=>x.startsWith('Row: ')).length,outputClass:lookup.stdout?.trim()?'nonempty':'empty'}));
  if(lookup.status!==0||ids.length!==1)process.exitCode=1;
  else{
   uri=uriRoot+'/'+ids[0];
   const write=adb('shell','sh','-c','content write --uri '+uri+' < '+remote);
   const query=adb('shell','content','query','--uri',uri);
   console.log(JSON.stringify({phase:'write-query',writeExit:write.status,queryExit:query.status,listed:query.stdout?.includes(filename)}));
   if(write.status!==0||query.status!==0||!query.stdout?.includes(filename))process.exitCode=1;
  }
 }
}finally{
 if(uri)adb('shell','content','delete','--uri',uri);
 adb('shell','rm','-f',remote);
 rmSync(dir,{recursive:true,force:true});
}
