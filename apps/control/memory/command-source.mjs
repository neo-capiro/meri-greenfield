/** Command-executor source for conversational `memory.propose` backed by the governed producer instead of the legacy auto-committing
 * route. The canonical executor still owns current authority, approval, journal claim and budget; this source only maps the approved
 * immutable command to one pending candidate. Eligibility comes from the executor's current authorization decision: its client scopes
 * are the proposer's clients and a tenant scope admits firm-wide proposals. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {CommandError} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {productFailure} from '../product-access/errors.mjs';
import {UUID} from '../product-access/shape.mjs';
import {FIRM_PROPOSAL_PERMISSION} from './eligibility.mjs';
const fail=code=>{throw new CommandError(code);};
const same=(a,b)=>canonicalSha256(a)===canonicalSha256(b);
export function principalFromCommandAuthority(authority){
 const scopes=authority?.decision?.scopes;
 if(!Array.isArray(scopes)||scopes.some(s=>s.tenantId!==authority.binding.tenantId))fail('COMMAND_AUTHORITY_REFUSED');
 const clientIds=[...new Set(scopes.filter(s=>s.kind==='client'&&UUID.test(s.resourceId.toLowerCase())).map(s=>s.resourceId.toLowerCase()))].sort();
 return Object.freeze({tenantId:authority.binding.tenantId,actorId:authority.binding.actorId,clientIds:Object.freeze(clientIds),
  permissions:Object.freeze(scopes.some(s=>s.kind==='tenant')?[FIRM_PROPOSAL_PERMISSION]:[])});
}
export function createMemoryCommandSource({producer}){
 if(typeof producer?.proposeFromCommand!=='function')fail('COMMAND_CONFIGURATION');
 const retained=new WeakMap();
 return Object.freeze({
  /** This source creates pending candidates for every scope, so the durable owner may admit personal proposals to it. */
  personalPending:true,
  async prepare({command,authority,deadlineMs}){
   if(command.action!=='memory.propose'||!Number.isSafeInteger(deadlineMs))fail('INVALID_COMMAND');
   const token=Object.freeze({deadlineMs});retained.set(token,{command,authority});return token;
  },
  async execute(token,{authority,signal}){
   const prepared=retained.get(token);retained.delete(token);
   if(!prepared)fail('COMMAND_SOURCE_PREPARATION_REFUSED');
   if(!same(authority.binding,prepared.authority.binding)||authority.policyRevision!==prepared.authority.policyRevision||authority.claims.capabilityId!==prepared.authority.claims.capabilityId)fail('COMMAND_SOURCE_IDENTITY_REFUSED');
   const command=prepared.command,commandSha256=canonicalSha256(command);
   let candidate;
   try{candidate=await producer.proposeFromCommand({principal:principalFromCommandAuthority(authority),command,commandSha256,signal,deadlineMs:Math.min(token.deadlineMs,authority.deadlineMs)});}
   catch(error){const code=productFailure(error)?.code;fail(['MEMORY_SCOPE_REFUSED','MEMORY_CLIENT_REFUSED','MEMORY_TARGET_INELIGIBLE','MEMORY_TARGET_NOT_FOUND'].includes(code)?'COMMAND_AUTHORITY_REFUSED':'INVALID_SOURCE_RESULT');}
   // Only an acknowledged pending submission is a result; anything else stays an unknown command outcome for reconciliation.
   if(candidate.review.status!=='pending')fail('INVALID_SOURCE_RESULT');
   return Object.freeze({candidateId:candidate.candidateId,commandSha256,status:'pending'});
  },
 });
}
