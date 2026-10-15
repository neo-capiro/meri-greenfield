/** Synthetic (scripted SQL protocol fixture for the conversation store; scripted ECS and budget admission): the stop-only original
 * retirement over the real canonical allocator and allocation journal. */
import test from 'node:test';import assert from 'node:assert/strict';
import {lifecycleFixture} from '../../../control/conversations/test/lifecycle-fixture.mjs';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createOriginalRetirement} from '../remote-composition.mjs';
import {originalFacts,fakeEcs,syntheticAdmission,processAllocator} from './original-retirement-fixture.mjs';
const check=()=>{};
async function fixture(t,{config:override}={}){
 const o=originalFacts(),f=await lifecycleFixture();t.after(()=>f.close());await f.service.submit({credential:f.credential,input:f.input});
 const ecs=fakeEcs(o.original,o.config.taskRequest),budget=syntheticAdmission(o),key={binding:o.original.binding,allocationKey:o.original.executionKey};
 const record=async()=>(await f.store.allocations.read(key,check)).record;
 /** An earlier process claimed and launched the original, then crashed before admission: the durable state is ALLOCATED. */
 async function allocated(config=override??o.config){await f.store.allocations.claim(processAllocator({store:f.store,original:o.original,config,client:ecs.client,admission:budget.admission}).intent,check);await f.store.allocations.record({...key,state:'ALLOCATED',resource:ecs.seed()},check);}
 const retirement=()=>createOriginalRetirement(o.retirement(f.store,ecs.client,{admission:budget.admission}));
 const effects=()=>({runs:ecs.state.runs,stops:ecs.state.stops,revokes:budget.state.revokes,admits:budget.state.admits});
 return {o,f,ecs,budget,record,allocated,retirement,effects};}
test('stop-only retirement rebuilt from the exact durable facts revokes, contains and records RETIRED, and can never allocate',async t=>{
 const x=await fixture(t);await x.allocated();const owner=x.retirement();assert.deepEqual(Object.keys(owner).sort(),['original','stop'],'stop is the only effect it exposes');assert.deepEqual(owner.original,x.o.original);
 assert.deepEqual(await owner.stop(),{physicalStopProven:true});const r=await x.record();assert.equal(r.state,'RETIRED');assert.equal(r.resource.physicalStopProven,true);assert.ok(x.ecs.stopped());
 assert.deepEqual(x.effects(),{runs:0,stops:1,revokes:1,admits:0});
 assert.deepEqual(await owner.stop(),{physicalStopProven:true});assert.deepEqual(x.effects(),{runs:0,stops:1,revokes:1,admits:0},'an already proven retirement is not repeated');});
test('a durable allocation that differs from the rebuilt facts is refused without any effect',async t=>{
 const x=await fixture(t),config=structuredClone(x.o.config);config.taskRequest.networkConfiguration.awsvpcConfiguration.securityGroups=['sg-9999'];await x.allocated(config);
 await assert.rejects(x.retirement().stop(),/ALLOCATION_REPLAY_REFUSED/);assert.equal((await x.record()).state,'ALLOCATED');assert.deepEqual(x.effects(),{runs:0,stops:0,revokes:0,admits:0});});
test('an uncertain stop or revocation stays UNKNOWN with nothing recorded; a later attempt resumes from the durable state',async t=>{
 const x=await fixture(t);await x.allocated();const owner=x.retirement();
 x.ecs.state.stopWorks=false;await assert.rejects(owner.stop(),/ALLOCATION_CLEANUP_UNKNOWN/);assert.equal((await x.record()).state,'ALLOCATED');
 x.ecs.state.stopWorks=true;x.budget.state.revokeWorks=false;await assert.rejects(owner.stop(),/ALLOCATION_CLEANUP_UNKNOWN/);assert.ok(x.ecs.stopped(),'stopped but not revoked');assert.equal((await x.record()).state,'ALLOCATED','no RETIRED without revocation');
 x.budget.state.revokeWorks=true;x.ecs.state.outage=true;await assert.rejects(owner.stop());assert.equal((await x.record()).state,'ALLOCATED');
 x.ecs.state.outage=false;assert.deepEqual(await x.retirement().stop(),{physicalStopProven:true});assert.equal((await x.record()).state,'RETIRED');assert.equal(x.effects().runs,0);});
test('absent or foreclosed allocation: there is nothing to stop and no effect is attempted',async t=>{
 const x=await fixture(t);await assert.rejects(x.retirement().stop(),/ALLOCATION_UNKNOWN/);
 await x.f.service.cancel({credential:x.f.credential});assert.equal((await x.record()).state,'FORECLOSED');await assert.rejects(x.retirement().stop(),/ALLOCATION_UNKNOWN/);
 assert.deepEqual(x.effects(),{runs:0,stops:0,revokes:0,admits:0});assert.equal(x.ecs.state.lists+x.ecs.state.describes,0);});
test('a run that turned terminal before its claim never allocates: the canonical allocator is refused at the claim, before RunTask or admission',async t=>{
 const x=await fixture(t);await x.f.service.cancel({credential:x.f.credential});
 await assert.rejects(processAllocator({store:x.f.store,original:x.o.original,config:x.o.config,client:x.ecs.client,admission:x.budget.admission}).allocate(),/NATIVE_PREPARATION_STATE_REFUSED/);
 assert.deepEqual(x.effects(),{runs:0,stops:0,revokes:0,admits:0});assert.equal((await x.record()).state,'FORECLOSED');assert.equal(hash((await x.record()).binding),x.o.original.executionKey);});
