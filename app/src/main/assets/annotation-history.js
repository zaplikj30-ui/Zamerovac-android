/* B14: stateless, lossless Undo/Redo history for editable annotations.
 * This module knows nothing about canvas, media, saving or Android. The editor
 * retains gesture validation, save acknowledgement and user-visible controls.
 * Snapshots are the original full JSON records: never derive measurements from pixels.
 */
(function(root){
'use strict';
const HISTORY_LIMIT=50;

// Shared by an explicit checkpoint and a completed, actually changed drag.
// A saved snapshot is already JSON; do not parse/rewrite its precise values.
function recordSnapshot(snapshot,undoStack){
 undoStack.push(snapshot);
 if(undoStack.length>HISTORY_LIMIT)undoStack.shift();
}
function checkpoint(items,undoStack){
 recordSnapshot(JSON.stringify(items||[]),undoStack);
}

// Undo and Redo are symmetric. Parse before altering either stack, so malformed
// history fails safely without losing the current or previous saved snapshot.
function restore(items,fromStack,toStack){
 if(!fromStack.length)return null;
 const previous=JSON.parse(fromStack[fromStack.length-1]);
 const current=JSON.stringify(items);
 toStack.push(current);
 fromStack.pop();
 return previous;
}

const api=Object.freeze({recordSnapshot,checkpoint,restore});
root.AnnotationHistory=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
