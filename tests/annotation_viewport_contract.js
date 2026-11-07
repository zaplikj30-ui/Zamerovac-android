/* B10: original viewport fit and anchored zoom are bit-for-bit preserved. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../app/src/main/assets/annotation-geometry.js');
assert.equal(Object.isFrozen(G),true);
function oldFit(w,h,imageSize){
 const zoom=Math.min((w-24)/imageSize.w,(h-24)/imageSize.h);
 return {zoom,dx:(w-imageSize.w*zoom)/2,dy:(h-imageSize.h*zoom)/2};
}
function oldZoom(transform,factor,x,y){
 const mutable={...transform},before=G.screenToWorld({x,y},mutable);
 mutable.zoom=Math.min(12,Math.max(.05,mutable.zoom*factor));
 mutable.dx=x-before.x*mutable.zoom;mutable.dy=y-before.y*mutable.zoom;
 return {zoom:mutable.zoom,dx:mutable.dx,dy:mutable.dy};
}
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert.ok(editor.includes('AnnotationGeometry.fittedViewport(w,h,photoSize)'));
assert.ok(editor.includes('AnnotationGeometry.zoomedViewport(view,factor,x,y)'));
let seed=98263119;
const rand=()=>{seed=(Math.imul(seed,1103515245)+12345)>>>0;return seed/4294967296};
for(let i=0;i<42000;i++){
 const width=1+Math.floor(rand()*4500),height=1+Math.floor(rand()*3200);
 const img={w:1+Math.floor(rand()*12000),h:1+Math.floor(rand()*10000)};
 const originalImg=JSON.stringify(img);
 assert.deepEqual(G.fittedViewport(width,height,img),oldFit(width,height,img),'Fit changed '+i);
 assert.equal(JSON.stringify(img),originalImg,'Fit changed image dimensions '+i);
 const t={zoom:[.05,.1,1,1.3,5,12][i%6],dx:(rand()-.5)*1800,dy:(rand()-.5)*1800};
 const pt={x:(rand()-.5)*2500,y:(rand()-.5)*1800};
 const factor=[.125,.5,.8,1,1.15,1.25,2,8][i%8];
 const before=JSON.stringify([t,pt]);
 const actual=G.zoomedViewport(t,factor,pt.x,pt.y);
 assert.deepEqual(actual,oldZoom(t,factor,pt.x,pt.y),'Zoom changed '+i);
 assert.equal(JSON.stringify([t,pt]),before,'Mutated transform or anchor '+i);
 const a=G.screenToWorld(pt,t),b=G.screenToWorld(pt,actual);
 assert.ok(Math.abs(a.x-b.x)<1e-8&&Math.abs(a.y-b.y)<1e-8,'Cursor anchor changed '+i);
}
assert.equal(G.zoomedViewport({zoom:1,dx:100,dy:200},.001,105,205).zoom,.05);
assert.equal(G.zoomedViewport({zoom:10,dx:0,dy:0},8,100,200).zoom,12);
console.log('PASS B10: 42000 legacy/pure fit + zoom differential comparisons, anchored cursor, zoom bounds');
