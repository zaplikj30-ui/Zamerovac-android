'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  await page.addInitScript(()=>{
   window.mapCalls=[];window.addressQueries=[];
   window.Native=new Proxy({loadData:()=>'',getAppVersion:()=> 'test',
    searchAddress:q=>window.addressQueries.push(q),openAddressMap:(lat,lon)=>window.mapCalls.push([lat,lon])},
    {get:(obj,key)=>key in obj?obj[key]:()=>{}});
  });
  await page.goto('http://127.0.0.1:8765');
  await page.click('#searchBtn');await page.click('#searchRuian');
  await page.fill('#ruianQuery','Jezernice 54');await page.click('#ruianFind');
  assert.deepEqual(await page.evaluate(()=>window.addressQueries),['Jezernice 54']);
  await page.evaluate(()=>window.onAddressCandidates(JSON.stringify({candidates:[
   {address:'Jezernice 54 <img src=x onerror="window.attacked=true">',score:100,lat:49.557,lon:17.618},
   {address:'Neplatné souřadnice',score:1,lat:null,lon:17}
  ]})));
  await page.locator('[data-candidate="0"]').click();
  assert.equal(await page.locator('iframe').count(),0);
  assert.equal(await page.locator('#addressMap img').count(),0);
  assert.equal(await page.evaluate(()=>window.attacked),undefined);
  assert.deepEqual(await page.evaluate(()=>window.mapCalls),[]);
  await page.click('#openAddressMap');
  assert.deepEqual(await page.evaluate(()=>window.mapCalls),[[49.557,17.618]]);
  await page.locator('[data-candidate="1"]').click();
  assert.match(await page.locator('#addressMap').innerText(),/nejsou dostupné platné souřadnice/);
  assert.equal(await page.locator('#openAddressMap').count(),0);
  assert.deepEqual(await page.evaluate(()=>window.mapCalls),[[49.557,17.618]]);
  await page.evaluate(()=>window.onAddressCandidates(JSON.stringify({candidates:[]})));
  assert.match(await page.locator('#ruianResults').innerText(),/není v RÚIAN nalezen/);
  console.log('PASS RÚIAN search, escaped results, explicit external map action and invalid coordinates');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
