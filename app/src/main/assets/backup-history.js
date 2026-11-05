/* Historical backup UI is independent of device pairing and live synchronisation. */
(function(root){
'use strict';
let panel,content,status,view={configured:false,busy:false},histories=[],verified=new Set(),metered;
function el(tag,text,cls){const node=document.createElement(tag);if(text!=null)node.textContent=text;if(cls)node.className=cls;return node;}
function button(text,id,action){const node=el('button',text,'outline');node.type='button';if(id)node.id=id;node.onclick=action;node.disabled=!!view.busy;return node;}
function command(name,path='',allow=false){if(!root.Native||typeof root.Native.backupHistoryControl!=='function'){status.textContent='Historie záloh vyžaduje Android aplikaci s touto aktualizací.';return;}root.Native.backupHistoryControl(name,path,allow);}
function render(){if(!panel||panel.hidden)return;content.replaceChildren();status.textContent=String(view.message||'');
 content.append(el('p','Samostatné neměnné historické body telefonu a tabletu. Stejné soubory sdílejí ověřené bloky; synchronizace na tuto historii nesahá.'));
 const controls=el('div',null,'row wrap');controls.append(button('Vybrat složku záloh','historySelect',()=>command('select')),button('Obnovit seznam','historyList',()=>command('list')),button('Vytvořit historickou zálohu','historyCreate',()=>command('create')));content.append(controls);
 if(!view.configured)content.append(el('p','Vyber samostatně místo pro zálohy. Google Disk je dostupný pouze tehdy, nabízí-li jeho Android poskytovatel zapisovatelnou složku. Můžeš použít i místní úložiště.','muted'));
 if(view.busy)content.append(el('p','Probíhá kontrola nebo přenos. Ostatní uložené zakázky zůstávají dostupné.'));
 if(metered){content.append(el('p','Tato operace může přenést velké fotografie a videa přes mobilní data nebo měřený hotspot.'));content.append(button('Povolit měřenou síť jen pro tuto operaci','historyAllowMetered',()=>{if(root.confirm('Povolit pro tuto operaci i velký přenos přes mobilní data nebo měřený hotspot?'))command(metered.command,metered.path||'',true);}));}
 if(view.data?.refreshWarning)content.append(el('p',String(view.data.refreshWarning),'peer-error'));
 if(Number.isFinite(view.data?.occupiedBytes))content.append(el('p','Datové bloky: '+(view.data.occupiedBytes/1024/1024).toFixed(2)+' MiB'+(view.data.occupiedApproximate?' nebo více':'')+' (bez režie poskytovatele).','muted'));
 const groups=new Map();for(const item of histories){if(!item||typeof item.path!=='string')continue;const id=String(item.deviceId||'');if(!groups.has(id))groups.set(id,[]);groups.get(id).push(item);}
 for(const [id,items] of groups){const group=el('section');group.append(el('h3',(id===view.data?.deviceId?'Toto zařízení':String(items[0].deviceName||'Android'))+' · '+id.slice(0,8)));
  for(const item of items.sort((a,b)=>String(b.createdAt||'').localeCompare(String(a.createdAt||'')))){const row=el('article',null,'peer-device');row.append(el('p',String(item.createdAt||'Nečitelný historický bod')),el('p',item.error?'Manifest nelze ověřit':verified.has(item.path)?'Obsah ověřen v této relaci':'Úplnost se ověří před obnovou'));
   if(!item.error){row.append(el('p',Math.max(0,Number(item.files)||0)+' příloh'),button('Ověřit všechny soubory',null,()=>command('check',item.path)),button('Obnovit jako nové kopie',null,()=>{if(root.confirm('Obnovit tuto historickou zálohu jako nové kopie zakázek? Aktuální zakázky zůstanou zachované.'))command('restore',item.path);}));}group.append(row);
  }content.append(group);
 }
 if(!histories.length)content.append(el('p','Seznam historických bodů není načtený nebo je složka prázdná.'));
 content.append(el('p','Historie se sama neprořezává a automatická frekvence není zapnutá. Pro ruční správu použij správce souborů vybraného úložiště. Při ručním odstranění sdíleného bloku mohou být neúplné různé historické body; před obnovou se vždy kontroluje hash a úplnost.','muted'));
 if(view.configured)content.append(button('Odpojit složku bez smazání historie','historyDisconnect',()=>command('disconnect')));
}
function close(){panel.hidden=true;}
function open(){if(!panel){panel=el('section',null,'panel peer-panel');panel.id='backupHistoryPanel';panel.hidden=true;panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','Historické zálohy');const head=el('header',null,'panelHead');head.append(button('←','historyClose',close),el('b','Historické zálohy'));status=el('p',null,'peer-error');status.id='historyStatus';status.setAttribute('role','status');content=el('div',null,'peer-content');panel.append(head,status,content);document.body.append(panel);}panel.hidden=false;render();command('list');panel.querySelector('#historyClose').focus();}
root.onNativeBackupHistory=raw=>{try{const next=typeof raw==='string'?JSON.parse(raw):raw;if(!next||typeof next!=='object')throw Error();view={...view,...next};if(Array.isArray(next.data?.histories))histories=next.data.histories;if(next.data?.verifiedPath)verified.add(next.data.verifiedPath);metered=next.phase==='metered'?next.data:null;if(next.phase==='idle'&&next.configured===false){histories=[];verified.clear();}render();}catch(e){if(status)status.textContent='Stav zálohy nelze načíst. Aktuální data zůstávají uložená.';}};
root.openZamerovacBackupHistory=open;
const previousSettings=renderSettings;renderSettings=function(){previousSettings();document.getElementById('settingsContent').append(el('div','Zálohování','setGroup'),button('Historické zálohy a obnova','historySettings',open));};
const previousMenu=showAppMenu;showAppMenu=function(id,items){if(id==='navMenu'||id==='overflowMenu')items=[...items,['Historické zálohy',open]];return previousMenu(id,items);};
const previousBack=root.handleAndroidBack;root.handleAndroidBack=function(){if(panel&&!panel.hidden){close();return 'handled';}return typeof previousBack==='function'?previousBack():'root';};
})(window);
