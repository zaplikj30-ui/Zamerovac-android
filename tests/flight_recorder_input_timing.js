'use strict';
// Run: node tests/flight_recorder_input_timing.js
// Synthetic WebView event callbacks; NOT a physical Android input test.
const assert=require('assert');
const fs=require('fs');
const path=require('path');
const vm=require('vm');
const source=fs.readFileSync(path.join(__dirname,'..','app','src','main','assets','flight-recorder.js'),'utf8');
const editor=fs.readFileSync(path.join(__dirname,'..','app','src','main','assets','editor.js'),'utf8');
assert(editor.includes("window.ZFlight?.attachEditorInput?.(stageCanvas);"));
const callbacks={};
const doc={visibilityState:'visible',addEventListener(){}};
const map=new Map();
const localStorage={
 getItem:key=>map.has(key)?map.get(key):null,
 setItem:(key,value)=>map.set(key,value),
 removeItem:key=>map.delete(key)
};
let now=1000;
const root={localStorage,document:doc,addEventListener(){}};
vm.runInNewContext(source,{
 window:root,performance:{now:()=>now},
 setInterval:()=>7,clearInterval(){},
 setTimeout:()=>9,clearTimeout(){},
 Date
},{filename:'flight-recorder.js'});
const recorder=root.ZFlight;
const canvas={addEventListener:(type,fn,options)=>{
 (callbacks[type]||(callbacks[type]=[])).push({fn,options});
}};
assert.strictEqual(recorder.attachEditorInput(canvas),true);
assert.strictEqual(recorder.attachEditorInput(canvas),true);
assert.strictEqual(callbacks.pointerdown.length,1);
for(const t of ['pointerdown','pointermove','pointerup','pointercancel']){
 assert.strictEqual(callbacks[t][0].options.capture,true);
 assert.strictEqual(callbacks[t][0].options.passive,true);
}
const emit=(type,id,kind,stamp)=>callbacks[type][0].fn({
 pointerId:id,pointerType:kind,timeStamp:stamp,clientX:839,clientY:451,pressure:0.7
});
// Disabled: no records.
emit('pointerdown',101,'touch',990);
assert.strictEqual(recorder.snapshot().events.length,0);
assert.strictEqual(recorder.toggle(true),true);
emit('pointerdown',101,'touch',990);
now=1010;emit('pointermove',101,'touch',1005);
now=1020;emit('pointermove',101,'touch',1015);
now=1040;emit('pointerup',101,'touch',1035);
let events=recorder.snapshot().events;
const down=events.find(e=>e.type==='input-down');
const up=events.find(e=>e.type==='input-up');
assert(down&&up);
assert.strictEqual(down.values.inputDelayMs,10);
assert.strictEqual(down.values.inputKind,1);
assert.strictEqual(down.values.activePointers,1);
assert.strictEqual(up.values.gestureMs,40);
assert.strictEqual(up.values.inputDelayMs,5);
assert.strictEqual(up.values.moveEvents,2);
assert.strictEqual(up.values.activePointers,0);
// Native epoch-based stamps cannot be compared with performance.now().
now=1100;emit('pointerdown',202,'pen',1700000000000);
let latest=recorder.snapshot().events.at(-1);
assert.strictEqual(latest.values.inputKind,2);
assert.strictEqual(Object.hasOwn(latest.values,'inputDelayMs'),false);
now=1120;emit('pointercancel',202,'pen',1119);
latest=recorder.snapshot().events.at(-1);
assert.strictEqual(latest.type,'input-cancel');
assert.strictEqual(latest.values.gestureMs,20);
// Out-of-order delivery: record orphan up without inventing a down.
now=1150;emit('pointerup',404,'touch',1145);
latest=recorder.snapshot().events.at(-1);
assert.strictEqual(latest.values.missingDown,1);
// Two simultaneous touches: retain only a count, never either raw pointer ID.
now=1160;emit('pointerdown',201,'touch',1159);
now=1170;emit('pointerdown',202,'pen',1169);
latest=recorder.snapshot().events.at(-1);
assert.strictEqual(latest.values.activePointers,2);
now=1180;emit('pointerup',202,'pen',1179);
assert.strictEqual(recorder.snapshot().events.at(-1).values.activePointers,1);
now=1190;emit('pointerup',201,'touch',1189);
assert.strictEqual(recorder.snapshot().events.at(-1).values.activePointers,0);
// A callback can arrive 5 seconds after a timestamped touch event.
now=6200;emit('pointerdown',777,'touch',1200);
latest=recorder.snapshot().events.at(-1);
assert.strictEqual(latest.values.inputDelayMs,5000);
now=6220;emit('pointerup',777,'touch',6210);
// Missing pointerups cannot grow the transient tracker indefinitely.
for(let i=0;i<20;i++){
 now=7000+i;emit('pointerdown',1000+i,'touch',now-1);
}
assert(recorder.snapshot().events.at(-1).values.activePointers<=16);
// Do not store raw pointer ID, screen coordinates or pressure.
const report=recorder.report();
for(const secret of ['"pointerId"','"clientX"','"clientY"','"pressure"']){
 assert(!report.includes(secret));
}
recorder.toggle(false);
const before=recorder.snapshot().events.length;
emit('pointerdown',303,'touch',1150);
assert.strictEqual(recorder.snapshot().events.length,before);
// All emitted events remain valid across a full recorder reload (v2 session).
const restoredRoot={localStorage,document:doc,addEventListener(){}};
vm.runInNewContext(source,{
 window:restoredRoot,performance:{now:()=>now},
 setInterval:()=>7,clearInterval(){},
 setTimeout:()=>9,clearTimeout(){},
 Date
},{filename:'flight-recorder-reload.js'});
assert.strictEqual(restoredRoot.ZFlight.snapshot().events.filter(e=>e.type==='input-up').length>=3,true);
console.log('flight_recorder_input_timing PASS – opt-in, timestamp mismatch, concurrency, persistence, privacy, disabled');
