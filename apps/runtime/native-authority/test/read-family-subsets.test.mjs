/** Runtime eligibility DELTA over real task verification; forged catalog snapshots and synthetic gateway results only. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {createNativeReadsOwner} from '../reads-owner.mjs';
import {readsFixture} from './reads-fixture.mjs';
import {ownerFixture} from '../native-read-credentials/test/fixture.mjs';
import {storedCase as kbCase} from '../../../gateway/sources/client-knowledge-search/test/fixture.mjs';
import {nativeFamilyCase} from '../../../gateway/general-reads/test/native-family-cases.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion} from '../../../../packages/contracts/runtime-0.2/reads.mjs';

const ref=id=>({id,version:'0.2.0'});
// PR132 (bba4ef68) opened the whole public-data and program-elements families: the five Core PR68 read-mode candidates are complete source.
const mode=['search_federal_grants','search_federal_awards','search_program_elements','get_program_element','get_pe_budget_timeline'].map(ref);
const semantic=ref('search_client_knowledge'),selected=[ref('query_economic_data'),semantic,ref('query_knowledge_graph'),...mode];
// Still absent: BD evidence (outside the finite business-development subset) and four reads with no registered family.
const excluded=['get_business_development_evidence','get_certification_status','search_research_sources','get_state_rule_status','search_sam_opportunities'].map(ref);
const forged=[excluded[0],selected[0],excluded[1],semantic,selected[2],...mode,...excluded.slice(2)];
const args={query_economic_data:{source:'census',state:'TX',limit:1},search_client_knowledge:{query:'synthetic'},query_knowledge_graph:{depth:1}},argsFor=id=>args[id]??{query:'synthetic'};
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
 const executeRequest=operation=>({...x.executeRequest,operation,arguments:argsFor(operation.id),deliveryId:`subset:${operation.id}`});
 return {...x,owner,subset:state,executeRequest};
}

test('runtime availability intersects forged inventories with the finite family subsets and current KB client requirement',async()=>{
 const x=await subsetFixture(),out=await x.owner.handle('availability',x.request,x.credential);
 assert.deepEqual(ids(x.config.operations),ids(forged));assert.deepEqual(ids(x.subset.installed),ids(forged));assert.deepEqual(ids(x.subset.discovered),ids(forged));
 assert.deepEqual(out.installation.operations,selected);assert.deepEqual(out.discovery.operations,selected);
 assert.equal(out.inputSha256,hash(x.request));assert.equal(x.subset.snapshots,2);assert.equal(x.subset.executions.length,0);
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);assert.ok(x.commands.every(sql=>!sql.includes('FOR UPDATE')));
});

test('all selected economic, mode-candidate, semantic and graph operations execute through the actual client runtime owner with exact request/delivery binding',async()=>{
 const x=await subsetFixture();
 for(const operation of selected){
  const request=x.executeRequest(operation),out=await x.owner.handle('execute',request,x.credential);
  assert.deepEqual(out.operation,operation);assert.equal(out.deliveryId,request.deliveryId);assert.equal(out.inputSha256,hash(request));
  assert.deepEqual(JSON.parse(out.resultJson),{synthetic:'runtime-subset-gateway-only',operation:operation.id});
  assert.equal(out.resultSha256,hash(JSON.parse(out.resultJson)));assert.equal(out.outputBytes,Buffer.byteLength(out.resultJson,'utf8'));
 }
 assert.deepEqual(x.subset.executions,selected.map(operation=>({operation,arguments:argsFor(operation.id),deliveryId:`subset:${operation.id}`})));
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'borrowed synthetic gateway results do not claim source execution or settlement');
});

test('all five absent source reads never reach gateway execution despite all three inventories claiming them',async()=>{
 const x=await subsetFixture();
 for(const operation of excluded){
  const before=x.subset.snapshots;await assert.rejects(x.owner.handle('execute',x.executeRequest(operation),x.credential),code('UNAVAILABLE'));
  assert.equal(x.subset.snapshots,before+1);assert.equal(x.subset.executions.length,0);
 }
 assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
});

for(const [family,id] of [['state-status-votes','get_state_bill_status'],['state-status-votes','search_state_floor_votes'],
 ['tracked-bills','search_tracked_bills'],['public-domain-hearings','search_committee_hearings']])test(`complete ${id} is eligible through the actual native runtime task owner without advertising absent reads`,async()=>{
 const x=await ownerFixture(id,{scene:nativeFamilyCase(family,id)}),gateway=x.mount(),executions=[],operation=ref(id),overclaimed=[operation,...excluded];
 const owner=createNativeReadsOwner({binding:x.binding,approvedReads:x.configuration.approvedReads,taskVerifier:x.configuration.taskVerifier,
  allocationSha256:x.entry.allocationSha256,policyRevision:x.policyRevision,scopes:x.scopes,now:x.now,gateway:{
   async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:overclaimed},discovery:{...snapshot.discovery,operations:overclaimed}};},
   async execute(call){const value={synthetic:'runtime-eligibility-only',operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId};executions.push(value);return JSON.stringify(value);},
  }});
 try{
  const request={schemaVersion,binding:x.binding},snapshot=await owner.handle('availability',request,x.gatewayConfiguration.credential);
  assert.deepEqual(snapshot.installation.operations,[operation]);assert.deepEqual(snapshot.discovery.operations,[operation]);
  assert.equal(x.scopes.some(scope=>scope.kind==='client'),family==='tracked-bills');
  const execution={...request,operation,arguments:x.request,deliveryId:`complete:${id}`,installationId:snapshot.installation.installationId,executionCatalogSha256:snapshot.installation.executionCatalogSha256},out=await owner.handle('execute',execution,x.gatewayConfiguration.credential);
  assert.equal(out.inputSha256,hash(execution));assert.equal(out.deliveryId,execution.deliveryId);assert.deepEqual(out.operation,operation);assert.equal(out.resultSha256,hash(executions[0]));assert.equal(out.outputBytes,Buffer.byteLength(out.resultJson));
  assert.equal(executions.length,1);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'runtime eligibility-only results do not establish source or settlement');
 }finally{x.scope.abort();}
});

test('semantic KB is complete but remains unavailable to the actual no-client task despite overclaimed inventories',async()=>{
 const x=await ownerFixture(semantic.id,{scene:kbCase(semantic.id,{request:{query:'synthetic'}})}),gateway=x.mount(),executions=[];
 const owner=createNativeReadsOwner({binding:x.binding,approvedReads:x.configuration.approvedReads,taskVerifier:x.configuration.taskVerifier,
  allocationSha256:x.entry.allocationSha256,policyRevision:x.policyRevision,scopes:x.scopes,now:x.now,gateway:{
   async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:forged},discovery:{...snapshot.discovery,operations:forged}};},
   async execute(call){executions.push(call);throw Error('UNREACHABLE_SYNTHETIC_GATEWAY');},
  }});
 try{
  assert.equal(x.scopes.some(scope=>scope.kind==='client'),false);assert.deepEqual(x.configuration.approvedReads.operations,[semantic]);
  const request={schemaVersion,binding:x.binding},snapshot=await owner.handle('availability',request,x.gatewayConfiguration.credential);
  assert.deepEqual(snapshot.installation.operations,[]);assert.deepEqual(snapshot.discovery.operations,[]);
  await assert.rejects(owner.handle('execute',{...request,operation:semantic,arguments:x.request,deliveryId:'subset:semantic-personal',
   installationId:snapshot.installation.installationId,executionCatalogSha256:snapshot.installation.executionCatalogSha256},x.gatewayConfiguration.credential),code('UNAVAILABLE'));
  assert.equal(executions.length,0);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0);
 }finally{x.scope.abort();}
});

test('semantic KB with a real client-task verifier reaches the native runtime gateway with exact request and result hashes',async()=>{
 const x=await ownerFixture(semantic.id,{scene:kbCase(semantic.id)}),executions=[];
 const gateway=x.mount(),owner=createNativeReadsOwner({binding:x.binding,approvedReads:x.configuration.approvedReads,taskVerifier:x.configuration.taskVerifier,
  allocationSha256:x.entry.allocationSha256,policyRevision:x.policyRevision,scopes:x.scopes,now:x.now,gateway:{
   async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations:forged},discovery:{...snapshot.discovery,operations:forged}};},
   async execute(call){const result={operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId,synthetic:'runtime-eligibility-only'};executions.push(result);return JSON.stringify(result);},
  }});
 try{
  const request={schemaVersion,binding:x.binding},snapshot=await owner.handle('availability',request,x.gatewayConfiguration.credential);
  assert.deepEqual(snapshot.installation.operations,[semantic]);assert.deepEqual(snapshot.discovery.operations,[semantic]);
  const execution={...request,operation:semantic,arguments:x.request,deliveryId:'subset:semantic-client',installationId:snapshot.installation.installationId,executionCatalogSha256:snapshot.installation.executionCatalogSha256};
  const result=await owner.handle('execute',execution,x.gatewayConfiguration.credential);
  assert.equal(result.inputSha256,hash(execution));assert.deepEqual(result.operation,semantic);assert.equal(result.deliveryId,execution.deliveryId);
  assert.deepEqual(JSON.parse(result.resultJson),executions[0]);assert.equal(result.resultSha256,hash(executions[0]));assert.equal(result.outputBytes,Buffer.byteLength(result.resultJson));
  assert.equal(executions.length,1);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'this eligibility-only synthetic gateway is not source settlement proof');
 }finally{x.scope.abort();}
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

test('legal native runtime exposes only complete search while approved/install/discovery inventories overclaim the reference sibling',async()=>{
 const operation=ref('search_legislative_research'),sibling=ref('get_legal_reference'),operations=[sibling,operation];
 const x=await readsFixture({config:{operations}}),gateway=x.ownerConfiguration.gateway,executions=[];
 const owner=createNativeReadsOwner({...x.ownerConfiguration,gateway:{
  async readAvailability(options){const snapshot=await gateway.readAvailability(options);return {...snapshot,installation:{...snapshot.installation,operations},discovery:{...snapshot.discovery,operations}};},
  async execute(call){const result={synthetic:'runtime-eligibility-only',operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId};executions.push(result);return JSON.stringify(result);},
 }});
 const snapshot=await owner.handle('availability',x.request,x.credential);assert.deepEqual(x.config.operations,operations);assert.deepEqual(snapshot.installation.operations,[operation]);assert.deepEqual(snapshot.discovery.operations,[operation]);
 const request={...x.executeRequest,operation,arguments:{sessionKey:'2026'},deliveryId:'legal:runtime-search'},out=await owner.handle('execute',request,x.credential);
 assert.equal(out.inputSha256,hash(request));assert.deepEqual(out.operation,operation);assert.equal(out.deliveryId,request.deliveryId);assert.equal(out.resultSha256,hash(executions[0]));assert.equal(out.outputBytes,Buffer.byteLength(out.resultJson));
 await assert.rejects(owner.handle('execute',{...request,operation:sibling,arguments:{view:'rules',noticeId:'synthetic-notice'},deliveryId:'legal:held-reference'},x.credential),code('UNAVAILABLE'));
 assert.equal(executions.length,1);assert.equal(x.wire.length,0);assert.equal(x.state.reservations.size,0,'eligibility-only fake gateway results do not establish source execution or settlement');
});
