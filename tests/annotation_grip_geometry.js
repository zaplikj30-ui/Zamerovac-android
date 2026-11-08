/* B3: Grip hit-testing is independent from editor state, never changes geometry. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const G=require('../app/src/main/assets/annotation-geometry.js');
const transform={zoom:1.25,dx:17,dy:-9};
const project=p=>G.worldToScreen(p,transform);
const dim={id:'dim',type:'dimension',a:{x:100,y:150},b:{x:300,y:150},measure:'1585,800001'};
const circle={id:'circle',type:'circle',a:{x:400,y:30},b:{x:500,y:130}};
const area={id:'area',type:'area',points:[{x:10,y:10},{x:90,y:10},{x:90,y:80},{x:10,y:80}]};
const note={id:'note',type:'note',a:{x:700,y:50},b:{x:800,y:50},text:'Note'};
const poly={id:'poly',type:'polyline',points:[{x:10,y:300},{x:50,y:300},{x:120,y:300}]};
const items=[dim,circle,area,note,poly];
const original=JSON.stringify(items);
const hit=(p,only=null)=>G.nearestHandle(project(p),items,transform,only);
assert.equal(hit({x:100,y:150})?.key,'a','Dimension start grip');
assert.equal(hit({x:300,y:150})?.key,'b','Dimension end grip');
assert.equal(hit({x:200,y:150}),null,'Dimension center is a move area');
assert.equal(hit({x:100,y:150},circle),null,'onlyItem must limit hit candidates');
assert.equal(hit({x:400,y:80})?.kind,'shape-resize','Circle contour grip');
assert.equal(hit({x:10,y:10})?.kind,'shape-resize','Polygon corner grip');
assert.equal(hit({x:800,y:50}),null,'Caption of note is not a resize grip');
assert.equal(hit({x:700,y:50})?.key,'a','Note anchor grip');
assert.equal(hit({x:10,y:300})?.pointIndex,0,'Polyline first vertex grip');
assert.equal(hit({x:30,y:300}),null,'Polyline middle segment keeps move zone');
assert.equal(JSON.stringify(items),original,'No item mutation from hit testing');
const source=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const first=source.indexOf('function nearestHandle(point,onlyItem=null){');
const last=source.indexOf('function nearestItem(point){',first);
assert.ok(first>=0&&last>first);
const adapter=source.slice(first,last);
assert.ok(adapter.includes('AnnotationGeometry.nearestHandle('));
const sandbox={
 AnnotationGeometry:G,
 current:{items},
 view:transform,
};
vm.createContext(sandbox);vm.runInContext(adapter,sandbox);
assert.equal(sandbox.nearestHandle(project({x:100,y:150}))?.item,dim,'Editor adapter must return same live item');
assert.equal(sandbox.nearestHandle(project({x:100,y:150}),circle),null,'Editor adapter keeps onlyItem semantics');
assert.equal(JSON.stringify(items),original,'Original item data unchanged by adapter');
console.log('PASS B3: grip geometry, midpoint move zone, isolation, legacy adapter, no mutation');
