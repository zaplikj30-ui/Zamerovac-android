/* The actual capture handler must consume a whole gesture, never canvas/editor state. */
const assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const handlers={},elements={},openers=['toolsToggle','createBtn','back','settingsBtn','editorTopMenu','editorMore'];
class Element {
 constructor(id){this.id=id;this.hidden=true;this.dataset={}}
 closest(selector){return selector==='#'+this.id?this:null}
 contains(target){return target===this}
}
for(const id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow','editorExtraToolbar','modal',...openers])elements[id]=new Element(id);
let closes=0;
const env={Element,$:id=>elements[id],window:{addEventListener:(type,fn)=>{(handlers[type]??=[]).push(fn)}},closeMenus(){closes++;for(const id of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow','editorExtraToolbar'])elements[id].hidden=true}};
vm.createContext(env);vm.runInContext(fs.readFileSync('app/src/main/assets/menu-dismiss.js','utf8'),env);
function fire(type,target,id=1){const e={target,pointerId:id,cancelable:true,preventDefault(){this.prevented=true},stopImmediatePropagation(){this.stopped=true}};for(const fn of handlers[type]||[])fn(e);return e}
const canvas=new Element('drawCanvas');
for(const menu of ['toolMenu','newMenu','navMenu','overflowMenu','editorOverflow','editorExtraToolbar']){
 elements[menu].hidden=false;let e=fire('pointerdown',canvas);assert(e.stopped&&e.prevented);assert(elements[menu].hidden);
 for(const type of ['touchstart','mousedown','pointermove','pointerup','touchend','mouseup','click'])assert(fire(type,canvas).stopped,type+' cannot fall through');
 assert(!fire('pointerdown',canvas).stopped,'Next independent tap works');
 elements[menu].hidden=false;assert(!fire('pointerdown',elements[menu]).stopped,'Inside control works');
 elements[menu].hidden=true;
}
elements.toolMenu.hidden=false;assert(!fire('pointerdown',elements.toolsToggle).stopped,'Opener handles toggle');
assert(fire('click',canvas).stopped,'Keyboard/accessibility click outside closes too');
elements.modal.hidden=false;elements.modal.dataset={};assert(!fire('pointerdown',canvas).stopped,'Do not dismiss confirmations/forms');assert(!elements.modal.hidden);
elements.modal.dataset.actionMenu='record';assert(fire('pointerdown',canvas).stopped);assert(elements.modal.hidden);
fire('pointercancel',canvas);fire('click',canvas);
console.log('OK: outside menu gestures captured completely; inside/openers/forms preserved');
