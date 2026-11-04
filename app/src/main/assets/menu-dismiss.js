/* Consume the entire outside gesture before any canvas/drag/browser handler sees it. */
'use strict';
(function(){
 const menus={toolMenu:'toolsToggle',newMenu:'createBtn',navMenu:'back',overflowMenu:'settingsBtn',editorOverflow:'editorTopMenu',editorExtraToolbar:'editorMore'};
 const openers=Object.values(menus);
 const swallowed=new Set();
 let blockClick=false;
 function stop(e){if(e.cancelable)e.preventDefault();e.stopImmediatePropagation()}
 function dismissOutside(e){
  const target=e.target;
  if(!(target instanceof Element))return false;
  const modalEl=$('modal');
  if(!modalEl.hidden){
   if(modalEl.dataset.actionMenu==='record'&&!target.closest('#modal .dialog')){
    modalEl.hidden=true;window.modalOK=null;return true;
   }
   return false; // Forms, confirmations and system pickers keep their existing rules.
  }
  const visible=Object.keys(menus).filter(id=>$(id)?.hidden===false);
  if(!visible.length||visible.some(id=>$(id).contains(target)))return false;
  // These buttons safely toggle/switch menus in their own click handler.
  if(openers.some(id=>target.closest('#'+id)))return false;
  closeMenus();return true;
 }
 window.addEventListener('pointerdown',e=>{
  if(!swallowed.size)blockClick=false;
  if(swallowed.size||dismissOutside(e)){swallowed.add(e.pointerId);blockClick=true;stop(e)}
 },true);
 for(const type of ['pointermove','pointerup','pointercancel'])window.addEventListener(type,e=>{
  if(!swallowed.has(e.pointerId))return;
  stop(e);if(type!=='pointermove')swallowed.delete(e.pointerId);
 },true);
 // Prevent compatibility mouse/touch events and the final click from falling through.
 for(const type of ['touchstart','touchmove','touchend','mousedown','mouseup'])window.addEventListener(type,e=>{
  if(swallowed.size||blockClick)stop(e);
 },{capture:true,passive:false});
 window.addEventListener('click',e=>{
  if(blockClick){blockClick=false;stop(e);return}
  if(dismissOutside(e))stop(e); // Keyboard and accessibility-generated clicks too.
 },true);
 window.addEventListener('dblclick',e=>{if(blockClick)stop(e)},true);
})();
