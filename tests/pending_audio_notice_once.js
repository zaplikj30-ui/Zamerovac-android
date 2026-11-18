/* #190: run production retained-audio UI with a synthetic native journal.
 * Repeated accepted saves must not spam the same warning or rescan uncertain
 * media. The real native recovery/byte-integrity paths are NOT emulated here.
 */
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/pending-audio.js','utf8');
function scene(entries=[],nativeJournal){
 const elements=new Map(),warnings=[];let scans=0;
 const document={
  createElement(tag){return {tag,remove(){elements.delete(this.id)}}},
  querySelector(selector){
   return selector==='#browserView'?{prepend(el){elements.set(el.id,el)}}:null;
  }
 };
 const env={
  window:{ZamerovacI18n:{t:key=>key}},
  native:true,
  Native:{pendingAudio(){scans++;return nativeJournal?nativeJournal():JSON.stringify(entries)}},
  document,renderNoteAttachments(){},
  notify:msg=>warnings.push(msg),
  $:id=>elements.get(id)||null,
  modal(){},dateText(){return ''},openAttachment(){},
  noteActive:null,state:{records:[]},persistedSnapshot:'',
  save:()=>true,touch(){}
 };
 vm.createContext(env);vm.runInContext(source,env);
 return {api:env.window.PendingAudio,warnings,elements,get scans(){return scans}};
}
function notices(s){return s.warnings.filter(x=>x==='audio.retained').length;}
const clean=scene();
assert.equal(clean.scans,1,'Initialization inspects recovery state once');
for(let i=0;i<5;i++)clean.api.saved({ok:true,audioPending:false,pendingAudioCount:0});
assert.equal(notices(clean),0);
assert.equal(clean.scans,1,'Counted saves must not rescan media');
for(let i=0;i<5;i++)clean.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(clean),1,'Identical pending audio on successive saves should warn once');
assert(clean.elements.has('pendingAudioBanner'),'Persistent warning must remain visible');
assert.equal(clean.scans,1,'Native already returned the counted recovery status');
clean.api.saved({ok:true,audioPending:true,pendingAudioCount:2});
assert.equal(notices(clean),2,'Changed pending count must warn again');
clean.api.saved({ok:true,audioPending:true,pendingAudioCount:2});
assert.equal(notices(clean),2);
clean.api.saved({ok:true,audioPending:false,pendingAudioCount:0});
assert(!clean.elements.has('pendingAudioBanner'),'Resolved warning must be removed');
clean.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(clean),3,'New warning after resolution must be announced');
const unknown=scene([{issue:'journal-uncertain',state:'needs-review',available:false}]);
for(let i=0;i<4;i++)unknown.api.saved({ok:true,audioPending:true});
assert.equal(notices(unknown),1,'Uncertain journal must not spam every save');
assert(unknown.elements.has('pendingAudioBanner'),'Uncertain journal must stay visible');
assert.equal(unknown.scans,1,'Failed post-save recovery must not start another full scan');
unknown.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(unknown),2,'Transition from uncertain to known pending is a new state');
unknown.api.retained(); // Explicit failed attachment continues to warn.
assert.equal(notices(unknown),3,'Explicit failed attachment must still warn');
assert.equal(unknown.scans,2,'Explicit user action may refresh the journal');
const restarted=scene([{state:'needs-review',available:false}]);
restarted.api.saved({ok:true,audioPending:true});
assert.equal(notices(restarted),1,'Warning recurs once after a fresh session');
// F1: an explicitly empty, valid Native journal must clear the cached alert state.
// A newly retained recording with the same count is a genuinely new warning.
const entries=[{id:'first',state:'needs-review',available:true}];
const cycle=scene(entries);
cycle.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(cycle),1);
entries.splice(0); // Native now confirms that the old recording is resolved.
cycle.api.refresh();
assert(!cycle.elements.has('pendingAudioBanner'),'Explicit empty Native refresh must clear the banner');
entries.push({id:'second',state:'needs-review',available:true});
for(let i=0;i<5;i++)cycle.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(cycle),2,'New pending recording after a confirmed empty refresh must warn again exactly once');
assert(cycle.elements.has('pendingAudioBanner'),'New recording must display the warning banner');
// A readable non-empty journal is not equivalent to confirmed resolution.
const ongoing=scene([{issue:'journal-uncertain',state:'needs-review',available:false}]);
ongoing.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
ongoing.api.refresh();
ongoing.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(ongoing),1,'Uncertain journal refresh must not reset warning deduplication');
assert(ongoing.elements.has('pendingAudioBanner'));
// A failing/unreadable Native journal is represented as needs-review, never empty.
const invalid=scene([],()=>'{this-is-not-JSON');
invalid.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
invalid.api.refresh();
assert.equal(notices(invalid),1);
invalid.api.saved({ok:true,audioPending:true,pendingAudioCount:1});
assert.equal(notices(invalid),1,'Unreadable journal must not be treated as confirmed empty');
assert(invalid.elements.has('pendingAudioBanner'));
console.log('PASS #190: counted/uncertain recovery, status transitions, banner, restart and explicit failure');
