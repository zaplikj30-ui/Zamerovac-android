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
 // The label-hit test executes editor methods in isolation; include their shared
 // caption formatter just as the full editor does.
 extract('function measureDisplay(', 'function drawItem('),
 extract('function labelInfo(item){','function editItem(item){')
];
const dim={id:'d1',type:'dimension',a:{x:100,y:200},b:{x:300,y:200},
 measure:'200',unit:'mm',offset:0,fontSize:17};
const ctx={
 window:{},current:{items:[dim]},photoSize:{w:600,h:600},screen:'editor',mode:'select',selected:null,
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
vm.createContext(ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-geometry.js','utf8'),ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-selection.js','utf8'),ctx);vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-translation.js','utf8'),ctx);
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

// Issue #23: a tap can emit a tiny pointermove. Even when an aggressive snap
// would target another endpoint, selecting/editing may NEVER mutate geometry.
ctx.editStack=[];
ctx.checkpoint=()=>{ctx.checkpoints++;ctx.editStack.push(JSON.stringify(ctx.current.items))};
for(const kind of ['dimension','line']){
 const annotation={id:'stable-'+kind,type:kind,
  a:{x:100,y:120},b:{x:300,y:120},
  measure:kind==='dimension'?'1585,8':'',unit:'mm'};
 ctx.current.items=[annotation];ctx.selected=null;ctx.mode='select';
 // Simulate a magnet offering the opposite point of this annotation.
 ctx.snap=()=>({...annotation.b});
 const original=JSON.stringify(annotation);
 for(let n=0;n<2;n++){
  pointer('Down',100,120);
  pointer('Move',102,121); // Android touch jitter below 7 px
  assert.equal(JSON.stringify(annotation),original,kind+' tap jitter changed coordinates');
  pointer('Up',102,121);
  assert.equal(JSON.stringify(annotation),original,kind+' double tap changed coordinates');
 }
 // A meaningful drag may not collapse the same annotation to zero length.
 pointer('Down',100,120);pointer('Move',135,120);pointer('Up',135,120);
 assert.equal(JSON.stringify(annotation),original,kind+' snapped endpoint collapsed its own line');
 // Genuine dragging must still work when snapping does not create a collapse.
 ctx.snap=p=>({...p});
 pointer('Down',100,120);pointer('Move',125,140);pointer('Up',125,140);
 assert.equal(annotation.a.x,125,kind+' valid endpoint drag must remain possible');
 assert.equal(annotation.a.y,140,kind+' valid endpoint drag must remain possible');
 assert.equal(annotation.b.x,300,kind+' opposite endpoint must remain fixed');
}
console.log('OK: dragging endpoints works, tiny double taps never change or collapse dimensions/lines');