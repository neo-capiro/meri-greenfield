/** SYNTHETIC pg pool protocol only. These checks qualify adapter control flow,
 * fixed query shapes, lock order and failure classification. They do not run SQL,
 * prove PostgreSQL locking/durability, roles, triggers or migration execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresObjectiveCustodyStore} from './postgres-custody.mjs';
import {createObjectiveSourceCustody} from './custody.mjs';
import {postgresCustodyFixture} from './test/postgres-custody-fixture.mjs';
import {id} from './test/custody-fixture.mjs';
const unavailable=/OBJECTIVE_SOURCE_UNAVAILABLE/;
const ackUnknown=e=>e?.code==='OBJECTIVE_CUSTODY_ACK_UNKNOWN';
const conflict=e=>e?.code==='OBJECTIVE_CUSTODY_CONFLICT';
const writes=p=>p.state.trace.filter(t=>/^(INSERT|UPDATE) /u.test(t.text));
const index=(p,predicate)=>p.state.trace.findIndex(predicate);

test('disabled or incomplete configuration is unavailable and never connects',async()=>{
 const p=postgresCustodyFixture();
 for(const options of [{enabled:false},{enabled:'true'},{tenantId:''},{tenantId:' x'},{maxRequestMs:3001},{pool:{}},{now:'clock'},{allocateFence:'fence'}]){
  const store=p.create(options);assert.equal(store.available(),false);
  await assert.rejects(store.read({generationJobId:p.input.generationJobId}),unavailable);
  await assert.rejects(store.putOnce(p.input),unavailable);await assert.rejects(store.readByIssuance(p.reverse),unavailable);
 }
 assert.equal(createPostgresObjectiveCustodyStore().available(),false);assert.equal(p.state.connects,0);
});

test('two-phase claim then commit uses the fixed lock order and returns only the exact record',async()=>{
 const p=postgresCustodyFixture(),store=p.create(),answer=await store.putOnce(p.input);
 assert.equal(answer.state,'COMMITTED');assert.deepEqual(answer.record,p.record);
 const row=p.state.rows.get(p.record.generationJobId);assert.equal(row.state,'COMMITTED');assert.equal(row.version,'2');assert.equal(row.claim_fence,id(80));
 assert.deepEqual(writes(p).map(t=>t.text.slice(0,6)),['INSERT','UPDATE']);assert.equal(p.state.commits,2);
 const b=p.record.binding;
 for(const client of [1,2]){
  const at=predicate=>index(p,t=>t.client===client&&predicate(t));
  const conversation=at(t=>t.text.includes('pg_advisory_xact_lock')&&t.values[0]===`${b.tenantId}:${b.conversationId}`);
  const run=at(t=>t.text.includes('FROM meri_conversations.runs')),issuance=at(t=>t.text.includes('FROM meri_conversations.run_issuances'));
  const gate=at(t=>t.text.includes('pg_advisory_xact_lock')&&t.values[0]===`meri_objective_source:custody:${p.record.generationJobId}`);
  const write=at(t=>/^(INSERT|UPDATE) /u.test(t.text)),commit=at(t=>t.text==='COMMIT');
  assert.ok(conversation>0&&conversation<run&&run<issuance&&issuance<gate&&gate<write&&write<commit,'conversation, run, issuance, global fence, write, commit');
  assert.ok(p.state.trace.filter(t=>t.client===client).every(t=>t.queryTimeout>=1&&t.queryTimeout<=3000));
 }
 assert.equal(p.state.clients.every(c=>c.releaseCount===1&&!c.destroyed),true);assert.equal(p.state.poolEnds,0);
 assert.deepEqual(await store.read({generationJobId:p.record.generationJobId}),answer);
 assert.deepEqual(await p.create().readByIssuance(p.reverse),answer);
});

test('committed identical replay is read-only, including after original execution expiry',async()=>{
 const p=postgresCustodyFixture();p.seed('COMMITTED');p.f.state.now=p.record.issued.issuance.expiresAtMs+1;
 const answer=await p.create().putOnce(p.input);assert.equal(answer.state,'COMMITTED');assert.deepEqual(answer.record,p.record);
 assert.equal(writes(p).length,0);
});

test('a durable CLAIMED row is UNKNOWN, exposes no private record and is never resumed',async()=>{
 const p=postgresCustodyFixture();p.seed('CLAIMED');const store=p.create();
 assert.deepEqual(await store.putOnce(p.input),{state:'UNKNOWN'});assert.equal(writes(p).length,0);
 const read=await store.read({generationJobId:p.record.generationJobId});assert.deepEqual(read,{state:'UNKNOWN'});
 assert.equal(JSON.stringify(read).includes(p.record.acceptedRequest.prompt),false);
 assert.deepEqual(await store.readByIssuance(p.reverse),{state:'UNKNOWN'});assert.equal(p.state.rows.get(p.record.generationJobId).state,'CLAIMED');
});

test('global job and unique issuance collisions are generic conflicts without foreign data',async()=>{
 const p=postgresCustodyFixture();p.seed('COMMITTED',{tenant_id:'tenant-foreign'});
 await assert.rejects(p.create().putOnce(p.input),e=>conflict(e)&&!JSON.stringify(e).includes('tenant-foreign'));assert.equal(writes(p).length,0);
 const q=postgresCustodyFixture(),other=q.seed('COMMITTED');q.state.rows.delete(q.record.generationJobId);q.state.rows.set(id(99),{...other,generation_job_id:id(99)});
 await assert.rejects(q.create().putOnce(q.input),conflict);assert.equal(q.state.rows.has(q.record.generationJobId),false);
 assert.equal(q.state.clients.every(c=>c.releaseCount===1&&!c.destroyed),true,'settled semantic conflict rolls back and returns a reusable client');
});

test('corrupt prior rows and drifting canonical sources refuse before any write',async()=>{
 const corrupt=postgresCustodyFixture();corrupt.seed('COMMITTED',{record_sha256:'0'.repeat(64)});
 await assert.rejects(corrupt.create().putOnce(corrupt.input),unavailable);await assert.rejects(corrupt.create().read({generationJobId:corrupt.record.generationJobId}),unavailable);
 const changes=[
  p=>{p.state.issuanceChange=r=>{r.state='CLAIMED';};},
  p=>{p.state.issuanceChange=r=>{r.facts_sha256='0'.repeat(64);};},
  p=>{p.state.issuanceChange=r=>{r.binding={...r.binding,writerFence:2};};},
  p=>{p.state.runChange=r=>{r.request={...r.request,prompt:'changed'};};},
  p=>{p.state.runChange=r=>{r.projection={...r.projection,state:'completed'};};},
  p=>{p.f.state.now=p.record.issued.issuance.expiresAtMs;},
 ];
 for(const change of changes){
  const p=postgresCustodyFixture();change(p);await assert.rejects(p.create().putOnce(p.input),unavailable);
  assert.equal(writes(p).length,0);assert.equal(p.state.rows.size,0);
 }
});

test('lost claim acknowledgement after the write is ACK_UNKNOWN and stays UNKNOWN',async()=>{
 const p=postgresCustodyFixture(),store=p.create();p.state.commitFailure={kind:'claim',mode:'after'};
 await assert.rejects(store.putOnce(p.input),ackUnknown);assert.equal(p.state.clients[0].destroyed,true,'ambiguous client is discarded');
 assert.equal(p.state.rows.get(p.record.generationJobId).state,'CLAIMED');
 assert.deepEqual(await store.read({generationJobId:p.record.generationJobId}),{state:'UNKNOWN'});
 assert.deepEqual(await store.putOnce(p.input),{state:'UNKNOWN'});assert.equal(writes(p).length,1,'no second claim or finalization');
});

test('sticky uncertainty: a rolled-back ambiguous claim never becomes ABSENT or a second claim in this instance',async()=>{
 const p=postgresCustodyFixture(),store=p.create();p.state.commitFailure={kind:'claim',mode:'before'};
 await assert.rejects(store.putOnce(p.input),ackUnknown);assert.equal(p.state.rows.size,0);
 assert.deepEqual(await store.read({generationJobId:p.record.generationJobId}),{state:'UNKNOWN'});
 assert.deepEqual(await store.readByIssuance(p.reverse),{state:'UNKNOWN'});
 await assert.rejects(store.putOnce(p.input),ackUnknown);assert.equal(writes(p).length,1,'no further INSERT after uncertainty');
 // No tombstone is invented: a restarted instance relies on a serialized read.
 assert.deepEqual(await p.create().read({generationJobId:p.record.generationJobId}),{state:'ABSENT'});
});

test('lost finalization acknowledgement is recovered only by exact COMMITTED readback',async()=>{
 const p=postgresCustodyFixture(),store=p.create();p.state.commitFailure={kind:'final',mode:'after'};
 await assert.rejects(store.putOnce(p.input),ackUnknown);
 const recovered=await store.read({generationJobId:p.record.generationJobId});assert.equal(recovered.state,'COMMITTED');assert.deepEqual(recovered.record,p.record);
 const q=postgresCustodyFixture(),other=q.create();q.state.commitFailure={kind:'final',mode:'before'};
 await assert.rejects(other.putOnce(q.input),ackUnknown);assert.equal(q.state.rows.get(q.record.generationJobId).state,'CLAIMED');
 assert.deepEqual(await other.read({generationJobId:q.record.generationJobId}),{state:'UNKNOWN'});
});

test('abort racing a settled COMMIT is ACK_UNKNOWN, never success or absence',async()=>{
 const p=postgresCustodyFixture(),store=p.create(),controller=new AbortController();
 p.state.afterCommit=kind=>{if(kind==='final')controller.abort();};
 await assert.rejects(store.putOnce({...p.input,signal:controller.signal}),ackUnknown);
 assert.equal(p.state.rows.get(p.record.generationJobId).state,'COMMITTED');
 assert.equal((await store.read({generationJobId:p.record.generationJobId})).state,'COMMITTED');
});

function abortingOnRelease(p,controller,clientNumber){
 return {async connect(){const client=await p.pool.connect();if(client.id!==clientNumber)return client;
  return {query:config=>client.query(config),release(error){controller.abort();return client.release(error);},end:()=>client.end()};}};
}

test('final release gate: abort during client release withholds a read and makes a write ACK_UNKNOWN',async()=>{
 const p=postgresCustodyFixture();p.seed('COMMITTED');const readAbort=new AbortController();
 const reader=createPostgresObjectiveCustodyStore({pool:abortingOnRelease(p,readAbort,1),tenantId:p.f.binding.tenantId,now:()=>p.f.state.now,enabled:true});
 await assert.rejects(reader.read({generationJobId:p.record.generationJobId,signal:readAbort.signal}),unavailable);
 const q=postgresCustodyFixture(),writeAbort=new AbortController();
 const writer=createPostgresObjectiveCustodyStore({pool:abortingOnRelease(q,writeAbort,2),tenantId:q.f.binding.tenantId,now:()=>q.f.state.now,allocateFence:()=>id(80),enabled:true});
 await assert.rejects(writer.putOnce({...q.input,signal:writeAbort.signal}),ackUnknown);assert.equal(q.state.rows.get(q.record.generationJobId).state,'COMMITTED');
});

test('release failure after a committed claim is ACK_UNKNOWN; the client is ended, the borrowed pool never',async()=>{
 const p=postgresCustodyFixture(),store=p.create();p.state.releaseThrows=true;
 await assert.rejects(store.putOnce(p.input),ackUnknown);assert.equal(p.state.clients[0].ended,1);assert.equal(p.state.poolEnds,0);
 assert.equal(p.state.rows.get(p.record.generationJobId).state,'CLAIMED');
 await assert.rejects(store.read({generationJobId:p.record.generationJobId}),unavailable);
 p.state.releaseThrows=false;assert.deepEqual(await store.read({generationJobId:p.record.generationJobId}),{state:'UNKNOWN'});
});

test('cancellation while connecting disposes the late client with an error and issues no query',async()=>{
 const p=postgresCustodyFixture(),store=p.create(),controller=new AbortController();let resume;p.state.connectWait=new Promise(r=>{resume=r;});
 const pending=store.read({generationJobId:p.record.generationJobId,signal:controller.signal});
 await new Promise(r=>setImmediate(r));controller.abort();await assert.rejects(pending,unavailable);
 resume();await new Promise(r=>setImmediate(r));
 assert.equal(p.state.clients[0].releaseCount,1);assert.equal(p.state.clients[0].destroyed,true);assert.equal(p.state.trace.length,0);
});

test('an in-flight query that is cancelled discards the client and does not roll back on it',async()=>{
 const p=postgresCustodyFixture(),store=p.create(),controller=new AbortController();
 p.state.queryHook=item=>{if(item.text.startsWith('INSERT')){controller.abort();return new Promise(()=>{});}};
 await assert.rejects(store.putOnce({...p.input,signal:controller.signal}),unavailable);
 assert.equal(p.state.clients[0].destroyed,true);assert.equal(p.state.trace.some(t=>t.text==='ROLLBACK'),false);assert.equal(p.state.rows.size,0);
});

test('reverse lookup requires the exact issuance key, full binding and facts digest',async()=>{
 const p=postgresCustodyFixture(),store=p.create();
 assert.deepEqual(await store.readByIssuance(p.reverse),{state:'ABSENT'});
 await assert.rejects(store.readByIssuance({...p.reverse,factsSha256:'0'.repeat(64)}),unavailable);
 await assert.rejects(store.readByIssuance({...p.reverse,binding:{...p.reverse.binding,writerFence:2}}),unavailable);
 await assert.rejects(store.readByIssuance({...p.reverse,binding:{...p.reverse.binding,tenantId:id(70)},issuanceKey:p.reverse.issuanceKey}),unavailable);
 p.seed('COMMITTED');const found=await store.readByIssuance(p.reverse);assert.equal(found.state,'COMMITTED');assert.deepEqual(found.record,p.record);
});

test('custody owner composed over the adapter publishes, reads and recovers a lost final acknowledgement',async()=>{
 for(const failure of [null,{kind:'final',mode:'after'}]){
  const p=postgresCustodyFixture();p.state.commitFailure=failure;
  const owner=createObjectiveSourceCustody({...p.f.ports,store:p.create(),enabled:true,now:()=>p.f.state.now,maxRequestMs:3000});
  const receipt=await owner.publish({issued:p.f.issued});assert.equal(receipt.generationJobId,p.record.generationJobId);
  assert.equal(p.state.rows.get(p.record.generationJobId).state,'COMMITTED');assert.equal(writes(p).length,2);
  const observed=await owner.read({...p.f.selector,purpose:'active-source'});assert.equal(observed.generationJobId,p.record.generationJobId);
 }
 const p=postgresCustodyFixture();p.state.commitFailure={kind:'claim',mode:'after'};
 const owner=createObjectiveSourceCustody({...p.f.ports,store:p.create(),enabled:true,now:()=>p.f.state.now,maxRequestMs:3000});
 await assert.rejects(owner.publish({issued:p.f.issued}),unavailable);await assert.rejects(owner.publish({issued:p.f.issued}),unavailable);
 assert.equal(writes(p).length,1);await assert.rejects(owner.read({...p.f.selector,purpose:'historical-source'}),unavailable);
});
