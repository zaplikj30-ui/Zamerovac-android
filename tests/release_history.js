'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const history=require('../app/src/main/assets/release-history.js');
const versions=history.releases.map(x=>x.version);
assert.deepEqual(versions,['1.2.152','1.2.151','1.2.150','1.2.149','1.2.148','1.2.147','1.2','1.1']);
assert.equal(new Set(versions).size,versions.length,'Version entries may not duplicate');
assert.equal(history.compareVersions('1.2.150','1.2.151'),-1);
assert.equal(history.compareVersions('1.2.151-test','1.2.151'),0);
assert.equal(history.compareVersions('1.2.151','1.2.150'),1);
assert.equal(history.parseVersion('web'),null);
assert.equal(history.forVersion('1.2.151-test')[0].version,'1.2.151',
 'History must not show future 1.2.152 in installed 1.2.151');
assert.equal(history.forVersion('1.2.150-test')[0].version,'1.2.150');
assert.equal(history.forVersion('1.2.149-test')[0].version,'1.2.149');
assert.equal(history.forVersion('1.2.152-test')[0].version,'1.2.152');
assert.equal(history.hasReleaseNotes('1.2.152'),true);
assert.equal(history.hasReleaseNotes('1.2.153-test'),false,
 'Unknown future version must not be silently relabeled as existing');
assert.equal(history.forVersion('1.2')[0].version,'1.2');
const allGroups=['Nové funkce','Opraveno','Vylepšeno','Informace'];
const allowedLinks=['help','helpSearch','extraToolbar','laserTap','gallery','search','address','photoAddress','lock','versions','sum','layers','notes','diagnostics','readings','theme','backup','sketch','editor','settings'];
for(const entry of history.releases){
 assert(entry.title&&entry.groups.length,'Each release needs exact title and categorized content');
 for(const group of entry.groups){
  assert(allGroups.includes(group.kind),group.kind);
  assert(group.items.length,entry.version+': empty group');
  for(const item of group.items){
   assert(item.text&&item.text.length>12,'Missing meaningful release description');
   if(item.feature)assert(allowedLinks.includes(item.feature),'Dead release navigation: '+item.feature);
  }
 }
}
const find=(version,term)=>JSON.stringify(history.releases.find(x=>x.version===version)).includes(term);
assert(find('1.2.151','Nápověda')&&find('1.2.151','Lupa'));
assert(find('1.2.150','Bluetooth Bosch')&&find('1.2.150','PDF'));
assert(find('1.2.149','Vysypat koš')&&find('1.2.149','Klepnutí'));
assert(find('1.2.152','chybné přiřazování'));
assert(find('1.2.148','nejsou na GitHubu dostatečně podrobné'));
const upgrade=fs.readFileSync(path.join(root,'app/src/main/assets/upgrade.js'),'utf8');
const html=fs.readFileSync(path.join(root,'app/src/main/assets/index.html'),'utf8');
const help=fs.readFileSync(path.join(root,'app/src/main/assets/help.js'),'utf8');
assert(!upgrade.includes("version:appVersionShort"),'Do not relabel old feature notes with installed version');
assert(upgrade.includes('catalog?.forVersion(appVersionShort)'));
assert(upgrade.includes('📋  Historie změn'),'Change history must be accessible from main menu');
assert(upgrade.includes('Novinky a historie změn'),'Change history must remain available in settings');
assert(html.includes('<script src="release-history.js"></script>'));
assert(html.indexOf('release-history.js')<html.indexOf('upgrade.js'),
 'Read-only data must be available before history view is initialized');
assert(help.includes('☰ → Historie změn'),'Offline help must be updated together with new feature');
const source=fs.readFileSync(path.join(root,'app/src/main/assets/release-history.js'),'utf8');
assert.doesNotMatch(source,/fetch\s*\(|XMLHttpRequest|localStorage|Native\./,'Offline catalog must not access network or customer data');
console.log('PASS true versioned changelog: fixed releases, improvements, no future notes, offline, help and menus');
assert.equal(history.pendingChanges.released,false,'Working notes must not pretend to be a released version');
assert(!history.forVersion('1.2.152').includes(history.pendingChanges));
assert(JSON.stringify(history.pendingChanges).includes('spustitelných příloh'));
