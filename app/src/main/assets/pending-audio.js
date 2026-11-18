/* Durable Native recovery owns the evidence. UI never deletes files or infers bound from truthy Save. */
(function(){
 'use strict';
 const t=(key,params)=>window.ZamerovacI18n.t('audio.'+key,params);
 const list=()=>{
  if(!native||typeof Native.pendingAudio!=='function')return [];
  try{const entries=JSON.parse(Native.pendingAudio());if(!Array.isArray(entries))throw Error();return entries;}
  catch(error){return [{state:'needs-review',available:false}]}
 };
 const retained=()=>{notify(t('retained'));refresh()};
 function confirm(record,note,ids){
  if(!native||typeof Native.confirmPendingAudio!=='function')return;
  let uncertain=false;
  for(const id of ids){
   let ok=false;
   try{ok=Native.confirmPendingAudio(persistedSnapshot,record,note,id)===true}catch(error){}
   if(!ok)uncertain=true; // The project may already be durable. Never roll it back.
  }
  if(uncertain)notify(t('retained'));
  refresh();
 }
 function rows(container,attach){
  if(!container)return;
  container.replaceChildren();
  const entries=list();if(!entries.length)return;
  const heading=document.createElement('p');heading.textContent=t('title');container.append(heading);
  let number=0;
  for(const entry of entries){
   const row=document.createElement('div'),label=document.createElement('p');
   const item=typeof entry.token==='string'||typeof entry.id==='string';
   if(typeof entry.id==='string')row.dataset.audioId=entry.id;
   label.textContent=(item?t('item',{number:++number})+' · ':'')+(entry.issue==='journal-uncertain'?t('journalWarning'):entry.issue==='source-mismatch'?t('suspect'):entry.available&&entry.attachable===false?t('quarantined'):entry.available&&entry.state==='needs-review'?t('bindingReview'):entry.available?t('pending'):t('review'))+(entry.createdAt?' · '+dateText(entry.createdAt):'');row.append(label);
   if(entry.available&&typeof entry.id==='string'){
    const play=document.createElement('button');play.type='button';play.textContent=t('play');play.onclick=()=>openAttachment(entry.id);row.append(play);
    if(attach&&entry.attachable!==false){const add=document.createElement('button');add.type='button';add.textContent=t('attach');add.onclick=()=>{if(attach(entry.id)===false)return;add.disabled=true;};row.append(add)}
   }
   if(typeof entry.token==='string'&&typeof Native.exportPendingAudio==='function'){
    const copy=document.createElement('button');copy.type='button';copy.textContent=entry.issue==='source-mismatch'?t('copyReview'):t('copy');copy.onclick=()=>Native.exportPendingAudio(entry.token);row.append(copy);
   }
   container.append(row);
  }
 }
 function show(){
  if(!$('modal').hidden){retained();return}
  modal(t('title'),'<p id="retainedAudioHelp"></p><div id="retainedAudioList"></div>',()=>true,t('close'));
  $('retainedAudioHelp').textContent=t('help');rows($('retainedAudioList'));
 }
 function bannerCount(count){
  let banner=$('pendingAudioBanner');
  if(!count){banner?.remove();return}
  if(!banner){banner=document.createElement('button');banner.id='pendingAudioBanner';banner.type='button';banner.className='outline';banner.onclick=show;document.querySelector('#browserView')?.prepend(banner)}
  banner.textContent=t('title');
 }
 function refresh(){
  if(!native||typeof Native.pendingAudio!=='function')return;
  const count=list().length; // list() retains a needs-review entry on unreadable journals.
  bannerCount(count);
  if(count===0)lastSavedWarning=null; // A confirmed empty journal starts a new warning cycle.
 }
 // A native save already checked the audio journal. Warn only when the
 // reported pending state changes; keep the persistent banner visible.
 let lastSavedWarning=null;
 function warnOnChange(status){
  if(status!==lastSavedWarning){
   lastSavedWarning=status;
   if(status)notify(t('retained'));
  }
 }
 function saved(result){
  if(Number.isSafeInteger(result.pendingAudioCount)&&result.pendingAudioCount>=0){
   const pending=!!result.audioPending||result.pendingAudioCount>0;
   bannerCount(pending?Math.max(1,result.pendingAudioCount):0);
   warnOnChange(pending?'count:'+result.pendingAudioCount:null);
  }else if(result.audioPending){
   // Recovery failed to supply a count. Preserve the warning, and do not
   // synchronously recover the same uncertain journal a second time.
   bannerCount(1);
   warnOnChange('uncertain');
  }else{
   warnOnChange(null);
   refresh();
  }
 }
 window.PendingAudio=Object.freeze({list,confirm,retained,rows,refresh,saved,show,exported:verified=>notify(t(verified===true?'exported':'exportedReview'))});
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
