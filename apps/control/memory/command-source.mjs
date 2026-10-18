/** Command-executor source for conversational `memory.propose` backed by the governed producer instead of the legacy auto-committing
 * route. The canonical executor still owns current authority, approval, journal claim and budget; this source only maps the approved
 * immutable command to one pending candidate. Eligibility comes from the executor's current authorization decision: its client scopes
 * are the proposer's clients and a tenant scope admits firm-wide proposals. */
import {canonicalSha256,validateShape} from '../../../packages/contracts/validate.mjs';
import {CommandError,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {productFailure} from '../product-access/errors.mjs';
import {UUID} from '../product-access/shape.mjs';
import {FIRM_PROPOSAL_PERMISSION} from './eligibility.mjs';
const fail=code=>{throw new CommandError(code);};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function principalFromCommandAuthority(authority){
 const scopes=authority?.decision?.scopes;
 if(!Array.isArray(scopes)||scopes.some(s=>!s||s.tenantId!==authority.binding.tenantId||s.kind==='client'&&(typeof s.resourceId!=='string'||!UUID.test(s.resourceId.toLowerCase()))))fail('COMMAND_AUTHORITY_REFUSED');
 const clientIds=[...new Set(scopes.filter(s=>s.kind==='client').map(s=>s.resourceId.toLowerCase()))].sort();
 return Object.freeze({tenantId:authority.binding.tenantId,actorId:authority.binding.actorId,clientIds:Object.freeze(clientIds),
  permissions:Object.freeze(scopes.some(s=>s.kind==='tenant')?[FIRM_PROPOSAL_PERMISSION]:[])});
}
export function createMemoryCommandSource({producer,binding,selectedClientId}){
 if(typeof producer?.proposeFromCommand!=='function'||typeof selectedClientId!=='string'||!UUID.test(selectedClientId))fail('COMMAND_CONFIGURATION');
 let pinned;try{pinned=data(binding);validateShape('RunBinding',pinned);}catch{fail('COMMAND_CONFIGURATION');}
 // Original proposal provenance survives a resumed attempt. The live authority must match this source's exact executor binding;
 // the original command must belong to the same stable run, and its client may only be the trusted selected client.
 function bound(command,authority){
  if(!same(authority.binding,pinned)||['tenantId','actorId','conversationId','runId'].some(k=>command.binding?.[k]!==pinned[k])||
   command.arguments?.scope==='client'&&command.arguments.clientId!==selectedClientId)fail('COMMAND_SOURCE_IDENTITY_REFUSED');
  return principalFromCommandAuthority(authority);
 }
 const retained=new WeakMap();
 return Object.freeze({
  /** This source creates pending candidates for every scope, so the durable owner may admit personal proposals to it. */
  personalPending:true,
  async prepare({command,authority,deadlineMs}){
   if(command.action!=='memory.propose'||!Number.isSafeInteger(deadlineMs))fail('INVALID_COMMAND');
   bound(command,authority);
   const token=Object.freeze({deadlineMs});retained.set(token,data({command,authority}));return token;
  },
  async execute(token,{authority,signal}){
   const prepared=retained.get(token);retained.delete(token);
   if(!prepared)fail('COMMAND_SOURCE_PREPARATION_REFUSED');
   if(!same(authority.binding,prepared.authority.binding)||authority.policyRevision!==prepared.authority.policyRevision||authority.claims.capabilityId!==prepared.authority.claims.capabilityId)fail('COMMAND_SOURCE_IDENTITY_REFUSED');
   const command=prepared.command,commandSha256=canonicalSha256(command),principal=bound(command,authority);
   let candidate;
   try{candidate=await producer.proposeFromCommand({principal,command,commandSha256,signal,deadlineMs:Math.min(token.deadlineMs,authority.deadlineMs)});}
   // A definite Core refusal of the candidate (`MEMORY_SUBMISSION_REFUSED`: wall, key or pin conflict) is a refusal of this command,
   // not an unknown outcome: nothing was recorded at Core and a replay would be refused again.
   catch(error){const code=productFailure(error)?.code;fail(['MEMORY_SCOPE_REFUSED','MEMORY_CLIENT_REFUSED','MEMORY_TARGET_INELIGIBLE','MEMORY_TARGET_NOT_FOUND','MEMORY_SUBMISSION_REFUSED'].includes(code)?'COMMAND_AUTHORITY_REFUSED':'INVALID_SOURCE_RESULT');}
   // Only an acknowledged pending submission is a result; anything else stays an unknown command outcome for reconciliation.
   if(candidate.review.status!=='pending')fail('INVALID_SOURCE_RESULT');
   return Object.freeze({candidateId:candidate.candidateId,commandSha256,status:'pending'});
  },
 });
}
