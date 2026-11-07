/* B7 differential contract: exactly preserve all four previous shape-resize paths. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../app/src/main/assets/annotation-geometry.js');
const R=require('../app/src/main/assets/annotation-resize.js');
function legacy(item,index,target){
 if(item.type==='area'){
  const points=G.quadCorners(item).map(p=>({...p}));
  points[index]=target;return {points,a:{...points[0]},b:{...points[2]}};
 }
 if(item.type==='rect'){
  const corners=G.rectCorners(item),opposite=corners[(index+2)%4];
  return {a:{x:Math.min(target.x,opposite.x),y:Math.min(target.y,opposite.y)},
   b:{x:Math.max(target.x,opposite.x),y:Math.max(target.y,opposite.y)}};
 }
 const g=G.ellipseGeometry(item);let rx=g.rx,ry=g.ry;
 if(item.type==='circle'){const radius=Math.max(1,index<2?Math.abs(target.x-g.cx):Math.abs(target.y-g.cy));rx=radius;ry=radius;}
 else if(index<2)rx=Math.max(1,Math.abs(target.x-g.cx));
 else ry=Math.max(1,Math.abs(target.y-g.cy));
 return {a:{x:g.cx-rx,y:g.cy-ry},b:{x:g.cx+rx,y:g.cy+ry}};
}
let seed=0xa6c7d;
function random(){seed=(Math.imul(1664525,seed)+1013904223)>>>0;return seed/4294967296}
const number=limit=>Math.round(random()*limit*100)/100;
for(let i=0;i<8000;i++){
 const w=100+number(9000),h=100+number(6000);
 const a={x:number(w),y:number(h)},b={x:number(w),y:number(h)};
 const target={x:number(w),y:number(h)};
 const points=[a,{x:b.x,y:a.y},b,{x:a.x,y:b.y}];
 for(const type of ['rect','area','ellipse','circle']){
  const item={id:'shape',type,a,b,points,measure:'1585,800001',
   laserMeasuredMm:1585.800001,unit:'mm',sideMeasures:['120,000001','200','300','400']};
  const index=i%4,before=JSON.stringify(item);
  assert.deepEqual(R.resizedShape(item,index,target,G),legacy(item,index,target),type+' diff '+i);
  assert.equal(JSON.stringify(item),before,'Mutation of '+type);
 }
}
const initial={type:'area',points:[{x:10,y:20},{x:50,y:20},{x:50,y:90},{x:10,y:90}],
 a:{x:10,y:20},b:{x:50,y:90},sideMeasures:['75,000001','120','75','120']};
const patch=R.resizedShape(initial,2,{x:65,y:95},G);
assert.deepEqual(patch.points.slice(0,2),initial.points.slice(0,2));
assert.equal(initial.sideMeasures[0],'75,000001');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.indexOf('src="annotation-resize.js"')<html.indexOf('src="editor.js"'));
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert(editor.includes('AnnotationResize.resizedShape('));
assert.equal(Object.isFrozen(R),true);
console.log('PASS B7: 32,000 old/new resize calculations, immutable precise models, 4 shapes, script order');
