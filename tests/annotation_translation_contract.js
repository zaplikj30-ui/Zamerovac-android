/* B6: deterministic differential test against the exact pre-extraction formulas. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs');
const Translation=require('../app/src/main/assets/annotation-translation.js');
function previousEndpoints(a,b,d,v,s){
 const dx=Math.max(-Math.min(a.x,b.x),Math.min(d.x/v.zoom,s.w-Math.max(a.x,b.x)));
 const dy=Math.max(-Math.min(a.y,b.y),Math.min(d.y/v.zoom,s.h-Math.max(a.y,b.y)));
 return {a:{x:a.x+dx,y:a.y+dy},b:{x:b.x+dx,y:b.y+dy}};
}
function previousPolyline(points,d,v,s){
 const dx=d.x/v.zoom,dy=d.y/v.zoom;
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const shiftX=Math.max(-minX,Math.min(dx,s.w-maxX));
 const shiftY=Math.max(-minY,Math.min(dy,s.h-maxY));
 const moved=points.map(p=>({x:p.x+shiftX,y:p.y+shiftY}));
 return {points:moved,a:{...moved[0]},b:{...moved[moved.length-1]}};
}
let seed=0x9fc122;
function random(){seed=(1664525*seed+1013904223)>>>0;return seed/4294967296}
const number=limit=>Math.round(random()*limit*100)/100;
for(let i=0;i<12000;i++){
 const size={w:150+number(12000),h:150+number(7000)},view={zoom:[.05,.2,.75,1,2,6,12][i%7],dx:20,dy:-12};
 const delta={x:number(size.w*3)-size.w,y:number(size.h*3)-size.h};
 const a={x:number(size.w),y:number(size.h)},b={x:number(size.w),y:number(size.h)};
 const points=[a,b,...Array.from({length:2+i%8},()=>({x:number(size.w),y:number(size.h)}))];
 const original=JSON.stringify({a,b,points,delta,size,view});
 assert.deepEqual(Translation.translatedEndpoints(a,b,delta,view,size),previousEndpoints(a,b,delta,view,size),'endpoints '+i);
 assert.deepEqual(Translation.translatedPolyline(points,delta,view,size),previousPolyline(points,delta,view,size),'polyline '+i);
 assert.equal(JSON.stringify({a,b,points,delta,size,view}),original,'input mutation '+i);
}
const stored={a:{x:100,y:200},b:{x:300,y:200},measure:'1585,800001',laserMeasuredMm:1585.800001,unit:'mm'};
const result=Translation.translatedEndpoints(stored.a,stored.b,{x:120,y:50},{zoom:2},{w:1000,h:800});
assert.equal(result.b.x-result.a.x,200,'Length changed');
assert.equal(stored.measure,'1585,800001');assert.equal(stored.laserMeasuredMm,1585.800001);
assert.equal(stored.a.x,100);
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(html.indexOf('src="annotation-translation.js"')>=0);
assert(html.indexOf('src="annotation-translation.js"')<html.indexOf('src="editor.js"'));
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert(editor.includes('AnnotationTranslation.translatedPolyline('));
assert(editor.includes('AnnotationTranslation.translatedEndpoints('));
console.log('PASS B6: 24,000 differential cases, no mutation, zoom, bounds, exact values, module order');
