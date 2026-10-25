/** Actual attended HTTP/journal owners; the Core read port supplies its locked absence proof. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {standaloneFixture,id} from './standalone-tasks-fixture.mjs';
import {actionFixture} from './standalone-actions-fixture.mjs';
import {receiveActionResponse} from '../../../../packages/contracts/dist/action-application.mjs';
import {receiveTaskCommandResponse} from '../../../../packages/contracts/dist/task-command-application.mjs';
const proof=p=>({state:'NOT_EXECUTED',proposalId:p.proposalId,commandSha256:p.commandSha256,idempotencyKey:p.command.idempotencyKey,binding:p.command.binding,reason:'expired',checkedAt:p.expiresAt});
async function prepare(f,action){
 let request=f.raw;
 if(action==='task.create'){
  const query=await(await f.call('query',{request:{}})).json(),selection={resultReference:query.resultReference,resultSha256:query.resultSha256,actionId:query.observation.result.actions[0].id};
  const draft=await(await f.call('draft',{selection})).json();request={requestId:id(70),draft};
 }
 const r=await f.call('prepare',request);assert.equal(r.status,200,await r.clone().text());return (await r.json()).proposal;
}
for(const action of ['task.create','task.update'])test(`${action} expired attempted command exposes only exact Core terminal proof under a current reconnected session`,async()=>{
 const f=action==='task.create'?actionFixture():standaloneFixture({general:true}),p=await prepare(f,action);
 f.state.now=Date.parse(p.expiresAt)+1;f.state.binding={...f.binding,runId:id(91),writerFence:f.binding.writerFence+1};
 f.shared.tasks.read=async()=>proof(p);
 const response=await f.call('execute',{proposal:p});assert.equal(response.status,200,await response.clone().text());
 const text=await response.text(),expected={status:'not_executed',...proof(p)};delete expected.state;
 const received=action==='task.create'?await receiveActionResponse('execute',200,text,{proposal:p}):await receiveTaskCommandResponse('execute',200,text,{binding:Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,p.command.binding[k]])),proposal:p});
 assert.deepEqual(received,expected);assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);assert.equal(f.metadata.rows.size,1);
 f.shared.tasks.read=async()=>({...proof(p),checkedAt:p.createdAt});assert.notEqual((await f.call('execute',{proposal:p})).status,200);
 f.shared.tasks.read=async()=>({state:'UNKNOWN'});assert.deepEqual(await(await f.call('execute',{proposal:p})).json(),{status:'indeterminate',outcome:null});
 f.shared.tasks.read=async()=>null;const absent=await f.call('execute',{proposal:p});assert.equal(absent.status,409);assert.equal((await absent.json()).error.code,'COMMAND_APPROVAL_REFUSED');
 assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);
});
test('terminal proof still requires final retention release and cannot bypass revoked current access',async()=>{
 let suppressed=false;const f=standaloneFixture({general:true,retention:{async assertServable(){},async withRelease(_subjects,release,{signal}){return release(signal,async()=>{if(suppressed)throw Error('suppressed');});}}}),p=await prepare(f,'task.update');
 f.state.now=Date.parse(p.expiresAt)+1;f.shared.tasks.read=async()=>proof(p);suppressed=true;
 const withheld=await f.call('execute',{proposal:p});assert.notEqual(withheld.status,200);assert.equal((await withheld.json()).error.outcome,'RESULT_NOT_RELEASED');
 suppressed=false;f.state.revoked=true;assert.equal((await f.call('execute',{proposal:p})).status,401);assert.equal(f.state.effects,0);assert.equal(f.state.decisions,0);
});
