/* Simulace dotyků na vložené fotografii. Nevyžaduje Android ani DOM. */
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const handlers={};
const stageCanvas={
 clientWidth:400,clientHeight:700,
 addEventListener:(event,handler,capture)=>{if(capture)handlers[event]=handler},
 setPointerCapture:()=>{},releasePointerCapture:()=>{}
};
const note={id:'note-1',type:'note',a:{x:100,y:100},media:['detail-1'],
 insetWidth:120,insetX:140,insetY:150,insetRotation:0};
const sandbox={
 window:{__detailPhotoCache:{'detail-1':{complete:true,naturalWidth:100,naturalHeight:100}},isRecordLocked:()=>false},
 stageCanvas,current:{id:'photo',items:[note]},photoSize:{w:350,h:350},
 view:{zoom:1,dx:0,dy:0},screen:'editor',mode:'select',selected:null,
 worldToScreen:p=>({...p}),screenToWorld:p=>({...p}),eventPoint:e=>({x:e.x,y:e.y}),
 boundsPoint:p=>({...p}),setTool:k=>{sandbox.mode=k},
 paint:()=>{},commitEditor:()=>{sandbox.commits++},checkpoint:()=>{},editStack:[],commits:0,
 fitImage:()=>{},exportPng:()=>{},notify:()=>{},drawItem:()=>{},stageImg:null,
 opens:[],openNestedPhoto:(parent,item,media)=>sandbox.opens.push('nested:'+media),openRichNote:(item)=>sandbox.opens.push('note:'+item.id),
 native:false,Native:{},document:{createElement:()=>({})},
 console,
};
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync('app/src/main/assets/inset-workspace.js','utf8'),sandbox);
function pointer(type,x,y,id=1){
 const e={pointerId:id,button:0,x,y,
  preventDefault(){},stopImmediatePropagation(){}};
 handlers[type](e);
}
function drag(start,end){
 pointer('pointerdown',...start);
 pointer('pointermove',...end);
 pointer('pointerup',...end);
}
drag([180,200],[180,470]);
assert.ok(note.insetY>350,'Detail must move below the original image');
assert.equal(note.a.x,100,'Anchor must not move when dragging detail');
assert.equal(note.a.y,100);
assert.equal(note.insetMoved,true);
const insetPosition=note.insetY;
drag([100,100],[130,124]);
assert.equal(note.insetY,insetPosition,'Dragging arrow origin must not move inset image');
assert.equal(note.a.x,130,'Arrow origin must move independently');
assert.equal(note.a.y,124,'Arrow origin must move independently');
const oldWidth=note.insetWidth;
const resizeX=note.insetX+oldWidth+15;
const resizeY=note.insetY+oldWidth/2;
drag([resizeX,resizeY],[resizeX+20,resizeY]);
assert.ok(note.insetWidth>oldWidth,'Right-side handle must resize photo');
assert.equal(sandbox.commits,3,'Changes must be persisted on drag end');
// Textový rámeček bez samostatného přesunu následuje vloženou fotografii.
assert.equal(note.captionMoved,undefined,'Dragging arrow must not detach caption from photo');
note.text='Detail zásuvky';
const caption={x:note.insetX+note.insetWidth/2,y:note.insetY+note.insetWidth+18};
const heightBefore=note.insetY;
drag([caption.x,caption.y],[caption.x+22,caption.y+10]);
assert.equal(note.captionMoved,undefined,'Text stays attached to the photo frame');
assert.equal(note.insetX,caption.x-note.insetWidth/2+22,'Dragging photo caption moves the whole frame X');
assert.equal(note.insetY,heightBefore+10,'Dragging photo caption moves the whole frame Y');
assert.equal(note.a.x,130,'Dragging photo caption must not move the arrow origin');
assert.equal(note.a.y,124,'Dragging photo caption must not move the arrow origin Y');
assert.equal(sandbox.commits,4,'Dragging photo frame by its caption must be saved');
assert.equal(typeof sandbox.window.renderPhotoInset,'function');
// Dvě samostatná klepnutí: první označí vložený obrázek, druhé otevře jeho kóty.
sandbox.selected=null;
const center=[note.insetX+note.insetWidth/2,note.insetY+note.insetWidth/2];
pointer('pointerdown',...center);pointer('pointerup',...center);
assert.equal(sandbox.selected,note.id,'First tap must select the inset');
assert.equal(sandbox.opens.length,0,'First tap may not open nested editor');
pointer('pointerdown',...center);pointer('pointerup',...center);
assert.deepEqual(sandbox.opens,['note:note-1'],'Second separate tap opens full note');
// One visible sheet per attached photograph, with the original inset above them.
{
 const image=sandbox.window.__detailPhotoCache['detail-1'];
 const drawn=[];
 const c={
  save(){},restore(){},translate(){},rotate(){},
  beginPath(){},moveTo(){},lineTo(){},closePath(){},fill(){},stroke(){},
  arc(){},setLineDash(){},strokeRect(){},drawImage(){},
  fillText(){},measureText(t){return {width:String(t).length*9}},
  fillRect(x,y,w,h){drawn.push({x,y,w,h,fill:this.fillStyle})}
 };
 note.text='';sandbox.selected=null;
 for(const count of [1,2,3,4,7]){
  note.media=Array.from({length:count},(_,i)=>'detail-'+(i+1));
  drawn.length=0;
  sandbox.window.renderPhotoInset(c,note,image,()=>{});
  const sheets=drawn.filter(x=>x.fill==='#282c36');
  assert.equal(sheets.length,count-1,count+' photos must produce '+(count-1)+' rear sheets');
  if(count>=2){
   assert.ok(sheets.every(x=>x.y<note.insetY),'All back sheets should peek above the photo');
   assert.ok(sheets.every(x=>x.x>note.insetX),'All back sheets should peek from the right');
   const offsets=sheets.map(x=>Math.round(x.x-note.insetX));
   assert.equal(new Set(offsets).size,sheets.length,'Every sheet should be visibly separate');
  }
 }
 note.media=['detail-1'];
 note.text='Detail zásuvky';
}
// New drawings must stay on the existing handle positions: left/right resize, top rotate.
{
 const seen={arcs:[],resizeLines:0,translations:[]};
 const c={
  save(){},restore(){},translate(x,y){seen.translations.push({x,y})},rotate(){},
  beginPath(){},moveTo(x,y){if(x===-12&&y===0)seen.resizeLines++},lineTo(){},
  closePath(){},fill(){},stroke(){},arc(x,y,r,start,end){seen.arcs.push({r,start,end})},
  setLineDash(){},strokeRect(){},drawImage(){},fillText(){},
  measureText(t){return {width:String(t).length*9}},fillRect(){}
 };
 sandbox.selected=note.id;
 sandbox.window.renderPhotoInset(c,note,sandbox.window.__detailPhotoCache['detail-1'],()=>{});
 assert.equal(seen.resizeLines,2,'Both original side handles must show a two-way resize arrow');
 assert.equal(seen.arcs.filter(a=>a.r===12).length,2,'Top rotation handle must show two curved arrows');
 const width=note.insetWidth;
 const centerX=note.insetX+width/2,centerY=note.insetY+width/2;
 const initialAnchor={...note.a};
 drag([note.insetX-15,centerY],[note.insetX-35,centerY]);
 assert.ok(note.insetWidth>width,'Left-side handle must still enlarge photo');
 assert.ok(Math.abs(note.insetX+note.insetWidth/2-centerX)<1e-8,'Left-side resize keeps center X');
 assert.ok(Math.abs(note.insetY+note.insetWidth/2-centerY)<1e-8,'Left-side resize keeps center Y');
 assert.equal(note.a.x,initialAnchor.x,'Resize must not move arrow anchor X');
 assert.equal(note.a.y,initialAnchor.y,'Resize must not move arrow anchor Y');
 const resized=note.insetWidth;
 drag([centerX,note.insetY-33],[centerX+25,note.insetY-20]);
 assert.notEqual(note.insetRotation,0,'Original top handle must still rotate photo');
 assert.equal(note.insetWidth,resized,'Rotation must not resize photo');
 assert.equal(note.a.x,initialAnchor.x,'Rotation must not move arrow anchor X');
 assert.equal(note.a.y,initialAnchor.y,'Rotation must not move arrow anchor Y');
}
console.log('OK: move outside photo, independent arrow anchor, caption, resize, persistence');
