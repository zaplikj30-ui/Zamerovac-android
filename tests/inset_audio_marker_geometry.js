'use strict';
// #47: the voice indicator is visual; never obscure a detail photo or caption.
// Real production inset renderer, synthetic canvas, no Android or private media.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/inset-workspace.js','utf8');
const image={naturalWidth:100,naturalHeight:100};
function intersects(a,b){
 return !!b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y;
}
function scenario(test){
 const item={id:'detail-note',type:'note',a:{x:40,y:60},media:['detail-1'],
  audioMedia:test.audio===false?[]:['original-voice-1','original-voice-2'],
  text:test.text||'',insetX:test.x||90,insetY:test.y||160,
  insetWidth:test.w||130,insetRotation:test.rotation||0,
  captionMoved:!!test.captionMoved,b:test.b||undefined};
 const before=JSON.stringify(item),icons=[],captions=[];
 const c={
  save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},
  lineTo(){},closePath(){},fill(){},stroke(){},arc(){},setLineDash(){},
  strokeRect(){},drawImage(){},
  fillRect(x,y,w,h){if(this.fillStyle==='rgba(23,24,27,.8)')captions.push({x,y,w,h})},
  fillText(value,x,y){if(value==='🎙')icons.push({x,y})},
  measureText(value){return {width:String(value).length*9}}
 };
 const window={__detailPhotoCache:{'detail-1':image},isRecordLocked:()=>false};
 const s={
  window,stageCanvas:{clientWidth:420,clientHeight:700,addEventListener(){}},
  current:{kind:'photo',items:[item]},photoSize:{w:800,h:600},
  view:{zoom:1,dx:0,dy:0},prefs:{fontSize:17},screen:'editor',mode:'select',
  selected:null,fitImage(){},exportPng(){},paint(){},
  worldToScreen:p=>({...p}),
  annotationProjectPoint:(p,v)=>({x:p.x*v.zoom+v.dx,y:p.y*v.zoom+v.dy})
 };
 vm.createContext(s);
 vm.runInContext(source,s,{filename:'inset-workspace.js'});
 const zoom=test.zoom||1,render={view:{zoom,dx:0,dy:0},
  photoSize:{w:800,h:600},viewport:{w:420,h:700},
  selected:null,exporting:!!test.exporting,prefs:{fontSize:17}};
 window.renderPhotoInset(c,item,image,()=>{},render);
 assert.equal(JSON.stringify(item),before,test.name+': data must remain byte-identical');
 assert.equal(icons.length,test.audio===false?0:1,test.name+': voice icon count');
 if(!icons.length)return;
 const p=icons[0],icon={x:p.x-13,y:p.y-13,w:26,h:26};
 const w=item.insetWidth*zoom,h=w,cx=item.insetX*zoom+w/2,cy=item.insetY*zoom+h/2;
 const angle=item.insetRotation*Math.PI/180;
 const corners=[[-w/2,-h/2],[w/2,-h/2],[w/2,h/2],[-w/2,h/2]].map(([x,y])=>
  ({x:cx+x*Math.cos(angle)-y*Math.sin(angle),
    y:cy+x*Math.sin(angle)+y*Math.cos(angle)}));
 const xs=corners.map(x=>x.x),ys=corners.map(x=>x.y);
 const photo={x:Math.min(...xs),y:Math.min(...ys),
  w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)};
 assert(!intersects(icon,photo),test.name+': icon covers rotated photo');
 assert(captions.every(box=>!intersects(icon,box)),test.name+': icon covers caption');
 if(!test.exporting){
  assert(icon.x>=2&&icon.y>=2&&icon.x+icon.w<=418&&icon.y+icon.h<=698,
   test.name+': icon cropped outside editor');
 }
 const bounds=window.insetAnnotationBounds(c,item,render);
 assert(bounds.minX<=icon.x&&bounds.minY<=icon.y&&
  bounds.maxX>=icon.x+icon.w&&bounds.maxY>=icon.y+icon.h,
  test.name+': gallery/export bounds must include icon');
}
const cases=[
 {name:'no-caption'},
 {name:'short-caption',text:'Detail zásuvky'},
 {name:'long-caption',text:'Velmi dlouhý popisek rozvodu elektřiny a vody'},
 {name:'moved-caption-near-icon',text:'Popisek u ikony',captionMoved:true,b:{x:240,y:278}},
 {name:'rotated-detail',text:'Otočená fotografie',rotation:40},
 {name:'narrow-right-edge-fallback',x:295,text:'Napravo u okraje'},
 {name:'bottom-edge-fallback',y:640,text:'Dole u okraje'},
 {name:'zoom-with-precise-values',zoom:1.5,text:'Rozměr 1250,000001 mm'},
 {name:'export-bounds',text:'Export s hlasem',exporting:true},
 {name:'no-voice-no-marker',audio:false,text:'Jen text'}
];
for(const test of cases)scenario(test);
console.log('PASS: #47 '+cases.length+' synthetic audio marker render/bounds scenarios; source data unchanged');
