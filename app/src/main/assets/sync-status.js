/* #192: Presentation only. The native peer trust, signed ACK and CAS protocol
 * remain the source of truth; never infer a receipt from a Google account.
 */
(function(root){
'use strict';
const names={
 unset:['☁̸','Nenastaveno','Zařízení nejsou připravena k synchronizaci. Nejprve je bezpečně spáruj.'],
 pending:['☁↑','Čeká','Změny jsou místně uložené, ale jejich přijetí druhým zařízením není potvrzené.'],
 confirmed:['☁✓','Potvrzeno','Aktuální revize má ověřené potvrzení přenosu; dostupnost druhého zařízení se ověřuje zvlášť.'],
 failed:['☁✕','Selhalo','Synchronizace selhala. Zakázky zůstávají místně; příčinu je nutné vyřešit.']
};
let phase='unset',reason=names.unset[2],lastNotice=null,knownPeers=null;
let knownConflictIds=new Set(),conflictDetail='';
const button=document.getElementById('cloudBtn');
if(!button)return;
const oldCloudClick=button.onclick;
function paint(){
 const [mark,label]=names[phase];
 button.textContent=mark;
 button.classList.remove('sync-unset','sync-pending','sync-confirmed','sync-failed');
 button.classList.add('sync-'+phase);
 const title='Synchronizace: '+label;
 button.title=title;
 button.setAttribute('aria-label',title);
 button.dataset.syncState=phase;
}
function update(next,detail){
 if(!Object.hasOwn(names,next))return;
 phase=next;
 reason=String(detail||names[next][2]).slice(0,500);
 paint();
}
// A new durable local revision invalidates only the visual green receipt.
 // Signed receipts and native ledger authority are never modified.
function localSaved(){
 if(phase==='confirmed')
  update('pending','Místní změny jsou uložené; nová revize čeká na ověřené přijetí druhým zařízením.');
}
// Display newly retained copies once per stable record ID, while keeping
// the number and explanation accessible in the sync status dialog.
function conflicts(records){
 if(!Array.isArray(records))return;
 const current=new Set(records.filter(r=>r&&r.conflict===true&&typeof r.id==='string'&&r.id).map(r=>r.id));
 const fresh=[...current].filter(id=>!knownConflictIds.has(id));
 // Always retain the details before a possibly failing toast. Only mark
 // newly discovered IDs as announced AFTER a successful notification.
 // While a critical error is visible, defer the lesser conflict toast.
 knownConflictIds=new Set([...knownConflictIds].filter(id=>current.has(id)));
 conflictDetail=current.size?'Zachované konfliktní kopie: '+current.size+'. Zkontroluj obě verze v zakázkách před odstraněním.':'';
 if(fresh.length&&phase!=='failed'){
  notify('Synchronizace: zachované konfliktní kopie: '+current.size+'. Zkontroluj obě verze.');
  knownConflictIds=current;
 }
}
function alertOnce(key,message,critical=false){
 if(critical||lastNotice!==key){
  lastNotice=key;
  notify(message);
 }
}
const danger=/poškozen|ztrát|přeps|neplatn|konflikt|neověřen|nesoulad|úložiště nelze|zápis.*selhal/i;
function error(message){
 const raw=String(message??'');
 if(!/^Synchronizace:\s*/i.test(raw))return false;
 const missing=/Nejdříve spáruj telefon a tablet/.test(raw);
 update(missing?'unset':'failed',missing?
  'Účet Google může být připojený, ale chybí schválené párování telefonu a tabletu. Cloud nepřijal nepodepsaná data.':
  raw);
 alertOnce(raw, 'Chyba: '+raw,danger.test(raw)&&!missing);
 return true;
}
const ackStates=new Set(['transport-ack','transport-receipt','verified-checkpoint']);
function receipt(){
 if(!root.Native||typeof root.Native.syncLedgerState!=='function')return false;
 try{
  const ledger=JSON.parse(root.Native.syncLedgerState());
  if(!ledger||ledger.error||ledger.localSaved!==true||!Array.isArray(ledger.targets))return false;
  // Only ACKs for the current local database and the currently trusted peer
  // are returned by the native ledger. Direct/old namespace ACKs are not enough.
  const cloud=ledger.targets.filter(row=>row&&row.kind!=='tls');
  return cloud.length>0&&cloud.every(row=>ackStates.has(row.state)&&
   (row.contentState==='not-required'||ackStates.has(row.contentState)));
 }catch(error){return false}
}
function cloud(result){
 if(!result||result.transport!=='cloud-v2')return false;
 const message=String(result.message||'');
 const hasError=/hlásí chybu:|synchronizace selhal|chyba:/i.test(message);
 if(hasError){
  update('failed',message);
  alertOnce('cloud-error:'+message,message,danger.test(message));
 }else if(result.pending===true){
  update('pending',message||names.pending[2]);
  alertOnce('cloud-pending',names.pending[2]);
 }else if(result.pending===false&&typeof screen==='string'&&screen==='editor'){
  // Native ledger verification can hit SQLite. Do not block the user's
  // current drawing gesture; check on explicit status tap or next attempt.
  update('pending','Pokus dokončen. Potvrzení aktuální revize ověříme po dokončení kreslení.');
 }else if(result.pending===false&&receipt()){
  update('confirmed',names.confirmed[2]);
  lastNotice=null;
  // Deliberately no success toast for a normal automatic attempt.
 }else{
  update('pending','Pokus proběhl, ale potvrzení aktuální revize a příloh není doložené.');
  alertOnce('cloud-unverified','Přenos zatím není potvrzen. Podrobnosti najdeš pod ikonou synchronizace.');
 }
 return true;
}
function peerState(raw){
 try{
  const peer=typeof raw==='string'?JSON.parse(raw):raw;
  if(!peer||typeof peer!=='object'||Array.isArray(peer))return;
  knownPeers=peer.peers&&typeof peer.peers==='object'&&!Array.isArray(peer.peers)?Object.keys(peer.peers).length:0;
  if(!knownPeers){if(phase==='confirmed'||phase==='pending')update('unset');}
  else if(phase==='unset')update('pending',names.pending[2]);
 }catch(error){}
}
function peerProblem(message){
 const raw=String(message??'');
 update('failed',raw||names.failed[2]);
 alertOnce('peer:'+raw,'Synchronizace zařízení: '+raw,danger.test(raw));
 return true;
}
function show(){
 // Rebuild the conflict detail from the currently durable Native disk when
 // the user explicitly opens status, including after a broken toast/view.
 // This never writes data or reads the ledger during a drawing gesture.
 if(typeof root.ZamerovacSyncReadCommittedConflicts==='function'){
  try{
   const durable=root.ZamerovacSyncReadCommittedConflicts();
   try{conflicts(durable)}catch(error){} // failed toast is not marked delivered
  }catch(error){
   update('failed','Lokální synchronizovaná data nelze bezpečně ověřit. Zkontroluj úložiště.');
  }
 }
 // Explicit user request: ledger verification is intentionally NOT on the
 // editor's drawing or automatic-toast path.
 if(phase==='confirmed'&&!receipt())update('pending','Předchozí potvrzení již neodpovídá aktuálním datům. Zkontroluj čekající přenos.');
 else if(phase==='pending'&&receipt())update('confirmed',names.confirmed[2]);
 const title='Synchronizace · '+names[phase][1];
 modal(title,'<p id="syncStatusDetails"></p><p id="syncStatusExplanation"></p><div class="row wrap"><button id="syncStatusPair" class="outline">Synchronizace zařízení</button><button id="syncStatusCloud" class="outline">Google Disk / ruční přenos</button></div>',()=>true,'Zavřít');
 document.getElementById('syncStatusDetails').textContent=reason+(conflictDetail?'\n'+conflictDetail:'');
 document.getElementById('syncStatusExplanation').textContent='Google účet, párování a skutečně potvrzený přenos jsou tři různé věci. Synchronizace není historická záloha.';
 document.getElementById('syncStatusPair').onclick=()=>{document.getElementById('modal').hidden=true;root.openZamerovacPeers?.();};
 document.getElementById('syncStatusCloud').onclick=()=>{document.getElementById('modal').hidden=true;oldCloudClick?.();};
}
button.onclick=show;
paint();
root.ZamerovacSyncStatus=Object.freeze({error,cloud,peerState,peerProblem,localSaved,conflicts,show,status:()=>({phase,reason,knownPeers})});
})(window);
