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
