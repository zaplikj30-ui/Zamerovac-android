/* Native DB commits may arrive while the user is drawing or filling a measurement form.
 * Defer only the UI callback; acknowledged CAS still reconciles against the latest native disk. */
(function(root){
'use strict';
let pending=null,flushTimer=null;
function editing(){
 if(typeof pointers!=='undefined'&&pointers.size)return true;
 if(typeof drawStart!=='undefined'&&drawStart)return true;
 if(typeof polylineDraft!=='undefined'&&polylineDraft.length)return true;
 if(root.__detailParent)return true;
 if(typeof screen==='string'&&screen==='note'&&noteActive)return true;
 if(!document.getElementById('modal')?.hidden)return true;
 const focused=document.activeElement;
 return !!focused?.matches('input,textarea,select,[contenteditable="true"]')&&!!focused.closest('#modal:not([hidden]),#noteView:not([hidden])');
}
const previousSync=root.onNativeSync;
function receive(text){if(typeof native!=='undefined'&&!native)return previousSync(text);let data=false;try{data=!!JSON.parse(text).data;}catch(error){}if(data&&editing()){pending=text;return true;}if(data)pending=null;return previousSync(text);}
function flush(){clearTimeout(flushTimer);flushTimer=setTimeout(()=>{if(pending&&!editing()){const text=pending;pending=null;receive(text);}},0);}
root.onNativeSync=receive;
for(const event of ['pointerup','pointercancel','lostpointercapture','focusout','change','click'])window.addEventListener(event,flush,{capture:true});
const previousBack=root.handleAndroidBack;root.handleAndroidBack=function(){try{return previousBack();}finally{flush();}};
})(window);
