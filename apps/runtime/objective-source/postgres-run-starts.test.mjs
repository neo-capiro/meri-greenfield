/** SYNTHETIC pg pool protocol only: adapter control flow, fixed queries, lock order and failure classification. These checks
 * do not run SQL or prove PostgreSQL locking, durability, triggers, roles or migration 0002 execution. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {createPostgresObjectiveRunStartStore} from './postgres-run-starts.mjs';
import {runStartFixture,syntheticObjectivePool,id,NOW} from './test/run-start-fixture.mjs';
const unavailable=e=>e?.code==='OBJECTIVE_RUN_START_UNAVAILABLE',conflict=e=>e?.code==='OBJECTIVE_RUN_START_CONFLICT',unknown=e=>e?.code==='OBJECTIVE_RUN_START_ACK_UNKNOWN';
const inserts=s=>s.trace.filter(t=>t.text.startsWith('INSERT'));
function setup(options={}){
 const f=runStartFixture(),clock={now:NOW},{pool,state}=syntheticObjectivePool({now:()=>clock.now});
 const create=(extra={})=>createPostgresObjectiveRunStartStore({enabled:true,pool,tenantId:f.tenantId,now:()=>clock.now,...options,...extra});
 return {f,clock,pool,state,create,store:create()};
}

test('disabled or incomplete configuration is unavailable and never connects',async()=>{
 const s=setup();
 for(const extra of [{enabled:false},{enabled:'true'},{tenantId:''},{tenantId:' t'},{maxRequestMs:3001},{pool:{}},{now:'clock'},{extra:1}]){
  const store=s.create(extra);assert.equal(store.available(),false);
  await assert.rejects(store.putOnce({record:s.f.record}),unavailable);await assert.rejects(store.read({binding:s.f.binding}),unavailable);
 }
 assert.equal(createPostgresObjectiveRunStartStore().available(),false);assert.equal(s.state.connects,0);
});

test('a new start is one transaction: conversation lock, job lock, occupancy probes, insert, commit; replay is read-only',async()=>{
 const s=setup(),first=await s.store.putOnce({record:s.f.record});
 assert.deepEqual(first,{state:'STARTED',created:true,record:s.f.record});assert.equal(s.state.commits,1);assert.equal(inserts(s.state).length,1);
 const texts=s.state.trace.map(t=>t.text),at=p=>texts.findIndex(p);
 const conv=s.state.trace.findIndex(t=>t.text.includes('pg_advisory_xact_lock')&&t.values[0]===`${s.f.tenantId}:${s.f.binding.conversationId}`);
 const job=s.state.trace.findIndex(t=>t.text.includes('pg_advisory_xact_lock')&&t.values[0]===`meri_objective_source:run-start:${s.f.generationJobId}`);
 const probes=['runs','initial_inputs','initial_run_bindings'].map(table=>at(t=>t.includes(`meri_conversations.${table} `)));
 const insert=at(t=>t.startsWith('INSERT')),commit=at(t=>t==='COMMIT');
 assert.ok(conv>0&&conv<job&&probes.every(p=>p>job&&p<insert)&&insert<commit,'conversation lock, job lock, probes, insert, commit');
 assert.equal(texts.some(t=>/^(UPDATE|DELETE)|FOR UPDATE/u.test(t)),false,'no UPDATE, DELETE or row lock is ever issued');
 s.clock.now=s.f.record.effectExpiresAtMs+1;
 assert.deepEqual(await s.create().putOnce({record:s.f.record}),{state:'STARTED',created:false,record:s.f.record},'identical replay, even after the effect window');
 assert.equal(inserts(s.state).length,1);
 assert.deepEqual(await s.store.read({binding:s.f.binding}),{state:'STARTED',record:s.f.record});
 assert.equal(s.state.clients.every(c=>c.releaseCount===1&&!c.destroyed),true);assert.equal(s.state.poolEnds,0);
});

test('a start never adopts an existing conversation, and a different record for the same job conflicts',async()=>{
 for(const table of ['runs','initial_inputs','initial_run_bindings']){
  const s=setup();s.state.occupied.add(`${table}:${s.f.tenantId}:${s.f.binding.conversationId}`);
  await assert.rejects(s.store.putOnce({record:s.f.record}),conflict);assert.equal(inserts(s.state).length,0);
  assert.equal(s.state.clients.every(c=>c.releaseCount===1&&!c.destroyed),true,'a settled conflict rolls back and returns a reusable client');
 }
 const s=setup();await s.store.putOnce({record:s.f.record});
 const other=runStartFixture({prompt:'Another published prompt.'}).record;assert.equal(other.generationJobId,s.f.record.generationJobId);
 await assert.rejects(s.store.putOnce({record:other}),conflict);
 const foreign=setup(),row=(await foreign.store.putOnce({record:foreign.f.record}),foreign.state.runStarts.get(foreign.f.generationJobId));row.tenant_id=id(99);
 await assert.rejects(foreign.store.putOnce({record:foreign.f.record}),e=>conflict(e)&&!JSON.stringify(e).includes(id(99)));
});

test('an expired selection is never started, a foreign tenant is refused before connecting',async()=>{
 const s=setup();s.clock.now=s.f.record.effectExpiresAtMs;await assert.rejects(s.store.putOnce({record:s.f.record}),unavailable);assert.equal(inserts(s.state).length,0);
 const t=setup({tenantId:id(9)});await assert.rejects(t.store.putOnce({record:t.f.record}),unavailable);await assert.rejects(t.store.read({binding:t.f.binding}),unavailable);
 assert.equal(t.state.connects,0);
});

test('read is ABSENT for ordinary chat and refuses a row whose full binding differs or whose bytes drifted',async()=>{
 const s=setup();assert.deepEqual(await s.store.read({binding:s.f.binding}),{state:'ABSENT'});
 await s.store.putOnce({record:s.f.record});
 await assert.rejects(s.store.read({binding:{...s.f.binding,attemptId:id(70)}}),unavailable);
 s.state.runStarts.get(s.f.generationJobId).record_sha256='0'.repeat(64);
 await assert.rejects(s.store.read({binding:s.f.binding}),unavailable);await assert.rejects(s.store.putOnce({record:s.f.record}),unavailable);
});

test('a lost COMMIT acknowledgement is UNKNOWN and sticky; only the exact durable row resolves it',async()=>{
 const lost=setup();lost.state.commitFailure='before';
 await assert.rejects(lost.store.putOnce({record:lost.f.record}),unknown);assert.equal(lost.state.runStarts.size,0);
 assert.deepEqual(await lost.store.read({binding:lost.f.binding}),{state:'UNKNOWN'},'never ABSENT after an ambiguous write');
 await assert.rejects(lost.store.putOnce({record:lost.f.record}),unknown,'never claims again in this instance');assert.equal(inserts(lost.state).length,1);
 assert.deepEqual(await lost.create().read({binding:lost.f.binding}),{state:'ABSENT'},'a fresh instance relies on the serialized read');
 const landed=setup();landed.state.commitFailure='after';
 await assert.rejects(landed.store.putOnce({record:landed.f.record}),unknown);assert.equal(landed.state.runStarts.size,1);
 assert.deepEqual(await landed.store.read({binding:landed.f.binding}),{state:'STARTED',record:landed.f.record},'the exact durable row resolves it');
 assert.deepEqual(await landed.store.putOnce({record:landed.f.record}),{state:'STARTED',created:false,record:landed.f.record});
});

test('cancellation before connect never queries; a release failure after commit is UNKNOWN',async()=>{
 const s=setup(),controller=new AbortController();controller.abort();
 await assert.rejects(s.store.putOnce({record:s.f.record,signal:controller.signal}),unavailable);assert.equal(s.state.trace.length,0);
 const r=setup();r.state.releaseThrows=true;await assert.rejects(r.store.putOnce({record:r.f.record}),unknown);
});
