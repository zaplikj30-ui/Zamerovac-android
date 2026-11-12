/* Explicit per-feature Drive account UI. No project data or tokens cross this interface. */
(function(root){
'use strict';
let view={projectConfigured:false,busy:false,sync:{backend:'saf'},backup:{backend:'saf'}},message='';
const mounted=new Map();
function node(tag,text,cls){const value=document.createElement(tag);if(text!=null)value.textContent=text;if(cls)value.className=cls;return value;}
function nativeReady(){return root.Native&&typeof root.Native.driveAccountControl==='function'&&typeof root.Native.driveAccountState==='function';}
function receive(raw){const next=typeof raw==='string'?JSON.parse(raw):raw;if(!next||typeof next!=='object'||Array.isArray(next))throw Error();for(const kind of ['sync','backup']){const row=next[kind];if(!row||!['saf','drive','none'].includes(row.backend)||row.backend==='drive'&&typeof row.account!=='string')throw Error();}view=next;message=String(next.message||'');}
function refresh(){if(!nativeReady())return;try{receive(root.Native.driveAccountState());}catch(error){message='Stav účtu nelze ověřit. Zkus připojení znovu.';view={...view,error:true};}}
function command(kind,action){if(!nativeReady())return;view={...view,busy:true};renderAll();try{root.Native.driveAccountControl(kind,action);}catch(error){view={...view,busy:false,error:true};message='Připojení účtu nebylo potvrzeno.';renderAll();}}
function render(host,kind,disabled){host.replaceChildren();const row=view[kind]||{},ready=nativeReady();host.append(node('h3',kind==='sync'?'Google Disk – vzdálená synchronizace':'Google Disk – historie záloh'));
 host.append(node('p',row.backend==='drive'?'Vybraný účet: '+String(row.account).slice(0,320):row.backend==='none'?'Úložiště této funkce je odpojené.':'Pro tuto funkci lze použít systémovou složku nebo samostatně připojit Google Disk.'));
 if(!ready)host.append(node('p','Připojení Disku vyžaduje Android aplikaci s touto aktualizací.','muted'));
 else if(!view.projectConfigured)host.append(node('p','Připojení Google Disku čeká na dokončení nastavení této verze aplikace.','muted'));
 if(kind==='sync'&&typeof root.Native?.syncLedgerState==='function'){
  try{const status=JSON.parse(root.Native.syncLedgerState());host.append(node('p',status.localSaved?'Zakázky jsou místně uložené.':'Místní uložení nyní nelze ověřit.','muted'));
   if(status.error)host.append(node('p','Evidenci přenosů nelze ověřit. Přenos zůstává nedokončený.','peer-error'));
   for(const target of status.targets||[]){const name=target.kind==='tls'?'Spárované zařízení':target.kind==='drive'?'Google Disk':'Vybraná složka';host.append(node('p',name+': '+(target.state==='transport-ack'?'přijetí této revize bylo potvrzeno':'čeká na přenos nebo potvrzení')+(target.contentState==='error'?' · historické nebo hlasové podklady vyžadují kontrolu.':target.contentState==='waiting'?' · úplnost historických podkladů čeká na ověření.':'.'),'muted'));}
   host.append(node('p','Potvrzení přenosu není historická záloha. Dostupnost druhého zařízení se znovu ověřuje při připojení.','muted'));
  }catch(error){host.append(node('p','Stav přenosů se nepodařilo načíst.','peer-error'));}
 }
 if(message)host.append(node('p',message,'peer-error'));
 const controls=node('div',null,'row wrap'),select=node('button',row.backend==='drive'?'Změnit Google účet':'Připojit Google účet','outline');select.type='button';select.id=kind==='sync'?'driveSyncSelect':'driveBackupSelect';select.disabled=disabled||!!view.busy||!!view.error||!ready||!view.projectConfigured;select.onclick=()=>command(kind,'select');controls.append(select);
 if(row.backend==='drive'){const disconnect=node('button','Odpojit Disk pro tuto funkci','outline');disconnect.type='button';disconnect.id=kind==='sync'?'driveSyncDisconnect':'driveBackupDisconnect';disconnect.disabled=disabled||!!view.busy||!ready;disconnect.onclick=()=>{if(root.confirm('Odpojit Disk pouze pro tuto funkci? Zakázky v zařízení a historické zálohy zůstanou zachované.'))command(kind,'disconnect');};controls.append(disconnect);}host.append(controls);
 host.append(node('p','Telefon a tablet použijí stejný Google účet a tuto aplikaci. Data jsou v jejím soukromém prostoru Disku; běžné soubory účtu se nevybírají ani nemažou. Odpojení zde nemaže historii a nemění účet druhé funkce.','muted'));
}
function renderAll(){for(const [host,value] of mounted){if(!host.isConnected){mounted.delete(host);continue;}render(host,value.kind,value.disabled);}}
root.ZamerovacDriveAccounts={mount(parent,kind,disabled=false){if(!['sync','backup'].includes(kind))return;for(const host of mounted.keys())if(!host.isConnected)mounted.delete(host);refresh();const host=node('section',null,'drive-connection');parent.append(host);mounted.set(host,{kind,disabled});render(host,kind,disabled);}};
root.onNativeDriveAccounts=raw=>{try{receive(raw);}catch(error){message='Stav účtu nelze ověřit. Původní data zůstávají uložená.';view={...view,error:true,busy:false};}renderAll();};
document.addEventListener('click',event=>{if(event.target?.id==='openDriveSync'){document.getElementById('modal').hidden=true;root.openZamerovacPeers?.();}});
})(window);
