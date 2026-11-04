/* Bluetooth Bosch – test vybraných kót, jednotek, zamčení a historie. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const items=[{id:'a',type:'dimension',measure:'',unit:'mm'},
 {id:'b',type:'note',text:'text'}, {id:'c',type:'angle',measure:'90',unit:'°'}];
let selected='a',locked=false,commits=0,undosteps=0;
const app={window:{isRecordLocked:()=>locked},screen:'editor',current:{items},prefs:{unit:'mm'},
 notify:()=>{},$:()=>({hidden:true}),checkpoint:()=>undosteps++,commitEditor:()=>commits++};
Object.defineProperty(app,'selected',{get(){return selected},set(v){selected=v}});
vm.createContext(app);
vm.runInContext(fs.readFileSync('app/src/main/assets/laser-autofill.js','utf8'),app);
const m=app.window.__handleLaserAuto;
assert.equal(m('2.437','m'),true);
assert.equal(items[0].measure,'2437');assert.equal(commits,1);
m('2.437','m');assert.equal(commits,1);
m('245.2','cm');assert.equal(items[0].measure,'2452');assert.equal(commits,2);
selected='b';m('3','m');assert.equal(items[1].text,'text');
selected='c';m('4','m');assert.equal(items[2].measure,'90');
selected=null;m('5','m');assert.equal(commits,2);
selected='a';locked=true;m('6','m');assert.equal(commits,2);
locked=false;m('abc','mm');assert.equal(commits,2);
app.window.__applyLaserMeasurement('2.123','m',{fromHistory:true});
assert.equal(items[0].measure,'2123');assert.equal(commits,3);
assert.equal(undosteps,3);
app.screen='browser';assert.equal(m('100','mm'),false);
console.log('OK: Bosch měří přímo vybranou kótu, bezpečný převod a uložení');
// Software-only protocol test: each segment keeps its own chosen unit.
app.screen='editor';locked=false;
for(const type of ['chain','cumulative','polyline']){
 const segmented={id:'segments',type,unit:'mm',points:[{x:0,y:0},{x:100,y:0},{x:200,y:0}],activeSegmentIndex:1,
 segmentData:[{measure:'100,123456',unit:'in',text:'untouched'},{measure:'',unit:'cm',text:'destination'}]};
 app.current.items=[segmented];selected='segments';
 m('2.437','m');
 assert.equal(segmented.segmentData[1].measure,'243,7');assert.equal(segmented.segmentData[1].unit,'cm');
 assert.equal(segmented.segmentData[0].measure,'100,123456');assert.equal(segmented.segmentData[0].unit,'in');
 assert.equal(segmented.segmentData[1].text,'destination');assert.equal(segmented.segmentData[1].laserMeasuredMm,'2437');
}
