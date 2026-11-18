'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const history=require('../app/src/main/assets/release-history.js');
const versioning=require('../tools/release/versioning.js');
// Fixed 1.4.0 evidence belongs to its historical release, not the latest slot.
// A new 1.4.1 entry must not relabel or hide older release notes.
const historic14=history.releases.find(x=>x.version==='1.4.0');
assert(historic14,'Release history must retain 1.4.0');
const notes14=JSON.stringify(historic14);
for(const phrase of [
 'nevytvářejí prázdné kroky v historii',
 'po uvolnění prstu obraz neodskočí',
 'starším JSON objektu',
 'Neověřitelná historie vysypání koše',
 'nepotvrzené změny se neoznačí jako uložené',
 'pozdní dokončení jiné editační relace',
 'ACK synchronizace ochranu neruší'
])assert(notes14.includes(phrase),'Missing historic 1.4.0 release note: '+phrase);
// 1.4.1 is only a prepared technical version until an explicit BUILD/RELEASE.
const proposed=history.releases.find(x=>x.version==='1.4.1');
assert(proposed&&proposed.groups.length,'Candidate release must have specific notes');
assert(JSON.stringify(proposed).includes('odděluje sestavení APK'),'Candidate notes must describe the actual release-path work');
assert(!JSON.stringify(proposed).includes('Nové funkce'),'Do not invent product features for a technical release');
assert.equal(history.forVersion('1.4.1-test')[0]?.version,'1.4.1');
assert(!history.forVersion('1.4.0-test').some(x=>x.version==='1.4.1'),
 'Already installed 1.4.0 must not see unpublished 1.4.1 notes');
const versions=history.releases.map(x=>x.version);
const recorded=['1.4.0','1.3.0','1.2.153','1.2.152','1.2.151','1.2.150','1.2.149','1.2.148','1.2.147','1.2','1.1'];
assert.deepEqual(versions.slice(-recorded.length),recorded,'Historical releases may not be removed, reordered or relabeled');
assert.equal(versions[0],versioning.check(),'Latest release notes must match configured app version');
assert(versions.every((v,i)=>i===0||history.compareVersions(versions[i-1],v)===1),'Releases must be ordered newest first');
assert.equal(new Set(versions).size,versions.length,'Version entries may not duplicate');
assert.equal(Object.hasOwn(historic14,'status'),false,'Shipped 1.4.0 history must not retain an unpublished status');
assert(historic14.title&&historic14.groups.length,'Historical 1.4.0 notes must be present');
assert(history.hasReleaseNotes('1.4.0-test'));
assert.equal(history.forVersion('1.4.0-test')[0].version,'1.4.0');
assert(!history.forVersion('1.3.0-test').some(x=>x.version==='1.4.0'),'Installed 1.3.0 must not show future 1.4.0');
assert(notes14.includes('ACK synchronizace ochranu neruší'));
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
assert.equal(history.hasReleaseNotes('1.3.0-test'),true);
assert.equal(history.forVersion('1.3.0-test')[0].version,'1.3.0');
assert.equal(history.forVersion('1.2.153-test')[0].version,'1.2.153');
assert.equal(history.hasReleaseNotes('1.2.153-test'),true,
 'Exact planned 1.2.153 needs its own release entry, not relabeled old notes');
assert.equal(history.forVersion('1.2.153-test')[0].version,'1.2.153');
assert.equal(history.forVersion('1.2.152-test')[0].version,'1.2.152',
 'Existing installs must not display newer notes');
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
assert.equal(history.releaseChanges.issue,39,'Release notes must match the update being published');
assert.equal(history.releaseChanges.version,'1.2.153');
assert(!history.forVersion('1.2.152').some(x=>x.version==='1.2.153'));
assert(find('1.2.153','A39-01 až A39-06'))
assert(find('1.3.0','smysluplná čísla vydání'));
assert(find('1.2.153','Oddělený výběr Google účtu'));
assert(JSON.stringify(history.releaseChanges).includes('spustitelných příloh'));
assert(JSON.stringify(history.releaseChanges).includes('zaniklá skupina Wi-Fi Direct'));
assert(JSON.stringify(history.releaseChanges).includes('služba Androidu s oznámením'));
assert(JSON.stringify(history.releaseChanges).includes('potvrzených metadatech'));
assert(JSON.stringify(history.releaseChanges).includes('Opožděné výsledky'));
assert(JSON.stringify(history.releaseChanges).includes('rozlišení dávky od potvrzení dat'));
assert(JSON.stringify(history.releaseChanges).includes('Rušení plánované úlohy'));
assert(JSON.stringify(history.releaseChanges).includes('Evidence publikace'));

assert(JSON.stringify(history.releaseChanges).includes('Návrat ke starší místní databázi'));

assert(JSON.stringify(history.releaseChanges).includes('Kontrola záloh odmítá proud'));

assert(JSON.stringify(history.releaseChanges).includes('Oddělený výběr Google účtu'));

assert(JSON.stringify(history.releaseChanges).includes('Nové cloudové úložiště'));

for(const phrase of ['A39-01 až A39-06','UTF-8 limit','odvolání rozjednaného TLS','cyklu složek','mimo zámek ukládání','celkových bajtů','hlasová a historická média'])assert(JSON.stringify(history.releaseChanges).includes(phrase),'Missing audit fix note: '+phrase);

assert.match(fs.readFileSync('app/src/main/assets/release-history.js','utf8'),/ACK synchronizace ochranu neruší/);
