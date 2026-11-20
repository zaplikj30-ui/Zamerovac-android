/* Diagnose dimension gestures from the actual opt-in recorder without sending geometry.
 * V8 synthetic browser: NOT a physical Android/S Pen test. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/flight-recorder.js','utf8');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const help=fs.readFileSync('app/src/main/assets/help.js','utf8');
const storage=new Map();
const root={localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
 addEventListener(){},document:{visibilityState:'visible',addEventListener(){}},Native:{getAppVersion:()=> '1.4.1-test'}};
vm.runInNewContext(source,{window:root,performance:{now:()=>0},Date,JSON,Object,Number,
 setTimeout:()=>1,clearTimeout(){},setInterval:()=>1,clearInterval(){}});
const flight=root.ZFlight;
assert.equal(typeof flight.recordDimensionGesture,'function');
const a={x:0,y:0},b={x:100,y:0};
function classify(kind,fromA,fromB,toA,toB){
 const count=flight.snapshot().events.length;
 const ok=flight.recordDimensionGesture(kind,fromA,fromB,toA,toB,
  {undoCount:3,itemCount:10,dimensionCount:10,x:123456789,measure:987654});
 if(!ok)return null;
 const events=flight.snapshot().events;
 assert.equal(events.length,count+1,'one event per completed gesture');
 const event=events.at(-1);
 assert.equal(event.values.undoCount,3);
 assert.equal(Object.hasOwn(event.values,'x'),false,'no coordinates');
 assert.equal(Object.hasOwn(event.values,'measure'),false,'no laser values');
 return event.type;
}
assert.equal(classify('move-dimension',a,b,{x:8,y:15},{x:108,y:15}),null,'disabled recording must produce no event');
flight.toggle(true);
assert.equal(classify('move-dimension',a,b,{x:8,y:15},{x:108,y:15}),'dimension-move');
assert.equal(classify('point',a,b,a,{x:0,y:100}),'dimension-rotate');
assert.equal(classify('point',a,b,a,{x:140,y:0}),'dimension-resize');
assert.equal(classify('point',a,b,a,{x:100,y:100}),'dimension-rotate-resize');
assert.equal(classify('point',a,b,a,{x:100.01,y:0.001}),'dimension-point-adjust');
assert.equal(classify('label',a,b,a,{x:200,y:0}),null,'label drags cannot pretend to resize kóta');
assert.equal(classify('point',{x:NaN,y:0},b,a,b),null,'invalid coordinates must be rejected');
assert.equal(flight.snapshot().events.filter(e=>e.type.startsWith('dimension-')).length,5);
assert.equal(flight.report().includes('"x"'),false,'report must not include coordinates');
assert.equal(flight.report().includes('"measure"'),false,'report must not include measurement');
assert.match(editor,/candidate\.type==='dimension'&&\['point','move-dimension'\]/,
 'dimension endpoints must be captured before drag');
assert.match(editor,/window\.ZFlight\?\.recordDimensionGesture\?\./,
 'real editor completion must dispatch classification');
assert.match(editor,/if\(!classified\)window\.ZFlight\?\.record\('drag-release'/,
 'non-dimension drags must retain generic record');
assert.match(help,/posun celé kóty, otočení, změnu délky/,'offline help');
flight.toggle(false);
assert.equal(classify('point',a,b,a,{x:50,y:0}),null,'disabled again');
console.log('PASS: move, rotate, resize, mixed, tiny, cancel/non-dimension, privacy and production hooks');
