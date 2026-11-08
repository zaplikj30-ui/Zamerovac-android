/* B14: actual editor Undo/Redo plus actual app save/error banner on failed storage.
 * Source functions run in one VM. Only browser/native storage is simulated.
 */
'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const read=p=>fs.readFileSync('app/src/main/assets/'+p,'utf8');
const editor=read('editor.js'),appCode=read('app.js');
function slice(code,start,end){
 const a=code.indexOf(start),b=code.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Production boundary missing: '+start);
 return code.slice(a,b);
}
const original={id:'dimension',type:'dimension',a:{x:0.125,y:10},b:{x:123.456789,y:10},
 measure:'1585,800001',laserMeasuredMm:'1585.800001',unit:'mm',
 segmentData:[{measure:'42,000001',unit:'mm'}],media:['original-photo-id']};
const changed=JSON.parse(JSON.stringify(original));
changed.a.x=10.333333333;changed.measure='1585,800002';
const originalJSON=JSON.stringify([original]),changedJSON=JSON.stringify([changed]);
const current={id:'photo',kind:'photo',items:[changed],media:['original-photo-id']};
const state={records:[current],prefs:{},syncProtocol:2};
let persisted=JSON.stringify(state),failWrite=true,writeAttempts=0,paints=0,touches=0;
const nodes=new Map();
function createElement(tag){
 return {tag,children:[],attributes:{},setAttribute(name,value){this.attributes[name]=value},
  append(...children){this.children.push(...children)},
  remove(){nodes.delete(this.id);this.removed=true}};
}
const document={createElement,body:{append(element){nodes.set(element.id,element)}}};
const sandbox={
 window:{__lastSaveFailed:false},document,console,JSON,localStorage:{
  setItem(key,value){assert.equal(key,'zamerovac-data');writeAttempts++;
   if(failWrite)throw Error('Storage quota exhausted');persisted=value}
 },
 state,current,dataLoadFailed:false,native:false,persistedSnapshot:persisted,
 initial:JSON.parse(persisted),stageImg:{},photoSize:{w:1024,h:768},
 editStack:[originalJSON],redoStack:[],paint(){paints++},
 touch(record){assert.equal(record,current);touches++;record.rev='t'+touches},
 notify(message){sandbox.lastMessage=message},
 $:id=>nodes.get(id)||null
};
vm.createContext(sandbox);
vm.runInContext(read('annotation-history.js'),sandbox);
vm.runInContext(slice(appCode,'function reportSaveResult(ok){','function notify(msg)'),sandbox);
vm.runInContext(slice(editor,'function checkpoint(){',"$('undo').onclick="),sandbox);

const beforeDisk=persisted;
sandbox.undoEditor();
assert.equal(sandbox.current.items[0].measure,'1585,800001','Failed Undo changed original exact measure');
assert.equal(JSON.stringify(sandbox.current.items),originalJSON,'Unsaved Undo must remain editable in memory');
assert.equal(sandbox.redoStack.length,1,'Failed storage must preserve the Redo snapshot');
assert.equal(sandbox.redoStack[0],changedJSON,'Failed storage lost exact new measured value');
assert.equal(sandbox.editStack.length,0);
assert.equal(persisted,beforeDisk,'Failed storage must never claim or alter disk contents');
assert.equal(sandbox.window.__lastSaveFailed,true,'Failed storage must set unsaved flag');
assert.match(sandbox.lastMessage,/Neuloženo/);
const banner=nodes.get('saveErrorBanner');
assert(banner,'Failed storage must leave a persistent retry banner');
assert.equal(banner.attributes.role,'alert');
assert.match(banner.children[0].textContent,/Změny nejsou uložené/);
assert.equal(banner.children[1].textContent,'Zkusit uložit znovu');
const redoBefore=sandbox.redoStack[0];
failWrite=false;
banner.children[1].onclick(); // actual retry callback invokes production save()
assert.equal(sandbox.window.__lastSaveFailed,false,'Successful retry must acknowledge storage');
assert.equal(nodes.has('saveErrorBanner'),false,'Retry banner must disappear only after confirmed save');
assert.equal(JSON.stringify(JSON.parse(persisted).records[0].items),originalJSON);
assert.equal(sandbox.redoStack[0],redoBefore,'Retry must not consume Redo');

failWrite=true;
const committed=persisted;
sandbox.redoEditor();
assert.equal(JSON.stringify(sandbox.current.items),changedJSON,'Failed Redo must remain editable for retry');
assert.equal(persisted,committed,'Failed Redo may not pretend to have saved');
assert.equal(sandbox.window.__lastSaveFailed,true);
assert.equal(sandbox.redoStack.length,0);
assert.equal(sandbox.editStack.length,1);
failWrite=false;
nodes.get('saveErrorBanner').children[1].onclick();
assert.equal(JSON.stringify(JSON.parse(persisted).records[0].items),changedJSON,
 'Redo retry lost exact values');
assert.equal(sandbox.window.__lastSaveFailed,false);
assert.equal(nodes.has('saveErrorBanner'),false);
assert.equal(sandbox.current.items[0].media[0],'original-photo-id');
assert.equal(sandbox.current.items[0].laserMeasuredMm,'1585.800001');

// Valid JSON with an invalid root must not alter UI/model/history or perform I/O.
const historyBefore=JSON.stringify([sandbox.editStack,sandbox.redoStack]),dataBefore=JSON.stringify(sandbox.current.items);
const writesBefore=writeAttempts;
sandbox.editStack.push('{"not":"annotation-array"}');
assert.throws(()=>sandbox.undoEditor(),TypeError);
assert.equal(JSON.stringify(sandbox.current.items),dataBefore);
assert.equal(sandbox.editStack.at(-1),'{"not":"annotation-array"}');
assert.equal(JSON.stringify([sandbox.editStack.slice(0,-1),sandbox.redoStack]),historyBefore);
assert.equal(writeAttempts,writesBefore,'Invalid history must not reach persistent storage');
assert(paints>=2&&touches>=2,'Real commitEditor did not run after valid Undo/Redo');
console.log('PASS B14: real Undo/Redo, failed write banner, retry, exact data/media, malformed snapshot no-write');
