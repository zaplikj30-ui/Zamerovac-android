'use strict';
const fs=require('node:fs');
const path=require('node:path');
const file=path.resolve(__dirname,'../../config/app-version.properties');
const valid=/^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/;
function parse(value){if(typeof value!=='string'||!valid.test(value))throw Error('Neplatná verze: použij např. 1.3.0');const a=value.split('.').map(Number);if(a.some(n=>!Number.isSafeInteger(n)))throw Error('Příliš vysoké číslo verze');return a;}
function cmp(a,b){const x=parse(a),y=parse(b);for(let i=0;i<3;i++)if(x[i]!==y[i])return x[i]>y[i]?1:-1;return 0;}
function read(content=fs.readFileSync(file,'utf8')){const rows=content.split(/\r?\n/).map(x=>x.trim()).filter(x=>x&&!x.startsWith('#'));if(rows.length!==1||!rows[0].startsWith('versionName='))throw Error('Soubor verze vyžaduje právě jeden versionName');const v=rows[0].slice(12);parse(v);return v;}
function verify(v,releases){if(releases[0]?.version!==v||!releases[0]?.groups?.length)throw Error('V historii změn chybí nová verze '+v);if(releases.filter(x=>x.version===v).length!==1)throw Error('Duplicitní verze');if(releases.length<2||cmp(v,releases[1].version)<=0)throw Error('Nová verze musí být vyšší než předchozí');return v;}
function check(){const v=read();const history=require('../../app/src/main/assets/release-history.js');return verify(v,history.releases);}
if(require.main===module){try{if(process.argv[2]&&!['--check','--release'].includes(process.argv[2]))throw Error('Neznámý režim');console.log(check());}catch(e){console.error('Verzování: '+e.message);process.exitCode=1;}}
module.exports={parse,cmp,read,verify,check};
