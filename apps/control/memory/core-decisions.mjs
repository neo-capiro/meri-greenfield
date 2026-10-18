/** The proposer's own decision on one of their pending candidates, forwarded to Core's canonical decision owner for the candidate's
 * kind (capiro-backend #84 `0304b0ef`; D016 #6 review-only: Meri decides nothing, Core's owner does, under Core's own rules).
 *
 *  addition    POST /api/memory/candidates/{id}/owner-decision {decision:'approve'|'reject'} (`MemoryCandidateService
 *              .decideOwnPersonalCandidate`): the caller's OWN personal-scope candidate only (404 otherwise); shared scopes keep
 *              Core's admin review workflow and are refused there. Answers {status:'approved', memoryId} | {status:'rejected'}.
 *  correction  POST /api/memory/version-candidates/{id}/approve | /reject {reason} (`ImmutableMemoryVersionService`): 503 until
 *              `MEMORY_GOVERNANCE_LIFECYCLE=enforce` (uncertain), 404 unless a pending version candidate, 403 when Core's
 *              authorization or its shared-scope self-approval rule refuses, 400 for a blank rejection reason. Answers
 *              {ok:true, candidateId, outcome:'activated'|'duplicate'|'conflict'|'rejected', memoryItemId?, ...}.
 * Core's returned ids are bare UUIDs here; Meri never trusts them as memory ids and re-reads the scoped `publishedMemoryId` through
 * review/status after the decision. */
import {productFailure,refuse} from '../product-access/errors.mjs';
import {closed} from '../product-access/shape.mjs';
/** Definite decision refusals (nothing decided). 503 (lifecycle gate) and 5xx stay uncertain: the decision may or may not have applied. */
export const DECISION_REFUSALS=Object.freeze({400:'MEMORY_DECISION_CONFLICT',403:'MEMORY_DECISION_FORBIDDEN',404:'MEMORY_DECISION_NOT_FOUND',409:'MEMORY_DECISION_CONFLICT'});
const UNCERTAIN='MEMORY_DECISION_UNCERTAIN';
export const DECISIONS=Object.freeze(['approved','rejected']);
export function createCoreDecisions({transport}){
 if(typeof transport?.call!=='function')refuse('PRODUCT_CONFIGURATION');
 return Object.freeze({
  /** Resolves to Core's outcome for exactly this candidate; an unreadable or mismatched answer is uncertainty (`outcome:'UNKNOWN'`). */
  async decide({candidate,decision,reason,signal,deadlineMs}){
   if(!DECISIONS.includes(decision)||(decision==='rejected')!==(typeof reason==='string'&&reason.length>0))refuse('PRODUCT_CONFIGURATION');
   const common={tenantId:candidate.tenantId,actorId:candidate.proposerActorId,id:candidate.candidateId,signal,deadlineMs};
   let raw;
   try{
    if(candidate.kind==='addition'){
     const a=closed(await transport.call('ownerDecision',{...common,body:{decision:decision==='approved'?'approve':'reject'}},UNCERTAIN,DECISION_REFUSALS),['status'],['memoryId'],UNCERTAIN);
     if(a.status!==decision||(decision==='approved')!==(typeof a.memoryId==='string'&&a.memoryId.length>0&&a.memoryId.length<=128))refuse(UNCERTAIN);
     raw={outcome:decision==='approved'?'activated':'rejected'};
    }else{
     const route=decision==='approved'?'versionApprove':'versionReject';
     const a=closed(await transport.call(route,{...common,body:decision==='approved'?{}:{reason}},UNCERTAIN,DECISION_REFUSALS),['ok','candidateId','outcome'],['memoryItemId','controllingItemId','conflictGroupId'],UNCERTAIN);
     if(a.ok!==true||a.candidateId!==candidate.candidateId||!(decision==='approved'?['activated','duplicate','conflict']:['rejected']).includes(a.outcome))refuse(UNCERTAIN);
     raw={outcome:a.outcome};
    }
   }catch(error){
    // An uncertain decision is an effect that may have applied: the mount reports it as UNKNOWN, never as not dispatched.
    if(productFailure(error)?.code===UNCERTAIN)refuse(UNCERTAIN,'UNKNOWN');throw error;
   }
   return Object.freeze(raw);
  },
 });
}
