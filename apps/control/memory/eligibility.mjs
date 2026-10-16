/** Proposal eligibility over facts supplied by canonical owners (Core membership for surfaces, the current command decision for
 * conversations). It only narrows: it never grants a scope, client or memory that the supplied principal does not already hold. */
import {refuse} from '../product-access/errors.mjs';
/** Core membership permission that admits firm-wide proposals; review authority stays in Core either way. */
export const FIRM_PROPOSAL_PERMISSION='memory.propose.firm';
export const MEMORY_STATES=Object.freeze(['active','superseded','forgotten','expired']);
export function assertProposalScope(principal,{scope,clientId}){
 if(scope==='personal'){if(clientId!==null)refuse('MEMORY_SCOPE_REFUSED');return;}
 if(scope==='client'){if(clientId===null||!principal.clientIds.includes(clientId))refuse('MEMORY_CLIENT_REFUSED');return;}
 if(scope==='firm'){if(clientId!==null||!principal.permissions.includes(FIRM_PROPOSAL_PERMISSION))refuse('MEMORY_SCOPE_REFUSED');return;}
 refuse('MEMORY_SCOPE_REFUSED');
}
/** A stored candidate is released only to its proposer, inside the same tenant, and only while a client-scoped candidate's client is
 * still among the proposer's current clients (removal from a client withholds stored proposals about it). */
export function visibleToProposer(principal,candidate){
 return candidate.tenantId===principal.tenantId&&candidate.proposerActorId===principal.actorId&&
  (candidate.scope!=='client'||principal.clientIds.includes(candidate.clientId));
}
/** A correction may target only an active memory the proposer could propose in that scope. Memories outside the proposer's walls are
 * reported as not found so that their existence is not disclosed. */
export function assertCorrectionTarget(principal,target){
 const hidden=target.tenantId!==principal.tenantId||
  target.scope==='personal'&&target.ownerActorId!==principal.actorId||
  target.scope==='client'&&!principal.clientIds.includes(target.clientId);
 if(hidden)refuse('MEMORY_TARGET_NOT_FOUND');
 if(target.state!=='active')refuse('MEMORY_TARGET_INELIGIBLE');
 assertProposalScope(principal,{scope:target.scope,clientId:target.clientId});
}
