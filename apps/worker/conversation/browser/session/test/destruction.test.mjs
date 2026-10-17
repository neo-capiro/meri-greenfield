import test from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,realpath,rm,lstat} from 'node:fs/promises';
import {tmpdir} from 'node:os';import {join} from 'node:path';
import {createStateDestruction,DESTRUCTION_SCHEMA} from '../destruction.mjs';
import {createControlFence} from '../fence.mjs';
import {browserPaths,disposeBrowserState} from '../../workspace.mjs';
/** Synthetic ports and a temporary workspace only; no browser, site or network. The real-browser server-side invalidation
 * test (design S3 test 1 with a local-storage bearer token) stays UNRUN until the D005 host exists. */
const code=c=>e=>e.code===c;
const exists=async p=>{try{await lstat(p);return true;}catch{return false;}};
async function workspace(){
 const cwd=await realpath(await mkdtemp(join(tmpdir(),'meri-lane9-s3-'))),paths=browserPaths(cwd);
 for(const dir of ['Default/Local Storage/leveldb','Default/IndexedDB','Default/Service Worker','Default/Cache'])await mkdir(join(paths.profile,dir),{recursive:true});
 await writeFile(join(paths.profile,'Default/Cookies'),'synthetic-cookie');await writeFile(join(paths.profile,'Default/Local Storage/leveldb/000003.log'),'bearer synthetic-token');
 await mkdir(paths.home,{recursive:true});await mkdir(paths.output,{recursive:true});await writeFile(join(paths.output,'download.pdf'),'x');
 return {cwd,paths};
}
function ports(paths,over={}){
 const calls=[];
 return {calls,ports:{
  waitForDrain:async()=>{calls.push('drain');},
  logout:async({url})=>{calls.push(`logout ${url}`);return {outcome:'confirmed'};},
  closeContext:async()=>{calls.push('close');return {closed:true};},
  waitForExit:async()=>{calls.push('exit');return {exited:true};},
  dispose:async({signal})=>{calls.push('dispose');return disposeBrowserState(paths,{signal});},
  ...over}};
}
const now=()=>1_000_000;

test('disconnect destroys the whole profile (cookies, local storage token, IndexedDB, caches, downloads) in order',async()=>{
 const {cwd,paths}=await workspace();
 try{
  const fence=createControlFence({now}),{calls,ports:p}=ports(paths);
  fence.admit({requestId:'r1',tool:'browser_click',timeoutMs:5000});
  const d=createStateDestruction({fence,ports:p,manifest:{logoutUrl:'https://records.example/logout'},now});
  const r=await d.destroy({trigger:'disconnect'});
  assert.deepEqual(calls,['drain','logout https://records.example/logout','close','exit','dispose']);
  assert.deepEqual([r.schema,r.trigger,r.logout,r.process,r.profile,r.relaunch],[DESTRUCTION_SCHEMA,'disconnect','confirmed','exited','destroyed',true]);
  assert.equal(r.drain,'unknown','a call still in flight when the drain wait returns is not reported drained');
  assert.equal(r.unknownCalls,1,'the call in flight became UNKNOWN, never completed');
  for(const p of [paths.profile,paths.home,paths.output,paths.root])assert.equal(await exists(p),false);
  assert.throws(()=>fence.admit({requestId:'r2',tool:'browser_snapshot',timeoutMs:5000}),code('BROWSER_SESSION_ENDING'),'nothing is admitted after destruction');
  assert.equal(await d.destroy({trigger:'revocation'}),r,'idempotent: the first trigger wins');
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('logout is best effort and recorded; without a logoutUrl it is not-defined',async()=>{
 for(const [logout,expected] of [[async()=>({outcome:'failed'}),'failed'],[async()=>{throw new Error('timeout');},'unknown'],[async()=>({outcome:'weird'}),'unknown']]){
  const {cwd,paths}=await workspace();
  try{const r=await createStateDestruction({fence:createControlFence({now}),ports:ports(paths,{logout}).ports,manifest:{logoutUrl:'https://records.example/logout'},now}).destroy({trigger:'ttl-expiry'});
   assert.deepEqual([r.logout,r.profile],[expected,'destroyed']);}finally{await rm(cwd,{recursive:true,force:true});}
 }
 const {cwd,paths}=await workspace();
 try{const r=await createStateDestruction({fence:createControlFence({now}),ports:ports(paths).ports,now}).destroy({trigger:'conversation-end'});assert.equal(r.logout,'not-defined');}
 finally{await rm(cwd,{recursive:true,force:true});}
});

test('an unconfirmed process exit leaves the profile in place and the browser unavailable',async()=>{
 const {cwd,paths}=await workspace();
 try{
  const {calls,ports:p}=ports(paths,{waitForExit:async()=>({exited:false})});
  await assert.rejects(createStateDestruction({fence:createControlFence({now}),ports:p,now}).destroy({trigger:'revocation'}),e=>e.code==='BROWSER_DISPOSE_INCOMPLETE'&&e.receipt.profile==='not-attempted'&&e.receipt.relaunch===false);
  assert.equal(calls.includes('dispose'),false,'the profile is never removed while a process may still use it');
  assert.equal(await exists(paths.profile),true);
  const failing=ports(paths,{dispose:async()=>({disposed:false})}).ports;
  await assert.rejects(createStateDestruction({fence:createControlFence({now}),ports:failing,now}).destroy({trigger:'disconnect'}),e=>e.code==='BROWSER_DISPOSE_INCOMPLETE'&&e.receipt.profile==='unknown');
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('crash recovery destroys a surviving profile before any launch, without fence, logout or context steps',async()=>{
 const {cwd,paths}=await workspace();
 try{const {calls,ports:p}=ports(paths);
  const r=await createStateDestruction({fence:createControlFence({now}),ports:p,manifest:{logoutUrl:'https://records.example/logout'},now}).destroy({trigger:'crash-recovery'});
  assert.deepEqual(calls,['exit','dispose']);assert.deepEqual([r.logout,r.relaunch],['not-defined',true]);assert.equal(await exists(paths.root),false);
 }finally{await rm(cwd,{recursive:true,force:true});}
});

test('no vault: a port set offering storage-state export is refused; incomplete configuration is refused',async()=>{
 const base=ports(browserPaths('/nowhere')).ports;
 for(const k of ['storageState','exportCookies','vault'])assert.throws(()=>createStateDestruction({fence:createControlFence({now}),ports:{...base,[k]:async()=>({})},now}),code('BROWSER_STATE_EXPORT_REFUSED'));
 assert.throws(()=>createStateDestruction({fence:createControlFence({now}),ports:{...base,logout:undefined},manifest:{logoutUrl:'https://a.example/out'},now}),code('BROWSER_CONFIGURATION'));
 assert.throws(()=>createStateDestruction({fence:{},ports:base,now}),code('BROWSER_CONFIGURATION'));
 await assert.rejects(createStateDestruction({fence:createControlFence({now}),ports:base,now}).destroy({trigger:'clearCookies'}),code('BROWSER_CONFIGURATION'));
});
