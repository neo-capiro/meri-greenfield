import test from 'node:test';import assert from 'node:assert/strict';import {pathToFileURL} from 'node:url';
import {setup} from '../../../docs/qualification/candidates/vertical-source-20261012/command-tool-review/fixture.mjs';
const root=process.env.MERI_TOOL_INTERFACE_ROOT;
const {createCommandToolInterface}=await import(root?pathToFileURL(root+'/apps/control/commands/tool-interface.mjs'):new URL('../commands/tool-interface.mjs',import.meta.url));

test('direct tool interface refuses absent executor result rather than exposing it as execution',async()=>{
 const t=setup(),service=createCommandToolInterface({...t.base,executor:{async execute(){return {status:'absent',outcome:null};}}}),p=await service.prepare(t.raw);
 await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,0);
});
test('direct interface correlates actual returned receipt to original command',async()=>{
 const t=setup(),actual=t.f.make(),service=createCommandToolInterface({...t.base,executor:{async execute(...args){const result=structuredClone(await actual.execute(...args));result.outcome.receipt.commandSha256='f'.repeat(64);return result;}}}),p=await service.prepare(t.raw);
 await assert.rejects(service.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,1);
});

for(const action of ['task.create','task.update','memory.propose','artifact.file'])test(`${action}: actual raw→proposal→current executor/journal/source path`,async()=>{
 const t=setup(action),service=createCommandToolInterface(t.base),pending=await service.prepare(t.raw);
 assert.deepEqual(pending,{status:'approval_required',proposal:t.f.proposal});assert.equal(t.f.state.effects,0);assert.equal(t.f.state.sqlRows.length,0);
 assert.equal(Object.isFrozen(pending.proposal.command),true);
 const result=await service.executeApproved(pending.proposal,t.f.execution,'synthetic');assert.equal(result.status,'observed');assert.equal(t.f.state.effects,1);assert.equal(t.f.state.sqlRows[0].state,'OUTCOME');
 const repeated=await createCommandToolInterface(t.base).executeApproved(pending.proposal,t.f.execution,'synthetic');assert.deepEqual(repeated,result);assert.equal(t.f.state.effects,1);
});

test('raw request authority injection is rejected before metadata allocation',async()=>{
 const t=setup(),s=createCommandToolInterface(t.base);for(const key of ['binding','scopes','requiredApprover','commandId','proposalId','expiresAt','approved'])await assert.rejects(s.prepare({...t.raw,[key]:'model'}));
 assert.equal(t.calls.length,0);assert.equal(t.f.state.effects,0);
});

test('metadata exact operation/action/binding/request/input/scopes/approver correlations',async()=>{
 for(const mutate of [r=>r.operation.id='other',r=>r.operation.version='0.1.0',r=>r.action='task.update',r=>r.binding.writerFence++,r=>r.binding.tenantId='other',r=>r.request.title='changed',r=>r.inputSha256='f'.repeat(64),r=>r.scopes[0].tenantId='other',r=>r.requiredApprover.tenantId='other',r=>r.extra=true]){
  const t=setup();t.hooks.returnPrepare=mutate;await assert.rejects(createCommandToolInterface(t.base).prepare(t.raw));assert.equal(t.f.state.effects,0);assert.equal(t.f.state.sqlRows.length,0);
 }
});

test('metadata clocks require finite current checkedAt and ordered unexpired proposal',async()=>{
 for(const mutate of [r=>r.checkedAtMs--,r=>r.checkedAtMs++,r=>r.checkedAtMs=NaN,r=>r.expiresAt=r.createdAt,r=>r.expiresAt='2016-12-31T23:59:60.000Z',r=>r.createdAt='2099-01-01T00:00:00.000Z']){
  const t=setup();t.hooks.returnPrepare=mutate;await assert.rejects(createCommandToolInterface(t.base).prepare(t.raw));assert.equal(t.f.state.effects,0);
 }
});

test('effectful raw/options/owner receipts refuse without executing getters or traps',async()=>{
 const t=setup(),s=createCommandToolInterface(t.base);let hits=0;
 await assert.rejects(s.prepare({get title(){hits++;return 'x';}}));await assert.rejects(s.prepare(t.raw,{get signal(){hits++;return undefined;}}));
 t.owner.prepare=async()=>new Proxy({}, {ownKeys(){hits++;throw Error('trap');}});await assert.rejects(s.prepare(t.raw));assert.equal(hits,0);
});

test('lost metadata acknowledgement is not retried and may leave an owner record',async()=>{
 const t=setup();t.hooks.returnPrepare=()=>{throw Error('private ack failure');};await assert.rejects(createCommandToolInterface(t.base).prepare(t.raw));assert.equal(t.calls.filter(x=>x==='prepare').length,1);assert.ok(t.retained());assert.equal(t.f.state.effects,0);
});

test('preaborted prepare never enters metadata owner',async()=>{
 const t=setup(),ac=new AbortController();ac.abort();await assert.rejects(createCommandToolInterface(t.base).prepare(t.raw,{signal:ac.signal}));assert.deepEqual(t.calls,[]);
});

for(const phase of ['prepare','read'])test(`late ${phase} receipt after cancellation never releases/starts effect`,async()=>{
 const t=setup(),s=createCommandToolInterface(t.base);const pending=phase==='read'?await s.prepare(t.raw):null;
 let enter,release;const entered=new Promise(r=>enter=r),gate=new Promise(r=>release=r);t.hooks[phase]=async()=>{enter();await gate;};const ac=new AbortController();
 const work=phase==='prepare'?s.prepare(t.raw,{signal:ac.signal}):s.executeApproved(pending.proposal,t.f.execution,'synthetic',ac.signal);const refusal=assert.rejects(work);await entered;ac.abort();await refusal;release();await new Promise(r=>setImmediate(r));
 assert.equal(t.f.state.effects,0);assert.equal(t.f.state.sqlRows.length,0);
});

test('clock advances past original metadata cutoff cannot issue a proposal',async()=>{
 const t=setup();t.hooks.prepare=()=>{t.f.state.now+=501;};await assert.rejects(createCommandToolInterface(t.base).prepare(t.raw));assert.equal(t.f.state.effects,0);
});

test('read must reconstruct every original proposal field, including retention clocks',async()=>{
 for(const mutate of [r=>r.commandId='00000000-0000-4000-8000-000000000090',r=>r.proposalId='00000000-0000-4000-8000-000000000091',r=>r.idempotencyKey='other',r=>r.scopes[0].policyRevision='other',r=>r.requiredApprover.actorId='other',r=>r.expiresAt='2026-10-13T22:00:00.000Z']){
  const t=setup(),s=createCommandToolInterface(t.base),p=await s.prepare(t.raw);t.hooks.returnRead=mutate;await assert.rejects(s.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,0);assert.equal(t.f.state.sqlRows.length,0);
 }
});

test('current owner refusal and current approval revocation independently stop execution',async()=>{
 const t=setup(),s=createCommandToolInterface(t.base),p=await s.prepare(t.raw);t.hooks.read=()=>{throw Error('private policy refusal');};await assert.rejects(s.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,0);
 delete t.hooks.read;t.f.state.approvalRevoked=true;await assert.rejects(s.executeApproved(p.proposal,t.f.execution,'synthetic'));assert.equal(t.f.state.effects,0);
});

test('caller mutation while preparation is parked cannot substitute selected input',async()=>{
 const t=setup(),s=createCommandToolInterface(t.base);let release,enter;const gate=new Promise(r=>release=r),entered=new Promise(r=>enter=r);t.hooks.prepare=async()=>{enter();await gate;};const work=s.prepare(t.raw);await entered;t.raw.title='changed';release();const result=await work;assert.equal(result.proposal.command.arguments.title,'Independently reviewed task');assert.equal(t.f.state.effects,0);
});

test('personal preparation remains proposal-only and execution keeps genuine producer HOLD',async()=>{
 const t=setup('memory.propose');t.raw.scope='personal';const s=createCommandToolInterface(t.base),p=await s.prepare(t.raw),execution={...t.f.execution,commandSha256:p.proposal.commandSha256};
 t.f.command.arguments.scope='personal';t.f.resign();await assert.rejects(s.executeApproved(p.proposal,execution,'synthetic'),/PENDING_PRODUCER_UNAVAILABLE/);assert.equal(t.f.state.effects,0);assert.equal(t.f.state.sqlRows.length,0);
});

test('same actor approver is not silently prohibited by transport correlation',async()=>{
 const t=setup();t.f.proposal.requiredApprover.actorId=t.f.binding.actorId;const p=await createCommandToolInterface(t.base).prepare(t.raw);assert.equal(p.proposal.requiredApprover.actorId,t.f.binding.actorId);
});

test('metadata phase ends before independently bounded executor lifetime begins',async()=>{
 const t=setup(),s=createCommandToolInterface({...t.base,limits:{maxRequestMs:1,maxFactBytes:65536}}),p=await s.prepare(t.raw);
 const actual=t.f.make();const late=createCommandToolInterface({...t.base,limits:{maxRequestMs:1,maxFactBytes:65536},executor:{async execute(...args){await new Promise(r=>setTimeout(r,10));return actual.execute(...args);}}});
 const out=await late.executeApproved(p.proposal,t.f.execution,'synthetic');assert.equal(out.status,'observed');assert.equal(t.f.state.effects,1);
});

test('caller cancellation after actual executor completion cannot release late success',async()=>{
 const t=setup(),actual=t.f.make(),ac=new AbortController(),s=createCommandToolInterface({...t.base,executor:{async execute(...args){const value=await actual.execute(...args);ac.abort();return value;}}}),p=await s.prepare(t.raw);
 await assert.rejects(s.executeApproved(p.proposal,t.f.execution,'synthetic',ac.signal));assert.equal(t.f.state.effects,1);assert.equal(t.f.state.sqlRows[0].state,'OUTCOME');
});
