/* UI smoke test: ⋮ opens/closes two real rows under the editor toolbar. */
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const js=fs.readFileSync('app/src/main/assets/editor-extra-toolbar.js','utf8');
const toggles={};
function classes(){
 const values=new Set();
 return {toggle:(k,v)=>{if(v)values.add(k);else values.delete(k)},contains:k=>values.has(k),remove:k=>values.delete(k)};
}
function button(key){
 return {dataset:{extra:key},classList:classes(),disabled:false,attributes:{},
  setAttribute(k,v){this.attributes[k]=v}};
}
const panel={
 hidden:true,buttons:[],classList:classes(),attributes:{},
 set innerHTML(v){this.html=v;this.buttons=[...v.matchAll(/data-extra="([^"]+)"/g)].map(m=>button(m[1]))},
 get innerHTML(){return this.html},
 querySelectorAll(selector){return selector==='[data-extra]'?this.buttons:[]},
 setAttribute(k,v){this.attributes[k]=v}
};
const toolbar={insertAdjacentElement(place,element){
 assert.equal(place,'afterend');assert.equal(element,panel);this.inserted=element;
}};
const more={classList:classes(),setAttribute(k,v){this[k]=v}};
const topMenu={};
const editor={};
const elements={editorView:editor,editorMore:more,editorTopMenu:topMenu,exportBtn:{click(){elements.exportCalls++}},
 styleTool:{click(){elements.styleCalls++}},exportCalls:0,styleCalls:0};
const ctx={
 document:{querySelector:s=>s==='#editorView .toolbar'?toolbar:null,
  createElement:()=>panel,body:{classList:classes()}},
 $:id=>elements[id],
 window:{isRecordLocked:()=>false,handleAndroidBack:()=>{}},
 screen:'editor',current:{id:'photox',items:[]},selected:null,
 mode:'dimension',prefs:{snapGrid:false},redoStack:[],
 stageCanvas:{addEventListener:()=>{}},resizeEditor:()=>{ctx.resizes++},
 openEditor:()=>{},showEditorOverflow:()=>{},closeMenus:()=>{ctx.menusClosed++},
 paint:()=>{},notify:()=>{},save:()=>{},redoEditor:()=>{},setTool:k=>{ctx.lastTool=k},
 recordActions:()=>{},checkpoint:()=>{},commitEditor:()=>{},uid:()=>String(Math.random()),
 view:{zoom:1},resizes:0,menusClosed:0
};
vm.createContext(ctx);vm.runInContext(js,ctx);
assert.equal(toolbar.inserted,panel);
assert.equal(panel.hidden,true);
assert.equal(panel.buttons.length,14);
more.onclick();
assert.equal(panel.hidden,false);
assert.equal(more['aria-expanded'],'true');
assert.equal(ctx.document.body.classList.contains('editor-extra-open'),true);
assert.ok(ctx.menusClosed>=1);
const tool=panel.buttons.find(b=>b.dataset.extra==='select');
tool.onclick();assert.equal(ctx.lastTool,'select');
const grid=panel.buttons.find(b=>b.dataset.extra==='grid');
grid.onclick();assert.equal(ctx.prefs.snapGrid,true);
more.onclick();
assert.equal(panel.hidden,true);
assert.equal(more['aria-expanded'],'false');
assert.equal(ctx.document.body.classList.contains('editor-extra-open'),false);
more.onclick();
assert.equal(ctx.window.handleAndroidBack(),'handled');
assert.equal(panel.hidden,true);
console.log('OK: expandable two-row ImageMeter-style toolbar and accessible toggle');
