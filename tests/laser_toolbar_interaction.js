/* Regresní simulace automatického měření Bosch a dotykového rozbalení. */
const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
function laser(){
 const photo={items:[{id:'kota',type:'dimension',unit:'mm',measure:''},{id:'poznamka',type:'note',text:'text'},{id:'uhel',type:'angle',measure:'45',unit:'°'}]};
 let saves=0,undo=0,selected='kota',locked=false;
 const scope={window:{isRecordLocked:()=>locked},screen:'editor',current:photo,prefs:{unit:'mm'},
  notify:()=>{},$:()=>({hidden:true}),checkpoint:()=>undo++,commitEditor:()=>saves++};
 Object.defineProperty(scope,'selected',{get(){return selected},set(x){selected=x}});
 vm.createContext(scope);
 vm.runInContext(fs.readFileSync('app/src/main/assets/laser-autofill.js','utf8'),scope);
 const measure=(v,u)=>scope.window.__handleLaserAuto(v,u);
 assert.equal(measure('2.437','m'),true);
 assert.equal(photo.items[0].measure,'2437');
 assert.equal(saves,1);
 measure('2.437','m');assert.equal(saves,1);
 measure('245.2','cm');assert.equal(photo.items[0].measure,'2452');
 selected='poznamka';measure('200','mm');assert.equal(photo.items[1].text,'text');
 selected='uhel';measure('30','mm');assert.equal(photo.items[2].measure,'45');
 selected=null;measure('20','mm');assert.equal(saves,2);
 selected='kota';locked=true;measure('3000','mm');assert.equal(saves,2);
 locked=false;measure('špatně','mm');assert.equal(saves,2);
 scope.window.__applyLaserMeasurement('2.123','m',{fromHistory:true});
 assert.equal(photo.items[0].measure,'2123');assert.equal(saves,3);assert.equal(undo,3);
 scope.screen='browser';assert.equal(measure('150','mm'),false);
 console.log('OK – laser: zvolená kóta, převod jednotek, žádný omyl, zámek, historie');
}
function toolbar(){
 class El{
  constructor(){this.children=[];this.listeners={};this.attributes={};this.dataset={};this.hidden=false;this.classList={toggle(){}};}
  setAttribute(k,v){this.attributes[k]=v}
  addEventListener(k,fn){(this.listeners[k]??=[]).push(fn)}
  prepend(v){this.children.unshift(v)}
  append(v){this.children.push(v)}
  after(v){this.afterNode=v}
  fire(k,v){for(const fn of this.listeners[k]??[])fn(v)}
 }
 const bar=new El(),win={isRecordLocked:()=>false},photo={items:[{id:'a',type:'dimension',a:{x:10,y:10},b:{x:50,y:10}}]};
 let resize=0,save=0,id=0,selected='a';
 const scope={window:win,document:{querySelector:()=>bar,createElement:()=>new El()},
  screen:'editor',current:photo,photoSize:{w:400,h:300},
  requestAnimationFrame:fn=>fn(),resizeEditor:()=>resize++,
  openEditor:()=>{},handleAndroidBack:()=>null,notify:()=>{},uid:()=>('new-'+(++id)),
  checkpoint:()=>{},commitEditor:()=>save++,setTool:()=>{},redoEditor:()=>{},
  renderSettings:()=>{},recordActions:()=>{},fitImage:()=>{},
  $:()=>({hidden:true,click(){}})};
 Object.defineProperty(scope,'selected',{get(){return selected},set(x){selected=x}});
 vm.createContext(scope);
 vm.runInContext(fs.readFileSync('app/src/main/assets/toolbar-tray.js','utf8'),scope);
 const panel=bar.afterNode;
 assert.equal(panel.children.length,14);assert.equal(panel.hidden,true);
 const ev=(kind,x,y)=>({touches:kind==='start'?[{clientX:x,clientY:y}]:[],changedTouches:kind==='end'?[{clientX:x,clientY:y}]:[],
  preventDefault(){},stopImmediatePropagation(){}});
 bar.fire('touchstart',ev('start',100,670));bar.fire('touchend',ev('end',100,560));
 assert.equal(panel.hidden,false);
 assert.equal(bar.children[0].attributes['aria-expanded'],'true');
 panel.fire('touchstart',ev('start',100,550));panel.fire('touchend',ev('end',100,670));
 assert.equal(panel.hidden,true);
 bar.fire('touchstart',ev('start',90,630));bar.fire('touchend',ev('end',300,615));
 assert.equal(panel.hidden,true);
 assert.ok(resize>=2);
 panel.children.find(x=>x.dataset.action==='copy').onclick();
 panel.children.find(x=>x.dataset.action==='paste').onclick();
 assert.equal(photo.items.length,2);assert.equal(photo.items[1].a.x,35);
 assert.equal(save,1);
 console.log('OK – ImageMeter: dvě řady, gesto nahoru/dolů, kopírování prvku');
}
laser();toolbar();
