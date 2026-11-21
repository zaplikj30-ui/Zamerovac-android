/* #235: Real JS app/editor commit path → immutable JSON fixtures for Java classifier.
 * Node vm uses actual production functions; only browser/Android I/O is stubbed.
 * Synthetic state, not Android or a physical gesture. No production changes.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'..');
const asset=name=>fs.readFileSync(path.join(root,'app/src/main/assets',name),'utf8');
const app=asset('app.js'),editor=asset('editor.js'),history=asset('annotation-history.js');
function section(source,start,end){
 const a=source.indexOf(start),b=source.indexOf(end,a+start.length);
 assert.ok(a>=0&&b>a,'Missing production section '+start);
 return source.slice(a,b);
}
const production=[
 section(app,'function touch(rec){','function checkedSyncClock('),
 section(app,'function checkedSyncClock(','function mergeSyncTombstones('),
 section(app,'function save(){','function notify('),
 section(editor,'function finishHandleGesture(handle){','function undoEditor(){')
].join('\n');
const LOCAL='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const PEER='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
function initial(){
 const clock=()=>({[LOCAL]:2,[PEER]:7});
 const item={id:'dimension-1',type:'dimension',
  a:{x:1.125,y:2.5},b:{x:9.25,y:3.5},
  measure:'1585.800001234567890',laserMeasuredMm:'1585.800001234567890',
  unit:'mm',syncClock:clock(),rev:'old-item',updatedAt:'2026-11-21T10:00:00.000Z'};
 const photo={id:'photo-1',kind:'photo',media:['original-photo'],
  items:[item],syncClock:clock(),rev:'old-photo',updatedAt:'2026-11-21T10:00:00.000Z'};
 const other={id:'photo-2',kind:'photo',media:['other-original'],items:[],
  syncClock:clock(),rev:'other-photo',updatedAt:'2026-11-21T10:00:00.000Z'};
 return {schema:1,records:[photo,other],prefs:{unit:'mm'},syncProtocol:2};
}
function runMove({both=false,conflict=false,imageMetadataChange=false,imageLoadedExisting=false}={}){
 const seed=initial();
 if(conflict)seed.records[0].items[0].hierarchyConflict={parentId:'folder-1'};
 if(imageLoadedExisting){seed.records[0].width=1400;seed.records[0].height=900;}
 const state=structuredClone(seed),before=JSON.stringify(seed);
 const saved=[];
 let serial=0,stampSerial=0;
 const context={
  window:{ZFlight:{isEnabled:()=>false}},
  Native:{saveDataChecked(text,expected){
   assert.equal(expected,saved.at(-1)||before,'native CAS expected exact preceding snapshot');
   saved.push(text);return JSON.stringify({ok:true});
  }},
  native:true,initial:seed,state,current:state.records[0],dataLoadFailed:false,
  persistedSnapshot:before,reportSaveResult:ok=>ok,
  invalidateSyncBadgeAfterSave(){},notify(msg){throw new Error(msg)},
  syncDeviceId:LOCAL,
  uid:()=>('10000000-0000-4000-8000-'+String(++serial).padStart(12,'0')),
  stamp:()=>('2026-11-21T10:00:00.'+String(++stampSerial).padStart(3,'0')+'Z'),
  editStack:[],redoStack:[],photoSize:{w:1400,h:900},
  stageImg:imageMetadataChange||imageLoadedExisting?{}:null,
  paint(){},JSON,console,
 };
 vm.createContext(context);
 vm.runInContext(history,context,{filename:'annotation-history.js'});
 vm.runInContext(production,context,{filename:'app-and-editor-production.js'});
 const oldItems=JSON.stringify(context.current.items);
 context.current.items[0].a.x=17.125;
 if(both)context.current.items[0].b.y=7.5;
 const handle={dragged:true,beforeDragItems:oldItems,item:context.current.items[0]};
 context.handle=handle;
 assert.equal(vm.runInContext('finishHandleGesture(handle)',context),true,
   'real production gesture completion');
 assert.equal(saved.length,1,'exactly one Native.saveDataChecked');
 assert.equal(context.editStack.length,1,'real AnnotationHistory snapshot');
 assert.equal(context.persistedSnapshot,saved[0],'real save ACK updates snapshot');
 const output=JSON.parse(saved[0]);
 assert.equal(output.records[0].items[0].measure,seed.records[0].items[0].measure);
 assert.equal(output.records[0].items[0].laserMeasuredMm,seed.records[0].items[0].laserMeasuredMm);
 assert.deepEqual(output.records[0].media,seed.records[0].media);
 assert.equal(output.records[0].syncClock[PEER],7);
 assert.equal(output.records[0].items[0].syncClock[PEER],7);
 assert.equal(output.records[0].items[0].syncClock[LOCAL],3);
 assert.equal(output.records[0].syncClock[LOCAL],3);
 return {before,after:saved[0]};
}
const fixtureDir=path.join(root,'app/src/test/resources/geometry-classifier');
function checkFixture(name,value){
 const file=path.join(fixtureDir,name);
 if(process.argv.includes('--write-fixtures')){
  fs.mkdirSync(fixtureDir,{recursive:true});
  fs.writeFileSync(file,value+'\n');
 }
 assert.equal(fs.readFileSync(file,'utf8'),value+'\n',
  'Stale Java fixture; production editor path changed: '+name);
}
const one=runMove();
checkFixture('editor-before.json',one.before);
checkFixture('editor-after.json',one.after);
const both=runMove({both:true});
checkFixture('editor-both-endpoints.json',both.after);
const conflict=runMove({conflict:true});
assert.equal(Object.hasOwn(JSON.parse(conflict.after).records[0].items[0],'hierarchyConflict'),false);
checkFixture('editor-conflict-before.json',conflict.before);
checkFixture('editor-conflict-after.json',conflict.after);
const loaded=runMove({imageLoadedExisting:true});
checkFixture('editor-loaded-before.json',loaded.before);
checkFixture('editor-loaded-after.json',loaded.after);
const image=runMove({imageMetadataChange:true});
assert.ok(Object.hasOwn(JSON.parse(image.after).records[0],'width'),
 'photo loaded: native commit changes dimensions too');
checkFixture('editor-image-metadata-after.json',image.after);
console.log('PASS #235: real touch(item) -> commitEditor -> touch(photo) -> save/CAS -> Java fixtures; Undo and negatives');
