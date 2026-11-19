'use strict';
const assert=require('node:assert/strict');
const {stageImage,selectStagedImage,mediaUri,filename}=require('./android-pr220-compare.cjs');
const uri='content://media/external/images/media/123';
function mock(query,{existing=false,writeFails=false}={}){
 const calls=[];
 let inserted=existing;
 const adb=(...args)=>{calls.push(args);if(args[2]==='insert')inserted=true;
  if(args[1]==='sh'&&writeFails)throw Error('write failed');
  if(args[2]==='query')return args[4]===uri? '_display_name='+filename:inserted?query:'';return '';};
 return {adb,calls};
}
const good=mock('Row: 0 _id=123, _display_name='+filename);
assert.equal(stageImage(good.adb,'fixture.png'),uri);
assert.equal(good.calls[0][0],'push');
assert(good.calls.some(args=>args[2]==='insert'&&args.includes('relative_path:s:Pictures/')));
assert(good.calls.some(args=>args[1]==='sh'&&args[3]==='content write --uri '+uri+' < /data/local/tmp/'+filename));
assert.throws(()=>stageImage(mock('').adb,'fixture.png'));
const existing=mock('Row: 0 _id=123, _display_name='+filename,{existing:true});
assert.throws(()=>stageImage(existing.adb,'fixture.png'));
assert(!existing.calls.some(args=>args[2]==='delete'));
const writeFailure=mock('Row: 0 _id=123, _display_name='+filename,{writeFails:true});
assert.throws(()=>stageImage(writeFailure.adb,'fixture.png'),/write failed/);
assert(writeFailure.calls.some(args=>args[2]==='delete'&&args[4]===uri));
assert.throws(()=>mediaUri(mock('Row: 0 _id=123, _display_name=wrong.png').adb,filename));
assert.throws(()=>mediaUri(mock('Row: 0 _id=123, _display_name='+filename+'\nRow: 1 _id=124, _display_name='+filename).adb,filename));
const node=label=>`<node text="${label}" bounds="[10,20][50,60]"/>`;
function picker(initial,afterRoots,afterImages){
 const taps=[];
 const adb=(...args)=>{
  if(args[1]==='cat')return taps.length===0?initial:taps.length===1?afterRoots:afterImages;
  if(args[1]==='input')taps.push(args.slice(3));
  return '';
 };
 return {adb,taps};
}
const direct=picker(node(filename));
assert.deepEqual(selectStagedImage(direct.adb),['30','40']);
assert.equal(direct.taps.length,0);
const images=picker(node('Show roots'),node('Images'),node(filename));
assert.deepEqual(selectStagedImage(images.adb),['30','40']);
assert.equal(images.taps.length,2);
assert.throws(()=>selectStagedImage(picker(node('Downloads')).adb),/navigation unavailable/);
assert.throws(()=>selectStagedImage(picker(node('Show roots'),node('Downloads')).adb),/Images location unavailable/);
assert.throws(()=>selectStagedImage(picker(node('Show roots'),node('Images'),node('Downloads')).adb),/fixture not visible/);
console.log('PASS MediaStore staging mocks: success, insert failure, missing query');
