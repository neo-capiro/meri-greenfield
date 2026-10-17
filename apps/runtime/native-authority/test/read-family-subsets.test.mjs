/** Runtime eligibility DELTA over real task verification; forged catalog snapshots and synthetic gateway results only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeReadsOwner} from '../reads-owner.mjs';
import {readsFixture} from './reads-fixture.mjs';

const ref=id=>({id,version:'0.2.0'});
const selected=['query_economic_data','query_knowledge_graph'].map(ref);
const excluded=['search_federal_grants','search_federal_awards','search_client_knowledge'].map(ref);
const forged=[excluded[0],selected[0],excluded[1],excluded[2],selected[1]];
const args={query_economic_data:{source:'census',state:'TX',limit:1},query_knowledge_graph:{depth:1}};
const ids=operations=>operations.map(op=>op.id);
const code=expected=>error=>error.message===expected;

async function subsetFixture(){
 const x=await readsFixture({config:{operations:forged}}),gateway=x.ownerConfiguration.gateway;
 const state={installed:structuredClone(forged),discovered:structuredClone(forged),snapshots:0,executions:[],afterExecute:null};
 // Deliberately overclaim both upstream operation inventories. The real runtime owner must still apply its finite family subset.
 const owner=createNativeReadsOwner({...x.ownerConfiguration,gateway:{
  async readAvailability(options){
   state.snapshots++;const snapshot=await gateway.readAvailability(options);
   return {...snapshot,installation:{...snapshot.installation,operations:structuredClone(state.installed)},
    discovery:{...snapshot.discovery,operations:structuredClone(state.discovered)}};
  },
  async execute({operation,arguments:request,deliveryId}){
   state.executions.push({operation:structuredClone(operation),arguments:structuredClone(request),deliveryId});state.afterExecute?.();
   return JSON.stringify({synthetic:'runtime-subset-gateway-only',operation:operation.id});
  },
 }});
 const executeRequest=operation=>({...x.executeRequest,operation,arguments:args[operation.id]??{query:'synthetic'},deliveryId:`subset:${operation.id}`});
 return {...x,owner,subset:state,executeRequest};
}

test('runtime availability intersects forged approved/install/discovery family inventories with the two explicit operation subsets',async()=>{
 const x=await subsetFixture(),out=await x.owner.handle('availability',x.request,x.credential);
 assert.deepEqual(ids(x.config.operations),ids(forged));assert.deepEqual(ids(x.subset.installed),ids(forged));assert.deepEqual(ids(x.subset.discovered),ids(forged));
 assert.deepEqual(out.installation.operations,selected);assert.deepEqual(out.discovery.operations,selected);
 assert.equal(out.inputSha256,hash(x.request));assert.equal(x.subset.snapshots,2);assert.equal(x.subset.executions.length,0);
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);assert.ok(x.commands.every(sql=>!sql.includes('FOR UPDATE')));
});

test('both selected economic/graph operations execute through the actual runtime owner with exact request/delivery binding',async()=>{
 const x=await subsetFixture();
 for(const operation of selected){
  const request=x.executeRequest(operation),out=await x.owner.handle('execute',request,x.credential);
  assert.deepEqual(out.operation,operation);assert.equal(out.deliveryId,request.deliveryId);assert.equal(out.inputSha256,hash(request));
  assert.deepEqual(JSON.parse(out.resultJson),{synthetic:'runtime-subset-gateway-only',operation:operation.id});
  assert.equal(out.resultSha256,hash(JSON.parse(out.resultJson)));assert.equal(out.outputBytes,Buffer.byteLength(out.resultJson,'utf8'));
 }
 assert.deepEqual(x.subset.executions,selected.map(operation=>({operation,arguments:args[operation.id],deliveryId:`subset:${operation.id}`})));
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'borrowed synthetic gateway results do not claim source execution or settlement');
});

test('public grant/award and semantic-search siblings never reach gateway execution despite all three inventories claiming them',async()=>{
 const x=await subsetFixture();
 for(const operation of excluded){
  const before=x.subset.snapshots;await assert.rejects(x.owner.handle('execute',x.executeRequest(operation),x.credential),code('UNAVAILABLE'));
  assert.equal(x.subset.snapshots,before+1);assert.equal(x.subset.executions.length,0);
 }
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
});

for(const inventory of ['discovered','installed'])test(`selected operations still require current ${inventory} membership`,async()=>{
 for(const operation of selected){
  const x=await subsetFixture();x.subset[inventory]=x.subset[inventory].filter(op=>op.id!==operation.id);
  const out=await x.owner.handle('availability',x.request,x.credential),remaining=selected.filter(op=>op.id!==operation.id);
  assert.deepEqual(out.installation.operations,remaining);assert.deepEqual(out.discovery.operations,remaining);
  await assert.rejects(x.owner.handle('execute',x.executeRequest(operation),x.credential),code('UNAVAILABLE'));
  assert.equal(x.subset.executions.length,0);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
 }
});

test('empty discovery exposes nothing and cannot execute an otherwise selected operation',async()=>{
 const x=await subsetFixture();x.subset.discovered=[];
 const out=await x.owner.handle('availability',x.request,x.credential);assert.deepEqual(out.installation.operations,[]);assert.deepEqual(out.discovery.operations,[]);
 for(const operation of selected)await assert.rejects(x.owner.handle('execute',x.executeRequest(operation),x.credential),code('UNAVAILABLE'));
 assert.equal(x.subset.executions.length,0);assert.equal(x.wire.length,0);
});

test('current committed task grant/entry revocation denies availability and selected execution before the gateway',async()=>{
 for(const revoke of [x=>x.state.grant.state='REVOKED',x=>x.stateNative.entryRevoked=true]){
  const x=await subsetFixture();revoke(x);
  await assert.rejects(x.owner.handle('availability',x.request,x.credential),code('ACCESS_DENIED'));
  for(const operation of selected)await assert.rejects(x.owner.handle('execute',x.executeRequest(operation),x.credential),code('ACCESS_DENIED'));
  assert.equal(x.subset.snapshots,0);assert.equal(x.subset.executions.length,0);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
 }
});

test('post-dispatch task revocation withholds selected bytes without another gateway execution',async()=>{
 const x=await subsetFixture();x.subset.afterExecute=()=>x.stateNative.entryRevoked=true;
 await assert.rejects(x.owner.handle('execute',x.executeRequest(selected[0]),x.credential),code('ACCESS_DENIED'));
 assert.equal(x.subset.executions.length,1);assert.deepEqual(x.subset.executions[0].operation,selected[0]);assert.equal(x.wire.length,0);
});

test('post-dispatch discovery removal withholds selected bytes and never falls back to a withheld sibling',async()=>{
 const x=await subsetFixture();x.subset.afterExecute=()=>x.subset.discovered=x.subset.discovered.filter(op=>op.id!==selected[1].id);
 await assert.rejects(x.owner.handle('execute',x.executeRequest(selected[1]),x.credential),code('UNAVAILABLE'));
 assert.equal(x.subset.executions.length,1);assert.deepEqual(x.subset.executions[0].operation,selected[1]);assert.equal(x.subset.snapshots,2);
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
});
