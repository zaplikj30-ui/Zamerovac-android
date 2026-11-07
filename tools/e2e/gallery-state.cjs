'use strict';
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
 await test('render_is_read_only_even_during_nested_drawing_and_failure',async({page,evidence})=>{
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
  evidence({duringRenderUnchanged:true,exceptionPreservesState:true,nestedExactValue:'987,000001'});
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
}).catch(e=>{console.error(e);process.exitCode=1});
