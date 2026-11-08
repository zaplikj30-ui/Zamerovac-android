/* B5: selection decision independent from canvas, Android and persisted state. */
(function(root){
'use strict';
function dragHandle(candidate,{wantsCaption=false,grip=null,label=null,segmentLabel=null,targetCaption=false}={}){
 if(wantsCaption)return {item:candidate,kind:'note-caption'};
 if(grip?.item.id===candidate.id)return grip;
 if(candidate.type==='target'&&candidate.b&&targetCaption)return {item:candidate,kind:'target-caption'};
 if(segmentLabel?.item.id===candidate.id)return segmentLabel;
 if(label?.item.id===candidate.id)return label;
 if(['chain','cumulative','angle','area'].includes(candidate.type)&&candidate.points?.length>1)
  return {item:candidate,kind:'move-polyline'};
 if(['dimension','chain','cumulative','line','arrow','angle','target','rect','circle','ellipse'].includes(candidate.type))
  return {item:candidate,kind:'move-dimension'};
 if(candidate.type==='polyline'||candidate.type==='freehand')return {item:candidate,kind:'move-polyline'};
 return {item:candidate,kind:'open-selected'};
}
const api=Object.freeze({dragHandle});
root.AnnotationSelection=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
