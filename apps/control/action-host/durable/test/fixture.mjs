/** Existing inert SQL/source fixtures only. Never imported by durable production. */
import {randomUUID,createHash} from 'node:crypto';
import {harness,limits as gatewayLimits} from '../../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {canonicalSha256,assertProposalIntegrity} from '../../../../../packages/contracts/validate.mjs';
import {setup as followthroughSetup,NOW} from '../../../action-followthrough/test/fixture.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../../commands/approval-metadata/test/fixture.mjs';
import {resolveOperationContract} from '../../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {createLocalActionGateway} from '../../../../gateway/local-action/gateway.mjs';
import {nativeScopedPage} from '../../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
import {createLocalLookupAuthorizer} from '../../../../gateway/local-action/control-authorizer.mjs';
import {assertTaskLookupStoredBinding} from '../../../task-lookup/index.mjs';
import {createCommandToolInterface} from '../../../commands/tool-interface.mjs';
import {createDurableActionServices} from '../index.mjs';
export async function setupDurableFixture(){
 const t=await followthroughSetup(),f=t.f,h=harness();h.setClock(NOW);
 Object.assign(h.allocation.run,Object.fromEntries(Object.keys(h.allocation.run).map(k=>[k,f.binding[k]])));
 h.allocation.manifest.allowedOperations=[f.descriptor.operation];h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);
 h.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];h.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 h.invocation.binding=structuredClone(f.binding);h.invocation.qualificationBinding.runId=f.binding.runId;
 h.invocation.allocationSha256=canonicalSha256(h.allocation);h.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 h.state().run.run_id=f.binding.runId;h.state().grant.run_id=f.binding.runId;h.state().grant.capability_sha256=h.invocation.capabilitySha256;h.state().grant.expires_at=new Date(NOW+10000);
 const {invocationId:unused,...context}=h.invocation,metadataSql=createMetadataPoolFixture();
 const policy=createMetadataPolicyFixture({binding:f.binding,scopes:f.scopes,requiredApprover:f.proposal.requiredApprover,expiresAt:f.proposal.expiresAt,now:t.clock});
 const state={approved:false,sourceReads:0};
 const readH=harness(),readOperation={id:'actions.query',version:'0.2.0'},readContract=resolveOperationContract(readOperation);readH.setClock(NOW);
 readH.allocation.run=Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]]));
 readH.allocation.manifest.allowedOperations=[readOperation];readH.allocation.manifest.requiredSources=readContract.descriptor.sourceRequirements;readH.allocation.manifest.subjectKinds=['client'];
 readH.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();readH.allocation.manifestSha256=canonicalSha256(readH.allocation.manifest);readH.allocation.schedule.operations=[{operation:readOperation,chargeMicrousd:10}];
 readH.invocation.binding=structuredClone(f.binding);readH.invocation.qualificationBinding.runId=f.binding.runId;readH.invocation.capabilitySha256=t.issued.capabilitySha256;readH.invocation.allocationSha256=canonicalSha256(readH.allocation);
 readH.state().run.run_id=f.binding.runId;readH.state().grant.run_id=f.binding.runId;readH.state().grant.capability_sha256=t.issued.capabilitySha256;readH.state().grant.expires_at=new Date(NOW+10000);
 const source={origin:'https://local-action.invalid',getCredentials:async({signal})=>{await t.identity.authorityPorts.verifyCapability(t.issued.credential,{signal});return{binding:f.binding,bearerToken:'SYNTHETIC_SOURCE',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:NOW+9000};},fetchImpl:async(url,init)=>{await t.identity.authorityPorts.verifyCapability(t.issued.credential,{signal:init.signal});if(url!=='https://local-action.invalid/clio/tools/query_action_items'||init.method!=='POST')throw Error('Fixture source mismatch');state.sourceReads++;return new Response(JSON.stringify(nativeScopedPage(JSON.parse(init.body))),{headers:{'content-type':'application/json'}});}};
 const readGateway=createLocalActionGateway({mode:'synthetic-local',identity:t.identity,pool:readH.pool,allocationJson:JSON.stringify(readH.allocation),source,limits:gatewayLimits,now:t.clock,newId:randomUUID});
 let sequence=2;const lookupContext=()=>({lookupId:randomUUID(),resultReference:randomUUID(),requestId:randomUUID(),binding:f.binding,scopes:t.scopes,selectedClientId:t.clientId,deliveryJson:readH.delivery(randomUUID()),slots:{started:{eventId:randomUUID(),sequence:++sequence},terminal:{eventId:randomUUID(),sequence:++sequence}},deadlineMs:NOW+9000});
 const approvalStore={async getCurrent(value){if(!state.approved||value.proposalId!==f.decision.proposalId||value.commandSha256!==f.decision.commandSha256)throw Error('synthetic approval absent');return f.approvalStore.getCurrent(value);}};
 const config={lookup:{pool:t.pool.pool,gateway:readGateway,authorize:createLocalLookupAuthorizer({identity:t.identity,credential:t.issued.credential,assertStoredBinding:assertTaskLookupStoredBinding,now:t.clock})},metadata:{pool:metadataSql.pool,preparePolicy:policy.preparePolicy},command:{journalPool:f.pg.pool,budgetPool:h.pool,allocationJson:JSON.stringify(h.allocation),producerContext:{context,producer:h.producer},authority:f.authority,approvalStore,source:f.source,contracts:f.contracts,descriptor:f.descriptor},commandContext:f.context,now:t.clock,newId:randomUUID,limits:{maxRequestMs:1000,maxFactBytes:65536,maxResponseBytes:65536,maxCleanupMs:40},sourceEnabled:true};
 const reconstruct=changes=>createDurableActionServices({...config,...changes}),tool=services=>createCommandToolInterface((services??reconstruct()).commandOptions);
 const call=proposal=>({proposal,execution:{...f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey}});
 return {t,f,h,readH,readGateway,lookupContext,lookupCredential:t.issued.credential,lookupRequest:{limit:20},readContext:t.readContext,config,state,policy,metadataSql,lookupSql:t.pool,reconstruct,tool,call,
  raw:{title:'Explicit durable task',clientId:t.clientId,dueDate:null},
  async ready(services){await readGateway.bindTrustedGrant(readH.json());await (services??reconstruct()).commandExecutor.bindTrustedGrant(JSON.stringify(h.invocation));},
  setClock(value){f.state.now=value;h.setClock(value);readH.setClock(value);},
  approve(proposal){assertProposalIntegrity(proposal);Object.assign(f.command,structuredClone(proposal.command));Object.assign(f.execution,call(proposal).execution);Object.assign(f.decision,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decidedAt:proposal.createdAt});state.approved=true;},
  revokeApproval(){f.state.approvalRevoked=true;},revoke(){f.state.revoked=true;t.identity.revoke(t.issued.credential);},
  close(){t.identity.close();}
 };
}
