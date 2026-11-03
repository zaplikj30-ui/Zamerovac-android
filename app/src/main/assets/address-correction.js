/* Oprava adresy v jednotlivých fotografiích včetně výběru adresního místa v RÚIAN. */
'use strict';
(function(){
  let photoLookupId=null;
  const stripPostcode=str=>String(str||'').replace(/\b\d{3}\s?\d{2}\b/g,'').replace(/^[,\s]+|[,\s]+$/g,'').trim();
  function hasHouseNumber(address){
    if(!address)return false;
    const withoutZip=stripPostcode(address);
    // Číslo popisné/orientační se rozpozná až po odstranění PSČ.
    return /(?:^|[\s,])\d{1,5}(?:\/\d{1,5})?(?=$|[\s,])/.test(withoutZip);
  }
  function labelFor(address){
    return hasHouseNumber(address)?'Upravit adresu':'Doplnit č.p.';
  }
  function applyPhotoAddress(id,address){
    const record=recById(id);
    if(!record||record.kind!=='photo')return;
    const text=String(address||'').trim();
    if(!text){notify('Nejdřív vyplň adresu');return}
    record.photoAddress=text;
    record.photoAddressChecked=true;
    record.photoAddressConfirmed=true;
    touch(record);save();
    photoLookupId=null;
    if(screen==='browser')showFolder();
    else if(screen==='editor'&&current?.id===id){
      const meta=$('editorPhotoMeta');
      if(meta){meta.textContent=photoDetailsText(record);meta.title=meta.textContent}
    }
    notify('Adresa fotografie uložena');
  }
  function openPhotoAddressEditor(id){
    const record=recById(id);
    if(!record||record.kind!=='photo')return;
    photoLookupId=id;
    const oldAddress=String(record.photoAddress||'').trim();
    const initial=hasHouseNumber(oldAddress)?oldAddress:stripPostcode(oldAddress);
    modal('Adresa a číslo domu',
      '<p class="muted">GPS někdy rozpozná pouze PSČ a obec. Číslo popisné pak nelze spolehlivě určit bez ověření. Níže je můžeš doplnit ručně nebo vybrat z registru adres ČÚZK.</p>'+
      '<div class="address-current">Zjištěno: <strong>'+escapeHtml(oldAddress||'Žádná adresa')+'</strong></div>'+
      '<label>Úplná adresa (například Jezernice 54)</label>'+
      '<input id="photoAddressInput" type="text" autocomplete="street-address" value="'+escapeHtml(initial)+'" placeholder="Obec, ulice, číslo popisné">'+
      '<div class="row wrap"><button class="outline" type="button" id="photoAddressSearch">⌕ Vyhledat adresu v RÚIAN</button></div>'+
      '<div id="photoAddressCandidates" class="address-candidates" aria-live="polite"></div>'+
      '<p class="muted">Po zvolení adresy klepni na „Uložit adresu“. Uloží se k této fotografii, další fotografie se nezmění.</p>',
      ()=>{
        const val=$('photoAddressInput').value.trim();
        if(!val){notify('Zadej adresu');return false}
        applyPhotoAddress(id,val);
      },'Uložit adresu');
    $('photoAddressSearch').onclick=()=>{
      const query=$('photoAddressInput').value.trim();
      if(query.length<3){notify('Zadej obec a případně číslo domu');return}
      if(!native||typeof Native.searchAddress!=='function'){
        $('photoAddressCandidates').textContent='Vyhledávání RÚIAN je dostupné v Android aplikaci. Adresu můžeš uložit ručně.';
        return;
      }
      $('photoAddressCandidates').textContent='Vyhledávám konkrétní adresní místa…';
      Native.searchAddress(query);
    };
  }
  // Vrácené kandidáty zobrazíme jen v dialogu, který sám vyvolal vyhledávání.
  const oldCandidates=window.onAddressCandidates;
  window.onAddressCandidates=function(raw){
    const panel=$('photoAddressCandidates');
    if(!photoLookupId||!panel||!panel.isConnected||$('modal').hidden){
      if(typeof oldCandidates==='function')oldCandidates(raw);
      return;
    }
    let result;
    try{result=JSON.parse(raw)}catch(e){panel.textContent='Adresy se nepodařilo načíst';return}
    const candidates=Array.isArray(result.candidates)?result.candidates.filter(x=>x&&typeof x.address==='string'&&x.address.trim()):[];
    panel.innerHTML=candidates.length
      ?'<p>Vyber správné číslo domu (nebo zadej adresu ručně):</p>'+
       candidates.slice(0,10).map((x,i)=>
        '<button class="addressChoice" type="button" data-address-index="'+i+'"><span>'+
        escapeHtml(x.address)+'</span><small>Vybrat</small></button>').join('')
      :'<p>RÚIAN nenašel odpovídající adresu. Zkontroluj obec/číslo domu, nebo adresu ulož ručně.</p>';
    panel.querySelectorAll('[data-address-index]').forEach(b=>b.onclick=()=>{
      const choice=candidates[Number(b.dataset.addressIndex)];
      if(choice){$('photoAddressInput').value=choice.address;
        panel.innerHTML='<p>Vybráno: <strong>'+escapeHtml(choice.address)+'</strong>. Potvrď tlačítkem „Uložit adresu“.</p>';}
    });
  };
  window.openPhotoAddressEditor=openPhotoAddressEditor;
  const previousShowFolder=showFolder;
  showFolder=function(){
    previousShowFolder();
    document.querySelectorAll('#items .entry[data-id]').forEach(entry=>{
      const record=recById(entry.dataset.id);
      if(record?.kind!=='photo')return;
      const info=entry.querySelector('.entry-info');
      if(!info)return;
      const btn=document.createElement('button');
      btn.type='button';btn.className='entry-address-edit';
      const missing=!hasHouseNumber(record.photoAddress);
      btn.textContent=missing?'⚠ Doplnit číslo domu':'✎ Upravit adresu';
      btn.title=missing?'GPS nevrátila číslo domu – klepni pro doplnění':'Změnit uloženou adresu fotografie';
      btn.setAttribute('aria-label',btn.title);
      btn.onclick=e=>{e.preventDefault();e.stopPropagation();openPhotoAddressEditor(record.id)};
      // U již správných adres nepřidáváme trvalé tlačítko, možnost zůstává v menu ⋮.
      if(missing&&(record.photoTakenAt||record.photoAddress||record.photoAddressChecked))info.append(btn);
    });
  };
  const previousRecordActions=recordActions;
  recordActions=function(id){
    previousRecordActions(id);
    const record=recById(id);
    if(record?.kind!=='photo')return;
    const btn=document.createElement('button');
    btn.type='button';btn.className='outline';
    btn.textContent='📍 '+labelFor(record.photoAddress);
    btn.onclick=()=>{
      $('modal').hidden=true;
      openPhotoAddressEditor(id);
    };
    $('modalBody').querySelector('.row')?.append(btn);
  };
  const meta=$('editorPhotoMeta');
  if(meta){
    meta.title='Klepnutím lze doplnit nebo změnit adresu fotografie';
    meta.style.cursor='pointer';
    meta.onclick=()=>{if(current?.kind==='photo')openPhotoAddressEditor(current.id)};
  }
  // Po načtení skriptu už existuje seznam položek; doplnit ovládání i u něj.
  if(screen==='browser')showFolder();
})();
