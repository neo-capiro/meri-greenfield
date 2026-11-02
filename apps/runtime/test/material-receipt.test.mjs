/** The material receipt that carries the envelope's source commit from init to control's liveness document. The filesystem is a
 * syscall-level mock of the Linux task-local directory; the pure document/parse functions run as is. */
import test,{mock} from 'node:test';
import assert from 'node:assert/strict';
import {constants} from 'node:fs';

const commit='8d22fb8a'.padEnd(40,'0'),imageDigest='sha256:'+'c'.repeat(64);
const expected=Object.freeze({schemaVersion:1,role:'control',runtimeUser:'1000:1000',sourceCommit:commit,imageDigest,materialContractSha256:'d'.repeat(64),sha256ByPath:{}});
const document={schema:'meri.material-receipt/1',role:'control',sourceCommit:commit,imageDigest};
let io;
function stat(entry){return {dev:1,ino:entry.ino,uid:entry.uid,gid:entry.gid,mode:entry.mode,nlink:entry.nlink??1,size:entry.bytes?.length??0,
 isFile:()=>entry.kind==='file',isDirectory:()=>entry.kind==='directory',isSymbolicLink:()=>entry.kind==='symlink'};}
const missing=()=>Object.assign(Error('synthetic missing file'),{code:'ENOENT'});
const ioConstants={...constants,O_NOFOLLOW:constants.O_NOFOLLOW??0x20000,O_NONBLOCK:constants.O_NONBLOCK??0x800};
// The receipt borrows only the directory name from the CA composer; the composer's own trust inputs stay out of this test.
mock.module('../control-ca-bundle.mjs',{namedExports:{CONTROL_NODE_CA_DIRECTORY:'/tmp/meri-control-ca'}});
mock.module('node:fs',{namedExports:{constants:ioConstants}});
mock.module('node:fs/promises',{namedExports:{
 async open(path,flags,mode){
  let entry=io.files.get(path);
  if(flags&constants.O_CREAT){if(entry)throw Object.assign(Error('exists'),{code:'EEXIST'});entry={kind:'file',uid:1000,gid:1000,mode,ino:++io.sequence,bytes:Buffer.alloc(0)};io.files.set(path,entry);}
  else if(!entry)throw missing();
  return {async stat(){return stat(entry);},async read(buffer,offset,length,position){return {bytesRead:entry.bytes.copy(buffer,offset,position,position+length)};},
   async writeFile(bytes){entry.bytes=Buffer.from(bytes);},async sync(){},async close(){io.closed++;}};
 },
 async lstat(path){const entry=io.files.get(path);if(!entry)throw missing();return stat(entry);},
 async realpath(path){return path;},
}});
const receipt=await import('../material-receipt.mjs');
const {MATERIAL_RECEIPT_FILE:FILE,materialReceiptDocument,parseMaterialReceipt,materializeMaterialReceipt,readMaterialReceipt}=receipt;
const directory='/tmp/meri-control-ca';
const linux=process.platform==='linux'&&process.getuid?.()===1000&&process.getgid?.()===1000;
function reset(entries={}){io={sequence:10,closed:0,files:new Map([[directory,{kind:'directory',uid:1000,gid:1000,mode:0o700,ino:1}],...Object.entries(entries)])};}

test('the document is the envelope pins only, and parsing accepts exactly that document',()=>{
 assert.deepEqual(materialReceiptDocument(expected),document);
 assert.deepEqual(parseMaterialReceipt(JSON.stringify(document)),document);
 for(const change of [e=>{e.role='temporal-worker';},e=>{e.sourceCommit=commit.slice(0,39);},e=>{e.sourceCommit=commit.toUpperCase();},e=>{e.imageDigest='sha256:short';},e=>{delete e.sourceCommit;}]){
  const e=structuredClone(expected);change(e);assert.throws(()=>materialReceiptDocument(e),{code:'STATIC_INIT_RECEIPT_REFUSED'});
 }
 for(const value of [null,undefined,[],'text'])assert.throws(()=>materialReceiptDocument(value),{code:'STATIC_INIT_RECEIPT_REFUSED'});
 for(const text of ['','live','[]','null',JSON.stringify({...document,schema:'meri.material-receipt/2'}),JSON.stringify({...document,extra:true}),JSON.stringify({status:'live',sourceCommit:commit}),JSON.stringify({...document,sourceCommit:'abc'})])
  assert.equal(parseMaterialReceipt(text),null,text);
});

test('init writes the receipt once beside the CA bundle and control reads it back; the write refuses without the init-owned directory and never overwrites; the read is null when absent, foreign, oversized or malformed',async t=>{
 const platform=process.platform,getuid=process.getuid,getgid=process.getgid;
 Object.defineProperty(process,'platform',{value:'linux',configurable:true});process.getuid=()=>1000;process.getgid=()=>1000;
 t.after(()=>{Object.defineProperty(process,'platform',{value:platform,configurable:true});process.getuid=getuid;process.getgid=getgid;});
 reset();
 const written=await materializeMaterialReceipt({expected});
 assert.deepEqual(written,{ready:true,path:FILE,bytes:Buffer.byteLength(JSON.stringify(document))});
 assert.equal(io.files.get(FILE).mode,0o600);assert.deepEqual(JSON.parse(io.files.get(FILE).bytes.toString('utf8')),document);
 assert.deepEqual(await readMaterialReceipt(),document);
 await assert.rejects(materializeMaterialReceipt({expected}),{code:'EEXIST'});
 reset({[directory]:{kind:'directory',uid:0,gid:0,mode:0o700,ino:1}});
 await assert.rejects(materializeMaterialReceipt({expected}),{code:'STATIC_INIT_RECEIPT_REFUSED'});assert.equal(io.files.has(FILE),false);
 io.files.delete(directory);await assert.rejects(materializeMaterialReceipt({expected}),{code:'ENOENT'});
 reset();assert.equal(await readMaterialReceipt(),null);
 for(const entry of [
  {kind:'file',uid:0,gid:0,mode:0o600,ino:5,bytes:Buffer.from(JSON.stringify(document))},
  {kind:'file',uid:1000,gid:1000,mode:0o644,ino:5,bytes:Buffer.from(JSON.stringify(document))},
  {kind:'file',uid:1000,gid:1000,mode:0o600,ino:5,nlink:2,bytes:Buffer.from(JSON.stringify(document))},
  {kind:'file',uid:1000,gid:1000,mode:0o600,ino:5,bytes:Buffer.alloc(1025,0x20)},
  {kind:'file',uid:1000,gid:1000,mode:0o600,ino:5,bytes:Buffer.from('{"status":"live"}')},
  {kind:'symlink',uid:1000,gid:1000,mode:0o600,ino:5,bytes:Buffer.from(JSON.stringify(document))},
 ]){reset({[FILE]:entry});assert.equal(await readMaterialReceipt(),null);}
});

test('outside the Linux task identity the read is null and the write refuses, so a local candidate starts unnamed',async()=>{
 reset({[FILE]:{kind:'file',uid:1000,gid:1000,mode:0o600,ino:5,bytes:Buffer.from(JSON.stringify(document))}});
 if(linux)return;
 assert.equal(await readMaterialReceipt(),null);
 await assert.rejects(materializeMaterialReceipt({expected}),{code:'STATIC_INIT_RECEIPT_REFUSED'});
});
