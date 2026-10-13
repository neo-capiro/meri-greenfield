import test from 'node:test';
import assert from 'node:assert/strict';
import {createCommitAckFault} from './commit-ack-fault.mjs';
import {createFreshPoolOwner} from './fresh-pool.mjs';
import {assertLocalDescriptor} from './fixture-checks.mjs';
import {runLocalActionPersistence} from './run-persistence.mjs';
import {assertLocalResultRows} from './run-persistence.mjs';
import {fixture,envelope,NOW,id} from '../fixtures.mjs';
import {prepare,event,canonicalSha256} from '../binding.mjs';
const descriptor=()=>({mode:'synthetic-local-action',host:'127.0.0.1',port:5432,database:'meri_qualification_test',user:'qualification_owner',systemIdentifier:'123456',serverStartTime:'2026-10-13T00:00:00.000Z',serverVersion:'170011',deadlineMs:Date.now()+60000,migrationSha256:{qualification:'a'.repeat(64),budget:'b'.repeat(64),invocation:'c'.repeat(64),lookup:'d'.repeat(64)}});
const selected={claim:"INSERT INTO meri_task_lookup.lookups(tenant_id) VALUES($1)",dispatch:"UPDATE meri_task_lookup.lookups SET state='DISPATCHING' WHERE lookup_id=$1",result:"UPDATE meri_task_lookup.lookups SET state='RESULT',record=$1 WHERE lookup_id=$2"};
function spy(){const calls=[],releases=[];return {calls,releases,pool:{async connect(){return{async query(...args){calls.push(args);return {rows:[],rowCount:1};},release(e){releases.push(e);}};}}};}
for(const phase of Object.keys(selected))test(`offline ${phase} fault forwards actual call then loses only one selected COMMIT ACK`,async()=>{
 const s=spy(),f=createCommitAckFault({pool:s.pool,phase}),c=await f.pool.connect(),params=['owned'];
 await c.query('BEGIN');await c.query('SELECT 1',params);await c.query('COMMIT');assert.equal(f.receipt().fired,false);
 await c.query('BEGIN');await c.query(selected[phase],params);await assert.rejects(c.query('COMMIT'),{code:'LOCAL_COMMIT_ACK_LOST'});
 assert.equal(s.calls.at(-1)[0],'COMMIT');assert.equal(s.calls.find(x=>x[0]===selected[phase])[1],params);
 const error=new Error('evict');c.release(error);assert.equal(s.releases[0],error);
 const second=await f.pool.connect();await second.query('BEGIN');await second.query(selected[phase]);await second.query('COMMIT');second.release();
 assert.deepEqual(f.receipt(),{phase,fired:true,commits:3,evictions:1});
});
test('offline failed COMMIT does not become injected ACK loss or get retried',async()=>{
 const cause=new Error('native failure');let count=0;
 const f=createCommitAckFault({phase:'claim',pool:{async connect(){return{async query(sql){if(sql==='COMMIT'){count++;throw cause;}return {};},release(){}};}}});
 const c=await f.pool.connect();await c.query('BEGIN');await c.query(selected.claim);await assert.rejects(c.query('COMMIT'),e=>e===cause);
 assert.equal(count,1);assert.equal(f.receipt().fired,false);
});
test('offline rollback clears fault selection and separate client transactions do not inherit it',async()=>{
 const s=spy(),f=createCommitAckFault({pool:s.pool,phase:'result'}),a=await f.pool.connect(),b=await f.pool.connect();
 await a.query('BEGIN');await a.query(selected.result);await b.query('BEGIN');await b.query('COMMIT');assert.equal(f.receipt().fired,false);
 await a.query('ROLLBACK');await a.query('BEGIN');await a.query('COMMIT');assert.equal(f.receipt().fired,false);
});
test('offline invalid phase refuses before connect',()=>{let connects=0;assert.throws(()=>createCommitAckFault({pool:{connect(){connects++;}},phase:'all'}));assert.equal(connects,0);});
test('offline valid local descriptor is detached and source hashes are not authority',()=>{const d=descriptor(),v=assertLocalDescriptor(d);d.migrationSha256.lookup='e'.repeat(64);assert.notEqual(v.migrationSha256.lookup,d.migrationSha256.lookup);assert(Object.isFrozen(v));});
for(const [field,value]of [['host','example.test'],['mode','production'],['database','customer'],['user','postgres'],['deadlineMs',0],['port',0]])test(`offline descriptor refuses ${field} before pool work`,async()=>{
 let calls=0;const pool={connect(){calls++;},query(){calls++;}};
 await assert.rejects(runLocalActionPersistence({descriptor:{...descriptor(),[field]:value},pool,openFreshPool(){calls++;},createCase(){calls++;}}));assert.equal(calls,0);
});
test('offline descriptor getter is not executed',()=>{let calls=0;const d=descriptor();Object.defineProperty(d,'host',{enumerable:true,get(){calls++;return'127.0.0.1';}});assert.throws(()=>assertLocalDescriptor(d));assert.equal(calls,0);});
test('offline mismatched migration bytes HOLD before any SQL or case producer',async()=>{
 let calls=0;const result=await runLocalActionPersistence({descriptor:descriptor(),pool:{connect(){calls++;},query(){calls++;}},openFreshPool(){calls++;},createCase(){calls++;}});
 assert.equal(result.status,'HOLD');assert.equal(result.failure.case,'fixture');assert.equal(result.runtimeQualified,false);assert.equal(calls,0);assert.deepEqual(result.ownedRows,[]);assert.equal(result.cleanup.borrowedPoolClosed,false);
});
test('offline fresh pool is closed exactly once and initial borrowed pool untouched',async()=>{
 let closed=0,borrowedClose=0;const initial={end(){borrowedClose++;}},pool={};
 const owner=createFreshPoolOwner({openFreshPool:async()=>({pool,close:async()=>{closed++;}}),originalPool:initial,deadlineMs:Date.now()+1000});
 assert.equal(await owner.acquire(),pool);await owner.close();await owner.close();assert.equal(closed,1);assert.equal(borrowedClose,0);assert.equal(owner.state().ownedFreshPoolsClosed,1);
});
test('offline late acquisition after owner close is cleaned once without returning a pool',async()=>{
 let resolve,closed=0;const owner=createFreshPoolOwner({openFreshPool:()=>new Promise(r=>{resolve=r;}),originalPool:{},deadlineMs:Date.now()+1000});
 const pending=owner.acquire();await owner.close();assert.equal(owner.state().acquisitionPending,true);resolve({pool:{},close:async()=>{closed++;}});await assert.rejects(pending,{code:'DEADLINE'});await owner.close();assert.equal(closed,1);
});
test('offline cancelled acquisition cleans its eventual wrapper without borrowed queries',async()=>{
 const controller=new AbortController();let resolve,closed=0;
 const owner=createFreshPoolOwner({openFreshPool:()=>new Promise(r=>{resolve=r;}),originalPool:{},deadlineMs:Date.now()+1000,signal:controller.signal});
 const pending=owner.acquire();controller.abort();resolve({pool:{},close:async()=>{closed++;}});await assert.rejects(pending,{code:'DEADLINE'});assert.equal(closed,1);
});
test('offline returning borrowed pool refuses and does not close it',async()=>{
 const pool={};let closed=0;const owner=createFreshPoolOwner({openFreshPool:async()=>({pool,close(){closed++;}}),originalPool:pool,deadlineMs:Date.now()+1000});
 await assert.rejects(owner.acquire(),{code:'LOCAL_BORROWED_POOL'});await owner.close();assert.equal(closed,0);
});
test('offline close failure is retained as cleanup UNKNOWN',async()=>{
 const owner=createFreshPoolOwner({openFreshPool:async()=>({pool:{},close:async()=>{throw new Error('private');}}),originalPool:{},deadlineMs:Date.now()+1000});
 await owner.acquire();await owner.close();assert.equal(owner.state().freshPoolCleanupUnknown,true);assert.equal(owner.state().ownedFreshPoolsClosed,0);
});

test('offline malformed extra/missing-field fresh wrapper still closes known owned resource',async()=>{
 for(const make of [close=>({pool:{query(){}},close,extra:true}),close=>({close})]){
  let count=0;const owner=createFreshPoolOwner({openFreshPool:async()=>make(async()=>{count++;}),originalPool:{},deadlineMs:Date.now()+1000});
  await assert.rejects(owner.acquire());await owner.close();assert.equal(count,1);
 }
});
for(const kind of ['expired','aborted'])test(`offline ${kind} fresh acquisition never calls factory`,async()=>{
 let calls=0;const abort=new AbortController();if(kind==='aborted')abort.abort();
 const owner=createFreshPoolOwner({openFreshPool:async()=>{calls++;return{pool:{query(){}},close(){}};},originalPool:{},deadlineMs:Date.now()+(kind==='expired'?-1:1000),signal:abort.signal});
 await assert.rejects(owner.acquire(),{code:'DEADLINE'});assert.equal(calls,0);
});
function rowFixture(){
 const f=fixture(),b=prepare(f.request,f.context,NOW),observation=envelope(b),events=[event(b,'tool.started',NOW),event(b,'tool.completed',NOW,f.context.resultReference)];
 const hash=canonicalSha256(observation),delivery=JSON.parse(f.context.deliveryJson),facts={...delivery.context,invocationId:'owned_'+id(90)},completion={factsSha256:canonicalSha256(facts),rawRequestSha256:canonicalSha256(b.request),operation:b.request.operation,invocationId:'owned_'+id(90),reservationId:id(91),argumentsSha256:b.argumentsSha256,resultSha256:hash,outputBytes:123};
 const rows={lookups:[{state:'RESULT',payload:b,record:{observation,resultSha256:hash,events}}],events:events.map((event,i)=>({event,kind:i?'terminal':'started',sequence:String(i+1),event_id:event.eventId})),invocations:[{invocation_id:completion.invocationId,reservation_id:completion.reservationId,arguments_sha256:b.argumentsSha256,completion,delivery,facts,raw_request_sha256:completion.rawRequestSha256,operation:completion.operation}],reservations:[{invocation_id:completion.invocationId,reservation_id:completion.reservationId,state:'SETTLED',hold_micro_usd:'10',charged_micro_usd:'10',output_bytes:'123'}]};
 const read={observation,resultSha256:hash,events,classification:'recommendations',acceptedTasks:false};return {rows,c:{lookup:{request:f.request,context:f.context},expectedChargeMicroUsd:10},read};
}
test('offline actual retained-row assertion accepts coherent canonical result/events/accounting',()=>{const f=rowFixture();assertLocalResultRows(f.rows,f.c,f.read);});
for(const [key,value]of [['invocationId','owned_'+id(92)],['reservationId',id(92)],['outputBytes',124]])test(`offline actual retained-row assertion rejects contradictory completion ${key}`,()=>{
 const f=rowFixture();f.rows.invocations[0].completion[key]=value;assert.throws(()=>assertLocalResultRows(f.rows,f.c,f.read));
});

for(const mutate of [
 f=>{f.rows.invocations[0].completion.factsSha256='a'.repeat(64);},
 f=>{f.rows.invocations[0].completion.rawRequestSha256='b'.repeat(64);},
 f=>{f.rows.invocations[0].completion.operation={id:'other',version:'0.2.0'};},
 f=>{f.rows.invocations[0].delivery.deliveryId='other';},
])test('offline retained invocation provenance contradiction is rejected',()=>{const f=rowFixture();mutate(f);assert.throws(()=>assertLocalResultRows(f.rows,f.c,f.read));});
