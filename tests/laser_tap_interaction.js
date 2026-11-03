/* Regresní test: laser -> klepnutí -> přímé uložení do konkrétní kóty. */
'use strict';
const fs=require('fs'),vm=require('vm'),assert=require('assert');
const src=fs.readFileSync('app/src/main/assets/editor.js','utf8');
function extract(start,end){
 const a=src.indexOf(start),b=src.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Missing function '+start);
 return src.slice(a,b);
}
const callbacks=extract('function stageDown(e){','function stageMove(e){')+
 '\n'+extract('function stageMove(e){','function stageUp(e){')+
 '\n'+extract('function stageUp(e){','function editItem(item){');
const a={id:'dimension-1',type:'dimension',measure:'',unit:'mm'};
const b={id:'dimension-2',type:'dimension',measure:'',unit:'mm'};
const tools={screen:'editor',mode:'dimension',current:{id:'photo',items:[a,b]},
 selected:null,selectedHandle:null,magnifierPoint:null,loupeSide:null,
 pointers:new Map(),drawPointerId:null,drawStart:null,drawCurrent:null,
 drag:null,gesture:null,lastTap:0,editStack:[],stroke:[],
 view:{zoom:1,dx:0,dy:0},prefs:{},paint:()=>{},
 stageCanvas:{setPointerCapture:()=>{},releasePointerCapture:()=>{}},
 eventPoint:e=>({x:e.x,y:e.y}),nearestHandle:()=>null,nearestLabel:point=>point.x===50?{item:a,kind:'label'}:null,
 nearestItem:point=>point.x===80?b:null,
 $:id=>id==='modal'?{hidden:true}:null,
 window:{lastLaser:{value:'2437',unit:'mm',assigned:false,receivedAt:Date.now()},isRecordLocked:()=>false},
 checkpoint:()=>{tools.checkpoints++},commitEditor:()=>{tools.commits++},
 notify:message=>{tools.notifications.push(message)},
 checkpoints:0,commits:0,notifications:[],
};
vm.createContext(tools);vm.runInContext(callbacks,tools);
function e(x,y){return{pointerId:1,button:0,x,y,preventDefault:()=>{},stopImmediatePropagation:()=>{}}}
function tap(x,y){tools.stageDown(e(x,y));tools.stageUp(e(x,y))}
tap(50,100);
assert.equal(a.measure,'2437');
assert.equal(a.unit,'mm');
assert.equal(tools.checkpoints,1);
assert.equal(tools.commits,1);
assert.equal(tools.window.lastLaser.assigned,true);
assert.ok(tools.notifications.some(s=>s.includes('zapsáno do kóty')));
// Přiřazené měření se nesmí bez nového laserového odečtu použít dvakrát.
tools.mode='select';
tap(80,100);
assert.equal(b.measure,'');
assert.equal(tools.commits,1);
// Nové měření lze přiřadit klepnutím na kótu mimo štítek.
tools.window.lastLaser={value:'183.5',unit:'cm',assigned:false,receivedAt:Date.now()};
tap(80,100);
assert.equal(b.measure,'183.5');
assert.equal(b.unit,'cm');
assert.equal(tools.commits,2);
// Uzamčená zakázka není možné změnit jen příchozím Bluetooth měřením.
tools.window.lastLaser={value:'5',unit:'m',assigned:false};
tools.window.isRecordLocked=()=>true;
tap(50,100);
assert.equal(a.measure,'2437');
assert.equal(tools.commits,2);
console.log('OK: Bosch laser click-to-assign, units, one-use reading, locked protection');
