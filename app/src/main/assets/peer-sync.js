/* Local device sync UI. No customer data are included in discovery or pairing events. */
(function(root){
'use strict';
let state={enabled:false,active:false,pairing:false,peers:{},candidates:[]},panel,body,notice,approvalPanel,request,timer;
const phases={waiting:'Čeká na spojení nebo další potvrzení',preparing:'Kontroluji úplnost a připravuji přenos',connected:'Zabezpečené spojení navázáno',sending:'Odesílám přílohy',receiving:'Přijímám přílohy',done:'Přenos potvrzen',error:'Přenos se nepodařil'};
function node(tag,text,cls){const el=document.createElement(tag);if(text!=null)el.textContent=text;if(cls)el.className=cls;return el;}
function button(text,id,action){const el=node('button',text,'outline');el.type='button';if(id)el.id=id;el.onclick=action;return el;}
function command(name,arg=''){if(!root.Native||typeof root.Native.directSyncControl!=='function'){if(notice)notice.textContent='Přímé propojení vyžaduje Android aplikaci s touto aktualizací.';else notify('Přímé propojení vyžaduje Android aplikaci s touto aktualizací.');return;}root.Native.directSyncControl(name,String(arg));}
function safeState(raw){const value=typeof raw==='string'?JSON.parse(raw):raw;if(!value||typeof value!=='object')throw Error('Neplatný stav zařízení');return value;}
function render(){if(!panel||panel.hidden)return;const active=document.activeElement?.id;body.replaceChildren();notice.textContent=String(state.problem||'');
 body.append(node('p',state.active?'Místní přenos je zapnutý. Přenosy se řídí nastavenou frekvencí; důvěryhodné druhé zařízení může navázat příchozí spojení.':'Místní přenos není aktivní. Zakázky zůstávají uložené v tomto zařízení.'));
 body.append(node('p','Přenáší se všechny zakázky, fotografie, detailní fotografie, kóty, poznámky, videa a přílohy. Spáruj pouze vlastní nebo důvěryhodné zařízení.','muted'));
 const controls=node('div',null,'row wrap');controls.append(button(state.enabled?'Vypnout místní přenos':'Zapnout místní přenos','peerEnable',()=>command(state.enabled?'disable':'enable')),button(state.pairing?'Ukončit párování':'Spárovat další zařízení','peerPair',()=>command(state.pairing?'stopPairing':'pair')),button('Zkusit přenos znovu','peerRetry',()=>command('retry')));body.append(controls);
 if(state.pairing){body.append(node('p','Párování je otevřené ještě '+Math.max(0,Number(state.pairingSeconds)||0)+' s. Zapni ho na obou zařízeních a na jednom vyber druhé zařízení.'));
  body.append(button('Hledat přes Wi-Fi Direct bez routeru','peerNearby',()=>command('nearby')));
  if(state.wifiDirectSupported===false)body.append(node('p','Wi-Fi Direct zde není dostupné. Připoj obě zařízení ke stejné místní Wi-Fi.','muted'));
  else if(!state.wifiDirectPermission)body.append(node('p','Wi-Fi Direct si vyžádá oprávnění Zařízení v okolí. Starší Android vyžaduje polohu a zapnuté určování polohy.','muted'));
  const candidates=node('div');candidates.id='peerCandidates';candidates.append(node('h3','Dostupná zařízení'));
  const list=Array.isArray(state.candidates)?state.candidates.slice(0,128):[];
  if(!list.length)candidates.append(node('p','Zatím žádná zařízení. Ve stejné Wi-Fi se vyhledají automaticky; bez routeru spusť hledání Wi-Fi Direct na obou.'));
  for(const item of list){if(typeof item.key!=='string')continue;const row=node('div',null,'peer-row');row.append(node('span',String(item.name||'Android zařízení')+' · '+(item.route==='nearby'?'Wi-Fi Direct':'místní Wi-Fi')),button('Propojit',null,()=>command('connect',item.key)));candidates.append(row);}body.append(candidates);
 }
 root.ZamerovacSyncCadence?.mount(body);
 root.ZamerovacDriveAccounts?.mount(body,'sync');
 body.append(node('h3','Spárovaná zařízení'));const peers=state.peers&&typeof state.peers==='object'?Object.entries(state.peers):[];
 if(!peers.length)body.append(node('p','Zatím není spárované žádné zařízení.'));
 for(const [id,peer] of peers){const row=node('article',null,'peer-device'),progress=peer.state||{},pending=Math.max(0,Number(peer.pending)||0);row.append(node('h4',String(peer.name||'Android zařízení')),node('p',phases[progress.phase]||'Čeká na spojení'));
  if(Number(progress.total)>0)row.append(node('p',Math.max(0,Number(progress.completed)||0)+' / '+Number(progress.total)+' příloh'));
  row.append(node('p','Čekajících potvrzení: '+pending));if(peer.lastSuccess)row.append(node('p','Poslední potvrzený odeslaný stav: '+String(peer.lastSuccess),'muted'));if(progress.error)row.append(node('p',String(progress.error),'peer-error'));
  row.append(button('Odebrat párování',null,()=>{if(root.confirm('Odebrat důvěru zařízení '+String(peer.name||'Android')+'? Jeho uložené zakázky se tím nesmažou.'))command('forget',id);}));body.append(row);
 }
 const conflicts=typeof root.ZamerovacPeerConflictCount==='function'?root.ZamerovacPeerConflictCount():0;if(conflicts)body.append(node('p','Zachovaných konfliktních kopií: '+conflicts+'. Najdeš je mezi zakázkami s označením konflikt synchronizace. Porovnej obě verze před odstraněním.'));
 body.append(node('p','Zapnutý místní přenos pokračuje službou Androidu s oznámením i po zavření obrazovky. Vypneš ho zde nebo v oznámení. Android může službu při uspání či úspoře baterie omezit nebo ukončit; po návratu pokračuje z trvalé fronty. Párování vyžaduje otevřenou aplikaci. Historické zálohy se tím nemažou.','muted'));
 if(active&&panel.querySelector('#'+active))panel.querySelector('#'+active).focus();
}
function close(){panel.hidden=true;clearInterval(timer);timer=null;}
function open(){if(!panel){panel=node('section',null,'panel peer-panel');panel.id='peerSyncPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Synchronizace zařízení');const head=node('header',null,'panelHead');head.append(button('←','peerClose',close),node('b','Synchronizace zařízení'));notice=node('p',null,'peer-error');notice.id='peerProblem';notice.setAttribute('role','status');body=node('div',null,'peer-content');panel.append(head,notice,body);document.body.append(panel);}
 panel.hidden=false;render();if(root.Native&&typeof root.Native.directSyncState==='function')try{state=safeState(root.Native.directSyncState());render();}catch(e){notice.textContent='Stav zařízení se nepodařilo načíst. Zkus přenos znovu.';}
 else notice.textContent='Přímé propojení vyžaduje Android aplikaci s touto aktualizací.';
 clearInterval(timer);timer=setInterval(()=>command('refresh'),2000);panel.querySelector('#peerClose').focus();
}
function hideApproval(){if(approvalPanel)approvalPanel.remove();approvalPanel=null;request=null;}
function showApproval(raw){let next;try{next=safeState(raw);}catch(e){return;}if(typeof next.sessionId!=='string'||typeof next.code!=='string'||!/^[a-f0-9]{64}$/.test(next.code))return;if(request?.sessionId===next.sessionId)return;
 hideApproval();request=next;approvalPanel=node('div',null,'peer-approval');approvalPanel.id='peerApproval';approvalPanel.setAttribute('role','dialog');approvalPanel.setAttribute('aria-modal','true');approvalPanel.setAttribute('aria-label','Potvrdit párování zařízení');const box=node('div',null,'dialog');box.append(node('h2','Porovnej kód na obou zařízeních'),node('p',String(next.name||'Android zařízení')));const code=node('pre',next.code.match(/.{8}/g).join(' '),'peer-code');code.id='peerPairCode';box.append(code,node('p','Potvrď pouze pokud na druhém zařízení vidíš přesně stejný celý kód. Tím povolíš obousměrný přenos všech zakázek a příloh.'));
 const controls=node('div',null,'row wrap');controls.append(button('Odmítnout','peerReject',()=>{command('reject',next.sessionId);hideApproval();}),button('Kódy na obou zařízeních souhlasí','peerApprove',()=>{command('approve',next.sessionId);approvalPanel.querySelector('#peerApprove').disabled=true;approvalPanel.querySelector('#peerReject').disabled=true;box.append(node('p','Čekám na potvrzení a uložení párování na obou zařízeních.'));}));box.append(controls);approvalPanel.addEventListener('keydown',event=>{if(event.key!=='Tab')return;const buttons=[...approvalPanel.querySelectorAll('button:not(:disabled)')];if(!buttons.length){event.preventDefault();return;}if(event.shiftKey&&document.activeElement===buttons[0]){event.preventDefault();buttons.at(-1).focus();}else if(!event.shiftKey&&document.activeElement===buttons.at(-1)){event.preventDefault();buttons[0].focus();}});approvalPanel.append(box);document.body.append(approvalPanel);approvalPanel.querySelector('#peerReject').focus();
}
root.onNativePeerState=raw=>{try{state=safeState(raw);render();if(state.approval)showApproval(state.approval);else if(request)hideApproval();}catch(e){if(notice)notice.textContent='Neplatný stav přenosu. Původní data zůstávají uložená.';}};
root.onNativePeerPairing=showApproval;
root.onNativePeerProblem=raw=>{try{const value=safeState(raw);state.problem=String(value.problem||'Přenos se nepodařil.');render();if(!panel||panel.hidden)notify(state.problem);}catch(e){}};
root.openZamerovacPeers=open;
const previousSettings=renderSettings;renderSettings=function(){previousSettings();const host=document.getElementById('settingsContent');host.append(node('div','Synchronizace zařízení','setGroup'),button('Synchronizace zařízení – místní a Google Disk','peerSettings',open));};
const previousMenu=showAppMenu;showAppMenu=function(id,items){if(id==='navMenu'||id==='overflowMenu')items=[...items,['⇄  Synchronizace zařízení',open]];return previousMenu(id,items);};
const previousBack=root.handleAndroidBack;root.handleAndroidBack=function(){if(request){command('reject',request.sessionId);hideApproval();return 'handled';}if(panel&&!panel.hidden){close();return 'handled';}return typeof previousBack==='function'?previousBack():'root';};
})(window);
