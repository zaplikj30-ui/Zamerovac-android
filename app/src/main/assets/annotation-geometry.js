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

// B9: pure magnetic/grid/axis snapping; all state is supplied by the editor.
// Do not change the distance/order rules, especially when detaching a point.
function snapPoint(p,ref,ignore,items,prefs,zoomLevel,imageSize){
 p=boundsPoint({...p},imageSize);
 const step=Math.max(5,Number(prefs.gridStep)||40),zoom=Math.max(.05,zoomLevel);
 const pointDistance=12/zoom;
 if(prefs.snapGrid){
  const gridDistance=Math.min(11/zoom,step*.22);
  const gx=Math.round(p.x/step)*step,gy=Math.round(p.y/step)*step;
  if(Math.abs(gx-p.x)<gridDistance)p.x=gx;
  if(Math.abs(gy-p.y)<gridDistance)p.y=gy;
 }
 if(prefs.snapPoints){
  let best=null,bestDistance=pointDistance;
  for(const item of items||[]){
   // Vlastní kóta nesmí přichytávat svůj konec k druhému vlastnímu konci.
   if(ignore?.item===item)continue;
   for(const candidate of [item.a,item.b,...(item.points||[])]){
    if(!candidate)continue;
    const distance=Math.hypot(candidate.x-p.x,candidate.y-p.y);
    if(distance<bestDistance){bestDistance=distance;best=candidate}
   }
  }
  if(best)p={...best};
 }
 if(prefs.snapHorizontal&&ref){
  if(Math.abs(p.y-ref.y)<pointDistance)p.y=ref.y;
  if(Math.abs(p.x-ref.x)<pointDistance)p.x=ref.x;
 }
 return boundsPoint(p,imageSize);
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

// Stage B4: state-free hit geometry and segment projection.
function segmentLineScreen(item,index,transform){
 const pts=item.points||[];
 if(['chain','cumulative','polyline'].includes(item.type)){
  if(index<0||index>=pts.length-1)return null;
  const projected=item.type==='cumulative'&&typeof cumulativeSegment==='function'?cumulativeSegment(item,index,transform):null;
  const a=projected?.from||worldToScreen(pts[index],transform),b=projected?.to||worldToScreen(pts[index+1],transform);
  const dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1;
  const off=['chain','cumulative'].includes(item.type)?(Number(item.offset)||0)+(item.type==='cumulative'?index*26:0):0;
  return {a:{x:a.x-dy/d*off,y:a.y+dx/d*off},b:{x:b.x-dy/d*off,y:b.y+dx/d*off}};
 }
 if(item.type==='angle'&&pts.length>=3)return {a:worldToScreen(pts[1],transform),b:worldToScreen(pts[index===0?0:2],transform)};
 if(item.type==='area'){
  const corners=quadCorners(item);return {a:worldToScreen(corners[index],transform),b:worldToScreen(corners[(index+1)%4],transform)};
 }
 if(item.type==='rect'){
  const corners=rectCorners(item);return {a:worldToScreen(corners[index],transform),b:worldToScreen(corners[index+1],transform)};
 }
 return null;
}

function nearestItem(point,items,transform,captionHit=()=>false){
 const world=screenToWorld(point,transform);
 let best=null,distance=26/transform.zoom;
 for(const item of [...(items||[])].reverse()){
  if((item.type==='note'||item.type==='symbol')&&item.a){
   if(captionHit(item,point))return item;
  }
  if((['polyline','chain','cumulative','angle','freehand'].includes(item.type))&&Array.isArray(item.points)&&item.points.length>1){
   for(let i=1;i<item.points.length;i++){
    const line=['chain','cumulative'].includes(item.type)?segmentLineScreen(item,i-1,transform):null;
    const a=line?screenToWorld(line.a,transform):item.points[i-1],b=line?screenToWorld(line.b,transform):item.points[i],dx=b.x-a.x,dy=b.y-a.y;
    const t=Math.max(0,Math.min(1,((world.x-a.x)*dx+(world.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    const d=Math.hypot(world.x-a.x-t*dx,world.y-a.y-t*dy);
    if(d<distance){best=item;distance=d}
   }
   continue;
  }
  if(item.type==='circle'||item.type==='ellipse'){
   const g=ellipseGeometry(item),dx=world.x-g.cx,dy=world.y-g.cy;
   const norm=Math.sqrt(dx*dx/(g.rx*g.rx)+dy*dy/(g.ry*g.ry));
   const d=norm<.32?Math.hypot(dx,dy):Math.abs(norm-1)*Math.min(g.rx,g.ry);
   if(d<distance){best=item;distance=d}continue;
  }
  if(item.type==='area'||item.type==='rect'){
   const corners=(item.type==='area'?quadCorners(item):rectCorners(item));
   let inside=false,edgeDist=Infinity;
   for(let i=0,j=corners.length-1;i<corners.length;j=i++){
    const a=corners[j],b=corners[i],dx=b.x-a.x,dy=b.y-a.y;
    if(((a.y>world.y)!=(b.y>world.y))&&(world.x<(b.x-a.x)*(world.y-a.y)/(b.y-a.y)+a.x))inside=!inside;
    const t=Math.max(0,Math.min(1,((world.x-a.x)*dx+(world.y-a.y)*dy)/(dx*dx+dy*dy||1)));
    edgeDist=Math.min(edgeDist,Math.hypot(world.x-a.x-t*dx,world.y-a.y-t*dy));
   }
   if(inside||edgeDist<distance){best=item;distance=0}continue;
  }
  if(item.type==='target'&&item.a){
   const center=item.a,label=item.b||{x:center.x+30,y:center.y};
   const d=Math.min(Math.hypot(world.x-center.x,world.y-center.y),Math.hypot(world.x-label.x,world.y-label.y));
   if(d<distance){best=item;distance=d}continue;
  }
  const a=item.a,b=item.b;
  if(a&&b){
   let ux=b.x-a.x,uy=b.y-a.y,den=ux*ux+uy*uy||1;
   // Testovat viditelnou odsazenou kótovací čáru, nejen geometrii pod ní.
   let shift=0;
   if(['dimension','chain','cumulative'].includes(item.type))
    shift=(Number(item.offset)||0)/Math.max(0.0001,transform.zoom);
   const lineLength=Math.hypot(ux,uy)||1;
   const ax=a.x-uy/lineLength*shift,ay=a.y+ux/lineLength*shift;
   let t=Math.max(0,Math.min(1,((world.x-ax)*ux+(world.y-ay)*uy)/den));
   let d=Math.hypot(world.x-ax-t*ux,world.y-ay-t*uy);
   if(d<distance){best=item;distance=d}
  }else if(a){
   let d=Math.hypot(a.x-world.x,a.y-world.y);
   if(d<distance){best=item;distance=d}
  }
 }
 return best;
}

// B5: side-effect-free selected measuring segment.
function nearestEditableSegment(candidate,s,transform){
 if(!['chain','cumulative','polyline','area','angle','rect'].includes(candidate.type))return null;
    const count=candidate.type==='area'||candidate.type==='rect'?4:
     candidate.type==='angle'?2:Math.max(0,(candidate.points?.length||0)-1);
    let nearest=0,dist=Infinity;
    for(let i=0;i<count;i++){
      let line=null;
      if(candidate.type==='rect'){
        const corners=rectCorners(candidate).map(p=>worldToScreen(p,transform));
        line={a:corners[i],b:corners[(i+1)%4]};
      }else line=segmentLineScreen(candidate,i,transform);
      if(!line)continue;
      const a=line.a,b=line.b,dx=b.x-a.x,dy=b.y-a.y;
      const t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.y-a.y)*dy)/(dx*dx+dy*dy||1)));
      const d=Math.hypot(s.x-a.x-t*dx,s.y-a.y-t*dy);
      if(d<dist){dist=d;nearest=i}
    }
    return candidate.type==='rect'?nearest%2:nearest;
}

const api=Object.freeze({screenToWorld,worldToScreen,boundsPoint,annotationProjectPoint,
 rectCorners,quadCorners,ellipseGeometry,resizePoints,cumulativeSegment,triangleArea,quadAreaFromMeasures,snapPoint,nearestHandle,segmentLineScreen,nearestItem,nearestEditableSegment});
root.AnnotationGeometry=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
