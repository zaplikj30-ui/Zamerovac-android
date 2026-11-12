'use strict';
// #47 customer PDF/ZIP: execute the real export renderer with synthetic canvas/media.
// This asserts exported canvas coordinates, not final raster pixels or native PDF.
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
const insetSource=fs.readFileSync('app/src/main/assets/inset-workspace.js','utf8');
const customerSource=fs.readFileSync('app/src/main/assets/customer-export.js','utf8');
module.exports=async function run(){
 const cases=[
  {name:'unchanged-photo-no-note',notes:false,expectWidth:800,expectHeight:600},
  {name:'note-without-photo-is-not-inset',noDetail:true,expectWidth:800,expectHeight:600},
  {name:'detail-at-right-extends-customer-page',x:700,y:200},
  {name:'detail-below-extends-customer-page',x:400,y:570},
  {name:'detail-at-left-extends-customer-page',x:-75,y:190},
  {name:'stacked-rotated-rectangular-detail',x:710,y:480,count:3,rotation:34},
 ];
 for(const t of cases){
  const created=[],imageSize={main:[800,600],detail:[200,75]};
  class FakeImage{
   constructor(){this.naturalWidth=0;this.naturalHeight=0;this.complete=false}
   set src(url){
    const id=String(url).split(':').pop();
    [this.naturalWidth,this.naturalHeight]=imageSize[id==='main'?'main':'detail'];
    this.complete=true;this.onload?.();
   }
  }
  function canvas(){
   const result={width:1,height:1,ctx:null,toDataURL(){return 'data:image/png;base64,ZmFrZQ=='}};
   result.ctx={canvas:result,markers:[],draws:[],
    save(){},restore(){},translate(){},rotate(){},beginPath(){},moveTo(){},
    lineTo(){},closePath(){},fill(){},stroke(){},arc(){},setLineDash(){},
    strokeRect(){},fillRect(){},
    drawImage(image,...args){this.draws.push({image,args})},
    fillText(value,x,y){if(value==='🎙')this.markers.push({x,y})},
    measureText(value){return {width:String(value).length*9}}
   };
   result.getContext=()=>result.ctx;created.push(result);return result;
  }
  const note={id:'n',type:'note',a:{x:30,y:30},text:'Detail s hlasem',
   media:t.noDetail?[]:Array.from({length:t.count||1},(_,i)=>'detail-'+(i+1)),
   audioMedia:['voice-unchanged'],insetX:t.x??100,insetY:t.y??130,
   insetWidth:130,insetRotation:t.rotation||0};
  const record={id:'p',kind:'photo',media:['main'],items:t.notes===false?[]:[note]};
  const before=JSON.stringify(record);
  const window={__detailPhotoCache:{},isRecordLocked:()=>false};
  const s={
   window,Image:FakeImage,document:{createElement:type=>{assert.equal(type,'canvas');return canvas()}},
   URL:{revokeObjectURL(){}},setTimeout:()=>1,clearTimeout(){},
   assetUrl:async id=>'fixture:'+id,native:true,Native:{getMediaMime:()=> 'image/png'},
   state:{records:[record]},prefs:{fontSize:17,layerVisible:{dimensions:true,drawing:true,notes:true}},
   photoSize:{w:800,h:600},view:{zoom:1,dx:0,dy:0},
   stageCanvas:{clientWidth:420,clientHeight:700,addEventListener(){}},
   current:record,screen:'editor',mode:'select',selected:null,
   fitImage(){},exportPng(){},paint(){},notify(){},
   worldToScreen:p=>({...p}),
   annotationProjectPoint:(p,v)=>({x:p.x*v.zoom+v.dx,y:p.y*v.zoom+v.dy}),
   annotationRenderContext:(c,opts)=>opts,
   drawItem(c,item,render){
    const image=window.__detailPhotoCache?.[item.media?.[0]];
    if(image?.complete&&image.naturalWidth)window.renderPhotoInset(c,item,image,()=>{},render);
   },
   folderContains:()=>false,recordActions(){},showEditorOverflow(){},closeMenus(){},
   finishPendingPath(){},recById(){return record},modal(){},escapeHtml:x=>x,
   $(){return {}}
  };
  vm.createContext(s);
  vm.runInContext(insetSource,s,{filename:'inset-workspace.js'});
  vm.runInContext(customerSource,s,{filename:'customer-export.js'});
  const options={notes:true,dimensions:true,drawing:true};
  await window.__customerExport.render(record,options);
  const page=created.find(c=>c.ctx.draws.some(d=>d.image.naturalWidth===800));
  assert(page,t.name+': customer page not rendered');
  assert.equal(JSON.stringify(record),before,t.name+': project record mutated');
  if(t.expectWidth)assert.equal(page.width,t.expectWidth,t.name+': unexpected width');
  if(t.expectHeight)assert.equal(page.height,t.expectHeight,t.name+': unexpected height');
  if(!t.expectWidth){
   assert(page.width>800||page.height>600,t.name+': out-of-image inset still cropped');
   assert.equal(page.ctx.markers.length,1,t.name+': voice marker missing');
   const marker=page.ctx.markers[0];
   assert(marker.x>=13&&marker.y>=13&&marker.x+13<page.width&&marker.y+13<page.height,
    t.name+': customer PDF/ZIP canvas clips the marker');
  }
  // Actual PDF page-generation path shares the same renderCanvas.
  if(t.name==='detail-at-right-extends-customer-page'){
   const pages=window.__customerExport.pages(record,options);
   const first=await pages.next();
   assert.equal(first.done,false,'customer PDF appendix did not yield a page');
   assert.equal(typeof first.value,'string','customer PDF page must be encoded');
  }
 }
 console.log('PASS: #47 '+cases.length+' customer PDF/ZIP synthetic render and bounds scenarios');
};
if(require.main===module)module.exports().catch(e=>{console.error(e);process.exitCode=1});
