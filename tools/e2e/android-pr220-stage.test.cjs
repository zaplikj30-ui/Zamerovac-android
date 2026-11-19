'use strict';
const assert=require('node:assert/strict');
const {stageImage}=require('./android-pr220-compare.cjs');
const uri='content://media/external/images/media/123';
function mock(inserted,query){
 const calls=[];
 const adb=(...args)=>{calls.push(args);if(args[2]==='insert')return inserted;
  if(args[2]==='query')return query;return '';};
 return {adb,calls};
}
const good=mock('Inserted '+uri,'_display_name=pr220-synthetic.png');
assert.equal(stageImage(good.adb,'fixture.png'),uri);
assert.equal(good.calls[0][0],'push');
assert(good.calls.some(args=>args[2]==='insert'&&args.includes('relative_path:s:Pictures/')));
assert(good.calls.some(args=>args[1]==='sh'&&args[3]==='content write --uri '+uri+' < /data/local/tmp/pr220-synthetic.png'));
assert.throws(()=>stageImage(mock('Failure','').adb,'fixture.png'));
assert.throws(()=>stageImage(mock('Inserted '+uri,'').adb,'fixture.png'));
console.log('PASS MediaStore staging mocks: success, insert failure, missing query');
