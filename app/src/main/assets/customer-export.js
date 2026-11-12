/* Customer copies are rendered separately; the original backup ZIP is untouched. */
'use strict';
(function(){
 let busy=false;
 function photosInScope(ids){
  const selected=new Set(ids);
  return state.records.filter(r=>!r.deleted&&r.kind==='photo'&&r.media?.[0]&&
   (selected.has(r.id)||ids.some(id=>folderContains(id,r.id))));
 }
 function selectedItems(record,options){
  return (record.items||[]).filter(item=>item&&!item.deleted&&
   (item.type==='note'?options.notes:
    ['dimension','chain','cumulative','angle','area'].includes(item.type)?options.dimensions:options.drawing));
 }
 function loadImage(id){
  return assetUrl(id).then(url=>new Promise((resolve,reject)=>{
   const image=new Image();
   const timer=setTimeout(()=>done(new Error('Fotografii nelze načíst včas')),20000);
   function done(error){clearTimeout(timer);image.onload=image.onerror=null;if(url.startsWith('blob:'))URL.revokeObjectURL(url);error?reject(error):resolve(image)}
   image.onload=()=>done();image.onerror=()=>done(new Error('Fotografii nelze načíst'));image.src=url;
  }));
 }
 async function isPhoto(id,item){
  if(item.audioMedia?.includes(id))return false;
  let mime='';
  if(native&&typeof Native.getMediaMime==='function')mime=Native.getMediaMime(id);
  else{
   const url=await assetUrl(id);
   try{mime=(await fetch(url)).headers.get('Content-Type')||''}
   finally{if(url.startsWith('blob:'))URL.revokeObjectURL(url)}
  }
  if(mime.startsWith('image/'))return true;
  if(mime&&mime!=='application/octet-stream')return false;
  // Older attachments may lack MIME metadata. Probe the local image safely.
  try{await loadImage(id);return true}catch(error){return false}
 }
 async function preloadNotes(items){
  for(const item of items)if(item.type==='note'&&item.media?.length){
   const id=item.media[0];
   if(await isPhoto(id,item)){
    if(!window.__detailPhotoCache[id]?.complete)window.__detailPhotoCache[id]=await loadImage(id);
    await preloadNotes(item.detailItems||[]);
   }
  }
 }
 async function renderCanvas(record,options){
  const image=await loadImage(record.media[0]);
  const items=selectedItems(record,options);
  if(options.notes)await preloadNotes(items);
  // A customer PDF/ZIP may contain a detail outside the original photo.
  // Expand only the rendered copy; never change project coordinates or media.
  const visiblePrefs={...prefs,layerVisible:{dimensions:true,drawing:true,notes:options.notes}};
  let minX=0,minY=0,maxX=image.naturalWidth,maxY=image.naturalHeight;
  const insets=options.notes&&typeof window.insetAnnotationBounds==='function'
   ?items.filter(item=>item.type==='note'&&item.media?.length):[];
  let measure=null;
  if(insets.length){
   measure=document.createElement('canvas').getContext('2d');
   // The voice icon, caption and outlines use fixed screen pixels: measuring
   // only at zoom=1 and scaling the resulting box clips high-resolution PDFs.
   // Solve for source-space extents at the ACTUAL output scale (max 2400px).
   const margin=32,limit=2400;
   let settled=false;
   for(let pass=0;pass<12;pass++){
    const scale=Math.min(1,limit/Math.max(maxX-minX,maxY-minY));
    const dx=-minX*scale,dy=-minY*scale;
    const boundsRender=annotationRenderContext(measure,{
     view:{zoom:scale,dx,dy},
     photoSize:{w:image.naturalWidth,h:image.naturalHeight},
     viewport:{w:image.naturalWidth*scale,h:image.naturalHeight*scale},
     selected:null,exporting:true,prefs:visiblePrefs
    });
    let left=0,top=0,right=image.naturalWidth,bottom=image.naturalHeight;
    for(const item of insets){
     const box=window.insetAnnotationBounds(measure,item,boundsRender);
     if(!box)continue;
     if(![box.minX,box.minY,box.maxX,box.maxY].every(Number.isFinite))
      throw new Error('Nelze určit bezpečné meze zákaznického exportu');
     // Convert the measured pixel bounds back into photo coordinates.
     const x0=(box.minX-dx)/scale,y0=(box.minY-dy)/scale;
     const x1=(box.maxX-dx)/scale,y1=(box.maxY-dy)/scale;
     if(x0<0)left=Math.min(left,x0-margin/scale);
     if(y0<0)top=Math.min(top,y0-margin/scale);
     if(x1>image.naturalWidth)right=Math.max(right,x1+margin/scale);
     if(y1>image.naturalHeight)bottom=Math.max(bottom,y1+margin/scale);
    }
    const change=Math.max(Math.abs(left-minX),Math.abs(top-minY),
     Math.abs(right-maxX),Math.abs(bottom-maxY))*scale;
    minX=left;minY=top;maxX=right;maxY=bottom;
    if(change<0.1){settled=true;break}
   }
   if(!settled)throw new Error('Nelze bezpečně umístit detaily zákaznického exportu');
  }
  const extentW=maxX-minX,extentH=maxY-minY;
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,2400/Math.max(extentW,extentH));
  canvas.width=Math.max(1,Math.round(extentW*scale));
  canvas.height=Math.max(1,Math.round(extentH*scale));
  const c=canvas.getContext('2d'),dx=-minX*scale,dy=-minY*scale;
  c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);
  c.drawImage(image,dx,dy,image.naturalWidth*scale,image.naturalHeight*scale);
  const render=annotationRenderContext(c,{view:{zoom:scale,dx,dy},
   photoSize:{w:image.naturalWidth,h:image.naturalHeight},
   // Caption width depends on the source photo, not on extra outer margins.
   viewport:{w:image.naturalWidth*scale,h:image.naturalHeight*scale},
   selected:null,exporting:true,prefs:visiblePrefs});
  // Fail safely rather than silently cropping a voice marker or caption.
  if(measure){
   const finalBounds=annotationRenderContext(measure,{
    view:{zoom:scale,dx,dy},
    photoSize:render.photoSize,viewport:render.viewport,
    selected:null,exporting:true,prefs:visiblePrefs
   });
   for(const item of insets){
    const box=window.insetAnnotationBounds(measure,item,finalBounds);
    if(box&&(box.minX<0||box.minY<0||box.maxX>canvas.width||box.maxY>canvas.height))
     throw new Error('Detail nebo hlasová ikona přesahuje zákaznický export');
   }
  }
  // Geometry scales with the photo; captions/strokes stay readable in output pixels.
  for(const item of items)drawItem(c,item,render);
  return canvas;
 }
 const encode=canvas=>canvas.toDataURL('image/png').split(',')[1];
 async function render(record,options){return encode(await renderCanvas(record,options))}
 // Stream appendix pages to Android; retain only a page and the current photo.
 async function* pages(record,options){
  const main=await renderCanvas(record,options);
  if(!options.notes){yield encode(main);return}
  const notes=selectedItems(record,options).filter(item=>item.type==='note');
  const groups=[];
  for(const [index,item] of notes.entries()){
   const ids=[];for(const id of item.media||[])if(await isPhoto(id,item))ids.push(id);
   if(ids.length||String(item.text||'').trim())groups.push({item,index,ids});
  }
  if(!groups.length){yield encode(main);return}
  const width=Math.max(1200,main.width),height=2400,margin=48,gap=28;
  let canvas,c,y,number=0;
  function blank(){
   canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;c=canvas.getContext('2d');
   c.fillStyle='#fff';c.fillRect(0,0,width,height);c.fillStyle='#222';y=margin;
  }
  function header(text){c.font='bold 30px sans-serif';c.fillStyle='#222';c.fillText(text,margin,y+30);y+=52}
  function lines(text,font='24px sans-serif'){
   c.font=font;const result=[],available=width-2*margin;
   for(const paragraph of String(text||'').split('\n')){
    let line='';
    for(const word of paragraph.match(/\S+\s*|\s+/gu)||[]){
     if(line&&c.measureText(line+word).width>available){result.push(line.trimEnd());line=''}
     const token=line?word:word.trimStart();
     for(const character of token){
      if(c.measureText(line+character).width>available){result.push(line.trimEnd());line=''}
      line+=character;
     }
    }
    result.push(line.trimEnd());
   }return result;
  }
  function output(){if(++number>200)throw new Error('PDF má příliš mnoho stran');return encode(canvas)}
  const mainScale=Math.min(width/main.width,height/main.height);
  blank();c.drawImage(main,(width-main.width*mainScale)/2,0,main.width*mainScale,main.height*mainScale);y=main.height*mainScale+margin;
  if(y+160>height-margin){yield output();blank()}
  header('Poznámky a fotografie');
  for(const {item,index,ids} of groups){
   const title='Poznámka '+(index+1)+(item.title?' – '+item.title:'');
   if(y+200>height-margin){yield output();blank();header('Poznámky a fotografie – pokračování')}
   c.strokeStyle='#bbb';c.beginPath();c.moveTo(margin,y);c.lineTo(width-margin,y);c.stroke();y+=16;
   for(const line of lines(title,'bold 26px sans-serif')){
    if(y+50>height-margin){yield output();blank()}
    c.font='bold 26px sans-serif';c.fillStyle='#222';c.fillText(line,margin,y+28);y+=38;
   }
   for(const line of lines(item.text)){
    if(y+50>height-margin){yield output();blank();header('Poznámka '+(index+1)+' – pokračování')}
    c.font='24px sans-serif';c.fillStyle='#333';c.fillText(line,margin,y+26);y+=34;
   }
   y+=16;
   const cellW=(width-2*margin-gap)/2,cellH=Math.min(420,cellW*.72);
   for(let i=0;i<ids.length;i+=2){
    if(y+cellH+gap>height-margin){yield output();blank();header('Poznámka '+(index+1)+' – pokračování')}
    for(let col=0;col<2&&i+col<ids.length;col++){
     const image=await loadImage(ids[i+col]);
     const scale=Math.min(cellW/image.naturalWidth,cellH/image.naturalHeight);
     const w=image.naturalWidth*scale,h=image.naturalHeight*scale,x=margin+col*(cellW+gap);
     c.fillStyle='#f3f3f3';c.fillRect(x,y,cellW,cellH);
     c.drawImage(image,x+(cellW-w)/2,y+(cellH-h)/2,w,h);
    }
    y+=cellH+gap;
   }
   y+=24;
  }
  yield output();
 }
 function open(ids){
  if(busy){notify('Zákaznický export právě probíhá');return}
  if(!native||typeof Native.beginCustomerExport!=='function'){notify('Zákaznický PDF ZIP vyžaduje novou Android aplikaci');return}
  const photos=photosInScope(ids);
  if(!photos.length){notify('Ve výběru nejsou fotografie');return}
  modal('Export pro zákazníka – ZIP s PDF',
   '<p>Jedno PDF na fotografii, společně v ZIP. Bez editovatelných projektových dat, historie, GPS a dalších příloh. Původní zálohovací ZIP zůstává samostatný.</p>'+
   '<label class="sum-option"><input type="checkbox" id="customerDimensions" checked> Kóty a rozměry</label>'+
   '<label class="sum-option"><input type="checkbox" id="customerDrawing" checked> Čáry, šipky, symboly a jejich texty</label>'+
   '<label class="sum-option"><input type="checkbox" id="customerNotes"> Zahrnout i soukromé poznámky a vložené fotografie</label>'+
   '<p>Při zahrnutí poznámek budou pod hlavní fotografií také jejich texty a všechny fotografické přílohy. Dlouhé poznámky pokračují na dalších stranách téhož PDF.</p><p>Vyber fotografie:</p>'+photos.map((r,i)=>'<label class="sum-option"><input type="checkbox" data-customer-photo="'+i+'" checked> '+escapeHtml(r.title)+'</label>').join(''),()=>{
    const chosen=[...$('modalBody').querySelectorAll('[data-customer-photo]:checked')].map(el=>photos[Number(el.dataset.customerPhoto)]);
    if(!chosen.length){notify('Vyber alespoň jednu fotografii');return false}
    // Snapshot precisely the saved records before asynchronous rendering.
    const records=JSON.parse(JSON.stringify(chosen));
    const options={dimensions:$('customerDimensions').checked,drawing:$('customerDrawing').checked,notes:$('customerNotes').checked};
    run(records,options);return true;
   },'Vytvořit zákaznický ZIP');
 }
 async function run(records,options){
  busy=true;
  let started=false;
  try{
   const error=Native.beginCustomerExport();if(error)throw new Error(error);started=true;
   for(let i=0;i<records.length;i++){
    notify('Připravuji PDF '+(i+1)+' / '+records.length);
    let error=Native.beginCustomerPdf(records[i].title);if(error)throw new Error(error);
    for await(const png of pages(records[i],options)){
     error=Native.addCustomerPdfPage(png);if(error)throw new Error(error);
    }
    error=Native.finishCustomerPdf();if(error)throw new Error(error);
   }
   Native.saveCustomerExport();
  }catch(error){if(started)Native.cancelCustomerExport();notify('Zákaznický export: '+error.message)}
  finally{busy=false}
 }
 window.openCustomerExport=open;
 // Keep this pure selector available for browser regression checks.
 window.__customerExport={photosInScope,selectedItems,render,pages};
 const previousActions=recordActions;
 recordActions=function(id){
  previousActions(id);
  const record=recById(id);
  if(!record||!['photo','folder'].includes(record.kind))return;
  const button=document.createElement('button');button.className='outline';
  button.textContent='Export pro zákazníka: ZIP s PDF';
  button.onclick=()=>open([id]);$('modalBody').querySelector('.row')?.append(button);
 };
 const previousOverflow=showEditorOverflow;
 showEditorOverflow=function(){
  previousOverflow();
  const menu=$('editorOverflow');
  if(menu.hidden||!current||current.kind!=='photo')return;
  const button=document.createElement('button');button.className='appMenuItem';button.textContent='Export pro zákazníka: ZIP s PDF';
  button.onclick=()=>{closeMenus();finishPendingPath();open([current.id])};menu.append(button);
 };
 $('editorTopMenu').onclick=showEditorOverflow;
})();
