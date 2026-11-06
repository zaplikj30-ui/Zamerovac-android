/* Frequency of attempts initiated here; trusted incoming local transfers remain enabled. */
(function(root){
'use strict';
const choices=[['auto','Automaticky (doporučeno)'],['15','Každých 15 minut'],['30','Každých 30 minut'],['60','Každých 60 minut'],['manual','Ručně']];
function mount(host){
 const label=document.createElement('label');label.className='setting';label.htmlFor='syncFrequency';
 const text=document.createElement('span');text.textContent='Frekvence automatických pokusů z tohoto zařízení';
 const select=document.createElement('select');select.id='syncFrequency';select.setAttribute('aria-label',text.textContent);
 for(const [value,title] of choices){const option=document.createElement('option');option.value=value;option.textContent=title;select.append(option);}
 select.value=prefs.autoSync===false?'manual':choices.some(([value])=>value===prefs.syncFrequency)?prefs.syncFrequency:'auto';
 select.onchange=()=>{
  const previous={mode:prefs.syncFrequency,enabled:prefs.autoSync};prefs.syncFrequency=select.value;prefs.autoSync=select.value!=='manual';
  if(!save()){prefs.syncFrequency=previous.mode;prefs.autoSync=previous.enabled;select.value=previous.enabled===false?'manual':previous.mode||'auto';return;}
  if(!applyNativePrefs()){prefs.syncFrequency=previous.mode;prefs.autoSync=previous.enabled;save();select.value=previous.enabled===false?'manual':previous.mode||'auto';return;}
  const legacy=document.querySelector('[data-setting="autoSync"]');if(legacy)legacy.checked=prefs.autoSync;
 };
 label.append(text,select);host.append(label);
 const note=document.createElement('p');note.className='muted';note.textContent='Android může pokus na pozadí odložit. Ručně zastaví vlastní automatické pokusy; použij Zkusit přenos znovu nebo Synchronizovat nyní. Rozběhnutý přenos se dokončí a spárované zařízení může přenést data příchozím místním spojením. To zastavíš vypnutím místního přenosu.';host.append(note);
}
root.ZamerovacSyncCadence=Object.freeze({mount});
})(window);
