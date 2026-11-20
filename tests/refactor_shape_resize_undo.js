/* B7 full gesture -> model -> Undo/Redo integration for four editable shapes.
 * Executes production stageDown/Move/Up and history functions, stubbing only UI/I/O.
 */
'use strict';
const {installEditorPaintScheduler}=require('./helpers/editor_move_scheduler.cjs');
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const asset=name=>fs.readFileSync('app/src/main/assets/'+name,'utf8');
const plain=x=>JSON.parse(JSON.stringify(x));
const editor=asset('editor.js');
function extract(start,end){
 const a=editor.indexOf(start),b=editor.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing editor boundary '+start);
 return editor.slice(a,b);
}
const code=[
 extract('function checkpoint(){',"$('undo').onclick="),
 extract('function nearestHandle(point,onlyItem=null){','function hitAnnotation(point){'),
 extract('function hitAnnotation(point){','function completePolyline(kind='),
 extract('function stageDown(e){','function protectAnnotationModalOnBack(')
].join('\n');
function runShape(type,shape,from,to,check){
 const original={id:'resize-'+type,type,...shape,measure:'1585,800001',
  laserMeasuredMm:1585.800001,unit:'mm'};
 const ctx={
  window:{},current:{id:'photo',kind:'photo',items:[original]},screen:'editor',
  mode:'select',stageImg:{},selected:null,selectedHandle:null,
  stageCanvas:{setPointerCapture(){},releasePointerCapture(){}},
  photoSize:{w:1000,h:800},view:{zoom:1,dx:0,dy:0},
  prefs:{unit:'mm',fontSize:17,lineWidth:2,color:'#f7dc27',snapGrid:false},
  pointers:new Map(),gesture:null,drawStart:null,drawCurrent:null,stroke:[],
  polylineDraft:[],lastTapAt:null,lastTap:0,drag:null,drawPointerId:null,
  magnifierPoint:null,loupeSide:null,editStack:[],redoStack:[],saves:0,
  ctx:{save(){},restore(){},font:'',measureText:s=>({width:String(s).length*9})},
  eventPoint:e=>({x:e.x,y:e.y}),nearestLabel:()=>null,
  nearestSegmentLabel:()=>null,noteCaptionBounds:()=>null,
  noteCaptionScreen:()=>({x:0,y:0}),noteDisplayedCaption:()=>'',snap:p=>({...p}),
  paint(){},touch(){},save(){ctx.saves++;return true},setTool:x=>{ctx.mode=x},
  editItem(){throw Error('Shape resize accidentally opened edit modal')}
 };
 vm.createContext(ctx);
 installEditorPaintScheduler(vm,ctx,editor);
 for(const module of ['annotation-geometry.js','annotation-selection.js',
  'annotation-translation.js','annotation-resize.js','annotation-history.js'])
  vm.runInContext(asset(module),ctx);
 ctx.worldToScreen=p=>ctx.AnnotationGeometry.worldToScreen(p,ctx.view);
 ctx.screenToWorld=p=>ctx.AnnotationGeometry.screenToWorld(p,ctx.view);
 ctx.boundsPoint=p=>ctx.AnnotationGeometry.boundsPoint(p,ctx.photoSize);
 ctx.resizePoints=item=>ctx.AnnotationGeometry.resizePoints(item);
 vm.runInContext(code,ctx);
 function event(name,p){ctx['stage'+name]({x:p.x,y:p.y,pointerId:1,button:0,preventDefault(){}})}
 event('Down',from);event('Up',from); // selection, not data edit
 const before=JSON.stringify(ctx.current.items[0]);
 assert.equal(ctx.saves,0,type+' selection is not a save');
 event('Down',from);event('Move',to);event('Up',to);
 const moved=ctx.current.items[0];
 check(moved);
 assert.equal(moved.measure,'1585,800001',type+' changed exact measure');
 assert.equal(moved.laserMeasuredMm,1585.800001,type+' changed raw laser');
 assert.equal(ctx.editStack.length,1,type+' should have one checkpoint');
 assert.equal(ctx.saves,1,type+' should save once after drag');
 const after=JSON.stringify(moved);
 ctx.undoEditor();
 assert.equal(JSON.stringify(ctx.current.items[0]),before,type+' Undo restores model');
 ctx.redoEditor();
 assert.equal(JSON.stringify(ctx.current.items[0]),after,type+' Redo restores model');
 assert.equal(ctx.saves,3,type+' save/undo/redo should each persist');
 return type;
}
runShape('rect',{a:{x:100,y:100},b:{x:300,y:300}},
 {x:100,y:100},{x:350,y:370},item=>{
  assert.deepEqual(plain(item.a),{x:300,y:300});assert.deepEqual(plain(item.b),{x:350,y:370});
 });
runShape('area',{a:{x:20,y:20},b:{x:200,y:200},
 points:[{x:20,y:20},{x:200,y:20},{x:200,y:200},{x:20,y:200}],
 sideMeasures:['100,000001','200','300','400']},
 {x:20,y:20},{x:40,y:45},item=>{
  assert.deepEqual(plain(item.points[0]),{x:40,y:45});
  assert.deepEqual(plain(item.points[1]),{x:200,y:20});
  assert.equal(item.sideMeasures[0],'100,000001');
 });
runShape('circle',{a:{x:50,y:50},b:{x:150,y:150}},
 {x:50,y:100},{x:30,y:100},item=>{
  assert.deepEqual(plain(item.a),{x:30,y:30});assert.deepEqual(plain(item.b),{x:170,y:170});
 });
runShape('ellipse',{a:{x:100,y:100},b:{x:300,y:200}},
 {x:100,y:150},{x:60,y:150},item=>{
  assert.deepEqual(plain(item.a),{x:60,y:100});assert.deepEqual(plain(item.b),{x:340,y:200});
 });
console.log('PASS B7: real rect/area/circle/ellipse gesture, Undo/Redo, exact laser and side values');
