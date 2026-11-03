/* Rozbalovací spodní lišta podle dotykové ukázky ImageMeter.
 * Tažení spodní lišty vzhůru odhalí dvě řady rychlých voleb,
 * tažení dolů je skryje. Hlavní řada + / poslední nástroj zůstává stále vidět.
 */
'use strict';
(function(){
 const toolbar=document.querySelector('#editorView .toolbar');
 if(!toolbar)return;
 let expanded=false,dragStart=null,copyOf=null;
 const icons={
  redo:'<path d="m9 14 5-5-5-5"/><path d="M14 9H9a6 6 0 0 0-6 6v1"/><path d="M18 7v6h-6"/>',
  pin:'<path d="M9 3v5l-3 4v2h12v-2l-3-4V3"/><path d="M12 14v7"/><path d="M8 3h8"/>',
  tag:'<path d="M21 12 12 21 3 12V3h9z"/><circle cx="8" cy="8" r="1.3"/>',
  settings:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3M4.9 4.9l2.1 2.1m10 10 2.1 2.1m0-14.2L17 7m-10 10-2.1 2.1"/>',
  lock:'<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
  layers:'<path d="m12 3 9 5-9 5-9-5z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/>',
  paste:'<rect x="5" y="4" width="14" height="18" rx="2"/><rect x="9" y="2" width="6" height="5" rx="1"/><path d="M9 12h6m-6 4h6"/>',
  rotateL:'<path d="M3 11a9 9 0 1 1 2 7"/><path d="M3 4v7h7"/>',
  rotateR:'<path d="M21 11a9 9 0 1 0-2 7"/><path d="M21 4v7h-7"/>',
  select:'<path d="m5 2 14 10-7 1-3 7z"/><path d="m12 13 4 7"/>',
  history:'<path d="M3 11a9 9 0 1 1 3 7"/><path d="M3 4v7h7"/><path d="M12 7v5l3 2"/>',
  export:'<path d="M12 3v13m-5-5 5 5 5-5"/><path d="M4 18v3h16v-3"/>',
  fit:'<path d="M8 3H3v5m18 0V3h-5M3 16v5h5m8 0h5v-5"/><path d="m3 3 6 6m12-6-6 6m-12 12 6-6m12 6-6-6"/>'
 };
 function picture(name){
  return '<svg viewBox="0 0 24 24" width="25" height="25" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true">'+icons[name]+'</svg>';
 }
 const tray=document.createElement('div');
 tray.id='editorToolTray';tray.className='editor-tool-tray';tray.hidden=true;
 tray.setAttribute('role','group');tray.setAttribute('aria-label','Další nástroje ImageMeter');
 const grip=document.createElement('button');
 grip.id='editorTrayGrip';grip.type='button';grip.className='editor-tray-grip';
 grip.title='Vysunout nebo zasunout další nástroje';grip.setAttribute('aria-label',grip.title);
 grip.setAttribute('aria-expanded','false');
 grip.innerHTML='<span aria-hidden="true"></span>';
 toolbar.prepend(grip);
 toolbar.after(tray);
 function setExpanded(open){
  expanded=!!open;
  tray.hidden=!expanded;
  toolbar.classList.toggle('tray-open',expanded);
  grip.setAttribute('aria-expanded',String(expanded));
  grip.title=expanded?'Zasunout další nástroje':'Vysunout další nástroje';
  // Při změně pracovní výšky přepočítat plátno bez resetování přiblížení.
  if(screen==='editor')requestAnimationFrame(()=>resizeEditor());
 }
 window.setEditorToolbarExpanded=setExpanded;
 grip.onclick=()=>setExpanded(!expanded);
 function onDown(event){
  if(event.pointerType==='touch')return;
  dragStart={x:event.clientX,y:event.clientY,id:event.pointerId};
 }
 function onUp(event){
  if(!dragStart||dragStart.id!==event.pointerId)return;
  const dx=event.clientX-dragStart.x,dy=event.clientY-dragStart.y;
  dragStart=null;
  if(Math.abs(dy)>=36&&Math.abs(dy)>Math.abs(dx)*1.3){
   setExpanded(dy<0);
   event.preventDefault();event.stopImmediatePropagation();
  }
 }
 for(const el of [toolbar,tray]){
  el.addEventListener('pointerdown',onDown,true);
  el.addEventListener('pointerup',onUp,true);
  let touch=null;
  el.addEventListener('touchstart',e=>{
   if(e.touches.length===1)touch={x:e.touches[0].clientX,y:e.touches[0].clientY};
  },{passive:true,capture:true});
  el.addEventListener('touchend',e=>{
   if(!touch||e.changedTouches.length!==1)return;
   const dx=e.changedTouches[0].clientX-touch.x,dy=e.changedTouches[0].clientY-touch.y;
   touch=null;
   if(Math.abs(dy)>=36&&Math.abs(dy)>Math.abs(dx)*1.3){
    setExpanded(dy<0);
    e.preventDefault();e.stopImmediatePropagation();
   }
  },{passive:false,capture:true});
 }
 function chosen(){
  if(screen!=='editor'||!current){notify('Otevři nejdřív fotografii');return null}
  if(window.isRecordLocked?.(current)){notify('Zakázka je uzamčena');return null}
  return (current.items||[]).find(x=>x.id===selected)||null;
 }
 function cloneSelected(){
  const item=chosen();if(!item){notify('Vyber prvek ke kopírování');return}
  copyOf=JSON.parse(JSON.stringify(item));
  notify('Prvek zkopírován, klepni na Vložit');
 }
 function pasteSelected(){
  if(!copyOf){notify('Nejprve zkopíruj prvek');return}
  if(!current||window.isRecordLocked?.(current)){notify('Zakázka je uzamčena nebo není otevřená');return}
  const fresh=JSON.parse(JSON.stringify(copyOf));
  fresh.id=uid();
  for(const key of ['a','b'])if(fresh[key]){
   fresh[key].x=Math.min(photoSize.w,Math.max(0,fresh[key].x+25));
   fresh[key].y=Math.min(photoSize.h,Math.max(0,fresh[key].y+25));
  }
  if(Array.isArray(fresh.points))for(const p of fresh.points){
   p.x=Math.min(photoSize.w,Math.max(0,p.x+25));
   p.y=Math.min(photoSize.h,Math.max(0,p.y+25));
  }
  if(Number.isFinite(fresh.insetX))fresh.insetX+=25;
  if(Number.isFinite(fresh.insetY))fresh.insetY+=25;
  checkpoint();current.items.push(fresh);selected=fresh.id;commitEditor();
  notify('Kopie vložena');
 }
 function rotateDetail(delta){
  const item=chosen();if(!item)return;
  if(item.type!=='note'||!item.media?.length){notify('Nejdřív vyber vložený detailní obrázek');return}
  checkpoint();item.insetRotation=((Number(item.insetRotation)||0)+delta+360)%360;
  commitEditor();
 }
 function settings(){
  $('settingsPanel').hidden=false;renderSettings();
 }
 const actions=[
  {id:'redo',label:'Znovu',run:()=>redoEditor()},
  {id:'pin',label:'Umístit značku',run:()=>setTool('symbol')},
  {id:'tag',label:'Upravit vybraný popisek',run:()=>{const x=chosen();if(x)editItem(x)}},
  {id:'settings',label:'Nastavení editoru',run:settings},
  {id:'lock',label:'Zamknout či odemknout zakázku',run:()=>current&&recordActions(current.id)},
  {id:'layers',label:'Zobrazit a skrýt vrstvy',run:()=>window.showEditorLayers?.()},
  {id:'copy',label:'Kopírovat vybraný prvek',run:cloneSelected},
  {id:'paste',label:'Vložit kopii prvku',run:pasteSelected},
  {id:'select',label:'Vybrat a upravit',run:()=>setTool('select')},
  {id:'rotateL',label:'Otočit detail o 90° doleva',run:()=>rotateDetail(-90)},
  {id:'rotateR',label:'Otočit detail o 90° doprava',run:()=>rotateDetail(90)},
  {id:'history',label:'Historie úprav kót',run:()=>window.restoreEditorHistory?.()},
  {id:'fit',label:'Přizpůsobit fotografii',run:()=>fitImage()},
  {id:'export',label:'Export PNG nebo PDF',run:()=>$('exportBtn').click()}
 ];
 actions.forEach(a=>{
  const b=document.createElement('button');
  b.type='button';b.className='tray-action';b.dataset.action=a.id;
  b.title=a.label;b.setAttribute('aria-label',a.label);b.innerHTML=picture(a.id);
  b.onclick=()=>{if(screen==='editor')a.run()};
  tray.append(b);
 });
 const oldOpenEditor=openEditor;
 openEditor=function(record){
  setExpanded(false);
  oldOpenEditor(record);
 };
 const oldBack=window.handleAndroidBack;
 window.handleAndroidBack=function(){
  if(screen==='editor'&&expanded&&$('modal').hidden&&$('settingsPanel').hidden){
   setExpanded(false);return 'handled';
  }
  return oldBack();
 };
})();
