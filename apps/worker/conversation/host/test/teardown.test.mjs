import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,lstat,realpath,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {canonicalSha256} from '../../../../../packages/contracts/validate.mjs';
import {binding} from '../../browser/test/fixtures.mjs';
import {HOST_ALLOCATION_SCHEMA,D005_HOST_IDENTITY_SCHEMA} from '../binding.mjs';
import {createConversationHostTeardown,HOST_PROCESS_ABSENCE_SCHEMA,HOST_PHYSICAL_ABSENCE_SCHEMA,HOST_TEARDOWN_SCHEMA} from '../teardown.mjs';

const allocation=Object.freeze({schema:HOST_ALLOCATION_SCHEMA,tenantId:binding.tenantId,conversationId:binding.conversationId,
 generation:1,hostId:'00000020-b0a1-4000-8000-000000000000',imageDigest:`sha256:${'a'.repeat(64)}`,leaseDeadlineMs:Date.now()+600000});
const hostIdentity=Object.freeze({schema:D005_HOST_IDENTITY_SCHEMA,instanceId:'i-0123456789abcdef0',
 bootId:'00000021-b0a1-4000-8000-000000000000',conversationId:binding.conversationId,hostId:allocation.hostId});
const browserPolicySha256='b'.repeat(64);
const resources=Object.freeze({instanceId:hostIdentity.instanceId,rootVolumeId:'vol-0123456789abcdef0',
 networkInterfaceIds:Object.freeze(['eni-0123456789abcdef0'])});
const present=async path=>{try{await lstat(path);return true;}catch(e){if(e?.code==='ENOENT')return false;throw e;}};
async function workspace(fn){
 const root=await realpath(await mkdtemp(join(tmpdir(),'meri-host-teardown-'))),cwd=join(root,binding.conversationId);
 await mkdir(join(cwd,'.browser','profile'),{recursive:true});
 await writeFile(join(cwd,'.browser','profile','Cookies'),'synthetic');
 try{return await fn(cwd);}finally{await rm(root,{recursive:true,force:true});}
}
function fixture(cwd,overrides={}){
 const calls=[];
 const hashes={allocationSha256:canonicalSha256(allocation),bindingSha256:canonicalSha256(binding),hostIdentitySha256:canonicalSha256(hostIdentity)};
 const processReceipt=over=>({schema:HOST_PROCESS_ABSENCE_SCHEMA,...hashes,observedAtMs:Date.now(),
  scope:'browser-bash-sdk-descendants',exited:true,remainingPids:[],...over});
 const requestReceipt=over=>({requested:true,...resources,...over});
 const absenceReceipt=over=>({schema:HOST_PHYSICAL_ABSENCE_SCHEMA,...hashes,...resources,
  observedAtMs:Date.now(),instanceState:'terminated',rootVolumeAbsent:true,networkInterfacesAbsent:true,...over});
 const ports={
  browser:{async revoke(request){calls.push('browser-revoke');assert.deepEqual(request,{binding,policySha256:browserPolicySha256});return {revoked:true};},
   async close(){calls.push('browser-close');return {closed:true};}},
  bash:{async revoke(request){calls.push('bash-revoke');assert.deepEqual(request,{allocation,binding,hostIdentity});return {revoked:true};},
   async close(){calls.push('bash-close');return {closed:true};}},
  processes:{async waitForExit(request){calls.push('process-observe');assert.deepEqual(request,{allocation,binding,hostIdentity,
    profile:join(cwd,'.browser','profile'),scope:'browser-bash-sdk-descendants'});return processReceipt();}},
  host:{async destroy(request){calls.push('host-destroy');assert.deepEqual(request,{allocation,binding,hostIdentity});
    assert.equal(await present(join(cwd,'.browser')),false,'state disposal preceded host destruction');return requestReceipt();},
   async observeAbsent(request){calls.push('host-absent');assert.deepEqual(request,{allocation,binding,hostIdentity,resources});return absenceReceipt();}},
 };
 for(const [key,methods] of Object.entries(overrides))Object.assign(ports[key],methods);
 return {calls,ports,processReceipt,requestReceipt,absenceReceipt};
}
const make=(cwd,ports,options={})=>createConversationHostTeardown({allocation,binding,hostIdentity,cwd,browserPolicySha256,ports,...options});

test('verified teardown revokes both proxies, observes actual process absence, disposes state, then proves host and volume absence',()=>workspace(async cwd=>{
 const f=fixture(cwd),owner=make(cwd,f.ports),receipt=await owner.settle({reason:'conversation-end'});
 assert.deepEqual(f.calls,['browser-revoke','bash-revoke','browser-close','bash-close','process-observe','host-destroy','host-absent']);
 assert.equal(await present(join(cwd,'.browser')),false);
 assert.equal(receipt.schema,HOST_TEARDOWN_SCHEMA);assert.equal(receipt.status,'VERIFIED');
 assert.equal(receipt.processes,'exited');assert.equal(receipt.browserState,'disposed');assert.equal(receipt.hostAbsence,'confirmed');
 assert.equal(await owner.settle({reason:'cancelled'}),receipt,'first settlement wins');
}));

test('failed egress or unverified process exit remains UNKNOWN; process uncertainty preserves browser state but still requests host destruction',()=>workspace(async cwd=>{
 const f=fixture(cwd,{browser:{async revoke(){f.calls.push('browser-revoke');throw Error('proxy unavailable');}},
  processes:{async waitForExit(){f.calls.push('process-observe');return f.processReceipt({remainingPids:[123]});}},
  host:{async destroy(){f.calls.push('host-destroy');return f.requestReceipt();}}});
 const owner=make(cwd,f.ports);
 await assert.rejects(owner.settle({reason:'failed'}),e=>e.code==='HOST_TEARDOWN_UNKNOWN'&&e.receipt.status==='UNKNOWN'&&
  e.receipt.browserEgress==='unknown'&&e.receipt.processes==='unknown'&&e.receipt.browserState==='not-attempted'&&e.receipt.hostAbsence==='confirmed');
 assert.equal(await present(join(cwd,'.browser','profile','Cookies')),true);
 assert.deepEqual(f.calls,['browser-revoke','bash-revoke','browser-close','bash-close','process-observe','host-destroy','host-absent']);
 await assert.rejects(owner.settle({reason:'revoked'}),e=>e.code==='HOST_TEARDOWN_UNKNOWN');
 assert.equal(f.calls.filter(c=>c==='host-destroy').length,1,'no duplicate destruction');
}));

test('a termination request, stale identity, and unconfirmed root-volume absence never count as physical teardown',()=>workspace(async cwd=>{
 for(const answer of [
  f=>f.absenceReceipt({rootVolumeAbsent:false}),
  f=>f.absenceReceipt({hostIdentitySha256:'0'.repeat(64)}),
  f=>f.absenceReceipt({rootVolumeId:'vol-00000000000000000'}),
  f=>f.absenceReceipt({networkInterfaceIds:['eni-00000000000000000']}),
  f=>f.absenceReceipt({instanceState:'shutting-down'}),
 ]){
  await mkdir(join(cwd,'.browser','profile'),{recursive:true});
  const f=fixture(cwd,{host:{async observeAbsent(){f.calls.push('host-absent');return answer(f);}}});
  await assert.rejects(make(cwd,f.ports).settle({reason:'cancelled'}),e=>e.code==='HOST_TEARDOWN_UNKNOWN'&&
   e.receipt.hostDestroy==='requested'&&e.receipt.hostAbsence==='unknown');
 }
}));

test('a malformed destroy acknowledgement does not become verified through an otherwise positive absence readback',()=>workspace(async cwd=>{
 const f=fixture(cwd,{host:{async destroy(){f.calls.push('host-destroy');return {requested:true};},
  async observeAbsent(request){f.calls.push('host-absent');assert.equal(Object.hasOwn(request,'resources'),false);return f.absenceReceipt();}}});
 await assert.rejects(make(cwd,f.ports).settle({reason:'revoked'}),e=>e.code==='HOST_TEARDOWN_UNKNOWN'&&
  e.receipt.hostDestroy==='unknown'&&e.receipt.hostAbsence==='unknown');
 assert.deepEqual(f.calls.slice(-2),['host-destroy','host-absent']);
}));

test('a hung process observer is bounded; host destruction is still attempted and state is retained',()=>workspace(async cwd=>{
 const f=fixture(cwd,{processes:{async waitForExit(){f.calls.push('process-observe');return new Promise(()=>{});}},
  host:{async destroy(){f.calls.push('host-destroy');return f.requestReceipt();}}});
 await assert.rejects(make(cwd,f.ports,{localCleanupMs:40}).settle({reason:'lease-expired'}),
  e=>e.code==='HOST_TEARDOWN_UNKNOWN'&&e.receipt.processes==='unknown'&&e.receipt.hostAbsence==='confirmed');
 assert.equal(await present(join(cwd,'.browser','profile','Cookies')),true);
 assert.deepEqual(f.calls.slice(-2),['host-destroy','host-absent']);
}));

test('invalid host binding and missing trusted ports refuse before cleanup',()=>workspace(async cwd=>{
 const f=fixture(cwd);
 assert.throws(()=>createConversationHostTeardown({allocation:{...allocation,conversationId:'00000000-0000-4000-8000-000000000000'},
  binding,hostIdentity,cwd,browserPolicySha256,ports:f.ports}),e=>e.code==='HOST_TEARDOWN_CONFIGURATION');
 assert.throws(()=>make(cwd,{...f.ports,host:{destroy:async()=>({requested:true})}}),e=>e.code==='HOST_TEARDOWN_CONFIGURATION');
 await assert.rejects(make(cwd,f.ports).settle({reason:'recycle'}),e=>e.code==='HOST_TEARDOWN_CONFIGURATION');
 assert.deepEqual(f.calls,[]);
}));
