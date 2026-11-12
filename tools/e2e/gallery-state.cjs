'use strict';
const fs=require('node:fs'),path=require('node:path');
const {suite,assert,chooseFiles,tool,drag,editSelected}=require('./harness.cjs');
async function photo(page){
 const buffer=Buffer.from(await page.evaluate(()=>{
  const c=document.createElement('canvas');c.width=1200;c.height=800;
  const x=c.getContext('2d');x.fillStyle='#666';x.fillRect(0,0,c.width,c.height);return c.toDataURL().split(',')[1];
 }),'base64');
 await chooseFiles(page,'#galleryBtn',{name:'state.png',mimeType:'image/png',buffer});
 await page.waitForFunction(()=>!!stageImg);
 await tool(page,'dimension');await drag(page,{x:100,y:240},{x:450,y:320});await editSelected(page);
 await page.fill('#measureInput','1585,800001');await page.click('#okModal');
}
suite('gallery-state',async test=>{
 await test('render_is_read_only_even_during_nested_drawing_and_failure',async({page,evidence,directory})=>{
  await photo(page);
  await page.evaluate(()=>{
   // Nested fixture exercises the same renderer as saved detail photographs.
   current.items.push({id:'inset',type:'note',a:{x:180,y:200},media:current.media.slice(),
    text:'Detail mimo fotografii',insetX:850,insetY:790,insetWidth:250,insetRotation:25,
    detailItems:[{id:'nested',type:'dimension',a:{x:100,y:200},b:{x:900,y:500},measure:'987,000001',unit:'mm'}]});
   save();paint();
   window.editorRefs={current,view,ctx,photoSize,selected,editStack,redoStack,mode,stageImg,exporting:window.__exportingAnnotations};
   window.editorJSON=JSON.stringify({state,items:current.items,editStack,redoStack});window.observed=[];
   const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,...args){
    if(String(text).includes('987,000001')&&this.canvas!==stageCanvas){
     observed.push(Object.keys(editorRefs).every(key=>key==='exporting'?window.__exportingAnnotations===editorRefs[key]:
      ({current,view,ctx,photoSize,selected,editStack,redoStack,mode,stageImg})[key]===editorRefs[key]));
     if(window.failRender)throw Error('synthetic renderer failure');
    }
    return fill.call(this,text,...args);
   };
  });
  await page.click('#galleryMode');await page.waitForFunction(()=>observed.length>0);
  assert(await page.evaluate(()=>observed.every(Boolean)),'Gallery must never replace live editor state, even while drawing');
  await page.evaluate(()=>{failRender=true;document.querySelector('.gallery-img').dispatchEvent(new MouseEvent('dblclick',{bubbles:true}))});
  await page.waitForFunction(()=>document.querySelector('#toast').textContent.includes('nepodařilo'));
  assert(await page.evaluate(()=>Object.entries(editorRefs).every(([k,v])=>k==='exporting'?window.__exportingAnnotations===v:({current,view,ctx,photoSize,selected,editStack,redoStack,mode,stageImg})[k]===v)));
  assert.equal(await page.evaluate(()=>JSON.stringify({state,items:current.items,editStack,redoStack})),await page.evaluate(()=>editorJSON));
  await page.evaluate(()=>failRender=false);await page.click('.gallery-top [data-action="close"]');
  await page.click('#undo');await page.click('#editorMore');await page.locator('[data-extra="redo"]').click();await page.click('#editorMore');
  assert.equal(await page.evaluate(()=>current.items[0].measure),'1585,800001');
  await page.evaluate(()=>{observed=[];window.__customerExport.render(current,{notes:true,dimensions:true,drawing:true})});
  await page.waitForFunction(()=>observed.length>0);assert(await page.evaluate(()=>observed.every(Boolean)),'Customer export also leaves live editor state untouched');
  await page.evaluate(()=>{
   const fill=CanvasRenderingContext2D.prototype.fillText;
   CanvasRenderingContext2D.prototype.fillText=function(text,x,y,max){
    const result=fill.call(this,text,x,y,max);
    if(text==='Detail mimo fotografii'&&this.canvas!==stageCanvas){
     const p=this.getTransform().transformPoint({x,y}),m=this.measureText(text);
     window.exportCaption={x:p.x,y:p.y,w:Math.min(m.width,max||m.width),h:parseFloat(this.font.match(/[\d.]+px/)[0])};
    }return result;
   };
  });
  const exportBefore=await page.evaluate(()=>JSON.stringify({state,view,selected,editStack,redoStack}));
  await page.click('#editorTopMenu');await page.getByText('Exportovat obrázek nebo PDF',{exact:true}).click();
  const downloadPromise=page.waitForEvent('download');await page.click('#exportPng');
  const output=path.join(directory,'rotated-inset-with-caption.png');await(await downloadPromise).saveAs(output);
  const png=await page.evaluate(async data=>{
   const image=new Image();image.src=data;await image.decode();
   const c=document.createElement('canvas');c.width=image.width;c.height=image.height;const x=c.getContext('2d');x.drawImage(image,0,0);
   const s=exportCaption,left=Math.floor(s.x-s.w/2),top=Math.floor(s.y-s.h/2);
   if(left<0||top<0||s.x+s.w/2>=c.width||s.y+s.h/2>=c.height)return {clipped:true};
   const bytes=x.getImageData(left,top,Math.ceil(s.w),Math.ceil(s.h)).data;let yellow=0;
   for(let i=0;i<bytes.length;i+=4)if(bytes[i]>180&&bytes[i+1]>150&&bytes[i+2]<100)yellow++;
   return {yellow,width:c.width,height:c.height};
  },'data:image/png;base64,'+fs.readFileSync(output).toString('base64'));
  assert(!png.clipped&&png.yellow>30,'PNG must include actual caption glyphs outside the rotated inset');
  assert.equal(await page.evaluate(()=>JSON.stringify({state,view,selected,editStack,redoStack})),exportBefore);
  evidence({duringRenderUnchanged:true,exceptionPreservesState:true,nestedExactValue:'987,000001',png});
 });
 await test('gestures_navigation_stale_load_and_exact_anchor_pixels',async({page,evidence})=>{
  await photo(page);
  const before=await page.evaluate(async()=>{
   const first=current,second=newRecord('photo','Druhá fotografie');second.media=first.media.slice();second.items=JSON.parse(JSON.stringify(first.items));
   second.items[0].measure='2222,000003';state.records.push(second);save();
   const db=await mediaDb(),request=db.transaction('files').objectStore('files').get(first.media[0]);
   const original=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));
   window.originalHash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await original.arrayBuffer()))).join(',');
   window.firstId=first.id;window.secondId=second.id;window.sessionBefore={view,current,selected,editStack,redoStack};
   return JSON.stringify({state,editStack,redoStack});
  });
  await page.click('#galleryMode');await page.waitForFunction(()=>!!document.querySelector('.gallery-img')?.dataset.galleryView);
  const gesture=async(type,points)=>page.evaluate(({type,points})=>{
   const el=document.querySelector('.gallery-img');el.dispatchEvent(new TouchEvent(type,{bubbles:true,cancelable:true,
    touches:points.map(([clientX,clientY],identifier)=>new Touch({identifier,target:el,clientX,clientY}))}));
  },{type,points});
  const checkInk=async()=>{
   await page.waitForTimeout(60);
   const result=await page.evaluate(()=>{
    const c=document.querySelector('.gallery-img'),v=JSON.parse(c.dataset.galleryView),ratio=c.width/c.clientWidth;
    const item=state.records.find(r=>r.id===v.recordId).items[0],x=c.getContext('2d');
    return [item.a,item.b].map(p=>{
     const sx=(p.x*v.scale+v.dx)*ratio,sy=(p.y*v.scale+v.dy)*ratio;
     if(sx<4||sy<4||sx>c.width-4||sy>c.height-4)return null;
     const bytes=x.getImageData(Math.floor(sx)-3,Math.floor(sy)-3,7,7).data;
     return Array.from({length:bytes.length/4},(_,i)=>bytes[i*4]>180&&bytes[i*4+1]>150&&bytes[i*4+2]<100).filter(Boolean).length;
    });
   });
   assert(result.every(x=>x===null||x>2),'Real yellow line/arrow endpoints must track exact saved anchors');
   assert(result.some(x=>x!==null),'At least one anchor is on screen');return result;
  };
  const fitInk=await checkInk();
  await gesture('touchstart',[[220,350],[320,350]]);await gesture('touchmove',[[170,350],[370,350]]);await gesture('touchend',[]);
  const zoomInk=await checkInk();
  assert.equal(await page.evaluate(()=>JSON.parse(document.querySelector('.gallery-img').dataset.galleryView).zoom),2);
  await gesture('touchstart',[[250,400]]);await gesture('touchmove',[[285,420]]);await gesture('touchend',[]);await checkInk();
  await page.locator('.gallery-img').dblclick();await page.waitForTimeout(70);
  // Slow load of the next page may not redraw the previous page, nor win after close.
  await page.evaluate(()=>{
   window.baseLoadPhoto=loadPhotoImage;window.releaseSlow=null;
   loadPhotoImage=id=>new Promise(resolve=>window.releaseSlow=async()=>resolve(await baseLoadPhoto(id)));
  });
  await gesture('touchstart',[[450,400]]);
  await page.evaluate(()=>{const el=document.querySelector('.gallery-img');el.dispatchEvent(new TouchEvent('touchend',{bubbles:true,touches:[],changedTouches:[new Touch({identifier:0,target:el,clientX:100,clientY:400})]}))});
  await page.waitForFunction(()=>typeof releaseSlow==='function');
  await page.locator('.gallery-img').dblclick();
  assert.equal(await page.evaluate(()=>document.querySelector('.galleryOverlay').__drawGallery),null,'Old frame is invalid while the new page loads');
  await page.click('.gallery-top [data-action="close"]');
  await page.evaluate(async()=>{await releaseSlow();loadPhotoImage=baseLoadPhoto});
  await page.waitForTimeout(80);assert.equal(await page.locator('.galleryOverlay').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify({state,editStack,redoStack})),before);
  assert(await page.evaluate(()=>Object.entries(sessionBefore).every(([k,v])=>({view,current,selected,editStack,redoStack})[k]===v)));
  await page.click('#galleryMode');await page.waitForFunction(()=>document.querySelector('.gallery-img')?.dataset.galleryView);
  await page.click('.gallery-top [data-action="edit"]');
  assert(await page.evaluate(()=>editStack===sessionBefore.editStack&&view===sessionBefore.view&&selected===sessionBefore.selected),'Edit current photo resumes the same session');
  await editSelected(page);assert.equal(await page.inputValue('#measureInput'),'1585,800001');await page.click('#cancelModal');
  const hash=await page.evaluate(async()=>{
   const db=await mediaDb(),r=db.transaction('files').objectStore('files').get(current.media[0]),blob=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));
   return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
  });assert.equal(hash,await page.evaluate(()=>originalHash));
  evidence({fitInk,zoomInk,originalSHA256:hash,lateLoadCannotReopenGallery:true});
 });
  await test('stacked_voice_marker_gallery_and_customer_export_pixels',async({page,evidence,directory})=>{
   await page.setViewportSize({width:412,height:850});await photo(page);
   const before=await page.evaluate(async()=>{
    const id=current.media[0],url=await assetUrl(id),im=new Image();
    await new Promise((resolve,reject)=>{im.onload=resolve;im.onerror=reject;im.src=url});
    window.__detailPhotoCache[id]=im;
    current.items.push({id:'voice-visual',type:'note',a:{x:1050,y:650},
     media:[id,id],audioMedia:['synthetic-audio-reference'],text:'Popisek 1250,000001 mm',
     insetX:1100,insetY:700,insetWidth:260,insetRotation:24});
    save();paint();
    const db=await mediaDb(),request=db.transaction('files').objectStore('files').get(id);
    const blob=await new Promise(resolve=>request.onsuccess=()=>resolve(request.result));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
    window.__voiceMarkers=[];
    const original=CanvasRenderingContext2D.prototype.fillText;
    CanvasRenderingContext2D.prototype.fillText=function(value,x,y,...rest){
     if(value==='🎙'){const p=this.getTransform().transformPoint({x,y});
      __voiceMarkers.push({x:p.x,y:p.y,width:this.canvas.width,height:this.canvas.height,
       gallery:this.canvas.classList?.contains('gallery-img')||false})}
     return original.call(this,value,x,y,...rest);
    };
    return {items:JSON.stringify(current.items),hash};
   });
   const exported=await page.evaluate(async()=>{
    __voiceMarkers.length=0;
    const encoded=await __customerExport.render(current,{notes:true,dimensions:true,drawing:true});
    const image=new Image();image.src='data:image/png;base64,'+encoded;await image.decode();
    const marker=__voiceMarkers.find(x=>!x.gallery&&x.width===image.naturalWidth);
    if(!marker)return {error:'customer PDF/ZIP marker not rendered'};
    const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
    const c=canvas.getContext('2d');c.drawImage(image,0,0);
    const x=Math.floor(marker.x)-15,y=Math.floor(marker.y)-15;
    if(x<0||y<0||x+30>=canvas.width||y+30>=canvas.height)return {error:'customer marker clipped'};
    const pixels=c.getImageData(x,y,30,30).data;let ink=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]<245||pixels[i+1]<245||pixels[i+2]<245)ink++;
    return {width:canvas.width,height:canvas.height,ink,marker};
   });
   assert(!exported.error,JSON.stringify(exported));
   assert(exported.width>1200&&exported.height>800,'Customer export must include inset outside original');
   assert(exported.ink>8,'Customer PNG embedded in PDF/ZIP must contain actual voice pixels');
   await page.click('#galleryMode');await page.waitForFunction(()=>!!document.querySelector('.gallery-img')?.dataset.galleryView);
   const gallery=await page.evaluate(()=>{
    const c=document.querySelector('.gallery-img'),markers=__voiceMarkers.filter(m=>m.gallery);
    const p=markers[markers.length-1];if(!p)return {error:'gallery voice icon not rendered'};
    if(p.x<14||p.y<14||p.x+14>=c.width||p.y+14>=c.height)return {error:'gallery icon clipped'};
    const b=c.getContext('2d').getImageData(Math.floor(p.x)-14,Math.floor(p.y)-14,28,28).data;
    let colored=0;for(let i=0;i<b.length;i+=4)
     if(Math.abs(b[i]-41)+Math.abs(b[i+1]-42)+Math.abs(b[i+2]-47)>135)colored++;
    return {colored,marker:p};
   });
   assert(!gallery.error,JSON.stringify(gallery));assert(gallery.colored>8,'Gallery must contain visible voice glyph pixels');
   await page.screenshot({path:path.join(directory,'stacked-voice-gallery.png')});
   await page.click('.gallery-top [data-action="close"]');
   const after=await page.evaluate(async()=>{
    const db=await mediaDb(),r=db.transaction('files').objectStore('files').get(current.media[0]);
    const blob=await new Promise(resolve=>r.onsuccess=()=>resolve(r.result));
    const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',await blob.arrayBuffer()))).join(',');
    return {items:JSON.stringify(current.items),hash};
   });
   assert.deepEqual(after,before,'Read-only gallery/export must not modify originals or exact values');
   await page.click('#editorBack');await page.reload();await page.locator('.entry-title').click();
   assert.equal(await page.evaluate(()=>JSON.stringify(current.items)),before.items,'Exact values survive restart');
   evidence({exported,gallery,originalSHA256:before.hash,nativePdf:'NOT RUN'});
  });
}).catch(e=>{console.error(e);process.exitCode=1});
