import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {commandToolValidators} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore} from '../task-lookup/index.mjs';
import {createTaskLookupPoolFixture} from '../task-lookup/postgres-fixture.mjs';
import {fixture as lookupFixture,envelope} from '../task-lookup/fixtures.mjs';
import {prepare} from '../task-lookup/binding.mjs';
import {nativeScopedPage,id as sourceId} from '../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {setup as commandSetup,id,nextTurn} from '../../../docs/qualification/candidates/vertical-source-20261012/command-tool-review/fixture.mjs';
import {createActionFollowthrough} from './index.mjs';

const client=sourceId(9),clone=structuredClone;
async function setup(changeCard){
 const t=commandSetup(),l=lookupFixture(),pool=createTaskLookupPoolFixture(),state={denied:false,readCalls:0},calls=[];
 t.f.context.clientResolution={reference:client,clientId:client};
 l.context={...l.context,binding:clone(t.f.binding),selectedClientId:client,deadlineMs:t.f.state.now+1000,
  scopes:[{tenantId:t.f.binding.tenantId,kind:'client',resourceId:client,policyRevision:'p1'}],deliveryJson:JSON.stringify({context:{binding:t.f.binding},producer:{namespace:'independent-followthrough',executionId:'one'},deliveryId:'retained'})};
 const original=envelope(prepare(l.request,l.context,t.f.state.now));
 const row=nativeScopedPage({clientId:client}).actions[0];
 if(changeCard){changeCard(row);const sourceFields=Object.fromEntries(Object.entries(row).filter(([key])=>!['recordKind','recommendation','acceptedAsTask','nativeCompletion','sourceProof'].includes(key)));row.sourceProof.contentSha256=createHash('sha256').update(JSON.stringify(sourceFields)).digest('hex');}
 original.result.actions=[row];original.result.total=1;original.result.returned=1;original.result.coverage.returnedCount=1;original.result.pageCoverage.absenceSupported=false;
 const actual=createTaskLookupDelivery({gateway:{async executeOwned(){calls.push('upstream');return JSON.stringify(original);}},store:createPostgresTaskLookupStore({pool:pool.pool}),clock:()=>t.f.state.now,
  authorize:async q=>{calls.push(q.phase);if(state.denied)throw Object.assign(Error('ACCESS_DENIED'),{code:'ACCESS_DENIED'});return {authorized:true,bindingSha256:q.binding.bindingSha256,expiresAtMs:l.context.deadlineMs};}});
 const retained=await actual.lookup({request:l.request,context:l.context,credential:'SYNTHETIC_RECOMMENDATION'});
 t.hooks.prepare=call=>{t.f.command.arguments=clone(call.input.arguments);t.f.resign();};
 t.f.state.hooks.http=()=>new Response(JSON.stringify({tool:'create_task',generatedAt:new Date(t.f.state.now).toISOString(),created:true,task:{id:id(23),...t.f.command.arguments,status:'todo',createdAt:new Date(t.f.state.now).toISOString()}}),{headers:{'content-type':'application/json'}});
 t.base.executor=t.f.make();t.base.validators=commandToolValidators;
 const readContext={currentBinding:clone(t.f.binding),scopes:l.context.scopes,deadlineMs:l.context.deadlineMs};
 const lookup={async read(call){state.readCalls++;return actual.read(call);}};
 const options={lookup,readContext,selectedClientId:client,commandOptions:t.base,now:t.base.now,limits:{maxRequestMs:200,maxFactBytes:65536}};
 const workflow=createActionFollowthrough(options),selection={resultReference:retained.resultReference,resultSha256:retained.resultSha256,actionId:row.id};
 return{t,l,pool,state,calls,original,row,retained,actual,lookup,options,workflow,selection};
}
const gate=()=>{let enter,release;const entered=new Promise(r=>enter=r),blocked=new Promise(r=>release=r);return{enter,release,entered,blocked};};

test('followthrough independent: retained read becomes editable draft and explicit canonical proposal without task effect',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection),edited=await f.workflow.draft(f.selection,{title:'  User-selected follow up  ',dueDate:'2026-11-05'});
 assert.equal(draft.status,'draft');assert.equal(draft.task.title,'Issue');assert.equal(draft.task.clientId,client);assert.equal(draft.task.dueDate,null);assert.ok(Object.isFrozen(draft.task));
 assert.equal(edited.task.title,'User-selected follow up');assert.equal(edited.task.dueDate,'2026-11-05T00:00:00.000Z');
 assert.equal(f.t.calls.length,0);assert.equal(f.t.f.state.effects,0);
 const result=await f.workflow.prepare(edited);assert.equal(result.status,'approval_required');assert.deepEqual(result.draft,edited);assert.deepEqual(result.proposal.command.arguments,edited.task);
 assert.equal(f.state.readCalls,3);assert.equal(f.t.calls.filter(x=>x==='prepare').length,1);assert.equal(f.t.f.state.effects,0);assert.equal(f.t.f.state.sqlRows.length,0);assert.equal(f.workflow.execute,undefined);assert.equal(f.workflow.executeApproved,undefined);
});
test('followthrough independent: standard downstream explicit approval executes once and replays retained outcome',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection,{title:'Explicitly accepted task'}),prepared=await f.workflow.prepare(draft);
 const tool=createCommandToolInterface(f.t.base),out=await tool.executeApproved(prepared.proposal,f.t.f.execution,'SYNTHETIC_COMMAND');
 assert.equal(out.status,'observed');assert.equal(out.outcome.result.title,draft.task.title);assert.equal(f.t.f.state.effects,1);
 const replay=await tool.executeApproved(prepared.proposal,f.t.f.execution,'SYNTHETIC_COMMAND');assert.deepEqual(replay,out);assert.equal(f.t.f.state.effects,1);
});
test('followthrough independent: draft/read permission is never command approval',async()=>{
 const f=await setup(),prepared=await f.workflow.prepare(await f.workflow.draft(f.selection));f.t.f.state.approvalRevoked=true;
 await assert.rejects(createCommandToolInterface(f.t.base).executeApproved(prepared.proposal,f.t.f.execution,'SYNTHETIC_COMMAND'));assert.equal(f.t.f.state.effects,0);
});
for(const [name,mutate] of [['hash',s=>s.resultSha256='f'.repeat(64)],['action',s=>s.actionId=id(99)],['reference',s=>s.resultReference=id(98)],['extra-card',s=>s.card={title:'Caller authority'}]])
 test(`followthrough independent: ${name} selection substitution refuses`,async()=>{const f=await setup(),selected=clone(f.selection);mutate(selected);await assert.rejects(f.workflow.draft(selected));assert.equal(f.t.calls.length,0);});
for(const edits of [{clientId:id(99)},{ownerUserId:id(99)},{requiredApprover:id(99)},{title:' '},{title:'x'.repeat(241)},{dueDate:'2026-11-05T12:00:00.000Z'},{dueDate:'2026-02-30'},{title:12},{dueDate:0}])
 test(`followthrough independent: unsupported or lossy edit ${JSON.stringify(edits).slice(0,60)} refuses`,async()=>{const f=await setup();await assert.rejects(f.workflow.draft(f.selection,edits));assert.equal(f.t.calls.length,0);assert.equal(f.t.f.state.effects,0);});
test('followthrough independent: mutation of a returned draft cannot change prepare input',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection),changed=clone(draft);changed.task.title='Undeclared changed draft';await assert.rejects(f.workflow.prepare(changed));assert.equal(f.t.calls.length,0);
});
test('followthrough independent: rehashed foreign-client draft still fails retained/current correlation',async()=>{
 const f=await setup(),draft=clone(await f.workflow.draft(f.selection));draft.task.clientId=id(99);const {draftSha256,...unsigned}=draft;draft.draftSha256=canonicalSha256(unsigned);
 await assert.rejects(f.workflow.prepare(draft));assert.equal(f.t.calls.length,0);
});
test('followthrough independent: current denial before prepare performs no metadata write',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection);f.state.denied=true;await assert.rejects(f.workflow.prepare(draft),/ACCESS_DENIED/);assert.equal(f.t.calls.length,0);
});
test('followthrough independent: current denial before draft releases no recommendation',async()=>{
 const f=await setup();f.state.denied=true;await assert.rejects(f.workflow.draft(f.selection),/ACCESS_DENIED/);assert.equal(f.t.calls.length,0);
});
test('followthrough independent: corrupt retained source cannot become a task through a correct caller hash',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection);const row=[...f.pool.lookups.values()][0];row.record.observation.result.actions[0].title='Changed retained source';
 await assert.rejects(f.workflow.prepare(draft));assert.equal(f.t.calls.length,0);
});
test('followthrough independent: cancelled parked read cannot enter command preparation after late resolution',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection),g=gate(),ac=new AbortController();
 const workflow=createActionFollowthrough({...f.options,lookup:{async read(call){g.enter();await g.blocked;return f.actual.read(call);}}});
 const work=workflow.prepare(draft,{signal:ac.signal}),refusal=assert.rejects(work);await g.entered;ac.abort();await refusal;g.release();await nextTurn();assert.equal(f.t.calls.length,0);assert.equal(f.t.f.state.effects,0);
});
test('followthrough independent: finite original cutoff covers read and metadata, without reset',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection);let deadline;
 const workflow=createActionFollowthrough({...f.options,lookup:{async read(call){const result=await f.actual.read(call);f.t.f.state.now+=150;return result;}}});
 f.t.hooks.prepare=call=>{deadline=call.deadlineMs;f.t.f.state.now+=60;};const start=f.t.f.state.now;
 await assert.rejects(workflow.prepare(draft));assert.ok(deadline<=start+200);assert.equal(f.t.f.state.effects,0);
});
test('followthrough independent: metadata ACK loss is retained as failure and is not retried',async()=>{
 const f=await setup(),draft=await f.workflow.draft(f.selection);f.t.hooks.returnPrepare=()=>{throw Error('Synthetic lost acknowledgement');};await assert.rejects(f.workflow.prepare(draft));
 assert.equal(f.t.calls.filter(x=>x==='prepare').length,1);assert.ok(f.t.retained());assert.equal(f.t.f.state.effects,0);
});
test('followthrough independent: preaborted or effectful inputs never invoke read/metadata ports',async()=>{
 const f=await setup(),ac=new AbortController();ac.abort();await assert.rejects(f.workflow.draft(f.selection,{}, {signal:ac.signal}));let hits=0;
 await assert.rejects(f.workflow.draft({get resultReference(){hits++;return f.selection.resultReference;},resultSha256:f.selection.resultSha256,actionId:f.selection.actionId}));
 await assert.rejects(f.workflow.draft(f.selection,{get title(){hits++;return 'x';}}));assert.equal(hits,0);assert.equal(f.state.readCalls,0);assert.equal(f.t.calls.length,0);
});

for(const [name,mutate,edits]of [
 ['long-title',r=>r.title='x'.repeat(241),{title:'Explicit shorter task title'}],
 ['time-of-day',r=>r.deadline='2026-11-05T12:00:00.000Z',{dueDate:'2026-11-05'}],
])test(`followthrough independent: ${name} source default requires explicit edit rather than silent loss`,async()=>{
 const f=await setup(mutate);await assert.rejects(f.workflow.draft(f.selection));const draft=await f.workflow.draft(f.selection,edits);assert.equal(draft.status,'draft');assert.equal(f.t.f.state.effects,0);
});
test('followthrough independent: original task A evidence can prepare a task under coherent current B',async()=>{
 const f=await setup(),a=clone(f.t.f.binding),b={...a,attemptId:id(90),workerId:id(91),writerFence:2};
 Object.assign(f.t.f.binding,b);f.t.base.commandContext={...f.t.f.context,binding:b};
 const workflow=createActionFollowthrough({...f.options,readContext:{...f.options.readContext,currentBinding:b},commandOptions:f.t.base});
 const draft=await workflow.draft(f.selection),prepared=await workflow.prepare(draft);assert.deepEqual(prepared.proposal.command.binding,b);assert.equal(f.t.f.state.effects,0);
 assert.ok(JSON.stringify(draft.source).includes(a.attemptId));
});
