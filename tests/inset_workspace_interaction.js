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
 opens:[],openNestedPhoto:(parent,item,media)=>sandbox.opens.push(media),
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
const caption={x:note.a.x+45,y:note.a.y-23};
const heightBefore=note.insetY;
drag([caption.x,caption.y],[caption.x+22,caption.y+10]);
assert.equal(note.captionMoved,true,'Text label must move separately');
assert.equal(note.insetY,heightBefore,'Moving caption must not move detail');
assert.equal(note.a.x,130,'Moving caption must not move arrow origin');
assert.equal(sandbox.commits,4,'Caption motion must be saved');
assert.equal(typeof sandbox.window.renderPhotoInset,'function');
// Dvě samostatná klepnutí: první označí vložený obrázek, druhé otevře jeho kóty.
sandbox.selected=null;
const center=[note.insetX+note.insetWidth/2,note.insetY+note.insetWidth/2];
pointer('pointerdown',...center);pointer('pointerup',...center);
assert.equal(sandbox.selected,note.id,'First tap must select the inset');
assert.equal(sandbox.opens.length,0,'First tap may not open nested editor');
pointer('pointerdown',...center);pointer('pointerup',...center);
assert.deepEqual(sandbox.opens,['detail-1'],'Second separate tap opens editable detail');
console.log('OK: move outside photo, independent arrow anchor, caption, resize, persistence');
