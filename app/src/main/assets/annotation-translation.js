/* B6: stateless translation of complete dimension/polyline geometry.
 * Editor keeps gestures, history, precise measured values and persistence.
 */
(function(root){
'use strict';
function translatedEndpoints(a,b,delta,view,photoSize){
 const dx=Math.max(-Math.min(a.x,b.x),Math.min(delta.x/view.zoom,photoSize.w-Math.max(a.x,b.x)));
 const dy=Math.max(-Math.min(a.y,b.y),Math.min(delta.y/view.zoom,photoSize.h-Math.max(a.y,b.y)));
 return {a:{x:a.x+dx,y:a.y+dy},b:{x:b.x+dx,y:b.y+dy}};
}
function translatedPolyline(points,delta,view,photoSize){
 const dx=delta.x/view.zoom,dy=delta.y/view.zoom;
 const minX=Math.min(...points.map(p=>p.x)),maxX=Math.max(...points.map(p=>p.x));
 const minY=Math.min(...points.map(p=>p.y)),maxY=Math.max(...points.map(p=>p.y));
 const shiftX=Math.max(-minX,Math.min(dx,photoSize.w-maxX));
 const shiftY=Math.max(-minY,Math.min(dy,photoSize.h-maxY));
 const translated=points.map(p=>({x:p.x+shiftX,y:p.y+shiftY}));
 return {points:translated,a:{...translated[0]},b:{...translated[translated.length-1]}};
}
const api=Object.freeze({translatedEndpoints,translatedPolyline});
root.AnnotationTranslation=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
