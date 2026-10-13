/** Explicit synthetic-local verification graph. No SQL engine, listener or live source. */
import {randomBytes,randomUUID,createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {canonicalSha256,assertProposalIntegrity} from '../../../../packages/contracts/validate.mjs';
import {commandToolValidators,resolveOperationContract} from '../../../../packages/contracts/retrieval-0.2/validate.mjs';
import {data,own,deny} from '../../commands/protocol.mjs';
import {createCommandAuthority} from '../../../gateway/index.mjs';
import {createLocalActionIdentity} from '../../../gateway/local-action/identity.mjs';
import {createLocalActionGateway} from '../../../gateway/local-action/gateway.mjs';
import {createLocalLookupAuthorizer} from '../../../gateway/local-action/control-authorizer.mjs';
import {createTaskLookupDelivery,createPostgresTaskLookupStore,assertTaskLookupStoredBinding} from '../../task-lookup/index.mjs';
import {createPostgresApprovalMetadataStore,createTaskCreateApprovalMetadataOwner} from '../../commands/approval-metadata/index.mjs';
import {createMetadataPoolFixture} from '../../commands/approval-metadata/test/fixture.mjs';
import {createTaskLookupPoolFixture} from '../../task-lookup/postgres-fixture.mjs';
import {fixture as commandFixture,NOW as BASE} from '../../test/commands-fixture.mjs';
import {nativeScopedPage,id} from '../../../../docs/qualification/candidates/task-slice-20261012/action-source-author/accepted-action-fixture.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const hash=s=>createHash('sha256').update(s).digest('hex');
export async function createLocalActionDemo(options){
 const {mode,ttlMs=10000}=own(options,['mode'],['ttlMs']);
 if(mode!=='synthetic-local'||!Number.isSafeInteger(ttlMs)||ttlMs<1||ttlMs>30000||!process.env.MERI_REVIEW_SOURCE_ROOT||resolve(process.env.MERI_REVIEW_SOURCE_ROOT)!==resolve(root))deny('LOCAL_CONFIGURATION');
 const {harness,limits}=await import('../../../../docs/qualification/candidates/durable-invocation-20261012/review/invocation-harness.mjs');
 const {createActionApplication}=await import('../index.mjs');
 const h=harness(),f=commandFixture('task.create',{policy:'a'.repeat(64)}),started=performance.now(),cutoff=BASE+ttlMs,clientId=id(9);
 let closed=false,revoked=false,preparationAllowed=true,reads=0,sequence=0;
 const now=()=>{const at=BASE+Math.floor(performance.now()-started);f.state.now=at;h.setClock(at);return at;};
 const active=signal=>{if(signal?.aborted)deny('CANCELLED');if(closed||revoked||now()>=cutoff)deny('ACCESS_DENIED');};
 const operation={id:'actions.query',version:'0.2.0'},contract=resolveOperationContract(operation);
 // Adapt only explicit fixture identities/time; the concrete budget algorithms remain unchanged.
 Object.assign(h.f.binding,f.binding);h.invocation.qualificationBinding.runId=f.binding.runId;
 h.state().run.run_id=f.binding.runId;h.state().grant.run_id=f.binding.runId;h.state().grant.expires_at=new Date(cutoff);
 h.allocation.run=Object.fromEntries(['tenantId','actorId','conversationId','runId'].map(k=>[k,f.binding[k]]));
 h.allocation.manifest.allowedOperations=[operation];h.allocation.manifest.requiredSources=contract.descriptor.sourceRequirements;h.allocation.manifest.subjectKinds=['client'];
 h.allocation.budgets.maxRuntimeSeconds=60;h.allocation.manifest.budgets.maxRuntimeSeconds=60;h.allocation.schedule.expiresAt=new Date(cutoff).toISOString();
 h.allocation.manifestSha256=canonicalSha256(h.allocation.manifest);h.allocation.schedule.operations=[{operation,chargeMicrousd:10}];h.invocation.allocationSha256=canonicalSha256(h.allocation);
 const identity=createLocalActionIdentity({mode,binding:f.binding,clientId,policyRevision:'a'.repeat(64),deadlineMs:cutoff,budgets:f.claims.budgets,grants:contract.descriptor.requiredGrants,sourceEnabled:true,now});
 const issued=identity.issueCredential({ttlMs:Math.max(1,cutoff-now())});h.invocation.capabilitySha256=issued.capabilitySha256;h.state().grant.capability_sha256=issued.capabilitySha256;
 const credential=randomBytes(32).toString('base64url'),credentialHash=hash(credential),commandCredential=randomBytes(32).toString('base64url');
 const current=async signal=>{active(signal);await identity.authorityPorts.verifyCapability(issued.credential,{signal});active(signal);const s=identity.status();if(!s.clientAllowed||!s.sourceEnabled)deny('ACCESS_DENIED');};
 const source={origin:'https://local-action.invalid',getCredentials:async({signal})=>{await current(signal);return{binding:f.binding,bearerToken:'SYNTHETIC_SOURCE',serviceSecret:'SYNTHETIC_SERVICE',expiresAtMs:cutoff};},fetchImpl:async(url,init)=>{
  await current(init.signal);if(url!=='https://local-action.invalid/clio/tools/query_action_items'||init.method!=='POST')deny('ACCESS_DENIED');reads++;
  return new Response(JSON.stringify(nativeScopedPage(JSON.parse(init.body))),{headers:{'content-type':'application/json'}});
 }};
 const gateway=createLocalActionGateway({mode,identity,pool:h.pool,allocationJson:JSON.stringify(h.allocation),source,limits,now,newId:randomUUID});
 try{await gateway.bindTrustedGrant(h.json());}catch(error){identity.close();throw error;}
 const lookupSql=createTaskLookupPoolFixture(),lookup=createTaskLookupDelivery({gateway,store:createPostgresTaskLookupStore({pool:lookupSql.pool}),authorize:createLocalLookupAuthorizer({identity,credential:issued.credential,assertStoredBinding:assertTaskLookupStoredBinding,now}),clock:now});
 f.context.clientResolution={reference:clientId,clientId};
 const metadataSql=createMetadataPoolFixture(),approvals=new Map();
 const preparePolicy=async({selection,selectionSha256,signal,limitDeadline})=>{
  limitDeadline(cutoff);await current(signal);if(!preparationAllowed||canonicalSha256(selection.binding)!==canonicalSha256(f.binding))deny('COMMAND_PREPARATION_REFUSED');
  return {authorized:true,selectionSha256,binding:f.binding,scopes:f.scopes,requiredApprover:f.proposal.requiredApprover,proposalExpiresAt:new Date(cutoff).toISOString(),checkedAtMs:now(),expiresAtMs:cutoff};
 };
 const metadata=createTaskCreateApprovalMetadataOwner({store:createPostgresApprovalMetadataStore({pool:metadataSql.pool}),commandContext:f.context,preparePolicy,now,newId:randomUUID});
 const authorityPorts=Object.fromEntries(Object.entries(f.ports).map(([name,fn])=>[name,async(...args)=>{await current(args.at(-1)?.signal);if(name==='verifyCapability'&&args[0]!==commandCredential)deny('ACCESS_DENIED');const value=await fn(...args);await current(args.at(-1)?.signal);return value;}]));
 const authority=createCommandAuthority({authorityPorts,now,maxFactBytes:65536});
 const approvalStore={async getCurrent({proposalId,commandSha256,signal}){await current(signal);const decision=approvals.get(proposalId);if(!decision||decision.commandSha256!==commandSha256)deny('COMMAND_APPROVAL_REFUSED');return JSON.stringify({decision,checkedAtMs:now(),revoked:false});}};
 f.state.fetchHook=async(url,init,native)=>{await current(init.signal);const args=JSON.parse(init.body);Object.assign(native.task,{title:args.title,clientId:args.clientId,dueDate:args.dueDate??null});return new Response(JSON.stringify(native),{headers:{'content-type':'application/json'}});};
 const commandOptions={operation:resolveOperationContract({id:'create_task',version:'0.2.0'}).descriptor.operation,action:'task.create',outputShape:'TaskCreateToolResult',commandContext:f.context,validators:commandToolValidators,assertProposal:assertProposalIntegrity,approvalMetadataOwner:metadata,executor:f.create({authority,approvalStore,now,newId:randomUUID}),now,limits:{maxRequestMs:5000,maxFactBytes:65536}};
 const resolveSession=async({credential:token,intent,signal,deadlineMs})=>{
  if(typeof token!=='string'||hash(token)!==credentialHash)deny('ACCESS_DENIED');await current(signal);
  const callDeadline=Math.min(deadlineMs,cutoff),deliveryId=randomUUID();
  const lookupContext={lookupId:randomUUID(),resultReference:randomUUID(),requestId:randomUUID(),binding:f.binding,scopes:identity.status().scopes,selectedClientId:clientId,deliveryJson:h.delivery(deliveryId),slots:{started:{eventId:randomUUID(),sequence:++sequence},terminal:{eventId:randomUUID(),sequence:++sequence}},deadlineMs:callDeadline};
  return {lookup,lookupContext,lookupCredential:issued.credential,readContext:{currentBinding:f.binding,scopes:identity.status().scopes,deadlineMs:callDeadline},commandOptions,
   authorizeExecution:async({proposal,signal:executionSignal})=>{await current(executionSignal);assertProposalIntegrity(proposal);if(canonicalSha256(proposal.command.binding)!==canonicalSha256(f.binding))deny('ACCESS_DENIED');return{execution:{...f.execution,requestId:randomUUID(),proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,idempotencyKey:proposal.command.idempotencyKey},credential:commandCredential};},expiresAtMs:cutoff,checkedAtMs:now()};
 };
 const app=createActionApplication({resolveSession,now,limits:{maxRequestMs:5000,maxRequestBytes:65536,maxResponseBytes:262144}});
 return Object.freeze({app,credential,
  async approve(value){await current();const proposal=data(value);assertProposalIntegrity(proposal);const retained=[...metadataSql.rows.values()].find(row=>row.payload.record.proposalId===proposal.proposalId)?.payload;
   if(!retained||retained.commandSha256!==proposal.commandSha256||canonicalSha256(proposal.command.binding)!==canonicalSha256(f.binding)||canonicalSha256(proposal.requiredApprover)!==canonicalSha256(retained.record.requiredApprover)||proposal.createdAt!==retained.record.createdAt||proposal.expiresAt!==retained.record.expiresAt)deny('COMMAND_APPROVAL_REFUSED');
   const decision=data({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved',decidedAt:new Date(now()).toISOString(),expiresAt:proposal.expiresAt,approver:proposal.requiredApprover,policyRevision:'a'.repeat(64)});approvals.set(proposal.proposalId,decision);return data({proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,decision:'approved'});
  },revoke(){revoked=true;identity.revoke(issued.credential);},revokeApproval(proposalId){approvals.delete(proposalId);},denyPreparation(){preparationAllowed=false;},denyClient(){const s=identity.status();identity.updatePolicy({expectedRevision:s.policyRevision,revision:s.policyRevision,clientAllowed:false,sourceEnabled:true,grants:s.grants});},
  stats(){return data({mode,sourceReads:reads,taskEffects:f.state.fetches,metadataRows:metadataSql.rows.size,lookupRows:lookupSql.lookups.size,commandRows:f.pg.rows.size,approvals:approvals.size,closed});},
  close(){closed=true;revoked=true;approvals.clear();identity.close();}
 });
}
