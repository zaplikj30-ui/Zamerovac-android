/* Future-ready, offline Czech interface strings. Never localize user records or measurement values. */
(function(root){
  'use strict';
  const languages=Object.freeze([
    Object.freeze({tag:'cs',autonym:'Čeština',name:'Čeština',flag:'🇨🇿',dir:'ltr',available:true})
  ]);
  const strings=Object.freeze({
    'language.setting':'Jazyk aplikace',
    'language.group':'Jazyk',
    'language.czech':'🇨🇿 Čeština',
    'language.title':'Jazyk aplikace',
    'language.selected':'Vybráno',
    'language.search':'Vyhledat jazyk',
    'language.empty':'Žádný jazyk neodpovídá hledání',
    'language.current':'Aktuální jazyk',
    'common.close':'Zavřít',
    'trash.restored':'Položka obnovena',
    'trash.failed':'Položku se nepodařilo obnovit',
    'folder.locked':'Nejdříve odemkněte složku.',
    'audio.title':'Uchované hlasové nahrávky',
    'audio.retained':'Nahrávka zůstala uchovaná. Připojení ověř v přehledu Uchované hlasové nahrávky.',
    'audio.item':'Nahrávka {number}',
    'audio.bindingReview':'Originál je dostupný. Potvrzení připojení se nepodařilo ověřit; zkontroluj uloženou poznámku nebo ulož kopii.',
    'audio.quarantined':'Originál je dostupný. Stav připojení vyžaduje kontrolu evidence; můžeš uložit jeho kopii.',
    'audio.stopped':'Nahrávka je dokončená v návrhu. K poznámce se připojí až po úspěšném Uložit.',
    'audio.journalWarning':'Evidence nahrávek vyžaduje kontrolu. Automatické opravy a potvrzení připojení jsou pozastavené. Dostupné originály lze přehrát nebo uložit jejich kopii; nic se nemaže.',
    'audio.pending':'Dokončená nahrávka čeká na připojení k poznámce.',
    'audio.review':'Nahrávka nebo její evidence vyžaduje kontrolu. Dokončení není potvrzené; originál se nemaže.',
    'audio.play':'Přehrát',
    'audio.attach':'Připojit k této poznámce',
    'audio.copy':'Uložit kopii originálu',
    'audio.close':'Zavřít',
    'audio.help':'Dokončený hlas připojíš v otevřené poznámce tlačítkem Připojit k této poznámce. U bodové poznámky pak potvrď Uložit. Nejistý záznam lze zkopírovat pro kontrolu; nemusí být přehratelný. Automatické mazání je vypnuté. Běžný ZIP zakázek nezahrnuje nepřipojené nahrávky.',
    'audio.suspect':'Podezřelá kopie nahrávky. Původní obsah není potvrzen; zachována pro ruční kontrolu.',
    'audio.copyReview':'Uložit podezřelou kopii',
    'audio.exportedReview':'Nejistá kopie byla zapsána pro ruční kontrolu. Původní obsah tím není potvrzen.',
    'audio.exported':'Kopie byla zapsána. Uchovaný originál zůstal v aplikaci.',
    'zip.invalid':'Soubor není platnou zálohou Zaměřovače'
  });
  function t(key,params){
    const template=strings[key];
    if(typeof template!=='string'){ if(typeof console!=='undefined')console.warn('Chybí český text:',key);return key; }
    return template.replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g,(_,name)=>Object.prototype.hasOwnProperty.call(params||{},name)?String(params[name]):'{'+name+'}');
  }
  function availableLanguages(registry=languages){
    return registry.filter(item=>item&&item.available===true&&typeof item.tag==='string'&&item.autonym);
  }
  function normalizeLanguage(value,registry=languages){
    return availableLanguages(registry).some(x=>x.tag===value)?value:'cs';
  }
  function findLanguages(query='',registry=languages){
    const fold=x=>String(x||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase().trim();
    const needle=fold(query);
    return availableLanguages(registry).filter(x=>!needle||fold([x.autonym,x.name,x.tag].join(' ')).includes(needle));
  }
  const api=Object.freeze({languages,t,availableLanguages,normalizeLanguage,findLanguages});
  root.ZamerovacI18n=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
