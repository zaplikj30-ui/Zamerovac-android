/* #196 – DOM/logic regression with fake UI; real Android still requires physical retest. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
// Keep this fake DOM aligned with the exact production constructors.
const assets=path.join(__dirname,'../app/src/main/assets/');
const peerSource=fs.readFileSync(path.join(assets,'peer-sync.js'),'utf8');
const backupSource=fs.readFileSync(path.join(assets,'backup-history.js'),'utf8');
const flightSource=fs.readFileSync(path.join(assets,'flight-recorder.js'),'utf8');
const appSource=fs.readFileSync(path.join(assets,'app.js'),'utf8');
assert.match(peerSource,/node\('button',text,'outline'\)/);
assert.match(peerSource,/button\('Synchronizace zařízení – místní a Google Disk','peerSettings',open\)/);
assert.match(backupSource,/el\('button',text,'outline'\)/);
assert.match(backupSource,/button\('Historické zálohy a obnova','historySettings',open\)/);
class Node{
 constructor(tag){this.tagName=tag.toUpperCase();this._children=[];this.parent=null;this.id='';this.className='';this._text='';this.dataset={};this.hidden=false;this.attributes={};this.value='';this.focused=false;this.scrollTop=0;this.style={};}
 get children(){return this._children;}
 get classList(){return {contains:s=>this.className.split(/\s+/).includes(s)}}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
 set textContent(v){this._text=String(v);this.replaceChildren();}
 append(...nodes){for(const n of nodes){if(n.parent)n.parent._children=n.parent.children.filter(x=>x!==n);this._children.push(n);n.parent=this;}}
 replaceChildren(...nodes){for(const child of this._children)child.parent=null;this._children=[];this.append(...nodes)}
 contains(node){return this===node||this.children.some(x=>x.contains(node))}
 querySelector(query){if(query===':scope > .setGroup')return this.children.find(x=>x.classList.contains('setGroup'))||null;const match=n=>query[0]==='#'?n.id===query.slice(1):query==='[data-setting]'?typeof n.dataset.setting==='string':query==='.panelHead b'?n.tagName==='B':query==='span'?n.tagName==='SPAN':query==='input,select,button'?['INPUT','SELECT','BUTTON'].includes(n.tagName):false;let walk=n=>{for(const child of n.children){if(match(child))return child;let nested=walk(child);if(nested)return nested}return null};return walk(this)}
 querySelectorAll(query){if(query==='.panel'){const hits=[];let walk=n=>{if(n.classList.contains('panel'))hits.push(n);n.children.forEach(walk)};walk(this);return hits}return [];}
 matches(q){return q==='button,input,select'&&['BUTTON','INPUT','SELECT'].includes(this.tagName)}
 setAttribute(k,v){this.attributes[k]=v;if(k==='id')this.id=v}
 getAttribute(k){return this.attributes[k]||null}
 scrollIntoView(){this.scrolled=true}
 focus(){this.focused=true}
}
const doc=new Node('document');const panel=new Node('section');panel.className='panel';panel.id='settingsPanel';panel.hidden=true;
const head=new Node('div');head.className='panelHead';const title=new Node('b');head.append(title);
const back=new Node('button');back.id='closeSettings';
const host=new Node('div');host.id='settingsContent';panel.append(head,back,host);doc.append(panel);
const modal=new Node('div');modal.id='modal';modal.hidden=true;doc.append(modal);
const all=[];const h=t=>{const n=new Node('div');n.className='setGroup';n.textContent=t;return n};
const row=(label,id,key)=>{const n=new Node('label');n.className='setting';n.id=id||'';const span=new Node('span');span.textContent=label;n.append(span);if(key){const input=new Node('input');input.dataset.setting=key;n.append(input)}n.onclick=()=>{actions++;};all.push(n);return n};
let actions=0,saves=0,reads=0,renderCalls=0,recovery=0,peerOpened=0,historyOpened=0;
const outline=(label,id,action)=>{const n=new Node('button');n.className='outline';n.type='button';n.id=id;n.textContent=label;n.onclick=action;all.push(n);return n;};
const seed=()=>{
 const nodes=[h('Editor'),row('Lupa',null,'loupe'),row('Přednastavené texty',null,'presets'),h('Rozměry'),row('Jednotky',null,'unit'),h('Vzhled'),row('Barva nástrojů',null,'color'),h('Cloud'),row('Automatická synchronizace',null,'autoSync'),h('Systémová složka synchronizace'),row('Vybrat systémovou složku','chooseCloud'),h('Bluetooth'),row('Připojit měřič','chooseLaser'),h('Jazyk'),row('Jazyk aplikace','appLanguageSetting'),h('O aplikaci'),row('Verze Zaměřovače','appVersionInfo')];
 const extra=new Node('div');extra.append(h('Vzhled aplikace'),row('Barva prostředí','uiTheme'),h('Laser Bosch – přesnost zápisu'),row('Zaokrouhlování laseru','laserRoundingChoice'),h('Informace a údržba'),row('Historie změn','openHistory'),row('Historie měření z laseru','openReadings'),row('Moje připomínky','openFeedbackReports'),row('Exportovat ZIP','backupAll'),row('Obnovit ZIP','restoreAll'));
 // The real peer-sync.js and backup-history.js mount .outline BUTTONs, not .setting labels.
 nodes.push(extra,h('Synchronizace zařízení'),outline('Synchronizace zařízení – místní a Google Disk','peerSettings',()=>{peerOpened++;}),h('Zálohování'),outline('Historické zálohy a obnova','historySettings',()=>{historyOpened++;}));
 host.replaceChildren(...nodes);
 sandbox.ZFlight?.attachSettings(host);
};
const lookup=id=>{let found;const walk=n=>{if(n.id===id)found=n;for(const c of n.children)walk(c)};walk(doc);return found||null};
const storage=new Map();let storageWrites=0;
const sandbox={window:{},document:{getElementById:lookup,createElement:tag=>new Node(tag),querySelectorAll:s=>doc.querySelectorAll(s)},renderSettings:()=>{renderCalls++;seed()},toggleSettings:()=>{panel.hidden=!panel.hidden;if(!panel.hidden)sandbox.renderSettings()},notify:()=>{},save:()=>{saves++},Native:{loadData:()=>{reads++}},console,
 performance:{now:()=>0},localStorage:{getItem:key=>storage.has(key)?storage.get(key):null,setItem:(key,value)=>{storageWrites++;storage.set(key,String(value))},removeItem:key=>{storageWrites++;storage.delete(key)}},
 handleAndroidBack:()=>{if(!modal.hidden){modal.hidden=true;return 'handled';}if(!panel.hidden){panel.hidden=true;return 'handled';}return 'root';}};
sandbox.window=sandbox;
vm.runInNewContext(flightSource,sandbox,{filename:'flight-recorder.js'});
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/settings-navigation.js'),'utf8'),sandbox,{filename:'settings-navigation.js'});
sandbox.toggleSettings();assert.equal(panel.hidden,false);assert.equal(renderCalls,1);assert.equal(saves,0);assert.equal(reads,0);assert.equal(actions,0);
assert.equal(lookup('settingsContent').children.length,6);const categories=lookup('settingsContent').children[0].children[2];assert.equal(categories.children.length,5);
assert.equal(all.length,18);for(const item of all)assert.equal(item.parent?.className,'settings-subgroup');
assert.equal(lookup('peerSettings').tagName,'BUTTON');assert.equal(lookup('peerSettings').className,'outline');
assert.equal(lookup('historySettings').tagName,'BUTTON');assert.equal(lookup('historySettings').className,'outline');
assert.equal(lookup('settingsPage-measurement').contains(lookup('chooseLaser')),true);
assert.equal(lookup('settingsPage-measurement').contains(lookup('openReadings')),true);
assert.equal(lookup('settingsPage-editor').contains(all.find(x=>x.querySelector('[data-setting]')?.dataset.setting==='presets')),true);
assert.equal(lookup('settingsPage-sync').contains(lookup('backupAll')),true);
assert.equal(lookup('settingsPage-sync').contains(lookup('historySettings')),true);
assert.equal(lookup('settingsPage-maintenance').contains(lookup('openPendingAudioRecovery')),true);
assert.equal(lookup('settingsPage-maintenance').contains(lookup('openFeedbackReports')),true);
assert.equal(sandbox.ZamerovacSettingsNavigation.showTarget('peerSettings'),true);
assert.equal(lookup('settingsPage-sync').hidden,false);
assert.equal(sandbox.ZamerovacSettingsNavigation.showTarget('historySettings'),true);
assert.equal(lookup('settingsPage-sync').hidden,false);
assert.equal(sandbox.ZamerovacSettingsNavigation.showTarget('uiTheme'),true);
assert.equal(lookup('settingsPage-appearance').hidden,false);
assert.equal(lookup('settingsPage-sync').hidden,true);
back.onclick();assert.equal(lookup('settingsPage-appearance').hidden,true);assert.equal(categories.hidden,false);
const search=lookup('settingsSearch'),results=lookup('settingsSearchResults');
const searchFor=q=>{search.value=q;search.oninput();return [...results.children].map(n=>n.textContent);};
// Positive: real production .outline buttons are findable, not just moved to a section.
let hits=searchFor('historické zálohy');assert.equal(hits.length,1);assert.match(hits[0],/Historické zálohy a obnova/);
assert.equal(peerOpened,0);assert.equal(historyOpened,0);assert.equal(saves,0);assert.equal(reads,0);
results.children[0].onclick();assert.equal(lookup('settingsPage-sync').hidden,false);
assert.equal(lookup('historySettings').focused,true);
lookup('historySettings').onclick();assert.equal(historyOpened,1);
back.onclick();
hits=searchFor('synchronizace zařízení');assert.equal(hits.length,1);assert.match(hits[0],/Synchronizace zařízení – místní a Google Disk/);
results.children[0].onclick();assert.equal(lookup('settingsPage-sync').hidden,false);
assert.equal(lookup('peerSettings').focused,true);
lookup('peerSettings').onclick();assert.equal(peerOpened,1);
back.onclick();
// Negative: a broad keyword must not surface unrelated controls from the category.
hits=searchFor('nahravky');assert.equal(hits.length,1);assert.match(hits[0],/Obnova nahrávek/);
assert.equal(hits.some(x=>/Verze|Diagnostika|Připomínky/.test(x)),false);
hits=searchFor('zaloha');assert.ok(hits.length>=1);
assert.equal(hits.some(x=>/Automatická synchronizace|Místní a Google Disk|Vybrat systémovou složku/.test(x)),false);
assert.equal(searchFor('neexistujici_nastaveni')[0],'Žádné odpovídající nastavení.');
assert.equal(saves,0);assert.equal(reads,0);assert.equal(actions,0);assert.equal(peerOpened,1);assert.equal(historyOpened,1);
search.value='';search.oninput();assert.equal(results.hidden,true);
assert.equal(sandbox.ZamerovacSettingsNavigation.showTarget('historySettings'),true);
assert.equal(sandbox.handleAndroidBack(),'handled');assert.equal(categories.hidden,false);
assert.equal(sandbox.handleAndroidBack(),'handled');assert.equal(panel.hidden,true);
sandbox.toggleSettings();assert.equal(categories.hidden,false);
sandbox.ZamerovacSettingsNavigation.showTarget('uiTheme');modal.hidden=false;
assert.equal(sandbox.handleAndroidBack(),'handled');assert.equal(modal.hidden,true);assert.equal(lookup('settingsPage-appearance').hidden,false);
assert.equal(sandbox.handleAndroidBack(),'handled');assert.equal(lookup('settingsPage-appearance').hidden,true);
assert.equal(actions,0);assert.equal(saves,0);assert.equal(reads,0);
lookup('openPendingAudioRecovery').onclick();assert.equal(recovery,0);
sandbox.PendingAudio={show:()=>{recovery++}};lookup('openPendingAudioRecovery').onclick();assert.equal(recovery,1);
lookup('backupAll').onclick();assert.equal(actions,1); // original listener survives the move
const missing=lookup('settingsSearch');missing.value='neexistujici_nastaveni';missing.oninput();
assert.equal(lookup('settingsSearchResults').children.length,1);
assert.equal(lookup('settingsSearchResults').children[0].tagName,'P');
missing.value='';missing.oninput();assert.equal(categories.hidden,false);
assert.equal(sandbox.ZamerovacSettingsNavigation.showTarget('chooseLaser'),true);
sandbox.renderSettings(); // controller re-renders after a setting change or rejected save
assert.equal(lookup('settingsPage-measurement').hidden,false);
assert.equal(lookup('settingsPage-measurement').contains(lookup('chooseLaser')),true);
assert.equal(saves,0);assert.equal(reads,0);assert.equal(actions,1);
// P2 regression: execute the production deep link after renderSettings and both
// real modules together. This used to detach the recorder wrapper and duplicate IDs.
const handlerStart=appSource.indexOf('window.openZamerovacDiagnosticHistory=()=>{');
const handlerEnd=appSource.indexOf('function renderSettings(){',handlerStart);
assert(handlerStart>=0&&handlerEnd>handlerStart,'Production diagnostic handler missing');
sandbox.$=lookup;
vm.runInNewContext(appSource.slice(handlerStart,handlerEnd),sandbox,{filename:'app.js#diagnostic-history'});
const countId=id=>{let hits=0;const walk=n=>{if(n.id===id)hits++;n.children.forEach(walk)};walk(doc);return hits;};
const clickText=text=>{let hits=0;const walk=n=>{if(n.tagName==='BUTTON'&&n.textContent===text)hits++;n.children.forEach(walk)};walk(doc);return hits;};
assert.equal(countId('flightSettings'),1,'One owned flight wrapper before deep link');
assert.equal(countId('flightHistory'),1,'One flight history before deep link');
assert.equal(sandbox.openZamerovacDiagnosticHistory(),true,'Production long-hold destination opens');
assert.equal(countId('flightSettings'),1,'No parallel recorder controls on deep link');
assert.equal(countId('flightHistory'),1,'No duplicate history ID');
assert.equal(clickText('Zapnout záznam'),1,'Exactly one recorder toggle');
assert.equal(lookup('settingsPage-maintenance').hidden,false,'Maintenance category is visible');
assert.equal(host.children[0].hidden,true,'Category home is hidden while history is open');
assert.equal(lookup('flightHistory').hidden,false,'History is expanded');
assert.equal(lookup('settingsPage-maintenance').contains(lookup('flightSettings')),true);
assert.equal(sandbox.handleAndroidBack(),'handled');
assert.equal(host.children[0].hidden,false,'Back returns to category home');
assert.equal(sandbox.handleAndroidBack(),'handled');
assert.equal(panel.hidden,true,'Second Back closes settings');
assert.equal(storageWrites,0,'Opening history never writes or deletes user history');
assert.equal(saves,0,'Opening history never saves app data');
assert.equal(reads,0,'Opening history never loads app data');
console.log('PASS: settings categories, real recorder wrapper + deep link, single history, maintenance navigation, Back, no storage writes');
