/* B8: real editor handlers; no synthetic replacements for stageDown/Move/Up. */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const asset=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const editor=asset('editor.js');
function section(a,b){
 const i=editor.indexOf(a),j=editor.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,'Missing production boundary '+a);
 return editor.slice(i,j);
}
const app={
 window:{},current:{id:'photo',kind:'photo',items:[{id:'dim',type:'dimension',
  a:{x:100,y:200},b:{x:300,y:200},measure:'1585,800001',
  laserMeasuredMm:1585.800001,unit:'mm',offset:0}]},
 screen:'editor',mode:'select',stageImg:{},selected:null,selectedHandle:null,
 stageCanvas:{setPointerCapture(){},releasePointerCapture(){},addEventListener(type,cb){if(type==='pointercancel')app.cancel=cb}},
 photoSize:{w:1000,h:800},view:{zoom:1,dx:0,dy:0},
 prefs:{unit:'mm',fontSize:17,lineWidth:2,color:'#f7dc27',snapGrid:false},
 pointers:new Map(),gesture:null,drawStart:null,drawCurrent:null,stroke:[],polylineDraft:[],
 lastTapAt:null,lastTap:0,drag:null,drawPointerId:null,magnifierPoint:null,loupeSide:null,
 editStack:[],redoStack:[],saves:0,opens:0,
 ctx:{save(){},restore(){},font:'',measureText:t=>({width:String(t).length*9})},
 eventPoint:e=>({x:e.x,y:e.y}),nearestLabel:()=>null,nearestSegmentLabel:()=>null,
 noteCaptionBounds:()=>null,noteCaptionScreen:()=>({x:0,y:0}),noteDisplayedCaption:()=>'',
 snap:p=>({...p}),paint(){},touch(){},save(){app.saves++;return true},
 setTool:k=>{app.mode=k},editItem(){app.opens++},
 hideEditorLoupe(){app.pointers.clear()},finishPendingPath(){},showFolder(){}
};
vm.createContext(app);
for(const module of ['annotation-geometry.js','annotation-selection.js','annotation-translation.js','annotation-resize.js'])
 vm.runInContext(asset(module),app);
app.worldToScreen=p=>app.AnnotationGeometry.worldToScreen(p,app.view);
app.screenToWorld=p=>app.AnnotationGeometry.screenToWorld(p,app.view);
app.boundsPoint=p=>app.AnnotationGeometry.boundsPoint(p,app.photoSize);
vm.runInContext([
 section('function exitEditor(){',"$('editorBack').onclick="),
 section('function checkpoint(){',"$('undo').onclick="),
 section('function nearestHandle(point,onlyItem=null){','function hitAnnotation(point){'),
 section('function hitAnnotation(point){','function completePolyline(kind='),
 section('function stageDown(e){','function protectAnnotationModalOnBack(')
].join('\n'),app);
const i=editor.indexOf("stageCanvas.addEventListener('pointercancel',"),
 j=editor.indexOf("stageCanvas.addEventListener('wheel',",i);
assert(i>=0&&j>i);
vm.runInContext(editor.slice(i,j),app);
const pointer=(name,x,y,id=1)=>app['stage'+name]({x,y,pointerId:id,button:0,preventDefault(){}});
const model=()=>JSON.stringify(app.current.items);
const exact=()=>{assert.equal(app.current.items[0].measure,'1585,800001');assert.equal(app.current.items[0].laserMeasuredMm,1585.800001)};
const original=model();
// Make one actual edit, then Undo: Redo is now a meaningful pending operation.
pointer('Down',200,200);pointer('Move',240,240);pointer('Up',240,240);
const moved=model();assert.notEqual(moved,original);assert.equal(app.editStack.length,1);
app.undoEditor();assert.equal(model(),original);assert.equal(app.redoStack.length,1);
const previousRedo=app.redoStack[0],saves=app.saves;
pointer('Down',200,200);pointer('Up',200,200);
pointer('Down',100,200);pointer('Move',102,201);pointer('Up',102,201);
assert.equal(app.redoStack[0],previousRedo);assert.equal(app.editStack.length,0);
assert.equal(app.saves,saves,'Tap or jitter saved an edit');
// Endpoint snapping to its opposite point is prohibited and must not consume Redo.
app.snap=()=>({...app.current.items[0].b});
pointer('Down',100,200);pointer('Move',135,200);pointer('Up',135,200);
assert.equal(model(),original);
assert.equal(app.redoStack[0],previousRedo);
assert.equal(app.saves,saves,'Rejected snap saved unchanged geometry');
app.snap=p=>({...p});
// A pinch initiated without a moved object may change zoom but not history.
pointer('Down',200,200);pointer('Down',280,210,2);pointer('Move',300,220,2);
pointer('Up',300,220,2);pointer('Up',200,200);
assert.equal(app.redoStack[0],previousRedo);assert.equal(app.editStack.length,0);
assert.equal(app.saves,saves,'Pinch generated spurious saved edit');
app.view={zoom:1,dx:0,dy:0};
app.redoEditor();assert.equal(model(),moved);exact();
// Interruption by second finger after a real drag must save that edit once.
app.undoEditor();assert.equal(model(),original);
const beforeSecondFinger=app.saves;
pointer('Down',200,200);pointer('Move',235,215);
const duringDrag=model();assert.notEqual(duringDrag,original);
pointer('Down',300,250,2);
assert.equal(app.saves,beforeSecondFinger+1,'Second finger lost an actual drag');
assert.equal(app.editStack.length,1);
pointer('Up',300,250,2);pointer('Up',235,215);
app.undoEditor();assert.equal(model(),original);
app.redoEditor();assert.equal(model(),duringDrag);exact();
// Native pointercancel must save a real movement, without losing the checkpoint.
const beforeCancel=model(),savesBeforeCancel=app.saves;
pointer('Down',235,215);pointer('Move',265,235);
app.cancel({pointerId:1});
assert.equal(app.saves,savesBeforeCancel+1);
assert.equal(app.editStack.length,2);
app.undoEditor();assert.equal(model(),beforeCancel);
const pendingRedo=app.redoStack.at(-1);
pointer('Down',135,215);app.cancel({pointerId:1});
assert.equal(app.redoStack.at(-1),pendingRedo,'Cancel without a drag removed Redo');

 // B12: a one-finger pan must end when a second finger starts a pinch.
 // Otherwise the remaining finger jumps back to stale pre-pinch offsets.
 app.mode='pan';app.selected=null;app.view={zoom:1,dx:0,dy:0};
 const panItems=model(),panSaves=app.saves,panRedo=JSON.stringify(app.redoStack);
 pointer('Down',750,650);pointer('Move',780,665);
 assert.deepEqual([app.view.dx,app.view.dy],[30,15]);
 pointer('Down',880,660,2);
 assert.equal(app.drag,null,'Starting a pinch must end previous pan');
 pointer('Move',910,680,2);
 const pinchView={...app.view};
 assert.notEqual(pinchView.zoom,1,'Pinch must zoom after a pan');
 pointer('Up',910,680,2);
 pointer('Move',785,670);
 assert.deepEqual(app.view,pinchView,'Remaining finger must not resume stale pan');
 pointer('Up',785,670);
 // A fresh contact must allow normal one-finger panning.
 pointer('Down',750,650);pointer('Move',765,660);pointer('Up',765,660);
 assert.equal(app.view.dx,pinchView.dx+15);
 assert.equal(app.view.dy,pinchView.dy+10);
 // Cancellation of one pinch pointer clears stale gesture state.
 pointer('Down',750,650);pointer('Move',765,660);
 pointer('Down',900,650,2);pointer('Move',930,650,2);
 const beforeCancel={...app.view};
 app.cancel({pointerId:2});
 assert.equal(app.gesture,null,'Cancelled pinch must reset gesture');
 pointer('Move',780,670);
 assert.deepEqual(app.view,beforeCancel,'Cancelled pinch must not restart old pan');
 pointer('Up',780,670);
 assert.equal(model(),panItems,'Viewport gestures changed annotation coordinates');
 assert.equal(app.saves,panSaves,'Viewport gestures saved a measurement');
 assert.equal(JSON.stringify(app.redoStack),panRedo,'Viewport gestures erased Redo');
 app.mode='select';app.view={zoom:1,dx:0,dy:0};
// No history eviction, even if a tap happens when Undo is at capacity.
app.editStack=['oldest',...Array.from({length:49},(_,x)=>'history-'+x)];
app.redoStack=['future'];
pointer('Down',235,215);pointer('Up',235,215);
assert.equal(app.editStack.length,50);assert.equal(app.editStack[0],'oldest');
assert.deepEqual(app.redoStack,['future']);
// Exit during movement must save geometry once before closing the editor.
app.editStack=[];app.redoStack=[];app.selected=null;
pointer('Down',235,215);pointer('Move',255,225);
const beforeExit=app.saves;
app.exitEditor();
assert.equal(app.saves,beforeExit+1);
assert.equal(app.editStack.length,1);
assert.equal(app.screen,'browser');assert.equal(app.current,null);
console.log('PASS B8: tap, jitter, snap rejection, pinch, cancel, exit and exact Undo/Redo');
