/** Actual normalization/proposal/executor/journal/source path, synthetic external ports. */
import {readFileSync} from 'node:fs';import Ajv from 'ajv/dist/2020.js';import addFormats from 'ajv-formats';
import test from 'node:test';import assert from 'node:assert/strict';
import * as payloads from '../../../packages/contracts/commands-0.2/validate.mjs';
import {assertProposalIntegrity,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {createCommandToolValidators} from '../../../packages/contracts/commands-0.2/tool-interface-validation.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {fixture,taskUpdate,NOW,id} from './commands-fixture.mjs';
const ajv=new Ajv({strict:true,allErrors:true});addFormats(ajv);
for(const path of ['../meri.schema.json','./task-create.schema.json','./task-update.schema.json','./artifact-file.schema.json','./memory-propose.schema.json','./tool-interface.schema.json'])ajv.addSchema(JSON.parse(readFileSync(new URL('../../../packages/contracts/commands-0.2/'+path,import.meta.url))));
const shapes=new Map();
function validateToolShape(name,value){let check=shapes.get(name);if(!check){check=ajv.compile({$ref:'urn:meri:commands:tool-interface:0.2.0#/$defs/'+name});shapes.set(name,check);}if(!check(value))throw Error('Invalid command tool result');return value;}
function setup(action='task.create'){
 const f=fixture(action);let retained,prepareCalls=0,readCalls=0,executeCalls=0;const hooks={};
 const validators=createCommandToolValidators({payloads,taskUpdate,intents:f.contracts,validateShape:validateToolShape,canonicalSha256});
 const raw=action==='task.create'?{title:'  Task  '}:action==='task.update'?{taskId:id(21),title:' Updated ',status:'open'}:action==='memory.propose'?{content:' Memory ',scope:'firm'}:{...f.context.destination,objects:f.command.attachments};
 const owner={async prepare(call){prepareCalls++;if(hooks.prepare)await hooks.prepare(call);
  retained={operation:call.operation,action,binding:f.binding,request:call.request,inputSha256:canonicalSha256(call.input),commandId:f.command.commandId,idempotencyKey:f.command.idempotencyKey,proposalId:f.proposal.proposalId,scopes:f.scopes,createdAt:f.proposal.createdAt,expiresAt:f.proposal.expiresAt,requiredApprover:f.proposal.requiredApprover,checkedAtMs:f.state.now};
  const value=structuredClone(retained);hooks.mutate?.(value);return value;},
  async read(call){readCalls++;if(hooks.read)await hooks.read(call);const value=structuredClone(retained);value.checkedAtMs=f.state.now;hooks.mutateRead?.(value);return value;}};
 const executable=f.create();
 const outputShape={'task.create':'TaskCreateToolResult','task.update':'TaskUpdateToolResult','artifact.file':'ArtifactFileToolResult','memory.propose':'MemoryProposeToolResult'}[action];
 const create=changes=>createCommandToolInterface({operation:f.descriptor.operation,action,outputShape,commandContext:f.context,validators,
  assertProposal:action==='task.update'?taskUpdate.assertTaskUpdateProposal:assertProposalIntegrity,
  approvalMetadataOwner:owner,executor:{execute(...args){executeCalls++;return executable.execute(...args);}},now:()=>f.state.now,limits:{maxRequestMs:1000,maxFactBytes:65536},...changes});
 return {f,raw,hooks,owner,validators,create,counts:()=>({prepareCalls,readCalls,executeCalls}),retained:()=>retained};
}
for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`${action}: raw normalization creates exact pending proposal with no source/journal effect`,async()=>{
 const t=setup(action),value=await t.create().prepare(t.raw);assert.equal(value.status,'approval_required');assert.deepEqual(value.proposal,t.f.proposal);
 assert.equal(t.f.state.fetches,0);assert.equal(t.f.pg.rows.size,0);assert.equal(t.counts().executeCalls,0);assert.ok(Object.isFrozen(value.proposal.command));
 const result=await t.create().executeApproved(value.proposal,t.f.execution,'synthetic');assert.equal(result.status,'observed');assert.equal(t.f.state.fetches,1);
 assert.deepEqual(await t.create().executeApproved(value.proposal,t.f.execution,'synthetic'),result);assert.equal(t.f.state.fetches,1);
});
test('raw request cannot supply any server-owned metadata or unknown action',async()=>{
 const t=setup();for(const key of ['binding','commandId','proposalId','idempotencyKey','scopes','requiredApprover','expiresAt','action'])await assert.rejects(t.create().prepare({...t.raw,[key]:'model'}));
 assert.equal(t.counts().prepareCalls,0);assert.equal(t.f.pg.rows.size,0);
});
test('metadata operation/action/binding/raw/input digest mismatch refuses before proposal/executor',async()=>{
 for(const mutate of [r=>r.operation.id='other',r=>r.action='task.update',r=>r.binding.actorId='foreign',r=>r.request.title='changed',r=>r.inputSha256='f'.repeat(64),r=>r.scopes[0].tenantId='foreign',r=>r.requiredApprover.tenantId='foreign']){
  const t=setup();t.hooks.mutate=mutate;await assert.rejects(t.create().prepare(t.raw));assert.equal(t.counts().executeCalls,0);assert.equal(t.f.state.fetches,0);
 }
});
test('unsafe/future/stale receipt clocks and expired/future proposal metadata refuse',async()=>{
 for(const mutate of [r=>r.checkedAtMs=NOW-1,r=>r.checkedAtMs=NOW+1,r=>r.checkedAtMs=NaN,r=>r.createdAt=new Date(NOW+1).toISOString(),r=>r.expiresAt=new Date(NOW).toISOString(),r=>r.expiresAt='2016-12-31T23:59:60.000Z']){
  const t=setup();t.hooks.mutate=mutate;await assert.rejects(t.create().prepare(t.raw));assert.equal(t.f.state.fetches,0);
 }
});
test('non-inert metadata and caller options are rejected without executing getters',async()=>{
 const t=setup();let hits=0;t.owner.prepare=async()=>({get operation(){hits++;return t.f.descriptor.operation;}});
 await assert.rejects(t.create().prepare(t.raw));await assert.rejects(t.create().prepare(t.raw,{get signal(){hits++;return undefined;}}));
 await assert.rejects(t.create().prepare(new Proxy({}, {ownKeys(){hits++;throw Error('trap');}})));assert.equal(hits,0);
});
test('preaborted preparation starts no metadata or source port',async()=>{
 const t=setup(),controller=new AbortController();controller.abort();await assert.rejects(t.create().prepare(t.raw,{signal:controller.signal}));assert.deepEqual(t.counts(),{prepareCalls:0,readCalls:0,executeCalls:0});
});
test('late preparation ACK is not returned and does not pretend persisted metadata rolled back',async()=>{
 const t=setup(),controller=new AbortController();let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 t.hooks.prepare=async()=>{entered();await gate;};const pending=t.create().prepare(t.raw,{signal:controller.signal});await started;controller.abort();await assert.rejects(pending);release();await new Promise(r=>setImmediate(r));
 assert.ok(t.retained());assert.equal(t.counts().executeCalls,0);assert.equal(t.f.pg.rows.size,0);
});
test('late read ACK after cancellation cannot start the existing executor',async()=>{
 const t=setup(),prepared=await t.create().prepare(t.raw),controller=new AbortController();let entered,release;const started=new Promise(r=>entered=r),gate=new Promise(r=>release=r);
 t.hooks.read=async()=>{entered();await gate;};const pending=t.create().executeApproved(prepared.proposal,t.f.execution,'synthetic',controller.signal);await started;controller.abort();await assert.rejects(pending);release();await new Promise(r=>setImmediate(r));
 assert.equal(t.counts().executeCalls,0);assert.equal(t.f.state.fetches,0);
});
test('read must reconstruct exact immutable original command/proposal, not caller substitutions',async()=>{
 for(const mutate of [r=>r.commandId=id(99),r=>r.proposalId=id(99),r=>r.idempotencyKey='other',r=>r.request.title='other',r=>r.requiredApprover.actorId='other',r=>r.scopes[0].policyRevision='other']){
  const t=setup(),p=await t.create().prepare(t.raw);t.hooks.mutateRead=mutate;await assert.rejects(t.create().executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.counts().executeCalls,0);
 }
});
test('current metadata policy refusal prevents delegation; current approval remains actual executor responsibility',async()=>{
 const t=setup(),p=await t.create().prepare(t.raw);t.hooks.read=async()=>{throw Error('private policy detail');};await assert.rejects(t.create().executeApproved(p.proposal,t.f.execution,'synthetic'),/COMMAND_REFUSED/);assert.equal(t.counts().executeCalls,0);
 t.hooks.read=null;t.f.state.approvalRevoked=true;await assert.rejects(t.create().executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.counts().executeCalls,1);assert.equal(t.f.state.fetches,0);
});
test('personal proposal preparation never claims committed memory and actual execution retains pending-producer HOLD',async()=>{
 const t=setup('memory.propose');t.raw.scope='personal';const p=await t.create().prepare(t.raw);assert.equal(p.status,'approval_required');assert.equal(p.proposal.command.arguments.scope,'personal');
 const execution={...t.f.execution,commandSha256:p.proposal.commandSha256};t.f.decision.commandSha256=p.proposal.commandSha256;
 await assert.rejects(t.create().executeApproved(p.proposal,execution,'synthetic'),/PENDING_PRODUCER_UNAVAILABLE/);assert.equal(t.f.state.fetches,0);assert.equal(t.f.pg.rows.size,0);
});
test('same-actor reviewer is not silently forbidden; current approval policy still external',async()=>{
 const t=setup();t.f.proposal.requiredApprover.actorId=t.f.binding.actorId;const p=await t.create().prepare(t.raw);assert.equal(p.proposal.requiredApprover.actorId,t.f.binding.actorId);assert.equal(t.f.state.fetches,0);
});
test('old producer binding stays immutable while a fresh executor must satisfy actual current authority',async()=>{
 const t=setup(),p=await t.create().prepare(t.raw);const execution=structuredClone(t.f.execution);execution.executorBinding.attemptId=id(99);
 await assert.rejects(t.create().executeApproved(p.proposal,execution,'synthetic'));assert.equal(p.proposal.command.binding.attemptId,id(3));assert.equal(t.f.state.fetches,0);
});
test('final clock-triggered abort cannot release a pending proposal',async()=>{
 const t=setup(),controller=new AbortController();let stop=false;t.hooks.mutate=()=>{stop=true;};
 const service=t.create({now:()=>{if(stop)controller.abort();return NOW;}});await assert.rejects(service.prepare(t.raw,{signal:controller.signal}));assert.equal(t.f.state.fetches,0);
});
test('unknown metadata-owner output fields and oversized receipts refuse',async()=>{
 const t=setup();t.hooks.mutate=r=>r.approved=true;await assert.rejects(t.create().prepare(t.raw));t.hooks.mutate=null;await assert.rejects(t.create({limits:{maxRequestMs:1000,maxFactBytes:1}}).prepare(t.raw));
});
test('executor result uses exact canonical output schema; absent/extra success are not execution outputs',async()=>{
 const t=setup(),p=await t.create().prepare(t.raw);
 for(const value of [{status:'absent',outcome:null},{status:'indeterminate',outcome:null,retry:true},{status:'approval_required',proposal:p.proposal}]){
  const service=t.create({executor:{execute:async()=>value}});await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));
 }
});
test('actual durable journal/source output cannot be substituted before facade release',async()=>{
 const t=setup(),p=await t.create().prepare(t.raw),actual=t.f.create();
 const service=t.create({executor:{async execute(...args){const value=structuredClone(await actual.execute(...args));value.outcome.receipt.commandSha256='f'.repeat(64);return value;}}});
 await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.fetches,1);assert.equal([...t.f.pg.rows.values()][0].state,'OUTCOME');
});
