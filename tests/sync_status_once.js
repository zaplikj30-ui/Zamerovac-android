/* #192: execute the real status presenter with deterministic native account,
 * pairing and current-ledger receipt fakes. No real Google/Android sync is claimed.
 */
'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('app/src/main/assets/sync-status.js','utf8');
const app=fs.readFileSync('app/src/main/assets/app.js','utf8');
const peer=fs.readFileSync('app/src/main/assets/peer-sync.js','utf8');
const html=fs.readFileSync('app/src/main/assets/index.html','utf8');
assert(app.includes('window.ZamerovacSyncStatus?.error?.(message)'),'Native sync errors must reach status');
assert(app.includes('window.ZamerovacSyncStatus?.cloud?.(result)'),'Cloud results must reach status');
assert(peer.includes('root.ZamerovacSyncStatus?.peerState?.(state)'),'Peer state must reach status');
assert(peer.includes('root.ZamerovacSyncStatus?.peerProblem?.(state.problem)'),'Peer problems must reach status');
assert(html.includes('<script src="sync-status.js"></script>'),'Status presenter not loaded');
function scene(){
 const notices=[],elements=new Map(),classes=new Set(),events=[];
 let oldCloud=0,peers=0,ledger={localSaved:true,targets:[]},ledgerReads=0;
 function element(id){
  if(!elements.has(id))elements.set(id,{id,hidden:false,textContent:'',
   dataset:{},title:'',attributes:{},classList:{
    remove(...names){for(const name of names)classes.delete(name)},
    add(...names){for(const name of names)classes.add(name)}
   },setAttribute(name,value){this.attributes[name]=value},onclick:null});
  return elements.get(id)
 }
 const cloud=element('cloudBtn');cloud.onclick=()=>{oldCloud++};
 const document={getElementById:element};
 const window={Native:{
  // Connected account alone is NOT a signed transfer receipt.
  driveAccountState(){return JSON.stringify({sync:{backend:'drive',account:'test@example.invalid'}})},
  syncLedgerState(){ledgerReads++;return JSON.stringify(ledger)}
 },openZamerovacPeers(){peers++}};
 const env={window,document,notify:message=>notices.push(message),
  modal:(...args)=>events.push(args)};
 vm.createContext(env);vm.runInContext(source,env,{filename:'sync-status.js'});
 return {window,notices,classes,cloud,events,element,
  get ledgerReads(){return ledgerReads},set ledger(value){ledger=value},
  get oldCloud(){return oldCloud},get peers(){return peers}};
}
function phase(s){return s.window.ZamerovacSyncStatus.status().phase}
const blocked='Synchronizace: Nejdříve spáruj telefon a tablet přes Synchronizace zařízení. Cloud přijímá jen podepsaná data schválené instalace.';
const s=scene(),api=s.window.ZamerovacSyncStatus;
assert.equal(phase(s),'unset');
assert.equal(s.cloud.dataset.syncState,'unset');
assert.equal(api.error('Mikrofon: chybí oprávnění'),false,'Other errors must not be swallowed');
for(let i=0;i<8;i++)assert.equal(api.error(blocked),true);
assert.equal(s.notices.length,1,'Repeated automatic unpaired failure spammed editor');
assert.equal(phase(s),'unset','Unpaired account was misread as connected sync');
assert.match(s.cloud.attributes['aria-label'],/Nenastaveno/);
api.peerState({enabled:true,active:true,peers:{}});
assert.equal(phase(s),'unset','Peer service enabled is not paired');
api.peerState({enabled:true,active:true,peers:{'trusted-peer':{}}});
assert.equal(phase(s),'pending','Paired alone is not signed receipt');
assert.equal(s.ledgerReads,0,'No ledger reads on each peer callback/editor update');
api.cloud({transport:'cloud-v2',pending:true,message:'Synchronizace čeká na povolené připojení'});
api.cloud({transport:'cloud-v2',pending:true,message:'Synchronizace čeká na povolené připojení'});
assert.equal(phase(s),'pending');
assert.equal(s.notices.length,2,'Identical waiting state should notify only once');
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen pro toto úložiště'});
assert.equal(phase(s),'pending','Success message without durable receipt is false green');
s.ledger={localSaved:true,targets:[{kind:'drive',state:'waiting',contentState:'not-required'}]};
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen pro toto úložiště'});
assert.equal(phase(s),'pending','Waiting transfer cannot be green');
s.ledger={localSaved:true,targets:[{kind:'drive',state:'transport-ack',contentState:'error'}]};
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen pro toto úložiště'});
assert.equal(phase(s),'pending','Missing media inventory confirmation cannot be green');
s.ledger={localSaved:true,targets:[{kind:'tls',state:'transport-ack',contentState:'not-required'}]};
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen pro toto úložiště'});
assert.equal(phase(s),'pending','A direct ACK cannot prove cloud delivery');
s.ledger={localSaved:true,targets:[{kind:'drive',state:'transport-receipt',contentState:'not-required'}]};
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen pro toto úložiště'});
assert.equal(phase(s),'confirmed','Current approved cloud receipt should be green');
assert.match(s.cloud.textContent,/✓/);
assert.equal(s.notices.length,3,'Receipt should not emit a celebratory toast');
api.error('Synchronizace: poskytovatel odmítl připojení');
assert.equal(phase(s),'failed');
assert.match(s.cloud.textContent,/✕/,'Error must be a visible cross not a dot');
const before=s.notices.length;
for(let i=0;i<5;i++)api.error('Synchronizace: poskytovatel odmítl připojení');
assert.equal(s.notices.length,before,'Duplicate provider failures must not flood editor');
api.error('Synchronizace: Poškozená evidence vyžaduje kontrolu');
api.error('Synchronizace: Poškozená evidence vyžaduje kontrolu');
assert.equal(s.notices.length,before+2,'Critical data threat must always warn');
api.cloud({transport:'cloud-v2',pending:true,message:'Synchronizace čeká na další přenos'});
assert.equal(phase(s),'pending');
s.cloud.onclick();
assert.equal(s.events.length,1,'Tapping cloud should show status explanation');
assert.match(s.element('syncStatusExplanation').textContent,/Google účet, párování/);
s.element('syncStatusPair').onclick();assert.equal(s.peers,1,'Safe pairing action missing');
s.element('syncStatusCloud').onclick();assert.equal(s.oldCloud,1,'Legacy cloud actions inaccessible');
assert(s.ledgerReads>0,'Receipt should have been checked only for transfer/result and explicit UI');
s.ledger={localSaved:true,error:true,targets:[{kind:'drive',state:'transport-ack',contentState:'not-required'}]};
api.cloud({transport:'cloud-v2',pending:false,message:'Přenos potvrzen'});
assert.equal(phase(s),'pending','Corrupt ledger cannot mean success');
api.peerProblem('Synchronizace zařízení byla přerušena');
assert.equal(phase(s),'failed');
assert(s.notices.some(x=>x.includes('Synchronizace zařízení byla přerušena')));
console.log('PASS #192: duplicate attempt notice, offline/pending, account without pairing, signed receipt only, critical threats, tap actions and failed/confirmed icon');
