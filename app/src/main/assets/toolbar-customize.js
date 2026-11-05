/* Uživatelské pořadí ikon: dlouhé podržení a výměna pozic v obou lištách.
   Nezasahuje do samotných kreslicích nástrojů ani do uložených fotografií. */
'use strict';
(function(){
 const main=document.querySelector('#editorView .toolbar');
 const extra=document.querySelector('#editorExtraToolbar');
 if(!main||!extra)return;
 const primaryIds=['toolsToggle','activeTool','lineColor','styleTool','deleteTool','undo','editorMore'];
 const primary=primaryIds.map(id=>$(id)).filter(Boolean);
 primary.forEach(el=>el.dataset.toolbarKey=el.id);
 const secondary=[...extra.querySelectorAll('[data-extra]')];
 secondary.forEach(el=>el.dataset.toolbarKey='extra:'+el.dataset.extra);
 const nodes=[...primary,...secondary],byId=new Map(nodes.map(el=>[el.dataset.toolbarKey,el]));
 const defaults=nodes.map(el=>el.dataset.toolbarKey),mainCount=primary.length;
 const orderNow=()=>[...main.children,...extra.children]
   .filter(el=>byId.has(el.dataset?.toolbarKey)).map(el=>el.dataset.toolbarKey);
 function applyOrder(order){
   const all=[...new Set([...(Array.isArray(order)?order:[]),...defaults])]
     .filter(k=>byId.has(k));
   if(all.length!==defaults.length)return;
   all.slice(0,mainCount).forEach(k=>main.append(byId.get(k)));
   all.slice(mainCount).forEach(k=>extra.append(byId.get(k)));
 }
 applyOrder(prefs.toolbarIconOrder);
 const landscapeTools=allTools.filter(t=>!['select','pan'].includes(t[0]));
 const landscapeButtons=new Map(landscapeTools.map(([key,icon,label])=>{
  const button=document.createElement('button');button.type='button';button.className='ico landscape-tool';button.dataset.landscapeTool=key;
  button.title=label;button.setAttribute('aria-label',label);button.innerHTML=toolIcon(key,icon);button.onclick=()=>setTool(key);
  return [key,button];
 }));
 const landscapeDrawer=document.createElement('button');landscapeDrawer.type='button';landscapeDrawer.className='ico landscape-tool';landscapeDrawer.dataset.landscapeDrawer='';landscapeDrawer.textContent='⋮';landscapeDrawer.setAttribute('aria-label','Rozbalit další nástroje');landscapeDrawer.onclick=()=>window.setEditorExtraToolbarExpanded?.(extra.hidden);
 let lastLandscape='';
 function updateLandscape(){
  const enabled=Array.isArray(prefs.landscapeTools)?prefs.landscapeTools:landscapeTools.map(t=>t[0]);
  const landscape=window.innerWidth>window.innerHeight,drawer=landscape&&!main.contains($('editorMore'));
  const capacity=landscape?Math.max(0,Math.floor((main.clientWidth-8-mainCount*48-(drawer?48:0))/48)):0;
  const keys=[...new Set(enabled)].filter(k=>landscapeButtons.has(k)).slice(0,capacity),signature=keys.join(',')+'|'+drawer;
  if(signature===lastLandscape)return;lastLandscape=signature;
  for(const button of landscapeButtons.values())button.remove();landscapeDrawer.remove();
  if(drawer)main.append(landscapeDrawer);
  for(const key of keys)main.insertBefore(landscapeButtons.get(key),main.querySelector('#editorMore'));
 }
 function configureLandscape(){
  const order=[...new Set([...(prefs.landscapeTools||landscapeTools.map(t=>t[0])),...landscapeTools.map(t=>t[0])])].filter(k=>landscapeButtons.has(k));
  const chosen=new Set(prefs.landscapeTools||order);
  modal('Lišta na šířku','<p>Vyber a uspořádej nástroje. Zobrazí se tolik ikon, kolik se vejde. Nabídka dalších nástrojů zůstane dostupná.</p><div id="landscapeToolChoices"></div>',()=>{
   prefs.landscapeTools=order.filter(k=>chosen.has(k));if(!save())return false;lastLandscape='force';updateLandscape();
  });
  const list=$('landscapeToolChoices');
  function renderChoices(){list.replaceChildren();for(const key of order){
   const row=document.createElement('div');row.className='landscape-tool-choice';
   const label=document.createElement('label'),check=document.createElement('input');check.type='checkbox';check.checked=chosen.has(key);check.dataset.landscapeChoice=key;
   check.onchange=()=>check.checked?chosen.add(key):chosen.delete(key);label.append(check,document.createTextNode(landscapeTools.find(t=>t[0]===key)[2]));row.append(label);
   for(const [delta,text] of [[-1,'↑'],[1,'↓']]){const move=document.createElement('button');move.type='button';move.textContent=text;move.setAttribute('aria-label',text==='↑'?'Posunout nahoru':'Posunout dolů');move.onclick=()=>{const i=order.indexOf(key),j=i+delta;if(j>=0&&j<order.length){[order[i],order[j]]=[order[j],order[i]];renderChoices()}};row.append(move)}list.append(row);
  }}renderChoices();
 }
 const previousShowTools=showTools;
 showTools=function(){previousShowTools();if($('toolMenu').hidden)return;
  const config=document.createElement('button');config.id='configureLandscapeTools';config.className='choice';config.textContent='Nastavit lištu na šířku';config.onclick=()=>{closeMenus();configureLandscape()};$('toolMenu').append(config);
 };
 window.addEventListener('resize',updateLandscape);new ResizeObserver(updateLandscape).observe(main);updateLandscape();
 function status(){
   for(const [key,button] of landscapeButtons)button.classList.toggle('active',mode===key);
   const u=$('undo'),r=byId.get('extra:redo');
   if(u){
     const off=!editStack.length;
     u.disabled=false;u.dataset.unavailable=off?'true':'false';
     u.setAttribute('aria-disabled',String(off));
   }
   if(r){
     const off=!redoStack.length;
     r.disabled=false;r.dataset.unavailable=off?'true':'false';
     r.setAttribute('aria-disabled',String(off));
   }
 }
 const earlierPaint=paint;
 paint=function(...args){earlierPaint(...args);status()};
 status();
 let candidate=null,dragged=null,target=null,timer=null,ignoreClickUntil=0;
 function stopTimer(){if(timer!==null){clearTimeout(timer);timer=null}}
 function under(x,y){
   const node=document.elementFromPoint?.(x,y)?.closest?.('[data-toolbar-key]');
   return node&&byId.has(node.dataset.toolbarKey)&&node.id!=='lineColor'?node:null;
 }
 function start(x,y,id,element){
   if(!element||element.id==='lineColor'||dragged)return;
   stopTimer();candidate={x,y,id,element};
   timer=setTimeout(()=>{
     if(!candidate)return;
     dragged=candidate;candidate=null;
     window.__toolbarDragging=true;
     dragged.element.classList.add('toolbar-dragging');
     if(typeof navigator!=='undefined'&&navigator.vibrate)navigator.vibrate(25);
   },500);
 }
 function move(x,y,id){
   if(candidate&&candidate.id===id&&Math.hypot(x-candidate.x,y-candidate.y)>12){
     stopTimer();candidate=null;
   }
   if(!dragged||dragged.id!==id)return;
   const element=under(x,y);
   if(target!==element){
     target?.classList.remove('toolbar-drop-target');
     target=element;
     if(element&&element!==dragged.element)element.classList.add('toolbar-drop-target');
   }
 }
 function finish(x,y,id){
   stopTimer();
   if(dragged&&dragged.id===id){
     const destination=under(x,y)||target,source=dragged.element;
     const order=orderNow();
     if(destination&&destination!==source){
       const from=order.indexOf(source.dataset.toolbarKey);
       const to=order.indexOf(destination.dataset.toolbarKey);
       if(from!==-1&&to!==-1){
         [order[from],order[to]]=[order[to],order[from]];
         applyOrder(order);prefs.toolbarIconOrder=order;save();lastLandscape='force';updateLandscape();
         notify('Rozložení nástrojů uloženo');
       }
     }
     source.classList.remove('toolbar-dragging');
     target?.classList.remove('toolbar-drop-target');
     target=null;dragged=null;
     window.__toolbarDragging=false;
     window.__toolbarDragJustFinished=true;
     setTimeout(()=>{window.__toolbarDragJustFinished=false},0);
     ignoreClickUntil=Date.now()+700;
     status();
   }
   candidate=null;
 }
 document.addEventListener('touchstart',event=>{
   if(event.touches.length!==1)return;
   const touch=event.touches[0];
   start(touch.clientX,touch.clientY,touch.identifier,event.target.closest?.('[data-toolbar-key]'));
 },{capture:true,passive:true});
 document.addEventListener('touchmove',event=>{
   if(event.touches.length!==1)return;
   const t=event.touches[0];move(t.clientX,t.clientY,t.identifier);
   if(dragged)event.preventDefault();
 },{capture:true,passive:false});
 document.addEventListener('touchend',event=>{
   const t=event.changedTouches[0];
   if(t)finish(t.clientX,t.clientY,t.identifier);
 },true);
 document.addEventListener('touchcancel',()=>{
   stopTimer();
   dragged?.element.classList.remove('toolbar-dragging');
   target?.classList.remove('toolbar-drop-target');
   candidate=null;dragged=null;target=null;window.__toolbarDragging=false;
 },true);
 document.addEventListener('pointerdown',event=>{
   if(event.pointerType==='touch'||(event.button!==undefined&&event.button!==0))return;
   start(event.clientX,event.clientY,event.pointerId,event.target.closest?.('[data-toolbar-key]'));
 },true);
 document.addEventListener('pointermove',event=>{
   if(event.pointerType==='touch')return;
   move(event.clientX,event.clientY,event.pointerId);
   if(dragged)event.preventDefault();
 },true);
 document.addEventListener('pointerup',event=>{
   if(event.pointerType!=='touch')finish(event.clientX,event.clientY,event.pointerId);
 },true);
 document.addEventListener('pointercancel',event=>{
   if(event.pointerType==='touch')return;
   stopTimer();
   dragged?.element.classList.remove('toolbar-dragging');
   target?.classList.remove('toolbar-drop-target');
   candidate=null;dragged=null;target=null;window.__toolbarDragging=false;
 },true);
 document.addEventListener('click',event=>{
   const button=event.target.closest?.('[data-toolbar-key]');
   if(!button)return;
   if(Date.now()<ignoreClickUntil||button.dataset.unavailable==='true'){
     event.preventDefault();event.stopImmediatePropagation();
   }
 },true);
 window.__getToolbarIconOrder=orderNow;
 window.__applyToolbarIconOrder=order=>{
   applyOrder(order);prefs.toolbarIconOrder=orderNow();save();lastLandscape='force';updateLandscape();status();
 };
})();
