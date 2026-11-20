/* #195: paste ONCE into Chrome DevTools of an approved, isolated
 * debuggable .preview Android build. No production app asset imports this.
 * Records durations/booleans only; no folder titles, media, IDs or JSON.
 */
(()=>{
 'use strict';
 if(window.__z195FolderProbe){console.info('Z195: already installed');return}
 const modal=document.getElementById('modal');
 const title=document.getElementById('modalTitle');
 const button=document.getElementById('okModal');
 const originalSave=window.save,originalFolder=window.showFolder;
 if(!modal||!title||!button||typeof button.onclick!=='function'||
    typeof originalSave!=='function'||typeof originalFolder!=='function')
  throw Error('Z195: required folder form/save/render not available');
 // JS return does NOT prove Native durability when a post-ACK callback fails.
 const samples=[];
 let active=null,sequence=0,stopped=false;
 const now=()=>performance.now();
 const settle=ticket=>{
  if(stopped||!ticket.saveStarted||ticket.reported)return;
  ticket.reported=true;
  samples.push({
   sequence:ticket.sequence,jsSaveReturnedTrue:ticket.jsSaveReturnedTrue===true,
   clickToSaveStartMs:ticket.clickToSaveStartMs,
   jsSaveMs:ticket.jsSaveMs,showFolderMs:ticket.showFolderMs,
   clickToShowFolderStartMs:ticket.clickToShowFolderStartMs,
   clickToTwoFramesMs:ticket.clickToTwoFramesMs
  });
  if(active===ticket)active=null;
 };
 const onClick=()=>{
  if(stopped||modal.hidden||title.textContent.trim()!=='Nová složka')return;
  // A hidden/rejected save is not interpreted as a confirmed CAS.
  const ticket={sequence:++sequence,started:now(),jsSaveReturnedTrue:false,
   clickToSaveStartMs:null,jsSaveMs:null,showFolderMs:null,
   clickToShowFolderStartMs:null,clickToTwoFramesMs:null,
   saveStarted:false,reported:false};
  active=ticket;
  // A later, noncapturing listener will check the synchronous modal action.
  // The existing app.js onclick was registered before this DevTools helper.
 };
 const afterClick=()=>{
  // Runs after the production onclick on this button. Unlike a microtask,
  // this check is part of the very same event dispatch.
  if(!stopped&&active&&!active.saveStarted)active=null;
 };
 const saveWrapper=function(...args){
  const ticket=stopped?null:active,started=now();
  if(ticket)ticket.saveStarted=true;
  try{
   const result=originalSave.apply(this,args);
   if(ticket)ticket.jsSaveReturnedTrue=result===true;
   return result;
  }finally{
   if(ticket&&!stopped){
    ticket.clickToSaveStartMs=started-ticket.started;
    ticket.jsSaveMs=now()-started; // Includes synchronous native bridge & JS post-ACK
    // A post-save failure may prevent showFolder entirely. Record the
    // missing render as null, never invent a completed paint or Native ACK.
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(ticket.showFolderMs===null)settle(ticket);
    }));
   }
  }
 };
 const folderWrapper=function(...args){
  const ticket=stopped?null:active,started=now();
  try{return originalFolder.apply(this,args)}
  finally{
   if(ticket&&!stopped&&ticket.jsSaveReturnedTrue===true){
    ticket.clickToShowFolderStartMs=started-ticket.started;
    ticket.showFolderMs=now()-started; // synchronous DOM update, not paint
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     if(stopped)return;
     ticket.clickToTwoFramesMs=now()-ticket.started; // approximate visible frame
     settle(ticket);
    }));
   }
  }
 };
 window.save=saveWrapper;window.showFolder=folderWrapper;
 button.addEventListener('click',onClick,true);
 button.addEventListener('click',afterClick,false);
 const stop=()=>{
  if(stopped)return;
  stopped=true;active=null;
  button.removeEventListener('click',onClick,true);
  button.removeEventListener('click',afterClick,false);
  if(window.save===saveWrapper)window.save=originalSave;
  if(window.showFolder===folderWrapper)window.showFolder=originalFolder;
  delete window.__z195FolderProbe;
 };
 window.__z195FolderProbe={samples,stop,print:()=>console.table(samples)};
 console.info('Z195: instrumented test-only folder save; call __z195FolderProbe.print() / .stop()');
})();
