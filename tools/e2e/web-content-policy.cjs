'use strict';
const fs=require('node:fs'),path=require('node:path');
const {suite,assert,createCanvas,tool,drag,editSelected}=require('./harness.cjs');
const nativeStorage=require('./native-storage-fixture.cjs');
const source=fs.readFileSync('app/src/main/java/cz/zamerovac/app/WebContentPolicy.java','utf8'),csp=source.match(/APP_CSP="([^"]+)"/)[1],mediaCsp=source.match(/MEDIA_CSP="([^"]+)"/)[1];
suite('web-content-policy',async run=>{
 await run('native-csp-blocks-injected-scripts-media-and-frames-keeps-real-drawing',async({page})=>{
  await nativeStorage(page);
  await page.route('https://appassets.androidplatform.net/**',async route=>{
   const url=new URL(route.request().url());if(!url.pathname.startsWith('/app/')){await route.fulfill({status:200,contentType:'application/octet-stream',headers:{'Content-Security-Policy':mediaCsp,'X-Content-Type-Options':'nosniff'},body:'window.mediaExecuted=true; window.stolen=Native.loadData()'});return;}
   const name=url.pathname.slice(5);if(name.includes('..')){await route.fulfill({status:403,body:''});return;}
   const filename=path.join('app/src/main/assets',name),type=name.endsWith('.js')?'application/javascript':name.endsWith('.css')?'text/css':'text/html';await route.fulfill({status:200,contentType:type,headers:{'Content-Security-Policy':csp,'X-Content-Type-Options':'nosniff'},body:fs.readFileSync(filename)});
  });
  await page.goto('https://appassets.androidplatform.net/app/index.html');await createCanvas(page,'CSP syntetický projekt');await tool(page,'dimension');await drag(page,{x:120,y:240},{x:420,y:300});await editSelected(page);await page.fill('#measureInput','1585,800001');await page.click('#okModal');const before=await page.evaluate(()=>syntheticDisk);
  await page.evaluate(()=>{
   window.cspViolations=[];document.addEventListener('securitypolicyviolation',event=>cspViolations.push(event.effectiveDirective));
   const inline=document.createElement('script');inline.textContent='window.inlineExecuted=true;window.stolen=Native.loadData()';document.head.append(inline);
   const media=document.createElement('script');media.src='/media/synthetic-script';document.head.append(media);
   const image=document.createElement('img');image.setAttribute('onerror','window.attributeExecuted=true;window.stolen=Native.loadData()');image.src='data:image/png;base64,invalid';document.body.append(image);
   const remote=document.createElement('iframe');remote.src='https://evil.invalid/customer-data';document.body.append(remote);
   const srcdoc=document.createElement('iframe');srcdoc.srcdoc='<script>parent.srcdocExecuted=true;parent.stolen=parent.Native.loadData()<\/script>';document.body.append(srcdoc);
  });
  await page.waitForFunction(()=>cspViolations.length>=3);await page.waitForTimeout(80);const result=await page.evaluate(()=>({inline:!!window.inlineExecuted,media:!!window.mediaExecuted,attribute:!!window.attributeExecuted,srcdoc:!!window.srcdocExecuted,stolen:window.stolen,disk:syntheticDisk,violations:cspViolations}));assert.equal(result.inline,false);assert.equal(result.media,false);assert.equal(result.attribute,false);assert.equal(result.srcdoc,false);assert.equal(result.stolen,undefined);assert.equal(result.disk,before);assert(result.violations.some(v=>v.startsWith('script-src')));assert(result.violations.includes('frame-src'));
  assert.equal(await page.evaluate(()=>current.items[0].measure),'1585,800001');
 });
});
