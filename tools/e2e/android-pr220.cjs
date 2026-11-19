'use strict';
const assert=require('node:assert/strict');
const {execFileSync}=require('node:child_process');
const {existsSync,readdirSync}=require('node:fs');
const path=require('node:path');
const { _android: android }=require('playwright');

const pkg='cz.zamerovac.app.preview';
const scope=process.env.QA_SCOPE;
const serial=process.env.ANDROID_SERIAL;
function exec(bin,args,timeout=15000){
 return execFileSync(bin,args,{encoding:'utf8',timeout}).trim();
}
const adb=(...args)=>exec('adb',['-s',serial,...args],30000);
function preview(tree){
 const apk=path.resolve(tree,'app/build/outputs/apk/preview/app-preview.apk');
 assert(existsSync(apk),'Preview APK missing');
 const sdk=process.env.ANDROID_SDK_ROOT||process.env.ANDROID_HOME;
 const buildTools=path.join(sdk,'build-tools');
 const version=readdirSync(buildTools).filter(v=>/^\d+\.\d+\.\d+$/.test(v)).sort((a,b)=>b.localeCompare(a,undefined,{numeric:true}))[0];
 assert(version,'Android Build Tools missing');
 const tool=name=>path.join(buildTools,version,name);
 assert.match(exec(tool('aapt'),['dump','badging',apk]),/^package: name='cz\.zamerovac\.app\.preview'/);
 assert.match(exec(tool('apksigner'),['verify','--print-certs',apk]),/certificate SHA-256 digest: [a-f0-9]{64}/);
 console.log('APK digest',tree,exec('sha256sum',[apk]).split(/\s/)[0]);
 return apk;
}
async function open(device,apk){
 assert.equal(adb('install','-r','-t',apk),'Success');
 assert.equal(adb('shell','pm','clear',pkg),'Success');
 assert.match(adb('shell','am','start','-W','-n',pkg+'/cz.zamerovac.app.MainActivity'),/^Status: ok$/m);
 const webview=await device.webView({pkg},{timeout:20000});
 const page=await webview.page();
 page.setDefaultTimeout(8000);
 await page.locator('#createBtn').waitFor({state:'visible'});
 assert(await page.evaluate(()=>typeof Native==='object'&&native),'Native bridge missing');
 if(await page.locator('#okModal').isVisible())await page.click('#okModal');
 return page;
}
(async()=>{
 assert(['launch','compare'].includes(scope));
 assert(/^emulator-\d+$/.test(serial||''),'Expected the hosted emulator serial');
 assert.equal(adb('get-state'),'device');
 assert.equal(adb('shell','getprop','sys.boot_completed'),'1');
 assert.equal(adb('shell','getprop','ro.build.version.sdk'),'33');
 const devices=await android.devices();
 const device=devices.find(d=>d.serial()===serial);
 assert(device,'Playwright could not find the ADB emulator');
 try{
  const after=preview('qa-after');
  if(scope==='launch'){
   await open(device,after);
   console.log('PASS Android 13 boot, ADB, verified preview APK, launcher and Native WebView');
  }else{
   const {compare}=require('./android-pr220-compare.cjs');
   await compare({device,adb,open,apks:{before:preview('qa-before'),after}});
  }
 }finally{
  await device.close()
 }
})().catch(error=>{
 console.error('FAIL Android PR220:',error.message);
 process.exitCode=1;
});
