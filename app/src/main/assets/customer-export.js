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
  if(native&&typeof Native.getMediaMime==='function')return Native.getMediaMime(id).startsWith('image/');
  const url=await assetUrl(id);
  try{return (await fetch(url)).headers.get('Content-Type')?.startsWith('image/')||false}
  finally{if(url.startsWith('blob:'))URL.revokeObjectURL(url)}
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
  const canvas=document.createElement('canvas');
  const scale=Math.min(1,2400/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));
  canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
  const c=canvas.getContext('2d');
  c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.drawImage(image,0,0,canvas.width,canvas.height);
  const old={ctx,view,current,photoSize,selected,layers:prefs.layerVisible,exporting:window.__exportingAnnotations};
  try{
   ctx=c;view={zoom:scale,dx:0,dy:0};current=record;
   photoSize={w:image.naturalWidth,h:image.naturalHeight};selected=null;
   prefs.layerVisible={dimensions:true,drawing:true,notes:options.notes};
   window.__exportingAnnotations=true;
   // Use the same screen-space labels/strokes as the editor. Downsampling a
   // large camera photo must not shrink a 17 px caption into unreadable pixels.
   for(const item of items)drawItem(c,item);
   return canvas;
  }finally{
   ctx=old.ctx;view=old.view;current=old.current;photoSize=old.photoSize;selected=old.selected;
   prefs.layerVisible=old.layers;window.__exportingAnnotations=old.exporting;
  }
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
   c.font=font;const result=[];
   for(const paragraph of String(text||'').split('\n')){
    let line='';for(const character of paragraph){
     if(c.measureText(line+character).width>width-2*margin){result.push(line);line=''}line+=character;
    }result.push(line);
   }return result;
  }
  function output(){if(++number>200)throw new Error('PDF má příliš mnoho stran');return encode(canvas)}
  blank();c.drawImage(main,(width-main.width)/2,0);y=main.height+margin;
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
