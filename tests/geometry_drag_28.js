/* Functional VM regressions for precise 28-test geometry interactions. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const a=src.indexOf('function rectCorners(item){'),b=src.indexOf('function editItem(item){',a);
assert.ok(a>=0&&b>a);
function scenario(item,selected=true){
 const env={
  window:{},current:{id:'photo',items:[item]},photoSize:{w:1000,h:800},screen:'editor',mode:'select',
  selected:selected?item.id:null,selectedHandle:null,pointers:new Map(),gesture:null,
  stageCanvas:{setPointerCapture(){},releasePointerCapture(){}},drawStart:null,drawCurrent:null,drag:null,drawPointerId:null,
  magnifierPoint:null,loupeSide:null,stroke:[],polylineDraft:[],lastTapAt:null,lastTap:0,
  prefs:{fontSize:17,lineWidth:2,color:'#fbd000',unit:'mm',snapGrid:false},
  view:{zoom:1,dx:0,dy:0},ctx:{save(){},restore(){},font:'',measureText:t=>({width:String(t).length*8})},
  worldToScreen:x=>({...x}),screenToWorld:x=>({...x}),eventPoint:e=>({x:e.x,y:e.y}),
  snap:p=>({...p}),paint(){},touch(){},checkpoint(){env.undo++},commitEditor(){env.commits++},
  editItem(){env.edits++},setTool(name){env.mode=name},notify(){},
  editStack:[],redoStack:[],undo:0,commits:0,edits:0,console,Math,Number,String,window:{},
  boundsPoint:p=>({x:Math.max(0,Math.min(1000,p.x)),y:Math.max(0,Math.min(800,p.y))})
 };
 vm.createContext(env);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-geometry.js','utf8'),env);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-selection.js','utf8'),env);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-translation.js','utf8'),env);vm.runInContext(src.slice(a,b),env);
 function pointer(method,x,y){
   env.pointerEvent={x,y,pointerId:1,button:0,preventDefault(){}};
   vm.runInContext('stage'+method+'(pointerEvent)',env);
 }
 return {env,pointer,item};
}
const quad={id:'area1',type:'area',a:{x:20,y:20},b:{x:200,y:200},
 points:[{x:20,y:20},{x:200,y:20},{x:200,y:200},{x:20,y:200}],
 sideMeasures:['','','','']};
let v=scenario(quad);
v.pointer('Down',20,20);v.pointer('Move',40,45);v.pointer('Up',40,45);
assert.equal(quad.points[0].x,40);assert.equal(quad.points[0].y,45);
assert.deepEqual(quad.points.slice(1).map(p=>p.x),[200,200,20],'Other quadrilateral corners unchanged');
const circle={id:'circle1',type:'circle',a:{x:50,y:50},b:{x:150,y:150}};
v=scenario(circle);
v.pointer('Down',50,100);v.pointer('Move',30,100);v.pointer('Up',30,100);
assert.equal((circle.a.x+circle.b.x)/2,100,'Circle center unchanged when resizing handle');
assert.equal((circle.a.y+circle.b.y)/2,100);
assert.equal(circle.a.x,30,'Circle radius increases when edge handle moved');
const cross={id:'target1',type:'target',a:{x:100,y:100},b:{x:160,y:130},measure:'500',text:'Voda'};
v=scenario(cross);
v.pointer('Down',160,130);v.pointer('Move',190,160);v.pointer('Up',190,160);
assert.deepEqual(cross.a,{x:100,y:100},'Target marker stays while label moves');
assert.deepEqual(cross.b,{x:190,y:160},'Target label independent movement');
console.log('OK: independent four polygon corners, circle contour grip and target caption');
