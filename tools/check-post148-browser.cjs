/* Real UI events on synthetic projects only. No Android/S Pen hardware claim. */
const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const context=await browser.newContext({viewport:{width:412,height:850},hasTouch:true});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(process.argv[2]||'http://127.0.0.1:8765');
 await page.evaluate(()=>{
  const active=newRecord('photo','Aktivní');active.id='active';active.locked=true;active.media=['shared'];
  active.items=[{id:'dim',type:'chain',points:[{x:10,y:10},{x:50,y:30}],segmentData:[{measure:'123,456789123',unit:'in',text:'poznámka'}]}];
  const folder=newRecord('folder','Koš');folder.id='trash-folder';folder.deleted=true;
  const gone=newRecord('photo','Pryč');gone.id='trash-photo';gone.parentId=folder.id;gone.deleted=true;gone.media=['shared','trash-only'];
  const child=newRecord('note','Aktivní potomek');child.id='child';child.parentId=folder.id;child.text='Soukromé';
  state.records=[active,folder,gone,child];save();showFolder();window.baseline=JSON.stringify([active,child]);
 });
 // Browser menus: mouse and touch, no click-through into sorting/import/navigation.
 for(const [button,menu] of [['back','navMenu'],['settingsBtn','overflowMenu'],['createBtn','newMenu']]){
  for(const touch of [false,true]){
   await page.click('#'+button);assert(await page.locator('#'+menu).isVisible());
   const before=await page.evaluate(()=>JSON.stringify(state));
   if(touch)await page.touchscreen.tap(210,230);else await page.mouse.click(210,230);
   assert.equal(await page.locator('#'+menu).isVisible(),false);assert.equal(await page.evaluate(()=>JSON.stringify(state)),before);
   await page.click('#'+button);await page.click('#'+button);assert.equal(await page.locator('#'+menu).isVisible(),false);
   await page.click('#'+button);await page.evaluate(()=>window.handleAndroidBack());assert.equal(await page.locator('#'+menu).isVisible(),false);
  }
 }
 await page.click('#back');await page.click('#settingsBtn');assert.equal(await page.locator('#navMenu').isVisible(),false);assert(await page.locator('#overflowMenu').isVisible());
 const sort=await page.evaluate(()=>sortAsc);await page.click('#sortBtn');assert.equal(await page.evaluate(()=>sortAsc),sort,'Outside click only closes');
 await page.click('#sortBtn');assert.equal(await page.evaluate(()=>sortAsc),!sort,'Next click works');
 // Real item ⋮ action choices dismiss; forms and destructive confirmations do not.
 await page.locator('[data-more="active"]').click();await page.mouse.click(3,85);assert.equal(await page.locator('#modal').isVisible(),false);
 await page.evaluate(()=>promptText('Formulář','Hodnota','rozepsané',()=>{}));await page.mouse.click(3,85);
 assert(await page.locator('#modal').isVisible());assert.equal(await page.locator('#promptValue').inputValue(),'rozepsané');await page.click('#cancelModal');
 await page.evaluate(()=>showTrash());await page.click('#emptyTrash');
 assert.equal(await page.locator('#okModal').innerText(),'Trvale odstranit');assert.equal(await page.locator('#cancelModal').innerText(),'Zrušit');
 await page.mouse.click(3,85);assert(await page.locator('#modal').isVisible(),'Outside cannot bypass confirmation');
 await page.click('#cancelModal');assert.equal(await page.evaluate(()=>state.records.length),4);
 await page.evaluate(()=>showTrash());await page.click('#emptyTrash');await page.evaluate(()=>window.handleAndroidBack());assert.equal(await page.evaluate(()=>state.records.length),4);
 // Failed storage leaves the trash and all active data intact, retry works.
 await page.evaluate(()=>{window.realSetItem=Storage.prototype.setItem;Storage.prototype.setItem=()=>{throw new Error('disk full')};showTrash()});
 await page.click('#emptyTrash');await page.click('#okModal');assert.equal(await page.evaluate(()=>state.records.length),4);assert((await page.locator('#toast').innerText()).includes('disk full'));
 await page.evaluate(()=>{Storage.prototype.setItem=window.realSetItem});
 await page.click('#okModal');assert.equal(await page.locator('#modalTitle').innerText(),'🗑️ Koš');assert(await page.locator('#emptyTrash').isDisabled());
 assert.equal(await page.evaluate(()=>JSON.stringify(state.records)),await page.evaluate(()=>window.baseline));
 await page.click('#okModal');await page.reload();assert.equal(await page.evaluate(()=>state.records.filter(r=>r.deleted).length),0);assert.equal(await page.evaluate(()=>state.records.length),2);
 await page.evaluate(()=>showTrash());assert(await page.locator('#emptyTrash').isDisabled());await page.click('#okModal');
 // Badge position/size in actual layout, after the requested additional reduction.
 const badge=await page.locator('.photo-edited-badge').first().evaluate(el=>{const s=getComputedStyle(el),p=el.parentElement.getBoundingClientRect(),r=el.getBoundingClientRect();return {left:r.x-p.x,top:r.y-p.y,width:r.width,height:r.height,color:s.color}});
 assert.equal(badge.width,15);assert.equal(badge.height,15);assert(badge.left<=4&&badge.top<=4);assert.equal(badge.color,'rgb(255, 255, 255)');
 // Correct exact wording at photo, folder, bulk and editor entries. Backup actions remain.
 await page.locator('[data-more="active"]').click();assert.equal(await page.getByText('Export pro zákazníka: ZIP s PDF',{exact:true}).count(),1);assert.equal(await page.getByText('Exportovat fotografii ZIP',{exact:true}).count(),1);await page.click('#okModal');
 await page.evaluate(()=>{const f=newRecord('folder','Složka');state.records.push(f);showFolder();recordActions(f.id)});
 assert.equal(await page.getByText('Export pro zákazníka: ZIP s PDF',{exact:true}).count(),1);assert.equal(await page.getByText('Exportovat složku ZIP',{exact:true}).count(),1);await page.click('#okModal');
 await page.locator('.entry[data-id="active"] .entry-title').dispatchEvent('contextmenu');
 assert.equal(await page.locator('[data-bulk="customer"]').innerText(),'Export pro zákazníka: ZIP s PDF');assert.equal(await page.locator('[data-bulk="zip"]').innerText(),'Exportovat do ZIP');await page.locator('[data-bulk="cancel"]').click();
 await page.evaluate(()=>{const r=newRecord('canvas','Rozpracovaná kóta');state.records.push(r);openEditor(r);setTool('chain');prefs.snapPoints=false;prefs.snapHorizontal=false;view={zoom:1,dx:0,dy:0}});
 const box=await page.locator('#drawCanvas').boundingBox();
 for(const [x,y] of [[70,130],[170,180],[250,230]])await page.mouse.click(box.x+x,box.y+y);
 const before=await page.evaluate(()=>JSON.stringify({items:current.items,draft:polylineDraft,mode}));
 for(const [button,menu] of [['toolsToggle','toolMenu'],['editorTopMenu','editorOverflow'],['editorMore','editorExtraToolbar']]){
  for(const pointer of ['mouse','touch','pen']){
   await page.click('#'+button);assert(await page.locator('#'+menu).isVisible());
   const x=box.x+110,y=box.y+110;
   if(pointer==='touch')await page.touchscreen.tap(x,y);
   else if(pointer==='pen'){
    for(const type of ['pointerdown','pointermove','pointerup','click'])await page.locator('#drawCanvas').dispatchEvent(type,{pointerId:9,pointerType:'pen',clientX:x,clientY:y,bubbles:true,cancelable:true});
   }else await page.mouse.click(x,y);
   assert.equal(await page.locator('#'+menu).isVisible(),false);
   // Extra toolbar resize can change viewport fitting; data, draft and mode cannot change.
   assert.deepEqual(await page.evaluate(()=>({items:current.items,draft:polylineDraft,mode})),JSON.parse(before), 'Outside must preserve draft and saved objects');
  }
 }
 await browser.close();assert.deepEqual(errors,[]);console.log('OK: post148 real mouse/touch/pen-event menus, cancellation/storage failure/restart, exact export entries, smaller upper-left badge');
})().catch(e=>{console.error(e);process.exit(1)});
