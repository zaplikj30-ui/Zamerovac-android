'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),cp=require('node:child_process');
const script="import ast,sys\nfrom pathlib import Path\np=Path('tools/qa_cloud_quick.py'); tree=ast.parse(p.read_text()); entry=ast.Module(body=[tree.body[-1]],type_ignores=[])\ndef main():\n if sys.argv[1]=='failure':raise RuntimeError('PRIVATE_SENTINEL')\n return 0\nexec(compile(entry,str(p),'exec'),{'__name__':'__main__','main':main,'sys':sys})";
for(const [mode,code] of [['success',0],['failure',78]])test('QUICK Python CLI preserves '+mode+' exit and redaction',()=>{
 for(const flags of [[],['-O']]){
  const r=cp.spawnSync('python3',[...flags,'-c',script,mode],{encoding:'utf8',timeout:5000});
  assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,code);
  assert(!r.stderr.includes('PRIVATE_SENTINEL'));assert(!r.stdout.includes('PRIVATE_SENTINEL'));
 }
});
test('QUICK requires the reviewed ready-envelope regression in addition to historical names',()=>{
 const q=require('../tools/qa-cloud-quick.cjs'),registry=require('../tools/qa/home4-quick.json');
 const name='tests/qa_process_diagnostics.js',added='result-only PASS and malformed ready never pass owner completion';
 const original=cp.spawnSync;
 const envelope=names=>({status:0,stdout:JSON.stringify({protocol:'home4-node-v1',complete:true,cases:names.map(id=>({id,status:'PASS'}))}),stderr:''});
 try{
  cp.spawnSync=()=>envelope(registry.node[name].cases);
  assert.throws(()=>q.runGroup(name));
  cp.spawnSync=()=>envelope([...registry.node[name].cases,added]);
  assert.equal(q.runGroup(name).passed,registry.node[name].cases.length+1);
  cp.spawnSync=()=>envelope([...registry.node[name].cases,added,added]);
  assert.throws(()=>q.runGroup(name));
 }finally{cp.spawnSync=original}
});
