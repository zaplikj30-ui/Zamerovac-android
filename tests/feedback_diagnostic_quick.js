/* Real feedback quick-control handler exercised with a synthetic WebView DOM.
 * No Android/physical gesture test is claimed. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const feedback=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
const flight=fs.readFileSync('app/src/main/assets/flight-recorder.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const help=fs.readFileSync('app/src/main/assets/help.js','utf8');
const begin=feedback.indexOf(' function attachQuickDiagnostics(){');
const end=feedback.indexOf(' function screenName(){',begin);
assert(begin>=0&&end>begin,'use real production handler');
const code=feedback.slice(begin,end)+'\nattachQuickDiagnostics();';
function scenario(options={}){
 let enabled=false,closed=0,opened=0,toggles=0,confirmations=0;
 const notes=[],timers=new Map();let timerId=0;
 const head={insertAdjacentElement(side,row){assert.equal(side,'afterend');this.row=row;}};
 const overlay={querySelector(sel){
  if(sel==='.feedback-head')return head;
  if(sel==='#feedbackCanvas')return options.editing?{}:null;
  return null;
 }};
 function elem(tag){
  return {tag,children:[],handlers:{},style:{},append(...v){this.children.push(...v)},
   setAttribute(){},addEventListener(type,fn){this.handlers[type]=fn},
   fire(type,e={}){this.handlers[type]?.({button:0,clientX:10,clientY:10,preventDefault(){},...e})}};
 }
 const root={ZFlight:{isEnabled:()=>enabled,toggle(next){
   toggles++;if(next&&options.limit)return false;
   enabled=next;return enabled;
 }},confirm:()=>{confirmations++;return options.confirm!==false;},
 openZamerovacDiagnosticHistory:()=>{opened++;return true}};
 const context={
  overlay,document:{createElement:elem},window:root,busy:!!options.busy,
  notify:m=>notes.push(m),closeOverlay:()=>{closed++;},setTimeout:fn=>{const id=++timerId;timers.set(id,fn);return id;},
  clearTimeout:id=>timers.delete(id),Math
 };
 vm.runInNewContext(code,context);
 const button=head.row.children[0];
 return {button,notes,timers,root,
  advance(){const jobs=[...timers.values()];timers.clear();jobs.forEach(fn=>fn())},
  counts:()=>({enabled,closed,opened,toggles,confirmations}),
  enabled:()=>enabled};
}
let s=scenario();
assert.equal(s.button.textContent,'Diagnostika: Vypnuto');
s.button.fire('pointerdown');s.button.fire('pointerup');s.button.fire('click');
assert.deepEqual(s.counts(),{enabled:true,closed:0,opened:0,toggles:1,confirmations:0});
s.button.fire('click');assert.equal(s.enabled(),false,'second short click must turn off');
s=scenario();
s.button.fire('pointerdown');s.advance();
assert.equal(s.counts().opened,1,'hold opens history once');
assert.equal(s.counts().closed,1,'history leaves report overlay');
s.button.fire('click');assert.equal(s.counts().toggles,0,'synthetic click after hold must NOT toggle');
s=scenario();
s.button.fire('pointerdown');s.button.fire('pointermove',{clientX:45,clientY:10});
s.advance();assert.equal(s.counts().opened,0,'moved pointer cancels hold');
s.button.fire('click');assert.equal(s.counts().toggles,0,'dragged diagnostic control must not accidentally toggle');
s=scenario();
s.button.fire('pointerdown');s.button.fire('pointercancel');s.advance();
assert.equal(s.counts().opened,0,'cancelled pointer does not open history');
s=scenario();
s.button.fire('contextmenu');assert.equal(s.counts().opened,1,'context menu opens history');
s=scenario({busy:true});
s.button.fire('pointerdown');s.advance();
assert.equal(s.counts().opened,0,'saving feedback must remain intact');
s=scenario({editing:true,confirm:false});
s.button.fire('pointerdown');s.advance();
assert.equal(s.counts().closed,0,'unsaved edit cannot close without permission');
assert.equal(s.counts().confirmations,1);
s=scenario({editing:true,confirm:true});
s.button.fire('pointerdown');s.advance();
assert.equal(s.counts().closed,1);
s=scenario({limit:true});s.button.fire('click');
assert.equal(s.enabled(),false,'session capacity must remain bounded');
assert(s.notes.some(x=>x.includes('Limit diagnostiky')));
assert.match(feedback,/longTimer=setTimeout\(\(\)=>\{if\(drag&&!drag.moved\)/,'existing flag long press unchanged');
assert.match(feedback,/else if\(!longHandled\)\{startNewReport\(\)\}/,'existing flag short press unchanged');
assert.match(feedback,/if\(drag.moved\)/,'existing flag drag unchanged');
assert.match(app,/openZamerovacDiagnosticHistory/);
assert.match(flight,/showFlightHistory/);
assert.match(help,/dlouhé podržení této položky otevře historii/);
console.log('PASS: quick toggle and hold history; no double action, drag cancel, feedback save/edit protected, original flag gestures');
