'use strict';
const fs=require('node:fs'),path=require('node:path'),root=path.resolve(__dirname,'../..');
try{
 const registry=JSON.parse(fs.readFileSync(process.argv[2]||path.join(root,'qa/coverage-v1.json'),'utf8'));
 if(registry.schema!==1||registry.fullApplicationVerified!==false||registry.syntheticOnly!==true||!Array.isArray(registry.features)||!registry.features.length)throw Error('Invalid coverage registry or misleading verification claim');
 const ids=new Set(),layers=new Set(['native-jvm','chromium','node','python','gradle']);
 const file=(value,test=false)=>{if(typeof value!=='string'||!value.match(/^[a-zA-Z0-9_./-]+$/)||value.startsWith('/')||value.split('/').includes('..')||!fs.statSync(path.join(root,value)).isFile()||test&&!/\.(?:cjs|js|java|py|gradle)$/.test(value))throw Error('Invalid mapped file: '+value);};
 for(const feature of registry.features){if(typeof feature.id!=='string'||!feature.id.match(/^[a-z0-9-]+$/)||ids.has(feature.id))throw Error('Duplicate/invalid feature: '+feature.id);ids.add(feature.id);if(!['runtime-partial','static-only'].includes(feature.coverage)||!feature.positive||!feature.negative||!feature.limits?.length||!feature.issues?.every(n=>Number.isInteger(n)&&n>0)||!feature.sources?.length||!feature.tests?.length)throw Error('Missing evidence/limits: '+feature.id);feature.sources.forEach(p=>file(p));for(const test of feature.tests){if(!layers.has(test.layer))throw Error('Invalid test layer: '+test.layer);file(test.path,true);}}
 if(!registry.manualGates?.length||!registry.openAutomationGaps?.length||registry.manualGates.some(g=>!['not-run','blocked','pending'].includes(g.status)||!g.scope))throw Error('Missing manual gates or open gaps');
 console.log('PASS coverage map: '+ids.size+' areas, real file references, positive/negative criteria and explicit gaps. This audit does not run those tests or verify devices.');
}catch(error){console.error('Coverage map failed: '+error.message);process.exitCode=1;}
