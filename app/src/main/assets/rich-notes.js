/* Originální implementace bodových poznámek s upravitelným detailem. */
'use strict';
let detailEditorParent=null,detailEditorNote=null,detailEditorStartItems=null;
function openRichNote(item,isNew){
 if(!current||window.isRecordLocked?.(current)){notify('Záznam je uzamčen');return}
 // Never replace an open draft. If a generic close left behind an inactive
 // session, dispose only that stale session before installing new callbacks.
 if(window.__activeRichNoteCleanup){
  if($('modal')?.hidden===false){
   notify('Nejdřív ulož nebo zruš otevřenou poznámku');return;
  }
  window.__activeRichNoteCleanup();
  window.__activeRichNoteRelease?.();
 }
 const parent=current;
 const attachments=Array.isArray(item.media)?item.media.slice():[];
 // Audio membership is a local draft until Save. Cancel must not mutate the original note.
 const audioIds=new Set(Array.isArray(item.audioMedia)?item.audioMedia:[]);
 // ImageMeter reference: default inset occupies about two fifths of the photo width,
 // rather than the much smaller 20% thumbnail used in older Zaměřovač builds.
 // Respect an already saved custom size (including deliberately tiny insets).
 const initialInsetWidth=Number(item.insetWidth)||Math.max(140,Math.min(1400,Math.round(photoSize.w*.42)));
 let recording=null;
 // Native journal retains completed original bytes independently of this dialog.
 // Without audited GC, cancelling this draft must never delete that file.
 const completedDraftAudio=new Set();
 const warnRetainedAudio=()=>{
  if([...completedDraftAudio].some(id=>!Array.isArray(item.media)||!item.media.includes(id)))
   if(window.PendingAudio)window.PendingAudio.retained();else notify('Nepřipojená hlasová nahrávka zůstala uložená; bezpečné automatické čištění zatím není dostupné');
  window.PendingAudio?.refresh();
 };
 const failedStop=()=>{
  recording=null; // AudioCapture.stop() closes the recorder on false.
  if($('richVoice'))$('richVoice').textContent='🎙 Nahrát hlas';
 };
 const captureVersions=()=>({
  exists:Object.hasOwn(parent,'versionHistory'),original:parent.versionHistory,
  entries:Array.isArray(parent.versionHistory)?parent.versionHistory.slice():null
 });
 // Accept only the exact local append/trim from upgrade.js.
 // A foreign or rebased history may never be overwritten.
 const localVersions=(before,serialized)=>{
  const now=parent.versionHistory,old=before.entries;
  if(before.exists&&now===before.original&&!Array.isArray(now))return true;
  if(!before.exists&&now===undefined)return true;
  if(!Array.isArray(now))return false;
  if(old&&now!==before.original)return false;
  if(old&&now.length===old.length&&old.every((entry,i)=>now[i]===entry))return true;
  if(old&&old.length){
   if(old[old.length-1]?.items===serialized)return false;
   const kept=old.length===12?old.slice(1):old;
   return now.length===kept.length+1&&kept.every((entry,i)=>now[i]===entry)&&
    now[now.length-1]?.items===serialized;
  }
  // Empty/missing history may receive an editor baseline and a new snapshot.
  return now.length>=1&&now.length<=2&&now[now.length-1]?.items===serialized;
 };
 const restoreVersions=before=>{
  if(!before.exists){delete parent.versionHistory;return}
  if(before.entries){
   before.original.splice(0,before.original.length,...before.entries);
   parent.versionHistory=before.original;
  }else parent.versionHistory=before.original;
 };
 // In browser previews use temporary blob URLs. Revoke them when rerendering
 // or closing this dialog so repeated image/audio inspection cannot leak memory.
 const previewUrls=new Set();
 const revokePreviewUrl=url=>{
  if(typeof url==='string'&&url.startsWith('blob:')&&typeof URL!=='undefined'&&
     typeof URL.revokeObjectURL==='function')URL.revokeObjectURL(url);
  previewUrls.delete(url);
 };
 const clearPreviewUrls=()=>{for(const url of previewUrls)revokePreviewUrl(url)};
 const previousCancel=$('cancelModal').onclick;
 $('modal')?.querySelector('.dialog')?.classList.add('richNoteDialog');
 const cleanRecording=()=>{
  if(window.__activeRichNoteCleanup!==cleanRecording)return;
  window.__audioPermissionRetry=null;
  if(recording){if(native){if(typeof Native.cancelAudio==='function')Native.cancelAudio();else Native.stopAudio()}recording=null}
 };
 const release=()=>{
  if(window.__activeRichNoteCleanup!==cleanRecording)return;
  $('modal')?.querySelector('.dialog')?.classList.remove('richNoteDialog');
  window.__activeRichNoteCleanup=null;
  window.__activeRichNoteRelease=null;
  window.__activeRichNotePersist=null;
  clearPreviewUrls();
  warnRetainedAudio();
  $('cancelModal').onclick=previousCancel;
 };
 window.__activeRichNoteCleanup=cleanRecording;
 window.__activeRichNoteRelease=release;
 $('cancelModal').onclick=()=>{cleanRecording();release();$('modal').hidden=true;window.modalOK=null};
 function persist(){
  if(window.__activeRichNoteCleanup!==cleanRecording||$('modal').hidden||current!==parent||
     window.isRecordLocked?.(parent)||(!isNew&&!parent.items.includes(item))){
   notify('Poznámku už nelze bezpečně uložit v tomto dialogu');return false;
  }
  // Capture the committed note before mutating it. A checkpoint after text/media
  // edits records the new value and makes Undo silently leave that value in place.
  if(recording){
   if(!Native.stopAudio()){
    failedStop();if(window.PendingAudio)window.PendingAudio.retained();else notify('Nahrávka se nepodařila. Spusť nové nahrávání.');return false;
   }
   completedDraftAudio.add(recording);
   if(!attachments.includes(recording))attachments.push(recording);
   audioIds.add(recording);recording=null;
   $('richVoice').textContent='🎙 Nahrát hlas';render();
  }
  // Keep an undo-safe original until the synchronous persistence layer confirms
  // the save. On failure, restore only if the same note still owns the edited data;
  // never overwrite a record replaced by a concurrent reconciliation.
  const editedKeys=['text','media','audioMedia','insetWidth','insetRotation',
                    'insetX','insetY','insetMoved','captionMoved'];
  const before=editedKeys.map(key=>({key,exists:Object.hasOwn(item,key),value:item[key]}));
  const parentKeys=['rev','syncClock','updatedAt','hierarchyConflict','width','height'];
  const parentBefore=parentKeys.map(key=>({key,exists:Object.hasOwn(parent,key),value:parent[key]}));
  const savedBefore=typeof persistedSnapshot==='undefined'?null:persistedSnapshot;
  const wasNew=isNew;
  const oldHistory=editStack.slice(),oldRedo=redoStack.slice();
  const versionsBefore=captureVersions(),itemsBefore=parent.items;
  checkpoint();
  item.text=$('richText').value.trim();
  const hadAttachment=Array.isArray(item.media)&&item.media.length>0;
  item.media=attachments.slice();
  item.audioMedia=attachments.filter(id=>audioIds.has(id));
  item.insetWidth=Math.max(70,Math.min(1500,Number($('richSize').value)||initialInsetWidth));
  item.insetRotation=Number($('richAngle').value)||0;
  // Když už uživatel odtáhl text a potom přidal detailní fotografii,
  // vložený detail se objeví u odtažené poznámky, ne znovu na hrotu šipky.
  // Text se nadále pohybuje společně s rámečkem fotografie.
  if(!hadAttachment&&attachments.length&&item.captionMoved&&item.b&&!Number.isFinite(item.insetX)){
   item.insetX=item.b.x-item.insetWidth/2;
   item.insetY=item.b.y;
   item.insetMoved=true;
   item.captionMoved=false;
  }
  if(isNew){parent.items.push(item);isNew=false;}
  // All changes to the note are in memory at this point; only a successful
  // save may make them a committed edit or expose them via a new detail editor.
  const applied=JSON.stringify(editedKeys.map(key=>item[key]));
  const serializedItems=JSON.stringify(parent.items||[]);
  let confirmed=false;
  try{confirmed=commitEditor()===true}catch(error){notify('Poznámku se nepodařilo uložit: '+error.message)}
  if(!confirmed){
   // A remote CAS reconciliation may have installed newer data; never roll it
   // back just because our local save was rejected.
   const unchangedBase=typeof persistedSnapshot==='undefined'||persistedSnapshot===savedBefore;
   if(unchangedBase&&current===parent&&parent.items===itemsBefore&&parent.items.includes(item)&&
      (typeof state==='undefined'||state.records.includes(parent))&&
      JSON.stringify(editedKeys.map(key=>item[key]))===applied&&localVersions(versionsBefore,serializedItems)){
    for(const {key,exists,value} of [...before,...parentBefore]){
     const target=parentKeys.includes(key)?parent:item;
     if(exists)target[key]=value;
     else delete target[key];
    }
    if(wasNew)parent.items=parent.items.filter(entry=>entry!==item);
    isNew=wasNew;
    restoreVersions(versionsBefore);
    editStack.splice(0,editStack.length,...oldHistory);redoStack=oldRedo;
   }
   notify('Změny poznámky nejsou uložené. Zkus Uložit znovu.');
   return false;
  }
  window.PendingAudio?.confirm(parent.id,item.id,completedDraftAudio);
  if(wasNew)finishDraw(item);
  release();
  return true;
 }
 // Android Back confirms and saves the draft instead of losing photo/text.
 // Explicit Zrušit still discards unsaved changes as before.
 window.__activeRichNotePersist=persist;
 modal('Poznámka k fotografii',
 '<div class="rich-tabs"><b>Text · Hlas · Fotografie</b></div>'+
 '<label>Textová poznámka</label><textarea id="richText" rows="3" placeholder="Např. přívod vody, výška parapetu">'+escapeHtml(item.text||'')+'</textarea>'+
 '<div class="row wrap"><button type="button" class="outline" id="richPhotoCamera">📷 Vyfotit detail</button>'+
 '<button type="button" class="outline" id="richPhotoPick">🖼️ Vybrat fotografii</button>'+
 '<button type="button" class="outline" id="richVoice">🎙 Nahrát hlas</button></div>'+
 '<div id="richAttachments"></div><div id="richRetainedAudio"></div>'+
 '<label>Velikost vložené fotografie</label><input id="richSize" type="range" min="70" max="1500" step="10" value="'+initialInsetWidth+'">'+
 '<label>Natočení detailu (stupně)</label><input id="richAngle" type="range" min="-180" max="180" step="5" value="'+(item.insetRotation||0)+'">'+
 '<div class="row wrap"><button type="button" class="outline" id="richEditDetail">✎ Kótovat vloženou fotografii</button>'+
 '<button type="button" class="outline" id="richDelete">🗑 Odstranit poznámku</button></div>'+
 '<p class="muted">Detail můžeš prstem přetáhnout i mimo hlavní fotografii. Žlutá šipka ukáže původní místo, bílý bod lze také přemístit. Dvojklepnutím na detail otevřeš jeho vlastní kóty.</p><p class="muted">Přílohy a kóty se ukládají editovatelně.</p>',
 ()=>persist(),'Uložit');
 // Opening a note (or playing its audio) is not an explicit text-edit action.
 // Keep the keyboard closed until the user taps the textarea.
 clearTimeout(modalFocusTimer);$('okModal').focus();
 const render=()=>{
  const container=$('richAttachments');if(!container)return;
  clearPreviewUrls();
  container.innerHTML=attachments.length?attachments.map((id,i)=>'<div class="rich-attachment" data-attachment="'+i+'"><span>📎 Příloha '+(i+1)+'</span><button class="outline" data-preview="'+i+'">Otevřít</button><button data-remove="'+i+'">✕</button><div class="previewMedia" data-embed="'+i+'"></div></div>').join(''):'<p class="muted">Zatím bez příloh</p>';
  container.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{
   const removed=attachments.splice(Number(b.dataset.remove),1)[0];
   if(!attachments.includes(removed))audioIds.delete(removed);
   render();
  });
  container.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>openAttachment(attachments[Number(b.dataset.preview)]));
  attachments.forEach(async(id,i)=>{
   const target=container.querySelector('[data-embed="'+i+'"]');if(!target)return;
   try{
    const url=await assetUrl(id);
    if(!target.isConnected||$('modal').hidden||window.__activeRichNoteCleanup!==cleanRecording){
     revokePreviewUrl(url);return;
    }
    if(!url){target.textContent='Náhled přílohy není dostupný';return}
    if(url.startsWith('blob:'))previewUrls.add(url);
    // Known audio must never depend on a failed image request to become playable.
    if(audioIds.has(id)){
     const audio=document.createElement('audio');audio.controls=true;audio.src=url;target.append(audio);return;
    }
    const img=document.createElement('img');img.alt='Přiložená detailní fotografie';
    img.onerror=()=>{
     if(!target.isConnected||$('modal').hidden||window.__activeRichNoteCleanup!==cleanRecording)return;
     img.remove();const audio=document.createElement('audio');audio.src=url;audio.controls=true;target.append(audio);
    };
    img.src=url;target.append(img);
   }catch(error){
    if(target.isConnected&&!$('modal').hidden&&window.__activeRichNoteCleanup===cleanRecording)
     target.textContent='Náhled přílohy není dostupný';
   }
  });
 };
 render();
 const photoHandler=(id)=>{
  if(window.__activeRichNoteCleanup!==cleanRecording||$('modal').hidden||current!==parent||
     window.isRecordLocked?.(parent)||(!isNew&&!parent.items.includes(item))){
   notify('Původní poznámka už není dostupná; příloha nebyla připojena jinam.');return false;
  }
  if(!id||attachments.includes(id))return false;
  attachments.push(id);render();return true;
 };
 $('richPhotoCamera').onclick=()=>pickMedia('camera',photoHandler);
 $('richPhotoPick').onclick=()=>pickMedia('media',photoHandler);
 window.PendingAudio?.rows($('richRetainedAudio'),id=>{
  if(window.__activeRichNoteCleanup!==cleanRecording||$('modal').hidden||current!==parent||window.isRecordLocked?.(parent)||(!isNew&&!parent.items.includes(item)))return false;
  if(!attachments.includes(id))attachments.push(id);audioIds.add(id);completedDraftAudio.add(id);render();return true;
 });
 $('richVoice').onclick=()=>{
  if(!native){notify('Záznam hlasu funguje v Android verzi');return}
  const btn=$('richVoice');
  if(!recording){
    const id=uid();
    const start=()=>{
      if($('modal').hidden||window.__activeRichNoteCleanup!==cleanRecording||current!==parent||window.isRecordLocked?.(parent)||!document.getElementById('richVoice'))return;
      if(!Native.startAudio(id))return;
      window.__audioPermissionRetry=null;
      recording=id;btn.textContent='■ Zastavit nahrávání';notify('Nahrávání spuštěno');
    };
    window.__audioPermissionRetry=start;start();
  }else{
    if(!Native.stopAudio()){
     failedStop();if(window.PendingAudio)window.PendingAudio.retained();else notify('Nahrávka se nepodařila. Spusť nové nahrávání.');return;
    }
    completedDraftAudio.add(recording);
    if(!attachments.includes(recording))attachments.push(recording);
    audioIds.add(recording);recording=null;
    btn.textContent='🎙 Nahrát hlas';render();notify(window.ZamerovacI18n?.t('audio.stopped')||'Nahrávka je dokončená v návrhu. Potvrď Uložit.');
  }
 };
 $('richEditDetail').onclick=()=>{
  const photoId=attachments.find(id=>!audioIds.has(id));
  if(!photoId){notify('Nejdřív připoj detailní fotografii');return}
  if(!persist())return;$('modal').hidden=true;
  openNestedPhoto(parent,item,photoId);
 };
 $('richDelete').onclick=()=>{
  if(window.__activeRichNoteCleanup!==cleanRecording||current!==parent||
     window.isRecordLocked?.(parent)||(!isNew&&!parent.items.includes(item)))return;
  if(isNew){cleanRecording();release();$('modal').hidden=true;notify('Poznámka nebyla přidána');return}
  const before=parent.items,oldSelection=selected;
  const metaKeys=['rev','syncClock','updatedAt','hierarchyConflict','width','height'];
  const meta=metaKeys.map(key=>({key,exists:Object.hasOwn(parent,key),value:parent[key]}));
  const savedBefore=typeof persistedSnapshot==='undefined'?null:persistedSnapshot;
  const oldHistory=editStack.slice(),oldRedo=redoStack.slice();
  const versionsBefore=captureVersions();
  checkpoint();
  parent.items=parent.items.filter(x=>x!==item);selected=null;
  const draftItems=parent.items;
  const serializedItems=JSON.stringify(draftItems||[]);
  let confirmed=false;
  try{confirmed=commitEditor()===true}catch(error){notify('Smazání se nepodařilo uložit: '+error.message)}
  if(!confirmed){
   // The save may have rebased a newer remote record. Restore only this
   // unchanged local draft, never a concurrent replacement.
   if(current===parent&&parent.items===draftItems&&
      (typeof state==='undefined'||state.records.includes(parent))&&
      (typeof persistedSnapshot==='undefined'||persistedSnapshot===savedBefore)&&
      localVersions(versionsBefore,serializedItems)){
    parent.items=before;selected=oldSelection;
    for(const {key,exists,value} of meta){
     if(exists)parent[key]=value;else delete parent[key];
    }
    restoreVersions(versionsBefore);
    editStack.splice(0,editStack.length,...oldHistory);redoStack=oldRedo;
   }
   notify('Smazání nebylo potvrzeno, poznámka zůstává otevřená');
   return;
  }
  cleanRecording();release();$('modal').hidden=true;
 };
}
function openNestedPhoto(parent,item,mediaId){
 if(!mediaId)return;
 detailEditorParent=parent;detailEditorNote=item;detailEditorStartItems=JSON.stringify(item.detailItems||[]);
 window.__detailParent=parent;window.__detailItem=item;
 const temp={id:item.id+'-detail',kind:'photo',title:'Detail: '+(item.text||'Fotografie'),
   media:[mediaId],items:item.detailItems||[],parentId:parent.parentId,width:item.detailWidth||1400,height:item.detailHeight||900,
   _detailTemporary:true,locked:false};
 openEditor(temp);
 notify('Kóty v detailu – šipkou zpět se vrátíš k hlavní fotografii');
}
const previousExitEditor=exitEditor;
exitEditor=function(){
 if(detailEditorParent){
  const parent=detailEditorParent,item=detailEditorNote;
  if(JSON.stringify(current.items||[])!==detailEditorStartItems){item.detailItems=current.items||[];item.detailWidth=photoSize.w;item.detailHeight=photoSize.h;touch(parent);save();}
  detailEditorParent=null;detailEditorNote=null;detailEditorStartItems=null;
  window.__detailParent=null;window.__detailItem=null;
  openEditor(parent);return;
 }
 previousExitEditor();
};
$('editorBack').onclick=exitEditor;

const richPreviousAndroidBack=window.handleAndroidBack;
window.handleAndroidBack=()=>{
 if(!$('modal').hidden&&typeof window.__activeRichNotePersist==='function'){
  try{
   if(window.__activeRichNotePersist()===false)return 'handled';
   $('modal').hidden=true;
   window.modalOK=null;
   return 'handled';
  }catch(err){notify('Poznámku se nepodařilo uložit – zůstaň v editoru');return 'handled'}
 }
 return richPreviousAndroidBack();
};
