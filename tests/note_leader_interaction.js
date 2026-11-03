/* Ověření dotyků u textové poznámky bez Androidu:
   nejdříve odtáhneme poznámku, potom jen hrot šipky. */
'use strict';
const fs=require('fs');
const vm=require('vm');
const assert=require('assert');
const source=fs.readFileSync('app/src/main/assets/editor.js','utf8');
function extract(start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing editor function: '+start);
 return source.slice(a,b);
}
const methods=[
 extract('function noteCaptionScreen(item){','function canvasText(text,p,color,size,angle=0){'),
 extract('function nearestHandle(point){','function selectAnnotation(item){'),
 extract('function selectAnnotation(item){','function editItem(item){')
].join('\n');
const note={id:'note-1',type:'note',a:{x:100,y:100},b:{x:100,y:100},text:'Zásuvka',fontSize:17};
const stageCanvas={setPointerCapture(){},releasePointerCapture(){}};
const sandbox={
 current:{id:'photo',items:[note]},screen:'editor',mode:'select',selected:null,
 selectedHandle:null,pointers:new Map(),stageCanvas,
 gesture:null,drawStart:null,drawCurrent:null,drag:null,drawPointerId:null,
 magnifierPoint:null,loupeSide:null,stroke:[],prefs:{fontSize:17},
 view:{zoom:1,dx:0,dy:0},ctx:{font:'',save(){},restore(){},measureText(s){return {width:s.length*9}}},
 worldToScreen:p=>({...p}),screenToWorld:p=>({...p}),eventPoint:e=>({x:e.x,y:e.y}),
 nearestLabel:()=>null,snap:p=>({...p}),paint:()=>{},checkpoint:()=>{sandbox.checkpoints++},
 commitEditor:()=>{sandbox.commits++},touch:()=>{},editItem:()=>{sandbox.edits++},
 setTool:key=>{sandbox.mode=key},
 checkpoints:0,commits:0,edits:0,console
};
vm.createContext(sandbox);
vm.runInContext(methods,sandbox);
function pointer(method,x,y){
 const e={x,y,button:0,pointerId:1,preventDefault(){}};
 vm.runInContext('stage'+method+'(globalEvent)',Object.assign(sandbox,{globalEvent:e}));
}
pointer('Down',100,100);
pointer('Move',250,200);
pointer('Up',250,200);
assert.equal(note.a.x,100,'Text move must leave arrow x fixed');
assert.equal(note.a.y,100,'Text move must leave arrow y fixed');
assert.equal(note.b.x,250,'Text must move to new x');
assert.equal(note.b.y,200,'Text must move to new y');
assert.equal(note.captionMoved,true,'After dragging, connector must be enabled');
pointer('Down',100,100);
pointer('Move',135,145);
pointer('Up',135,145);
assert.equal(note.a.x,135,'Arrow endpoint must move independently');
assert.equal(note.a.y,145,'Arrow endpoint must move independently');
assert.equal(note.b.x,250,'Moving arrow must leave label x fixed');
assert.equal(note.b.y,200,'Moving arrow must leave label y fixed');
assert.equal(sandbox.commits,2,'Both independent moves must be saved');
assert.equal(sandbox.edits,0,'Drags must not open the edit dialog');
console.log('OK: text box and arrow anchor move independently, with persistent coordinates');
