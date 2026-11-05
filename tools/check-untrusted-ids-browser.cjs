'use strict';
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage();
  const hostile='x" onmouseover="window.idAttack=1';
  await page.addInitScript(hostile=>{
   localStorage.setItem('zamerovac-data',JSON.stringify({schema:1,prefs:{},records:[
    {id:hostile,title:'Podezřelá složka',kind:'folder',parentId:null},
    {id:'normal-folder',title:'Běžná složka',kind:'folder',parentId:null},
    {id:'normal-note',title:'Poznámka',kind:'note',parentId:hostile,text:'Přesná hodnota 12,34 mm',media:[]}
   ]}));
  },hostile);
  await page.goto('http://127.0.0.1:8765');
  const entry=page.locator('.entry').filter({hasText:'Podezřelá složka'});
  assert.equal(await entry.getAttribute('data-id'),hostile);
  assert.equal(await entry.locator('.entry-more').getAttribute('data-more'),hostile);
  assert.equal(await entry.getAttribute('onmouseover'),null);
  await entry.hover();assert.equal(await page.evaluate(()=>window.idAttack),undefined);
  await entry.locator('.entry-title').click();
  assert.equal(await page.locator('.crumb').last().getAttribute('data-nav'),hostile);
  assert.equal(await page.locator('.crumb').last().getAttribute('onmouseover'),null);
  assert.equal(await page.locator('.entry-title').innerText(),'Poznámka');
  await page.locator('.crumb').first().click();
  await page.locator('.entry').filter({hasText:'Běžná složka'}).locator('.entry-more').click();
  await page.click('#moveOne');
  assert.equal(await page.locator('#moveWhere option').filter({hasText:'Podezřelá složka'}).getAttribute('value'),hostile);
  assert.equal(await page.locator('#moveWhere option').filter({hasText:'Podezřelá složka'}).getAttribute('onmouseover'),null);
  await page.evaluate(hostile=>{noteActive={media:[hostile]};renderNoteAttachments()},hostile);
  assert.equal(await page.locator('#noteAttachments [data-open]').getAttribute('data-open'),hostile);
  assert.equal(await page.locator('#noteAttachments [data-open]').getAttribute('onmouseover'),null);
  const records=await page.evaluate(()=>state.records);
  assert.equal(records.find(r=>r.id==='normal-note').text,'Přesná hodnota 12,34 mm');
  assert.equal(records.find(r=>r.id==='normal-note').parentId,hostile);
  assert.equal(await page.evaluate(()=>window.idAttack),undefined);
  console.log('PASS untrusted record IDs remain data in list, navigation and move options');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
