'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const help=require('../app/src/main/assets/help.js');
assert.equal(help.chapters.length,25,'Every approved guide area needs a chapter');
const notesGuide=help.chapters.find(c=>c.id==='notes');
assert(notesGuide?.notes.some(t=>t.includes('Zrušit zachová původní text a přílohy')),'Rich note Cancel must preserve saved attachments');
assert(notesGuide?.notes.some(t=>t.includes('jen přes obrazovou přílohu')&&t.includes('nikoli přes nahraný zvuk')),'Photo detail must not open from audio');
assert(notesGuide?.notes.some(t=>t.includes('původní pokus je ukončený')&&t.includes('nové nahrávání')),'Failed Stop requires a new recording attempt');
assert(notesGuide?.notes.some(t=>t.includes('Uchované hlasové nahrávky')&&t.includes('i po restartu')),'Durable audio recovery must be documented');
assert(notesGuide?.notes.some(t=>t.includes('Připojit k této poznámce')&&t.includes('Uložit kopii originálu')),'Attach and uncertain-original recovery actions must be explained');
assert(notesGuide?.notes.some(t=>t.includes('Automatické mazání nahrávek je vypnuté i při vysypání koše')),'No audio GC, including trash purge');
assert(notesGuide?.notes.some(t=>t.includes('ZIP zakázek nezahrnuje nepřipojené nahrávky')),'Backup limitation must be explicit');
assert(notesGuide?.notes.some(t=>t.includes('Ostatní dostupné originály')&&t.includes('samostatné upozornění')),'Fault isolation and export of healthy originals must be documented');
assert(help.chapters.find(c=>c.id==='trash')?.notes.some(s=>s.includes('starších vložených záznamů')),'Trash help must describe retained legacy references');
assert(help.chapters.find(c=>c.id==='trash')?.notes.some(s=>s.includes('nepřiměřeně zanořená')),'Trash help must explain fail-closed history check');
assert(help.chapters.find(x=>x.id==='undo')?.notes.some(x=>x.includes('nevytvoří krok historie')&&x.includes('Znovu')),'Undo/Redo gesture preservation must be explained');
assert(help.chapters.find(c=>c.id==='trouble')?.steps.some(s=>s.includes('rozpracovaná připomínka zůstane otevřená')),'Troubleshooting must explain retry after failed feedback save');
assert(help.chapters.find(c=>c.id==='trouble')?.steps.some(s=>s.includes('Android Zpět')&&s.includes('bezpečně odmítnou')),'Busy feedback navigation must be documented');
assert(help.chapters.find(x=>x.id==='zoom')?.steps.some(x=>x.includes('oba zvedni')&&x.includes('nový tah')),'Pan after pinch must be explained');
assert.equal(new Set(help.chapters.map(x=>x.id)).size,help.chapters.length,'Unique stable help chapter identifiers');
for(const chapter of help.chapters){
 assert(chapter.title&&chapter.intro&&chapter.steps.length>0&&chapter.notes.length>0,chapter.id+' must be practical and qualified');
 assert(Array.isArray(chapter.keywords),chapter.id+' must be searchable');
}
function finds(query,id){
 assert(help.searchChapters(query).some(c=>c.id===id),'Missing search result '+query+' -> '+id);
}
finds('kota','dimension');
finds('KÓTA','dimension');
finds('mřížka','zoom');
finds('mrizka','zoom');
finds('ZALOHA','backup');
finds('Bosch','bosch');
finds('soukromí','customer');
finds('s pen','handles');
finds('video','video');
finds('ruian','search');
finds('mapa','search');
assert.equal(help.searchChapters('  ').length,help.chapters.length);
assert.equal(help.searchChapters('zzzz--neexistuje').length,0);
const src=fs.readFileSync(path.join(root,'app/src/main/assets/help.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const main=fs.readFileSync(path.join(root,'app/src/main/assets/upgrade.js'),'utf8');
const extra=fs.readFileSync(path.join(root,'app/src/main/assets/app.js'),'utf8');
assert.match(html,/<script src="help\.js"><\/script>/,'Offline guide must be shipped in APK');
assert.match(html,/<link rel="stylesheet" href="help\.css">/,'Help styles must be shipped');
assert.match(main,/❔  Nápověda/,'Main hamburger menu must link to help');
assert.match(extra,/\['Nápověda'/,'Overflow menu must link to help');
assert.doesNotMatch(src,/\bfetch\s*\(|XMLHttpRequest|localStorage\.|Native\.|state\./,'Help must not make network requests or mutate project data');
assert.match(src,/root\.handleAndroidBack=function/,'Physical Back must close help');
console.log('PASS full offline help: 25 chapters, Czech search, offline scripts, safe menus and Back');
assert.deepEqual(help.matchingRanges('Kóta kóta KOTA','kota'),[[0,4],[5,9],[10,14]]);
assert.deepEqual(help.matchingRanges('<script> & kóta','<script>'),[[0,8]]);
assert.deepEqual(help.matchingRanges('žádný výskyt','zzzz'),[]);
assert.deepEqual(help.matchingRanges('kóta',''),[]);

finds('sha-256','backup');finds('neulozeno','backup');

finds('wifi direct','cloud');finds('párování','cloud');finds('čekající potvrzení','cloud');

finds('historické zálohy','backup');finds('sdílené bloky','backup');finds('měřená síť','backup');
finds('webové odkazy','safety');finds('spustitelné přílohy','safety');
finds('rádiovou adresu','cloud');
finds('oznámení','cloud');finds('úspora baterie','cloud');
finds('chyba mikrofonu','notes');
finds('původní složky','photo');finds('1024 souborů','photo');
finds('další dávku zpráv','cloud');finds('změní povolené připojení','cloud');
finds('podepsanou žádostí','cloud');

finds('starší záložní kopie','cloud');finds('ztrátu všech kopií','cloud');

finds('poskytovatel zálohy','backup');

finds('Google účet','cloud');finds('soukromý prostor','backup');finds('odpojit Disk','cloud');

finds('změně cloudového úložiště','cloud');finds('místně vyřadí','cloud');

finds("frekvence","cloud");
for(const phrase of ["15, 30 či 60 minut","Ručně zastaví vlastní automatické pokusy","příchozí místní spojení"])assert(src.includes(phrase),"Missing scheduling meaning: "+phrase);

for(const phrase of ['souběhu ověřených místních relací','ostatní příchozí zprávy','místní kontroly velkých originálů'])assert(src.includes(phrase),'Missing transport limitation: '+phrase);

assert(src.includes('bezpečnostní klíč zařízení není dostupný'),'Identity initialization failure must be explained');

assert(src.includes('další ověřenou kopii'),'Backup repair and original preservation must be explained');

assert(src.includes('povolený testovací účet'),'Google Testing restriction must be explained without exposing the account');

assert(src.includes('Registrace a konfigurace této testovací verze jsou propojené'),'Registered preview setup must no longer be described as missing');

finds('20 MiB','backup');finds('20 000','backup');finds('časový limit','backup');finds('OPRAVENÝ CYKLUS SLOŽEK','cloud');finds('dokončované spojení','cloud');finds('přílohy historie','trash');
