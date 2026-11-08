/* B11: old editor's two-pointer pinch math is preserved as a separate oracle.
 * No DOM, storage or Android; pointer lifecycle is tested by Chromium E2E.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const G=require('../app/src/main/assets/annotation-geometry.js');
function legacy(gesture,points){
 const v=points,dist=Math.hypot(v[0].x-v[1].x,v[0].y-v[1].y);
 const mid={x:(v[0].x+v[1].x)/2,y:(v[0].y+v[1].y)/2};
 const view={zoom:gesture.zoom,dx:0,dy:0};
 view.zoom=Math.max(.05,Math.min(12,gesture.zoom*dist/Math.max(1,gesture.distance)));
 view.dx=mid.x-gesture.world.x*view.zoom;
 view.dy=mid.y-gesture.world.y*view.zoom;
 return {zoom:view.zoom,dx:view.dx,dy:view.dy};
}
assert(Object.isFrozen(G));
const src=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert(src.includes('AnnotationGeometry.pinchViewport(gesture,[...pointers.values()])'),'Stage move must use pure pinch math');
let seed=19903241;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<42000;i++){
 const p0={x:(rand()-.2)*1400,y:(rand()-.2)*2400};
 const p1={x:p0.x+(rand()-.5)*2200,y:p0.y+(rand()-.5)*2200};
 const gesture={zoom:[.05,.1,1,1.25,7,12][i%6],
  distance:[0,.1,1,100,400,700][i%6],
  world:{x:(rand()-.5)*9000,y:(rand()-.5)*9000}};
 const old=JSON.stringify([gesture,p0,p1]);
 const actual=G.pinchViewport(gesture,[p0,p1]);
 assert.deepEqual(actual,legacy(gesture,[p0,p1]),'Pinch changed old behavior: '+i);
 assert.equal(JSON.stringify([gesture,p0,p1]),old,'Pinch must not alter input: '+i);
}
const same=G.pinchViewport({zoom:1,distance:200,world:{x:80,y:70}},
 [{x:0,y:100},{x:200,y:100}]);
assert.equal(same.zoom,1);
assert.equal(G.pinchViewport({zoom:12,distance:1,world:{x:0,y:0}},[{x:0,y:0},{x:200,y:0}]).zoom,12);
assert.equal(G.pinchViewport({zoom:.05,distance:100,world:{x:0,y:0}},[{x:0,y:0},{x:.1,y:0}]).zoom,.05);
console.log('PASS B11: 42000 pure two-pointer pinch comparisons, input immutability and zoom bounds');
