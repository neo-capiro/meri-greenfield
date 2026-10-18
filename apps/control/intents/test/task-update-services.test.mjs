/** SYNTHETIC SQL/authority/Fetch; actual new composition, canonical private durable budget and command owners. */
import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {id} from '../../test/commands-fixture.mjs';
import {createTaskUpdateServices} from '../task-update-services.mjs';
import {createTaskUpdateFeature} from '../../task-command-application/feature.mjs';
import {taskUpdateServicesFixture as setup} from './task-update-services-fixture.mjs';
for(const resumed of [false,true])test(`durable update composition prepares then consumes one real budget invocation${resumed?' with fresh resumed authority':''}`,async()=>{
 const c=setup({resumed});assert.equal(c.b.commands.length,0);assert.equal(c.sql.calls.length,0);
 const {proposal}=await c.services.commands.prepare({taskId:id(21),title:'Updated',status:'open'});assert.equal(c.f.state.fetches,0);c.approve(proposal);
 await c.services.commandExecutor.bindTrustedGrant(JSON.stringify(c.b.invocation));
 const execution={...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey};
 const result=await c.services.commands.executeApproved(proposal,execution,'synthetic');assert.equal(result.status,'observed');assert.equal(c.f.state.fetches,1);
 assert.equal(c.f.state.http.url,'https://source.invalid/api/clio/tools/update_task');assert.equal(c.b.state().budget.consumed_micro_usd,'10');
 assert.deepEqual(await c.services.commands.executeApproved(proposal,execution,'synthetic'),result);assert.equal(c.f.state.fetches,1);assert.equal(c.b.state().produced.size,1);
});
test('composition defaults source off and rejects a foreign producer binding without connecting',async()=>{
 const c=setup({enabled:false});assert.equal(c.services.commandExecutor.sourceEnabled,false);assert.equal(c.b.commands.length,0);
 const config={...c.config,command:{...c.config.command,producerContext:structuredClone(c.config.command.producerContext)}};
 config.command.producerContext.context.binding.tenantId='foreign';assert.throws(()=>createTaskUpdateServices(config),/COMMAND_CONFIGURATION/);assert.equal(c.b.commands.length,0);
});
test('explicit feature opt-in joins the same canonical intent preparer, approval executor and Fetch API; disabled is inert',async()=>{
 assert.equal(createTaskUpdateFeature({enabled:false}),null);
 const c=setup();let sessionCalls=0;
 const feature=createTaskUpdateFeature({enabled:true,services:c.config,intentJournalPool:{connect(){throw Error('No intent SQL in availability/API checks');}},
  resultRelease:{async check({selection,selectionSha256}){return {authorized:true,selectionSha256,binding:selection.binding,scopes:c.f.scopes,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+1000};}},
  httpLimits:{maxRequestMs:1000,maxRequestBytes:65536,maxResponseBytes:65536},sessions:{async resolve(){sessionCalls++;return {binding:c.f.binding,checkedAtMs:c.f.state.now,expiresAtMs:c.f.state.now+1000,
   async authorizeExecution({proposal}){return {credential:'synthetic',execution:{...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}};}};}}});
 assert.equal(c.b.commands.length,0);assert.equal(c.sql.calls.length,0);assert.equal(sessionCalls,0);
 assert.deepEqual((await feature.intents.readAvailability()).operations,[{id:'update_task',version:'0.2.0'}]);
 const request=(intent,body)=>new Request('https://meri.invalid/api/task-commands/'+intent,{method:'POST',headers:{'content-type':'application/json',authorization:'Bearer synthetic-session'},body:JSON.stringify(body)});
 const prepared=await feature.application.handle(request('prepare',{arguments:{taskId:id(21),title:'Updated',status:'open'}}));assert.equal(prepared.status,200);
 const {proposal}=await prepared.json();assert.equal(c.f.state.fetches,0);c.approve(proposal);await feature.commandExecutor.bindTrustedGrant(JSON.stringify(c.b.invocation));
 const result=await feature.application.handle(request('execute',{proposal}));assert.equal(result.status,200);assert.equal((await result.json()).status,'observed');assert.equal(c.f.state.fetches,1);
});
