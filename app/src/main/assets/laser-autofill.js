/* Bosch laser: varianta A. Platná vzdálenost jde přímo do vybrané lineární kóty.
 * Samostatný modul, aby stávající editor i seznam posledních 40 hodnot zůstaly zachovány.
 * Měření se automaticky zapisuje pouze do předem označené kóty.
 * Bez označené kóty se hodnota ukládá jen do samostatné historie.
 */
'use strict';
(function(){
 const units={mm:1,cm:10,m:1000,in:25.4};
 const linearTypes=new Set(['dimension','chain','cumulative','polyline','line','arrow','circle','ellipse','rect','target','angle','area']);
 function parseDistance(value,unit){
  const raw=String(value??'').trim().replace(',','.');
  const u=String(unit||'mm').trim().toLowerCase();
  if(!/^\d+(?:\.\d+)?$/.test(raw)||!Object.prototype.hasOwnProperty.call(units,u))return null;
  const amount=Number(raw),millimeters=amount*units[u];
  if(!Number.isFinite(millimeters)||millimeters<=0||millimeters>250000)return null;
  return {amount,unit:u,millimeters};
 }
 // The incoming Bosch value stays unchanged in history and in laserMeasuredMm.
 // Display precision is separate from the physical measurement resolution.
 function roundMillimeters(mm,step){
  const allowed={'0.1':0.1,'0.5':0.5,'1':1};
  const increment=allowed[String(step)];
  if(!increment)return mm;
  return Math.round(mm/increment)*increment;
 }
 function asText(mm,unit){
  const rounded=roundMillimeters(mm,prefs.laserRounding||'none');
  const n=rounded/units[unit];
  const setting=String(prefs.laserDecimals??'auto');
  if(/^[0-3]$/.test(setting))return n.toFixed(Number(setting)).replace('.',',');
  // Automatic display: no unnecessary zeros, but keep fractions received from BLE.
  const decimalPlaces={mm:3,cm:4,m:6,in:5}[unit]??3;
  return Number(n.toFixed(decimalPlaces)).toString().replace('.',',');
 }
 window.__boschFormatDistance=(millimeters,unit='mm')=>asText(millimeters,unit);
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
  if(item.type==='angle'&&(!Array.isArray(item.points)||item.points.length<3)){
   notify('Bosch: nejdřív vytvoř celý úhel se dvěma rameny');return true;
  }
  if(['polyline','angle','area','rect'].includes(item.type)){
   const count=item.type==='area'?4:item.type==='angle'?2:item.type==='rect'?2:Math.max(1,(item.points?.length||2)-1);
   const index=Math.max(0,Math.min(count-1,Number(item.activeSegmentIndex)||0));
   const oldSegment=item.segmentData?.[index]||{};
   const formUnit=$('modal')&&!$('modal').hidden?$('segmentUnit'+index)?.value:null;
   const chosenUnit=formUnit==='none'?oldSegment.unit:(formUnit||oldSegment.unit);
   const segmentUnit=item.type==='polyline'&&units[chosenUnit]?chosenUnit:'mm';
   const text=asText(reading.millimeters,segmentUnit);
   if(item.type==='rect'){
    const field=index===0?'dimW':'dimH';
    if(item[field]===text){notify('Bosch: hodnota už je u strany');return true}
    checkpoint();item[field]=text;item.lastMeasuredAt=new Date().toISOString();commitEditor();
    const input=$(index===0?'rectWidth':'rectHeight');if(input&&$('modal')&&!$('modal').hidden){input.value=text;const chooser=$('segmentUnit'+index);if(chooser&&chooser.value!=='none')chooser.value=segmentUnit}
   }else if(item.type==='area'){
    if(!Array.isArray(item.sideMeasures))item.sideMeasures=['','','',''];
    if(item.sideMeasures[index]===text){notify('Bosch: hodnota už je u strany');return true}
    checkpoint();item.sideMeasures[index]=text;
    const area=typeof quadAreaFromMeasures==='function'?quadAreaFromMeasures(item):null;
    if(area!==null)item.measure=String(Number(area.toFixed(5))).replace('.',',');
    commitEditor();
    const input=$('areaSide'+index);if(input&&$('modal')&&!$('modal').hidden){input.value=text;const chooser=$('segmentUnit'+index);if(chooser&&chooser.value!=='none')chooser.value=segmentUnit}
   }else{
    if(!Array.isArray(item.segmentData))item.segmentData=[];
    const segment=item.segmentData[index]||{measure:'',text:'',unit:'mm'};
    if(segment.measure===text&&segment.unit===segmentUnit){notify('Bosch: hodnota už je u ramene');return true}
    checkpoint();item.segmentData[index]={...segment,measure:text,unit:segmentUnit,laserMeasuredMm:String(reading.millimeters)};
    commitEditor();
    const input=$(item.type==='angle'?'angleLength'+index:'segmentMeasure'+index);
    if(input&&$('modal')&&!$('modal').hidden){input.value=text;const chooser=$('segmentUnit'+index);if(chooser&&chooser.value!=='none')chooser.value=segmentUnit}
   }
   notify('✓ Bosch: '+text+' '+segmentUnit+' zapsáno do '+(item.type==='angle'?'ramene':'strany/úseku')+' '+(index+1));
   return true;
  }
  const activeIndex=Math.min((item.points?.length||2)-2,Math.max(0,Number(item.activeSegmentIndex)||0));
  const rowUnit=['chain','cumulative'].includes(item.type)&&item.points?.length>1?item.segmentData?.[activeIndex]?.unit:null;
  const dialogUnit=$('modal')&&!$('modal').hidden?
   (rowUnit?$('segmentUnit'+activeIndex)?.value:$('measureUnit')?.value):null;
  const preferredUnit=dialogUnit==='none'?(rowUnit||item.unit):(dialogUnit||rowUnit||item.unit);
  const destUnit=Object.prototype.hasOwnProperty.call(units,preferredUnit)?preferredUnit:
    Object.prototype.hasOwnProperty.call(units,prefs.unit)?prefs.unit:'mm';
  const result=asText(reading.millimeters,destUnit);
  if(['chain','cumulative'].includes(item.type)&&item.points?.length>1){
   const index=Math.min(item.points.length-2,Math.max(0,Number(item.activeSegmentIndex)||0));
   if(!Array.isArray(item.segmentData))item.segmentData=[];
   const segment=item.segmentData[index]||{measure:'',text:'',unit:destUnit};
   if(segment.measure===result&&segment.unit===destUnit){
    notify('Bosch: naměřený rozměr už je u úseku '+(index+1));return true;
   }
   checkpoint();
   item.segmentData[index]={...segment,measure:result,unit:destUnit,
    laserMeasuredMm:String(reading.millimeters),lastMeasuredAt:new Date().toISOString()};
   commitEditor();
   const input=$('segmentMeasure'+index),unitInput=$('segmentUnit'+index);
   if(input&&$('modal')&&!$('modal').hidden){
    input.value=result;if(unitInput&&unitInput.value!=='none')unitInput.value=destUnit;
   }
   notify('✓ Bosch: '+result+' '+destUnit+' zapsáno do úseku '+(index+1));
   return true;
  }
  if(item.measure===result&&item.unit===destUnit){
   notify('Bosch: '+result+' '+destUnit+' už je u vybrané kóty');
   return true;
  }
  checkpoint();
  item.measure=result;
  item.laserMeasuredMm=String(reading.millimeters);
  item.unit=destUnit;
  item.lastMeasuredAt=new Date().toISOString();
  commitEditor();
  // Pokud uživatel otevřel ruční editor, ukazovat i tam skutečně zapsanou hodnotu.
  const dialog=$('modal'),input=$('measureInput'),unitInput=$('measureUnit');
  if(dialog&&!dialog.hidden&&input){
   input.value=result;
   if(unitInput&&unitInput.value!=='none')unitInput.value=destUnit;
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
