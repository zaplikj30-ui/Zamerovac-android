'use strict';
// Model disk CAS only. The Java implementation, signatures and TLS have separate native integration tests.
module.exports=async function nativeStorage(page){await page.addInitScript(()=>{
 localStorage.setItem('zamerovac-last-seen-app-version','1.2.152-test');window.syntheticDisk='';window.syntheticCopies=0;window.syntheticWriteFailure=false;
 window.Native={getAppVersion:()=> '1.2.152-test',getSyncDeviceId:()=> '11111111-1111-4111-8111-111111111111',configure:()=>{},loadData:()=>syntheticDisk,saveDataChecked:(text,expected)=>{if(syntheticWriteFailure)return JSON.stringify({ok:false,error:'synthetic disk full'});if(expected!==syntheticDisk)return JSON.stringify({ok:false,current:syntheticDisk});syntheticDisk=text;return '{"ok":true}'},resolveSyncConflict:(local,remote)=>{const l=JSON.parse(local);return JSON.stringify({winner:'remote',copy:{...l,id:'synthetic-own-copy-'+(++syntheticCopies),conflictOf:l.id,conflict:true,title:l.title+' (konflikt synchronizace)',conflictSource:'synthetic-fixture-'+syntheticCopies}});}};
 });await page.reload();};
