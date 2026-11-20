'use strict';
// Use the actual scheduler from editor.js with a browser-like deferred frame queue.
// Only the platform request/cancel boundary is modeled; stage handlers stay real.
function installEditorPaintScheduler(vm,context,source){
 const start=source.indexOf('function scheduleMovePaint(){');
 const end=source.indexOf('function openEditor(',start);
 if(start<0||end<=start)throw new Error('Missing production paint scheduler');
 let nextId=0;
 const pending=new Map();
 context.requestAnimationFrame=callback=>{
  const id=++nextId;
  pending.set(id,callback);
  return id;
 };
 context.cancelAnimationFrame=id=>pending.delete(id);
 context.__pendingEditorPaintFrames=pending;
 vm.runInContext('let movePaintFrame=0;\n'+source.slice(start,end),context);
}
module.exports={installEditorPaintScheduler};
