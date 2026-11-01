/** The retained review record and its approval rule. A saved review is an immutable TXT artifact version holding the
 * complete compiled revision. Approval is a separate immutable child version carrying the same compiled revision plus
 * an approval bound to exactly that revision hash and the approved version. The rules here are the store's:
 *  - a saved revision never carries an approval (a new revision is unapproved by construction, whatever its parent);
 *  - an approval binds one revision hash and one approved version; a record whose approval names another revision
 *    or another parent is invalid, so an approval can never follow an edit;
 *  - unapproved records keep their original byte shape, so earlier saved reviews stay readable unchanged. */
import {own,data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
export const FEDERAL_REVIEW_SCHEMA='meri.federal-review.v1';
const SHA=/^[a-f0-9]{64}$/u,UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
const fault=code=>{throw Object.assign(Error(code),{code});};

/** The record a revision save writes: the compiled revision alone, approval null. */
export const federalRevisionRecord=prepared=>Object.freeze({prepared,approval:null});
/** The record an approval writes for the exact review version it approves. */
export function federalApprovalRecord(prepared,reviewVersionId){
 if(!UUID.test(reviewVersionId)||!SHA.test(prepared?.revisionSha256))fault('DRAFT_APPROVAL_INVALID');
 return Object.freeze({prepared,approval:Object.freeze({revisionSha256:prepared.revisionSha256,reviewVersionId})});
}
/** Exact retained bytes. The unapproved shape is byte-identical to earlier saved reviews. */
export function encodeFederalReview({prepared,approval}){
 return JSON.stringify(approval===null?{schema:FEDERAL_REVIEW_SCHEMA,prepared}:{schema:FEDERAL_REVIEW_SCHEMA,prepared,approval});
}
/** Shape of a retained record; the compiled revision is a claim until the caller recompiles it from the source. */
export function decodeFederalReview(text){
 let stored;try{stored=data(own(JSON.parse(text),['schema','prepared'],['approval']));}catch{fault('DRAFT_REVIEW_INVALID');}
 if(stored.schema!==FEDERAL_REVIEW_SCHEMA)fault('DRAFT_REVIEW_INVALID');
 const approval=stored.approval===undefined?null:stored.approval;
 if(approval!==null){
  let a;try{a=own(approval,['revisionSha256','reviewVersionId']);}catch{fault('DRAFT_REVIEW_INVALID');}
  if(!SHA.test(a.revisionSha256)||!UUID.test(a.reviewVersionId))fault('DRAFT_REVIEW_INVALID');
 }
 return Object.freeze({prepared:stored.prepared,approval});
}
/** The store rule: an approval is valid only for the recompiled revision it names and the version it was written under.
 * `parentVersionId` is the retained version's own parent; an approval record is always the child of what it approves. */
export function assertFederalApprovalBinds(approval,prepared,parentVersionId){
 if(approval===null)return null;
 if(approval.revisionSha256!==prepared.revisionSha256||approval.reviewVersionId!==parentVersionId)fault('DRAFT_APPROVAL_INVALID');
 return approval;
}
