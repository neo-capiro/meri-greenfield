/** SYNTHETIC SQL/authority/Fetch; actual new composition, canonical private durable budget and command owners. */
import test from 'node:test';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {fixture,NOW,id} from '../../test/commands-fixture.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createTaskUpdateServices} from '../task-update-services.mjs';
import {createTaskUpdateFeature} from '../../task-command-application/feature.mjs';
function setup({resumed=false,enabled=true}={}){
 const f=fixture('task.update',{policy:'a'.repeat(64)}),b=harness();b.setClock(NOW);
 const current=resumed?{...f.binding,attemptId:id(90),workerId:id(91),writerFence:2}:f.binding;
 f.claims.binding=current;f.execution.executorBinding=current;
 f.ports.currentRun=async()=>JSON.stringify({binding:current,policyRevision:f.claims.policyRevision,deadlineMs:NOW+60000,checkedAtMs:f.state.now});
 Object.assign(b.allocation.run,Object.fromEntries(Object.keys(b.allocation.run).map(k=>[k,f.binding[k]])));
 b.allocation.manifest.allowedOperations=[f.descriptor.operation];b.allocation.manifestSha256=canonicalSha256(b.allocation.manifest);
 b.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];b.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 b.invocation.binding=structuredClone(current);b.invocation.qualificationBinding.runId=f.binding.runId;b.invocation.qualificationBinding.fence=current.writerFence;
 b.invocation.allocationSha256=canonicalSha256(b.allocation);b.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 b.state().run.run_id=f.binding.runId;b.state().grant.run_id=f.binding.runId;b.state().grant.capability_sha256=b.invocation.capabilitySha256;b.state().grant.expires_at=new Date(NOW+10000);
 b.state().run.fence=current.writerFence;b.state().grant.fence=current.writerFence;
 const {invocationId:ignored,...context}=b.invocation,sql=createMetadataPoolFixture();let next=100,approved;
 const policy=createMetadataPolicyFixture({binding:f.binding,scopes:f.scopes,requiredApprover:f.proposal.requiredApprover,expiresAt:f.proposal.expiresAt,now:()=>f.state.now});
 const config={metadata:{pool:sql.pool,preparePolicy:policy.preparePolicy},command:{journalPool:f.pg.pool,budgetPool:b.pool,allocationJson:JSON.stringify(b.allocation),producerContext:{context,producer:b.producer},authority:f.authority,
  approvalStore:{async getCurrent(){if(!approved)throw Error('not approved');return JSON.stringify({decision:{...f.decision,proposalId:approved.proposalId,commandSha256:approved.commandSha256,decidedAt:approved.createdAt},checkedAtMs:f.state.now,revoked:false});}}},
  source:{origin:'https://source.invalid',async getCredentials({binding}){return {binding,bearerToken:'synthetic-user',serviceSecret:'synthetic-service',expiresAtMs:NOW+10000};},
   async fetchImpl(url,options){f.state.fetches++;f.state.http={url,options};return Response.json({tool:'update_task',generatedAt:new Date(f.state.now).toISOString(),updated:true,task:{id:id(21),title:'Updated',status:'todo',dueDate:null,clientId:null,updatedAt:new Date(f.state.now).toISOString()}});}},
  commandContext:f.context,now:()=>f.state.now,newId:()=>id(next++),limits:{maxRequestMs:5000,maxFactBytes:65536,maxResponseBytes:65536,maxCleanupMs:50},...(enabled?{sourceEnabled:true}:{})};
 return {f,b,config,services:createTaskUpdateServices(config),approve:p=>{approved=p;},sql};
}
for(const resumed of [false,true])test(`durable update composition prepares then consumes one real budget invocation${resumed?' with fresh resumed authority':''}`,async()=>{
 const c=setup({resumed});assert.equal(c.b.commands.length,0);assert.equal(c.sql.calls.length,0);
 const {proposal}=await c.services.commands.prepare({taskId:id(21),title:'Updated',status:'open'});assert.equal(c.f.state.fetches,0);c.approve(proposal);
 await c.services.commandExecutor.bindTrustedGrant(JSON.stringify(c.b.invocation));
 const execution={...c.f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey};
 const result=await c.services.commands.executeApproved(proposal,execution,'synthetic');assert.equal(result.status,'observed');assert.equal(c.f.state.fetches,1);
 assert.equal(c.f.state.http.url,'https://source.invalid/clio/tools/update_task');assert.equal(c.b.state().budget.consumed_micro_usd,'10');
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
