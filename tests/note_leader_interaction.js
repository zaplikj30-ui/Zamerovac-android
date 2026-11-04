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
 extract('function noteDisplayedCaption(item){','function canvasText(text,p,color,size,angle=0){'),
 extract('function drawArrow(c,point,to,size=10){','function drawItem(c,item){'),
 extract('function nearestHandle(point,onlyItem=null){','function selectAnnotation(item){'),
 extract('function selectAnnotation(item){','function editItem(item){')
].join('\n');
const note={id:'note-1',type:'note',a:{x:100,y:100},b:{x:100,y:100},text:'Zásuvka',fontSize:17};
const stageCanvas={setPointerCapture(){},releasePointerCapture(){}};
const sandbox={
 window:{},current:{id:'photo',items:[note]},screen:'editor',mode:'select',selected:null,
 selectedHandle:null,pointers:new Map(),stageCanvas,
 gesture:null,drawStart:null,drawCurrent:null,drag:null,drawPointerId:null,
 magnifierPoint:null,loupeSide:null,stroke:[],prefs:{fontSize:17},
 view:{zoom:1,dx:0,dy:0},ctx:{font:'',save(){},restore(){},measureText(s){return {width:s.length*9}}},
 worldToScreen:p=>({...p}),screenToWorld:p=>({...p}),eventPoint:e=>({x:e.x,y:e.y}),
 nearestLabel:()=>null,snap:p=>({...p}),paint:()=>{},checkpoint:()=>{sandbox.checkpoints++},
 commitEditor:()=>{sandbox.commits++},touch:()=>{},editItem:()=>{sandbox.edits++},
 setTool:key=>{sandbox.mode=key},
 uid:()=>`new-note-${++sandbox.ids}`,
 finishDraw:item=>{sandbox.selected=item.id;sandbox.mode='select'},
 openRichNote:()=>{throw Error('Creating an empty note must not open a modal')},
 checkpoints:0,commits:0,edits:0,ids:0,console
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
// Prázdná poznámka vznikne jedním dotykem bez otevření formuláře.
sandbox.mode='note';
sandbox.selected=null;
pointer('Down',350,350);
pointer('Up',350,350);
assert.equal(sandbox.current.items.length,2,'Tap must create a note without text or photo');
const empty=sandbox.current.items[1];
assert.equal(empty.text,'','New note remains textless');
assert.equal(empty.a.x,350,'Arrow anchor is the tapped point');
assert.equal(empty.captionMoved,undefined,'Connector stays hidden until moved');
// První přesunutí prázdného rámečku samo vykreslí propojení.
pointer('Down',350,350);
pointer('Move',520,450);
pointer('Up',520,450);
assert.equal(empty.a.x,350,'Dragging empty note must not move anchor');
assert.equal(empty.b.x,520,'Dragging empty note moves the frame');
assert.equal(empty.b.y,450,'Dragging empty note moves the frame');
assert.equal(empty.captionMoved,true,'Arrow appears after first drag without text or photo');
// Ověřit i skutečný směr hrotu, ne pouze pozice v datovém modelu.
const ops=[];
const pen={save(){},restore(){},beginPath(){},moveTo(x,y){ops.push(['M',x,y])},
 lineTo(x,y){ops.push(['L',x,y])},stroke(){}};
sandbox.testContext=pen;sandbox.testItem=empty;
vm.runInContext("drawNoteLeader(testContext,testItem,'#ffee22')",sandbox);
const starts=ops.filter(o=>o[0]==='M');
assert.equal(starts.length,3,'Connector and two arrowhead arms use separate paths');
for(const head of starts.slice(1)){
 assert.equal(head[1],350,'Both arrowhead arms must start at original photo point (X)');
 assert.equal(head[2],350,'Both arrowhead arms must start at original photo point (Y)');
}
// Hrot jde přemístit i u úplně prázdné poznámky a rámeček zůstane.
pointer('Down',350,350);
pointer('Move',370,380);
pointer('Up',370,380);
assert.equal(empty.a.x,370);
assert.equal(empty.a.y,380);
assert.equal(empty.b.x,520);
assert.equal(empty.b.y,450);
assert.equal(sandbox.commits,5,'Both old note and new empty note operations saved');
console.log('OK: note without text/media, automatic arrow at fixed photo point, independent handles');
