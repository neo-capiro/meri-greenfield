/** Synthetic hard control restart (scripted SQL protocol fixture; scripted ECS and budget admission): a fresh first-run candidate process
 * that never held the original's controller stops it through the real prepared kickoff, run reconciler, lifecycle store, allocation
 * journal, canonical allocator and the stop-only original retirement. A "crash" is modelled by abandoning the earlier process without
 * any close; this is not a real process-kill, ECS or PostgreSQL test. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture,id} from '../../control/conversations/test/lifecycle-fixture.mjs';
import {assemblePreparedCandidate} from '../prepared-candidate.mjs';
import {createOriginalRetirement} from '../native-authority/remote-composition.mjs';
import {createReconcileActivity} from '../temporal-worker.mjs';
import {originalFacts,fakeEcs,syntheticAdmission,processAllocator} from '../native-authority/test/original-retirement-fixture.mjs';
const check=()=>{};
async function crashed(t,{admitted=false,state='running'}={}){
 const o=originalFacts(),f=await lifecycleFixture(),binding=o.original.binding,key={binding,allocationKey:o.original.executionKey},ecs=fakeEcs(o.original,o.config.taskRequest),budget=syntheticAdmission(o),processes=[];let n=700,retirements=0;
 t.after(async()=>{for(const p of processes)await p.close().catch(()=>{});f.close();});
 await f.service.submit({credential:f.credential,input:f.input});const allocator=processAllocator({store:f.store,original:o.original,config:o.config,client:ecs.client,admission:budget.admission});
 // The earlier process: the canonical allocator claimed and launched the original (and, when admitted, installed its grants), then died.
 if(admitted)await allocator.allocate();else{await f.store.allocations.claim(allocator.intent,check);await f.store.allocations.record({...key,state:'ALLOCATED',resource:ecs.seed()},check);}
 for(const s of ['starting','running'].slice(0,state==='queued'?0:2))await f.service.publish({credential:f.credential,binding,event:{eventId:id(n++),createdAt:new Date().toISOString(),type:'run.status',data:{state:s,reasonCode:null}}});
 if(state==='failed')await f.service.publish({credential:f.credential,binding,event:{eventId:id(n++),createdAt:new Date().toISOString(),type:'run.status',data:{state:'failed',reasonCode:'EXECUTION_FAILED'}}});
 const before={runs:ecs.state.runs,admits:budget.state.admits};
 /** A fresh control process: no controller, never allocates (its allocation port fails the test if used). */
 function fresh(){let allocations=0;const p=assemblePreparedCandidate({configuration:o.f.configuration,pool:f.pool,ecs:ecs.client,objects:{get(){throw Error('No objects');},put(){throw Error('No objects');}},credentials:o.f.secret,fetchImpl:async()=>{throw Error('No identity');},
  allocate:async()=>{allocations++;throw Error('a restarted process never allocates');},retireOriginal:configuration=>{retirements++;return createOriginalRetirement({...configuration,admission:budget.admission});}});processes.push(p);return {native:p.native,allocations:()=>allocations};}
 const stop=p=>p.native.call('execution/kickoff/stop',{binding,executionId:o.original.executionId});
 const history=async()=>f.store.read(binding,{after:0,limit:100},check),record=async()=>(await f.store.allocations.read(key,check)).record;
 const terminals=async()=>(await history()).events.filter(e=>e.type==='run.status'&&['failed','cancelled','completed'].includes(e.data.state));
 const effects=()=>({runs:ecs.state.runs-before.runs,admits:budget.state.admits-before.admits,stops:ecs.state.stops,revokes:budget.state.revokes});
 return {o,f,ecs,budget,binding,fresh,stop,history,record,terminals,effects,retirements:()=>retirements};}
test('review reproduction: a fresh process with durable ALLOCATED state and no controller retires the original and then settles the run',async t=>{
 const x=await crashed(t),p=x.fresh();assert.equal((await x.record()).state,'ALLOCATED');
 const receipt=await x.stop(p);assert.deepEqual(receipt,{binding:x.binding,executionId:x.o.original.executionId,expiresAtMs:x.o.original.expiresAtMs});
 const r=await x.record();assert.equal(r.state,'RETIRED');assert.equal(r.resource.physicalStopProven,true);assert.ok(x.ecs.stopped());
 assert.deepEqual((await x.terminals()).map(e=>e.data),[{state:'failed',reasonCode:'ATTEMPT_LOST'}]);assert.deepEqual(x.effects(),{runs:0,admits:0,stops:1,revokes:1});assert.equal(p.allocations(),0);
 assert.deepEqual(await x.stop(p),receipt,'a repeated stop is idempotent');assert.equal((await x.terminals()).length,1);assert.deepEqual(x.effects(),{runs:0,admits:0,stops:1,revokes:1});});
test('a crashed process that held an admitted allocation (real canonical allocation, grants installed) is retired by a fresh process before settling',async t=>{
 const x=await crashed(t,{admitted:true}),r0=await x.record();assert.equal(r0.state,'ADMITTED');assert.equal(r0.resource.grantFactsJsons.length,1);
 await x.stop(x.fresh());assert.equal((await x.record()).state,'RETIRED');assert.deepEqual((await x.terminals()).map(e=>e.data.reasonCode),['ATTEMPT_LOST']);assert.deepEqual(x.effects(),{runs:0,admits:0,stops:1,revokes:1});});
test('a run already terminal whose original was never retired is retired by a fresh process and left as it was',async t=>{
 const x=await crashed(t,{state:'failed'});await x.stop(x.fresh());assert.equal((await x.record()).state,'RETIRED');assert.deepEqual((await x.terminals()).map(e=>e.data.reasonCode),['EXECUTION_FAILED']);});
test('a restart whose stop is uncertain leaves UNKNOWN: the stop is refused, nothing is settled and the allocation stays unretired',async t=>{
 for(const mode of ['stop','revocation']){const x=await crashed(t),p=x.fresh();if(mode==='stop')x.ecs.state.stopWorks=false;else x.budget.state.revokeWorks=false;
  await assert.rejects(x.stop(p),/PREPARED_CANDIDATE_REFUSED/);assert.equal((await x.record()).state,'ALLOCATED');assert.equal((await x.history()).run.state,'running');assert.equal((await x.terminals()).length,0);assert.equal(p.allocations(),0);assert.equal(x.effects().runs,0);}});
test('re-entry after finite reconciliation exhaustion: once the stop owner recovers, a later stop resumes settlement from durable state',async t=>{
 const x=await crashed(t),p=x.fresh();x.ecs.state.outage=true;
 await assert.rejects(x.stop(p));const reconcile=createReconcileActivity({native:p.native,timeoutMs:5000});for(let attempt=0;attempt<2;attempt++)await assert.rejects(reconcile({binding:x.binding}),/BROKER_RECONCILE_UNKNOWN|PREPARED_CANDIDATE_REFUSED/);
 assert.equal((await x.history()).run.state,'running');assert.equal((await x.record()).state,'ALLOCATED');assert.equal((await x.terminals()).length,0,'exhausted: still a barrier, nothing written');
 x.ecs.state.outage=false;assert.deepEqual(await reconcile({binding:x.binding}),{state:'reconciled'},'a later reconcile attempt on the same process is a fresh attempt, not a memoized failure');
 assert.equal((await x.record()).state,'RETIRED');assert.deepEqual((await x.terminals()).map(e=>e.data.reasonCode),['ATTEMPT_LOST']);
 const later=x.fresh();await x.stop(later);assert.equal((await x.terminals()).length,1);assert.equal(x.effects().stops,1,'a later process finds it settled without repeating the stop');assert.equal(p.allocations()+later.allocations(),0);assert.ok(x.retirements()>=4);});
