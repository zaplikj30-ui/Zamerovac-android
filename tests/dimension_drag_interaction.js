/* Kóta: táhnutí za střed posune oba body; za konec jen jeden. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const extract=(a,b)=>{
 const i=src.indexOf(a),j=src.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Cannot find editor methods: '+a);
 return src.slice(i,j);
};
const code=[
 extract('function labelInfo(item){','function editItem(item){')
];
const dim={id:'d1',type:'dimension',a:{x:100,y:200},b:{x:300,y:200},
 measure:'200',unit:'mm',offset:0,fontSize:17};
const ctx={
 current:{items:[dim]},photoSize:{w:600,h:600},screen:'editor',mode:'select',selected:null,
 selectedHandle:null,pointers:new Map(),stageCanvas:{setPointerCapture(){},releasePointerCapture(){}},
 gesture:null,drawStart:null,drawCurrent:null,drag:null,drawPointerId:null,
 magnifierPoint:null,loupeSide:null,stroke:[],prefs:{fontSize:17,unit:'mm'},
 view:{zoom:1,dx:0,dy:0},ctx:{font:'',save(){},restore(){},measureText(t){return{width:t.length*9}}},
 worldToScreen:p=>({...p}),screenToWorld:p=>({...p}),eventPoint:e=>({x:e.x,y:e.y}),
 nearestLabel:()=>null,snap:p=>({...p}),paint:()=>{},
 checkpoint:()=>{ctx.checkpoints++},commitEditor:()=>{ctx.commits++},
 touch:()=>{},editItem:()=>{ctx.edits++},setTool:k=>{ctx.mode=k},
 checkpoints:0,commits:0,edits:0,console
};
vm.createContext(ctx);
vm.runInContext(code.join('\n'),ctx);
function pointer(name,x,y){
 ctx.pointerEvent={x,y,pointerId:1,button:0,preventDefault(){}};
 vm.runInContext('stage'+name+'(pointerEvent)',ctx);
}
pointer('Down',200,200);
pointer('Move',240,240);
pointer('Up',240,240);
assert.deepEqual([dim.a.x,dim.a.y,dim.b.x,dim.b.y],[140,240,340,240]);
assert.equal(dim.measure,'200','Midpoint drag must preserve measurement text');
assert.equal(ctx.commits,1);
pointer('Down',140,240);
pointer('Move',160,210);
pointer('Up',160,210);
assert.deepEqual([dim.a.x,dim.a.y,dim.b.x,dim.b.y],[160,210,340,240]);
assert.equal(ctx.commits,2);
assert.equal(ctx.edits,0);
console.log('OK: dragging center moves whole dimension, dragging tip moves one endpoint');