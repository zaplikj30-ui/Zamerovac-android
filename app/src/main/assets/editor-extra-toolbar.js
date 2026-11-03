/* Rozšířená spodní lišta ImageMeter: klepnutí na ⋮ přidá dvě řady ikon.
 * Ovládání zůstává uvnitř editoru. Nedotýká se formátu uložených zakázek.
 */
'use strict';
(function(){
 const toolbar=document.querySelector('#editorView .toolbar');
 const editor=$('editorView');
 if(!toolbar||!editor)return;
 const panel=document.createElement('div');
 panel.id='editorExtraToolbar';
 panel.className='editor-extra-toolbar';
 panel.hidden=true;
 panel.setAttribute('role','toolbar');
 panel.setAttribute('aria-label','Rozšířené nástroje editoru');
 toolbar.insertAdjacentElement('afterend',panel);

 const paths={
  redo:'<path d="M21 8v6h-6"/><path d="M3 16a8 8 0 0 1 14-5l4 3"/>',
  select:'<path d="m5 3 14 9-7 1-3 7z"/>',
  symbol:'<path d="M3 11V4h7l11 11-7 7z"/><circle cx="7.4" cy="7.5" r="1"/>',
  style:'<circle cx="12" cy="12" r="3"/><path d="M12 2v2m0 16v2M4.93 4.93l1.41 1.41m11.32 11.32 1.41 1.41M2 12h2m16 0h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  grid:'<rect x="3" y="3" width="18" height="18" rx="1"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/>',
  duplicate:'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
  copy:'<rect x="9" y="8" width="11" height="13" rx="1"/><path d="M15 8V4H4v13h5"/>',
  paste:'<rect x="6" y="5" width="13" height="17" rx="1"/><path d="M9 3h7v4H9zM9 12h7m-7 4h5"/>',
  rotateLeft:'<path d="M3 9V3h6"/><path d="M3 9a9 9 0 1 1 1 8"/>',
  rotateRight:'<path d="M21 9V3h-6"/><path d="M21 9a9 9 0 1 0-1 8"/>',
  forward:'<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5M3 18l9 5 9-5"/>',
  backward:'<path d="m12 3 9 5-9 5-9-5zM3 13l9 5 9-5"/>',
  export:'<path d="M12 2v12m-5-5 5 5 5-5M4 15v6h16v-6"/>'
 };
 function ico(key){
  return '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+paths[key]+'</svg>';
 }
 const entries=[
  ['redo','Znovu poslední úpravu'],
  ['select','Vybrat a upravit'],
  ['symbol','Přidat symbol'],
  ['style','Nastavení tloušťky a textu'],
  ['lock','Uzamčení zakázky'],
  ['grid','Přichytávání na mřížku'],
  ['duplicate','Duplikovat vybraný prvek'],
  ['copy','Kopírovat prvek'],
  ['paste','Vložit kopii prvku'],
  ['rotateLeft','Otočit detail doleva'],
  ['rotateRight','Otočit detail doprava'],
  ['forward','Přenést prvek dopředu'],
  ['backward','Přenést prvek dozadu'],
  ['export','Export obrázku nebo PDF']
 ];
 let copied=null;
 panel.innerHTML=entries.map(([key,label])=>
  '<button type="button" class="editor-extra-btn" data-extra="'+key+'" title="'+label+'" aria-label="'+label+'">'+ico(key)+'</button>'
 ).join('');
 function currentItem(){return current?.items?.find(x=>x.id===selected)||null}
 function isLocked(){return !!window.isRecordLocked?.(current)}
 function update(){
  const item=currentItem(),locked=isLocked();
  for(const b of panel.querySelectorAll('[data-extra]')){
   const key=b.dataset.extra;
   const requiresItem=['duplicate','copy','rotateLeft','rotateRight','forward','backward'].includes(key);
   const needsInset=['rotateLeft','rotateRight'].includes(key);
   const disabled=
    (locked&&key!=='lock'&&key!=='export')||
    (requiresItem&&!item)||
    (needsInset&&!(item?.type==='note'&&item.media?.length))||
    (key==='redo'&&!redoStack.length)||
    (key==='paste'&&!copied);
   b.disabled=!!disabled;
   b.classList.toggle('extra-active',(key==='select'&&mode==='select')||(key==='grid'&&prefs.snapGrid));
  }
 }
 function commitWithUndo(action){
  if(!current||isLocked())return;
  checkpoint();
  action();
  commitEditor();
  update();
 }
 function cloneItem(original){
  const item=JSON.parse(JSON.stringify(original));
  item.id=uid();
  const delta=16/Math.max(.1,view.zoom);
  for(const key of ['a','b'])if(item[key]){item[key].x+=delta;item[key].y+=delta}
  if(Array.isArray(item.points))for(const p of item.points){p.x+=delta;p.y+=delta}
  if(Number.isFinite(item.insetX))item.insetX+=delta;
  if(Number.isFinite(item.insetY))item.insetY+=delta;
  return item;
 }
 function reorder(step){
  const at=current.items.findIndex(x=>x.id===selected);
  if(at<0)return;
  const target=Math.max(0,Math.min(current.items.length-1,at+step));
  if(target===at)return;
  commitWithUndo(()=>{const [it]=current.items.splice(at,1);current.items.splice(target,0,it)});
 }
 const actions={
  redo(){redoEditor()},
  select(){setTool('select')},
  symbol(){setTool('symbol')},
  style(){$('styleTool').click()},
  lock(){if(current?.id)recordActions(current.id)},
  grid(){prefs.snapGrid=!prefs.snapGrid;save();paint();notify(prefs.snapGrid?'Přichytávání k mřížce zapnuto':'Přichytávání k mřížce vypnuto')},
  duplicate(){const it=currentItem();if(it)commitWithUndo(()=>{const x=cloneItem(it);current.items.push(x);selected=x.id})},
  copy(){const it=currentItem();if(it){copied=JSON.parse(JSON.stringify(it));notify('Prvek zkopírován, vyber Vložit')}},
  paste(){if(copied)commitWithUndo(()=>{const x=cloneItem(copied);current.items.push(x);selected=x.id})},
  rotateLeft(){const it=currentItem();if(it)commitWithUndo(()=>{it.insetRotation=((Number(it.insetRotation)||0)-90+360)%360})},
  rotateRight(){const it=currentItem();if(it)commitWithUndo(()=>{it.insetRotation=((Number(it.insetRotation)||0)+90)%360})},
  forward(){reorder(1)},
  backward(){reorder(-1)},
  export(){$('exportBtn').click()}
 };
 panel.querySelectorAll('[data-extra]').forEach(b=>b.onclick=()=>{
  if(b.disabled)return;
  actions[b.dataset.extra]?.();
  update();
 });
 const more=$('editorMore');
 function setExpanded(open){
  panel.hidden=!open;
  document.body.classList.toggle('editor-extra-open',open);
  more.classList.toggle('tool-active',open);
  more.setAttribute('aria-expanded',String(open));
  more.title=open?'Sbalit další nástroje':'Rozbalit další nástroje';
  more.setAttribute('aria-label',more.title);
  if(open){closeMenus();update()}
  resizeEditor();
 }
 more.onclick=()=>setExpanded(panel.hidden);
 more.setAttribute('aria-controls','editorExtraToolbar');
 // Video ImageMeter 1000093323.mp4: vysunout spodní panel gestem NAHORU,
 // znovu zasunout gestem DOLŮ. Klepnutí na ⋮ dál funguje jako alternativa.
 // Starší testovací DOM nemá addEventListener na panelu, proto ochrana.
 if(typeof toolbar.addEventListener==='function'&&typeof panel.addEventListener==='function'){
  for(const bar of [toolbar,panel]){
   let touch=null,pen=null;
   function vertical(dx,dy){return Math.abs(dy)>=34&&Math.abs(dy)>Math.abs(dx)*1.3}
   bar.addEventListener('touchstart',e=>{
    touch=e.touches.length===1?{x:e.touches[0].clientX,y:e.touches[0].clientY,done:false}:null;
   },{passive:true,capture:true});
   bar.addEventListener('touchmove',e=>{
    if(!touch||e.touches.length!==1)return;
    const dx=e.touches[0].clientX-touch.x,dy=e.touches[0].clientY-touch.y;
    if(vertical(dx,dy)){
     if(!touch.done)setExpanded(dy<0);
     touch.done=true;e.preventDefault();e.stopImmediatePropagation();
    }
   },{passive:false,capture:true});
   bar.addEventListener('touchend',e=>{
    if(!touch)return;
    const start=touch;touch=null;
    if(start.done){e.preventDefault();e.stopImmediatePropagation();return}
    if(e.changedTouches.length!==1)return;
    const dx=e.changedTouches[0].clientX-start.x,dy=e.changedTouches[0].clientY-start.y;
    if(vertical(dx,dy)){
     setExpanded(dy<0);e.preventDefault();e.stopImmediatePropagation();
    }
   },{passive:false,capture:true});
   bar.addEventListener('touchcancel',()=>{touch=null},{passive:true,capture:true});
   bar.addEventListener('pointerdown',e=>{
    if(e.pointerType==='touch')return;
    pen={x:e.clientX,y:e.clientY,id:e.pointerId};
   },true);
   bar.addEventListener('pointerup',e=>{
    if(!pen||pen.id!==e.pointerId)return;
    const dx=e.clientX-pen.x,dy=e.clientY-pen.y;pen=null;
    if(vertical(dx,dy)){
     setExpanded(dy<0);e.preventDefault();e.stopImmediatePropagation();
    }
   },true);
  }
 }
 window.setEditorExtraToolbarExpanded=setExpanded;
 setExpanded(false);
 // Horní nabídka ⋮ si ponechává všechny méně používané textové akce.
 $('editorTopMenu').onclick=showEditorOverflow;
 const previousOpenEditor=openEditor;
 openEditor=function(record){
  setExpanded(false);
  previousOpenEditor(record);
  update();
 };
 const previousBack=window.handleAndroidBack;
 window.handleAndroidBack=()=>{
  if(screen==='editor'&&!panel.hidden){setExpanded(false);return 'handled'}
  return previousBack();
 };
 stageCanvas.addEventListener('pointerup',()=>{if(!panel.hidden)update()},false);
})();
