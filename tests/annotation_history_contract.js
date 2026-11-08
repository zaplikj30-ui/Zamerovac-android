/* B14: differential, exact-byte and negative Undo/Redo history contracts. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const H=require('../app/src/main/assets/annotation-history.js');
assert(Object.isFrozen(H),'History API must be immutable');
const browser={};vm.createContext(browser);
vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-history.js','utf8'),browser);
assert.equal(typeof browser.AnnotationHistory.restore,'function');

const exact={id:'dimension',type:'dimension',a:{x:0.123456789,y:100},
 b:{x:400.333333333,y:200},measure:'1585,800001',laserMeasuredMm:'1585.800001',
 unit:'mm',segmentData:[{measure:'1250,000001',laserMeasuredMm:'1250.000001'}],
 media:['photo_original_01'],detailItems:[{text:'nedotýkat se původní fotografie'}]};
const before=JSON.stringify([exact]);
const undo=[],redo=[];
H.checkpoint([exact],undo);
assert.equal(undo[0],before,'Checkpoint altered precise source bytes');
const changed=JSON.parse(before);
changed[0].a.x=123.000000000001;changed[0].segmentData[0].measure='42,000001';
const changedBytes=JSON.stringify(changed);
const restored=H.restore(changed,undo,redo);
assert.equal(JSON.stringify(restored),before,'Undo changed original exact values');
assert.equal(redo[0],changedBytes,'Redo lost changed exact values');
const reapplied=H.restore(restored,redo,undo);
assert.equal(JSON.stringify(reapplied),changedBytes,'Redo did not restore exact snapshot');
assert.equal(JSON.stringify([exact]),before,'Undo/Redo mutated live original');

// Compare valid historical behavior with the pre-B14 algorithms; no normalization.
function legacyCheckpoint(items,stack,redoStack){
 stack.push(JSON.stringify(items||[]));if(stack.length>50)stack.shift();return [];
}
function legacyGesture(snapshot,stack){stack.push(snapshot);if(stack.length>50)stack.shift()}
function legacyRestore(items,from,to){
 if(!from.length)return null;
 to.push(JSON.stringify(items));
 return JSON.parse(from.pop());
}
let seed=0x140a11;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
let old={items:[JSON.parse(JSON.stringify(exact))],undo:[],redo:[]},
 next={items:[JSON.parse(JSON.stringify(exact))],undo:[],redo:[]};
for(let i=0;i<10000;i++){
 const command=Math.floor(rand()*5);
 if(command===0){ // checkpoint followed by a real edit
  old.redo=legacyCheckpoint(old.items,old.undo,old.redo);
  H.checkpoint(next.items,next.undo);next.redo=[];
  const x=Math.round(rand()*1e9)/1e9;
  old.items=JSON.parse(JSON.stringify(old.items));
  next.items=JSON.parse(JSON.stringify(next.items));
  old.items[0].a.x=x;next.items[0].a.x=x;
  old.items[0].measure='1585,'+String(i).padStart(6,'0');
  next.items[0].measure=old.items[0].measure;
 }else if(command===1){ // complete actual drag with precomputed snapshot
  const snapshot=JSON.stringify(old.items);
  legacyGesture(snapshot,old.undo);H.recordSnapshot(snapshot,next.undo);
  old.redo=[];next.redo=[];
  old.items[0].b.y+=1.25;next.items[0].b.y+=1.25;
 }else if(command===2){ // Undo
  if(old.undo.length){old.items=legacyRestore(old.items,old.undo,old.redo);
   next.items=H.restore(next.items,next.undo,next.redo)}
 }else if(command===3){ // Redo
  if(old.redo.length){old.items=legacyRestore(old.items,old.redo,old.undo);
   next.items=H.restore(next.items,next.redo,next.undo)}
 }else{ // tap/zoom: neither checkpoint nor Redo should change
  assert.equal(JSON.stringify(next.redo),JSON.stringify(old.redo));
 }
 assert.equal(JSON.stringify(next),JSON.stringify(old),'History mismatch at transition '+i);
 assert(next.undo.length<=50,'Undo bound exceeded');
}
const previousHistory=['first','second'],previousRedo=['future'];
const a=JSON.stringify(previousHistory),b=JSON.stringify(previousRedo);
assert.equal(H.restore([],[],previousRedo),null,'Empty Undo must be no-op');
assert.equal(JSON.stringify(previousRedo),b,'Empty history wiped Redo');
assert.throws(()=>H.restore([exact],['{malformed'],previousRedo),SyntaxError);
assert.equal(JSON.stringify(previousRedo),b,'Malformed history mutated Redo');
const broken=['{malformed'];
assert.throws(()=>H.restore([exact],broken,previousRedo),SyntaxError);
assert.equal(broken[0],'{malformed','Malformed snapshot was lost');
for(const invalid of ['null','{}','"ztracena kota"','[null]','[5]','[[1,2]]']){
 const failedUndo=[invalid],failedRedo=['keep-redo'];
 const saveBefore=JSON.stringify([exact]),beforeUndo=JSON.stringify(failedUndo),beforeRedo=JSON.stringify(failedRedo);
 assert.throws(()=>H.restore([exact],failedUndo,failedRedo),TypeError,
  'Structurally invalid history must fail without writing data: '+invalid);
 assert.equal(JSON.stringify(failedUndo),beforeUndo);
 assert.equal(JSON.stringify(failedRedo),beforeRedo);
 assert.equal(JSON.stringify([exact]),saveBefore);
}

const circular=[];circular.push(circular);
assert.throws(()=>H.checkpoint(circular,previousHistory),TypeError);
assert.equal(JSON.stringify(previousHistory),a,'Failed serialization erased working history');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.indexOf('src="annotation-history.js"')>=0);
assert(html.indexOf('src="annotation-history.js"')<html.indexOf('src="editor.js"'));
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert(editor.includes('AnnotationHistory.checkpoint(current.items,editStack)'));
assert(editor.includes('AnnotationHistory.recordSnapshot(handle.beforeDragItems,editStack)'));
assert(editor.includes('AnnotationHistory.restore(current.items,editStack,redoStack)'));
assert(editor.includes('AnnotationHistory.restore(current.items,redoStack,editStack)'));
assert(!editor.includes('editStack.push(handle.beforeDragItems)'));
console.log('PASS B14: 10,000 differential edits/undo/redo, exact values/media, invalid snapshots atomic, bounded history');
