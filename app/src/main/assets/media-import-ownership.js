/* N4-A: persist importer ownership before publishing; deletion requires a future GC audit. */
(function(root){
'use strict';
const DB='zamerovac-import-ownership',STORE='imports';
const valid=id=>typeof id==='string'&&/^[a-zA-Z0-9_-]{3,120}$/.test(id);
let opening=null;
function database(){
 if(!opening)opening=new Promise((resolve,reject)=>{
  if(!root.indexedDB){reject(new Error('Evidence příloh není dostupná'));return}
  const req=root.indexedDB.open(DB,1);
  req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE)};
  req.onsuccess=()=>{const db=req.result;db.onversionchange=()=>{db.close();opening=null};resolve(db)};
  req.onerror=()=>reject(req.error||new Error('Evidence příloh nebyla otevřena'));
  req.onblocked=()=>reject(new Error('Evidence příloh je blokována'));
 }).catch(err=>{opening=null;throw err});
 return opening;
}
async function transaction(mode,action){
 const db=await database();
 return new Promise((resolve,reject)=>{
  const tx=db.transaction(STORE,mode);let result=null;
  tx.oncomplete=()=>resolve(result);
  tx.onerror=()=>reject(tx.error||new Error('Evidence příloh nebyla potvrzena'));
  tx.onabort=()=>reject(tx.error||new Error('Evidence příloh byla přerušena'));
  action(tx.objectStore(STORE),value=>{result=value},tx);
 });
}
function validate(id,owner){if(!valid(id)||!valid(owner))throw new Error('Neplatný vlastník přílohy')}
async function reserve(id,owner){
 validate(id,owner);
 // Fail closed: a durable receipt precedes writing any media bytes.
 return transaction('readwrite',(store,set)=>{store.add({owner,phase:'reserved'},id);set(true)});
}
async function published(id,owner){
 validate(id,owner);
 return transaction('readwrite',(store,set,tx)=>{
  const req=store.get(id);
  req.onsuccess=()=>{
   if(!req.result||req.result.owner!==owner){tx.abort();return}
   store.put({owner,phase:'published'},id);set(true);
  };
 });
}
async function inspect(id){
 if(!valid(id))return null;
 return transaction('readonly',(store,set)=>{
  const req=store.get(id);req.onsuccess=()=>set(req.result||null);
 });
}
const api=Object.freeze({reserve,published,inspect});
root.MediaImportOwnership=api;
if(typeof module==='object'&&module.exports)module.exports=api;
})(typeof globalThis!=='undefined'?globalThis:this);
