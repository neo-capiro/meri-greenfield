/** Actual production preparation interface and canonical validators; synthetic metadata boundary only. */
import test from 'node:test';import assert from 'node:assert/strict';
import {assertProposalIntegrity,canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertTaskUpdateProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {commandToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {fixture,NOW,id} from './commands-fixture.mjs';
function setup(action='task.create'){
 const f=fixture(action);let retained,prepareCalls=0;const hooks={};
 const validators=commandToolValidators;
 const raw=action==='task.create'?{title:'  Task  '}:action==='task.update'?{taskId:id(21),title:' Updated ',status:'open'}:action==='memory.propose'?{content:' Memory ',scope:'firm'}:{...f.context.destination,objects:f.command.attachments};
 const owner={async prepare(call){prepareCalls++;if(hooks.prepare)await hooks.prepare(call);
  retained={operation:call.operation,action,binding:f.binding,request:call.request,inputSha256:canonicalSha256(call.input),commandId:f.command.commandId,idempotencyKey:f.command.idempotencyKey,proposalId:f.proposal.proposalId,scopes:f.scopes,createdAt:f.proposal.createdAt,expiresAt:f.proposal.expiresAt,requiredApprover:f.proposal.requiredApprover,checkedAtMs:f.state.now};
  const value=structuredClone(retained);hooks.mutate?.(value);return value;}};
 const create=changes=>createCommandToolInterface({operation:{id:{'task.create':'create_task','task.update':'update_task','memory.propose':'save_memory','artifact.file':'save_chat_attachments'}[action],version:'0.2.0'},action,commandContext:f.context,validators,
  assertProposal:action==='task.update'?assertTaskUpdateProposal:assertProposalIntegrity,
  approvalMetadataOwner:owner,now:()=>f.state.now,limits:{maxRequestMs:1000,maxFactBytes:65536},...changes});
 return {f,raw,hooks,owner,validators,create,counts:()=>({prepareCalls}),retained:()=>retained};
}
for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`${action}: raw normalization creates exact pending proposal with no source/journal effect`,async()=>{
 const t=setup(action),value=await t.create().prepare(t.raw);assert.equal(value.status,'approval_required');assert.deepEqual(value.proposal,t.f.proposal);
 assert.deepEqual(Object.keys(t.create()),['prepare']);assert.ok(Object.isFrozen(value.proposal.command));
});

test('raw request cannot supply any server-owned metadata or unknown action',async()=>{
 const t=setup();for(const key of ['binding','commandId','proposalId','idempotencyKey','scopes','requiredApprover','expiresAt','action'])await assert.rejects(t.create().prepare({...t.raw,[key]:'model'}));
 assert.equal(t.counts().prepareCalls,0);
});
test('unsafe/future/stale receipt clocks and expired/future proposal metadata refuse',async()=>{
 for(const mutate of [r=>r.checkedAtMs=NOW-1,r=>r.checkedAtMs=NOW+1,r=>r.checkedAtMs=NaN,r=>r.createdAt=new Date(NOW+1).toISOString(),r=>r.expiresAt=new Date(NOW).toISOString(),r=>r.expiresAt='2016-12-31T23:59:60.000Z']){
  const t=setup();t.hooks.mutate=mutate;await assert.rejects(t.create().prepare(t.raw));
 }
});
test('non-inert metadata and caller options are rejected without executing getters',async()=>{
 const t=setup();let hits=0;t.owner.prepare=async()=>({get operation(){hits++;return {};}});
 await assert.rejects(t.create().prepare(t.raw));await assert.rejects(t.create().prepare(t.raw,{get signal(){hits++;return undefined;}}));
 await assert.rejects(t.create().prepare(new Proxy({}, {ownKeys(){hits++;throw Error('trap');}})));assert.equal(hits,0);
});
test('same-actor reviewer is not silently forbidden; current approval policy still external',async()=>{
 const t=setup();t.f.proposal.requiredApprover.actorId=t.f.binding.actorId;const p=await t.create().prepare(t.raw);assert.equal(p.proposal.requiredApprover.actorId,t.f.binding.actorId);
});
test('final clock-triggered abort cannot release a pending proposal',async()=>{
 const t=setup(),controller=new AbortController();let stop=false;t.hooks.mutate=()=>{stop=true;};
 const service=t.create({now:()=>{if(stop)controller.abort();return NOW;}});await assert.rejects(service.prepare(t.raw,{signal:controller.signal}));
});
test('unknown metadata-owner output fields and oversized receipts refuse',async()=>{
 const t=setup();t.hooks.mutate=r=>r.approved=true;await assert.rejects(t.create().prepare(t.raw));t.hooks.mutate=null;await assert.rejects(t.create({limits:{maxRequestMs:1000,maxFactBytes:1}}).prepare(t.raw));
});
test('metadata correlations refuse substituted operation, action, binding, request, input and tenant scopes',async()=>{
 for(const mutate of [r=>r.operation.id='other',r=>r.action='task.update',r=>r.binding.actorId='foreign',r=>r.request.title='other',r=>r.inputSha256='f'.repeat(64),r=>r.scopes[0].tenantId='foreign']){
  const t=setup();t.hooks.mutate=mutate;await assert.rejects(t.create().prepare(t.raw));assert.equal(t.counts().prepareCalls,1);
 }
});
test('pre-aborted and late cancelled preparation cannot release a proposal',async()=>{
 const t=setup(),aborted=new AbortController();aborted.abort();await assert.rejects(t.create().prepare(t.raw,{signal:aborted.signal}));assert.equal(t.counts().prepareCalls,0);
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r),ac=new AbortController();
 t.hooks.prepare=async()=>{enter();await gate;};const pending=t.create().prepare(t.raw,{signal:ac.signal});await entered;ac.abort();await assert.rejects(pending);release();await new Promise(r=>setImmediate(r));
 assert.equal(t.counts().prepareCalls,1);
});
test('caller mutation while preparation waits cannot substitute its admitted input',async()=>{
 const t=setup();let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);
 t.hooks.prepare=async()=>{enter();await gate;};const pending=t.create().prepare(t.raw);await entered;t.raw.title='Changed';release();
 assert.equal((await pending).proposal.command.arguments.title,'Task');assert.equal(t.counts().prepareCalls,1);
});
