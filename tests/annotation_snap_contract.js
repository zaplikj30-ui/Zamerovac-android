/* B9: frozen reference implementation versus the new pure magnetic snapping API.
 * The legacy function is deliberately copied, NOT imported from the new editor
 * adapter; any behavior drift in thresholds/order will fail these comparisons.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const G=require('../app/src/main/assets/annotation-geometry.js');
let prefs={},view={zoom:1},current={items:[]},photoSize={w:1200,h:800};
function boundsPoint(p){return G.boundsPoint(p,photoSize)}
// Pinned pre-B9 editor implementation:
function snap(p,ref=null,ignore=null){
 p=boundsPoint({...p});
 const step=Math.max(5,Number(prefs.gridStep)||40),zoom=Math.max(.05,view.zoom);
 const pointDistance=12/zoom;
 if(prefs.snapGrid){
  const gridDistance=Math.min(11/zoom,step*.22);
  const gx=Math.round(p.x/step)*step,gy=Math.round(p.y/step)*step;
  if(Math.abs(gx-p.x)<gridDistance)p.x=gx;
  if(Math.abs(gy-p.y)<gridDistance)p.y=gy;
 }
 if(prefs.snapPoints){
  let best=null,bestDistance=pointDistance;
  for(const item of current.items||[]){
   // Vlastní kóta nesmí přichytávat svůj konec k druhému vlastnímu konci.
   if(ignore?.item===item)continue;
   for(const candidate of [item.a,item.b,...(item.points||[])]){
    if(!candidate)continue;
    const distance=Math.hypot(candidate.x-p.x,candidate.y-p.y);
    if(distance<bestDistance){bestDistance=distance;best=candidate}
   }
  }
  if(best)p={...best};
 }
 if(prefs.snapHorizontal&&ref){
  if(Math.abs(p.y-ref.y)<pointDistance)p.y=ref.y;
  if(Math.abs(p.x-ref.x)<pointDistance)p.x=ref.x;
 }
 return boundsPoint(p);
}
assert.equal(Object.isFrozen(G),true);
assert.equal(typeof G.snapPoint,'function','Pure geometry snapping must be exported');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
assert.match(editor,/function snap\(p,ref=null,ignore=null\)\{return AnnotationGeometry\.snapPoint\(p,ref,ignore,current\.items\|\|\[\],prefs,view\.zoom,photoSize\)\}/,
 'Editor must delegate snapping instead of duplicating the calculations');
let seed=90836233;
const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
for(let k=0;k<42000;k++){
 const zoom=[.025,.05,.1,.75,1,1.5,5,12][k%8];
 photoSize={w:500+Math.floor(rand()*4000),h:300+Math.floor(rand()*4500)};
 const px=rand()*photoSize.w,py=rand()*photoSize.h;
 const point={x:px+(rand()-.5)*150,y:py+(rand()-.5)*150};
 const ref=k%3?{x:px+(rand()-.5)*20,y:py+(rand()-.5)*20}:null;
 prefs={gridStep:[0,3,9,20,40,75,1000,'40',null][k%9],
  snapGrid:(k&1)!==0,snapPoints:(k&2)!==0,snapHorizontal:(k&4)!==0};
 current={items:Array.from({length:k%7},(_,i)=>({
  id:i,a:{x:px+(rand()-.5)*200,y:py+(rand()-.5)*200},
  b:{x:px+(rand()-.5)*200,y:py+(rand()-.5)*200},
  points:Array.from({length:i%3},()=>({x:px+(rand()-.5)*120,y:py+(rand()-.5)*120}))
 }))};
 view={zoom};
 const ignore=k%5===0?{item:current.items[0]}:null;
 const before=JSON.stringify([point,ref,current.items,prefs,photoSize]);
 const expected=snap(point,ref,ignore);
 const actual=G.snapPoint(point,ref,ignore,current.items,prefs,view.zoom,photoSize);
 assert.deepEqual(actual,expected,'Legacy snapping difference in case '+k);
 assert.equal(JSON.stringify([point,ref,current.items,prefs,photoSize]),before,
  'Snapping must not rewrite precise input points/objects in case '+k);
}
const own={type:'dimension',a:{x:100,y:100},b:{x:200,y:200}};
prefs={snapGrid:false,snapPoints:true,snapHorizontal:false,gridStep:40};
current={items:[own]};photoSize={w:400,h:400};view={zoom:1};
assert.deepEqual(G.snapPoint({x:101,y:100},null,{item:own},current.items,prefs,view.zoom,photoSize),
 {x:101,y:100},'Dragging one dimension must not snap to its own endpoint');
assert.deepEqual(G.snapPoint({x:101,y:100},null,null,current.items,prefs,view.zoom,photoSize),
 {x:100,y:100},'A different object should snap near an endpoint');
console.log('PASS B9: 42000 deterministic legacy/pure snap comparisons, immutable inputs, own-object exemption');
