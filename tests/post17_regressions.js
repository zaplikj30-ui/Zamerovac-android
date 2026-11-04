/* Approved issue #17: executable geometry/state regressions, no private data. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const src=fs.readFileSync('app/src/main/assets/editor.js','utf8');
function part(a,b){const i=src.indexOf(a),j=src.indexOf(b,i);assert(i>=0&&j>i);return src.slice(i,j)}
const operations=[],labels=[];
const c=new Proxy({save(){},restore(){},measureText(){return {width:10}}},{get(o,k){return o[k]||((...args)=>operations.push([k,...args]))}});
const env={view:{zoom:.25,dx:40,dy:80},prefs:{unit:'mm',color:'#f7dc27',lineWidth:2,fontSize:17},console,
 canvasText:(...args)=>labels.push(args),drawArrow(){},Math,Number,String,
 worldToScreen:p=>({x:p.x*env.view.zoom+env.view.dx,y:p.y*env.view.zoom+env.view.dy})};
vm.createContext(env);
vm.runInContext(part('function readableSegmentAngle(', 'function drawArrow(')+part('function rectCorners(', 'function drawLoupe('),env);
for(const type of ['circle','ellipse']){
 operations.length=0;
 env.drawItem(c,{type,a:{x:100,y:200},b:{x:500,y:400}});
 const ellipse=operations.find(x=>x[0]==='ellipse');
 assert.deepEqual(ellipse.slice(1,5),[115,155,50,type==='circle'?50:25]);
}
operations.length=0;
const area={type:'area',points:[{x:100,y:200},{x:500,y:240},{x:450,y:500},{x:80,y:420}]};
env.drawItem(c,area);
assert.deepEqual(operations.find(x=>x[0]==='moveTo').slice(1),[65,130]);
assert.equal(operations.filter(x=>x[0]==='lineTo').length,3);
assert(operations.some(x=>x[0]==='closePath'));
labels.length=0;
env.drawItem(c,{type:'rect',a:{x:0,y:0},b:{x:200,y:200},measure:'999'});
assert.equal(labels.length,0,'Legacy generic rectangle measure is retained but cannot invent an area');
for(const [a,b] of [[{x:0,y:0},{x:100,y:80}],[{x:100,y:80},{x:0,y:0}],[{x:0,y:0},{x:0,y:100}]]){
 labels.length=0;env.drawItem(c,{type:'polyline',points:[a,b],segmentData:[{measure:'500,125',unit:'mm',text:'Ahoj'}]});
 assert.equal(labels[0][0],'500,125 mm · Ahoj');
 const angle=labels[0][4];assert(Math.abs(angle)<=Math.PI/2);assert.notEqual(angle,0);
}
// Unitless caption mode must hide only text, never corrupt real measurement units.
assert.equal(env.measureDisplay('1250','mm',true),'1250');
assert.equal(env.measureDisplay('1250','cm',false),'1250 cm');
labels.length=0;
env.drawItem(c,{type:'dimension',a:{x:0,y:0},b:{x:100,y:0},
 measure:'1250',unit:'cm',hideUnit:true});
assert.equal(labels.at(-1)[0],'1250');
labels.length=0;
env.drawItem(c,{type:'polyline',points:[{x:0,y:0},{x:120,y:0}],
 segmentData:[{measure:'500',unit:'mm',hideUnit:true,text:'Voda'}]});
assert.equal(labels[0][0],'500 · Voda');
labels.length=0;
env.drawItem(c,{type:'circle',a:{x:0,y:0},b:{x:50,y:50},
 measure:'48',measureKind:'diameter',unit:'mm',hideUnit:true});
assert.equal(labels[0][0],'Ø 48');
const savedNoUnit=JSON.parse(JSON.stringify({measure:'1250',unit:'cm',hideUnit:true}));
assert.equal(savedNoUnit.unit,'cm');
assert.equal(savedNoUnit.hideUnit,true);
assert.equal((src.match(/option value="none"/g)||[]).length,3,
 'The dimension, line/shape and segmented measurement pickers must offer Bez jednotky');
assert(src.includes("hideUnit:chosen==='none'"),
 'Segmented units must preserve the numeric value and hide only the caption suffix');
const css=fs.readFileSync('app/src/main/assets/upgrade.css','utf8');
assert(css.includes('#editorHint{top:auto;bottom:24px;'),
 'Chain/cumulative hint must stay above the expandable toolbar handle');
// Real setTool/completePolyline code must commit once, then survive serialization.
const elements={editorHint:{},activeTool:{}};
Object.assign(env,{mode:'chain',selected:null,selectedHandle:null,drawStart:null,drawCurrent:null,stroke:[],
 polylineDraft:[{x:1,y:2},{x:30,y:40},{x:70,y:80}],lastTap:0,lastTapAt:null,lastDrawingTool:'chain',
 current:{items:[]},magnifierPoint:null,uid:()=> 'new-chain',paint(){},updateDrawingToolButton(){},
 checkpoint(){env.checkpoints++},commitEditor(){env.persisted=JSON.stringify(env.current)},checkpoints:0,
 finishDraw(){},$:id=>elements[id]});
vm.runInContext(part('function finishPendingPath()', 'function drawGrid()')+part('function completePolyline(', 'function stageDown('),env);
env.setTool('select');assert.equal(env.current.items.length,1);assert.equal(env.checkpoints,1);
assert.equal(JSON.parse(env.persisted).items[0].points.length,3);
env.setTool('select');assert.equal(env.current.items.length,1,'No duplicate on repeated finish');
env.setTool('chain');assert.equal(elements.editorHint.textContent,'Vyber počáteční bod');
for(let n=1;n<=5;n++){env.polylineDraft=Array.from({length:n},()=>({x:0,y:0}));env.updateChainHint();assert.equal(elements.editorHint.textContent,'Klepni pro další navazující kótu')}
env.polylineDraft=[];env.mode='cumulative';env.updateChainHint();assert.equal(elements.editorHint.textContent,'Označ výchozí bod');
env.polylineDraft=[{x:0,y:0}];env.updateChainHint();assert.equal(elements.editorHint.textContent,'Klepni pro další kótu');
// Competing endpoint/middle zones for short as well as long annotations.
vm.runInContext(part('function nearestHandle(', 'function nearestItem('),env);
env.view={zoom:1,dx:0,dy:0};
for(const type of ['line','arrow','dimension'])for(const length of [20,60,200]){
 const item={id:type,type,a:{x:50,y:100},b:{x:50+length,y:100},measure:'1250,123',unit:'mm'};
 env.current.items=[item];
 assert.equal(env.nearestHandle({x:50+length*.5,y:100}),null,'Middle must remain move zone even on short lines');
 assert.equal(env.nearestHandle({x:50+length*.1,y:100}).key,'a');
 assert.equal(env.nearestHandle({x:50+length*.9,y:100}).key,'b');
 assert.equal(item.measure,'1250,123');
}
console.log('OK: #17 transformed contours, area, readable text, finish/persist paths, exact hints, short/long grip zones');
// Short segmented tools follow the same end/middle rule.
for(const type of ['chain','cumulative','polyline','angle']){
 env.current.items=[{id:type,type,points:[{x:50,y:100},{x:70,y:100}]}];
 assert.equal(env.nearestHandle({x:60,y:100}),null,type+' short midpoint');
 assert.equal(env.nearestHandle({x:52,y:100}).pointIndex,0,type+' first endpoint');
}
vm.runInContext(part('function labelInfo(', 'function nearestSegmentLabel('),env);
const cumulative={type:'cumulative',points:[{x:0,y:0},{x:100,y:0},{x:200,y:0}],offset:5};
assert.equal(env.segmentLineScreen(cumulative,0).a.y,5);
assert.equal(env.segmentLineScreen(cumulative,1).a.y,31,'Hit areas match the actual staggered cumulative lines');
// Preserve legitimate identical dimensions; never deduplicate measured values.
cumulative.segmentData=[{measure:'100,000123',unit:'cm'},{measure:'100,000123',unit:'cm'}];
const reloaded=JSON.parse(JSON.stringify(cumulative));assert.equal(reloaded.segmentData.length,2);
assert.equal(reloaded.segmentData[1].measure,'100,000123');
