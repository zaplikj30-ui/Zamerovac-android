/* B7: pure size change of a measured polygon, rectangle, circle or ellipse.
 * No DOM, editor state, persistence, precision or original-media mutation.
 */
(function(root){
'use strict';
function resizedShape(item,index,target,geometry){
 if(item.type==='area'){
  const points=geometry.quadCorners(item).map(p=>({...p}));
  points[index]=target;
  return {points,a:{...points[0]},b:{...points[2]}};
 }
 if(item.type==='rect'){
  const corners=geometry.rectCorners(item),opposite=corners[(index+2)%4];
  return {
   a:{x:Math.min(target.x,opposite.x),y:Math.min(target.y,opposite.y)},
   b:{x:Math.max(target.x,opposite.x),y:Math.max(target.y,opposite.y)}
  };
 }
 const g=geometry.ellipseGeometry(item);
 let rx=g.rx,ry=g.ry;
 if(item.type==='circle'){
  const radius=Math.max(1,index<2?Math.abs(target.x-g.cx):Math.abs(target.y-g.cy));
  rx=radius;ry=radius;
 }else if(index<2)rx=Math.max(1,Math.abs(target.x-g.cx));
 else ry=Math.max(1,Math.abs(target.y-g.cy));
 return {a:{x:g.cx-rx,y:g.cy-ry},b:{x:g.cx+rx,y:g.cy+ry}};
}
const api=Object.freeze({resizedShape});
root.AnnotationResize=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
