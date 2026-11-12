/* Durable Native recovery owns the evidence. UI never deletes files or infers bound from truthy Save. */
(function(){
 'use strict';
 const t=key=>window.ZamerovacI18n.t('audio.'+key);
 const list=()=>{
  if(!native||typeof Native.pendingAudio!=='function')return [];
  try{const entries=JSON.parse(Native.pendingAudio());if(!Array.isArray(entries))throw Error();return entries;}
  catch(error){return [{state:'needs-review',available:false}]}
 };
 const retained=()=>{notify(t('retained'));refresh()};
 function confirm(record,note,ids){
  if(!native||typeof Native.confirmPendingAudio!=='function')return;
  for(const id of ids){
   let ok=false;
   try{ok=Native.confirmPendingAudio(persistedSnapshot,record,note,id)===true}catch(error){}
   if(!ok)retained(); // The project may already be durable. Never roll it back.
  }
  refresh();
 }
 function rows(container,attach){
  if(!container)return;
  container.replaceChildren();
  const entries=list();if(!entries.length)return;
  const heading=document.createElement('p');heading.textContent=t('title');container.append(heading);
  for(const entry of entries){
   const row=document.createElement('div'),label=document.createElement('p');
   label.textContent=(entry.available?t('pending'):t('review'))+(entry.createdAt?' · '+dateText(entry.createdAt):'');row.append(label);
   if(entry.available&&typeof entry.id==='string'){
    const play=document.createElement('button');play.type='button';play.textContent=t('play');play.onclick=()=>openAttachment(entry.id);row.append(play);
    if(attach){const add=document.createElement('button');add.type='button';add.textContent=t('attach');add.onclick=()=>{if(attach(entry.id)===false)return;add.disabled=true;};row.append(add)}
   }
   if(typeof entry.token==='string'&&typeof Native.exportPendingAudio==='function'){
    const copy=document.createElement('button');copy.type='button';copy.textContent=t('copy');copy.onclick=()=>Native.exportPendingAudio(entry.token);row.append(copy);
   }
   container.append(row);
  }
 }
 function show(){
  if(!$('modal').hidden){retained();return}
  modal(t('title'),'<p id="retainedAudioHelp"></p><div id="retainedAudioList"></div>',()=>true,t('close'));
  $('retainedAudioHelp').textContent=t('help');rows($('retainedAudioList'));
 }
 function refresh(){
  if(!native||typeof Native.pendingAudio!=='function')return;
  let banner=$('pendingAudioBanner');const entries=list();
  if(!entries.length){banner?.remove();return}
  if(!banner){banner=document.createElement('button');banner.id='pendingAudioBanner';banner.type='button';banner.className='outline';banner.onclick=show;document.querySelector('#browserView')?.prepend(banner)}
  banner.textContent=t('title')+' ('+entries.length+')';
 }
 window.PendingAudio=Object.freeze({list,confirm,retained,rows,refresh,show,exported:()=>notify(t('exported'))});
 const previousAttachments=renderNoteAttachments;
 renderNoteAttachments=function(){
  previousAttachments();
  let container=$('noteRetainedAudio');if(!container){container=document.createElement('div');container.id='noteRetainedAudio';$('noteAttachments').after(container)}
  const owner=noteActive;
  rows(container,id=>{
   if(noteActive!==owner||!owner||!state.records.includes(owner)||owner.deleted||window.isRecordLocked?.(owner))return false;
   if(!owner.media.includes(id))owner.media.push(id);
   owner.audioMedia=[...new Set([...(owner.audioMedia||[]),id])];touch(owner);
   if(!save()){retained();return false}
   confirm(owner.id,'',[id]);renderNoteAttachments();return true;
  });
 };
 refresh();
})();
