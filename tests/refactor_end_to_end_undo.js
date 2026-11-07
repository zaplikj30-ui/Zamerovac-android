/* Integration regression for refactored B1-B5 editor.
 * Executes real stageDown/Move/Up and original checkpoint/undo/redo functions.
 * No fake stage handlers or mocked measurements; only native UI/media boundary is stubbed.
 */
'use strict';
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const asset=name=>fs.readFileSync('app/src/main/assets/'+name,'utf8');
const editor=asset('editor.js');
function extract(start,end){
 const a=editor.indexOf(start),b=editor.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing editor function boundary: '+start);
 return editor.slice(a,b);
}
const app={
 window:{},
 current:{id:'photo',kind:'photo',items:[{
  id:'dimension-1',type:'dimension',a:{x:100,y:200},b:{x:300,y:200},
  measure:'1585,800001',unit:'mm',offset:0
 }]},
 screen:'editor',mode:'select',stageImg:{},
 stageCanvas:{setPointerCapture(){},releasePointerCapture(){}},
 photoSize:{w:1000,h:800},view:{zoom:1,dx:0,dy:0},
 prefs:{unit:'mm',fontSize:17,lineWidth:2,color:'#f7dc27',snapGrid:false},
 selected:null,selectedHandle:null,pointers:new Map(),gesture:null,
 drawStart:null,drawCurrent:null,stroke:[],polylineDraft:[],lastTapAt:null,lastTap:0,
 drag:null,drawPointerId:null,magnifierPoint:null,loupeSide:null,
 editStack:[],redoStack:[],saves:0,opens:0,
 ctx:{save(){},restore(){},font:'',measureText:t=>({width:String(t).length*9})},
 eventPoint:e=>({x:e.x,y:e.y}),
 nearestLabel:()=>null,nearestSegmentLabel:()=>null,
 noteCaptionBounds:()=>null,noteCaptionScreen:()=>({x:0,y:0}),
 noteDisplayedCaption:()=>'',snap:p=>({...p}),
 paint(){},touch(){},
 save(){app.saves++;return true},
 setTool(key){app.mode=key},editItem(){app.opens++}
};
vm.createContext(app);
vm.runInContext(asset('annotation-geometry.js'),app);
vm.runInContext(asset('annotation-selection.js'),app);
vm.runInContext(asset('annotation-translation.js'),app);
vm.runInContext(asset('annotation-resize.js'),app);
app.worldToScreen=p=>app.AnnotationGeometry.worldToScreen(p,app.view);
app.screenToWorld=p=>app.AnnotationGeometry.screenToWorld(p,app.view);
app.boundsPoint=p=>app.AnnotationGeometry.boundsPoint(p,app.photoSize);
const selectedCode=[
 extract('function checkpoint(){',"$('undo').onclick="),
 extract('function nearestHandle(point,onlyItem=null){','function hitAnnotation(point){'),
 extract('function hitAnnotation(point){','function completePolyline(kind='),
 extract('function stageDown(e){','function protectAnnotationModalOnBack(')
].join('\n');
vm.runInContext(selectedCode,app);
const event=(type,x,y)=>app['stage'+type]({x,y,pointerId:1,button:0,preventDefault(){}});
const item=()=>app.current.items[0];
const before=JSON.stringify(item());
event('Down',200,200);
event('Move',240,240);
event('Up',240,240);
assert.deepEqual([item().a.x,item().a.y,item().b.x,item().b.y],[140,240,340,240]);
assert.equal(item().measure,'1585,800001','Never change exact stored laser reading on drag');
assert.equal(app.editStack.length,1,'One history checkpoint for one drag');
assert.equal(app.redoStack.length,0);
app.undoEditor();
assert.equal(JSON.stringify(item()),before,'Undo restores precise original model');
app.redoEditor();
assert.deepEqual([item().a.x,item().a.y,item().b.x,item().b.y],[140,240,340,240]);
assert.equal(item().measure,'1585,800001');
const afterRedo=JSON.stringify(item());
app.selected=null;
event('Down',140,240);
event('Move',142,241);
event('Up',142,241);
assert.equal(JSON.stringify(item()),afterRedo,'2px tap jitter must not mutate geometry');
assert.equal(app.editStack.length,1,'Jitter must not add undo entry');
assert.equal(app.saves,3,'Real commit+undo+redo saved, selection itself did not save');
assert.equal(app.opens,0,'First-tap selection never opens edit dialog');
// B6: integrated polyline drag and complete Undo/Redo through real editor handlers.
const polyline={id:'poly-1',type:'polyline',
 points:[{x:100,y:100},{x:280,y:100},{x:280,y:260}],
 a:{x:100,y:100},b:{x:280,y:260},
 measure:'1585,800001',segmentData:[{measure:'120,000001',unit:'mm'}]};
app.current.items=[polyline];app.selected=null;app.editStack=[];app.redoStack=[];
const beforePolylineSaves=app.saves;
// Selection stores the active segment index before checkpointing the drag.
// Record that selection state as the baseline; it is not a geometry change.
event('Down',190,100);event('Up',190,100);
const beforePolyline=JSON.stringify(app.current.items[0]);
event('Down',190,100);event('Move',250,150);event('Up',250,150);
assert.deepEqual(polyline.points.map(p=>[p.x,p.y]),[[160,150],[340,150],[340,310]]);
assert.deepEqual(polyline.a,{x:160,y:150});assert.deepEqual(polyline.b,{x:340,y:310});
assert.equal(polyline.measure,'1585,800001');
assert.equal(polyline.segmentData[0].measure,'120,000001');
assert.equal(app.editStack.length,1,'One checkpoint for complete polyline drag');
assert.equal(app.saves,beforePolylineSaves+1,'Selection did not persist; drag did');
const afterPolyline=JSON.stringify(app.current.items[0]);
app.undoEditor();
assert.equal(JSON.stringify(app.current.items[0]),beforePolyline,'Polyline Undo restores pre-drag model');
app.redoEditor();
assert.equal(JSON.stringify(app.current.items[0]),afterPolyline,'Polyline Redo restores exact polyline');
app.selected=null;
event('Down',250,150);event('Move',252,151);event('Up',252,151);
assert.equal(JSON.stringify(app.current.items[0]),afterPolyline,'Tap jitter cannot move polyline');
assert.equal(app.editStack.length,1,'Tap jitter must not add history');
console.log('PASS: B1-B6 dimension and polyline, actual drag/Undo/Redo, precise saved values and jitter');
