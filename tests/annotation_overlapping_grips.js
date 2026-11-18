/* #191: a clearly closer endpoint must be selectable even when another
 * dimension remains selected. Exercise actual editor hitAnnotation and production
 * AnnotationGeometry; do not alter coordinates, exact measurements or hit radii.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const G=require('../app/src/main/assets/annotation-geometry.js');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const start=editor.indexOf('function nearestHandle(point,onlyItem=null){');
const end=editor.indexOf('function selectAnnotation(item){',start);
assert(start>=0&&end>start,'Editor hit-test boundary changed');
function dim(id,x){return {id,type:'dimension',a:{x,y:100},b:{x:x+150,y:100},
 measure:id==='a'?'1585,800000001234567':'3250,000000009876543',unit:'mm',offset:0};}
function scenario(zoom=1,dx=0,selected='a'){
 const view={zoom,dx,dy:15},a=dim('a',100),b=dim('b',118);
 const note={id:'note',type:'note',a:{x:185,y:125},text:'',media:[]};
 const items=[a,b,note],before=JSON.stringify(items);
 const env={AnnotationGeometry:G,current:{items},view,selected,
  prefs:{fontSize:17},ctx:{save(){},restore(){},measureText:()=>({width:30})},
  nearestLabel:()=>null,nearestSegmentLabel:()=>null,
  noteCaptionScreen:i=>G.worldToScreen(i.a,view),
  worldToScreen:p=>G.worldToScreen(p,view),
  noteDisplayedCaption:()=>''};
 vm.createContext(env);vm.runInContext(editor.slice(start,end),env);
 const tap=p=>env.hitAnnotation(G.worldToScreen(p,view))?.id||null;
 return {tap,a,b,items,before};
}
for(const zoom of [1,1.5,2]){
 const t=scenario(zoom,23);
 assert.equal(t.tap(t.a.a),'a','Selected endpoint must stay selectable');
 assert.equal(t.tap(t.b.a),'b','Touch exactly on another endpoint must select the nearer dimension');
 assert.equal(t.tap({x:109,y:100}),'a','Genuinely ambiguous midpoint should retain active grip');
 assert.equal(t.tap(t.b.b),'b','The other endpoint must be reachable too');
 assert.equal(JSON.stringify(t.items),t.before,'Selection must not alter exact model values');
 assert.equal(t.a.measure,'1585,800000001234567');
 assert.equal(t.b.measure,'3250,000000009876543');
 assert.equal(t.b.unit,'mm');
}
const none=scenario(1,0,null);
assert.equal(none.tap(none.b.a),'b','No active selection must use the closest grip');
console.log('PASS #191: nearer overlapping grips, ambiguous active grip, zoom, note and exact values');
