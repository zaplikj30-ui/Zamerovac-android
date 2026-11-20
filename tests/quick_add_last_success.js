/* #194: run the product's add/quick-action functions in an isolated Node VM.
 * Native durable storage and picker are deterministic fakes; Android UI/byte-level
 * transfers are still NOT RUN until hardware QA.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/app.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const css=fs.readFileSync('app/src/main/assets/style.css','utf8');
const pick=(a,b)=>{const i=src.indexOf(a),j=src.indexOf(b,i);assert(i>=0&&j>i,a);return src.slice(i,j)};
const production=[
 pick('function recById(id,includeDeleted=false){','function folderContains('),
 pick('function newRecord(kind,title,parentId=currentFolder){','let modalFocusTimer=null;'),
 pick('// #194: session-only last confirmed add action.','function pickMedia('),
 pick('function pickMedia(type,handler=null){',"$('filePick').addEventListener('change'"),
 pick('async function addMediaRecord(','async function storeMedia(')
].join('\n');
assert(src.includes("$('galleryBtn').onclick=repeatQuickAdd;"));
assert(css.includes('.bottom #galleryBtn{border:1px solid #777;border-left:none;border-radius:0 3px 3px 0;width:60px}'),
 'Approved 60px quick button must not change size');
assert(html.includes('id="galleryBtn"'),'Original shortcut remains beside plus');
function scene(){
 let serial=0,diskWrites=0,fail=0,locked=false,prompt=null,opens=0,folderRenders=0,requests=[],pending=null;
 const original={id:'orig',kind:'photo',parentId:null,rev:'rev0',deleted:false,media:['raw-immutable-id'],
  items:[{measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]};
 const folder={id:'parent',kind:'folder',parentId:null,deleted:false};
 const state={records:[original,folder]},originalBytes=JSON.stringify(state);
 const items=new Map(),menuButtons=Array.from({length:8},(_,i)=>({dataset:{i:String(i)}})),notices=[];
 function el(id){
  if(!items.has(id))items.set(id,{hidden:true,innerHTML:'',textContent:'',title:'',
   value:'',dataset:{},setAttribute(name,value){this[name]=value},
   querySelectorAll:()=>id==='newMenu'?menuButtons:[],click(){}});
  return items.get(id);
 }
 const env={
  state,currentFolder:'parent',screen:'browser',dataLoadFailed:false,
  native:true,window:{isRecordLocked:()=>locked},stagedMediaRequest:null,
  uid:()=> 'id-'+(++serial),stamp:()=> '2026-11-18',
  advanceSyncClock:()=> ({}),save(){
   diskWrites++;if(fail>0){fail--;return false}
   pending=JSON.stringify(state);return true;
  },
  canWriteToFolder(id){if(locked)return false;return !id||!!state.records.find(r=>r.id===id&&r.kind==='folder'&&!r.deleted)},
  $:el,notify:x=>notices.push(x),closeMenus(){el('newMenu').hidden=true},
  openEditor(){opens++},openNote(){opens++},showFolder(){folderRenders++},
  promptText:(title,label,defaultValue,cb)=>{prompt={title,cb}},
  Native:{takePhotoForRequest(id){requests.push({type:'camera',id})},
   selectFilesForRequest(type,id){requests.push({type,id})}},
  current:null,noteActive:null
 };
 vm.createContext(env);vm.runInContext(production,env,{filename:'app-quick-194.js'});
 el('galleryBtn').onclick=()=>env.repeatQuickAdd();
 function choose(i){env.showNewMenu();menuButtons[i].onclick()}
 function finishPrompt(value){assert(prompt,'No prompt opened');const cb=prompt.cb;prompt=null;return cb(value)}
 async function finishMedia(mime='image/jpeg',name='photo.jpg',id='immutable-new-media'){
  const req=env.stagedMediaRequest;assert(req,'No media request');
  return env.acceptPickedMedia(req,id,mime,name);
 }
 function old(){const p=state.records.find(x=>x.id==='orig');
  assert.equal(p.media[0],'raw-immutable-id');
  assert.equal(p.items[0].measure,'1585,800001234567890');
  assert.equal(p.items[0].laserMeasuredMm,'1585.800001234567890');
 }
 return {env,el,choose,finishPrompt,finishMedia,old,state,notices,requests,
  get prompt(){return prompt},get saved(){return pending},get diskWrites(){return diskWrites},
  get opens(){return opens},get folderRenders(){return folderRenders},
  set fail(value){fail=value},set locked(value){locked=value}
 };
}
(async()=>{
 const s=scene();
 assert.equal(s.el('galleryBtn').textContent,'','Startup default keeps original photo SVG');
 s.el('galleryBtn').onclick();assert.equal(s.requests.at(-1).type,'media','Default quick shortcut should import photo');
 // Cancel system picker: no success, no shortcut change.
 s.env.stagedMediaRequest=null;
 s.choose(4);assert(s.prompt); // + → folder
 assert.equal(s.el('galleryBtn').textContent,'','Opening folder prompt is not completed success');
 s.finishPrompt('Zakázka A');
 assert.equal(s.el('galleryBtn').textContent,'📁','Folder icon failed to switch');
 assert.equal(s.el('galleryBtn').title,'Nová složka');
 assert(s.state.records.some(r=>r.kind==='folder'&&r.title==='Zakázka A'&&r.parentId==='parent'));
 s.el('galleryBtn').onclick();assert(s.prompt,'Quick folder must reopen new-folder UI');
 s.finishPrompt('Zakázka B');
 assert(s.state.records.some(r=>r.kind==='folder'&&r.title==='Zakázka B'&&r.parentId==='parent'));
 assert.equal(s.el('galleryBtn').textContent,'📁','Repeat must preserve successful type');
 // Failed CAS on another creation must not update button or persist ghost.
 s.fail=1;s.choose(2);s.finishPrompt('Náčrt selže');
 assert.equal(s.el('galleryBtn').textContent,'📁','Failed save changed shortcut');
 assert(!s.state.records.some(r=>r.title==='Náčrt selže'),'Failed save left ghost');
 s.choose(0); // camera request, not yet saved
 assert.equal(s.el('galleryBtn').textContent,'📁','Picker opening changed shortcut');
 s.env.stagedMediaRequest=null; // cancelled camera
 assert.equal(s.el('galleryBtn').textContent,'📁','Cancelled camera changed shortcut');
 s.choose(0);assert.equal(await s.finishMedia('image/jpeg','camera.jpg','raw-camera'),true);
 assert.equal(s.el('galleryBtn').textContent,'📷');
 assert.equal(s.state.records.find(r=>r.media?.includes('raw-camera')).parentId,'parent');
 s.el('galleryBtn').onclick();assert.equal(s.requests.at(-1).type,'camera','Last camera should reopen camera');
 s.env.stagedMediaRequest=null;
 s.choose(1);assert.equal(await s.finishMedia('image/jpeg','picked.jpg','raw-gallery'),true);
 assert.equal(s.el('galleryBtn').textContent,'🖼️','Imported photo icon missing');
 s.el('galleryBtn').onclick();assert.equal(s.requests.at(-1).type,'media','Last import should reopen gallery');
 s.env.stagedMediaRequest=null;
 s.choose(3); // text note creation succeeds
 assert.equal(s.el('galleryBtn').textContent,'📝');
 const noteCount=()=>s.state.records.filter(r=>r.kind==='note').length;
 const previous=noteCount();
 s.el('galleryBtn').onclick();assert.equal(noteCount(),previous+1,'Shortcut did not create note');
 assert(s.state.records.every(r=>r.kind!=='note'||r.parentId==='parent'));
 // Locked current folder can neither create nor change last shortcut.
 s.locked=true;const beforeCount=s.state.records.length;
 s.el('galleryBtn').onclick();
 assert.equal(s.state.records.length,beforeCount);assert.equal(s.el('galleryBtn').textContent,'📝');
 s.locked=false;
 s.env.currentFolder=null;
 s.choose(4);s.finishPrompt('Kořenová');
 assert(s.state.records.some(r=>r.kind==='folder'&&r.title==='Kořenová'&&r.parentId===null));
 s.old();
 const restarted=scene();restarted.el('galleryBtn').onclick();
 assert.equal(restarted.requests.at(-1).type,'media','Restart fallback should be original gallery without persistent setting');
 assert.equal(restarted.el('galleryBtn').textContent,'','Restart should restore unchanged icon');
 assert.equal(JSON.stringify({media:s.state.records[0].media,items:s.state.records[0].items}),
  JSON.stringify({media:['raw-immutable-id'],items:[{measure:'1585,800001234567890',laserMeasuredMm:'1585.800001234567890'}]}));
 console.log('PASS #194: folder and photo/camera/import/note, repeat, cancelled, failed CAS, locked, root, restart, original precise data');
})().catch(error=>{console.error(error);process.exitCode=1});
