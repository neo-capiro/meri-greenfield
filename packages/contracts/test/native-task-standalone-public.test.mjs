/** Standalone public codecs against canonical native task proposals/results; no Core or browser claim. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {receiveActionResponse,receiveActionPrepareRequest} from '../dist/action-application.mjs';
import {receiveTaskCommandRequest,receiveTaskCommandResponse} from '../dist/task-command-application.mjs';
import {nativeTaskFixture} from '../../../apps/control/intents/test/native-task-fixture.mjs';
import {id} from '../../../apps/control/conversations/test/application-fixture.mjs';
const json=JSON.stringify,stable=b=>Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,b[k]]));
for(const action of ['task.create','task.update'])for(const general of [false,true])test(`${action} ${general?'General':'client'} native standalone outcome correlates original proposal`,async()=>{
 const f=nativeTaskFixture({action,general}),value={status:'observed',outcome:f.outcome},read=out=>action==='task.create'?
  receiveActionResponse('execute',200,json(out),{proposal:f.proposal}):receiveTaskCommandResponse('execute',200,json(out),{binding:stable(f.proposal.command.binding),proposal:f.proposal});
 assert.deepEqual(await read(value),value);
 for(const mutate of [o=>{o.execution.proposalId=id(999);},o=>{o.execution.binding.writerFence++;},o=>{o.execution.idempotencyKey='other';},o=>{o.execution.completedAt='2000-01-01T00:00:00.000Z';},o=>{o.result.title='other';}]){
  const changed=structuredClone(value);mutate(changed.outcome);await assert.rejects(read(changed));
 }
});
test('native create outcome needs an inert retained proposal',async()=>{
 const f=nativeTaskFixture(),value=json({status:'observed',outcome:f.outcome});
 await assert.rejects(receiveActionResponse('execute',200,value));
 let accessed=0;await assert.rejects(receiveActionResponse('execute',200,value,{get proposal(){accessed++;return f.proposal;}}));assert.equal(accessed,0);
});
test('task update preparation requires its immutable UUID delivery identity',async()=>{
 const request={requestId:id(998),arguments:{taskId:id(997),title:'Reviewed'}};
 assert.deepEqual(await receiveTaskCommandRequest('prepare',json(request)),request);
 for(const bad of [{arguments:request.arguments},{...request,requestId:'new'}, {...request,actorId:id(996)}])await assert.rejects(receiveTaskCommandRequest('prepare',json(bad)));
});
test('action task preparation requires identity and the original canonical saved draft',async()=>{
 const wire=JSON.parse(await readFile(new URL('../../../docs/qualification/candidates/action-wiring-20261013/integration/wire-fixtures.json',import.meta.url)));
 const draft=wire.steps.find(step=>step.route==='draft'&&step.httpStatus===200).response,request={requestId:id(998),draft};
 assert.deepEqual(await receiveActionPrepareRequest(json(request)),request);
 for(const bad of [{draft},{...request,requestId:'new'},{...request,draft:{...draft,draftSha256:'f'.repeat(64)}}])await assert.rejects(receiveActionPrepareRequest(json(bad)));
});

for(const action of ['task.create','task.update'])test(`${action} terminal proof requires exact original proposal and canonical expired DB time`,async()=>{
 const f=nativeTaskFixture({action,general:true}),p=f.proposal,value={status:'not_executed',proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey,binding:p.command.binding,reason:'expired',checkedAt:p.expiresAt};
 const read=out=>action==='task.create'?receiveActionResponse('execute',200,json(out),{proposal:p}):receiveTaskCommandResponse('execute',200,json(out),{binding:stable(p.command.binding),proposal:p});
 assert.deepEqual(await read(value),value);
 for(const change of [v=>v.proposalId=id(996),v=>v.commandSha256='a'.repeat(64),v=>v.idempotencyKey='other',v=>v.binding.writerFence++,v=>v.reason='cancelled',v=>v.checkedAt=p.createdAt,v=>v.checkedAt='2026-01-01',v=>v.outcome=null]){const bad=structuredClone(value);change(bad);await assert.rejects(read(bad));}
 if(action==='task.create')await assert.rejects(receiveActionResponse('execute',200,json(value)));
});
