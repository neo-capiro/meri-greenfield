/** The proposer's view of one governed candidate and the decisions Meri may forward on it. Pure data rules over two facts the producer
 * already holds: the journal's submission state (`postgres-journal.mjs`, PREPARED → SUBMITTED | SUBMISSION_UNKNOWN → SUBMITTED) and
 * Core's review answer (`core-review.mjs`). Nothing here decides, publishes or mutates memory: Core's owners do (D016 #6).
 *
 * View status (`proposerViewStatus`), by journal submission state × Core answer (`null` = only the journal was consulted):
 *
 *   journal                | null               | unavailable | not_found       | pending | approved | rejected | expired | withdrawn
 *   PREPARED / SUBMISSION_UNKNOWN | submission_unknown | submission_unknown | submission_unknown | pending | approved | rejected | expired | withdrawn
 *   SUBMITTED              | pending            | unavailable | review_missing  | pending | approved | rejected | expired | withdrawn
 *
 * A candidate Core never acknowledged is never shown as pending; an outage is never shown as absent; a candidate Core reports is shown
 * exactly as Core reports it even when the journal lags (the producer records the submission on that read).
 *
 * Decision admission (`decisionAdmission`), by view status × requested decision:
 *
 *   unavailable                              → MEMORY_REVIEW_UNAVAILABLE (nothing forwarded)
 *   approved × approved, rejected × rejected → repeat: Core's terminal receipt is answered again, never another mutation
 *   pending                                  → forward to Core's canonical owner
 *   anything else                            → MEMORY_DECISION_NOT_PENDING (nothing forwarded)
 *
 * A pending correction never changes its target: the view carries the proposed `content` beside the immutable `corrects`
 * pin `{memoryId, memorySha256}`; the active record stays what Core serves until Core's approval creates the successor. */
import {refuse} from '../product-access/errors.mjs';
import {DECISIONS} from './core-decisions.mjs';
export const DECISION_OUTCOMES=Object.freeze({approved:'duplicate',rejected:'rejected'});
/** The status the proposer sees for one candidate. `review` is Core's answer for that candidate, or `null` when only the journal was read. */
export function proposerViewStatus(submission,review){
 if(submission.state!=='SUBMITTED'&&(review===null||review.status==='not_found'||review.status==='unavailable'))return 'submission_unknown';
 if(review===null)return 'pending';
 if(review.status==='unavailable')return 'unavailable';
 if(review.status==='not_found')return 'review_missing';
 return review.status;
}
/** The proposer's view of one journaled candidate and its review state (the wire shape of every listing, status and decision answer). */
export function proposerView(record,review){
 const c=record.candidate,status=proposerViewStatus(record.submission,review);
 return Object.freeze({candidateId:c.candidateId,candidateSha256:record.candidateSha256,kind:c.kind,scope:c.scope,clientId:c.clientId,content:c.content,key:c.key,ttlDays:c.ttlDays,
  corrects:c.corrects,reason:c.reason,sources:c.sources,origin:c.origin,createdAt:c.createdAt,
  review:Object.freeze({status,reviewId:review?.reviewId??record.submission.reviewId??null,decidedAt:review?.decidedAt??null,publishedMemoryId:review?.publishedMemoryId??null,checkedAt:review?.checkedAt??null})});
}
/** A matching terminal Core receipt is a repeat decision, never another mutation; `null` when the candidate is not already so decided. */
export function repeatedDecision(proposal,decision){
 if(!DECISIONS.includes(decision)||proposal.review.status!==decision)return null;
 return Object.freeze({proposal,decision:Object.freeze({decision,outcome:DECISION_OUTCOMES[decision]})});
}
/** Whether a proposer decision may be forwarded to Core for the candidate as currently viewed: `{kind:'repeat',result}` answers the
 * existing receipt, `{kind:'forward'}` lets the producer call Core; every other state refuses before any Core effect. */
export function decisionAdmission(proposal,decision){
 if(!DECISIONS.includes(decision))refuse('PRODUCT_CONFIGURATION');
 if(proposal.review.status==='unavailable')refuse('MEMORY_REVIEW_UNAVAILABLE');
 const repeat=repeatedDecision(proposal,decision);if(repeat)return Object.freeze({kind:'repeat',result:repeat});
 if(proposal.review.status!=='pending')refuse('MEMORY_DECISION_NOT_PENDING');
 return Object.freeze({kind:'forward'});
}
