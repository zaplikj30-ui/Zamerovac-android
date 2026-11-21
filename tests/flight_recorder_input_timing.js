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
let diagnosticWrites=0;
const timeoutCallbacks=[];
const pagehideCallbacks=[];
const localStorage={
 getItem:key=>map.has(key)?map.get(key):null,
 setItem:(key,value)=>{diagnosticWrites++;map.set(key,value)},
 removeItem:key=>map.delete(key)
};
let now=1000;
const root={localStorage,document:doc,addEventListener(type,fn){if(type==='pagehide')pagehideCallbacks.push(fn)}};
vm.runInNewContext(source,{
 window:root,performance:{now:()=>now},
 setInterval:()=>7,clearInterval(){},
 setTimeout:fn=>{timeoutCallbacks.push(fn);return 9},clearTimeout(){},
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
const writesBeforeTouch=diagnosticWrites,scheduledBeforeTouch=timeoutCallbacks.length;
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
// Input callbacks must not schedule a disk flush during a later gesture.
assert.strictEqual(timeoutCallbacks.length,scheduledBeforeTouch,'Touch events scheduled storage flush mid-gesture');
assert.strictEqual(diagnosticWrites,writesBeforeTouch,'Touch events wrote storage');
const allowedInputFields=new Set(['inputKind','inputDelayMs','activePointers','gestureMs','moveEvents','missingDown']);
for(const e of events.filter(row=>row.type.startsWith('input-'))){
 for(const [key,value] of Object.entries(e.values)){
  assert(allowedInputFields.has(key),'Unapproved input metric: '+key);
  assert(Number.isFinite(value)&&value>=0&&value<=600000,'Invalid input metric: '+key);
 }
}
// Existing critical commit persists previously buffered touch events.
recorder.record('editor-commit',{savePathMs:3},true);
assert(diagnosticWrites>writesBeforeTouch,'Commit did not persist queued touch events');
assert(localStorage.getItem('zamerovac-perf-diagnostics-v2').includes('input-down'),'Input lost before committed diagnostic save');
// Without a completed drag, pagehide still persists last input-only events.
now=1050;emit('pointerdown',88,'touch',1048);
now=1060;emit('pointerup',88,'touch',1058);
const writesBeforeHide=diagnosticWrites;
assert.strictEqual(pagehideCallbacks.length,1);
pagehideCallbacks[0]();
assert(diagnosticWrites>writesBeforeHide,'pagehide did not persist pending touch-only events');
// A non-input diagnostic timer may already exist when a new drag starts.
// Its callback MUST NOT write localStorage in the middle of a finger gesture.
now=1065;recorder.record('editor-open',{itemCount:1},false);
const timerBeforeDrag=timeoutCallbacks.at(-1);
assert.strictEqual(typeof timerBeforeDrag,'function');
const writesBeforeScheduledDrag=diagnosticWrites;
now=1070;emit('pointerdown',889,'touch',1069);
timerBeforeDrag();
assert.strictEqual(diagnosticWrites,writesBeforeScheduledDrag,'Previously queued diagnostic timer wrote storage during live gesture');
now=1090;emit('pointerup',889,'touch',1089);
assert(timeoutCallbacks.at(-1)!==timerBeforeDrag,'Deferred diagnostic flush not rescheduled after release');
const saveAfterDrag=timeoutCallbacks.at(-1);
saveAfterDrag();
assert(diagnosticWrites>writesBeforeScheduledDrag,'Previously deferred diagnostic row was not persisted after gesture');
// Important non-input records should also avoid storage writes while a drag is in progress.
now=1091;emit('pointerdown',890,'touch',1090);
const writesBeforeImportant=diagnosticWrites;
recorder.record('ui-stall',{elapsedMs:2100},true);
assert.strictEqual(diagnosticWrites,writesBeforeImportant,'Important diagnostic record wrote storage during live gesture');
now=1099;emit('pointerup',890,'touch',1098);
timeoutCallbacks.at(-1)();
assert(diagnosticWrites>writesBeforeImportant,'Important deferred row not persisted after gesture');
// Two simultaneous pointers keep a queued timer deferred until BOTH are released.
now=1101;recorder.record('editor-open',{itemCount:2},false);
const overlappingTimer=timeoutCallbacks.at(-1);
const writesBeforeOverlap=diagnosticWrites;
now=1102;emit('pointerdown',900,'touch',1101);
now=1103;emit('pointerdown',901,'pen',1102);
overlappingTimer();
assert.strictEqual(diagnosticWrites,writesBeforeOverlap,'Concurrent gesture produced storage write');
now=1110;emit('pointerup',900,'touch',1109);
assert.strictEqual(timeoutCallbacks.at(-1),overlappingTimer,'Flush was rearmed before the last pointer lifted');
now=1120;emit('pointerup',901,'pen',1119);
assert.notStrictEqual(timeoutCallbacks.at(-1),overlappingTimer,'Flush was not rearmed after last pointer');
timeoutCallbacks.at(-1)();
assert(diagnosticWrites>writesBeforeOverlap,'Deferred multi-pointer trace was lost');
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
// New diagnostic session must discard orphaned pointers from previous session.
const restored=restoredRoot.ZFlight, laterCallbacks={};
restored.attachEditorInput({addEventListener:(type,fn)=>{
 (laterCallbacks[type]||(laterCallbacks[type]=[])).push(fn);
}});
assert.strictEqual(restored.toggle(true),true);
now=8200;laterCallbacks.pointerdown[0]({pointerId:600,pointerType:'touch',timeStamp:8190});
restored.toggle(false);
assert.strictEqual(restored.toggle(true),true);
now=8300;laterCallbacks.pointerdown[0]({pointerId:601,pointerType:'touch',timeStamp:8290});
assert.strictEqual(restored.snapshot().events.at(-1).values.activePointers,1);
console.log('flight_recorder_input_timing PASS – opt-in, timestamp mismatch, concurrency, persistence, session reset, privacy, disabled');
