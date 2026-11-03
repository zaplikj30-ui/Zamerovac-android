/* Kontrola, že testovací vlaječka a hromadná hlášení nezasahují do zakázek. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const js=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
const native=fs.readFileSync('app/src/main/java/cz/zamerovac/app/MainActivity.java','utf8');
assert.match(html,/feedback-reports\.js/,'Hlášení se musí načítat na každé obrazovce');
assert.match(js,/feedbackFlag/,'V aplikaci musí být vlaječka');
assert.match(js,/setPointerCapture/,'Vlaječka a S Pen musí reagovat na tah');
for(const tool of ['pen','ellipse','rect','arrow','text','move']){
 assert.ok(js.includes('data-feedback-tool="'+tool+'"'),'Chybí nástroj pro označení: '+tool);
}
assert.match(js,/captureReportScreenshot/,'Snímek se musí pořizovat přímo z aktuální obrazovky');
assert.match(js,/feedbackShareZip/,'Připomínky se musí dát sdílet v dávce');
assert.match(js,/feedbackSaveZip/,'Připomínky se musí dát uložit offline');
assert.match(js,/localStorage\.setItem\(KEY/,'Připomínky se musí ukládat lokálně');
assert.match(native,/createIssueZip/,'Android musí vytvořit jeden ZIP');
assert.match(native,/shareIssueBundle/,'Android musí umět sdílení ZIP');
assert.match(native,/saveIssueBundle/,'Android musí umět export ZIP do souboru');
assert.match(native,/captureReportScreenshot/,'Android musí umět snímek právě otevřené obrazovky');
assert.match(native,/android\.view\.PixelCopy\.request\(getWindow\(\)/,'Screenshot musí zachytit skutečný obsah WebView včetně hardwarového plátna');
assert.doesNotMatch(native,/web\.draw\(new Canvas\(bmp\)\)/,'Staré kreslení WebView způsobovalo černou fotografii');
assert.match(js,/feedbackZoomIn/,'Screenshot musí jít přiblížit');
assert.match(js,/feedbackZoomOut/,'Screenshot musí jít oddálit');
assert.match(js,/feedbackZoomFit/,'Musí jít vrátit pohled na celou obrazovku');
assert.match(js,/active\.pointers\.size===2/,'Přiblížení dvěma prsty');
assert.match(js,/feedbackFieldsToggle/,'Popis musí být výsuvný, aby nezabíral místo screenshotu');
console.log('OK: vlaječka, kreslení S Penem, offline evidence a hromadný ZIP');
