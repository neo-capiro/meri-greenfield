/** Client of Core's canonical memory review (the only review/publication authority). Meri submits exact candidates and reads review
 * status; it has no route that approves, publishes, confirms, corrects or forgets memory. Core deduplicates a submission by
 * (candidateId, candidateSha256) (`0304b0ef` MeriMemoryReceivingService.submit): replaying the identical immutable candidate answers
 * the original acknowledgement, and a different hash for a known candidateId is refused 409.
 *
 * Receiver statuses: Core answers 400 (malformed candidate, hash mismatch, reserved `meri:` key), 403 (unverified service identity,
 * foreign tenant or proposer, walled client) and 409 (known id with another hash, keyed addition whose key is already committed,
 * correction with ttlDays, stale or superseded correction pin, scope mismatch, target without a governed version) DEFINITIVELY and
 * records nothing: those are `MEMORY_SUBMISSION_REFUSED`, never resubmitted as "unknown". Everything else (transport, 5xx, Core's
 * 503 lifecycle gate for corrections before `MEMORY_GOVERNANCE_LIFECYCLE=enforce`) stays uncertainty. */
import {refuse} from '../product-access/errors.mjs';
import {SHA256,UUID,closed} from '../product-access/shape.mjs';
import {REVIEW_STATUSES} from './wire.mjs';
const instant=v=>typeof v==='string'&&new Date(Date.parse(v)).toISOString()===v;
/** Definite receiver refusals of one submission (Core wrote nothing); 503 is deliberately absent (uncertain). */
export const SUBMIT_REFUSALS=Object.freeze({400:'MEMORY_SUBMISSION_REFUSED',403:'MEMORY_SUBMISSION_REFUSED',409:'MEMORY_SUBMISSION_REFUSED'});
export function createCoreReview({transport}){
 if(typeof transport?.call!=='function')refuse('PRODUCT_CONFIGURATION');
 return Object.freeze({
  /** Resolves only to an acknowledgement that Core holds this exact candidate for review; a definite refusal is typed, any other
   * answer is uncertainty. */
  async submit({candidate,candidateSha256,signal,deadlineMs}){
   const raw=await transport.call('submit',{tenantId:candidate.tenantId,actorId:candidate.proposerActorId,body:{candidate,candidateSha256},signal,deadlineMs},'MEMORY_REVIEW_UNCERTAIN',SUBMIT_REFUSALS);
   const a=closed(raw,['candidateId','candidateSha256','reviewId','accepted'],[],'MEMORY_REVIEW_UNCERTAIN');
   if(a.accepted!==true||a.candidateId!==candidate.candidateId||a.candidateSha256!==candidateSha256||typeof a.reviewId!=='string'||!UUID.test(a.reviewId))refuse('MEMORY_REVIEW_UNCERTAIN');
   return Object.freeze({reviewId:a.reviewId});
  },
  /** Current review status for the proposer's own candidates. Every requested candidate must be answered exactly once, with its hash. */
  async status({tenantId,actorId,candidates,signal,deadlineMs}){
   if(!candidates.length)return new Map();
   const raw=await transport.call('status',{tenantId,actorId,body:{candidates:candidates.map(c=>({candidateId:c.candidateId,candidateSha256:c.candidateSha256}))},signal,deadlineMs},'MEMORY_REVIEW_UNAVAILABLE');
   const page=closed(raw,['reviews','checkedAt'],[],'MEMORY_REVIEW_UNAVAILABLE');
   if(!instant(page.checkedAt)||!Array.isArray(page.reviews)||page.reviews.length!==candidates.length)refuse('MEMORY_REVIEW_UNAVAILABLE');
   const out=new Map();
   for(const value of page.reviews){
    const r=closed(value,['candidateId','candidateSha256','status','reviewId','decidedAt','publishedMemoryId'],[],'MEMORY_REVIEW_UNAVAILABLE');
    const asked=candidates.find(c=>c.candidateId===r.candidateId);
    const found=r.status!=='not_found',decided=found&&r.status!=='pending';
    if(!asked||out.has(r.candidateId)||r.candidateSha256!==asked.candidateSha256||!SHA256.test(r.candidateSha256)||![...REVIEW_STATUSES,'not_found'].includes(r.status)||
     (found?typeof r.reviewId!=='string'||!UUID.test(r.reviewId):r.reviewId!==null)||(decided?!instant(r.decidedAt):r.decidedAt!==null)||
     (r.status==='approved'?typeof r.publishedMemoryId!=='string'||!r.publishedMemoryId||r.publishedMemoryId.length>128:r.publishedMemoryId!==null))refuse('MEMORY_REVIEW_UNAVAILABLE');
    out.set(r.candidateId,Object.freeze({status:r.status,reviewId:r.reviewId,decidedAt:r.decidedAt,publishedMemoryId:r.publishedMemoryId,checkedAt:page.checkedAt}));
   }
   return out;
  },
 });
}
