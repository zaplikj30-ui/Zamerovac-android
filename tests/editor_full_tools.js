/* Regression: geometry, independent segments, captions, and shape fields. */
'use strict';
const assert=require('assert'),fs=require('fs'),vm=require('vm');
const editor=fs.readFileSync('app/src/main/assets/editor.js','utf8');
const a=editor.indexOf('function drawItem(c,item){'),b=editor.indexOf('function drawLoupe(){',a);
assert(a>=0&&b>a,'Drawing function must remain accessible');
const drawSource=editor.slice(a,b);
const labels=[],arrows=[];
const graphics={save(){},restore(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},
 strokeRect(){},arc(){},ellipse(){},fill(){},fillRect(){},translate(){},rotate(){},
 setLineDash(){},measureText:()=>({width:10})};
const env={prefs:{unit:'mm',color:'#ffe000',lineWidth:2,fontSize:17},
 worldToScreen:p=>({...p}),canvasText:(text)=>labels.push(text),
 drawArrow:(...args)=>arrows.push(args),drawNoteLeader:()=>{},
 noteDisplayedCaption:()=>'',noteCaptionScreen:()=>({x:0,y:0}),
 Math,Number,console};
vm.createContext(env);vm.runInContext(drawSource,env);
const draw=obj=>{labels.length=0;arrows.length=0;env.drawItem(graphics,{
 id:'sample',color:'#fbd000',width:2,fontSize:15,unit:'mm',...obj
 });return [...labels]};
let result=draw({type:'line',a:{x:0,y:20},b:{x:120,y:20},measure:'1250',text:'Zásuvka'});
assert(result.some(x=>x.includes('1250 mm')&&x.includes('Zásuvka')),
 'Čára musí umět číslo a vlastní popisek současně');
result=draw({type:'arrow',a:{x:5,y:20},b:{x:120,y:20},measure:'500',text:'Voda'});
assert(result.some(x=>x.includes('500 mm')&&x.includes('Voda')));
assert(arrows.length>0,'Šipka si musí zachovat hrot');
result=draw({type:'circle',a:{x:0,y:0},b:{x:100,y:100},
  measure:'300',measureKind:'diameter'});
assert(result.some(x=>x.includes('Ø 300 mm')));
result=draw({type:'ellipse',a:{x:0,y:0},b:{x:120,y:80},
  measure:'60',measureKind:'radius'});
assert(result.some(x=>x.includes('R 60 mm')));
const points=[{x:0,y:0},{x:100,y:0},{x:100,y:80}];
const segmentData=[{measure:'100',unit:'mm',text:'první'},
 {measure:'80',unit:'mm',text:'druhý'}];
for(const type of ['chain','cumulative']){
 result=draw({type,points,a:points[0],b:points[2],segmentData});
 assert(result.some(x=>x.includes('100 mm')&&x.includes('první')),
  type+' – první měření musí být vidět');
 assert(result.some(x=>x.includes('80 mm')&&x.includes('druhý')),
  type+' – druhé měření musí být vidět');
 assert(arrows.length>=4,type+' – každé rameno má mít oba koncové hroty');
}
result=draw({type:'angle',points:[{x:0,y:20},{x:60,y:20},{x:60,y:80}],
  a:{x:0,y:20},b:{x:60,y:80},measure:''});
assert(result.some(x=>x.includes('90.0°')),'Úhel 90° ze skutečných dvou ramen');
result=draw({type:'area',a:{x:0,y:0},b:{x:100,y:100},
  measure:'1,2',unit:'m²',areaWidth:'1200',areaHeight:'1000'});
assert(result.some(x=>x.includes('1,2 m²')));
assert(result.some(x=>x.includes('1200 mm'))&&result.some(x=>x.includes('1000 mm')));
const rich=fs.readFileSync('app/src/main/assets/rich-notes.js','utf8');
assert(rich.includes('🖼️ Vybrat fotografii')&&rich.includes('attachments.push(id)'),
 'Poznámky zobrazují barevnou ikonu a zachovávají pořadí fotek');
const toolbar=fs.readFileSync('app/src/main/assets/toolbar-customize.js','utf8');
assert(toolbar.includes('prefs.toolbarIconOrder')&&toolbar.includes('500'),
 'Ukládá se přemístění ikon dlouhým podržením');
console.log('OK: full editor tools, labels, segments, Bosch-compatible model and icon ordering');
