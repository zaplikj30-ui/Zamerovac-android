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
 const elements=new Map(),created=[],messages=[],focuses=[],pickerCalls=[];
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
 const recordIds=[];
 const parent={id:'parent',items:[item]};
 const window={isRecordLocked:()=>false};
 const Native={
  startAudio:id=>{recordIds.push(id);return true},
  stopAudio:()=>options.stopAudio!==false,
  cancelAudio:()=>true
 };
 const sandbox={
  window,document:{
   getElementById:id=>get(id),
   createElement:tag=>{
    const node={tag,controls:false,src:'',alt:'',remove(){this.removed=true}};
    created.push(node);return node;
   }
  },
  current:parent,photoSize:{w:800,h:600},native:true,Native,
  uid:()=> 'record-'+(++recordSerial),
  notify:text=>messages.push(text),
  checkpoint:()=>{checkpoints++},
  commitEditor:()=>{commits++;return true},
  finishDraw:()=>{},openAttachment:()=>{},openNestedPhoto:()=>{},
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
  get,window,item,parent,Native,created,recordIds,messages,focuses,pickerCalls,
  open:()=>sandbox.openRichNote(item,false),flush,
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
 console.log('PASS rich note: preview, cancel, save, duplicate callback, late callback, remove, missing media, keyboard focus');
}
run().catch(err=>{console.error(err);process.exitCode=1});
