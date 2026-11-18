/* #194 M2: The quick button repeats the actual picker route, not a file
 * MIME subtype. Execute the production quick-action presenter and dispatcher.
 * Android's real file picker is NOT emulated here.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const from=app.indexOf('// #194: session-only last confirmed add action.');
const to=app.indexOf('function showNewMenu(){',from);
assert(from>=0&&to>from,'Quick-action production boundary changed');
const quick=app.slice(from,to);
const picked=[],button={title:'',textContent:'',attributes:{},
 setAttribute(name,value){this.attributes[name]=value}};
const context={
 window:{},$:id=>{assert.equal(id,'galleryBtn');return button},
 canWriteToFolder:()=>true,currentFolder:null,
 pickMedia:type=>{picked.push(type);return type},
 createTextNote:()=>true,notify(){},promptText(){},addRecord(){},newRecord(){}
};
vm.createContext(context);
vm.runInContext(quick+'\nwindow.__quick={rememberSuccessfulAdd,repeatQuickAdd};',context);
const ui=context.window.__quick;
const expectations=[
 ['photo','camera','📷','Pořídit fotografii','camera'],
 ['photo','media','🖼️','Vybrat média a soubory','media'],
 ['video','media','🖼️','Vybrat média a soubory','media'],
 ['audio','media','🖼️','Vybrat média a soubory','media'],
 ['file','media','🖼️','Vybrat média a soubory','media'],
 ['photo','file','📎','Vybrat soubory','file'],
 ['video','file','📎','Vybrat soubory','file'],
 ['audio','file','📎','Vybrat soubory','file'],
 ['file','file','📎','Vybrat soubory','file']
];
for(const [kind,source,icon,label,route] of expectations){
 ui.rememberSuccessfulAdd(kind,source);
 assert.equal(button.textContent,icon,'M2 inaccurate icon for '+kind+'/'+source);
 assert.equal(button.title,label,'M2 promises MIME filter it does not enforce: '+kind+'/'+source);
 assert.equal(button.attributes['aria-label'],'Opakovat: '+label,'M2 inaccurate accessibility label');
 assert.equal(ui.repeatQuickAdd(),route,'M2 wrong picker route');
 assert.equal(picked.at(-1),route);
}
ui.rememberSuccessfulAdd('folder');
assert.equal(button.textContent,'📁');
ui.rememberSuccessfulAdd('canvas');
assert.equal(button.title,'Nový náčrt');
ui.rememberSuccessfulAdd('note');
assert.equal(button.title,'Nová textová poznámka');
console.log('PASS #194 M2: camera/media/file picker routes and truthful label/icon/ARIA across all MIME kinds');
