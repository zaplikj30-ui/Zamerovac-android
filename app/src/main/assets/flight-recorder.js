/* Local, opt-in flight recorder for test builds. Only fixed event names and
 * whitelisted numeric fields are retained; never records customer content. */
(function(root){
'use strict';
const KEY='zamerovac-perf-diagnostics-v2',LEGACY='zamerovac-perf-diagnostics-v1',LIMIT=120,SESSION_LIMIT=20,MAX_MS=600000;
const TYPES=new Set(['start','enabled','disabled','editor-open','drag-release','editor-commit','native-save','ui-stall','save-error']);
const FIELDS=new Set(['elapsedMs','bridgeMs','serializeMs','savePathMs','paintMs','undoCount','itemCount','dimensionCount','databasePhotoCount','databaseItemCount','databaseDimensionCount','success','lockWaitMs','readMs','writeMs','validationMs','casRecheckMs','revisionProtectMs','evidenceMs','databaseCommitMs','generationMs','recoveryMs','revisionInventoryMs','revisionCount','cacheMisses','cacheHits','mediaChecks']);
const clock=()=>performance.now();
const validTime=t=>typeof t==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)&&!Number.isNaN(Date.parse(t));
let sessions=[],activeId=null,rows=[],enabled=false,persistError=false,flushTimer=null,beat=null,lastBeat=clock(),nextId=0;
function safeEvents(list){
 return Array.isArray(list)?list.filter(e=>e&&TYPES.has(e.type)&&validTime(e.time)&&e.values&&typeof e.values==='object')
  .slice(-LIMIT).map(e=>({time:e.time,type:e.type,values:clean(e.values)})):[];
}
function current(){return sessions.find(s=>s.id===activeId)||sessions[sessions.length-1]||null}
function refreshRows(){rows=current()?.events||[]}
try{
 const saved=JSON.parse(root.localStorage?.getItem(KEY)||'{}');
 if(saved?.version===2&&Array.isArray(saved.sessions)){
  const seen=new Set();
  for(const e of saved.sessions.slice(-SESSION_LIMIT)){
   if(!e||typeof e.id!=='string'||!/^s[1-9][0-9]{0,5}$/.test(e.id)||seen.has(e.id)||!validTime(e.startedAt))continue;
   seen.add(e.id);
   sessions.push({id:e.id,startedAt:e.startedAt,endedAt:validTime(e.endedAt)?e.endedAt:null,events:safeEvents(e.events)});
   nextId=Math.max(nextId,Number(e.id.slice(1)));
  }
  enabled=saved.enabled===true;
  if(enabled&&sessions.some(s=>s.id===saved.activeId))activeId=saved.activeId;else enabled=false;
 }else{
  const legacy=JSON.parse(root.localStorage?.getItem(LEGACY)||'{}');
  if(legacy?.version===1){
   const events=safeEvents(legacy.events);
   if(events.length||legacy.enabled===true){
    const first=events[0]?.time||new Date().toISOString();
    sessions=[{id:'s1',startedAt:first,endedAt:legacy.enabled===true?null:events[events.length-1]?.time||first,events}];
    nextId=1;enabled=legacy.enabled===true;activeId=enabled?'s1':null;
   }
  }
 }
 refreshRows();
}catch(_){sessions=[];activeId=null;rows=[];enabled=false;nextId=0}
function newSession(){
 if(sessions.length>=SESSION_LIMIT)return false;
 const item={id:'s'+(++nextId),startedAt:new Date().toISOString(),endedAt:null,events:[]};
 sessions.push(item);activeId=item.id;rows=item.events;return true;
}
function sessionList(){return sessions.map(s=>({id:s.id,startedAt:s.startedAt,endedAt:s.endedAt,eventCount:s.events.length}))}
function removeSession(id){
 const i=sessions.findIndex(s=>s.id===id);if(i<0)return false;
 if(activeId===id){enabled=false;activeId=null;watch()}
 sessions.splice(i,1);refreshRows();flush();return true;
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
 try{
  root.localStorage.setItem(KEY,JSON.stringify({version:2,enabled,activeId,sessions}));
  root.localStorage.removeItem?.(LEGACY);
  persistError=false;
 }catch(_){persistError=true}
}
function schedule(){
 if(flushTimer===null)flushTimer=setTimeout(flush,1200);
}
function record(type,values={},important=false){
 if(!enabled||activeId===null||!TYPES.has(type))return;
 rows.push({time:new Date().toISOString(),type,values:clean(values)});
 if(rows.length>LIMIT)rows.splice(0,rows.length-LIMIT);
 if(important)flush();else schedule();
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
 if(value===true){
  if(!enabled){if(!newSession())return false;enabled=true;record('enabled',{},true)}
 }else if(enabled){
  record('disabled',{},true);
  const s=current();if(s)s.endedAt=new Date().toISOString();
  enabled=false;activeId=null;flush();
 }
 watch();return enabled;
}
function clear(){
 sessions=[];activeId=null;rows=[];nextId=0;
 if(enabled){newSession();record('enabled',{},true)}else flush();
}
function snapshot(id){
 let appVersion='web';
 try{if(typeof root.Native?.getAppVersion==='function')appVersion=String(root.Native.getAppVersion()).slice(0,32)}catch(_){}
 const s=typeof id==='string'?sessions.find(e=>e.id===id):current();
 return {version:1,appVersion,generatedAt:new Date().toISOString(),sessionStartedAt:s?.startedAt||null,
  sessionEndedAt:s?.endedAt||null,events:(s?.events||[]).map(e=>({time:e.time,type:e.type,values:{...e.values}})),persistenceOk:!persistError};
}
function report(id){
 flush();
 return 'Zamerovac diagnostic report - times and counters only; no photos, names or measurement values.\\n'.replace('\\n','\n')+JSON.stringify(snapshot(id),null,2);
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
 const confirmDelete=msg=>typeof root.confirm!=='function'||root.confirm(msg);
 function update(){
  toggleButton.textContent=enabled?'Vypnout záznam':'Zapnout záznam';
  status.textContent='Měření: '+sessions.length+' · aktuální události: '+rows.length+
   (persistError?' · diagnostiku se nepodařilo uložit':'')+
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
   trash.setAttribute('aria-label','Smazat měření z '+label(s));
   trash.onclick=()=>{
    if(!confirmDelete('Smazat pouze měření z '+label(s)+'?'))return;
    removeSession(s.id);render();update();
   };
   row.append(date,send,trash);history.append(row);
  }
 }
 toggleButton.onclick=()=>{toggle(!enabled);update();if(!history.hidden)render()};
 shareButton.onclick=()=>{history.hidden=!history.hidden;if(!history.hidden)render();update()};
 clearButton.onclick=()=>{
  if(!confirmDelete('Smazat VŠECHNA diagnostická měření? Zakázek a fotografií se to netýká.'))return;
  clear();if(!history.hidden)render();update();
 };
 section.append(heading,info,status,toggleButton,shareButton,clearButton,history);panel.append(section);update();
}
root.addEventListener?.('pagehide',flush);
root.document?.addEventListener?.('visibilitychange',()=>{
 if(root.document.visibilityState==='hidden')flush();
 else lastBeat=clock();
});
const api=Object.freeze({record,toggle,clear,removeSession,sessionList,share,report,snapshot,attachSettings,isEnabled:()=>enabled,flush});
root.ZFlight=api;
watch();
if(enabled)record('start',{},true);
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
