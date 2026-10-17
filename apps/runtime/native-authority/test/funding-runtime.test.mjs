/** Actual native reads owner/task verifier. Synthetic eligibility gateway is separate from source and settlement evidence. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256 as hash} from '../../../../packages/contracts/validate.mjs';
import {NATIVE_READS_SCHEMA_VERSION as schemaVersion} from '../../../../packages/contracts/runtime-0.2/reads.mjs';
import {storedCase,ids,clientId} from '../../../gateway/sources/funding-opportunities/test/fixture.mjs';
import {ownerFixture,uuid} from '../native-read-credentials/test/fixture.mjs';
import {createNativeReadsOwner} from '../reads-owner.mjs';
const operations=ids.map(id=>({id,version:'0.2.0'}));

async function clientRuntime(id,{personal=false}={}){
 const scene=storedCase(id);
 if(personal){const a=scene.authority,scope={tenantId:a.binding.tenantId,kind:'tenant',resourceId:a.binding.tenantId,policyRevision:a.policyRevision};
  Object.assign(a.subject,{kind:'personal',entityType:'user',entityIds:[a.binding.actorId],scopes:[scope]});a.claims.scopes=[scope];a.decision.scopes=[scope];}
 const f=await ownerFixture(id,{scene}),gateway=f.mount(),initial=await gateway.readAvailability();
 const state={installed:structuredClone(operations),discovered:structuredClone(operations),snapshots:0,executions:[],afterExecute:null};
 const ownerConfiguration={binding:f.binding,approvedReads:f.configuration.approvedReads,taskVerifier:f.configuration.taskVerifier,
  allocationSha256:f.entry.allocationSha256,policyRevision:f.policyRevision,scopes:f.scopes,now:f.now,gateway:{
   async readAvailability(options){
    state.snapshots++;const current=await gateway.readAvailability(options);
    return {...current,installation:{...current.installation,operations:structuredClone(state.installed)},discovery:{...current.discovery,operations:structuredClone(state.discovered)}};
   },
   async execute(call){
    assert.deepEqual(Object.keys(call).sort(),['operation','arguments','deliveryId','signal'].sort());assert.equal(call.signal.aborted,false);
    const value={synthetic:'funding native eligibility only',operation:call.operation,arguments:call.arguments,deliveryId:call.deliveryId};
    state.executions.push(structuredClone(value));state.afterExecute?.();return JSON.stringify(value);
   },
  }};
 const request={schemaVersion,binding:f.binding},executeRequest={...request,operation:f.operation,arguments:f.request,deliveryId:`funding:rpc:${id}`,
  installationId:initial.installation.installationId,executionCatalogSha256:initial.installation.executionCatalogSha256};
 return {...f,rpcState:state,ownerConfiguration,readsOwner:createNativeReadsOwner(ownerConfiguration),rpcRequest:request,rpcExecute:executeRequest,actualGateway:gateway};
}
function noSource(f){assert.equal(f.wire.length,0);assert.equal(f.state.reservations.size,0);assert.equal(f.state.budget.consumed_micro_usd,0);}

test('funding runtime cannot turn all-five approved/install/discovery claims into client eligibility for a personal task',async()=>{
 const f=await clientRuntime(ids[0],{personal:true});
 // The real task verifier retains its exact configured entry. Even an overclaiming outer approved list cannot create a client scope.
 const owner=createNativeReadsOwner({...f.ownerConfiguration,approvedReads:{...f.configuration.approvedReads,operations}});
 try{
  assert.equal(f.authority.subject.kind,'personal');assert.ok(f.scopes.every(scope=>scope.kind==='tenant'));
  const out=await owner.handle('availability',f.rpcRequest,f.configuration.taskCapability);assert.deepEqual(out.installation.operations,[]);assert.deepEqual(out.discovery.operations,[]);
  assert.equal(out.inputSha256,hash(f.rpcRequest));assert.ok(f.stateOwner.entryReads>0,'actual current task verifier remains active');
  for(const operation of operations)await assert.rejects(owner.handle('execute',{...f.rpcExecute,operation,arguments:storedCase(operation.id).arguments,deliveryId:`funding:personal:${operation.id}`},f.configuration.taskCapability),{message:'UNAVAILABLE'});
  assert.equal(f.rpcState.executions.length,0);noSource(f);assert.ok(f.stateOwner.reads.every(sql=>!sql.includes('FOR UPDATE')));
 }finally{f.scope.abort();}
});

test('funding runtime cannot forge a client scope by changing owner configuration around a real personal task verifier',async()=>{
 const f=await clientRuntime(ids[0],{personal:true}),scopes=[{tenantId:f.binding.tenantId,kind:'client',resourceId:clientId,policyRevision:f.policyRevision}];let snapshots=0;
 const owner=createNativeReadsOwner({...f.ownerConfiguration,scopes,gateway:{async readAvailability(){snapshots++;throw Error('FORGED_SCOPE_SNAPSHOT');},async execute(){throw Error('FORGED_SCOPE_DISPATCH');}}});
 try{
  await assert.rejects(owner.handle('availability',f.rpcRequest,f.configuration.taskCapability),{message:'ACCESS_DENIED'});
  await assert.rejects(owner.handle('execute',f.rpcExecute,f.configuration.taskCapability),{message:'ACCESS_DENIED'});
  assert.equal(snapshots,0);noSource(f);
 }finally{f.scope.abort();}
});

for(const id of ids)test(`${id}: native RPC eligibility retains exact client task/config and original request/result proof joins`,async()=>{
 const f=await clientRuntime(id);
 try{
  const snapshot=await f.readsOwner.handle('availability',f.rpcRequest,f.configuration.taskCapability);
  assert.deepEqual(snapshot.installation.operations,[f.operation]);assert.deepEqual(snapshot.discovery.operations,[f.operation]);assert.equal(snapshot.inputSha256,hash(f.rpcRequest));
  assert.deepEqual(f.rpcState.installed,operations);assert.deepEqual(f.rpcState.discovered,operations);
  const before=f.stateOwner.entryReads,result=await f.readsOwner.handle('execute',f.rpcExecute,f.configuration.taskCapability);
  assert.ok(f.stateOwner.entryReads>before,'each RPC dispatch repeats the actual task verifier');assert.deepEqual(result.operation,f.operation);assert.equal(result.deliveryId,f.rpcExecute.deliveryId);assert.equal(result.inputSha256,hash(f.rpcExecute));
  assert.deepEqual(JSON.parse(result.resultJson),f.rpcState.executions[0]);assert.equal(result.resultSha256,hash(f.rpcState.executions[0]));assert.equal(result.outputBytes,Buffer.byteLength(result.resultJson));
  assert.deepEqual(f.rpcState.executions[0].arguments,f.request);assert.equal(f.rpcState.executions.length,1);
  const sibling=operations.find(op=>op.id!==id);await assert.rejects(f.readsOwner.handle('execute',{...f.rpcExecute,operation:sibling,arguments:storedCase(sibling.id).arguments,deliveryId:`funding:unapproved:${id}`},f.configuration.taskCapability),{message:'UNAVAILABLE'});
  assert.equal(f.rpcState.executions.length,1);noSource(f);assert.equal(f.stateOwner.secrets,0,'eligibility-only gateway proves no source credentials or settlement');
 }finally{f.scope.abort();}
});

for(const inventory of ['installed','discovered'])test(`all five funding RPCs still require current ${inventory} membership`,async()=>{
 for(const id of ids){const f=await clientRuntime(id);f.rpcState[inventory]=f.rpcState[inventory].filter(op=>op.id!==id);
  try{
   const out=await f.readsOwner.handle('availability',f.rpcRequest,f.configuration.taskCapability);assert.deepEqual(out.installation.operations,[]);assert.deepEqual(out.discovery.operations,[]);
   await assert.rejects(f.readsOwner.handle('execute',f.rpcExecute,f.configuration.taskCapability),{message:'UNAVAILABLE'});assert.equal(f.rpcState.executions.length,0);noSource(f);
  }finally{f.scope.abort();}
 }
});

test('funding native RPC denied current durable grant, entry or expiry never reaches even the eligibility gateway',async()=>{
 for(const mode of ['grant','entry','expiry']){const f=await clientRuntime(ids[0]);
  if(mode==='grant')f.state.grant.state='REVOKED';if(mode==='entry')f.stateOwner.entryMutator=row=>row.runRequestSha256='0'.repeat(64);if(mode==='expiry')f.state.now=f.deadlineMs;
  try{await assert.rejects(f.readsOwner.handle('execute',f.rpcExecute,f.configuration.taskCapability));assert.equal(f.rpcState.snapshots,0);assert.equal(f.rpcState.executions.length,0);noSource(f);}
  finally{f.scope.abort();}
 }
});

test('funding native RPC preserves actual gateway source-disabled and foreign-client enforcement',async()=>{
 const disabled=await clientRuntime(ids[0]);
 try{
  const owner=createNativeReadsOwner({...disabled.ownerConfiguration,gateway:disabled.mount({sourceEnabled:false})});
  await assert.rejects(owner.handle('availability',disabled.rpcRequest,disabled.configuration.taskCapability),{message:'UNAVAILABLE'});noSource(disabled);
 }finally{disabled.scope.abort();}
 for(const id of ids){const f=await clientRuntime(id),owner=createNativeReadsOwner({...f.ownerConfiguration,gateway:f.actualGateway});
  try{
   await assert.rejects(owner.handle('execute',{...f.rpcExecute,arguments:{...f.request,clientId:uuid('e')}},f.configuration.taskCapability));
   noSource(f);assert.equal(f.stateOwner.secrets,0);assert.equal(f.rpcState.executions.length,0,'foreign selection is refused by the real gateway, not the eligibility-only stand-in');
  }finally{f.scope.abort();}
 }
});

test('funding native RPC keeps request binding, installation digest and closed wire independent from inventory claims',async()=>{
 for(const mode of ['binding','installation','catalog','authority']){const f=await clientRuntime(ids[0]),request=structuredClone(f.rpcExecute);
  if(mode==='binding')request.binding.actorId=uuid('e');if(mode==='installation')request.installationId=uuid('e');if(mode==='catalog')request.executionCatalogSha256='e'.repeat(64);if(mode==='authority')request.scopes=f.scopes;
  try{await assert.rejects(f.readsOwner.handle('execute',request,f.configuration.taskCapability),{message:mode==='authority'?'INVALID_ARGUMENTS':mode==='binding'?'ACCESS_DENIED':'UNAVAILABLE'});assert.equal(f.rpcState.executions.length,0);noSource(f);}
  finally{f.scope.abort();}
 }
});

test('funding native RPC post-dispatch inventory/task drift withholds eligibility result without redispatch',async()=>{
 for(const mode of ['installed','discovered','task','expiry']){const f=await clientRuntime(ids[0]);
  f.rpcState.afterExecute=()=>{if(mode==='installed'||mode==='discovered')f.rpcState[mode]=[];else if(mode==='task')f.state.grant.state='REVOKED';else f.state.now=f.deadlineMs;};
  try{await assert.rejects(f.readsOwner.handle('execute',f.rpcExecute,f.configuration.taskCapability));assert.equal(f.rpcState.executions.length,1);noSource(f);}
  finally{f.scope.abort();}
 }
});

test('funding native RPC pre-cancelled DEADLINE and in-flight CANCELLED do not produce accepted eligibility bytes',async()=>{
 for(const late of [false,true]){const f=await clientRuntime(ids[0]),controller=new AbortController();if(late)f.rpcState.afterExecute=()=>controller.abort();else controller.abort();
  try{await assert.rejects(f.readsOwner.handle('execute',f.rpcExecute,f.configuration.taskCapability,controller.signal),{message:late?'CANCELLED':'DEADLINE'});assert.equal(f.rpcState.executions.length,late?1:0);noSource(f);}
  finally{f.scope.abort();}
 }
});
