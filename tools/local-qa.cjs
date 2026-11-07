'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawnSync}=require('node:child_process');
const root=path.resolve(__dirname,'..'),mode=process.argv[2]||'--quick';
if(!['--quick','--native','--help'].includes(mode)){console.error('Použití: node tools/local-qa.cjs [--quick | --native]');process.exit(2)}
if(mode==='--help'){console.log('Rychlé Node/Python testy nebo --native také Gradle JVM, nikdy APK.');process.exit(0)}
const base=path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'.local','share'),'Zamerovac-QA','results');
const dir=path.join(base,'qa-'+new Date().toISOString().replace(/[:.]/g,'-'));fs.mkdirSync(dir,{recursive:true});
const results=[];let num=0;
function record(name,status,detail){results.push({name,status,detail});console.log(status+' '+name+' '+detail)}
function run(name,cmd,args,timeout=720000){
 const file=String(++num).padStart(3,'0')+'.log',at=Date.now();
 const r=spawnSync(cmd,args,{cwd:root,encoding:'utf8',shell:false,windowsHide:true,timeout,maxBuffer:24*1024*1024,env:{...process.env,CI:'1'}});
 const output=(r.stdout||'')+(r.stderr||'');fs.writeFileSync(path.join(dir,file),output,'utf8');
 const ok=!r.error&&r.status===0;
 record(name,ok?'PASS':'FAIL',file+' ('+Math.round((Date.now()-at)/1000)+' s)'+(r.error?' '+r.error.message:''));
 if(!ok)console.error(output.slice(-1600));
}
function files(p){const dir=path.join(root,p);if(!fs.existsSync(dir))throw Error('Chybí '+p);return fs.readdirSync(dir).filter(x=>x.endsWith('.js')).sort().map(x=>p+'/'+x)}
function python(){for(const [cmd,args,prefix] of (process.platform==='win32'?[['py',['-3','--version'],['-3']],['python',['--version'],[]]]:[['python3',['--version'],[]],['python',['--version'],[]]])){
 const r=spawnSync(cmd,args,{encoding:'utf8',shell:false,windowsHide:true,timeout:15000});if(!r.error&&r.status===0)return [cmd,prefix];}return null}
try{
 for(const f of [...files('app/src/main/assets'),...files('sync')])run('syntax '+f,process.execPath,['--check',f]);
 run('registr QA',process.execPath,['tools/qa/audit.cjs']);
 run('Android focus/ANR model',process.execPath,['tools/check-android-window.cjs']);
 for(const f of files('tests'))run('test '+f,process.execPath,[f]);
 const py=python();if(py)run('Python unittest',py[0],[...py[1],'-m','unittest','discover','-s','tests','-p','test_*.py','-v']);else record('Python unittest','FAIL','Python 3 není dostupný');
 if(mode==='--native'){
  const gradle=process.platform==='win32'?'cmd.exe':'gradle',cmd=process.platform==='win32'?['/d','/c','gradle.bat']:[];
  run('Gradle Drive config',gradle,[...cmd,'--no-daemon','-p','tools/drive-config-checks','verify'],1200000);
  run('Gradle JVM',gradle,[...cmd,'--no-daemon',':app:verifyDriveRegistration',':app:compilePreviewJavaWithJavac',':app:testPreviewUnitTest','-PdriveRequireConfigured=true'],2400000);
 }else record('Gradle JVM','NOT RUN','jen v režimu --native');
}catch(e){record('Spouštěč','FAIL',String(e.stack||e))}
record('Chromium E2E','NOT RUN','zatím nepřipojené');
record('Fyzický Samsung','NOT RUN','vyžaduje samostatnou Android/ADB etapu');
record('APK','NOT RUN','žádné sestavení ani instalace');
const report={schema:1,mode,created:new Date().toISOString(),results,counts:{}};
for(const state of ['PASS','FAIL','SKIP','NOT RUN'])report.counts[state]=results.filter(x=>x.status===state).length;
fs.writeFileSync(path.join(dir,'results.json'),JSON.stringify(report,null,2)+'\n','utf8');
console.log('Lokální výsledky: '+dir);console.log('Součet: '+JSON.stringify(report.counts));
if(report.counts.FAIL)process.exitCode=1;
