/* Kontrola odstranění starého režimu 'měření a až pak klepnout'.
   Uživatel výslovně schválil variantu A: vybrat kótu a změřit Boschem.
 */
const assert=require('node:assert/strict'),fs=require('fs');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const upgrade=fs.readFileSync('app/src/main/assets/upgrade.js','utf8');
assert.ok(!editor.includes("kind:'laser-tap'"),'Starý režim přiřazení klepnutím musí být odstraněn');
assert.ok(!editor.includes('last.assigned=true'),'Staré potvrzení laseru nesmí zůstat');
assert.ok(!app.includes('assigned:false'),'Zastaralá čekající hodnota nesmí přepsat jinou kótu');
assert.ok(upgrade.includes("window.__handleLaserAuto(value,unit)"),'Laser musí volat okamžitý zápis');
console.log('OK: laser nevyžaduje dodatečné klepnutí na kótu');
