import test from 'node:test';
import assert from 'node:assert/strict';
import {actionFixture,id} from './standalone-actions-fixture.mjs';
import {receiveActionResponse} from '../../../../packages/contracts/dist/action-application.mjs';
async function ok(f,route,body){const response=await f.call(route,body);assert.equal(response.status,200,await response.clone().text());return response.json();}
async function drafted(f){const query=await ok(f,'query',{request:{limit:20}}),selection={resultReference:query.resultReference,resultSha256:query.resultSha256,actionId:query.observation.result.actions[0].id};return ok(f,'draft',{selection,edits:{title:'Reviewed recommendation'}});}
test('standalone action query, draft, durable preparation and explicit native approval use existing owners',async()=>{
 const f=actionFixture(),draft=await drafted(f);assert.equal(draft.status,'draft');assert.equal(f.metadata.rows.size,0);assert.equal(f.state.effects,0);
 const request={requestId:id(70),draft},prepared=await ok(f,'prepare',request);assert.equal(prepared.proposal.command.action,'task.create');assert.equal(prepared.proposal.command.arguments.title,draft.task.title);
 assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);assert.deepEqual(await ok(f,'prepare',request),prepared);assert.equal(f.metadata.rows.size,1);assert.equal(f.state.sourceCalls,1);
 await receiveActionResponse('prepare',200,JSON.stringify(prepared),{request});
 const observed=await ok(f,'execute',{proposal:prepared.proposal});await receiveActionResponse('execute',200,JSON.stringify(observed),{proposal:prepared.proposal});
 assert.equal(observed.outcome.execution.kind,'native-task');assert.equal(f.state.effects,1);assert.equal(f.state.decisions,1);
 assert.deepEqual(await ok(f,'execute',{proposal:prepared.proposal}),observed);assert.equal(f.state.effects,1);
 assert.ok(f.state.wire.every(w=>!JSON.stringify(w.body).includes('allocation')));assert.equal(f.lookup.lookups.size,1);assert.equal(f.lookup.events.size,2);
});
test('independent queries allocate distinct retained event slots without a conversation run',async()=>{
 const f=actionFixture();await drafted(f);await drafted(f);assert.equal(f.lookup.events.size,4);
 assert.deepEqual([...f.lookup.events.values()].filter(e=>e.event).map(e=>e.event.sequence).sort(),[1,2,3,4]);assert.equal(f.state.sourceCalls,2);assert.equal(f.metadata.rows.size,0);
});
test('source/client mutation, changed recommendation and caller authority never prepare',async()=>{
 const f=actionFixture(),draft=await drafted(f);
 for(const body of [{draft},{requestId:id(70),draft,binding:f.binding},{requestId:id(70),draft:{...draft,draftSha256:'0'.repeat(64)}}])assert.notEqual((await f.call('prepare',body)).status,200);
 assert.equal(f.metadata.rows.size,0);
 const bad=actionFixture();bad.state.afterSource=page=>{page.actions[0].acceptedAsTask=true;};assert.notEqual((await bad.call('query',{request:{}})).status,200);assert.equal(bad.metadata.rows.size,0);
 const revoked=actionFixture();revoked.state.afterSource=()=>{revoked.state.revoked=true;};assert.notEqual((await revoked.call('query',{request:{}})).status,200);assert.notEqual([...revoked.lookup.lookups.values()][0].state,'RESULT');
});
test('action PREPARED replay retains original draft across expiry; absent stale draft is a proven refusal',async()=>{
 const f=actionFixture(),draft=await drafted(f),request={requestId:id(70),draft},prepared=await ok(f,'prepare',request);
 f.state.now+=61000;f.state.binding={...f.binding,runId:id(90)};
 assert.deepEqual(await ok(f,'prepare',request),prepared);assert.equal(f.state.sourceCalls,1);assert.equal(f.metadata.rows.size,1);
 assert.notEqual((await f.call('prepare',{...request,draft:{...draft,task:{...draft.task,title:'Changed'}}})).status,200);
 const absent=await f.call('prepare',{...request,requestId:id(71)});assert.equal(absent.status,409);assert.deepEqual(await receiveActionResponse('prepare',absent.status,await absent.text()),{error:{code:'COMMAND_PREPARATION_REFUSED',outcome:'NOT_DISPATCHED'}});
 assert.equal(f.metadata.rows.size,1);assert.equal(f.state.effects,0);assert.equal((await f.call('execute',{proposal:prepared.proposal})).status,409);
});
