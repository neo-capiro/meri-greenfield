/** Governed memory proposal producer. It turns an eligible request into one immutable sourced candidate, journals it, and submits that
 * exact candidate to Core's canonical review. It never publishes, approves, confirms, corrects or forgets memory: every candidate is
 * pending until Core decides, and an uncertain submission stays visible as `submission_unknown` instead of being assumed absent. */
import {canonicalSha256} from '../../../packages/contracts/validate.mjs';
import {assertMemoryProposeCommand} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {data} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {asProductError,productFailure,refuse} from '../product-access/errors.mjs';
import {buildCandidate} from './candidate.mjs';
import {assertCorrectionTarget,assertProposalScope,visibleToProposer} from './eligibility.mjs';
import {encodeCursor} from './wire.mjs';
import {decisionAdmission,proposerView as view,repeatedDecision} from './review-state.mjs';
const UUID4=/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u;
/** `decisions` (`core-decisions.mjs`) is optional: without it the review path lists but `decide` answers MEMORY_UNAVAILABLE. */
export function createMemoryProducer(options){
 const {journal,review,memory,decisions=null,retention=null,requireSurfaceRetentionSubject=false,newId,now}=options??{};
 if(['insert','recordSubmission','recordUnknown','get','findOwnByKey','listOwn'].some(k=>typeof journal?.[k]!=='function')||['submit','status'].some(k=>typeof review?.[k]!=='function')||
  ['readTarget','findByKey'].some(k=>typeof memory?.[k]!=='function')||decisions!==null&&typeof decisions?.decide!=='function'||retention!==null&&typeof retention?.assertServable!=='function'||
  typeof requireSurfaceRetentionSubject!=='boolean'||requireSurfaceRetentionSubject&&retention===null||typeof newId!=='function'||typeof now!=='function')refuse('PRODUCT_CONFIGURATION');
 const id=()=>{const v=newId();if(typeof v!=='string'||!UUID4.test(v))refuse('PRODUCT_CONFIGURATION');return v;};
 const checkRequest=({signal,deadlineMs})=>{
  if(signal?.aborted)refuse('CANCELLED');
  if(deadlineMs!==undefined&&(!Number.isSafeInteger(deadlineMs)||now()>=deadlineMs))refuse('DEADLINE');
 };
 /** Only a conversation-origin candidate has a canonical retention subject today. The producer never infers one from source
  * citations or a surface request; those candidates need the separately owned actor/client subject policy. */
 async function originServable(tenantId,origin){
  if(retention===null||origin.kind!=='conversation')return true;
  try{await retention.assertServable({tenantId,kind:'conversation',subjectId:origin.conversationId});return true;}
  catch(error){if(error?.code==='RETENTION_SUPPRESSED')return false;throw error;}
 }
 const servable=candidate=>originServable(candidate.tenantId,candidate.origin);
 async function requireOriginServable(tenantId,origin){if(!await originServable(tenantId,origin))refuse('MEMORY_PROPOSAL_NOT_FOUND');}
 async function requireServable(candidate){if(!await servable(candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');}
 /** There is no canonical actor/client retention subject for a new surface-origin payload yet. Keep old owner review/read paths,
  * but production must not create or resubmit such a payload until the shared retention owner defines its policy. */
 function requireWritableOrigin(origin){if(requireSurfaceRetentionSubject&&origin.kind!=='conversation')refuse('MEMORY_RETENTION_SUBJECT_UNAVAILABLE','NOT_DISPATCHED');}
 /** Journal then submit. A replayed idempotency key resubmits the identical journaled candidate only when its earlier submission was
  * not acknowledged; Core deduplicates it by (candidateId, hash), so the replay cannot create a second review item. */
 async function produce(fields,requestSha256,{signal,deadlineMs}){
  checkRequest({signal,deadlineMs});
  const built=buildCandidate({...fields,candidateId:id(),createdAt:new Date(now()).toISOString()});
  await requireServable(built.candidate);
  checkRequest({signal,deadlineMs});
  const {record}=await journal.insert({...built,requestSha256,signal});
  return submitRecord(fields.principal,record,{signal,deadlineMs});
 }
 /** Look up immutable custody before consulting mutable memory. Visibility gates retained reads; submission also needs current scope. */
 async function replay(principal,idempotencyKey,requestSha256,options){
  const record=await journal.findOwnByKey({tenantId:principal.tenantId,proposerActorId:principal.actorId,idempotencyKey,signal:options.signal});
  if(!record)return null;
  if(!visibleToProposer(principal,record.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
  await requireServable(record.candidate);
  if(record.requestSha256!==requestSha256)refuse('MEMORY_IDEMPOTENCY_CONFLICT');
  const current=(await statuses(principal,[record],options))[0];
  await requireServable(record.candidate);
  if(current.review.status!=='submission_unknown')return current;
  return submitRecord(principal,record,options);
 }
 async function submitRecord(principal,record,{signal,deadlineMs}){
  if(!visibleToProposer(principal,record.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
  await requireServable(record.candidate);
  // A replay of an acknowledged submission reports Core's current review state rather than assuming it is still pending.
  if(record.submission.state==='SUBMITTED'){
   const current=(await statuses(principal,[record],{signal,deadlineMs}))[0];await requireServable(record.candidate);return current;
  }
  // Retaining a candidate permits status reads, not a new proposal effect. Check its immutable scope without rereading its target.
  assertProposalScope(principal,record.candidate);
  let reviewId;
  try{({reviewId}=await review.submit({candidate:record.candidate,candidateSha256:record.candidateSha256,signal,deadlineMs}));}
  catch(error){
   // Core refused this exact candidate definitively (nothing recorded there): the journaled candidate stays PREPARED and the refusal
   // is answered; a replay of the same request resubmits and is refused again. Anything else is an unacknowledged submission.
   if(productFailure(error)?.code==='MEMORY_SUBMISSION_REFUSED')throw error;
   try{await journal.recordUnknown({tenantId:record.candidate.tenantId,candidateId:record.candidate.candidateId,signal});}catch{}
   await requireServable(record.candidate);return view({...record,submission:{state:'SUBMISSION_UNKNOWN',reviewId:null}},null);
  }
  // Core acknowledged this exact candidate. If recording that fails, the journal stays behind and the next read reconciles it from Core;
  // the answer still reports the acknowledged submission rather than an error that would hide it.
  try{await journal.recordSubmission({tenantId:record.candidate.tenantId,candidateId:record.candidate.candidateId,candidateSha256:record.candidateSha256,reviewId,signal});}catch{}
  await requireServable(record.candidate);return view({...record,submission:{state:'SUBMITTED',reviewId}},null);
 }
 /** Read-only reconciliation of journaled candidates against Core. A candidate Core already holds is recorded as SUBMITTED; nothing
  * is (re)submitted from a read. Review-status failure yields `unavailable`, never `pending`. */
 async function statuses(principal,records,{signal,deadlineMs}){
  if(records.length===0)return [];
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
 async function list({principal,request,signal,deadlineMs}){
  try{
   if(request.clientId!==null&&!principal.clientIds.includes(request.clientId))refuse('MEMORY_CLIENT_REFUSED');
   const rows=await journal.listOwn({tenantId:principal.tenantId,proposerActorId:principal.actorId,clientIds:principal.clientIds,clientId:request.clientId,cursor:request.cursor,limit:request.limit+1,signal});
   const page=[];for(const r of rows.slice(0,request.limit))if(visibleToProposer(principal,r.candidate)&&await servable(r.candidate))page.push(r);
   const views=await statuses(principal,page,{signal,deadlineMs}),proposals=[];
   for(let i=0;i<page.length;i++)if(await servable(page[i].candidate))proposals.push(views[i]);
   return Object.freeze({proposals:Object.freeze(proposals),nextCursor:rows.length>request.limit?encodeCursor(rows[request.limit-1].candidate):null});
  }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
 }
 return Object.freeze({
  list,
  async propose({principal,request,origin,signal,deadlineMs}){
   try{
    requireWritableOrigin(origin);
    assertProposalScope(principal,request);
    const requestSha256=canonicalSha256({operation:'memory.propose',origin,request});
    return await produce({principal,...request,corrects:null,reason:null,origin},requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  /** Sourced correction of an existing memory. The target is pinned by its current content hash; review decides whether it applies. */
  async correct({principal,request,origin,signal,deadlineMs}){
   try{
    requireWritableOrigin(origin);
    const requestSha256=canonicalSha256({operation:'memory.correct',origin,request});
    const retained=await replay(principal,request.idempotencyKey,requestSha256,{signal,deadlineMs});if(retained)return retained;
    const target=await memory.readTarget({tenantId:principal.tenantId,actorId:principal.actorId,memoryId:request.targetMemoryId,signal,deadlineMs});
    assertCorrectionTarget(principal,target);
    return await produce({principal,scope:target.scope,clientId:target.clientId,content:request.content,key:target.key,ttlDays:null,
     corrects:{memoryId:target.memoryId,memorySha256:target.memorySha256},reason:request.reason,sources:request.sources,origin,idempotencyKey:request.idempotencyKey},requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  /** Conversational memory.propose: a keyed proposal that matches an existing eligible memory becomes a correction of it. */
  async proposeFromCommand({principal,command,commandContext,commandSha256,signal,deadlineMs}){
   try{
    // The native source supplies the trusted conversation selection. Validate immutable intent here too: the producer is no longer
    // exclusively behind the old command executor, and model arguments must never select their own provenance or client.
    try{
     command=data(assertMemoryProposeCommand(command,commandContext));principal=data(principal);
     if(canonicalSha256(command)!==commandSha256)refuse('MEMORY_CANDIDATE_INVALID','NOT_DISPATCHED');
    }catch{refuse('MEMORY_CANDIDATE_INVALID','NOT_DISPATCHED');}
    if(principal.tenantId!==command.binding.tenantId||principal.actorId!==command.binding.actorId)refuse('MEMORY_SCOPE_REFUSED','NOT_DISPATCHED');
    const a=command.arguments,origin={kind:'conversation',conversationId:command.binding.conversationId,runId:command.binding.runId,commandId:command.commandId,commandSha256};
    assertProposalScope(principal,a);
    // The trusted command binding identifies the conversation before any keyed target lookup can reach Core.
    await requireOriginServable(principal.tenantId,origin);
    const requestSha256=canonicalSha256({operation:'memory.propose.command',commandSha256});
    const retained=await replay(principal,command.idempotencyKey,requestSha256,{signal,deadlineMs});if(retained)return retained;
    let corrects=null;
    if(a.key!==null){
     const target=await memory.findByKey({tenantId:principal.tenantId,actorId:principal.actorId,scope:a.scope,clientId:a.clientId,key:a.key,signal,deadlineMs});
     if(target){assertCorrectionTarget(principal,target);corrects={memoryId:target.memoryId,memorySha256:target.memorySha256};}
    }
    // A correction keeps its target's lifetime (Core refuses a correction with ttlDays, 409): the command's ttl applies to additions only.
    return await produce({principal,scope:a.scope,clientId:a.clientId,content:a.content,key:a.key,ttlDays:corrects!==null||a.ttlDays===null?null:Math.ceil(a.ttlDays),corrects,reason:null,sources:[],origin,idempotencyKey:command.idempotencyKey},
     requestSha256,{signal,deadlineMs});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  async status({principal,request,signal,deadlineMs}){
   try{
    const r=await journal.get({tenantId:principal.tenantId,proposerActorId:principal.actorId,candidateId:request.candidateId,signal});
    if(!r||!visibleToProposer(principal,r.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
    await requireServable(r.candidate);
    const current=(await statuses(principal,[r],{signal,deadlineMs}))[0];
    await requireServable(r.candidate);return current;
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
  /** The Meri review path (D016 #6): the proposer's own candidates that Core currently holds as PENDING. The page is the same keyset
   * page as `list`. Decided candidates do not appear, but uncertainty is reported at page level so an outage or an unacknowledged
   * submission cannot masquerade as an empty inbox. `nextCursor` still walks every own candidate. */
  async listPending({principal,request,signal,deadlineMs}){
   const page=await list({principal,request,signal,deadlineMs});
   const unresolved=page.proposals.filter(p=>['unavailable','submission_unknown','review_missing'].includes(p.review.status));
   const state=unresolved.some(p=>p.review.status==='unavailable')?'unavailable':unresolved.length?'partial':'available';
   return Object.freeze({proposals:Object.freeze(page.proposals.filter(p=>p.review.status==='pending')),nextCursor:page.nextCursor,
    reviewAvailability:Object.freeze({state,unresolvedCount:unresolved.length})});
  },
  /** The proposer's own decision on one of their pending candidates, forwarded to Core's canonical owner (never decided here). Only a
   * candidate Core currently reports as pending is forwarded; the answer is Core's current review state read back afterwards. */
  async decide({principal,request,decision,signal,deadlineMs}){
   try{
    if(decisions===null)refuse('MEMORY_UNAVAILABLE');
    const r=await journal.get({tenantId:principal.tenantId,proposerActorId:principal.actorId,candidateId:request.candidateId,signal});
    if(!r||!visibleToProposer(principal,r.candidate))refuse('MEMORY_PROPOSAL_NOT_FOUND');
    await requireServable(r.candidate);
    const current=(await statuses(principal,[r],{signal,deadlineMs}))[0];
    await requireServable(r.candidate);
    const admission=decisionAdmission(current,decision);if(admission.kind==='repeat')return admission.result;
    let outcome;
    try{({outcome}=await decisions.decide({candidate:r.candidate,decision,reason:request.reason,signal,deadlineMs}));}
    catch(error){
     if(productFailure(error)?.code!=='MEMORY_DECISION_UNCERTAIN'||signal?.aborted||deadlineMs!==undefined&&now()>=deadlineMs)throw error;
     // Read the original candidate within the same request budget; never repeat the POST.
     const recovered=(await statuses(principal,[r],{signal,deadlineMs}))[0];
     await requireServable(r.candidate);
     const settled=repeatedDecision(recovered,decision);if(settled)return settled;
     throw error;
    }
    const after=(await statuses(principal,[r],{signal,deadlineMs}))[0];
    await requireServable(r.candidate);
    return Object.freeze({proposal:after,decision:Object.freeze({decision,outcome})});
   }catch(error){throw asProductError(error,'MEMORY_UNAVAILABLE');}
  },
 });
}
