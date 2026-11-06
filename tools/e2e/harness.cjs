'use strict';
const {chromium}=require('playwright'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const base=process.env.ZAMEROVAC_BASE_URL||process.argv[2]||'http://127.0.0.1:8765';
async function suite(name,body){
 const directory=path.resolve(process.env.ZAMEROVAC_E2E_DIR||'test-artifacts',name);fs.mkdirSync(directory,{recursive:true});
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const report={suite:name,sha:require('node:child_process').execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),startedAt:new Date().toISOString(),syntheticOnly:true,cases:[]};let failed=0;
 try{await body(async(title,test)=>{
  if(process.env.ZAMEROVAC_CASES&&!process.env.ZAMEROVAC_CASES.split(',').includes(title))return;
  const slug=title.replace(/[^a-z0-9_-]/gi,'_'),context=await browser.newContext({viewport:{width:600,height:950},hasTouch:true});
  await context.tracing.start({screenshots:true,snapshots:true,sources:true});const page=await context.newPage(),errors=[],logs=[];
  page.setDefaultTimeout(7000);page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')logs.push(m.text())});
  const result={name:title,status:'running',steps:[],evidence:[]};report.cases.push(result);
  const step=async(label,fn)=>{result.steps.push(label);return fn()};
  try{
   await page.goto(base);await test({page,step,evidence:value=>result.evidence.push(value),directory});await page.waitForTimeout(120);assert.deepEqual(errors,[],'JS runtime errors');
   await page.screenshot({path:path.join(directory,slug+'.png')});result.status='passed';await context.tracing.stop();
   console.log('PASS '+name+'/'+title);
  }catch(error){
   failed++;result.status='failed';result.error=String(error.stack||error);result.runtimeErrors=errors;result.consoleErrors=logs;
   await page.screenshot({path:path.join(directory,slug+'-failure.png'),fullPage:true}).catch(()=>{});
   const state=await page.evaluate(()=>({screen:typeof screen==='string'?screen:null,state:typeof state==='object'?state:null,view:typeof view==='object'?view:null,current:typeof current==='object'?current:null})).catch(()=>null);
   fs.writeFileSync(path.join(directory,slug+'-state.json'),JSON.stringify(state,null,2));
   fs.writeFileSync(path.join(directory,slug+'-dom.html'),await page.content().catch(()=>''));
   await context.tracing.stop({path:path.join(directory,slug+'-trace.zip')}).catch(()=>{});
   console.error('FAIL '+name+'/'+title+' at '+result.steps.at(-1)+': '+error.message);
  }finally{await context.close();fs.writeFileSync(path.join(directory,'report.json'),JSON.stringify(report,null,2))}
 })}finally{await browser.close()}
 assert(report.cases.length>0,'No matching test cases');
 assert.equal(failed,0,name+': failed '+failed+' cases; see '+directory);
}
async function createCanvas(page,name){
 await page.click('#createBtn');await page.locator('#newMenu .choice').filter({hasText:'Nový náčrt'}).click();await page.fill('#promptValue',name);await page.click('#okModal');
 await page.locator('.entry-title',{hasText:name}).click();
 // Fixture preferences only; every object and edit below goes through the real UI.
 await page.evaluate(()=>{prefs.snapPoints=false;prefs.snapGrid=false;prefs.snapHorizontal=false;prefs.snapCorners=false;prefs.snapContours=false;prefs.snapRightAngle=false;prefs.color='#f7dc27';prefs.loupe=true;save()});
}
async function chooseFiles(page,selector,files){const chooser=page.waitForEvent('filechooser');await page.click(selector);await(await chooser).setFiles(files);}
async function tool(page,type){await page.click('#toolsToggle');await page.locator('[data-tool="'+type+'"]').click()}
async function drag(page,a,b){const r=await page.locator('#drawCanvas').boundingBox();await page.mouse.move(r.x+a.x,r.y+a.y);await page.mouse.down();await page.mouse.move(r.x+b.x,r.y+b.y,{steps:12});await page.mouse.up()}
async function clickAt(page,p){const r=await page.locator('#drawCanvas').boundingBox();await page.mouse.click(r.x+p.x,r.y+p.y)}
async function editSelected(page){await page.click('#editorTopMenu');await page.getByText('Upravit vybranou kótu',{exact:true}).click()}
async function redo(page){await page.click('#editorMore');await page.locator('[data-extra="redo"]').click();await page.click('#editorMore')}
async function record(page){return page.evaluate(()=>JSON.parse(JSON.stringify(current.items[0])))}
async function projected(page,p){return page.evaluate(p=>({x:p.x*view.zoom+view.dx,y:p.y*view.zoom+view.dy}),p)}
function midpoint(a,b,t=.5){return {x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t}}
module.exports={suite,assert,createCanvas,chooseFiles,tool,drag,clickAt,editSelected,redo,record,projected,midpoint};
