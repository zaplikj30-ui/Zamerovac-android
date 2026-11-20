/* Local, opt-in flight recorder for test builds. Only fixed event names and
 * whitelisted numeric fields are retained; never records customer content. */
(function(root){
'use strict';
const KEY='zamerovac-perf-diagnostics-v1',LIMIT=120,MAX_MS=600000;
const TYPES=new Set(['start','enabled','disabled','editor-open','drag-release','editor-commit','native-save','ui-stall','save-error']);
const FIELDS=new Set(['elapsedMs','bridgeMs','serializeMs','savePathMs','paintMs','undoCount','itemCount','dimensionCount','databasePhotoCount','databaseItemCount','databaseDimensionCount','success','lockWaitMs','readMs','writeMs','validationMs','casRecheckMs','revisionProtectMs','evidenceMs','databaseCommitMs','generationMs','recoveryMs','revisionInventoryMs','revisionCount','cacheMisses','cacheHits','mediaChecks']);
const clock=()=>performance.now();
const validTime=t=>typeof t==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(t)&&!Number.isNaN(Date.parse(t));
let rows=[],enabled=false,persistError=false,flushTimer=null,beat=null,lastBeat=clock();
try{
 const value=JSON.parse(root.localStorage?.getItem(KEY)||'{}');
 if(value&&value.version===1){
  enabled=value.enabled===true;
  if(Array.isArray(value.events))rows=value.events.filter(e=>e&&TYPES.has(e.type)&&validTime(e.time)&&e.values&&typeof e.values==='object')
   .slice(-LIMIT).map(e=>({time:String(e.time).slice(0,24),type:e.type,values:clean(e.values)}));
 }
}catch(_){}
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
  root.localStorage.setItem(KEY,JSON.stringify({version:1,enabled,events:rows}));
  persistError=false;
 }catch(_){persistError=true}
}
function schedule(){
 if(flushTimer===null)flushTimer=setTimeout(flush,1200);
}
function record(type,values={},important=false){
 if(!enabled||!TYPES.has(type))return;
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
 const wasEnabled=enabled;
 if(wasEnabled&&value!==true)record('disabled',{},true);
 enabled=value===true;
 if(enabled){if(!wasEnabled)record('enabled',{},true);watch()}
 else{watch();flush()}
 return enabled;
}
function clear(){rows=[];flush()}
function snapshot(){
 let appVersion='web';
 try{if(typeof root.Native?.getAppVersion==='function')appVersion=String(root.Native.getAppVersion()).slice(0,32)}catch(_){}
 return {version:1,appVersion,generatedAt:new Date().toISOString(),events:rows.map(e=>({time:e.time,type:e.type,values:{...e.values}})),persistenceOk:!persistError};
}
function report(){
 flush();
 return 'Zamerovac diagnostic report - times and counters only; no photos, names or measurement values.\n'+JSON.stringify(snapshot(),null,2);
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
function share(){
 const text=report();
 if(root.Native&&typeof root.Native.shareText==='function'){root.Native.shareText('Zaměřovač – anonymní diagnostika',text);return true}
 if(root.document){showCopy(text);return true}
 return false;
}
function attachSettings(panel){
 if(!panel||panel.querySelector('#flightSettings'))return;
 const section=root.document.createElement('div');section.id='flightSettings';
 const heading=root.document.createElement('div');heading.className='setGroup';heading.textContent='Diagnostika výkonu (testovací)';
 const info=root.document.createElement('p');info.className='muted';
 info.textContent='Zaznamenává pouze časy, počty a typy operací. Nejvýše 120 událostí, bez fotografií, hodnot kót a jmen. Neposílá nic automaticky.';
 const status=root.document.createElement('p');status.className='muted';
 const toggleButton=root.document.createElement('button');toggleButton.type='button';toggleButton.className='setting';
 const shareButton=root.document.createElement('button');shareButton.type='button';shareButton.className='setting';shareButton.textContent='Sdílet diagnostický záznam';
 const clearButton=root.document.createElement('button');clearButton.type='button';clearButton.className='setting';clearButton.textContent='Smazat diagnostický záznam';
 const update=()=>{
  toggleButton.textContent=enabled?'Vypnout záznam':'Zapnout záznam';
  status.textContent='Záznamů: '+rows.length+(persistError?' · nepodařilo se uložit diagnostiku':'')+(enabled?' · zapnuto':' · vypnuto');
 };
 toggleButton.onclick=()=>{toggle(!enabled);update()};
 shareButton.onclick=()=>{share();update()};
 clearButton.onclick=()=>{clear();update()};
 section.append(heading,info,status,toggleButton,shareButton,clearButton);panel.append(section);update();
}
root.addEventListener?.('pagehide',flush);
root.document?.addEventListener?.('visibilitychange',()=>{
 if(root.document.visibilityState==='hidden')flush();
 else lastBeat=clock();
});
const api=Object.freeze({record,toggle,clear,share,report,snapshot,attachSettings,isEnabled:()=>enabled,flush});
root.ZFlight=api;
watch();
if(enabled)record('start',{},true);
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
