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
 if(!modal||!title||!button||typeof originalSave!=='function'||typeof originalFolder!=='function')
  throw Error('Z195: required folder form/save/render not available');
 const samples=[];
 let active=null,sequence=0;
 const now=()=>performance.now();
 const settle=ticket=>{
  if(ticket.reported)return;
  ticket.reported=true;
  samples.push({
   sequence:ticket.sequence,ack:ticket.ack===true,
   clickToSaveStartMs:ticket.clickToSaveStartMs,
   jsSaveMs:ticket.jsSaveMs,showFolderMs:ticket.showFolderMs,
   clickToShowFolderStartMs:ticket.clickToShowFolderStartMs,
   clickToTwoFramesMs:ticket.clickToTwoFramesMs
  });
  if(active===ticket)active=null;
 };
 const onClick=()=>{
  if(modal.hidden||title.textContent.trim()!=='Nová složka')return;
  // A hidden/rejected save is not interpreted as a confirmed CAS.
  active={sequence:++sequence,started:now(),ack:false,
   clickToSaveStartMs:null,jsSaveMs:null,showFolderMs:null,
   clickToShowFolderStartMs:null,clickToTwoFramesMs:null,reported:false};
 };
 const saveWrapper=function(...args){
  const ticket=active,started=now();
  try{
   const result=originalSave.apply(this,args);
   if(ticket)ticket.ack=result===true;
   return result;
  }finally{
   if(ticket){
    ticket.clickToSaveStartMs=started-ticket.started;
    ticket.jsSaveMs=now()-started; // Includes synchronous native bridge & JS post-ACK
    if(ticket.ack!==true)
     requestAnimationFrame(()=>requestAnimationFrame(()=>settle(ticket)));
   }
  }
 };
 const folderWrapper=function(...args){
  const ticket=active,started=now();
  try{return originalFolder.apply(this,args)}
  finally{
   if(ticket&&ticket.ack===true){
    ticket.clickToShowFolderStartMs=started-ticket.started;
    ticket.showFolderMs=now()-started; // synchronous DOM update, not paint
    requestAnimationFrame(()=>requestAnimationFrame(()=>{
     ticket.clickToTwoFramesMs=now()-ticket.started; // approximate visible frame
     settle(ticket);
    }));
   }
  }
 };
 window.save=saveWrapper;window.showFolder=folderWrapper;
 button.addEventListener('click',onClick,true);
 const stop=()=>{
  button.removeEventListener('click',onClick,true);
  if(window.save===saveWrapper)window.save=originalSave;
  if(window.showFolder===folderWrapper)window.showFolder=originalFolder;
  delete window.__z195FolderProbe;
 };
 window.__z195FolderProbe={samples,stop,print:()=>console.table(samples)};
 console.info('Z195: instrumented test-only folder save; call __z195FolderProbe.print() / .stop()');
})();
