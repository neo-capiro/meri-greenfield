/** Governed memory proposal producer. It turns an eligible request into one immutable sourced candidate, journals it, and submits that
 * exact candidate to Core's canonical review. It never publishes, approves, confirms, corrects or forgets memory: every candidate is
 * pending until Core decides, and an uncertain submission stays visible as `submission_unknown` instead of being assumed absent. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {asProductError,refuse} from '../product-access/errors.mjs';
import {buildCandidate} from './candidate.mjs';
import {assertCorrectionTarget,assertProposalScope,visibleToProposer} from './eligibility.mjs';
import {encodeCursor} from './wire.mjs';
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
export function createMemoryProducer(options){
 const {journal,review,memory,newId,now}=options??{};
 if(['insert','recordSubmission','recordUnknown','get','findOwnByKey','listOwn'].some(k=>typeof journal?.[k]!=='function')||['submit','status'].some(k=>typeof review?.[k]!=='function')||
  ['readTarget','findByKey'].some(k=>typeof memory?.[k]!=='function')||typeof newId!=='function'||typeof now!=='function')refuse('PRODUCT_CONFIGURATION');
 const id=()=>{const v=newId();if(typeof v!=='string'||!UUID4.test(v))refuse('PRODUCT_CONFIGURATION');return v;};
 /** Journal then submit. A replayed idempotency key resubmits the identical journaled candidate only when its earlier submission was
  * not acknowledged; Core deduplicates it by (candidateId, hash), so the replay cannot create a second review item. */
 async function produce(fields,requestSha256,{signal,deadlineMs}){
  const built=buildCandidate({...fields,candidateId:id(),createdAt:new Date(now()).toISOString()});
  const {record}=await journal.insert({...built,requestSha256,signal});
  return submitRecord(fields.principal,record,{signal,deadlineMs});
 }
 /** Look up immutable custody before consulting mutable memory. Current visibility still gates every release or resubmission. */
 async function replay(principal,idempotencyKey,requestSha256,options){
  const record=await journal.findOwnByKey({tenantId:principal.tenantId,proposerActorId:principal.actorId,idempotencyKey,signal:options.signal});
  if(!record)return null;
  if(!visibleToProposer(principal,record.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
  if(record.requestSha256!==requestSha256)refuse('MEMORY_IDEMPOTENCY_CONFLICT');
  const current=(await statuses(principal,[record],options))[0];
  if(current.review.status!=='submission_unknown')return current;
  return submitRecord(principal,record,options);
 }
 async function submitRecord(principal,record,{signal,deadlineMs}){
  if(!visibleToProposer(principal,record.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
  // A replay of an acknowledged submission reports Core's current review state rather than assuming it is still pending.
  if(record.submission.state==='SUBMITTED')return (await statuses(principal,[record],{signal,deadlineMs}))[0];
  let reviewId;
  try{({reviewId}=await review.submit({candidate:record.candidate,candidateSha256:record.candidateSha256,signal,deadlineMs}));}
  catch{
   try{await journal.recordUnknown({tenantId:record.candidate.tenantId,candidateId:record.candidate.candidateId,signal});}catch{}
   return view({...record,submission:{state:'SUBMISSION_UNKNOWN',reviewId:null}},null);
  }
  // Core acknowledged this exact candidate. If recording that fails, the journal stays behind and the next read reconciles it from Core;
  // the answer still reports the acknowledged submission rather than an error that would hide it.
  try{await journal.recordSubmission({tenantId:record.candidate.tenantId,candidateId:record.candidate.candidateId,candidateSha256:record.candidateSha256,reviewId,signal});}catch{}
  return view({...record,submission:{state:'SUBMITTED',reviewId}},null);
 }
 /** Read-only reconciliation of journaled candidates against Core. A candidate Core already holds is recorded as SUBMITTED; nothing
  * is (re)submitted from a read. Review-status failure yields `unavailable`, never `pending`. */
 async function statuses(principal,records,{signal,deadlineMs}){
  let reviews=null;
  try{reviews=await review.status({tenantId:principal.tenantId,actorId:principal.actorId,candidates:records.map(r=>({candidateId:r.candidate.candidateId,candidateSha256:r.candidateSha256})),signal,deadlineMs});}catch{}
  const out=[];
  for(const r of records){
   const found=reviews?.get(r.candidate.candidateId)??null;
   if(found&&found.status!=='not_found'&&r.submission.state!=='SUBMITTED'){
    try{await journal.recordSubmission({tenantId:r.candidate.tenantId,candidateId:r.candidate.candidateId,candidateSha256:r.candidateSha256,reviewId:found.reviewId,signal});}catch{}
   }
   out.push(view(r,reviews===null?{status:'unavailable'}:found));
  }
  return out;
 }
 return Object.freeze({
  async propose({principal,request,origin,signal,deadlineMs}){
   try{
    assertProposalScope(principal,request);
    const requestSha256=canonicalSha256({operation:'memory.propose',origin,request});
    return await produce({principal,...request,corrects:null,reason:null,origin},requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  /** Sourced correction of an existing memory. The target is pinned by its current content hash; review decides whether it applies. */
  async correct({principal,request,origin,signal,deadlineMs}){
   try{
    const requestSha256=canonicalSha256({operation:'memory.correct',origin,request});
    const retained=await replay(principal,request.idempotencyKey,requestSha256,{signal,deadlineMs});if(retained)return retained;
    const target=await memory.readTarget({tenantId:principal.tenantId,actorId:principal.actorId,memoryId:request.targetMemoryId,signal,deadlineMs});
    assertCorrectionTarget(principal,target);
    return await produce({principal,scope:target.scope,clientId:target.clientId,content:request.content,key:target.key,ttlDays:null,
     corrects:{memoryId:target.memoryId,memorySha256:target.memorySha256},reason:request.reason,sources:request.sources,origin,idempotencyKey:request.idempotencyKey},requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  /** Conversational memory.propose: a keyed proposal that matches an existing eligible memory becomes a correction of it. */
  async proposeFromCommand({principal,command,commandSha256,signal,deadlineMs}){
   try{
    const a=command.arguments,origin={kind:'conversation',conversationId:command.binding.conversationId,runId:command.binding.runId,commandId:command.commandId,commandSha256};
    assertProposalScope(principal,a);
    const requestSha256=canonicalSha256({operation:'memory.propose.command',commandSha256});
    const retained=await replay(principal,command.idempotencyKey,requestSha256,{signal,deadlineMs});if(retained)return retained;
    let corrects=null;
    if(a.key!==null){
     const target=await memory.findByKey({tenantId:principal.tenantId,actorId:principal.actorId,scope:a.scope,clientId:a.clientId,key:a.key,signal,deadlineMs});
     if(target){assertCorrectionTarget(principal,target);corrects={memoryId:target.memoryId,memorySha256:target.memorySha256};}
    }
    return await produce({principal,scope:a.scope,clientId:a.clientId,content:a.content,key:a.key,ttlDays:a.ttlDays===null?null:Math.ceil(a.ttlDays),corrects,reason:null,sources:[],origin,idempotencyKey:command.idempotencyKey},
     requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  async list({principal,request,signal,deadlineMs}){
   try{
    if(request.clientId!==null&&!principal.clientIds.includes(request.clientId))refuse('MEMORY_CLIENT_REFUSED');
    const rows=await journal.listOwn({tenantId:principal.tenantId,proposerActorId:principal.actorId,clientIds:principal.clientIds,clientId:request.clientId,cursor:request.cursor,limit:request.limit+1,signal});
    const page=rows.slice(0,request.limit).filter(r=>visibleToProposer(principal,r.candidate));
    return Object.freeze({proposals:await statuses(principal,page,{signal,deadlineMs}),nextCursor:rows.length>request.limit?encodeCursor(rows[request.limit-1].candidate):null});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  async status({principal,request,signal,deadlineMs}){
   try{
    const r=await journal.get({tenantId:principal.tenantId,proposerActorId:principal.actorId,candidateId:request.candidateId,signal});
    if(!r||!visibleToProposer(principal,r.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
    return (await statuses(principal,[r],{signal,deadlineMs}))[0];
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
 });
}
/** The proposer's view of one candidate and its review state. `review` is Core's answer, null when only the journal was consulted. */
function view(record,review){
 const c=record.candidate;
 const status=record.submission.state!=='SUBMITTED'&&(!review||review.status==='not_found'||review.status==='unavailable')?'submission_unknown':
  review===null?'pending':review.status==='unavailable'?'unavailable':review.status==='not_found'?'review_missing':review.status;
 return Object.freeze({candidateId:c.candidateId,candidateSha256:record.candidateSha256,kind:c.kind,scope:c.scope,clientId:c.clientId,content:c.content,key:c.key,ttlDays:c.ttlDays,
  corrects:c.corrects,reason:c.reason,sources:c.sources,origin:c.origin,createdAt:c.createdAt,
  review:Object.freeze({status,reviewId:review?.reviewId??record.submission.reviewId??null,decidedAt:review?.decidedAt??null,publishedMemoryId:review?.publishedMemoryId??null,checkedAt:review?.checkedAt??null})});
}
