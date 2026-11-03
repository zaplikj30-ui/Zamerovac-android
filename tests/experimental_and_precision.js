/* Regression of the optional tools, colored icon choices, and Bosch rounding. */
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const upgrade=fs.readFileSync('app/src/main/assets/upgrade.js','utf8');
const java=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
const protocol=fs.readFileSync('app/src/main/java/cz/zamerovac/app/BoschBleProtocol.java','utf8');
for(const [name,icon] of [
 ['Importovat obrázek / PDF / video','🖼️'],
 ['Nové plátno','🎨'],['Nová textová poznámka','📝'],
 ['Hlasová poznámka','🎤'],['Přidat další soubor','📎'],
 ['Pořídit fotografii','📷'],['Nová složka','📁']
]){
 assert.ok(app.includes("['"+icon+"','"+name+"'"),name+' must have recognizable colored icon');
}
assert.ok(app.includes("laserRounding:'none'"),'Default must preserve measurement');
assert.ok(app.includes("laserDecimals:'auto'"),'Default decimals must preserve precision');
assert.ok(upgrade.includes('Experimentální funkce'));
assert.ok(upgrade.includes('data-experiment'));
assert.ok(upgrade.includes('dataset.experimentalTool=id'));
assert.ok(upgrade.includes('experimentalCatalog.filter(([id])=>experimentalEnabled(id))'),
 'Only enabled experimental entries are shown in measurement tools');
assert.ok(upgrade.includes('Zaokrouhlování laseru'));
assert.ok(upgrade.includes('Desetinná místa laseru'));
assert.ok(java.includes('sendExperimentalLaserTrigger()'));
assert.ok(java.includes('gatt.writeCharacteristic(boschCommand)'));
assert.ok(protocol.includes('REMOTE_TRIGGER'));
assert.ok(!protocol.includes('Math.round((double)metres * 2000d) / 2d'),
 'Do not always round incoming Bluetooth data to 0.5 mm');
let prefs={unit:'mm',laserRounding:'none',laserDecimals:'auto'};
const ctx={window:{},screen:'browser',current:null,prefs,notify:()=>{},$:()=>({hidden:true}),checkpoint:()=>{},commitEditor:()=>{}};
vm.createContext(ctx);
vm.runInContext(fs.readFileSync('app/src/main/assets/laser-autofill.js','utf8'),ctx);
const f=ctx.window.__boschFormatDistance;
assert.equal(f(1250.6),'1250,6','Keep 0.6 mm by default');
prefs.laserRounding='0.1';
assert.equal(f(1250.6),'1250,6');
prefs.laserRounding='0.5';
assert.equal(f(1250.6),'1250,5');
prefs.laserRounding='1';
assert.equal(f(1250.6),'1251');
prefs.laserDecimals='2';
assert.equal(f(1250.6),'1251,00','Precision of display independent from raw input');
prefs.laserRounding='none';
assert.equal(f(1250.6),'1250,60');
assert.equal(ctx.window.__parseBoschDistance('1250.6','mm').millimeters,1250.6);
console.log('OK: experimenty vypnuté ve výchozím stavu, menu, ikony a desetiny mm');
