'use strict';
// Reviewed historical workflow bytes are inert fixture data under tests/fixtures,
// not an Actions workflow and never fetched over the network at runtime.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const blob='ec8a2664d2d051f2ef40ee4b51564cc95dcb7485';
const sha256='e31e02bc0938a6ba28c514765380c5bbd1b99c230117d0b0128618d562431120';
const file=path.resolve(__dirname,'../fixtures/qa-reference-bootstrap-ec8a2664.txt');
function referenceBootstrap(){
  let bytes;
  try {
    const stat=fs.lstatSync(file);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>65536||stat.size===0)
      throw Error('untrusted fixture type/size');
    bytes=fs.readFileSync(file);
  }catch{throw Error('QA reference bootstrap fixture unavailable; no automatic fetch')}
  const actual=crypto.createHash('sha1').update('blob '+bytes.length+'\0').update(bytes).digest('hex');
  if(actual!==blob||crypto.createHash('sha256').update(bytes).digest('hex')!==sha256)
    throw Error('QA reference bootstrap bytes changed');
  return bytes.toString('utf8');
}
module.exports={referenceBootstrap};
