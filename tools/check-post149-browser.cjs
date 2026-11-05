/* Synthetic files only. Actual canvas rendering, privacy, pagination and saved grips. */
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
 const page=await browser.newPage({viewport:{width:412,height:850}}),errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8765');
 const result=await page.evaluate(async()=>{
  const photo=async(color,w,h,type='image/png')=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,w,h);
   const blob=await new Promise(r=>c.toBlob(r,'image/png'));return storeMedia(new File([blob],'synthetic.png',{type}));
  };
  const main=await photo('#777777',1600,900),red=await photo('#ff0000',800,400),green=await photo('#00ff00',300,900),blue=await photo('#0000ff',900,200);
  const legacy=await photo('#ffff00',200,100,'application/octet-stream');
  const other=await storeMedia(new File(['unsupported data'],'synthetic.bin',{type:'video/unsupported'}));
  const record=newRecord('photo','Synthetic PDF');record.media=[main];record.width=1600;record.height=900;
  record.items=[{id:'precise',type:'dimension',a:{x:100,y:100},b:{x:600,y:100},measure:'1585,800001',unit:'mm'},
   {id:'private-a',type:'note',a:{x:300,y:350},text:'SOUKROMÁ POZNÁMKA A',media:[red,green,other]},
   {id:'private-b',type:'note',a:{x:800,y:400},text:'SOUKROMÁ POZNÁMKA B',media:Array(15).fill(blue)},
   {id:'text-only',type:'note',a:{x:900,y:700},text:'POUZE TEXTOVÁ POZNÁMKA\n'+('Dlouhý text poznámky. '.repeat(500)),media:[]},
   {id:'empty',type:'note',a:{x:950,y:700},text:'',media:[]},
   {id:'audio-first',type:'note',a:{x:950,y:750},text:'Neobrazová příloha první',audioMedia:[other],media:[other,green,legacy]}];
  state.records=[record];save();const before=JSON.stringify(record);
  const originalText=CanvasRenderingContext2D.prototype.fillText,texts=[];
  CanvasRenderingContext2D.prototype.fillText=function(text,...args){texts.push(String(text));return originalText.call(this,text,...args)};
  const scan=async(png)=>{
   const image=new Image();image.src='data:image/png;base64,'+png;await image.decode();
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const ctx=c.getContext('2d');ctx.drawImage(image,0,0);
   const data=ctx.getImageData(0,0,c.width,c.height).data,counts=[0,0,0];
   for(let i=0;i<data.length;i+=4){if(data[i]>245&&data[i+1]<10&&data[i+2]<10)counts[0]++;if(data[i]<10&&data[i+1]>245&&data[i+2]<10)counts[1]++;if(data[i]<10&&data[i+1]<10&&data[i+2]>245)counts[2]++}
   return {width:c.width,height:c.height,counts};
  };
  const options={dimensions:true,drawing:true,notes:false},publicPages=[];
  for await(const png of __customerExport.pages(record,options))publicPages.push(await scan(png));
  const publicTexts=texts.splice(0),privatePages=[],privatePng=[];
  for await(const png of __customerExport.pages(record,{...options,notes:true})){privatePages.push(await scan(png));privatePng.push(png)}
  if(JSON.stringify(record)!==before)throw Error('Export mutated original records');
  // Expensive/private attachment discovery must not happen at all when notes are off.
  const oldAsset=assetUrl,requested=[];assetUrl=async id=>{requested.push(id);return oldAsset(id)};
  for await(const png of __customerExport.pages(record,options)){}
  assetUrl=oldAsset;
  CanvasRenderingContext2D.prototype.fillText=originalText;
  return {publicPages,publicTexts,texts,privatePages,privatePng,requested,main,before};
 });
 assert.equal(result.publicPages.length,1);assert.deepEqual(result.publicPages[0].counts,[0,0,0]);
 assert(!result.texts.includes('Klikněte pro zadání textu'),'Editor placeholders do not appear in customer PDF');
 assert(!result.publicTexts.some(t=>t.includes('SOUKROMÁ')||t.includes('POUZE TEXTOVÁ')));
 assert(result.texts.includes('Poznámka 3'),'Text-only note has a separate section');
 assert(result.texts.some(t=>t.startsWith('POUZE TEXTOVÁ POZNÁMKA')));
 assert(result.texts.filter(t=>t.includes('Dlouhý')).length>50,'Long text is wrapped and paginated');
 assert.deepEqual(result.requested,[result.main],'No private attachments requested by default');
 assert(result.privatePages.length>=3,'Long notes continue in the same PDF');
 assert(result.privatePages[0].counts[0]>1000&&result.privatePages[0].counts[1]>1000,'Both photos in first note below main photo');
 assert(result.privatePages.reduce((n,p)=>n+p.counts[2],0)>100000,'All 15 blue attachments exported');
 assert(result.privatePages.every(p=>p.width<=2400&&p.height<=2400));
 fs.mkdirSync('/tmp/zamerovac-post149',{recursive:true});
 result.privatePng.forEach((png,i)=>fs.writeFileSync('/tmp/zamerovac-post149/page-'+i+'.png',Buffer.from(png,'base64')));
 // A failed/reopened image never renders annotations against a false background.
 await page.evaluate(()=>{
  window.__oldLoadPhoto=loadPhotoImage;window.__pendingImages=[];
  loadPhotoImage=()=>new Promise((resolve,reject)=>__pendingImages.push({resolve,reject}));
  openEditor(state.records[0]);window.__beforeLoad=JSON.stringify(current.items);
  window.__realDraw=drawItem;window.__drawCount=0;drawItem=(...args)=>{__drawCount++;return __realDraw(...args)};
  paint();
 });
 assert.equal(await page.evaluate(()=>__drawCount),0);
 const box=await page.locator('#drawCanvas').boundingBox();await page.mouse.click(box.x+100,box.y+100);
 assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),await page.evaluate(()=>__beforeLoad));
 await page.evaluate(()=>{const next=__pendingImages.length;openEditor(state.records[0]);__pendingImages[next].reject(new Error('Synthetic decode failure'))});
 await page.waitForFunction(()=>photoLoadFailed);
 assert.equal(await page.evaluate(()=>__drawCount),0,'Image error still cannot draw orphaned measurements');
 // Reopen with the same record, resolve new request first, then the stale one.
 await page.evaluate(async()=>{
  const next=__pendingImages.length;openEditor(state.records[0]);__pendingImages[next].resolve(await __oldLoadPhoto(current.media[0]));
 });
 await page.waitForFunction(()=>!!stageImg);
 const width=await page.evaluate(()=>photoSize.w);
 await page.evaluate(()=>__pendingImages[0].reject(new Error('Synthetic stale failure')));
 assert.equal(await page.evaluate(()=>photoSize.w),width);assert.equal(await page.evaluate(()=>photoLoadFailed),false);
 await page.evaluate(()=>{loadPhotoImage=__oldLoadPhoto;drawItem=__realDraw;setTool('select');view={zoom:1,dx:0,dy:0};current.items=[{id:'grip',type:'dimension',a:{x:90,y:110},b:{x:90,y:330},measure:'1585,800001',unit:'mm',hideUnit:false,text:''}];selected='grip';paint()});
 const saved=await page.evaluate(()=>JSON.stringify(current.items));
 for(let i=0;i<2;i++){
  await page.mouse.move(box.x+90,box.y+110);await page.mouse.down();await page.mouse.move(box.x+91,box.y+111);await page.mouse.up();
 }
 if(await page.locator('#modal').isVisible())await page.click('#okModal');
 assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),saved,'Jitter and double tap preserve exact geometry/value');
 await page.evaluate(()=>{commitEditor();exitEditor()});await page.reload();
 assert.equal(await page.evaluate(()=>JSON.stringify(state.records[0].items)),saved,'Exact values survive persistence and reload');
 assert.deepEqual(errors,[]);
 console.log('OK: post149 actual PDF canvases/privacy/all photos/multipage, delayed/failed photo, grip double tap and persistence');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
