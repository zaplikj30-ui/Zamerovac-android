/* Bosch laser: varianta A. Platná vzdálenost jde přímo do vybrané lineární kóty.
 * Samostatný modul, aby stávající editor i seznam posledních 40 hodnot zůstaly zachovány.
 * Měření přijde buď do již vybrané kóty, nebo čeká na první výběr.
 */
'use strict';
(function(){
 const units={mm:1,cm:10,m:1000,in:25.4};
 const linearTypes=new Set(['dimension','chain','cumulative']);
 let pending=null;
 function parseDistance(value,unit){
  const raw=String(value??'').trim().replace(',','.');
  const u=String(unit||'mm').trim().toLowerCase();
  if(!/^\d+(?:\.\d+)?$/.test(raw)||!Object.prototype.hasOwnProperty.call(units,u))return null;
  const amount=Number(raw),millimeters=amount*units[u];
  if(!Number.isFinite(millimeters)||millimeters<=0||millimeters>250000)return null;
  return {amount,unit:u,millimeters};
 }
 function asText(n,unit){
  // Nepřevádět opakovaně při přepisu; zachovat rozlišení měřiče.
  const decimals={mm:2,cm:4,m:6,in:5}[unit]??2;
  return Number(n.toFixed(decimals)).toString().replace('.',',');
 }
 function apply(value,unit,options={}){
  const reading=parseDistance(value,unit);
  if(!reading){
   notify('Bosch: neplatná hodnota nebo jednotka – kóta se nezměnila');
   return true;
  }
  window.lastLaser={value:String(value),unit:reading.unit,time:new Date().toISOString()};
  if(screen!=='editor'||!current){
   if(options.fromHistory)notify('Otevři fotografii a vyber kótu');
   return false;
  }
  if(window.isRecordLocked?.(current)){
   notify('Zakázka je uzamčena. Rozměr jsem nezměnil.');
   return true;
  }
  const item=(current.items||[]).find(x=>x.id===selected);
  if(!item||!linearTypes.has(item.type)){
   if(options.holdIfUnselected){
    pending={value:String(value),unit:reading.unit,recordId:current.id};
    notify('Bosch: hodnota připravena. Klepni na kótu.');
   }else notify('Bosch: vyber kótu, do které mám zapsat měření');
   return true;
  }
  // Každý fyzický odečet se smí zapsat jen jednou.
  if(options.holdIfUnselected||options.fromPending)pending=null;
  const destUnit=Object.prototype.hasOwnProperty.call(units,item.unit)?item.unit:
    Object.prototype.hasOwnProperty.call(units,prefs.unit)?prefs.unit:'mm';
  const result=asText(reading.millimeters/units[destUnit],destUnit);
  if(item.measure===result&&item.unit===destUnit){
   notify('Bosch: '+result+' '+destUnit+' už je u vybrané kóty');
   return true;
  }
  checkpoint();
  item.measure=result;
  item.unit=destUnit;
  item.lastMeasuredAt=new Date().toISOString();
  commitEditor();
  // Pokud uživatel otevřel ruční editor, ukazovat i tam skutečně zapsanou hodnotu.
  const dialog=$('modal'),input=$('measureInput'),unitInput=$('measureUnit');
  if(dialog&&!dialog.hidden&&input){
   input.value=result;
   if(unitInput)unitInput.value=destUnit;
  }
  notify('✓ Bosch: '+result+' '+destUnit+' zapsáno přímo do kóty');
  return true;
 }
 // Vrací true, když šlo o událost pro editor. Handler v upgrade.js
 // pak správně vynechá původní oznámení, které nic neukládalo.
 window.__handleLaserAuto=function(value,unit){
  if(screen!=='editor')return false;
  try{return apply(value,unit,{holdIfUnselected:true})}
  catch(error){notify('Nepodařilo se uložit měření – kótu zkontroluj');return true}
 };
 window.__applyLaserMeasurement=function(value,unit,options={}){
  try{return apply(value,unit,options)}
  catch(error){notify('Měření z historie se nepodařilo uložit');return true}
 };
 window.__assignPendingLaserToSelected=function(){
  if(!pending||screen!=='editor'||!current)return false;
  if(pending.recordId!==current.id){pending=null;return false;}
  const reading=pending;
  const item=(current.items||[]).find(x=>x.id===selected);
  if(!item||!linearTypes.has(item.type))return false;
  pending=null;
  try{return apply(reading.value,reading.unit,{fromPending:true})}
  catch(error){notify('Měření se nepodařilo vložit');return true}
 };
 window.__parseBoschDistance=parseDistance;
})();
