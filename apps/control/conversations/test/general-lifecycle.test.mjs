/** Explicit trusted General scope through real service/journals over scripted SQL. Core bootstrap eligibility is separately qualified. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {lifecycleFixture,binding,id} from './lifecycle-fixture.mjs';
import {hash} from '../boundary.mjs';
const scopes=[{tenantId:binding.tenantId,kind:'private-user',resourceId:binding.actorId,policyRevision:'policy1'}];
const principal={tenantId:binding.tenantId,actorId:binding.actorId},check=()=>{};
const pins=controlId=>({principal,binding,scopes,selectedClientId:null,controlId});
const counts=f=>({starts:f.state.starts,signals:f.state.signals,admissions:f.state.admissions,retirements:f.state.retirements,runs:f.state.runs.size});
const read=(f,controlId)=>f.store.lifecycle.readReceipt(pins(controlId),check);
test('General steer retains exact text/UUID, single claim and immutable identifier-only receipt readback',async t=>{
 const f=await lifecycleFixture({scopes});t.after(f.close);await f.running();
 const input={controlId:id(970),intent:'steer',text:'Synthetic private General instruction'};
 assert.equal((await f.control(input)).state,'PENDING');const before=counts(f);
 assert.equal((await f.control(input)).replayed,true);assert.deepEqual(counts(f),before);
 assert.equal((await read(f,input.controlId)).state,'PENDING');
 const first=await f.claim(input.controlId),second=await f.service.claimControl({credential:f.credential,binding,input:{controlId:input.controlId,commandSha256:first.control.commandSha256}});
 assert.equal(first.claimed,true);assert.equal(second.claimed,false);assert.equal(first.control.command.prompt,input.text);
 assert.equal((await read(f,input.controlId)).state,'DISPATCHING');
 await f.service.ackControl({credential:f.credential,binding,input:{controlId:input.controlId,commandSha256:first.control.commandSha256,outcome:'APPLIED',sdkUserMessageId:input.controlId}});
 const receipt=await read(f,input.controlId);assert.equal(receipt.state,'APPLIED');assert.equal(JSON.stringify(receipt).includes(input.text),false);
 await assert.rejects(f.control({...input,text:'Changed intent under the same UUID'}));
 const history=await f.service.history({credential:f.credential});assert.deepEqual(history.run.scopes,scopes);
 assert.equal([...f.state.controls.values()][0].projection.sourceSelectedClientId,null);
});
for(const mode of ['resume','fork'])test(`General pause/checkpoint/${mode} preserves private owner, source input and historical receipt`,async t=>{
 const f=await lifecycleFixture({scopes});t.after(f.close);await f.running();
 const pause=id(971),controlId=id(972);await f.control({controlId:pause,intent:'pause'});await f.claim(pause);await f.checkpoint(pause);
 assert.equal((await read(f,pause)).state,'APPLIED');const before=await f.service.history({credential:f.credential}),proof=f.proofs.get(id(220));
 const input={controlId,intent:mode,checkpointId:id(220),checkpointSha256:proof.checkpointSha256};
 const result=await f.control(input);assert.equal(result.state,'APPLIED');assert.equal(f.state.retirements,mode==='resume'?1:0);
 const count=counts(f),receipt=await read(f,controlId);assert.deepEqual(receipt.targetBinding,result.targetBinding);
 assert.equal((await f.control(input)).state,'APPLIED');assert.deepEqual(counts(f),count);
 const target=[...f.state.runs.values()].find(r=>r.run_id===result.targetBinding.runId);
 assert.deepEqual(target.projection.scopes,scopes);assert.deepEqual(target.continuation.sourceRequest,before.request);
 assert.equal(target.projection.binding.actorId,binding.actorId);assert.equal(target.projection.binding.tenantId,binding.tenantId);
 assert.equal(result.targetBinding.conversationId===binding.conversationId,mode==='resume');
 const bad=[...f.state.controls.values()].find(r=>r.control_id===controlId);bad.projection.target.selectedClientId=id(5);bad.projection_sha256=hash(bad.projection);
 await assert.rejects(read(f,controlId));
});
test('General receipt readback refuses foreign principals/scopes, client substitution and changed policy without effects',async t=>{
 const f=await lifecycleFixture({scopes});t.after(f.close);await f.running();const controlId=id(973);
 await f.control({controlId,intent:'steer',text:'Synthetic private text'});const before=counts(f);
 const valid=pins(controlId);
 for(const invalid of [
  {...valid,principal:{...principal,actorId:'foreign-actor'}},
  {...valid,principal:{...principal,tenantId:'foreign-tenant'}},
  {...valid,scopes:[{...scopes[0],resourceId:'foreign-actor'}]},
  {...valid,scopes:[{...scopes[0],policyRevision:'policy2'}]},
  {...valid,scopes:[...scopes,{...scopes[0],kind:'client',resourceId:id(5)}]},
  {...valid,selectedClientId:id(5)},
 ])await assert.rejects(f.store.lifecycle.readReceipt(invalid,check));
 assert.deepEqual(counts(f),before);assert.equal((await read(f,controlId)).state,'PENDING');
});
test('General current-authority revocation refuses controls and history without another signal or start',async t=>{
 const f=await lifecycleFixture({scopes});t.after(f.close);await f.running();const controlId=id(974);
 await f.control({controlId,intent:'steer',text:'Synthetic private text'});const before=counts(f);f.state.revoked=true;
 await assert.rejects(f.control({controlId:id(975),intent:'steer',text:'Must not dispatch'}));
 await assert.rejects(f.claim(controlId));await assert.rejects(f.service.history({credential:f.credential}));assert.deepEqual(counts(f),before);
});
