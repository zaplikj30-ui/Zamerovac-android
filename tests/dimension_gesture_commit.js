/* Real editor completion contract, synthetic JS environment. NOT Android/S Pen. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const source=fs.readFileSync('app/src/main/assets/flight-recorder.js','utf8');
const a=editor.indexOf('function finishHandleGesture(handle){');
const b=editor.indexOf('function commitEditor(){',a);
assert(a>=0&&b>a,'production completion function');
const completion=editor.slice(a,b);
const store=new Map(),window={localStorage:{getItem:k=>store.get(k)||null,
 setItem:(k,v)=>store.set(k,v),removeItem:k=>store.delete(k)},
 addEventListener(){},document:{visibilityState:'visible',addEventListener(){}}};
vm.runInNewContext(source,{window,performance:{now:()=>0},Date,JSON,Object,Number,
 setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
const flight=window.ZFlight;flight.toggle(true);
const p={x:0,y:0},q={x:100,y:0};
function complete(kind,startA,startB,endA,endB,{dragged=true,type='dimension'}={}){
 const before={id:'dim1',type,a:startA,b:startB,measure:'1250',unit:'mm'};
 const item={...before,a:endA,b:endB};
 const handle={item,kind,dragged,beforeDragItems:JSON.stringify([before]),
  diagnosticStartA:startA,diagnosticStartB:startB};
 const out={value:null,redo:null},stats={history:0,commit:0,touch:0};
 const scope={window:{ZFlight:flight},handle,current:{items:[item]},out,
  editStack:[],redoStack:[{prior:true}],AnnotationHistory:{
   recordSnapshot(_s,list){stats.history++;list.push('checkpoint')}
  },touch(){stats.touch++},commitEditor(){stats.commit++},JSON,Object,Array};
 const count=flight.snapshot().events.length;
 vm.runInNewContext(completion+'\nout.value=finishHandleGesture(handle);out.redo=redoStack;',scope);
 return {result:out.value,redo:out.redo,stats,item,
  recorded:flight.snapshot().events.length-count,last:flight.snapshot().events.at(-1)?.type};
}
let r=complete('move-dimension',p,q,{x:15,y:11},{x:115,y:11});
assert.equal(r.result,true);assert.equal(r.recorded,1);assert.equal(r.last,'dimension-move');
assert.equal(r.stats.history,1);assert.equal(r.stats.commit,1);assert.equal(r.redo.length,0);
assert.equal(r.item.measure,'1250');assert.equal(r.item.unit,'mm');
assert.equal(complete('point',p,q,p,{x:0,y:100}).last,'dimension-rotate');
assert.equal(complete('point',p,q,p,{x:140,y:0}).last,'dimension-resize');
assert.equal(complete('point',p,q,p,{x:100,y:100}).last,'dimension-rotate-resize');
assert.equal(complete('point',p,q,p,{x:0,y:100},{type:'line'}).last,'drag-release');
r=complete('point',p,q,p,{x:0,y:100},{dragged:false});
assert.equal(r.result,false);assert.equal(r.recorded,0);assert.equal(r.stats.commit,0);
r=complete('point',p,q,p,q);
assert.equal(r.result,false);assert.equal(r.recorded,0);
flight.toggle(false);
r=complete('point',p,q,p,{x:140,y:0});
assert.equal(r.recorded,0);assert.equal(r.stats.commit,1);
console.log('PASS production editor: move, rotate, stretch, mixed; Undo, tap/no-change, non-dimension and disabled');
