'use strict';
// Regression for #50: inspect actual canvas draw operations, not just JSON objects.
// Use only synthetic photos. The original APK 1.3.0 produces subpixel lines/text.
const fs=require('node:fs'),path=require('node:path');
const {suite,assert,chooseFiles,tool,drag,editSelected}=require('./harness.cjs');
async function visual(page){
 return page.evaluate(()=>{
  const c=document.querySelector('.gallery-img');
  if(!c)return null;
  const density=c.width/Math.max(1,c.getBoundingClientRect().width);
  const samples=window.__galleryVisualSamples||[];
  return {dimensions:{cssWidth:c.getBoundingClientRect().width,pixels:c.width,density},
   texts:samples.filter(x=>x.type==='text'),
   lines:samples.filter(x=>x.type==='stroke'&&x.color==='#f7dc27')};
 });
}
(async()=>suite('gallery-visual',async test=>{
 await test('gallery_text_and_lines_remain_sharp_at_real_screen_scale',async({page,step,directory})=>{
  await page.setViewportSize({width:412,height:850});
  // Large synthetic photo forces scaling down to mobile size.
  const buffer=Buffer.from(await page.evaluate(()=>{
   const canvas=document.createElement('canvas');canvas.width=3600;canvas.height=2400;
   const c=canvas.getContext('2d');c.fillStyle='#777';c.fillRect(0,0,3600,2400);
   c.fillStyle='#999';c.fillRect(300,250,1500,950);return canvas.toDataURL('image/png').split(',')[1];
  }),'base64');
  await step('Upload high-resolution image and draw a precise measurement through UI',async()=>{
   await chooseFiles(page,'#galleryBtn',{name:'visual-fixture.png',mimeType:'image/png',buffer});
   await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
   await tool(page,'dimension');
   const {a,b}=await page.evaluate(()=>({
    a:{x:view.dx+photoSize.w*view.zoom*.25,y:view.dy+photoSize.h*view.zoom*.45},
    b:{x:view.dx+photoSize.w*view.zoom*.75,y:view.dy+photoSize.h*view.zoom*.55}
   }));
   await drag(page,a,b);await editSelected(page);
   await page.fill('#measureInput','1250,5');await page.selectOption('#measureUnit','mm');
   await page.click('#okModal');
  });
  const before=await page.evaluate(()=>JSON.stringify(current.items));
  await step('Capture real rasterized line width and text height at 1x',async()=>{
   await page.evaluate(()=>{
    window.__galleryVisualSamples=[];
    const proto=CanvasRenderingContext2D.prototype;
    const text=proto.fillText,stroke=proto.stroke;
    proto.fillText=function(value,...args){
     if(this.canvas.classList?.contains('gallery-img')){
      const font=Number((this.font.match(/([\d.]+)px/)||[])[1])||0;
      const density=this.canvas.width/Math.max(1,this.canvas.getBoundingClientRect().width);
      window.__galleryVisualSamples.push({type:'text',value:String(value),
       pixelHeight:font*this.getTransform().a/density});
     }
     return text.call(this,value,...args);
    };
    proto.stroke=function(...args){
     if(this.canvas.classList?.contains('gallery-img')){
      const density=this.canvas.width/Math.max(1,this.canvas.getBoundingClientRect().width);
      window.__galleryVisualSamples.push({type:'stroke',color:String(this.strokeStyle),
       pixelWidth:this.lineWidth*this.getTransform().a/density});
     }
     return stroke.apply(this,args);
    };
   });
   await page.click('#editorBack');
   await page.click('#browseGallery');
   await page.waitForFunction(()=>document.querySelector('.gallery-img')?.width>2 &&
     window.__galleryVisualSamples?.some(s=>s.type==='text'&&s.value.includes('1250,5')));
   const stats=await visual(page);
   const label=stats.texts.find(s=>s.value.includes('1250,5'));
   assert(label&&label.pixelHeight>=12,'Measurement must render at >=12 screen pixels, got '+label?.pixelHeight);
   assert(stats.lines.some(s=>s.pixelWidth>=1.5),'Dimension stroke must be >=1.5 screen pixels');
   const canvas=page.locator('.gallery-img');await canvas.screenshot({path:path.join(directory,'gallery-fit.png')});
  });
  await step('Zoom changes geometry, not line thickness or font pixels, and must never modify the record',async()=>{
   await page.locator('.gallery-img').dblclick({position:{x:190,y:300}});
   await page.waitForTimeout(170);
   let stats=await visual(page);
   let label=stats.texts.filter(s=>s.value.includes('1250,5')).at(-1);
   assert(label&&label.pixelHeight>=12,'Zoomed label must be freshly rasterized and readable');
   assert(stats.lines.some(s=>s.pixelWidth>=1.5),'Zoomed dimension strokes must remain visible');
   assert.equal(await page.evaluate(()=>JSON.stringify(state.records.find(x=>x.kind==='photo')?.items)),before,'Gallery is strictly read-only');
   await page.locator('.gallery-img').screenshot({path:path.join(directory,'gallery-zoom.png')});
  });
  await page.locator('.gallery-top [data-action="edit"]').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),before,'Return to editor preserves exact measurements');
 });
}))().catch(e=>{console.error(e);process.exitCode=1});
