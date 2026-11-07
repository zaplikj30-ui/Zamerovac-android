'use strict';
// Complements #51 without changing its branch or renderer. Pixel assertions are
// deliberately mandatory: a drawing call alone does not prove visible ink.
const path=require('node:path');
const {suite,assert,chooseFiles,tool,drag,editSelected}=require('./harness.cjs');
suite('gallery-readability',async test=>{
 for(const fixture of [
  {photo:[1200,800],viewport:{width:412,height:850}},
  {photo:[6000,4000],viewport:{width:412,height:850}},
  {photo:[1600,4800],viewport:{width:1100,height:700}}
 ])await test('pixels_'+fixture.photo.join('x')+'_'+fixture.viewport.width,async({page,step,evidence,directory})=>{
  await page.setViewportSize(fixture.viewport);
  const buffer=Buffer.from(await page.evaluate(([w,h])=>{
   const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle='#666';x.fillRect(0,0,w,h);
   return c.toDataURL().split(',')[1];
  },fixture.photo),'base64');
  await chooseFiles(page,'#galleryBtn',{name:'synthetic.png',mimeType:'image/png',buffer});
  await page.waitForFunction(()=>screen==='editor'&&!!stageImg);
  await page.evaluate(()=>{prefs.color='#f7dc27';prefs.snapPoints=false;prefs.snapHorizontal=false;prefs.snapGrid=false;save()});
  await tool(page,'dimension');const points=await page.evaluate(()=>({
   a:{x:view.dx+photoSize.w*view.zoom*.2,y:view.dy+photoSize.h*view.zoom*.45},
   b:{x:view.dx+photoSize.w*view.zoom*.8,y:view.dy+photoSize.h*view.zoom*.55}
  }));await drag(page,points.a,points.b);await editSelected(page);
  await page.fill('#measureInput','1250,5');await page.selectOption('#measureUnit','mm');await page.click('#okModal');
  const saved=await page.evaluate(()=>JSON.stringify(current.items));
  await page.evaluate(()=>{
   window.__labelSamples=[];const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,...rest){
    const result=fill.call(this,text,x,y,...rest);
    if(this.canvas.classList.contains('gallery-img')&&String(text).includes('1250,5')){
     const m=this.measureText(text),t=this.getTransform();
     const a=t.transformPoint({x:x-m.actualBoundingBoxLeft,y:y-m.actualBoundingBoxAscent});
     const b=t.transformPoint({x:x+m.actualBoundingBoxRight,y:y+m.actualBoundingBoxDescent});
     window.__labelSamples.push({x:Math.floor(a.x),y:Math.floor(a.y),w:Math.ceil(b.x-a.x),h:Math.ceil(b.y-a.y),font:Number(this.font.match(/([\d.]+)px/)[1])*t.a});
    }return result;
   };
  });
  await page.click('#editorBack');await page.click('#browseGallery');
  await page.waitForFunction(()=>__labelSamples.length>0);
  for(const zoom of ['fit','zoom']){
   if(zoom==='zoom'){await page.locator('.gallery-img').dblclick();await page.waitForTimeout(180)}
   await step('Actual visible glyph ink and line pixels at '+zoom,async()=>{
    const stats=await page.evaluate(()=>{
     const c=document.querySelector('.gallery-img'),x=c.getContext('2d'),s=__labelSamples.at(-1);
     const ratio=c.getBoundingClientRect().width/c.width;
     const left=Math.max(0,s.x-1),top=Math.max(0,s.y-1),right=Math.min(c.width,s.x+s.w+1),bottom=Math.min(c.height,s.y+s.h+1);
     if(right<=left||bottom<=top)return {clipped:true};
     const p=x.getImageData(left,top,right-left,bottom-top);let count=0,minY=p.height,maxY=-1;
     for(let y=0;y<p.height;y++)for(let col=0;col<p.width;col++){
      const i=(y*p.width+col)*4;
      if(p.data[i]>180&&p.data[i+1]>150&&p.data[i+2]<100){count++;minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
     }
     // Scan the real canvas too; white grips cannot satisfy the yellow predicate.
     const all=x.getImageData(0,0,c.width,c.height).data;let yellow=0;
     for(let i=0;i<all.length;i+=4)if(all[i]>180&&all[i+1]>150&&all[i+2]<100)yellow++;
     return {fontCssPx:s.font*ratio,inkHeightCssPx:(maxY-minY+1)*ratio,inkPixels:count,yellowPixels:yellow,ratio};
    });
    evidence({fixture,zoom,...stats});
    await page.locator('.gallery-content').screenshot({path:path.join(directory,fixture.photo.join('x')+'-'+zoom+'.png')});
    assert(!stats.clipped,'Measurement label must be inside the gallery canvas');
    assert(stats.inkPixels>15,'Real yellow glyph pixels must exist, including on zoom');
    assert(stats.fontCssPx>=12,'Readable font >=12 CSS px; actual '+stats.fontCssPx);
    assert(stats.inkHeightCssPx>=8,'Real glyph ink must be >=8 screen px; actual '+stats.inkHeightCssPx);
    assert(stats.yellowPixels>100,'Real annotation strokes must be visible');
   });
  }
  await page.locator('.gallery-top [data-action="edit"]').click();
  assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),saved,'Gallery never edits geometry or exact data');
 });
}).catch(e=>{console.error(e);process.exitCode=1});
