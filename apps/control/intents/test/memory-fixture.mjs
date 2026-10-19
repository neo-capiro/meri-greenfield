/** Synthetic SQL/authority/Core boundaries over actual metadata, intent, command and governed-memory owners.
 * No provider, native PostgreSQL, production credentials, Core publication or deployment is exercised. */
import {canonicalSha256} from '../../../../packages/contracts/validate.mjs';
import {createHash} from 'node:crypto';
import {harness} from '../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs';
import {fixture as commandFixture,id,NOW} from '../../test/commands-fixture.mjs';
import {createMetadataPoolFixture,createMetadataPolicyFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {createMemoryProposalServices} from '../memory-preparer.mjs';
import {createPostgresCommandExecutor} from '../../commands/durable-executor.mjs';
import {createIntentMount} from '../mount.mjs';
import {createMemoryJournalStore,delivery} from './fixture.mjs';
import {createMemoryProducer} from '../../memory/producer.mjs';
import {createMemoryCommandSource} from '../../memory/command-source.mjs';
import {createPostgresMemoryJournal} from '../../memory/postgres-journal.mjs';
import {createCoreReview} from '../../memory/core-review.mjs';
import {createCoreMemoryReads} from '../../memory/core-memory.mjs';
import {createCoreDouble,ids} from '../../memory/test/fixtures.mjs';
import {createMemoryPoolFixture} from '../../memory/test/pool-fixture.mjs';
import {refuse} from '../../product-access/errors.mjs';

export {id,NOW,delivery};
export const operation=Object.freeze({id:'save_memory',version:'0.2.0'});

export function memoryComposition({scope='personal',conversationClientId=id(9)}={}){
 const f=commandFixture('memory.propose',{policy:'a'.repeat(64)});
 if(scope==='client')f.scopes.splice(0,f.scopes.length,{tenantId:f.binding.tenantId,kind:'client',resourceId:conversationClientId,policyRevision:f.claims.policyRevision});
 const budget=harness();budget.setClock(NOW);
 Object.assign(budget.allocation.run,Object.fromEntries(Object.keys(budget.allocation.run).map(key=>[key,f.binding[key]])));
 budget.allocation.manifest.allowedOperations=[f.descriptor.operation];budget.allocation.manifestSha256=canonicalSha256(budget.allocation.manifest);
 budget.allocation.schedule.operations=[{operation:f.descriptor.operation,chargeMicrousd:10}];budget.allocation.schedule.expiresAt=new Date(NOW+10000).toISOString();
 budget.invocation.binding=structuredClone(f.binding);budget.invocation.qualificationBinding.runId=f.binding.runId;
 budget.invocation.allocationSha256=canonicalSha256(budget.allocation);budget.invocation.capabilitySha256=createHash('sha256').update('synthetic').digest('hex');
 budget.state().run.run_id=f.binding.runId;budget.state().grant.run_id=f.binding.runId;
 budget.state().grant.capability_sha256=budget.invocation.capabilitySha256;budget.state().grant.expires_at=new Date(NOW+10000);
 const {invocationId:ignored,...grantContext}=budget.invocation;
 const commandContext={binding:f.binding,conversationClientId},sql=createMetadataPoolFixture();
 const policy=createMetadataPolicyFixture({binding:f.binding,scopes:f.scopes,requiredApprover:{tenantId:f.binding.tenantId,actorId:f.binding.actorId},
  expiresAt:new Date(NOW+45000).toISOString(),now:()=>f.state.now});
 const memorySql=createMemoryPoolFixture(),journal=createPostgresMemoryJournal({pool:memorySql.pool,guardConversationRetention:true});
 const core=createCoreDouble(),state={retentionReads:0,retentionSuppressed:false,releaseRevoked:false,executions:0};
 const connect=sql.pool.connect;
 sql.pool.connect=async()=>{const client=await connect();return {...client,async query(query){
  const result=await client.query(query);
  if(state.loseMetadataInsertAck&&query.text.startsWith('INSERT')){state.loseMetadataInsertAck=false;throw Error('Synthetic lost metadata INSERT acknowledgment');}
  return result;
 }};};
 const producer=createMemoryProducer({journal,review:createCoreReview({transport:core.transport}),memory:createCoreMemoryReads({transport:core.transport}),
  retention:{async assertServable(subject){state.retentionReads++;if(subject.tenantId!==f.binding.tenantId||subject.subjectId!==f.binding.conversationId||state.retentionSuppressed)refuse('MEMORY_PROPOSAL_NOT_FOUND');}},
  requireSurfaceRetentionSubject:true,newId:ids(300),now:()=>f.state.now});
 const source=createMemoryCommandSource({producer,binding:f.binding,selectedClientId:conversationClientId??id(9)});
 const approvals=new Map(),approvalStore={async getCurrent({proposalId}){
  const decision=approvals.get(proposalId);if(!decision)throw Error('No current synthetic approval');
  return JSON.stringify({decision,checkedAtMs:f.state.now,revoked:f.state.approvalRevoked});
 }};
 const createExecutor=()=>createPostgresCommandExecutor({pool:budget.pool,allocationJson:JSON.stringify(budget.allocation),producerContext:{context:grantContext,producer:budget.producer},
  journal:f.journal,authority:f.authority,approvalStore,source,contracts:f.contracts,descriptor:f.descriptor,context:commandContext,
  now:()=>f.state.now,newId:()=>id(50),limits:{maxRequestMs:9000,maxResponseBytes:65536,maxCleanupMs:40},sourceEnabled:true});
 const executor={async execute(...args){state.executions++;const durable=createExecutor();
  await durable.bindTrustedGrant(JSON.stringify(budget.invocation));return durable.execute(...args);
 }};
 let sequence=100;
 const services=createMemoryProposalServices({metadata:{pool:sql.pool,preparePolicy:policy.preparePolicy},commandContext,executor,
  now:()=>f.state.now,newId:()=>id(sequence++),limits:{maxRequestMs:1000,maxFactBytes:65536}});
 const intentStore=createMemoryJournalStore();
 const resultRelease={async check({selection,selectionSha256}){
  if(state.releaseRevoked)throw Error('Synthetic current rights revoked');
  return {authorized:true,selectionSha256,binding:selection.binding,scopes:f.scopes,checkedAtMs:f.state.now,expiresAtMs:NOW+60000};
 }};
 const newMount=()=>createIntentMount({binding:f.binding,preparers:[services.preparer],journalStore:intentStore.port,now:()=>f.state.now,
  limits:{maxRequestMs:5000},enabled:true,resultRelease});
 const raw={content:'  Retain the source attribution  ',scope,ttlDays:0.5};
 const prepare=(request=raw,deliveryId=delivery(1))=>newMount().prepare({operation,arguments:request,deliveryId});
 const approve=proposal=>approvals.set(proposal.proposalId,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',
  decidedAt:proposal.createdAt,expiresAt:new Date(NOW+40000).toISOString(),approver:proposal.requiredApprover,policyRevision:f.claims.policyRevision});
 const executeApproved=proposal=>services.commands.executeApproved(proposal,{...f.execution,proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},'synthetic');
 const callFor=request=>{
  const input=services.commandOptions.validators.normalizeCommandToolInput('memory.propose',request,{commandContext}).input;
  return {operation,action:'memory.propose',binding:f.binding,request,input,inputSha256:canonicalSha256(input),deadlineMs:f.state.now+1000,signal:undefined};
 };
 return {f,sql,policy,commandContext,services,journal,memorySql,core,state,intentStore,newMount,raw,prepare,approve,executeApproved,callFor,budget};
}
