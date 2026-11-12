'use strict';
// #47: real inset renderer, synthetic geometry; no private media or Android.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const source=fs.readFileSync('app/src/main/assets/inset-workspace.js','utf8');
function intersects(a,b){return !!b&&a.x<b.x+b.w&&a.x+a.w>b.x&&a.y<b.y+b.h&&a.y+a.h>b.y}
function scenario(t){
 const image={naturalWidth:t.imageWidth||100,naturalHeight:t.imageHeight||100};
 const item={id:'inset',type:'note',a:{x:40,y:60},
  media:t.noDetail?[]:Array.from({length:t.count||1},(_,i)=>'detail-'+(i+1)),
  audioMedia:t.audio===false?[]:['voice-original-1','voice-original-2'],
  text:t.text||'',insetX:t.x??90,insetY:t.y??160,
  insetWidth:t.w??130,insetRotation:t.rotation||0,
  captionMoved:!!t.captionMoved,b:t.b};
 const before=JSON.stringify(item),icons=[],captions=[];
 const c={save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},
  lineTo(){},closePath(){},fill(){},stroke(){},arc(){},setLineDash(){},
  strokeRect(){},drawImage(){},
  fillRect(x,y,w,h){if(this.fillStyle==='rgba(23,24,27,.8)')captions.push({x,y,w,h})},
  fillText(text,x,y){if(text==='🎙')icons.push({x,y})},
  measureText(text){return {width:String(text).length*9}}
 };
 const window={__detailPhotoCache:{'detail-1':image},isRecordLocked:()=>false};
 const s={window,stageCanvas:{clientWidth:420,clientHeight:700,addEventListener(){}},
  current:{kind:'photo',items:[item]},photoSize:{w:800,h:600},
  view:{zoom:1,dx:0,dy:0},prefs:{fontSize:17},
  screen:'editor',mode:'select',selected:null,fitImage(){},exportPng(){},paint(){},
  worldToScreen:p=>({...p}),
  annotationProjectPoint:(p,v)=>({x:p.x*v.zoom+v.dx,y:p.y*v.zoom+v.dy})};
 vm.createContext(s);vm.runInContext(source,s,{filename:'inset-workspace.js'});
 const zoom=t.zoom||1,dx=t.panX||0,dy=t.panY||0;
 const render={view:{zoom,dx,dy},photoSize:{w:800,h:600},
  viewport:{w:420,h:700},selected:null,exporting:!!t.exporting,prefs:{fontSize:17}};
 if(t.noDetail){
  assert.equal(window.insetAnnotationBounds(c,item,render),null,t.name+': no inset bounds');
  assert.equal(JSON.stringify(item),before,t.name+': original note unchanged');
  return;
 }
 window.renderPhotoInset(c,item,image,()=>{},render);
 assert.equal(JSON.stringify(item),before,t.name+': no mutation of stored note geometry/voice IDs');
 if(t.audio===false||t.expectHidden){
  assert.equal(icons.length,0,t.name+': marker must stay hidden');
  return;
 }
 assert.equal(icons.length,1,t.name+': one marker required');
 const marker={x:icons[0].x-13,y:icons[0].y-13,w:26,h:26};
 const w=item.insetWidth*zoom,h=w*image.naturalHeight/image.naturalWidth;
 const ox=item.insetX*zoom+dx,oy=item.insetY*zoom+dy;
 const cx=ox+w/2,cy=oy+h/2,angle=item.insetRotation*Math.PI/180;
 const turn=(x,y)=>({x:cx+(x-cx)*Math.cos(angle)-(y-cy)*Math.sin(angle),
  y:cy+(x-cx)*Math.sin(angle)+(y-cy)*Math.cos(angle)});
 const box=(x,y,width,height)=>{
  const pts=[turn(x,y),turn(x+width,y),turn(x+width,y+height),turn(x,y+height)];
  const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);
  return {x:Math.min(...xs),y:Math.min(...ys),
   w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)}
 };
 const count=item.media.length,step=Math.min(10,72/Math.max(1,count-1));
 for(let layer=0;layer<count;layer++){
  const sheet=box(ox+step*layer,oy-step*layer,w,h);
  assert(!intersects(marker,sheet),t.name+': marker overlaps sheet layer '+layer);
 }
 if(count>1&&!t.exporting){
  const off=step*(count-1),p=turn(ox+w+off+15,oy-off-11);
  assert(!intersects(marker,{x:p.x-13,y:p.y-13,w:26,h:26}),
   t.name+': marker covers sheet-count badge');
 }
 assert(captions.every(b=>!intersects(marker,b)),t.name+': marker covers caption');
 if(!t.exporting)assert(marker.x>=2&&marker.y>=2&&
   marker.x+marker.w<=418&&marker.y+marker.h<=698,t.name+': marker clipped');
 const bounds=window.insetAnnotationBounds(c,item,render);
 assert(bounds.minX<=marker.x&&bounds.minY<=marker.y&&
  bounds.maxX>=marker.x+marker.w&&bounds.maxY>=marker.y+marker.h,
  t.name+': full rendered bounds must include marker');
}
const cases=[
 {name:'single-no-caption'},
 {name:'short-caption',text:'Detail zásuvky'},
 {name:'long-caption',text:'Připojení vody a elektřiny s dlouhým popiskem'},
 {name:'moved-caption',text:'Text u ikony',captionMoved:true,b:{x:239,y:278}},
 {name:'two-photo-stack-P2-regression',count:2},
 {name:'four-photo-stack',count:4,text:'Více snímků'},
 {name:'seven-photo-stack',count:7,text:'7 příloh'},
 {name:'rectangular-rotated-stack',count:3,imageWidth:200,imageHeight:75,rotation:43},
 {name:'counterclockwise-stacked-photo',count:2,imageWidth:150,imageHeight:90,rotation:-35},
 {name:'photo-counter-and-caption',count:3,text:'Popisek a počet'},
 {name:'zoom-pan-and-rotation',count:2,rotation:25,zoom:1.25,panX:38,panY:-22},
 {name:'bottom-right-fallback',x:295,text:'U okraje'},
 {name:'bottom-edge-fallback',y:640,text:'Dole u okraje'},
 {name:'export-bounds-multiple-images',count:4,exporting:true,text:'PDF a PNG'},
 {name:'export-rectangular',imageWidth:200,imageHeight:75,rotation:55,exporting:true},
 {name:'no-safe-viewport-must-not-cover-photo',x:500,y:790,expectHidden:true},
 {name:'no-voice-no-marker',audio:false,text:'Jen text'},
 {name:'voice-without-detail-has-no-inset',noDetail:true,text:'Samostatný hlas'}
];
for(const c of cases)scenario(c);
console.log('PASS: #47 '+cases.length+' inset geometry, stacks, orientation, zoom/pan, clip and nonmutation fixtures');
