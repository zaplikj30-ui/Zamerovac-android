/* Zaměřovač B2 – pure geometry/model helpers. No editor, DOM or storage access.
 * Keep the existing coordinates, values, units and return shapes unchanged.
 */
(function(root){
'use strict';
function screenToWorld(p,transform){return {x:(p.x-transform.dx)/transform.zoom,y:(p.y-transform.dy)/transform.zoom}}
function worldToScreen(p,transform){return {x:p.x*transform.zoom+transform.dx,y:p.y*transform.zoom+transform.dy}}
function boundsPoint(p,imageSize){return {x:Math.max(0,Math.min(imageSize.w,p.x)),y:Math.max(0,Math.min(imageSize.h,p.y))}}
function annotationProjectPoint(p,transform){return worldToScreen(p,transform)}
function rectCorners(item){
 const a=item.a||{x:0,y:0},b=item.b||a;
 const x1=Math.min(a.x,b.x),x2=Math.max(a.x,b.x),y1=Math.min(a.y,b.y),y2=Math.max(a.y,b.y);
 return [{x:x1,y:y1},{x:x2,y:y1},{x:x2,y:y2},{x:x1,y:y2}];
}
function quadCorners(item){return item.type==='area'&&item.points?.length===4?item.points:rectCorners(item)}
function ellipseGeometry(item){
 const a=item.a||{x:0,y:0},b=item.b||a;
 const cx=(a.x+b.x)/2,cy=(a.y+b.y)/2,rx=Math.abs(a.x-b.x)/2;
 const ry=item.type==='circle'?rx:Math.abs(a.y-b.y)/2;
 return {cx,cy,rx:Math.max(1,rx),ry:Math.max(1,ry)};
}
function resizePoints(item){
 if(item.type==='area')return quadCorners(item);
 if(item.type==='rect')return rectCorners(item);
 if(item.type==='circle'||item.type==='ellipse'){
   const {cx,cy,rx,ry}=ellipseGeometry(item);
   return [{x:cx-rx,y:cy},{x:cx+rx,y:cy},{x:cx,y:cy-ry},{x:cx,y:cy+ry}];
 }
 return null;
}
function cumulativeSegment(item,index,transform){
 const pts=item.points||[];
 if(pts.length<2)return null;
 const origin=annotationProjectPoint(pts[0],transform),first=annotationProjectPoint(pts[1],transform);
 const dx=first.x-origin.x,dy=first.y-origin.y,d=Math.hypot(dx,dy)||1;
 const ux=dx/d,uy=dy/d;
 const point=annotationProjectPoint(pts[index+1]||pts[1],transform);
 const distance=(point.x-origin.x)*ux+(point.y-origin.y)*uy;
 return {from:origin,to:{x:origin.x+ux*distance,y:origin.y+uy*distance}};
}
function triangleArea(a,b,c){
 const v=[a,b,c].map(x=>Number(String(x||'').replace(',','.')));
 if(v.some(x=>!Number.isFinite(x)||x<=0))return null;
 const p=(v[0]+v[1]+v[2])/2;
 const t=p*(p-v[0])*(p-v[1])*(p-v[2]);
 return t>0?Math.sqrt(t):null;
}
function quadAreaFromMeasures(item){
 const sides=item.sideMeasures||[],diag=item.diagonal||'';
 const first=triangleArea(sides[0],sides[1],diag),second=triangleArea(sides[2],sides[3],diag);
 return first!==null&&second!==null?(first+second)/1000000:null;
}

// Pick a grip using only the candidate items and screen/world transform.
function nearestHandle(point,items,transform,onlyItem=null){
 // Slightly widen the middle move zone while retaining precise endpoint grips.
 const endpointFraction=.27;
 let best=null,dist=31;
 for(const item of items||[]){
  if(onlyItem&&item!==onlyItem)continue;
  if(['polyline','chain','cumulative','angle'].includes(item.type)&&Array.isArray(item.points)&&item.points.length>1){
   item.points.forEach((vertex,index)=>{
    const p=worldToScreen(vertex,transform),d=Math.hypot(point.x-p.x,point.y-p.y);
    const endpointZone=[item.points[index-1],item.points[index+1]].filter(Boolean).every(neighbor=>{
     const q=worldToScreen(neighbor,transform),dx=q.x-p.x,dy=q.y-p.y;
     return ((point.x-p.x)*dx+(point.y-p.y)*dy)/(dx*dx+dy*dy||1)<=endpointFraction;
    });
    if(endpointZone&&d<dist){best={item,key:'points',point:vertex,pointIndex:index,kind:'point'};dist=d}
   });continue;
  }
  if(item.type==='freehand')continue;
  const corners=resizePoints(item);
  if(corners){
   corners.forEach((vertex,index)=>{
    const p=worldToScreen(vertex,transform),d=Math.hypot(point.x-p.x,point.y-p.y);
    if(d<dist){best={item,key:'shape',point:vertex,pointIndex:index,kind:'shape-resize'};dist=d}
   });
   continue;
  }
  if(item.type==='target')continue;
  for(const key of ['a','b'])if(item[key]&&!(item.type==='note'&&key==='b')){
   const p=worldToScreen(item[key],transform),d=Math.hypot(point.x-p.x,point.y-p.y);
   const other=item[key==='a'?'b':'a'];
   let endpointZone=true;
   if(other&&['dimension','chain','cumulative','line','arrow','angle'].includes(item.type)){
    const q=worldToScreen(other,transform),dx=q.x-p.x,dy=q.y-p.y;
    const t=((point.x-p.x)*dx+(point.y-p.y)*dy)/(dx*dx+dy*dy||1);
    endpointZone=t<=endpointFraction;
   }
   if(endpointZone&&d<dist){best={item,key,point:item[key],kind:'point'};dist=d}
  }
 }
 return best;
}

const api=Object.freeze({screenToWorld,worldToScreen,boundsPoint,annotationProjectPoint,
 rectCorners,quadCorners,ellipseGeometry,resizePoints,cumulativeSegment,triangleArea,quadAreaFromMeasures,nearestHandle});
root.AnnotationGeometry=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
