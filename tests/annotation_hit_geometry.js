/* State-free hit geometry and editor compatibility regression. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const G=require('../app/src/main/assets/annotation-geometry.js');
const t={zoom:1.5,dx:25,dy:17},p=q=>G.worldToScreen(q,t);
const dim={id:'d',type:'dimension',a:{x:0,y:70},b:{x:100,y:70},offset:60,measure:'1250,000001'};
const rect={id:'r',type:'rect',a:{x:20,y:40},b:{x:180,y:140}};
const circ={id:'c',type:'circle',a:{x:120,y:150},b:{x:200,y:230}};
const cum={id:'s',type:'cumulative',points:[{x:0,y:0},{x:100,y:0},{x:150,y:20}],offset:5};
const note={id:'n',type:'note',a:{x:90,y:70},b:{x:140,y:140},text:'Voda'};
const items=[dim,rect,circ,cum,note],before=JSON.stringify(items);
assert.equal(G.segmentLineScreen(cum,0,t).a.y,22);
assert.equal(G.segmentLineScreen(cum,1,t).a.y,48);
assert.equal(G.nearestItem(p({x:75,y:100}),[rect],t),rect);
assert.equal(G.nearestItem(p({x:160,y:190}),[circ],t),circ);
assert.equal(G.nearestItem(p({x:80,y:70}),[dim],t),null,'Outside shifted line hit tolerance');
assert.equal(G.nearestItem(p({x:80,y:110}),[dim],t),dim,'Visible dimension line hit');
let captions=0;
assert.equal(G.nearestItem(p({x:90,y:70}),items,t,()=>{captions++;return true}),note);
assert.equal(captions,1);
assert.equal(G.nearestItem(p({x:20,y:180}),[note],t,()=>false),null);
assert.equal(JSON.stringify(items),before);
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const a=editor.indexOf('function nearestItem(point){'),b=editor.indexOf('function hitAnnotation(point){',a);
const c=editor.indexOf('function segmentLineScreen(item,index){'),d=editor.indexOf('function nearestSegmentLabel(point){',c);
assert.ok(a>=0&&b>a&&c>=0&&d>c);
const sandbox={AnnotationGeometry:G,current:{items},view:t,
 ctx:{save(){},restore(){},measureText:z=>({width:z.length*9})},
 prefs:{fontSize:17},noteCaptionScreen:item=>p(item.captionMoved&&item.b?item.b:item.a),
 worldToScreen:p,noteDisplayedCaption:item=>item.text||''};
vm.createContext(sandbox);vm.runInContext(editor.slice(c,d)+editor.slice(a,b),sandbox);
assert.equal(sandbox.segmentLineScreen(cum,0).a.y,22);
assert.equal(sandbox.nearestItem(p({x:90,y:70})),note);
assert.equal(JSON.stringify(items),before);
console.log('PASS B4: touch hit shapes, shifted dimensions, caption priority, adapter, immutable values');
