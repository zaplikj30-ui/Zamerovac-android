/* #215: integration regression for actual Android Back source handlers.
   A feedback report opened from Settings is a modal, not a settings .panel.
   Synthetic DOM and storage only; no customer data or Android hardware. */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const settings=fs.readFileSync('app/src/main/assets/settings-navigation.js','utf8');
const feedback=fs.readFileSync('app/src/main/assets/feedback-reports.js','utf8');
function take(s,start,end){const a=s.indexOf(start),b=s.indexOf(end,a+start.length);
 assert(a>=0&&b>a,'Production source boundary absent: '+start);return s.slice(a,b);}
const close=take(feedback,' function closeOverlay(){',' function makeOverlay(');
const fbBack=take(feedback,' const previousBack=window.handleAndroidBack;',' window.__openFeedbackList=');
const settingsBack=take(settings,'const oldBack=root.handleAndroidBack;','root.ZamerovacSettingsNavigation=');
function setup({report=false,busy=false,modal=false,other=false}={}){
 const panel={hidden:false},dialog={hidden:!modal},otherPanel={hidden:!other};
 const calls={report:0,category:0,modal:0,other:0,settings:0,notices:[]};
 const env={panel,selected:'maintenance',busy,active:busy?{}:null,flag:{hidden:true},
  notify:x=>calls.notices.push(x),display:x=>{env.selected=x;calls.category++;}};
 const root={handleAndroidBack:()=>{
  if(!dialog.hidden){dialog.hidden=true;calls.modal++;return 'handled'}
  if(!otherPanel.hidden){otherPanel.hidden=true;calls.other++;return 'handled'}
  if(!panel.hidden){panel.hidden=true;calls.settings++;return 'handled'}
  return 'root';}};
 env.root=env.window=root;
 env.document={querySelectorAll:s=>s==='.panel'?[panel,otherPanel]:[],
  getElementById:id=>id==='modal'?dialog:id==='feedbackOverlay'?env.overlay:null};
 vm.runInNewContext('var overlay=null;\n'+close+'\n'+fbBack+'\n'+settingsBack,env);
 if(report)env.overlay={remove(){calls.report++;}};
 return {env,panel,calls,back:()=>root.handleAndroidBack()};
}
{
 const a=setup({report:true});a.back();
 assert.equal(a.calls.report,1,'Report must close before settings category');
 assert.equal(a.env.selected,'maintenance');
 a.back();assert.equal(a.env.selected,null,'Second Back returns to categories');
 a.back();assert.equal(a.panel.hidden,true,'Third Back closes settings');
}
{
 const a=setup();a.back();assert.equal(a.env.selected,null);
 a.back();assert.equal(a.panel.hidden,true);
}
{
 const a=setup({report:true,busy:true});a.back();
 assert.equal(a.calls.report,0,'Inflight save must not close report');
 assert.equal(a.env.selected,'maintenance','Inflight save must not navigate settings');
 assert(a.calls.notices.some(x=>x.includes('Probíhá ukládání')));
 a.env.busy=false;a.env.active=null;a.back();
 assert.equal(a.calls.report,1);
}
{
 const a=setup({modal:true});a.back();
 assert.equal(a.calls.modal,1,'Other modal has priority');
 assert.equal(a.env.selected,'maintenance');a.back();assert.equal(a.env.selected,null);
}
{
 const a=setup({other:true});a.back();
 assert.equal(a.calls.other,1,'Other panel has priority');
 assert.equal(a.env.selected,'maintenance');a.back();assert.equal(a.env.selected,null);
}
console.log('PASS: #215 feedback/settings Back priority, inflight data guard, modal/other panel 5/5');
