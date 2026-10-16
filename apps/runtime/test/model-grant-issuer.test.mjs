/** SYNTHETIC: canonical issuer with in-memory durable port and fixed synthetic material. No credential/file/SQL/provider effects. */
import test from 'node:test';import assert from 'node:assert/strict';import {resolve,join} from 'node:path';
import {createMemoryIssuanceStore} from '../prepared-run-issuance-store.mjs';
import {createModelGrantIssuer,createPostgresModelGrants} from '../model-grant-issuer.mjs';
import {createModelMaterialAuthority,createFileModelMaterialAuthority} from '../model-material-authority.mjs';
import {createFileCapabilityAuthority} from '../capability-material-authority.mjs';
import {canonicalSha256 as hash} from '../../../packages/contracts/validate.mjs';
import {capabilityDigest} from '../native-authority/task-verifier.mjs';
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,at=1900000000000;
const binding={tenantId:'t',actorId:'a',conversationId:id(1),runId:id(2),attemptId:id(3),workerId:id(4),writerFence:1};
const intent={issuanceKey:hash(binding),binding,requestSha256:'a'.repeat(64),expiresAtMs:at+1000};
function fixture(crashAt=null){
 const store=createMemoryIssuanceStore({crashAt}),rows=new Map(),stats={generate:0,retrieve:0},state={now:at,loseMaterialAck:false,retrieveState:'PRESENT'};
 const raw={async generate(v){stats.generate++;assert.equal(store.snapshot().get(v.issuanceKey).state,'CLAIMED','claim precedes material');assert.equal(rows.has(v.issuanceKey),false);
  const r={grantId:id(100+rows.size),capability:'synthetic-model-material-'+v.issuanceKey,materialRef:'material:'+v.issuanceKey};rows.set(v.issuanceKey,r);if(state.loseMaterialAck)throw Error('synthetic secret must not escape');return r;},
  async retrieve({materialRef,grantId}){stats.retrieve++;const r=rows.get(materialRef.slice('material:'.length));return r?.grantId===grantId?{state:state.retrieveState,...(state.retrieveState==='PRESENT'?{capability:r.capability}:{})}:{state:'ABSENT'};},
  async status(){throw Error('UNKNOWN is not automatic generation/reconciliation authority');}};
 const authority=createModelMaterialAuthority({authority:raw}),create=()=>createModelGrantIssuer({store,authority,now:()=>state.now,maxRequestMs:30});
 return {store,rows,stats,state,create,owner:create()};
}
test('claim precedes synthetic material; exact retry and recreated owner resolve identical material without raw secret in store',async()=>{
 const f=fixture(),first=await f.owner.issue({intent}),again=await f.create().issue({intent});assert.deepEqual(first,again);assert.equal(f.stats.generate,1);assert.equal(f.stats.retrieve,2);
 const row=f.store.snapshot().get(intent.issuanceKey);assert.equal(row.materialRef,'model-material:v1:'+intent.issuanceKey);assert.equal(row.capabilitySha256,capabilityDigest(first.proxyCredential));
 assert.ok(!JSON.stringify([...f.store.snapshot()]).includes(first.proxyCredential));assert.equal(first.expiresAtMs,intent.expiresAtMs);
});
test('read-only model grant lookup and resolution use the exact issued identity without generation',async()=>{
 const f=fixture(),absent=await f.owner.read(intent);assert.deepEqual(absent,{state:'ABSENT'});
 assert.deepEqual(f.stats,{generate:0,retrieve:0});
 const issued=await f.owner.issue({intent}),reader=f.create(),current=await reader.read(intent);
 assert.deepEqual(current,{state:'ISSUED',issuance:Object.fromEntries(Object.entries(issued).filter(([key])=>key!=='proxyCredential'))});
 assert.equal(await reader.resolve(current.issuance),issued.proxyCredential);
 assert.deepEqual(f.stats,{generate:1,retrieve:2});
 for(const changed of [{...intent,requestSha256:'b'.repeat(64)},{...intent,expiresAtMs:intent.expiresAtMs+1}])await assert.rejects(reader.read(changed));
 await assert.rejects(reader.resolve({...current.issuance,grantId:id(900)}));
 assert.deepEqual(f.stats,{generate:1,retrieve:2});
 f.state.retrieveState='REVOKED';await assert.rejects(reader.resolve(current.issuance));
 assert.equal(f.stats.generate,1);
});
for(const crash of ['before-claim','after-claim','before-complete','after-complete'])test('synthetic '+crash+' lost ACK never remints or extends original identity',async()=>{
 const f=fixture(crash);if(crash==='after-complete'){
  const first=await f.owner.issue({intent});assert.deepEqual(await f.create().issue({intent}),first);assert.equal(f.stats.generate,1);return;
 }
 await assert.rejects(f.owner.issue({intent}),/MODEL_GRANT_UNKNOWN/);const generated=f.stats.generate;
 await assert.rejects(f.owner.issue({intent}),/MODEL_GRANT_UNKNOWN/);assert.equal(f.stats.generate,generated);
 if(crash!=='before-claim')await assert.rejects(f.create().issue({intent}),/MODEL_GRANT_UNKNOWN/);
 assert.equal(f.stats.generate,crash==='before-complete'?1:0);
});
test('lost material acknowledgement retains UNKNOWN across owner recreation and never invokes generation or status again',async()=>{
 const f=fixture();f.state.loseMaterialAck=true;await assert.rejects(f.owner.issue({intent}),e=>e.message==='MODEL_GRANT_UNKNOWN');
 await assert.rejects(f.create().issue({intent}),/MODEL_GRANT_UNKNOWN/);assert.equal(f.stats.generate,1);assert.equal(f.store.snapshot().get(intent.issuanceKey).state,'CLAIMED');
});
test('same-key request/expiry/binding changes refuse without generation; cancellation before admission has no effects',async()=>{
 const f=fixture();await f.owner.issue({intent});
 for(const i of [{...intent,requestSha256:'b'.repeat(64)},{...intent,expiresAtMs:intent.expiresAtMs+1},{...intent,binding:{...binding,actorId:'other'}}])await assert.rejects(f.owner.issue({intent:i}));
 assert.equal(f.stats.generate,1);const g=fixture();await assert.rejects(g.owner.issue({intent,signal:AbortSignal.abort()}),/MODEL_GRANT_CANCELLED/);assert.equal(g.stats.generate,0);assert.equal(g.store.size(),0);
});
test('concurrent owners share one identity; any in-flight uncertainty does not mint a second material',async()=>{
 const f=fixture(),answers=await Promise.allSettled([f.owner.issue({intent}),f.create().issue({intent})]);assert.ok(answers.some(a=>a.status==='fulfilled'));
 const retained=await f.create().issue({intent});for(const a of answers)if(a.status==='fulfilled')assert.deepEqual(a.value,retained);assert.equal(f.stats.generate,1);assert.equal(f.store.size(),1);
});
for(const state of ['ABSENT','EXPIRED','REVOKED','UNKNOWN'])test('issued material '+state+' withholds credential without regeneration',async()=>{
 const f=fixture();await f.owner.issue({intent});f.state.retrieveState=state;await assert.rejects(f.create().issue({intent}));assert.equal(f.stats.generate,1);
});
test('original expiry refuses retained credential and does not generate or retrieve again',async()=>{
 const f=fixture();await f.owner.issue({intent});f.state.now=intent.expiresAtMs;const before=f.stats.retrieve;await assert.rejects(f.create().issue({intent}));assert.equal(f.stats.generate,1);assert.equal(f.stats.retrieve,before);
});
test('file authority composition is inert and model directory/reference purpose cannot be confused with task',async()=>{
 const directory=resolve('synthetic-owner-material'),task=createFileCapabilityAuthority({directory}),model=createFileModelMaterialAuthority({taskMaterialDirectory:directory});
 assert.equal(task.directory,directory);assert.equal(model.directory,join(directory,'model-grants'));assert.notEqual(task.directory,model.directory);
 await assert.rejects(model.retrieve({materialRef:'material:'+intent.issuanceKey,grantId:id(100)}),/MODEL_MATERIAL_REFUSED/);
 await assert.rejects(task.retrieve({materialRef:'model-material:v1:'+intent.issuanceKey,grantId:id(100)}),/CAPABILITY_AUTHORITY_REFUSED/);
 let queries=0;const owner=createPostgresModelGrants({pool:{async query(){queries++;throw Error('no SQL allowed');}},taskMaterialDirectory:directory,now:()=>at});
 assert.equal(typeof owner.issue,'function');assert.equal(typeof owner.read,'function');assert.equal(typeof owner.resolve,'function');assert.equal(queries,0,'startup construction neither queries nor generates');
 await assert.rejects(owner.issue({intent}),/MODEL_GRANT_UNKNOWN/);assert.equal(queries,1,'unavailable current store cannot reach material generation');
});
for(const operation of ['generate','status'])test('model material '+operation+' refuses a different issuance key reference',async()=>{
 const returned={grantId:id(200),capability:'synthetic-opaque-material-must-not-be-used',capabilitySha256:'a'.repeat(64),materialRef:'material:'+'f'.repeat(64)};
 const authority=createModelMaterialAuthority({authority:{async generate(){const {capabilitySha256,...r}=returned;return r;},async status(){const {capability,...r}=returned;return {state:'PRESENT',...r};},async retrieve(){assert.fail('no retrieval after key substitution');}}});
 await assert.rejects(authority[operation](intent),/MODEL_MATERIAL_REFUSED/);
});
