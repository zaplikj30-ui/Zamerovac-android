/* Originální implementace bodových poznámek s upravitelným detailem. */
'use strict';
let detailEditorParent=null,detailEditorNote=null,detailEditorStartItems=null;
function openRichNote(item,isNew){
 if(!current||window.isRecordLocked?.(current)){notify('Záznam je uzamčen');return}
 const parent=current;
 const attachments=Array.isArray(item.media)?item.media.slice():[];
 // ImageMeter reference: default inset occupies about two fifths of the photo width,
 // rather than the much smaller 20% thumbnail used in older Zaměřovač builds.
 // Respect an already saved custom size (including deliberately tiny insets).
 const initialInsetWidth=Number(item.insetWidth)||Math.max(140,Math.min(1400,Math.round(photoSize.w*.42)));
 let recording=null;
 const previousCancel=$('cancelModal').onclick;
 $('modal')?.querySelector('.dialog')?.classList.add('richNoteDialog');
 const cleanRecording=()=>{window.__audioPermissionRetry=null;if(recording){if(native){if(typeof Native.cancelAudio==='function')Native.cancelAudio();else Native.stopAudio();}recording=null}};
 const release=()=>{$('modal')?.querySelector('.dialog')?.classList.remove('richNoteDialog');if(window.__activeRichNoteCleanup===cleanRecording){window.__activeRichNoteCleanup=null;window.__activeRichNoteRelease=null;window.__activeRichNotePersist=null}$('cancelModal').onclick=previousCancel};
 window.__activeRichNoteCleanup=cleanRecording;
 window.__activeRichNoteRelease=release;
 $('cancelModal').onclick=()=>{cleanRecording();release();$('modal').hidden=true;window.modalOK=null};
 function persist(){
  if(recording){if(!Native.stopAudio()){recording=null;$('richVoice').textContent='🎙 Nahrát hlas';return false}attachments.push(recording);item.audioMedia=[...(item.audioMedia||[]),recording];recording=null;}
  item.text=$('richText').value.trim();
  const hadAttachment=Array.isArray(item.media)&&item.media.length>0;
  item.media=attachments.slice();
  item.audioMedia=(item.audioMedia||[]).filter(id=>attachments.includes(id));
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
  if(isNew){checkpoint();parent.items.push(item);finishDraw(item);isNew=false;}
  else checkpoint();
  if(!commitEditor())return false;
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
 '<div id="richAttachments"></div>'+
 '<label>Velikost vložené fotografie</label><input id="richSize" type="range" min="70" max="1500" step="10" value="'+initialInsetWidth+'">'+
 '<label>Natočení detailu (stupně)</label><input id="richAngle" type="range" min="-180" max="180" step="5" value="'+(item.insetRotation||0)+'">'+
 '<div class="row wrap"><button type="button" class="outline" id="richEditDetail">✎ Kótovat vloženou fotografii</button>'+
 '<button type="button" class="outline" id="richDelete">🗑 Odstranit poznámku</button></div>'+
 '<p class="muted">Detail můžeš prstem přetáhnout i mimo hlavní fotografii. Žlutá šipka ukáže původní místo, bílý bod lze také přemístit. Dvojklepnutím na detail otevřeš jeho vlastní kóty.</p><p class="muted">Přílohy a kóty se ukládají editovatelně.</p>',
 ()=>persist(),'Uložit');
 const render=()=>{
  const container=$('richAttachments');if(!container)return;
  container.innerHTML=attachments.length?attachments.map((id,i)=>'<div class="rich-attachment" data-attachment="'+i+'"><span>📎 Příloha '+(i+1)+'</span><button class="outline" data-preview="'+i+'">Otevřít</button><button data-remove="'+i+'">✕</button><div class="previewMedia" data-embed="'+i+'"></div></div>').join(''):'<p class="muted">Zatím bez příloh</p>';
  container.querySelectorAll('[data-remove]').forEach(b=>b.onclick=()=>{attachments.splice(Number(b.dataset.remove),1);render()});
  container.querySelectorAll('[data-preview]').forEach(b=>b.onclick=()=>openAttachment(attachments[Number(b.dataset.preview)]));
  attachments.forEach(async(id,i)=>{
   const target=container.querySelector('[data-embed="'+i+'"]');if(!target)return;
   const url=await assetUrl(id);
   if(!target.isConnected)return;
   // Browser preview without sending any file to a remote service.
   const isAudio=(!native&&url.startsWith('blob:')&&false) || (id===recording);
   if(isAudio){target.innerHTML='<audio controls src="'+url+'"></audio>';return}
   const img=document.createElement('img');img.src=url;img.alt='Přiložená detailní fotografie';
   img.onerror=()=>{img.remove();const a=document.createElement('audio');a.src=url;a.controls=true;target.append(a)};
   target.append(img);
  });
 };
 render();
 const photoHandler=(id)=>{if(window.__activeRichNoteCleanup!==cleanRecording||current!==parent||window.isRecordLocked?.(parent)){notify('Původní poznámka už není dostupná; příloha nebyla připojena jinam.');return false}attachments.push(id);render()};
 $('richPhotoCamera').onclick=()=>pickMedia('camera',photoHandler);
 $('richPhotoPick').onclick=()=>pickMedia('media',photoHandler);
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
    if(!Native.stopAudio()){recording=null;btn.textContent='🎙 Nahrát hlas';return}attachments.push(recording);
    item.audioMedia=[...(item.audioMedia||[]),recording];recording=null;
    btn.textContent='🎙 Nahrát hlas';render();notify('Hlas připojen k poznámce');
  }
 };
 $('richEditDetail').onclick=()=>{
  if(!attachments.length){notify('Nejdřív připoj detailní fotografii');return}
  if(!persist())return;$('modal').hidden=true;
  openNestedPhoto(parent,item,attachments[0]);
 };
 $('richDelete').onclick=()=>{
  if(isNew){cleanRecording();release();$('modal').hidden=true;notify('Poznámka nebyla přidána');return}
  cleanRecording();release();checkpoint();parent.items=parent.items.filter(x=>x.id!==item.id);selected=null;commitEditor();$('modal').hidden=true;
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
