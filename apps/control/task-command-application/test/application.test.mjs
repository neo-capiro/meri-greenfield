/** SYNTHETIC HTTP/session/SQL/current-authority boundaries over actual command update owners and source serialization. */
import test from 'node:test';import assert from 'node:assert/strict';
import {createTaskCommandApplication} from '../index.mjs';
import {commandComposition,id} from '../../intents/test/fixture.mjs';
const args={taskId:id(21),title:'Updated',status:'open'};
function setup({maxResponseBytes=65536}={}){
 const c=commandComposition({action:'task.update'}),state={sessions:0,authorizations:0};
 const fact=()=>({binding:c.binding,commandOptions:c.commandOptions,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+1000,
  async authorizeExecution({proposal}){state.authorizations++;return {credential:'synthetic',execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}});
 const app=createTaskCommandApplication({now:()=>c.f.state.now,limits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes},
  async resolveSession({credential}){state.sessions++;assert.equal(credential,'synthetic-session');return state.fact??fact();}});
 const request=(intent,body,options={})=>new Request('https://meri.invalid/api/task-commands/'+intent,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session'},body:JSON.stringify(body),...options});
 const call=(intent,body)=>app.handle(request(intent,body));return {...c,app,state,fact,request,call};
}
test('task-update Fetch API prepares without effects then accepts the exact approved proposal once',async()=>{
 const c=setup(),prepared=await c.call('prepare',{arguments:args});assert.equal(prepared.status,200);assert.equal(prepared.headers.get('cache-control'),'no-store');
 const {proposal}=await prepared.json();assert.equal(c.f.state.fetches,0);
 const unapproved=await c.call('execute',{proposal});assert.notEqual(unapproved.status,200);assert.equal(c.f.state.fetches,0);
 c.approve(proposal);const result=await c.call('execute',{proposal});assert.equal(result.status,200);assert.equal((await result.json()).status,'observed');
 assert.equal(c.f.state.http.url,'https://source.invalid/api/clio/tools/update_task');assert.equal(c.f.state.fetches,1);
 assert.equal((await c.call('execute',{proposal})).status,200);assert.equal(c.f.state.fetches,1);
});
test('hostile routing, credentials, request shape and cross-tenant session refuse before native work',async()=>{
 const c=setup();
 for(const request of [c.request('execute?x=1',{}),c.request('prepare',{}, {method:'PUT'}),c.request('prepare',{}, {headers:{'content-type':'text/plain'}}),c.request('prepare',{}, {headers:{'content-type':'application/json'}})]){
  assert.notEqual((await c.app.handle(request)).status,200);
 }
 assert.equal(c.state.sessions,0);
 assert.notEqual((await c.call('prepare',{arguments:args,binding:c.binding})).status,200);assert.equal(c.state.sessions,0);
 c.state.fact={...c.fact(),binding:{...c.binding,tenantId:'foreign'}};assert.equal((await c.call('prepare',{arguments:args})).status,403);assert.equal(c.sql.rows.size,0);
});
test('changed task/hash and wrong execution binding are refused; revoked current authority never reaches Core',async()=>{
 const c=setup(),{proposal}=await (await c.call('prepare',{arguments:args})).json();c.approve(proposal);
 const changed=structuredClone(proposal);changed.command.arguments.taskId=id(22);assert.notEqual((await c.call('execute',{proposal:changed})).status,200);
 assert.equal(c.state.authorizations,0);
 const fact=c.fact(),authorize=fact.authorizeExecution;fact.authorizeExecution=async v=>{const result=await authorize(v);result.execution.executorBinding={...c.binding,writerFence:2};return result;};c.state.fact=fact;
 assert.notEqual((await c.call('execute',{proposal})).status,200);assert.equal(c.f.state.fetches,0);
 c.state.fact=null;c.f.state.revoked=true;assert.notEqual((await c.call('execute',{proposal})).status,200);assert.equal(c.f.state.fetches,0);
});
test('acknowledged preparation withheld at response limit is explicit; unknown native effect never reports success',async()=>{
 const c=setup({maxResponseBytes:1}),response=await c.call('prepare',{arguments:args});assert.equal(response.status,413);assert.equal((await response.json()).error.outcome,'RESULT_NOT_RELEASED');assert.equal(c.sql.rows.size,1);
 const d=setup(),{proposal}=await (await d.call('prepare',{arguments:args})).json();d.approve(proposal);d.f.state.fetchHook=()=>{throw Error('private upstream detail');};
 const result=await d.call('execute',{proposal});assert.equal(result.status,502);assert.deepEqual((await result.json()).error,{code:'COMMAND_OUTCOME_UNKNOWN',outcome:'UNKNOWN'});assert.equal(d.f.state.fetches,1);
 assert.equal((await d.call('execute',{proposal})).status,200);assert.equal(d.f.state.fetches,1);
});
test('execution retains the approved original proposal while current authority selects a resumed attempt and writer fence',async()=>{
 const c=setup(),{proposal}=await (await c.call('prepare',{arguments:args})).json();c.approve(proposal);
 const current={...c.binding,attemptId:id(90),workerId:id(91),writerFence:2};
 c.f.state.fence=2;c.f.claims.binding=current;c.f.execution.executorBinding=current;c.state.fact={...c.fact(),binding:current};
 c.f.ports.currentRun=async()=>JSON.stringify({binding:current,policyRevision:c.f.claims.policyRevision,deadlineMs:Date.parse(c.f.claims.expiresAt),checkedAtMs:c.f.state.now});
 const result=await c.call('execute',{proposal});assert.equal(result.status,200,await result.clone().text());assert.equal((await result.json()).status,'observed');assert.equal(c.f.state.fetches,1);
 assert.notEqual((await c.call('prepare',{arguments:args})).status,200,'preparation still requires the exact current original binding');
});
