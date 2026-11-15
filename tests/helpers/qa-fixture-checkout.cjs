'use strict';
const fs=require('node:fs'),path=require('node:path');
const repo=path.resolve(__dirname,'../..');
function copyGate(root){
 fs.mkdirSync(path.join(root,'tools'));fs.mkdirSync(path.join(root,'tests'));
 for(const name of ['qa-fixture-gate.cjs','qa-fixture-worker.cjs','qa-fixture-tap.cjs','qa-process-client.cjs',
  'qa-process-diagnostic.json','qa_process_supervisor.py','qa_owned_processes.py','qa_browser_lock.py'])
  fs.copyFileSync(path.join(repo,'tools',name),path.join(root,'tools',name));
}
module.exports={copyGate};
