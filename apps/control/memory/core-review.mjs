/** Client of Core's canonical memory review (the only review/publication authority). Meri submits exact candidates and reads review
 * status; it has no route that approves, publishes, confirms, corrects or forgets memory. Core must deduplicate a submission by
 * (candidateId, candidateSha256): replaying the identical immutable candidate is not a new effect, and a different hash for a known
 * candidateId must be refused by Core. */
import {refuse} from '../product-access/errors.mjs';
import {SHA256,UUID,closed} from '../product-access/shape.mjs';
import {REVIEW_STATUSES} from './wire.mjs';
const instant=v=>typeof v==='string'&&new Date(Date.parse(v)).toISOString()===v;
export function createCoreReview({transport}){
 if(typeof transport?.call!=='function')refuse('PRODUCT_CONFIGURATION');
 return Object.freeze({
  /** Resolves only to an acknowledgement that Core holds this exact candidate for review; any other answer is uncertainty. */
  async submit({candidate,candidateSha256,signal,deadlineMs}){
   const raw=await transport.call('submit',{tenantId:candidate.tenantId,actorId:candidate.proposerActorId,body:{candidate,candidateSha256},signal,deadlineMs},'MEMORY_REVIEW_UNCERTAIN');
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
