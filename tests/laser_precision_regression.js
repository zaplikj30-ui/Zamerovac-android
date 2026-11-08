'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
// Exercise the actual production callback. These are independent destinations;
// collecting failures keeps later segment types visible when the first one fails.
const failures=[];
for(const type of ['dimension','line','arrow','circle','ellipse','target','chain','cumulative','polyline','angle']){
 try{
  const item={id:'destination',type,measure:'',unit:'mm',a:{x:1,y:2},b:{x:300,y:80},
   points:[{x:1,y:2},{x:100,y:80},{x:300,y:80}],activeSegmentIndex:1,
   segmentData:[{measure:'777,000001',unit:'in',text:'untouched'},{measure:'',unit:'mm'}]};
  const current={items:[item]},stack=[];let commits=0;
  const sandbox={window:{isRecordLocked:()=>false},current,selected:item.id,screen:'editor',
   prefs:{unit:'mm',laserRounding:'1',laserDecimals:'0'},$:()=>({hidden:true}),notify:()=>{},
   checkpoint:()=>stack.push(JSON.stringify(current.items)),commitEditor:()=>++commits};
  vm.createContext(sandbox);vm.runInContext(fs.readFileSync('app/src/main/assets/laser-autofill.js','utf8'),sandbox);
  const apply=sandbox.window.__handleLaserAuto,segmented=['chain','cumulative','polyline','angle'].includes(type);
  const target=()=>segmented?item.segmentData[1]:item;
  const points=JSON.stringify(item.points),untouched=JSON.stringify(item.segmentData[0]);
  apply('1000.1','mm');assert.equal(target().laserMeasuredMm,'1000.1');const first=JSON.stringify(current.items);
  apply('1000.4','mm');
  assert.equal(target().measure,'1000','Display rounding remains a preference');
  assert.equal(target().laserMeasuredMm,'1000.4','A distinct exact reading must survive the same display text');
  assert.equal(commits,2);assert.equal(stack[1],first,'Undo checkpoint must preserve the previous exact reading');
  apply('1000.4','mm');assert.equal(commits,2,'Identical raw reading is idempotent');
  assert.equal(JSON.stringify(item.points),points);assert.equal(JSON.stringify(item.segmentData[0]),untouched);
  assert.equal(JSON.parse(JSON.stringify(item)).id,'destination');
  console.log('PASS laser-precision/'+type);
 }catch(error){failures.push(type+': '+error.message);console.error('FAIL laser-precision/'+type+': '+error.message)}
}
assert.deepEqual(failures,[],'Exact measurements lost: '+failures.join('; '));
