/* Rich-note media draft/persistence regression. Node VM tests the actual openRichNote function. */
'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('node:assert/strict');

const source=fs.readFileSync('app/src/main/assets/rich-notes.js','utf8');
const a=source.indexOf('function openRichNote(item,isNew){');
const b=source.indexOf('function openNestedPhoto(',a);
assert.ok(a>=0&&b>a,'Missing real rich-note implementation');
const code=source.slice(a,b);

function fixture(item,options={}){
 const elements=new Map(),created=[],messages=[],focuses=[],pickerCalls=[],revokedUrls=[];
 let previews=new Map(),recordSerial=0,checkpoints=0,commits=0;
 const dialog={classList:{add(){},remove(){}}};
 const modalEl={hidden:true,querySelector:()=>dialog};
 const attachmentContainer={
  _html:'',_controls:{remove:[],preview:[]},
  get innerHTML(){return this._html},
  set innerHTML(value){
   this._html=value;
   for(const target of previews.values())target.isConnected=false;
   previews=new Map();
   this._controls={remove:[],preview:[]};
   for(const [,id] of value.matchAll(/data-embed="(\d+)"/g)){
    const i=Number(id);
    previews.set(i,{isConnected:true,textContent:'',children:[],append(node){this.children.push(node)}});
    this._controls.remove.push({dataset:{remove:String(i)},onclick:null});
    this._controls.preview.push({dataset:{preview:String(i)},onclick:null});
   }
  },
  querySelector(selector){const match=selector.match(/data-embed="(\d+)"/);return match?previews.get(Number(match[1]))||null:null},
  querySelectorAll(selector){
   const match=selector.match(/^\[data-(preview|remove)\]$/);
   return match?this._controls[match[1]]:[];
  }
 };
 const get=id=>{
  if(id==='modal')return modalEl;
  if(id==='richAttachments')return attachmentContainer;
  if(!elements.has(id))elements.set(id,{
   id,hidden:false,value:'',textContent:'',onclick:null,
   classList:{add(){},remove(){}},
   focus(){focuses.push(id)}
  });
  return elements.get(id);
 };
 get('richText').value=item.text||'';
 get('richSize').value=String(item.insetWidth||240);
 get('richAngle').value=String(item.insetRotation||0);
 const recordIds=[],opens=[],cancelCalls=[],editStack=Array.isArray(options.undoStart)?options.undoStart.slice():[],
       redoStack=['saved-redo'];
 const parent={id:'parent',rev:'rev-original',syncClock:{device:1},
  updatedAt:'2026-11-11T00:00:00Z',items:options.newNote?[]:[item]};
 const window={isRecordLocked:()=>false};
 const stopOutcomes=Array.isArray(options.stopOutcomes)?options.stopOutcomes.slice():null;
 const Native={
  startAudio:id=>{recordIds.push(id);return true},
  stopAudio:()=>stopOutcomes?.length?stopOutcomes.shift():options.stopAudio!==false,
  cancelAudio:()=>{cancelCalls.push('cancel');return true}
 };
 const sandbox={
  window,URL:{revokeObjectURL:id=>revokedUrls.push(id)},document:{
   getElementById:id=>get(id),
   createElement:tag=>{
    const node={tag,controls:false,src:'',alt:'',remove(){this.removed=true}};
    created.push(node);return node;
   }
  },
  current:parent,selected:item.id,state:{records:[parent]},persistedSnapshot:'base',editStack,redoStack,
  photoSize:{w:800,h:600},native:true,Native,
  uid:()=> 'record-'+(++recordSerial),
  notify:text=>messages.push(text),
  checkpoint:()=>{checkpoints++;editStack.push(JSON.stringify(parent.items));if(editStack.length>50)editStack.shift();sandbox.redoStack.length=0},
  commitEditor:()=>{
   commits++;parent.rev='rev-after-edit';parent.syncClock={device:2};parent.updatedAt='newer';
   if(options.rebaseOnSave){
    sandbox.persistedSnapshot='server-newer';
    parent.items=[{...item,text:'Newer remote data'}];
   }
   return options.saveFails!==true;
  },
  finishDraw:()=>{},openAttachment:()=>{},openNestedPhoto:(...args)=>opens.push(args),
  pickMedia:(mode,handler)=>pickerCalls.push({mode,handler}),
  assetUrl:async id=>{
   if(options.rejectId===id)throw Error('missing asset');
   if(options.emptyId===id)return '';
   return 'blob:'+id;
  },
  modal:(title,markup,cb)=>{modalEl.hidden=false;window.modalOK=cb},
  escapeHtml:input=>String(input).replace(/&/g,'&amp;').replace(/</g,'&lt;'),
  modalFocusTimer:null,clearTimeout:()=>{},console
 };
 sandbox.$=get;
 vm.createContext(sandbox);
 vm.runInContext(code,sandbox,{filename:'rich-notes.js'});
 const flush=()=>new Promise(resolve=>setImmediate(resolve));
 return {
  get,window,item,parent,Native,created,recordIds,cancelCalls,messages,focuses,pickerCalls,opens,revokedUrls,
  editStack,get redoStack(){return sandbox.redoStack},
  open:()=>sandbox.openRichNote(item,!!options.newNote),flush,
  preview:i=>previews.get(i),
  remove:i=>attachmentContainer.querySelectorAll('[data-remove]')[i],
  get checkpoints(){return checkpoints},get commits(){return commits}
 };
}
async function run(){
 // Existing audio must display as audio immediately: no failed <img> probe.
 const note={id:'n1',type:'note',text:'Snímek',media:['voice-old'],audioMedia:['voice-old']};
 const x=fixture(note);
 x.open();await x.flush();
 assert.equal(x.preview(0)?.children[0]?.tag,'audio','Audio uses an actual audio player');
 assert.equal(x.created.filter(n=>n.tag==='img').length,0,'Audio must not try loading as an image');
 assert.deepEqual(x.focuses,['okModal'],'Opening audio notes may not focus the text keyboard');
 x.get('richVoice').onclick();x.get('richVoice').onclick();
 assert.deepEqual(Array.from(note.media),['voice-old'],'Stopping audio must not mutate saved attachment list');
 assert.deepEqual(Array.from(note.audioMedia),['voice-old'],'Stopping audio must not mutate saved audio ownership');
 x.get('cancelModal').onclick();
 assert.deepEqual(Array.from(note.audioMedia),['voice-old'],'Cancel must preserve original audio after recording');
 assert.deepEqual(Array.from(note.media),['voice-old'],'Cancel must preserve original media after recording');

 // Save explicitly publishes the newly recorded attachment exactly once.
 const y=fixture({id:'n2',type:'note',media:['voice-old'],audioMedia:['voice-old']});
 y.open();await y.flush();
 y.get('richVoice').onclick();y.get('richVoice').onclick();
 assert.equal(y.window.__activeRichNotePersist(),true);
 assert.deepEqual(Array.from(y.item.audioMedia),['voice-old','record-1']);
 assert.deepEqual(Array.from(y.item.media),['voice-old','record-1']);
 assert.equal(y.commits,1);
 assert.equal(y.checkpoints,1);

 // Repeated picker callback must not duplicate immutable media references.
 const z=fixture({id:'n3',type:'note',media:[],audioMedia:[]});
 z.open();z.get('richPhotoPick').onclick();
 assert.equal(z.pickerCalls.length,1);
 assert.equal(z.pickerCalls[0].handler('photo-1'),true);
 assert.equal(z.pickerCalls[0].handler('photo-1'),false);
 assert.equal(z.window.__activeRichNotePersist(),true);
 assert.deepEqual(Array.from(z.item.media),['photo-1']);
 assert.deepEqual(Array.from(z.item.audioMedia),[]);

 // A callback arriving after the dialog is cancelled cannot attach to the note.
 const late=fixture({id:'n4',type:'note',media:[],audioMedia:[]});
 late.open();late.get('richPhotoPick').onclick();late.get('cancelModal').onclick();
 assert.equal(late.pickerCalls[0].handler('late-photo'),false);
 assert.deepEqual(Array.from(late.item.media),[]);

 // Removing a draft audio attachment changes ownership only when saved.
 const removed=fixture({id:'n5',type:'note',media:['voice-old'],audioMedia:['voice-old']});
 removed.open();await removed.flush();
 removed.remove(0).onclick();
 assert.deepEqual(Array.from(removed.item.media),['voice-old']);
 assert.deepEqual(Array.from(removed.item.audioMedia),['voice-old']);
 assert.equal(removed.window.__activeRichNotePersist(),true);
 assert.deepEqual(Array.from(removed.item.media),[]);
 assert.deepEqual(Array.from(removed.item.audioMedia),[]);

 // Failed/missing preview returns a message rather than unhandled rejection.
 for(const options of [{rejectId:'lost'},{emptyId:'lost'}]){
  const lost=fixture({id:'n6',type:'note',media:['lost'],audioMedia:[]},options);
  lost.open();await lost.flush();
  assert.equal(lost.preview(0)?.textContent,'Náhled přílohy není dostupný');
 }
 // An audio-only note must not try to open its sound bytes as a nested photograph.
 const audioOnly=fixture({id:'n7',type:'note',media:['voice'],audioMedia:['voice']});
 audioOnly.open();await audioOnly.flush();
 audioOnly.get('richEditDetail').onclick();
 assert.equal(audioOnly.opens.length,0,'Audio-only notes cannot enter the photo editor');
 assert.equal(audioOnly.commits,0,'Audio-only editor request must not save');
 assert.ok(audioOnly.messages.some(v=>v.includes('fotografii')),'Explain missing detail photo');

 // When audio is listed before the actual photo, select the photo by media ID.
 const mixed=fixture({id:'n8',type:'note',media:['voice','image'],audioMedia:['voice']});
 mixed.open();await mixed.flush();
 mixed.get('richEditDetail').onclick();
 assert.equal(mixed.opens.length,1);
 assert.equal(mixed.opens[0][2],'image','Nested editor must receive the non-audio media');

 // Stale picker callback must not reconnect media after its note has been deleted.
 const detached=fixture({id:'n9',type:'note',media:[],audioMedia:[]});
 detached.open();detached.get('richPhotoPick').onclick();
 detached.parent.items.splice(0,1);
 assert.equal(detached.pickerCalls[0].handler('photo-stale'),false);
 assert.deepEqual(Array.from(detached.item.media),[]);

 // Reject a second note dialog, rather than overwrite the first unsaved draft.
 const nested=fixture({id:'n10',type:'note',media:[],audioMedia:[]});
 nested.open();
 const firstCleanup=nested.window.__activeRichNoteCleanup;
 // A second note uses the same runtime and must not overwrite its active session.
 // Keep a reference to the actual runtime method (fixture.open uses its initial note).
 nested.open();
 assert.equal(nested.window.__activeRichNoteCleanup,firstCleanup);
 assert.ok(nested.messages.some(v=>v.includes('otevřenou poznámku')));

 // Image fallback after Cancel must not append a player into a closed dialog.
 const lateImage=fixture({id:'n11',type:'note',media:['image'],audioMedia:[]});
 lateImage.open();await lateImage.flush();
 const image=lateImage.preview(0)?.children[0];
 assert.equal(image?.tag,'img','Photo uses an image element');
 lateImage.get('cancelModal').onclick();
 image.onerror();
 assert.equal(lateImage.preview(0)?.children.length,1,'Late image error may not append player');

 // A failed save of deletion keeps the existing note and the dialog open.
 const failedDelete=fixture({id:'n12',type:'note',media:['image'],audioMedia:[]},{saveFails:true});
 failedDelete.open();failedDelete.get('richDelete').onclick();
 assert.equal(failedDelete.parent.items.length,1,'Failed delete retains original note');
 assert.equal(failedDelete.parent.items[0],failedDelete.item);
 assert.equal(failedDelete.get('modal').hidden,false,'Failed delete must leave dialog for retry');
 assert.ok(failedDelete.messages.some(v=>v.includes('Smazání nebylo potvrzeno')));

 const goodDelete=fixture({id:'n13',type:'note',media:['image'],audioMedia:[]});
 goodDelete.open();goodDelete.get('richDelete').onclick();
 assert.equal(goodDelete.parent.items.length,0,'Confirmed delete removes selected note');
 assert.equal(goodDelete.get('modal').hidden,true,'Confirmed delete closes dialog');

 // While recording, a failed audio stop blocks Save without altering note data.
 const badAudio=fixture({id:'n14',type:'note',media:[],audioMedia:[]},{stopAudio:false});
 badAudio.open();badAudio.get('richVoice').onclick();
 assert.equal(badAudio.window.__activeRichNotePersist(),false,'Failed stop must block Save');
 assert.deepEqual(Array.from(badAudio.item.media),[]);
 assert.equal(badAudio.get('modal').hidden,false,'Failed stop keeps editor open');
 assert.equal(badAudio.commits,0,'No save after failed audio stop');

 // Lock acquired after opening: fail closed, including picker callbacks.
 const locked=fixture({id:'n15',type:'note',media:[],audioMedia:[]});
 locked.open();locked.get('richPhotoPick').onclick();
 locked.window.isRecordLocked=()=>true;
 assert.equal(locked.pickerCalls[0].handler('photo-locked'),false);
 assert.equal(locked.window.__activeRichNotePersist(),false);
 assert.deepEqual(Array.from(locked.item.media),[]);

 // Browser blob URLs must be revoked on dialog close and when removing media.
 const reclaim=fixture({id:'n16',type:'note',media:['voice'],audioMedia:['voice']});
 reclaim.open();await reclaim.flush();
 assert.deepEqual(reclaim.revokedUrls,[],'Active audio preview must remain usable');
 reclaim.get('cancelModal').onclick();
 assert.deepEqual(reclaim.revokedUrls,['blob:voice'],'Cancel must release browser preview URL');

 const rerender=fixture({id:'n17',type:'note',media:['photo'],audioMedia:[]});
 rerender.open();await rerender.flush();
 rerender.remove(0).onclick();
 assert.deepEqual(rerender.revokedUrls,['blob:photo'],'Removing attachment revokes its preview');
 rerender.get('cancelModal').onclick();
 assert.equal(rerender.revokedUrls.length,1,'Blob URL revoked only once');

 // A URL resolving after a cancelled dialog is discarded and revoked.
 const pending=fixture({id:'n18',type:'note',media:['voice'],audioMedia:['voice']});
 pending.open();pending.get('cancelModal').onclick();await pending.flush();
 assert.deepEqual(pending.revokedUrls,['blob:voice'],'Late preview URL must not leak');

 // Native stop may fail transiently. Keep state until a successful retry.
 const retry=fixture({id:'n19',type:'note',media:[],audioMedia:[]},{stopOutcomes:[false,true]});
 retry.open();retry.get('richVoice').onclick();
 retry.get('richVoice').onclick();
 assert.equal(retry.get('richVoice').textContent,'■ Zastavit nahrávání','Failed Stop retains recording state');
 assert.deepEqual(Array.from(retry.item.media),[],'Failed Stop does not link invalid audio');
 retry.get('richVoice').onclick();await retry.flush();
 assert.equal(retry.get('richVoice').textContent,'🎙 Nahrát hlas','Retry Stop succeeds');
 assert.deepEqual(Array.from(retry.item.audioMedia),[],'Audio stays draft before Save');
 assert.equal(retry.window.__activeRichNotePersist(),true);
 assert.deepEqual(Array.from(retry.item.audioMedia),['record-1'],'Successful retry saved exactly once');

 // Rejected Save must not leave a mutated item that a later unrelated save publishes.
 const writeFailureOptions={saveFails:true,undoStart:Array.from({length:50},(_,i)=>'history-'+i)};
 const beforeFail={id:'n20',type:'note',text:'Původní',media:['voice'],audioMedia:['voice'],insetWidth:200};
 const writeFail=fixture(beforeFail,writeFailureOptions);
 writeFail.open();
 writeFail.get('richText').value='Neuložené';
 writeFail.get('richSize').value='900';
 writeFail.get('richVoice').onclick();writeFail.get('richVoice').onclick();
 assert.equal(writeFail.window.__activeRichNotePersist(),false,'Rejected note save must be reported');
 assert.equal(writeFail.item.text,'Původní','Rejected write cannot mutate saved text in memory');
 assert.equal(writeFail.item.insetWidth,200,'Rejected write cannot mutate original image geometry');
 assert.equal(writeFail.parent.rev,'rev-original','Failed save must restore parent revision');
 assert.deepEqual(writeFail.parent.syncClock,{device:1},'Failed save must restore sync clock');
 assert.equal(writeFail.parent.updatedAt,'2026-11-11T00:00:00Z','Failed save must restore timestamp');
 assert.deepEqual(Array.from(writeFail.item.media),['voice'],'Rejected write cannot attach audio');
 assert.deepEqual(Array.from(writeFail.item.audioMedia),['voice']);
 assert.equal(writeFail.editStack.length,50,'History capacity must stay unchanged');
 assert.equal(writeFail.editStack[0],'history-0','Failed save cannot drop oldest Undo history');
 assert.deepEqual(Array.from(writeFail.redoStack),['saved-redo'],'Failed save preserves Redo');
 assert.equal(writeFail.get('modal').hidden,false,'Failed save keeps user draft available');
 writeFail.get('cancelModal').onclick();
 assert.equal(writeFail.item.text,'Původní','Cancel after failed save must not publish draft');

 // New note failed Save must not leave a ghost record, retry must insert exactly once.
 const newOptions={newNote:true,saveFails:true};
 const newNote={id:'n21',type:'note',media:[],audioMedia:[],text:''};
 const uncommitted=fixture(newNote,newOptions);
 uncommitted.open();uncommitted.get('richText').value='Nová poznámka';
 assert.equal(uncommitted.window.__activeRichNotePersist(),false);
 assert.equal(uncommitted.parent.items.length,0,'Rejected first save leaves no ghost annotation');
 assert.equal(uncommitted.item.text,'','Failed first save restores model but keeps input draft');
 newOptions.saveFails=false;
 assert.equal(uncommitted.window.__activeRichNotePersist(),true);
 assert.equal(uncommitted.parent.items.length,1,'Successful retry creates the annotation');
 assert.equal(uncommitted.parent.items[0].text,'Nová poznámka');

 // A stale session left behind by a generic hidden modal can be cleaned safely,
 // while its delayed cleanup must not stop the replacement session's recorder.
 const orphan=fixture({id:'n22',type:'note',media:['voice'],audioMedia:['voice']});
 orphan.open();await orphan.flush();
 const oldCleanup=orphan.window.__activeRichNoteCleanup;
 orphan.get('modal').hidden=true; // legacy generic close without release
 orphan.open();await orphan.flush();
 assert.notEqual(orphan.window.__activeRichNoteCleanup,oldCleanup,'New session replaces orphaned dialog');
 assert.deepEqual(orphan.revokedUrls,['blob:voice'],'Stale preview is released on replacement');
 orphan.get('richVoice').onclick();
 oldCleanup(); // stale callback from the previous session
 assert.equal(orphan.cancelCalls.length,0,'Old cleanup may not cancel newer recording');
 orphan.get('richVoice').onclick();
 assert.equal(orphan.recordIds.length,1,'New recording still stops after stale cleanup');
 orphan.get('cancelModal').onclick();

 // A save that rebases a newer remote record must NEVER revert it to old text.
 const remote=fixture({id:'n23',type:'note',media:[],audioMedia:[],text:'Old'},{
  saveFails:true,rebaseOnSave:true});
 remote.open();remote.get('richText').value='My local draft';
 assert.equal(remote.window.__activeRichNotePersist(),false);
 assert.equal(remote.parent.items[0].text,'Newer remote data','Rebase keeps newer remote item');
 assert.equal(remote.parent.rev,'rev-after-edit','Rebase metadata may not be reverted');
 assert.equal(remote.get('modal').hidden,false,'Conflicted edit remains visible to retry safely');

 console.log('PASS rich note: media drafts, races, cleanup, retry, lock, failed-save metadata rollback and conflict preservation');
}
run().catch(err=>{console.error(err);process.exitCode=1});
