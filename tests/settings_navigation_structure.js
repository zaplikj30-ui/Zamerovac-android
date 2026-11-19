/* #196 – DOM/logic regression with fake UI; real Android still requires physical retest. */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
class Node{
 constructor(tag){this.tagName=tag.toUpperCase();this._children=[];this.parent=null;this.id='';this.className='';this._text='';this.dataset={};this.hidden=false;this.attributes={};this.value='';this.focused=false;this.scrollTop=0;this.style={};}
 get children(){return this._children;}
 get classList(){return {contains:s=>this.className.split(/\s+/).includes(s)}}
 get textContent(){return this._text+this.children.map(x=>x.textContent).join('')}
 set textContent(v){this._text=String(v);this.replaceChildren();}
 append(...nodes){for(const n of nodes){if(n.parent)n.parent._children=n.parent.children.filter(x=>x!==n);this._children.push(n);n.parent=this;}}
 replaceChildren(...nodes){for(const child of this._children)child.parent=null;this._children=[];this.append(...nodes)}
 contains(node){return this===node||this.children.some(x=>x.contains(node))}
 querySelector(query){if(query===':scope > .setGroup')return this.children.find(x=>x.classList.contains('setGroup'))||null;const match=n=>query==='[data-setting]'?typeof n.dataset.setting==='string':query==='.panelHead b'?n.tagName==='B':query==='span'?n.tagName==='SPAN':query==='input,select,button'?['INPUT','SELECT','BUTTON'].includes(n.tagName):false;let walk=n=>{for(const child of n.children){if(match(child))return child;let nested=walk(child);if(nested)return nested}return null};return walk(this)}
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
};
const lookup=id=>{let found;const walk=n=>{if(n.id===id)found=n;for(const c of n.children)walk(c)};walk(doc);return found||null};
const sandbox={window:{},document:{getElementById:lookup,createElement:tag=>new Node(tag),querySelectorAll:s=>doc.querySelectorAll(s)},renderSettings:()=>{renderCalls++;seed()},toggleSettings:()=>{panel.hidden=!panel.hidden;if(!panel.hidden)sandbox.renderSettings()},notify:()=>{},save:()=>{saves++},Native:{loadData:()=>{reads++}},console,
 handleAndroidBack:()=>{if(!modal.hidden){modal.hidden=true;return 'handled';}if(!panel.hidden){panel.hidden=true;return 'handled';}return 'root';}};
sandbox.window=sandbox;
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
console.log('PASS: 5 categories, 18 production-faithful controls including outline buttons, exact positive/negative search, deep-links, back/modal, recovery, zero search IO, original onclick');
