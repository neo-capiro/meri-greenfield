/** Canonical task-update composition over scripted SQL/authority/Fetch; shared by actual factory receiving checks. */
import {createHash} from 'node:crypto';
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {fixture,NOW,id} from '../../test/commands-fixture.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createTaskUpdateServices} from '../task-update-services.mjs';
export function taskUpdateServicesFixture({resumed=false,enabled=true}={}){
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
