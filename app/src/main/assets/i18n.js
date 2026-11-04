/* Future-ready, offline Czech interface strings. Never localize user records or measurement values. */
(function(root){
  'use strict';
  const languages=Object.freeze([
    Object.freeze({tag:'cs',autonym:'Čeština',name:'Čeština',flag:'🇨🇿',dir:'ltr',available:true})
  ]);
  const strings=Object.freeze({
    'language.setting':'Jazyk aplikace',
    'language.title':'Jazyk aplikace',
    'language.selected':'Vybráno',
    'language.search':'Vyhledat jazyk',
    'language.empty':'Žádný jazyk neodpovídá hledání',
    'language.current':'Aktuální jazyk',
    'common.close':'Zavřít',
    'trash.restored':'Položka obnovena',
    'trash.failed':'Položku se nepodařilo obnovit',
    'folder.locked':'Nejdříve odemkněte složku.',
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
