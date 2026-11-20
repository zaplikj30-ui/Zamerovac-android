/* Presentation-only settings navigation (#196). Keep original controls and listeners intact. */
(function(root){
'use strict';
const panel=document.getElementById('settingsPanel');
const host=document.getElementById('settingsContent');
const back=document.getElementById('closeSettings');
const title=panel?.querySelector('.panelHead b');
if(!panel||!host||!back||!title||typeof renderSettings!=='function')return;
const categories=[
 {id:'editor',title:'Editor a kreslení',description:'Lupa, mřížka, přichytávání a texty'},
 {id:'measurement',title:'Měření a jednotky',description:'Přesnost, jednotky a volitelný laser'},
 {id:'sync',title:'Synchronizace a zálohy',description:'Přenos mezi zařízeními a samostatné zálohy'},
 {id:'appearance',title:'Vzhled a ovládání',description:'Barvy, displej, vibrace a klávesnice'},
 {id:'maintenance',title:'Aplikace a údržba',description:'Jazyk, diagnostika a obnova nahrávek'}
];
const categoryByGroup={
 'Editor':'editor','Rozměry':'measurement','Vzhled':'appearance','Cloud':'sync',
 'Systémová složka synchronizace':'sync','Bluetooth':'measurement',
 'Jazyk aplikace':'maintenance','O aplikaci':'maintenance',
 'Vzhled aplikace':'appearance','Laser Bosch – přesnost zápisu':'measurement',
 'Informace a údržba':'maintenance','Synchronizace zařízení':'sync',
 'Zálohování':'sync'
};
const clean=value=>String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('cs').trim();
const element=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=text;return node;};
let selected=null,home=null,pages=new Map(),entries=[],searchField=null,results=null,choices=null;
function sectionName(group){
 if(group==='Cloud'||group==='Systémová složka synchronizace'||group==='Synchronizace zařízení')return 'Synchronizace';
 if(group==='Zálohování')return 'Zálohy a obnova';
 if(group==='Bluetooth'||group==='Laser Bosch – přesnost zápisu')return 'Volitelný kompatibilní laser';
 if(group==='Rozměry')return 'Jednotky a přesnost';
 if(group==='O aplikaci')return 'Verze aplikace';
 if(group==='Informace a údržba')return 'Informace a diagnostika';
 return group;
}
function display(category,focusNode){
 selected=pages.has(category)?category:null;
 home.hidden=selected!==null;
 if(selected===null&&searchField){searchField.value='';choices.hidden=false;results.hidden=true;results.replaceChildren();}
 for(const [id,page] of pages)page.hidden=id!==selected;
 title.textContent=selected===null?'Nastavení':categories.find(x=>x.id===selected).title;
 back.setAttribute('aria-label',selected===null?'Zavřít nastavení':'Zpět na kategorie');
 panel.scrollTop=0;
 if(focusNode){focusNode.scrollIntoView?.({block:'center'});const control=focusNode.matches?.('button,input,select')?focusNode:focusNode.querySelector?.('input,select,button');control?.focus?.();}
}
function flattenOriginalControls(){
 const original=[...host.children],flattened=[];
 for(const node of original){
  // upgrade.js owns one neutral wrapper; moving its children retains event handlers.
  if(node.id!=='flightSettings'&&node.querySelector?.(':scope > .setGroup'))flattened.push(...node.children);
  else flattened.push(node);
 }
 return flattened;
}
function build(){
 const nodes=flattenOriginalControls();
 host.replaceChildren();pages=new Map();entries=[];
 home=element('section','settings-home');
 const searchLabel=element('label','settings-search-label','Vyhledat nastavení');
 searchField=element('input','settings-search');searchField.type='search';searchField.id='settingsSearch';searchField.placeholder='Např. jednotky, záloha, lupa';searchField.autocomplete='off';
 searchLabel.htmlFor=searchField.id;home.append(searchLabel,searchField);
 choices=element('div','settings-categories');results=element('div','settings-search-results');results.id='settingsSearchResults';results.setAttribute('role','status');results.hidden=true;
 for(const category of categories){
  const button=element('button','settings-category');button.type='button';button.dataset.category=category.id;
  button.append(element('strong',null,category.title),element('small',null,category.description));
  button.onclick=()=>display(category.id);
  choices.append(button);
  const page=element('section','settings-page');page.id='settingsPage-'+category.id;
  page.setAttribute('aria-label',category.title);page.hidden=true;
  if(category.id==='sync')page.append(element('p','settings-explanation','Synchronizace přenáší aktuální změny mezi zařízeními. Není to záloha. ZIP a historické zálohy slouží k samostatnému obnovení dat.'));
  pages.set(category.id,page);
 }
 home.append(choices,results);host.append(home,...pages.values());
 const groups=new Map();
 function put(category,group,node){
  const id=category+'|'+group;let section=groups.get(id);
  if(!section){section=element('section','settings-subgroup');section.append(element('h3',null,group));groups.set(id,section);pages.get(category).append(section);}
  section.append(node);
  // Production peer/backup entry buttons are .outline, not .setting.
  // Index the original interactive node, never a cloned replacement.
  if(node.classList?.contains('setting')||node.matches?.('button,input,select')||node.querySelector?.('button,input,select')){
   const label=node.querySelector?.('span')?.textContent?.trim()||node.textContent?.trim()||'Nastavení';
   // Only the actual control and its narrow subsection are searchable.
   // A category-wide keyword would make unrelated controls false positives.
   const synonym=group==='Zálohy a obnova'?' záloha':node.id==='openPendingAudioRecovery'?' nahrávky':'';
   entries.push({node,category,label,group,terms:clean(label+' '+group+synonym)});
  }
 }
 let group='Informace a údržba';
 for(const node of nodes){
  if(node.classList?.contains('setGroup')){group=node.textContent.trim();continue;}
  if(node.getAttribute?.('style')?.includes('height:40px'))continue; // former list spacer
  const setting=node.querySelector?.('[data-setting]')?.dataset.setting||'';
  const id=node.id||setting;
  let category=categoryByGroup[group]||'maintenance',subgroup=sectionName(group);
  if(setting==='presets'){category='editor';subgroup='Přednastavené texty';}
  if(id==='openReadings'){category='measurement';subgroup='Volitelný kompatibilní laser';}
  if(id==='backupAll'||id==='restoreAll'||id==='historySettings'){category='sync';subgroup='Zálohy a obnova';}
  if(id==='flightSettings'){category='maintenance';subgroup='Diagnostika výkonu';}
  put(category,subgroup,node);
 }
 const recovery=element('button','setting','Obnova nahrávek');recovery.type='button';recovery.id='openPendingAudioRecovery';
 recovery.onclick=()=>{if(typeof root.PendingAudio?.show==='function')root.PendingAudio.show();else notify('Obnova nahrávek není dostupná.');};
 put('maintenance','Obnova nahrávek',recovery);
 const recoveryInfo=element('p','settings-explanation','Uchované nahrávky a nejistý deník lze zkontrolovat zde. Originální nahrávky se touto stránkou nemění.');
 put('maintenance','Obnova nahrávek',recoveryInfo);
 function search(){
  const query=clean(searchField.value);choices.hidden=!!query;results.hidden=!query;
  results.replaceChildren();if(!query)return;
  let found=0;
  for(const item of entries){if(!item.terms.includes(query))continue;
   const button=element('button','settings-result');button.type='button';button.append(element('span',null,item.label),element('small',null,categories.find(x=>x.id===item.category).title));
   button.onclick=()=>display(item.category,item.node);results.append(button);found++;
  }
  if(!found)results.append(element('p','settings-explanation','Žádné odpovídající nastavení.'));
 }
 searchField.oninput=search;
 display(selected);
}
const oldRender=renderSettings;
renderSettings=function(){oldRender();build();};
const oldToggle=toggleSettings;
toggleSettings=function(){const opening=panel.hidden;if(opening)selected=null;oldToggle();if(!panel.hidden)display(null);};
back.onclick=()=>{if(selected!==null)display(null);else{panel.hidden=true;selected=null;}};
const oldBack=root.handleAndroidBack;
root.handleAndroidBack=function(){
 const otherPanel=[...document.querySelectorAll('.panel')].some(node=>node!==panel&&!node.hidden);
 // The feedback report is an aria-modal overlay, not a .panel. Its own Back
 // handler must close it (or refuse while saving) before navigating categories.
 const feedbackOpen=!!document.getElementById('feedbackOverlay');
 if(!panel.hidden&&selected!==null&&document.getElementById('modal')?.hidden&&!otherPanel&&!feedbackOpen){display(null);return 'handled';}
 return typeof oldBack==='function'?oldBack():'root';
};
root.ZamerovacSettingsNavigation=Object.freeze({showTarget(id){const target=document.getElementById(id);const item=entries.find(x=>x.node===target||x.node.contains(target));if(!item)return false;display(item.category,item.node);return true;}});
})(window);
