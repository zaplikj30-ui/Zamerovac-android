'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const help=require('../app/src/main/assets/help.js');
assert.equal(help.chapters.length,25,'Every approved guide area needs a chapter');
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
