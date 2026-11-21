/* Local, opt-in flight recorder for test builds. Only fixed event names and
 * whitelisted numeric fields are retained; never records customer content. */
(function(root){
'use strict';
const KEY='zamerovac-perf-diagnostics-v2',LEGACY='zamerovac-perf-diagnostics-v1',LIMIT=120,SESSION_LIMIT=20,MAX_MS=600000;
const TYPES=new Set(['start','enabled','disabled','editor-open','drag-release','dimension-move','dimension-rotate','dimension-resize','dimension-rotate-resize','dimension-point-adjust','editor-commit','native-save','ui-stall','save-error','input-down','input-up','input-cancel']);
const FIELDS=new Set(['elapsedMs','bridgeMs','serializeMs','savePathMs','paintMs','undoCount','itemCount','dimensionCount','databasePhotoCount','databaseItemCount','databaseDimensionCount','success','lockWaitMs','readMs','writeMs','validationMs','casRecheckMs','revisionProtectMs','evidenceMs','databaseCommitMs','generationMs','recoveryMs','revisionInventoryMs','revisionCount','cacheMisses','cacheHits','mediaChecks','inputKind','inputDelayMs','gestureMs','moveEvents','activePointers','missingDown']);
const clock=()=>performance.now();
const validTime=t=>typeof t==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)&&!Number.isNaN(Date.parse(t));
let sessions=[],activeId=null,rows=[],enabled=false,persistError=false,flushTimer=null,beat=null,lastBeat=clock(),nextId=0;
let confirmedRaw=null,blocked=false,legacyPending=false;
function exactKeys(value,keys){
 return value!==null&&typeof value==='object'&&!Array.isArray(value)&&
  Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
}
function sameData(left,right){
 if(left===right)return true;
 if(left===null||right===null||typeof left!=='object'||typeof right!=='object'||
    Array.isArray(left)!==Array.isArray(right))return false;
 const keys=Object.keys(left);
 return keys.length===Object.keys(right).length&&keys.every(key=>
  Object.hasOwn(right,key)&&sameData(left[key],right[key]));
}
function checkedEvents(list){
 if(!Array.isArray(list)||list.length>LIMIT)throw Error('Invalid events');
 return list.map(event=>{
  if(!exactKeys(event,['time','type','values'])||!validTime(event.time)||
     new Date(event.time).toISOString()!==event.time||!TYPES.has(event.type)||
     event.values===null||typeof event.values!=='object'||Array.isArray(event.values))
   throw Error('Invalid event');
  const values=clean(event.values);
  if(Object.keys(values).length!==Object.keys(event.values).length||
     Object.entries(event.values).some(([key,value])=>!Object.hasOwn(values,key)||values[key]!==value))
   throw Error('Lossy metrics');
  return {time:event.time,type:event.type,values};
 });
}
function current(){return sessions.find(s=>s.id===activeId)||sessions[sessions.length-1]||null}
function refreshRows(){rows=current()?.events||[]}
try{
 confirmedRaw=root.localStorage.getItem(KEY);
 const legacyRaw=root.localStorage.getItem(LEGACY);
 if(confirmedRaw!==null){
  const saved=JSON.parse(confirmedRaw);
  if(!exactKeys(saved,['version','enabled','activeId','sessions'])||saved.version!==2||!Array.isArray(saved.sessions)||saved.sessions.length>SESSION_LIMIT||
     typeof saved.enabled!=='boolean')throw Error('Invalid history');
  const seen=new Set();
  for(const e of saved.sessions){
   if(!exactKeys(e,['id','startedAt','endedAt','events'])||typeof e.id!=='string'||!/^s[1-9][0-9]{0,5}$/.test(e.id)||seen.has(e.id)||(!validTime(e.startedAt)||new Date(e.startedAt).toISOString()!==e.startedAt)||
      (e.endedAt!==null&&(!validTime(e.endedAt)||new Date(e.endedAt).toISOString()!==e.endedAt))||!Array.isArray(e.events)||e.events.length>LIMIT)
    throw Error('Invalid session');
   const events=checkedEvents(e.events);
   if(events.length!==e.events.length)throw Error('Invalid events');
   seen.add(e.id);
   sessions.push({id:e.id,startedAt:e.startedAt,endedAt:e.endedAt,events});
   nextId=Math.max(nextId,Number(e.id.slice(1)));
  }
  if(saved.enabled?!seen.has(saved.activeId):saved.activeId!==null)throw Error('Invalid active session');
  enabled=saved.enabled;activeId=saved.activeId;
  legacyPending=legacyRaw!==null;
 }else if(legacyRaw!==null){
  const legacy=JSON.parse(legacyRaw);
  if(!exactKeys(legacy,['version','enabled','events'])||legacy.version!==1||
     typeof legacy.enabled!=='boolean')throw Error('Invalid legacy history');
  const events=checkedEvents(legacy.events);
  if(events.length||legacy.enabled===true){
   const first=events[0]?.time||new Date().toISOString();
   sessions=[{id:'s1',startedAt:first,endedAt:legacy.enabled===true?null:events[events.length-1]?.time||first,events}];
   nextId=1;enabled=legacy.enabled===true;activeId=enabled?'s1':null;
  }
  if(!flush())throw Error('Migration write unconfirmed');
  legacyPending=true;
  try{
   if(root.localStorage.getItem(LEGACY)!==legacyRaw)throw Error('Legacy changed during migration');
   root.localStorage.removeItem(LEGACY);
   legacyPending=root.localStorage.getItem(LEGACY)!==null;
  }catch(_){/* Keep the confirmed v2 and signal that cleanup failed. */}
 }
 refreshRows();
}catch(_){blocked=true;persistError=true;sessions=[];activeId=null;rows=[];enabled=false;nextId=0}
function newSession(){
 if(sessions.length>=SESSION_LIMIT||nextId>=999999)return false;
 const item={id:'s'+(++nextId),startedAt:new Date().toISOString(),endedAt:null,events:[]};
 sessions.push(item);activeId=item.id;rows=item.events;return true;
}
function sessionList(){return sessions.map(s=>({id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,eventCount:s.events.length}))}
function removeSession(id){
 const i=sessions.findIndex(s=>s.id===id);if(i<0)return false;
 return change(()=>{
  if(activeId===id){enabled=false;activeId=null}
  sessions.splice(i,1);refreshRows();
 });
}

function clean(values){
 const out={};
 if(!values||typeof values!=='object')return out;
 for(const [key,val] of Object.entries(values)){
  if(!FIELDS.has(key)||typeof val!=='number'||!Number.isFinite(val)||val<0||val>MAX_MS)continue;
  out[key]=Math.round(val*10)/10;
 }
 return out;
}
function flush(){
 if(flushTimer!==null){clearTimeout(flushTimer);flushTimer=null}
 if(blocked)return false;
 try{
  const storage=root.localStorage;
  if(storage.getItem(KEY)!==confirmedRaw){
   blocked=true;
   throw Error('History changed');
  }
  const payload=JSON.stringify({version:2,enabled,activeId,sessions});
  if(!confirmedRaw||!sameData(JSON.parse(confirmedRaw),JSON.parse(payload))){
   storage.setItem(KEY,payload);
   try{
    if(storage.getItem(KEY)!==payload)throw Error('Write unconfirmed');
   }catch(error){
    // Undo only our own identifiable write. Never write over unknown bytes.
    try{
     const observed=storage.getItem(KEY);
     if(observed===payload){
      if(confirmedRaw===null)storage.removeItem(KEY);
      else storage.setItem(KEY,confirmedRaw);
     }
     if(storage.getItem(KEY)!==confirmedRaw)blocked=true;
    }catch(_){blocked=true}
    throw error;
   }
   confirmedRaw=payload;
  }
  persistError=false;return true;
 }catch(_){persistError=true;return false}
}
function change(update){
 if(blocked)return false;
 const previous={sessions,activeId,enabled,nextId};
 sessions=sessions.map(s=>({...s,events:s.events.slice()}));
 refreshRows();
 update();
 if(!flush()){
  ({sessions,activeId,enabled,nextId}=previous);
  refreshRows();
  return false;
 }
 watch();
 return true;
}
function schedule(){
 if(flushTimer===null)flushTimer=setTimeout(flush,1200);
}
function record(type,values={},important=false){
 if(blocked||!enabled||activeId===null||!TYPES.has(type))return;
 rows.push({time:new Date().toISOString(),type,values:clean(values)});
 if(rows.length>LIMIT)rows.splice(0,rows.length-LIMIT);
 if(important)flush();else schedule();
}
// Classify finished dimension geometry only when recording is enabled.
// No coordinates, angles, dimension lengths or laser values enter the report.
// An endpoint change can both rotate and stretch a dimension.
function dimensionGestureType(kind,fromA,fromB,toA,toB){
 if(kind!=='move-dimension'&&kind!=='point')return null;
 if(![fromA,fromB,toA,toB].every(p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y)))return null;
 if(kind==='move-dimension')return 'dimension-move';
 const x=fromB.x-fromA.x,y=fromB.y-fromA.y;
 const u=toB.x-toA.x,v=toB.y-toA.y;
 const oldLength=Math.hypot(x,y),newLength=Math.hypot(u,v);
 if(oldLength<1e-6||newLength<1e-6)return 'dimension-point-adjust';
 const turn=Math.abs(Math.atan2(x*v-y*u,x*u+y*v))>0.003;
 const stretch=Math.abs(newLength-oldLength)>0.25;
 return turn&&stretch?'dimension-rotate-resize':
  turn?'dimension-rotate':stretch?'dimension-resize':'dimension-point-adjust';
}
function recordDimensionGesture(kind,fromA,fromB,toA,toB,values={}){
 if(!enabled)return false;
 const type=dimensionGestureType(kind,fromA,fromB,toA,toB);
 if(!type)return false;
 record(type,values,true);
 return true;
}
// Opt-in editor input timing. A WebView callback can arrive long after a
// physical touch, or never arrive. Store only counts and timing, not positions,
// pointer IDs, pressure, annotations, photos or any measurement values.
// Tracking pointermove uses memory only and never writes to localStorage.
function attachEditorInput(canvas){
 if(!canvas||typeof canvas.addEventListener!=='function')return false;
 if(canvas.__zFlightInputAttached)return true;
 const active=new Map();
 const inputKind=e=>e.pointerType==='touch'?1:e.pointerType==='pen'?2:e.pointerType==='mouse'?3:0;
 const eventAge=e=>{
  const now=clock(),stamp=Number(e.timeStamp),age=now-stamp;
  // Modern WebView timestamps share performance.now's origin; older ones
  // sometimes use epoch time. Incompatible clocks are not evidence of delay.
  return Number.isFinite(stamp)&&stamp>0&&age>=0&&age<=MAX_MS?age:null;
 };
 const values=e=>{
  const result={inputKind:inputKind(e),activePointers:active.size};
  const age=eventAge(e);
  if(age!==null)result.inputDelayMs=age;
  return result;
 };
 canvas.addEventListener('pointerdown',e=>{
  if(!enabled||blocked)return;
  // A lost pointerup must never accumulate an unbounded in-memory map.
  if(active.size>=16&&!active.has(e.pointerId))active.clear();
  active.set(e.pointerId,{started:clock(),moves:0});
  record('input-down',values(e));
 },{capture:true,passive:true});
 canvas.addEventListener('pointermove',e=>{
  if(!enabled||blocked)return;
  const gesture=active.get(e.pointerId);
  if(gesture&&gesture.moves<MAX_MS)gesture.moves++;
 },{capture:true,passive:true});
 function end(type,e){
  const gesture=active.get(e.pointerId);
  active.delete(e.pointerId);
  if(!enabled||blocked)return;
  const metrics=values(e);
  if(gesture){
   metrics.gestureMs=Math.min(MAX_MS,Math.max(0,clock()-gesture.started));
   metrics.moveEvents=gesture.moves;
  }else metrics.missingDown=1;
  record(type,metrics);
 }
 canvas.addEventListener('pointerup',e=>end('input-up',e),{capture:true,passive:true});
 canvas.addEventListener('pointercancel',e=>end('input-cancel',e),{capture:true,passive:true});
 root.document?.addEventListener?.('visibilitychange',()=>{if(root.document.visibilityState==='hidden')active.clear()});
 canvas.__zFlightInputAttached=true;
 return true;
}
function watch(){
 if(beat!==null)clearInterval(beat);
 beat=null;
 if(!enabled)return;
 lastBeat=clock();
 beat=setInterval(()=>{
  const now=clock(),delta=now-lastBeat;lastBeat=now;
  if(root.document?.visibilityState==='visible'&&delta>1600)record('ui-stall',{elapsedMs:delta-1000},true);
 },1000);
}
function toggle(value){
 if(blocked)return false;
 if(value===true){
  if(enabled)return true;
  if(sessions.length>=SESSION_LIMIT||nextId>=999999)return false;
  return change(()=>{newSession();enabled=true;record('enabled')});
 }
 if(enabled)change(()=>{
  record('disabled');
  current().endedAt=new Date().toISOString();
  enabled=false;activeId=null;
 });
 return false;
}
function clear(){
 return change(()=>{
  sessions=[];activeId=null;rows=[];nextId=0;
  if(enabled){newSession();record('enabled')}
 });
}
function snapshot(id){
 let appVersion='web';
 try{if(typeof root.Native?.getAppVersion==='function')appVersion=String(root.Native.getAppVersion()).slice(0,32)}catch(_){}
 const s=typeof id==='string'?sessions.find(e=>e.id===id):current();
 return {version:1,appVersion,generatedAt:new Date().toISOString(),sessionStartedAt:s?.startedAt||null,
  sessionEndedAt:s?.endedAt||null,events:(s?.events||[]).map(e=>({time:e.time,type:e.type,values:{...e.values}})),persistenceOk:!persistError&&!legacyPending};
}
function report(id){
 flush();
 return 'Zamerovac diagnostic report - times and counters only; no photos, names or measurement values.\n'+JSON.stringify(snapshot(id),null,2);
}
function showCopy(text){
 const old=root.document.getElementById('flightReport');if(old)old.remove();
 const overlay=root.document.createElement('div');overlay.id='flightReport';
 Object.assign(overlay.style,{position:'fixed',inset:'0',background:'rgba(0,0,0,.85)',zIndex:'999999',padding:'20px',display:'flex',flexDirection:'column',gap:'12px'});
 const title=root.document.createElement('strong');title.textContent='Diagnostika – zkopíruj pouze tento anonymní záznam';
 const area=root.document.createElement('textarea');area.readOnly=true;area.value=text;area.style.flex='1';area.style.width='100%';
 const close=root.document.createElement('button');close.type='button';close.textContent='Zavřít';close.onclick=()=>overlay.remove();
 overlay.append(title,area,close);root.document.body.append(overlay);area.focus();area.select();
}
function share(id){
 if(typeof id==='string'&&!sessions.some(s=>s.id===id))return false;
 if(sessions.length===0)return false;
 const text=report(id);
 if(root.Native&&typeof root.Native.shareText==='function'){root.Native.shareText('Zaměřovač – anonymní diagnostika',text);return true}
 if(root.document){showCopy(text);return true}
 return false;
}
function attachSettings(panel){
 if(!panel||panel.querySelector('#flightSettings'))return;
 const section=root.document.createElement('div');section.id='flightSettings';
 const heading=root.document.createElement('div');heading.className='setGroup';heading.textContent='Diagnostika výkonu (testovací)';
 const info=root.document.createElement('p');info.className='muted';
 info.textContent='Každé zapnutí vytváří samostatné měření. Nejvýše 20 měření po 120 událostech. Starší měření se automaticky nemažou. Bez fotografií, hodnot kót a jmen; nic se neposílá automaticky.';
 const status=root.document.createElement('p');status.className='muted';
 const toggleButton=root.document.createElement('button');toggleButton.type='button';toggleButton.className='setting';
 const shareButton=root.document.createElement('button');shareButton.type='button';shareButton.className='setting';shareButton.textContent='Historie a sdílení diagnostiky';
 const clearButton=root.document.createElement('button');clearButton.type='button';clearButton.className='setting';clearButton.textContent='Smazat všechna měření';
 const history=root.document.createElement('div');history.id='flightHistory';history.hidden=true;
 const label=s=>new Date(s.startedAt).toLocaleString('cs-CZ');
 const pendingDeletes=new WeakSet();
 const confirmDelete=(msg,button)=>{
  if(typeof root.confirm==='function')return root.confirm(msg);
  if(pendingDeletes.has(button)){pendingDeletes.delete(button);return true}
  pendingDeletes.add(button);button.textContent='Potvrdit smazání';return false;
 };
 function update(){
  toggleButton.textContent=enabled?'Vypnout záznam':'Zapnout záznam';
  toggleButton.disabled=clearButton.disabled=blocked;
  status.textContent='Měření: '+sessions.length+' · aktuální události: '+rows.length+
   (blocked?' · historie nepřístupná, původní záznamy zachovány. Zkus aplikaci znovu otevřít.':
    persistError?' · změnu se nepodařilo potvrdit v úložišti':'')+
   (legacyPending?' · starší kopie po migraci zůstala v úložišti':'')+
   (enabled?' · zapnuto':' · vypnuto')+
   (!enabled&&sessions.length>=SESSION_LIMIT?' · limit měření, smaž některé starší':'');
 }
 function render(){
  history.textContent='';
  if(!sessions.length){const empty=root.document.createElement('p');empty.textContent='Zatím žádná měření';history.append(empty);return}
  for(const s of [...sessions].reverse()){
   const row=root.document.createElement('div');
   Object.assign(row.style,{display:'flex',alignItems:'center',gap:'8px',flexWrap:'wrap',margin:'8px 0'});
   const date=root.document.createElement('span');date.textContent=label(s)+' · '+s.events.length+' událostí';date.style.flex='1';
   const send=root.document.createElement('button');send.type='button';send.textContent='Sdílet';send.title='Sdílet pouze toto měření';send.onclick=()=>share(s.id);
   const trash=root.document.createElement('button');trash.type='button';trash.textContent='🗑';trash.title='Smazat pouze toto měření';
   trash.disabled=blocked;
   trash.setAttribute('aria-label','Smazat měření z '+label(s));
   trash.onclick=()=>{
    if(!confirmDelete('Smazat pouze měření z '+label(s)+'?',trash))return;
    removeSession(s.id);render();update();
   };
   row.append(date,send,trash);history.append(row);
  }
 }
 toggleButton.onclick=()=>{pendingDeletes.delete(clearButton);clearButton.textContent='Smazat všechna měření';toggle(!enabled);update();if(!history.hidden)render()};
 shareButton.onclick=()=>{pendingDeletes.delete(clearButton);clearButton.textContent='Smazat všechna měření';history.hidden=!history.hidden;if(!history.hidden)render();update()};
 clearButton.onclick=()=>{
  if(!confirmDelete('Smazat VŠECHNA diagnostická měření? Zakázek a fotografií se to netýká.',clearButton))return;
  clear();if(!history.hidden)render();update();
 };
 section.append(heading,info,status,toggleButton,shareButton,clearButton,history);panel.append(section);update();
 section.showFlightHistory=()=>{
  history.hidden=false;render();update();
  section.scrollIntoView?.({block:'start'});
 };
}
function showHistory(panel){
 if(!panel)return false;
 attachSettings(panel);
 const section=panel.querySelector('#flightSettings');
 if(!section||typeof section.showFlightHistory!=='function')return false;
 section.showFlightHistory();return true;
}
root.addEventListener?.('pagehide',flush);
root.document?.addEventListener?.('visibilitychange',()=>{
 if(root.document.visibilityState==='hidden')flush();
 else lastBeat=clock();
});
const api=Object.freeze({record,recordDimensionGesture,toggle,clear,removeSession,sessionList,share,report,snapshot,attachSettings,showHistory,attachEditorInput,isEnabled:()=>enabled,flush});
root.ZFlight=api;
watch();
if(enabled)record('start');
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
