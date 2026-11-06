'use strict';
const {suite,assert}=require('./harness.cjs');
const A='11111111-1111-4111-8111-111111111111',B='22222222-2222-4222-8222-222222222222';
suite('backup-history',async run=>{
 await run('offline-ui-two-histories-confirmation-and-network-exception',async({page})=>{
  const before=await page.evaluate(()=>JSON.stringify(state));await page.click('#back');await page.getByText('Historické zálohy',{exact:true}).click();assert.match(await page.locator('#historyStatus').innerText(),/Android/);await page.keyboard.press('Escape');assert.equal(await page.locator('#backupHistoryPanel').isVisible(),false);
  await page.evaluate(()=>{window.backupCalls=[];window.Native={backupHistoryControl:(command,path,allow)=>backupCalls.push({command,path,allow})};openZamerovacBackupHistory()});
  const path='backups/v2/devices/'+A+'/'+B+'.json';await page.evaluate(({A,B,path})=>onNativeBackupHistory(JSON.stringify({phase:'done',configured:true,busy:false,message:'Historie načtena',data:{deviceId:A,occupiedBytes:123456,histories:[{path,deviceId:A,deviceName:'Telefon',files:100,createdAt:'2026-11-05T10:00:00Z'},{path:path.replace(A,B),deviceId:B,deviceName:'<img onerror=alert(1)>',files:100,createdAt:'2026-11-05T10:00:01Z'}]}})),{A,B,path});assert.equal(await page.locator('#backupHistoryPanel img').count(),0);assert.equal(await page.getByText('Obnovit jako nové kopie',{exact:true}).count(),2);
  page.once('dialog',d=>d.dismiss());await page.getByText('Obnovit jako nové kopie',{exact:true}).first().click();assert.equal((await page.evaluate(()=>backupCalls)).some(c=>c.command==='restore'),false);
  page.once('dialog',d=>d.accept());await page.getByText('Obnovit jako nové kopie',{exact:true}).first().click();assert.deepEqual((await page.evaluate(()=>backupCalls)).at(-1),{command:'restore',path,allow:false});
  await page.evaluate(path=>onNativeBackupHistory(JSON.stringify({phase:'metered',configured:true,busy:false,message:'Čeká na neměřenou Wi-Fi',data:{command:'restore',path}})),path);page.once('dialog',d=>d.accept());await page.click('#historyAllowMetered');assert.deepEqual((await page.evaluate(()=>backupCalls)).at(-1),{command:'restore',path,allow:true});
  await page.evaluate(()=>onNativeBackupHistory(JSON.stringify({phase:'error',configured:true,busy:false,message:'Poškozená příloha; obnova nebyla provedena.'})));assert.match(await page.locator('#historyStatus').innerText(),/Poškozená/);assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
 });
});
