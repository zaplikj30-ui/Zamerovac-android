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
   const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('Fotografii nelze načíst'));image.src=url;
  }));
 }
 async function preloadNotes(items){
  for(const item of items)if(item.type==='note'&&item.media?.length){
   const id=item.media[0];
   if(!window.__detailPhotoCache[id]?.complete)window.__detailPhotoCache[id]=await loadImage(id);
   await preloadNotes(item.detailItems||[]);
  }
 }
 async function render(record,options){
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
   return canvas.toDataURL('image/png').split(',')[1];
  }finally{
   ctx=old.ctx;view=old.view;current=old.current;photoSize=old.photoSize;selected=old.selected;
   prefs.layerVisible=old.layers;window.__exportingAnnotations=old.exporting;
  }
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
   '<p>Vyber fotografie:</p>'+photos.map((r,i)=>'<label class="sum-option"><input type="checkbox" data-customer-photo="'+i+'" checked> '+escapeHtml(r.title)+'</label>').join(''),()=>{
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
    const png=await render(records[i],options);
    const error=Native.addCustomerPdf(records[i].title,png);if(error)throw new Error(error);
   }
   Native.saveCustomerExport();
  }catch(error){if(started)Native.cancelCustomerExport();notify('Zákaznický export: '+error.message)}
  finally{busy=false}
 }
 window.openCustomerExport=open;
 // Keep this pure selector available for browser regression checks.
 window.__customerExport={photosInScope,selectedItems,render};
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
