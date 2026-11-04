/* Per-meter Bosch history: keep one-meter UI simple, retain legacy values,
 * distinguish same-named meters, and never delete another meter's readings. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const text=fs.readFileSync('app/src/main/assets/upgrade.js','utf8');
const begin=text.indexOf("let laserState='off',laserName=''");
const end=text.indexOf('const originalGlobalOverflow=showOverflow;',begin);
assert(begin>=0&&end>begin,'Bluetooth logic could not be isolated');
const code=text.slice(begin,end);
const oldReading={value:'123',unit:'mm',time:'2026-11-04T12:00:00.000Z'};
const saved=new Map([['zamerovac-bosch-readings-v1',JSON.stringify([oldReading])]]);
const localStorage={
 getItem:key=>saved.get(key)||null,
 setItem:(key,val)=>saved.set(key,String(val)),
 removeItem:key=>saved.delete(key)
};
const elements=new Map();
let lastModal=null;
const bluetooth={
 classList:{toggle(){}},innerHTML:'',title:'',setAttribute(){},addEventListener(){}
};
elements.set('bluetoothBtn',bluetooth);
elements.set('boschHistoryBtn',{onclick:null,addEventListener(){},setAttribute(){}});
elements.set('modal',{hidden:true});
elements.set('modalBody',{querySelectorAll:()=>[]});
const $=key=>elements.get(key)||null;
function modal(title,content,callback,label){
 lastModal={title,content,callback,label};
 elements.get('modal').hidden=false;
 if(content.includes('id="laserHistoryFilter"'))
  elements.set('laserHistoryFilter',{value:'all',onchange:null});
 else elements.delete('laserHistoryFilter');
 elements.set('clearReadings',{onclick:null});
}
const env={window:{onLaserValue(){},__handleLaserAuto:()=>true},
 localStorage,$,modal,Date,Map,Set,Number,String,Array,JSON,
 esc:v=>String(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;'),
 notify(){},logEvent(){},experimentalEnabled:()=>false,
 console,native:false,Native:{}};
vm.createContext(env);
vm.runInContext(code,env);

const idA='meter-aaaaaaaaaaaaaaaaaaaaaaaa';
const idB='meter-bbbbbbbbbbbbbbbbbbbbbbbb';
assert.equal(typeof elements.get('boschHistoryBtn').onclick,'function');
elements.get('boschHistoryBtn').onclick();
assert(!lastModal.content.includes('laserHistoryFilter'),'Single/unknown history needs no selector');
assert(lastModal.content.includes('123 mm'),'Legacy reading must survive migration');

env.window.onLaserStatus(JSON.stringify({status:'receiving',name:'GLM 100-25 C',deviceId:idA}));
env.window.onLaserValue('100','mm');
elements.get('boschHistoryBtn').onclick();
assert(!lastModal.content.includes('laserHistoryFilter'),'One known meter should show history immediately');
const afterOne=JSON.parse(saved.get('zamerovac-bosch-readings-v1'));
assert.equal(afterOne[0].deviceId,idA);
assert.equal(afterOne[0].deviceName,'GLM 100-25 C');
assert.equal(afterOne[1].value,'123');
assert(!JSON.stringify(afterOne).includes('AA:BB:'),'Never store real Bluetooth addresses in reading history');

env.window.onLaserStatus(JSON.stringify({status:'receiving',name:'GLM 100-25 C',deviceId:idB}));
env.window.onLaserValue('200','mm');
elements.get('boschHistoryBtn').onclick();
assert(lastModal.content.includes('id="laserHistoryFilter"'),'Two meters enable optional filter');
assert(lastModal.content.includes('Všechny měřáky'));
assert(lastModal.content.includes('měřák 1')&&lastModal.content.includes('měřák 2'),
 'Same-named meters need distinguishable labels');
assert(lastModal.content.includes('Starší měření bez přiřazení'));
const selector=elements.get('laserHistoryFilter');
selector.value=idA;selector.onchange();
assert(lastModal.content.includes('<span>100 mm'),'Selected meter A appears');
assert(!lastModal.content.includes('<span>200 mm'),'Other meter B must not appear');
assert(!lastModal.content.includes('<span>123 mm'),'Legacy reading must not masquerade as meter A');

// Delete only the active meter's history, and always confirm first.
elements.get('clearReadings').onclick();
assert(lastModal.title.includes('Potvrdit vymazání'));
lastModal.callback();
const afterDelete=JSON.parse(saved.get('zamerovac-bosch-readings-v1'));
assert.equal(afterDelete.length,2);
assert(afterDelete.some(x=>x.value==='200'&&x.deviceId===idB));
assert(afterDelete.some(x=>x.value==='123'&&!x.deviceId));
assert(!afterDelete.some(x=>x.value==='100'));

elements.get('boschHistoryBtn').onclick();
const selector2=elements.get('laserHistoryFilter');
// After removing one of two known meters, the selector is no longer needed.
assert.equal(selector2,undefined);
assert(lastModal.content.includes('123 mm')&&lastModal.content.includes('200 mm'));
console.log('OK: meter-specific history, simple single-meter UI, legacy migration and safe deletion');
