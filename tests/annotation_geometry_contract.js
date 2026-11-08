/* Pure B2 geometry contract: existing precision, coordinate axes and data stability. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const G=require('../app/src/main/assets/annotation-geometry.js');
assert.equal(Object.isFrozen(G),true,'Geometry API is read-only');
const browser={};vm.createContext(browser);
vm.runInContext(fs.readFileSync('app/src/main/assets/annotation-geometry.js','utf8'),browser);
assert.equal(typeof browser.AnnotationGeometry.rectCorners,'function');
const view={zoom:1.37,dx:27.25,dy:-18.125};
for(const point of [{x:0,y:0},{x:1250.500001,y:9999.125},{x:-7,y:0.000001}]){
 const p=G.worldToScreen(point,view),actual=G.screenToWorld(p,view);
 assert.ok(Math.abs(actual.x-point.x)<1e-9&&Math.abs(actual.y-point.y)<1e-9);
 assert.deepEqual(G.annotationProjectPoint(point,view),p);
}
const item={type:'area',a:{x:10,y:20},b:{x:300,y:400},
 points:[{x:10,y:20},{x:300,y:20},{x:300,y:400},{x:10,y:400}],
 sideMeasures:['1000','1000','1000','1000'],diagonal:String(Math.SQRT2*1000),unit:'mm'};
const initial=JSON.stringify(item);
assert.deepEqual(G.quadCorners(item),item.points);
assert.deepEqual(G.resizePoints(item),item.points);
assert.ok(Math.abs(G.quadAreaFromMeasures(item)-1)<1e-9);
assert.equal(JSON.stringify(item),initial,'Do not alter editability or original precise values');
assert.deepEqual(G.boundsPoint({x:-20,y:960},{w:1200,h:800}),{x:0,y:800});
assert.equal(G.quadAreaFromMeasures({sideMeasures:['1000','1000','1000','1000']}),null);
assert.equal(G.triangleArea('100','200','300'),null);
assert.ok(G.triangleArea('100,5','210,2','250,0')>0);
assert.deepEqual(G.rectCorners({a:{x:9,y:8},b:{x:1,y:2}}),
 [{x:1,y:2},{x:9,y:2},{x:9,y:8},{x:1,y:8}]);
for(const type of ['circle','ellipse']){
 const obj={type,a:{x:5,y:10},b:{x:105,y:50}};
 const g=G.ellipseGeometry(obj);
 for(const p of G.resizePoints(obj)){
  assert.ok(Math.abs((p.x-g.cx)**2/g.rx**2+(p.y-g.cy)**2/g.ry**2-1)<1e-10);
 }
}
assert.deepEqual(G.cumulativeSegment({points:[{x:0,y:0},{x:100,y:0},{x:50,y:60}]},1,{zoom:1,dx:0,dy:0}),
 {from:{x:0,y:0},to:{x:50,y:0}});
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.indexOf('src="annotation-geometry.js"')<html.indexOf('src="editor.js"'));
console.log('PASS B2: pure transforms, precise models, legacy corners/area/cumulative, no mutation');
