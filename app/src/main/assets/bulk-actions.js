/* Multiple file selection – opt-in by long press, preserving the classic single-item UI. */
'use strict';
(function(){
 let active=false,lastFolder=null;
 const selectedIds=new Set();
 const list=()=>[...selectedIds].map(id=>recById(id)).filter(Boolean);
 const hasLocked=()=>list().some(r=>window.isRecordLocked?.(r)||
   state.records.some(x=>!x.deleted&&x.id!==r.id&&folderContains(r.id,x.id)&&window.isRecordLocked?.(x)));
 function onlyRoots(){
   const ids=new Set(selectedIds);
   return list().filter(r=>{
     let p=r.parentId,seen=new Set();
     while(p&&!seen.has(p)){if(ids.has(p))return false;seen.add(p);p=recById(p)?.parentId}
     return true;
   });
 }
 function finish(){
   active=false;selectedIds.clear();showFolder();
 }
 function toggle(id){
   if(selectedIds.has(id))selectedIds.delete(id);else selectedIds.add(id);
   active=selectedIds.size>0;showFolder();
 }
 function actions(){
   const toolbar=document.getElementById('bulkToolbar');
   if(!toolbar)return;
   toolbar.hidden=!active;
   if(!active)return;
   toolbar.innerHTML='<strong>Vybráno: '+selectedIds.size+'</strong>'+
    '<button type="button" data-bulk="all">Vybrat vše</button>'+
    '<button type="button" data-bulk="move">Přesunout</button>'+
    '<button type="button" data-bulk="copy">Kopírovat</button>'+
    '<button type="button" data-bulk="delete">Smazat</button>'+
    '<button type="button" data-bulk="zip">Exportovat do ZIP</button>'+
    '<button type="button" data-bulk="customer">Pro zákazníka: PDF ZIP</button>'+
    '<button type="button" data-bulk="cancel">Zrušit</button>';
   toolbar.querySelectorAll('[data-bulk]').forEach(b=>b.onclick=()=>handle(b.dataset.bulk));
 }
 function optionsHTML(){
   const ids=new Set(onlyRoots().map(r=>r.id));
   const folders=state.records.filter(x=>x.kind==='folder'&&!x.deleted);
   return '<label for="bulkWhere">Cílová složka</label><select id="bulkWhere"><option value="">Kořen</option>'+
    folders.map(f=>{
     const forbidden=window.isRecordLocked?.(f)||[...ids].some(id=>id===f.id||folderContains(id,f.id));
     return '<option value="'+escapeHtml(f.id)+'" '+(forbidden?'disabled':'')+'>'+
       escapeHtml(f.title)+(forbidden?' 🔒':'')+'</option>';
    }).join('')+'</select>';
 }
 function cloneSelected(destination){
   const roots=onlyRoots();
   const all=[];
   const seen=new Set();
   function walk(r){
     if(seen.has(r.id))return;seen.add(r.id);all.push(r);
     if(r.kind==='folder')state.records.filter(x=>!x.deleted&&x.parentId===r.id).forEach(walk);
   }
   roots.forEach(walk);
   const ids=new Map();
   for(const r of all)ids.set(r.id,uid());
   const copies=all.map(r=>{
     const copy=JSON.parse(JSON.stringify(r));
     copy.id=ids.get(r.id);
     copy.parentId=ids.get(r.parentId)||(roots.some(root=>root.id===r.id)?destination:r.parentId);
     if(roots.some(root=>root.id===r.id))copy.title='Kopie – '+copy.title;
     if(Array.isArray(copy.items))copy.items.forEach(item=>{
       if(item.id)item.id=uid();
       if(Array.isArray(item.detailItems))item.detailItems.forEach(child=>{if(child.id)child.id=uid()});
     });
     copy.createdAt=new Date().toISOString();copy.deleted=false;copy.locked=false;
     touch(copy);return copy;
   });
   state.records.push(...copies);
 }
 function handle(action){
   if(action==='cancel'){finish();return}
   if(action==='all'){
     state.records.filter(r=>!r.deleted&&r.parentId===currentFolder).forEach(r=>selectedIds.add(r.id));
     active=selectedIds.size>0;showFolder();return;
   }
   if(!selectedIds.size){notify('Nejdřív označ soubory');return}
   if(action==='customer'){window.openCustomerExport?.(onlyRoots().map(r=>r.id));return}
   if(hasLocked()){
     notify('Nejdříve odemkněte složku.');return;
   }
   if(action==='move'||action==='copy'){
     modal(action==='move'?'Hromadně přesunout':'Hromadně kopírovat',
       '<p>Vybráno: '+selectedIds.size+'</p>'+optionsHTML(),()=>{
        const dest=$('bulkWhere').value||null;
        if(!canWriteToFolder(dest)||onlyRoots().some(r=>dest&&(dest===r.id||folderContains(r.id,dest)))){
          notify('Nejdříve odemkněte složku nebo vyber jiné umístění.');return false;
        }
        if(action==='move')onlyRoots().forEach(r=>{r.parentId=dest;touch(r)});
        else cloneSelected(dest);
        save();finish();
       },action==='move'?'Přesunout':'Kopírovat');
     return;
   }
   if(action==='delete'){
     modal('Hromadné odstranění','Přesunout '+selectedIds.size+' označených položek do koše?',()=>{
       onlyRoots().forEach(r=>markDeleted(r.id));save();finish();
     },'Odstranit');
     return;
   }
   if(action==='zip'){
     if(!native||typeof Native.exportSelection!=='function'){
       notify('Společný ZIP vyžaduje aktuální Android aplikaci');return;
     }
     modal('Hromadný export ZIP',
       '<p>Vytvořit jeden ZIP z '+selectedIds.size+' označených položek včetně jejich podsložek, editovatelných kót a příloh?</p>',()=>{
       Native.exportSelection(JSON.stringify(onlyRoots().map(r=>r.id)));
       finish();
     },'Exportovat do ZIP');
   }
 }
 const oldShow=showFolder;
 showFolder=function(){
   if(lastFolder!==currentFolder){lastFolder=currentFolder;selectedIds.clear();active=false}
   oldShow();
   const browser=$('browserView');
   let toolbar=document.getElementById('bulkToolbar');
   if(!toolbar){toolbar=document.createElement('div');toolbar.id='bulkToolbar';toolbar.className='bulk-toolbar';toolbar.hidden=true;browser.insertBefore(toolbar,$('items'))}
   actions();
   $('items').querySelectorAll('.entry').forEach(entry=>{
     const id=entry.dataset.id;
     if(selectedIds.has(id)){entry.classList.add('bulk-selected');entry.setAttribute('aria-selected','true')}
     if(active){
       entry.onclick=e=>{e.preventDefault();toggle(id)};
       entry.querySelector('.entry-more')?.setAttribute('aria-label','Přidat nebo odebrat z výběru');
     }else{
       let pressTimer=null,start=null;
       const clear=()=>{if(pressTimer!==null){clearTimeout(pressTimer);pressTimer=null}};
       entry.addEventListener('pointerdown',e=>{
         if(e.target.closest('[data-more]'))return;
         start={x:e.clientX,y:e.clientY};
         clear();pressTimer=setTimeout(()=>{pressTimer=null;active=true;selectedIds.add(id);showFolder()},550);
       });
       entry.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>12)clear()});
       ['pointerup','pointercancel','pointerleave'].forEach(type=>entry.addEventListener(type,clear));
       entry.addEventListener('contextmenu',e=>{if(e.target.closest('[data-more]'))return;e.preventDefault();clear();active=true;selectedIds.add(id);showFolder()});
     }
   });
 };
})();
