/* Bosch laser: varianta A. Platná vzdálenost jde přímo do vybrané lineární kóty.
 * Samostatný modul, aby stávající editor i seznam posledních 40 hodnot zůstaly zachovány.
 * Měření se automaticky zapisuje pouze do předem označené kóty.
 * Bez označené kóty se hodnota ukládá jen do samostatné historie.
 */
'use strict';
(function(){
 const units={mm:1,cm:10,m:1000,in:25.4};
 const linearTypes=new Set(['dimension','chain','cumulative']);
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
   notify('Bosch: hodnota uložena do historie. Nejdřív označ kótu a potom změř.');
   return true;
  }
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
 // Při příchodu nové hodnoty se vždy kontroluje AKTUÁLNĚ označená kóta.
 // Nikdy nezapíšeme starší odečet dodatečným klepnutím.
 window.__handleLaserAuto=function(value,unit){
  if(screen!=='editor'||!current)return false;
  try{return apply(value,unit)}
  catch(error){notify('Měření se nepodařilo zpracovat');return true}
 };
 window.__applyLaserMeasurement=function(value,unit,options={}){
  try{return apply(value,unit,options)}
  catch(error){notify('Měření z historie se nepodařilo uložit');return true}
 };
 window.__parseBoschDistance=parseDistance;
})();
