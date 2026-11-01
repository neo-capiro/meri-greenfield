import {nativeMemoryOutcome} from './memory-outcome.mjs';
/** Conversation write-intent approvals: the user's decision on one prepared proposal, its approved execution, and the
 * conversation's intent history. It adds no authorization of its own and mints nothing:
 *
 * - The proposal is read from the intent replay journal (`meri_intents.preparations`), only under the caller's own tenant,
 *   actor and conversation, and only when it is a PREPARED command proposal whose ids the caller named exactly.
 * - The decision is recorded by the canonical approval-decision owner (Core) through `decisions.record`. Meri never writes
 *   an ApprovalDecision; without that owner the route answers APPROVAL_OWNER_UNAVAILABLE and nothing happens.
 * - Tasks reach Core's native receiver, which owns current authorization, the immutable decision and durable execution.
 *   Documents use the retained document delivery owner. A recorded approval alone executes nothing.
 * - History reads those same durable owners. An uncertain response never implies permission to repeat an effect.
 *
 * Ports (all supplied by the trusted composition; see docs/shipping/20261017/lanes/lane-3-write-intents.md):
 *  journal            {read({key,signal}), list({conversation,after,limit,signal})}  the intent journal store
 *  decisions          {record({proposal,decision,approver,binding,signal,deadlineMs}) → {decision,checkedAtMs,revoked},
 *                      readDecision({proposalId,commandSha256,binding,signal}) → ApprovalDecision|null}   Core, optional
 *  tasks/documents    {execute({proposal,...}), read({proposal,...})} canonical native effect/result owners, optional
 *
 * Construction is inert. `enabled` defaults to false. */
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {assertNativeApprovalProposal} from '../../../packages/contracts/commands-0.2/validate.mjs';
import {artifactValidators as artifacts,scheduleToolValidators,researchShareValidators,researchActionValidators,legiwatchValidators,savedNoteValidators,watchValidators,bizdevValidators,legislativeDocumentValidators,validateShape as artifactShape} from '../../../packages/contracts/retrieval-0.2/validate.mjs';
// Client-record reads the disjoint 0.3 family: the retained proposal shape is identical, while the create input may
// carry the bounded source provenance and the live answer may carry the bounded preflight. Every other owner above
// keeps its frozen 0.2 reading.
import {clientRecordValidators} from '../../../packages/contracts/retrieval-0.3/client-record-action-validation.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {assertBrowserApprovalStatus} from '../../../packages/contracts/runtime-0.2/browser-approval-channel.mjs';
import {browserProposalFromEntry,isBrowserPreparation} from './browser-proposals.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
import {nativeTaskOutcome} from './task-outcome.mjs';
import {nativeMailOutcome} from './mail-outcome.mjs';
import {SCHEDULE_INTENT_OPERATIONS} from './schedule-preparer.mjs';
import {OWNER_OPERATIONS} from './mount.mjs';
import {BROWSER_PREPARATION_OPERATION} from './browser-proposals.mjs';
import {ANALYSIS_INTENT_OPERATIONS} from './analysis-preparer.mjs';
import {nativeArtifactFileOutcome} from './filing-outcome.mjs';
import {assertMemoryReviewResult} from '../../../packages/contracts/commands-0.2/memory-review-result.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,DELIVERY=/^sdk:[a-f0-9]{64}$/u,DIGEST=/^[a-f0-9]{64}$/u;
/** The versions the client-record owner prepares. `create_client` moved to 0.3.0 and `update_client_profile`
 * stays on 0.2.0, so a stored row of either version still decides against the owner that produced it. */
const CLIENT_RECORD_VERSIONS=Object.freeze(new Set(['0.2.0','0.3.0']));
/** Commands an approved intent may execute: those with a proposal (approval-metadata) owner today. */
export const APPROVABLE_ACTIONS=Object.freeze(['task.create','task.update','document.draft','artifact.file','mail.send','memory.propose']);
/** Domain failures and their HTTP statuses (transport/membership codes belong to `product-access/http.mjs`). */
export const INTENT_APPROVAL_ERRORS=Object.freeze({
 INTENT_APPROVALS_DISABLED:503,INTENT_NOT_FOUND:404,INTENT_NOT_PREPARED:409,INTENT_NOT_APPROVABLE:409,INTENT_MISMATCH:409,INTENT_EXPIRED:409,
 INTENT_SCOPE_WITHHELD:403,APPROVER_REFUSED:403,APPROVAL_OWNER_UNAVAILABLE:503,APPROVAL_DECISION_REFUSED:409,APPROVAL_DECISION_UNKNOWN:502,
 EXECUTION_OWNER_UNAVAILABLE:503,EXECUTION_AUTHORITY_REFUSED:403,INTENT_CROSS_RUN:409,COMMAND_APPROVAL_REFUSED:409,COMMAND_AUTHORITY_REFUSED:403,
 COMMAND_PREPARATION_REFUSED:409,COMMAND_REFUSED:409,COMMAND_OUTCOME_UNKNOWN:502,INTENT_RESULT_NOT_RELEASED:502,INTENT_EXECUTION_UNKNOWN:502,INTENT_JOURNAL_UNAVAILABLE:503,INTENT_REQUEST_INVALID:400});
const fail=(code,outcome=null,field=null)=>{throw new ProductError(code,outcome,field);};
const same=(a,b)=>hash(a)===hash(b);
const conversationOf=b=>({tenantId:b.tenantId,actorId:b.actorId,conversationId:b.conversationId});
const instant=value=>{const t=typeof value==='string'?Date.parse(value):NaN;return Number.isSafeInteger(t)?t:NaN;};
/** Request parsing: closed objects, literal ids only. Identity never comes from the body. */
function decideRequest(value){
 const raw=data(value),browser=typeof raw?.deliveryId==='string'&&raw.deliveryId.startsWith('browser:');
 // A browser decision binds the SUBJECT digest; an SDK decision keeps its exact command digest contract.
 let r;try{r=data(browser
  ?own(value,['conversationId','deliveryId','proposalId','subjectSha256','decision'])
  :own(value,['conversationId','deliveryId','proposalId','commandSha256','decision']));}catch{fail('INTENT_REQUEST_INVALID');}
 if(typeof r.conversationId!=='string'||!UUID.test(r.conversationId))fail('INTENT_REQUEST_INVALID',null,'conversationId');
 if(typeof r.deliveryId!=='string'||!(browser?/^browser:[0-9a-f]{64}$/u:DELIVERY).test(r.deliveryId))fail('INTENT_REQUEST_INVALID',null,'deliveryId');
 if(typeof r.proposalId!=='string'||!UUID.test(r.proposalId))fail('INTENT_REQUEST_INVALID',null,'proposalId');
 if(browser){if(typeof r.subjectSha256!=='string'||!DIGEST.test(r.subjectSha256))fail('INTENT_REQUEST_INVALID',null,'subjectSha256');}
 else if(typeof r.commandSha256!=='string'||!DIGEST.test(r.commandSha256))fail('INTENT_REQUEST_INVALID',null,'commandSha256');
 if(r.decision!=='approved'&&r.decision!=='rejected')fail('INTENT_REQUEST_INVALID',null,'decision');
 return r;
}
function listRequest(value){
 let r;try{r=data(own(value,['conversationId'],['after','limit']));}catch{fail('INTENT_REQUEST_INVALID');}
 if(typeof r.conversationId!=='string'||!UUID.test(r.conversationId))fail('INTENT_REQUEST_INVALID',null,'conversationId');
 if(r.after!==undefined&&r.after!==null&&(typeof r.after!=='string'||
  !/^(?:sdk:[0-9a-f]{64}|browser:[0-9a-f]{64})$/u.test(r.after)))fail('INTENT_REQUEST_INVALID',null,'after');
 if(r.limit!==undefined&&(!Number.isSafeInteger(r.limit)||r.limit<1||r.limit>50))fail('INTENT_REQUEST_INVALID',null,'limit');
 return {conversationId:r.conversationId,after:r.after??null,limit:r.limit??20};
}
function inboxRequest(value){
 let r;try{r=data(own(value,[],['after','limit']));}catch{fail('INTENT_REQUEST_INVALID');}
 if(r.after!==undefined&&r.after!==null){
  let a;try{a=own(r.after,['conversationId','deliveryId']);}catch{fail('INTENT_REQUEST_INVALID',null,'after');}
  if(typeof a.conversationId!=='string'||!UUID.test(a.conversationId)||typeof a.deliveryId!=='string'||!DELIVERY.test(a.deliveryId))fail('INTENT_REQUEST_INVALID',null,'after');
 }
 if(r.limit!==undefined&&(!Number.isSafeInteger(r.limit)||r.limit<1||r.limit>50))fail('INTENT_REQUEST_INVALID',null,'limit');
 return {after:r.after??null,limit:r.limit??20};
}
/** The item kinds a person decides (inline, in their conversation). Drafts, notes, pending analyses, memory reviews and schedule
 * proposals have their own owners and surfaces and are not inbox rows. */
export const INBOX_KINDS=Object.freeze(['proposal','browser_action','watch_action','legiwatch_action','client_record_action','bizdev_action','legislative_document_action','research_action','research_share']);
/** The operation ids whose prepared rows can become inbox rows: the owner kinds behind INBOX_KINDS plus the browser preparation.
 * The journal applies this in SQL so rows of other kinds (notes, documents, analyses, schedules) are never read for the inbox. */
export const INBOX_OPERATIONS=Object.freeze([...new Set([...['command','watch','legiwatch','client-record','bizdev','legislative-document','research-action','research-sharing'].flatMap(owner=>OWNER_OPERATIONS[owner]),BROWSER_PREPARATION_OPERATION])]);
/** One inbox page with its pending summary; the release fence rebuilds it when a suppressed conversation's rows are dropped. */
export const inboxPage=(rows,next)=>data({rows,next,pending:{count:rows.filter(row=>row.withheld===false&&row.phase==='awaiting_approval').length,complete:next===null}});
/** Core owner statuses (watch/legiwatch/client-record/bizdev/legislative-document/research families) read as inbox phases. */
const OWNER_PHASES=Object.freeze({proposed:'awaiting_approval',approved:'approved',executing:'executing',succeeded:'completed',failed_terminal:'completed',blocked:'completed',
 failed_retryable:'unknown',outcome_unknown:'unknown',dismissed:'rejected',expired:'expired'});
const clientOf=scopes=>scopes.find(s=>s.kind==='client')?.resourceId??null;
/** One `item` reading projected to an inbox row, or null when the item is not something a person decides. Nothing is re-read:
 * the phase is the same reading `list` publishes (decision/execution owners first, then expiry). */
export function inboxRow(view,conversationId,at){
 if(view.state!=='prepared'||!INBOX_KINDS.includes(view.kind))return null;
 const base={conversationId,deliveryId:view.deliveryId,createdAt:view.createdAt,operation:view.operation,kind:view.kind};
 if(view.withheld===true)return {...base,withheld:true};
 const p=view.proposal;
 if(view.kind==='proposal')return {...base,withheld:false,clientId:clientOf(p.command.scopes),expiresAt:p.expiresAt,phase:view.phase};
 if(view.kind==='browser_action')return {...base,withheld:false,clientId:clientOf(p.scopes),expiresAt:new Date(p.expiresAtMs).toISOString(),phase:view.phase};
 const status=view.kind==='research_share'?view.proposalStatus:view.result==='unavailable'?'unavailable':view.kind==='research_action'?view.result.proposalStatus:view.result.status;
 const owner=OWNER_PHASES[status],expired=!(instant(p.expiresAt)>at);
 const phase=status==='unavailable'?'unknown_decision':owner===undefined?'unknown':owner==='awaiting_approval'&&expired?'expired':owner;
 return {...base,withheld:false,clientId:clientOf(p.scopes),expiresAt:p.expiresAt,phase};
}
/** Client-kind scopes must still be among the caller's current membership clients; other kinds are tenant-bound already. */
const visible=(scopes,principal)=>Array.isArray(scopes)&&scopes.every(s=>s?.tenantId===principal.tenantId&&(s.kind!=='client'||principal.clientIds.includes(String(s.resourceId).toLowerCase())));
/** A PREPARED command proposal from a journal entry, or null for any other prepared kind. */
function commandProposal(entry){
 const result=entry?.outcome?.result;
 if(result?.status!=='approval_required'||!result.proposal||typeof result.proposal!=='object'||!Object.hasOwn(result.proposal,'command'))return null;
 return result.proposal;
}
export function createIntentApprovalOwner(configuration){
 const c=own(configuration,['journal','now','limits'],['decisions','documents','tasks','filing','mail','memory','sharing','researchAction','legiwatch','watch','clientRecord','bizdev','legislativeDocument','browser','enabled']);
 const journal=own(c.journal,['read','list'],['claim','settle','listForActor','countForActor']),limits=data(c.limits);own(limits,['maxRequestMs']);
 if(typeof journal.read!=='function'||typeof journal.list!=='function'||journal.listForActor!==undefined&&typeof journal.listForActor!=='function'||journal.countForActor!==undefined&&typeof journal.countForActor!=='function'||typeof c.now!=='function'||typeof(c.enabled??false)!=='boolean'||
  !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000)throw new ProductError('PRODUCT_CONFIGURATION');
 const decisions=c.decisions===undefined?undefined:own(c.decisions,[],['record','readDecision','getCurrent','revoke']);
 // Browser decisions use their own Core route with the human's attended bearer; the port is required to decide.
 const browser=c.browser===undefined?undefined:own(c.browser,['record'],['status','result']);
 if(browser&&typeof browser.record!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const documents=c.documents===undefined?undefined:own(c.documents,['execute','read']);
 const tasks=c.tasks===undefined?undefined:own(c.tasks,['execute','read']);
 const memory=c.memory===undefined?undefined:own(c.memory,['execute','read']);
 if(memory&&Object.values(memory).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 const mail=c.mail===undefined?undefined:own(c.mail,['execute','read']);
 if(mail&&Object.values(mail).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 const filing=c.filing===undefined?undefined:own(c.filing,['execute','read']);
 const sharing=c.sharing===undefined?undefined:own(c.sharing,['decide','read']);
 const researchAction=c.researchAction===undefined?undefined:own(c.researchAction,['decide','read']);
 if(researchAction&&Object.values(researchAction).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 if(c.clientRecord!==undefined)own(c.clientRecord,['decide','read']);
 if(c.legiwatch!==undefined)own(c.legiwatch,['decide','read']);
 if(c.bizdev!==undefined)own(c.bizdev,['decide','read']);
 if(c.legislativeDocument!==undefined)own(c.legislativeDocument,['decide','read']);
if(c.watch!==undefined)own(c.watch,['decide','read']);
 if(sharing&&Object.values(sharing).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 if(filing&&Object.values(filing).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 if(tasks&&Object.values(tasks).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 if(documents&&Object.values(documents).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 if(decisions&&Object.values(decisions).some(f=>typeof f!=='function'))throw new ProductError('PRODUCT_CONFIGURATION');
 const lifetime=(deadlineMs,signal)=>{nativeSignal(signal);const at=c.now();
  return createOperationLifetime({deadlineMs:Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:at+limits.maxRequestMs,at+limits.maxRequestMs),now:c.now,signal,errorFactory:code=>new ProductError(code)});};
 const enabled=()=>{if(c.enabled!==true)fail('INTENT_APPROVALS_DISABLED','NOT_DISPATCHED');};
 const owned=(error,code,outcome)=>productFailure(error)&&!['PRODUCT_UNAVAILABLE'].includes(productFailure(error).code)?error:new ProductError(code,outcome);
 const decisionFailure=error=>{
  if(error?.effect==='none'&&typeof error.code==='string')fail(error.code==='ACCESS_DENIED'?'APPROVER_REFUSED':['DEADLINE','CANCELLED'].includes(error.code)?error.code:'APPROVAL_OWNER_UNAVAILABLE','NOT_DISPATCHED');
  fail('APPROVAL_DECISION_UNKNOWN','UNKNOWN');
 };
 /** After expiry only observe the existing owner; never send a new decision or effect to recover a lost response. */
 async function coreDecision(life,owner,proposal,decision,validate){
  const expired=!(instant(proposal.expiresAt)>c.now());
  if(typeof owner?.[expired?'read':'decide']!=='function')fail(expired?'APPROVAL_DECISION_UNKNOWN':'APPROVAL_OWNER_UNAVAILABLE',expired?'UNKNOWN':'NOT_DISPATCHED');
  if(!expired)life.limitDeadline(instant(proposal.expiresAt));
  let result;try{result=await life.run(signal=>owner[expired?'read':'decide']({proposal,decision,signal,deadlineMs:life.deadline()}));}
  catch(error){if(expired)fail('APPROVAL_DECISION_UNKNOWN','UNKNOWN');decisionFailure(error);}
  try{result=validate(result);}catch{fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
  if(expired&&['proposed','expired'].includes(result.status??result.proposalStatus))fail('INTENT_EXPIRED','NOT_DISPATCHED');
  return result;
 }
 async function readEntry(life,principal,conversationId,deliveryId){
  try{return await life.run(signal=>journal.read.call(c.journal,{key:{tenantId:principal.tenantId,actorId:principal.actorId,conversationId,deliveryId},signal}));}
  catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
 }
 /** The exact proposal the caller named, still approvable by this caller now. Refuses before any owner call. */
 function approvable(entry,r,principal){
  if(entry===null)fail('INTENT_NOT_FOUND','NOT_DISPATCHED');
  if(entry.state!=='PREPARED')fail('INTENT_NOT_PREPARED','NOT_DISPATCHED');
  const proposal=commandProposal(entry);if(!proposal)fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
  try{assertNativeApprovalProposal(proposal);}catch{fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');}
  if(proposal.proposalId!==r.proposalId||proposal.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!same(conversationOf(proposal.command.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId:r.conversationId}))fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!APPROVABLE_ACTIONS.includes(proposal.command.action))fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
  if(!visible(proposal.command.scopes,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  return proposal;
 }
 /** The owner's decision receipt for exactly this proposal, approver and choice, checked within this call. */
 function admitDecision(raw,proposal,choice,approver,started){
  let receipt;try{receipt=data(own(raw,['decision','checkedAtMs','revoked']));validateShape('ApprovalDecision',receipt.decision);}catch{fail('APPROVAL_DECISION_REFUSED','UNKNOWN');}
  const d=receipt.decision,at=c.now();
  if(receipt.revoked!==false||!Number.isSafeInteger(receipt.checkedAtMs)||receipt.checkedAtMs<started||receipt.checkedAtMs>at||d.decision!==choice||d.proposalId!==proposal.proposalId||
   d.commandSha256!==proposal.commandSha256||!same(d.approver,approver)||!(instant(d.decidedAt)<=at)||instant(d.decidedAt)<instant(proposal.createdAt)||
   (choice==='approved'&&!(instant(d.expiresAt)>at)))fail('APPROVAL_DECISION_REFUSED','UNKNOWN');
  return d;
 }
 async function decide({principal,request,signal,deadlineMs}){
  enabled();const r=decideRequest(request),life=lifetime(deadlineMs,signal);
  try{
   const entry=await readEntry(life,principal,r.conversationId,r.deliveryId);
   if(entry!==null&&isBrowserPreparation(entry))return await decideBrowser(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='watch_action')return await decideWatch(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='legiwatch_action')return await decideLegiwatch(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='client_record_action')return await decideClientRecord(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='bizdev_action')return await decideBizdev(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='legislative_document_action')return await decideLegislativeDocument(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='research_share')return await decideSharing(life,principal,entry,r);
   if(entry?.state==='PREPARED'&&entry.outcome?.result?.proposal?.kind==='research_action')return await decideResearchAction(life,principal,entry,r);
   const proposal=approvable(entry,r,principal);
   const approver=data({tenantId:principal.tenantId,actorId:principal.actorId});
   // Independent review (a required approver other than the conversation owner) needs its own owner and listing; refused here.
   if(!same(approver,proposal.requiredApprover))fail('APPROVER_REFUSED','NOT_DISPATCHED');
   if(!(instant(proposal.expiresAt)>c.now())){
    const current=await item(life,principal,{...entry,deliveryId:r.deliveryId},r.conversationId),decision=current.decision;
    if(decision&&typeof decision==='object'){
     if(!same(decision.approver,approver)||decision.decision!==r.decision)fail('APPROVAL_DECISION_REFUSED','UNKNOWN');
     if(decision.decision==='rejected')return data({status:'rejected',deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision});
     if(current.execution?.state==='completed')return data({status:'executed',deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision,outcome:current.execution.outcome});
     return data({status:'indeterminate',deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision});
    }
    if(decision===null&&current.execution===null)fail('INTENT_EXPIRED','NOT_DISPATCHED');
    fail('APPROVAL_DECISION_UNKNOWN','UNKNOWN');
   }
   if(typeof decisions?.record!=='function')fail('APPROVAL_OWNER_UNAVAILABLE','NOT_DISPATCHED');
   life.limitDeadline(instant(proposal.expiresAt));
   const started=c.now();let raw;
   try{raw=await life.run(s=>decisions.record.call(c.decisions,{proposal,decision:r.decision,approver,binding:proposal.command.binding,signal:s,deadlineMs:Math.min(deadlineMs??Infinity,instant(proposal.expiresAt))}));}
   catch(error){
    // An owner refusal before its request left (`effect:'none'`, the Core forwarder's closed codes) recorded nothing: no live
    // approver session or a forwarded identity mismatch is APPROVER_REFUSED, an unreachable owner APPROVAL_OWNER_UNAVAILABLE.
    // Otherwise the owner may have recorded the decision: repeat the same request (the owner answers by proposal and approver).
    decisionFailure(error);
   }
   const decision=admitDecision(raw,proposal,r.decision,approver,started);
   if(r.decision==='rejected')return data({status:'rejected',deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision});
   return await execute(life,principal,proposal,decision,r.deliveryId);
  }catch(error){throw owned(error,'INTENT_EXECUTION_UNKNOWN','UNKNOWN');}finally{life.close();}
 }
 function legiwatchProposal(entry,principal,conversationId){
  let p;try{legiwatchValidators.assertOutput(entry.outcome.result);p=entry.outcome.result.proposal;
   const {requestKey,...input}=p.request;
   if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(input)!==entry.record.argumentsSha256||!same(p.binding,entry.outcome.release.binding)||p.scopes.some(s=>!entry.outcome.release.scopes.some(original=>same(s,original)))||!same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
  }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
 }
 const legiwatchVisible=(p,principal)=>visible(p.scopes,principal)&&(p.request.clientId===null||principal.clientIds.includes(p.request.clientId));
 function legislativeDocumentProposal(entry,principal,conversationId){
 let p;try{legislativeDocumentValidators.assertOutput(entry.record.operation.id,entry.outcome.result);p=entry.outcome.result.proposal;
  const {requestKey,...request}=p.request,input=legislativeDocumentValidators.normalizeInput(p.operation,request);
  if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(input)!==entry.record.argumentsSha256||
   !same(p.binding,entry.outcome.release.binding)||p.scopes.some(scope=>!entry.outcome.release.scopes.some(original=>same(scope,original)))||
   !same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
 }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
}
const legislativeDocumentVisible=(p,principal)=>visible(p.scopes,principal)&&(p.context.selectedClientId===null||principal.clientIds.includes(p.context.selectedClientId));
async function decideLegislativeDocument(life,principal,entry,r){
 const p=legislativeDocumentProposal(entry,principal,r.conversationId);
 if(p.proposalId!==r.proposalId||p.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
 if(!legislativeDocumentVisible(p,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
 const result=await coreDecision(life,c.legislativeDocument,p,r.decision,value=>legislativeDocumentValidators.coreResult(p.operation,value,p));
 return data({status:'legislative_document_decided',deliveryId:r.deliveryId,proposalId:p.proposalId,result});
}
async function decideLegiwatch(life,principal,entry,r){
  const p=legiwatchProposal(entry,principal,r.conversationId);
  if(p.proposalId!==r.proposalId||p.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!legiwatchVisible(p,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const result=await coreDecision(life,c.legiwatch,p,r.decision,value=>legiwatchValidators.coreResult(value,p));
  return data({status:'legiwatch_decided',deliveryId:r.deliveryId,proposalId:p.proposalId,result});
 }
 function clientRecordProposal(entry,principal,conversationId){
  let p;try{clientRecordValidators.assertOutput(entry.outcome.result);p=entry.outcome.result.proposal;
   const input=clientRecordValidators.normalizeInput(p.operation,p.request.input);
   if(entry.record.operation.id!==p.operation||!CLIENT_RECORD_VERSIONS.has(entry.record.operation.version)||hash(input)!==entry.record.argumentsSha256||!same(p.binding,entry.outcome.release.binding)||p.scopes.some(s=>!entry.outcome.release.scopes.some(original=>same(s,original)))||!same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
  }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
 }
 const clientRecordVisible=(p,principal)=>visible(p.scopes,principal)&&(p.operation==='create_client'||principal.clientIds.includes(p.request.input.clientId));
 async function decideClientRecord(life,principal,entry,r){
  const p=clientRecordProposal(entry,principal,r.conversationId);
  if(p.proposalId!==r.proposalId||p.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!clientRecordVisible(p,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const result=await coreDecision(life,c.clientRecord,p,r.decision,value=>clientRecordValidators.coreResult(value,p));
  return data({status:'client_record_decided',deliveryId:r.deliveryId,proposalId:p.proposalId,result});
 }
 function bizdevProposal(entry,principal,conversationId){
  let p;try{bizdevValidators.assertOutput(entry.outcome.result);p=entry.outcome.result.proposal;
   const {requestKey,...input}=p.request;
   if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(input)!==entry.record.argumentsSha256||!same(p.binding,entry.outcome.release.binding)||p.scopes.some(s=>!entry.outcome.release.scopes.some(original=>same(s,original)))||!same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
  }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
 }
 // The saved brief edit is only visible to a principal who holds the prospect's own scope: the linked client when the prospect is linked, otherwise the
 // actor's private scope. A null client is never treated as a general or shared scope.
 const bizdevVisible=(p,principal)=>visible(p.scopes,principal)&&(p.context.linkedClientId===null||principal.clientIds.includes(p.context.linkedClientId));
 async function decideBizdev(life,principal,entry,r){
  const p=bizdevProposal(entry,principal,r.conversationId);
  if(p.proposalId!==r.proposalId||p.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!bizdevVisible(p,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const result=await coreDecision(life,c.bizdev,p,r.decision,value=>bizdevValidators.coreResult(value,p));
  // A refused or ambiguous outcome stays in the released Core status; it is never relabelled as a saved brief here.
  return data({status:'bizdev_decided',deliveryId:r.deliveryId,proposalId:p.proposalId,result});
 }
 /** Core action proposals already own the confirmation and atomic effect. Never mint a native ApprovalDecision. */
 /** The watch twin of the LegiWatch proposal: same journal binding and current-scope checks, no second identity. */
function watchProposal(entry,principal,conversationId){
 let p;try{watchValidators.assertOutput(entry.outcome.result);p=entry.outcome.result.proposal;
  const {requestKey,...input}=p.request;
  if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(input)!==entry.record.argumentsSha256||!same(p.binding,entry.outcome.release.binding)||p.scopes.some(s=>!entry.outcome.release.scopes.some(original=>same(s,original)))||!same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
 }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
}
const watchVisible=(p,principal)=>visible(p.scopes,principal)&&(p.request.clientId===null||principal.clientIds.includes(p.request.clientId));
async function decideWatch(life,principal,entry,r){
 const p=watchProposal(entry,principal,r.conversationId);
 if(p.proposalId!==r.proposalId||p.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
 if(!watchVisible(p,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
 const result=await coreDecision(life,c.watch,p,r.decision,value=>watchValidators.coreResult(value,p));
 return data({status:'watch_decided',deliveryId:r.deliveryId,proposalId:p.proposalId,result});
}
/** Core action proposals already own the confirmation and atomic effect. Never mint a native ApprovalDecision. */
 function sharingProposal(entry,principal,conversationId){
  let p;try{
   artifactShape('ResearchSharePrepared',entry.outcome.result);p=researchShareValidators.assertProposal(entry.outcome.result.proposal);
   const {operationKey,previewHash,expectedDesignVersion,...input}=p.request;
   if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(input)!==entry.record.argumentsSha256||
    !same(p.binding,entry.outcome.release.binding)||p.scopes.some(scope=>!entry.outcome.release.scopes.some(original=>same(scope,original)))||
    !same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
  }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
 }
 async function decideSharing(life,principal,entry,r){
  const proposal=sharingProposal(entry,principal,r.conversationId);
  if(proposal.proposalId!==r.proposalId||proposal.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!visible(proposal.scopes,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const result=await coreDecision(life,c.sharing,proposal,r.decision,value=>{const result=data(own(value,['proposalStatus'],['oneTimeResult']));artifactShape('ResearchShareProposalStatus',result.proposalStatus);return result;});
  if(result.oneTimeResult!==undefined){artifactShape('ResearchShareOneTimeResult',result.oneTimeResult);
   if(r.decision!=='approved'||proposal.operation!=='publish_research_portfolio_share_link'||result.proposalStatus!=='succeeded')fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
  // This response is never settled to the intent journal, a model event, or a result summary.
  return data({status:'research_share_decided',deliveryId:r.deliveryId,proposalId:r.proposalId,...result});
 }
 /** MO-05 governed Research Portfolio actions: Core action proposals own the confirmation, the idempotent effect and its receipt. */
 function researchActionProposal(entry,principal,conversationId){
  let p;try{
   artifactShape('ResearchActionPrepared',entry.outcome.result);p=researchActionValidators.assertProposal(entry.outcome.result.proposal);
   if(entry.record.operation.id!==p.operation||entry.record.operation.version!=='0.2.0'||hash(researchActionValidators.unbind(p.operation,p.request))!==entry.record.argumentsSha256||
    !same(p.binding,entry.outcome.release.binding)||p.scopes.some(scope=>!entry.outcome.release.scopes.some(original=>same(scope,original)))||
    !same(conversationOf(p.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))throw Error();
  }catch{fail('INTENT_JOURNAL_UNAVAILABLE');}return p;
 }
 async function decideResearchAction(life,principal,entry,r){
  const proposal=researchActionProposal(entry,principal,r.conversationId);
  if(proposal.proposalId!==r.proposalId||proposal.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!visible(proposal.scopes,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const result=await coreDecision(life,c.researchAction,proposal,r.decision,researchActionValidators.decided);
  if(result.resultSummary!==undefined&&(r.decision!=='approved'||result.proposalStatus!=='succeeded'))fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');
  return data({status:'research_action_decided',deliveryId:r.deliveryId,proposalId:r.proposalId,...result});
 }
 async function execute(life,principal,proposal,decision,deliveryId){
  if(['task.create','task.update','artifact.file','mail.send','memory.propose'].includes(proposal.command.action)){
   const isMemory=proposal.command.action==='memory.propose',isFiling=proposal.command.action==='artifact.file',isMail=proposal.command.action==='mail.send',port=isMemory?memory:isFiling?filing:isMail?mail:tasks,receiver=isMemory?c.memory:isFiling?c.filing:isMail?c.mail:c.tasks;
   if(!port)fail('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
   const result=data(await life.run(signal=>port.execute.call(receiver,{proposal,decision,principal,deliveryId,signal,deadlineMs:life.deadline()})));
   if(result?.status==='observed'){own(result,['status','outcome']);return data({status:'executed',deliveryId,proposalId:proposal.proposalId,decision,outcome:(isMemory?nativeMemoryOutcome:isFiling?nativeArtifactFileOutcome:isMail?nativeMailOutcome:nativeTaskOutcome)(result.outcome,proposal,decision)});}
   own(result,['status']);if(result.status!=='indeterminate')fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');
   return data({status:'indeterminate',deliveryId,proposalId:proposal.proposalId,decision});
  }
  if(proposal.command.action==='document.draft'){
   if(!documents)fail('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
   // The existing document delivery journal owns dispatch/recovery. This route
   // never retries an uncertain renderer or manufactures a command receipt.
   const result=data(await life.run(signal=>documents.execute.call(c.documents,{proposal,decision,principal,deliveryId,signal,deadlineMs:life.deadline()})));
   if(result?.status==='observed'){own(result,['status','outcome']);return data({status:'executed',deliveryId,proposalId:proposal.proposalId,decision,outcome:documentOutcome(result.outcome,proposal)});}
   own(result,['status']);if(result.status!=='indeterminate')fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');
   return data({status:'indeterminate',deliveryId,proposalId:proposal.proposalId,decision});
  }
  fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
 }
 /** History item for one journal entry. Content is withheld when the caller no longer sees its client scopes. */
 /** Record the human decision through Core browser/record. A recorded approval is AWAITING EXECUTION:
  * this path never consumes the approval and never dispatches a browser effect. */
 async function decideBrowser(life,principal,entry,r){
  const proposal=browserProposalFromEntry(entry);
  // The caller must name THIS retained proposal. A foreign proposal id with a valid delivery/digest is refused
  // before any Core call, exactly like the SDK path.
  if(r.proposalId!==proposal.proposalId||r.subjectSha256!==proposal.subjectSha256)
   fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(proposal.binding.tenantId!==principal.tenantId||proposal.binding.actorId!==principal.actorId||
   proposal.binding.conversationId!==r.conversationId)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  const approver=data({tenantId:principal.tenantId,actorId:principal.actorId});
  if(!same(approver,proposal.requiredApprover))fail('APPROVER_REFUSED','NOT_DISPATCHED');
  if(!visible(proposal.scopes,principal))fail('INTENT_SCOPE_WITHHELD','NOT_DISPATCHED');
  const at=c.now();
  if(!(proposal.expiresAtMs>at))fail('INTENT_EXPIRED','NOT_DISPATCHED');
  if(typeof browser?.record!=='function')fail('APPROVAL_OWNER_UNAVAILABLE','NOT_DISPATCHED');
  // The approval call cannot outlive the proposal window.
  life.limitDeadline(proposal.expiresAtMs);
  const started=c.now();
  let answer;
  try{answer=await life.run(signal=>browser.record.call(c.browser,{proposalId:proposal.proposalId,
   subjectSha256:proposal.subjectSha256,decision:r.decision,approver,binding:proposal.binding,signal,
   deadlineMs:life.deadline()}));}
  catch(error){decisionFailure(error);}
  // createBrowserApprovalOperations.record answers the ACTUAL Core envelope
  // {decision,checkedAtMs,revoked,sessionExpiresAtMs}; the adapter already validated the Core04 shape.
  const d=answer?.decision,checked=answer?.checkedAtMs,at2=c.now();
  if(!answer||typeof answer!=='object'||answer.revoked!==false||!Number.isSafeInteger(checked)||
   checked<started||checked>at2)fail('APPROVAL_DECISION_REFUSED','UNKNOWN');
  if(!d||d.proposalId!==proposal.proposalId||d.commandSha256!==proposal.subjectSha256||
   d.decision!==r.decision||!same(d.approver,approver)||!(instant(d.expiresAt)>at2)||
   instant(d.decidedAt)>at2||instant(d.decidedAt)<instant(proposal.createdAt))
   fail('APPROVAL_DECISION_REFUSED','UNKNOWN');
  const decision=data({proposalId:proposal.proposalId,subjectSha256:proposal.subjectSha256,
   decision:d.decision,decidedAt:d.decidedAt,approver:data({tenantId:d.approver.tenantId,
   actorId:d.approver.actorId}),policyRevision:d.policyRevision});
  return data({status:r.decision==='rejected'?'browser_rejected':'browser_decision_recorded',
   deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision});
 }
 async function item(life,principal,entry,conversationId){
  const base={deliveryId:entry.deliveryId,createdAt:entry.createdAt,operation:entry.record.operation};
  if(isBrowserPreparation(entry)){
   if(entry.state==='PENDING')return {...base,state:'pending'};
   if(entry.state==='UNKNOWN')return {...base,state:'unknown'};
   if(entry.state==='FAILED')return {...base,state:'failed',code:entry.outcome?.code};
   const proposal=browserProposalFromEntry(entry);
   if(proposal.binding.conversationId!==conversationId)fail('INTENT_MISMATCH','NOT_DISPATCHED');
   if(!visible(proposal.scopes,principal))return {...base,state:'prepared',kind:'browser_action',withheld:true};
   // Decision and execution are read, never inferred: an unavailable reader stays explicitly unavailable.
   // ONE canonical status snapshot per item. The actual adapter answers
   // {permitted:false,status,sessionExpiresAtMs}; the status document is the evidence, never a permission.
   let decision='unavailable',execution='unavailable',revoked=false;
   if(typeof browser?.status==='function'){
    try{
     const answer=await life.run(signal=>browser.status.call(c.browser,{proposalId:proposal.proposalId,
      subjectSha256:proposal.subjectSha256,binding:proposal.binding,signal,deadlineMs:life.deadline()}));
     if(!answer||answer.permitted!==false)throw Error('synthetic status envelope');
     const status=assertBrowserApprovalStatus(data(answer.status));
     if(status.proposalId!==proposal.proposalId||status.subjectSha256!==proposal.subjectSha256)
      fail('INTENT_JOURNAL_UNAVAILABLE');
     revoked=status.revoked===true;
     const d=status.decision;
     // A revoked approval is no longer a usable decision: it is published as revoked/expired, never approved.
     decision=revoked||!d?null:data({proposalId:proposal.proposalId,subjectSha256:proposal.subjectSha256,
      decision:d.decision,decidedAt:d.decidedAt,approver:data({tenantId:d.approver.tenantId,
      actorId:d.approver.actorId}),policyRevision:d.policyRevision});
     // Only an ACTUAL completed observation is execution evidence; a claimed/decided status never is.
     const consumed=status.consumption;
     execution=consumed&&consumed.state==='COMPLETED'&&consumed.result&&
      ['ok','error'].includes(consumed.result.outcome)
      ?data({state:'completed',outcome:consumed.result.outcome,
        reference:typeof consumed.result.result?.reference==='string'?consumed.result.result.reference:null})
      :null;
    }catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;
     decision='unavailable';execution='unavailable';revoked=false;}
   }
   const expired=!(proposal.expiresAtMs>c.now());
   const phase=decision==='unavailable'?'unknown_decision':revoked?'expired':decision===null?(expired?'expired':'awaiting_approval')
    :decision.decision==='rejected'?'rejected':expired?'expired':'approved';
   return {...base,state:'prepared',kind:'browser_action',proposal,decision,execution,phase};
  }
  if(entry.state==='PENDING')return {...base,state:'pending'};
  if(entry.state==='UNKNOWN')return {...base,state:'unknown'};
  if(entry.state==='FAILED')return {...base,state:'failed',code:entry.outcome.code};
  const result=entry.outcome.result;
  if(result?.proposal?.kind==='watch_action'){
   const proposal=watchProposal(entry,principal,conversationId);
   if(!watchVisible(proposal,principal))return {...base,state:'prepared',kind:'watch_action',withheld:true};
   let current='unavailable';if(typeof c.watch?.read==='function')try{current=watchValidators.coreResult(await life.run(signal=>c.watch.read({proposal,signal,deadlineMs:life.deadline()})),proposal);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'watch_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='legiwatch_action'){
   const proposal=legiwatchProposal(entry,principal,conversationId);
   if(!legiwatchVisible(proposal,principal))return {...base,state:'prepared',kind:'legiwatch_action',withheld:true};
   let current='unavailable';if(typeof c.legiwatch?.read==='function')try{current=legiwatchValidators.coreResult(await life.run(signal=>c.legiwatch.read({proposal,signal,deadlineMs:life.deadline()})),proposal);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'legiwatch_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='client_record_action'){
   const proposal=clientRecordProposal(entry,principal,conversationId);
   if(!clientRecordVisible(proposal,principal))return {...base,state:'prepared',kind:'client_record_action',withheld:true};
   let current='unavailable';if(typeof c.clientRecord?.read==='function')try{current=clientRecordValidators.coreResult(await life.run(signal=>c.clientRecord.read({proposal,signal,deadlineMs:life.deadline()})),proposal);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'client_record_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='bizdev_action'){
   const proposal=bizdevProposal(entry,principal,conversationId);
   if(!bizdevVisible(proposal,principal))return {...base,state:'prepared',kind:'bizdev_action',withheld:true};
   let current='unavailable';if(typeof c.bizdev?.read==='function')try{current=bizdevValidators.coreResult(await life.run(signal=>c.bizdev.read({proposal,signal,deadlineMs:life.deadline()})),proposal);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'bizdev_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='legislative_document_action'){
   const proposal=legislativeDocumentProposal(entry,principal,conversationId);
   if(!legislativeDocumentVisible(proposal,principal))return {...base,state:'prepared',kind:'legislative_document_action',withheld:true};
   let current='unavailable';if(typeof c.legislativeDocument?.read==='function')try{current=legislativeDocumentValidators.coreResult(proposal.operation,await life.run(signal=>c.legislativeDocument.read({proposal,signal,deadlineMs:life.deadline()})),proposal);}catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'legislative_document_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='research_action'){
   const proposal=researchActionProposal(entry,principal,conversationId);
   if(!visible(proposal.scopes,principal))return {...base,state:'prepared',kind:'research_action',withheld:true};
   let current='unavailable';if(researchAction)try{current=researchActionValidators.decided(await life.run(signal=>researchAction.read.call(c.researchAction,{proposal,signal,deadlineMs:life.deadline()})));}
   catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'research_action',proposal,result:current};
  }
  if(result?.proposal?.kind==='research_share'){
   const proposal=sharingProposal(entry,principal,conversationId);
   if(!visible(proposal.scopes,principal))return {...base,state:'prepared',kind:'research_share',withheld:true};
   let proposalStatus='unavailable';if(sharing)try{
    const current=data(own(await life.run(signal=>sharing.read.call(c.sharing,{proposal,signal,deadlineMs:life.deadline()})),['proposalStatus']));
    artifactShape('ResearchShareProposalStatus',current.proposalStatus);proposalStatus=current.proposalStatus;
   }catch(error){if(['DEADLINE','CANCELLED'].includes(error?.code))throw error;}
   return {...base,state:'prepared',kind:'research_share',proposal,proposalStatus};
  }
  if(result?.operation==='save_note'){
   // A saved note is a static PASS, never a proposal: its history item is the recorded envelope itself, so there
   // is nothing here to decide or to execute, and a note the caller can no longer see is withheld entire.
   let envelope;try{envelope=data(savedNoteValidators.envelope(result));}catch{fail('INTENT_JOURNAL_UNAVAILABLE');}
   const release=entry.outcome.release;
   if(base.operation.id!=='save_note'||base.operation.version!=='0.2.0'||!same(envelope.binding,release?.binding)||
    !Array.isArray(release.scopes)||envelope.scopes.some(scope=>!release.scopes.some(original=>same(scope,original)))||
    !same(conversationOf(envelope.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))fail('INTENT_JOURNAL_UNAVAILABLE');
   if(!visible(envelope.scopes,principal))return {...base,state:'prepared',kind:'saved_note',withheld:true};
   return {...base,state:'prepared',kind:'saved_note',result:envelope};
  }
  if(result?.status==='review_pending'||base.operation.id==='save_memory'&&!commandProposal(entry)){
   let review;try{review=assertMemoryReviewResult(result);}catch{fail('INTENT_JOURNAL_UNAVAILABLE');}
   if(base.operation.id!=='save_memory'||base.operation.version!=='0.2.0'||!same(review.binding,entry.outcome.release?.binding)||
    !Array.isArray(entry.outcome.release.scopes)||review.scopes.some(scope=>!entry.outcome.release.scopes.some(original=>same(scope,original)))||
    !same(conversationOf(review.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))fail('INTENT_JOURNAL_UNAVAILABLE');
   if(!visible(review.scopes,principal))return {...base,state:'prepared',kind:'memory_review',withheld:true};
   return {...base,state:'prepared',kind:'memory_review',review};
  }
  if(result?.status==='draft'){
   if(!visible(result.version?.scopes,principal))return {...base,state:'prepared',kind:'draft',withheld:true};
   return {...base,state:'prepared',kind:'draft',versionId:result.version.versionId};
  }
  if(result?.status==='analysis_pending'){
   // A sandbox analysis admitted inside prepare is this run's own pending work: bound to the released scopes, withheld
   // when they are no longer visible, and never a proposal (nothing here decides or executes it).
   const release=entry.outcome.release;
   if(!ANALYSIS_INTENT_OPERATIONS.includes(base.operation.id)||!same(result.binding,release?.binding)||!Array.isArray(release.scopes)||
    !Array.isArray(result.scopes)||result.scopes.some(scope=>!release.scopes.some(original=>same(scope,original)))||
    !same(conversationOf(result.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId}))fail('INTENT_JOURNAL_UNAVAILABLE');
   if(!visible(result.scopes,principal))return {...base,state:'prepared',kind:'analysis_pending',withheld:true};
   return {...base,state:'prepared',kind:'analysis_pending',pending:result.result};
  }
  const proposal=commandProposal(entry);
  if(!proposal){
   // Only a schedule owner prepares a proposal without a retained request (a direct schedule-preparer mount).
   if(result?.request===undefined){if(!SCHEDULE_INTENT_OPERATIONS.includes(base.operation.id))fail('INTENT_JOURNAL_UNAVAILABLE');return {...base,state:'prepared',kind:'schedule_proposal',proposalId:result?.proposal?.proposalId??null};}
   const p=artifactShape('ScheduleMutationOutput',result.proposal),binding=entry.outcome.release?.binding;
   scheduleToolValidators.normalizeRequest(base.operation.id,result.request);validateShape('RunBinding',binding);
   if(p.status!=='approval_required'||p.operation!==base.operation.id||hash(result.request)!==entry.record.argumentsSha256||
    !same(conversationOf(binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId})||
    p.projection.owner.tenantId!==binding.tenantId||p.projection.owner.actorId!==binding.actorId||p.projection.scopes.some(scope=>!entry.outcome.release.scopes.some(original=>same(scope,original))))fail('INTENT_JOURNAL_UNAVAILABLE');
   if(!visible(p.projection.scopes,principal))return {...base,state:'prepared',kind:'schedule_proposal',withheld:true};
   return {...base,state:'prepared',kind:'schedule_proposal',binding,request:result.request,proposal:p};
  }
  if(!visible(proposal.command.scopes,principal))return {...base,state:'prepared',kind:'proposal',withheld:true};
  let decision='unavailable',execution='unavailable';
  if(typeof decisions?.readDecision==='function'){
   try{const d=data(await life.run(signal=>decisions.readDecision.call(c.decisions,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:proposal.command.binding,signal})));
    if(d===null)decision=null;else{validateShape('ApprovalDecision',d);if(d.proposalId===proposal.proposalId&&d.commandSha256===proposal.commandSha256)decision=d;}}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;}
  }
  const nativeTask=['task.create','task.update'].includes(proposal.command.action),nativeFiling=proposal.command.action==='artifact.file',nativeMail=proposal.command.action==='mail.send',nativeMemory=proposal.command.action==='memory.propose';
  const reader=proposal.command.action==='document.draft'?documents:nativeTask?tasks:nativeFiling?filing:nativeMail?mail:nativeMemory?memory:undefined,receiver=proposal.command.action==='document.draft'?c.documents:nativeFiling?c.filing:nativeMail?c.mail:nativeMemory?c.memory:c.tasks;
  if(reader){
   try{const row=data(await life.run(signal=>reader.read.call(receiver,{proposal,principal,deliveryId:entry.deliveryId,signal,deadlineMs:life.deadline()})));
    execution=row===null?null:row.state==='OUTCOME'?{state:'completed',outcome:proposal.command.action==='document.draft'?documentOutcome(row.outcome,proposal):(nativeMemory?nativeMemoryOutcome:nativeFiling?nativeArtifactFileOutcome:nativeMail?nativeMailOutcome:nativeTaskOutcome)(row.outcome,proposal,decision&&typeof decision==='object'?decision:undefined)}:row.state==='UNKNOWN'?{state:'unknown'}:row.state==='CLAIMED'?{state:'executing'}:'unavailable';}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;}
  }
  const expired=!(instant(proposal.expiresAt)>c.now());
  // Phase is a reading of the durable owners, never a decision: execution evidence first, then the current decision.
  const phase=execution!==null&&typeof execution==='object'?execution.state:decision?.decision==='rejected'?'rejected':decision?.decision==='approved'?'approved':expired?'expired':decision===null?'awaiting_approval':'unknown_decision';
  return {...base,state:'prepared',kind:'proposal',proposal,decision,execution,phase};
 }
 async function list({principal,request,signal,deadlineMs}){
  enabled();const r=listRequest(request),life=lifetime(deadlineMs,signal);
  try{
   let page;
   try{page=data(await life.run(s=>journal.list.call(c.journal,{conversation:{tenantId:principal.tenantId,actorId:principal.actorId,conversationId:r.conversationId},after:r.after,limit:r.limit,signal:s})));}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
   own(page,['entries','next']);if(!Array.isArray(page.entries)||page.entries.length>r.limit)fail('INTENT_JOURNAL_UNAVAILABLE');
   const intents=[];for(const entry of page.entries)intents.push(await item(life,principal,entry,r.conversationId));
   return data({conversationId:r.conversationId,intents,next:page.next});
  }finally{life.close();}
 }
 /** The actor's approval inbox: every conversation's prepared proposals, newest first, read through the same `item` reading as
  * `list` (same tenant/actor/conversation key, same scope visibility, same decision and owner reads) and projected to the
  * fields a cross-conversation list needs. It lists and links; the conversation's list/decide routes stay the only place a
  * decision is made. `pending` counts the page's awaiting proposals and says whether the page was the whole journal. */
 async function inbox({principal,request,signal,deadlineMs}){
  enabled();if(typeof journal.listForActor!=='function')fail('INTENT_JOURNAL_UNAVAILABLE');
  const r=inboxRequest(request),life=lifetime(deadlineMs,signal);
  try{
   let page;
   try{page=data(await life.run(s=>journal.listForActor.call(c.journal,{actor:{tenantId:principal.tenantId,actorId:principal.actorId},after:r.after,limit:r.limit,operations:INBOX_OPERATIONS,signal:s})));}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
   own(page,['entries','next']);if(!Array.isArray(page.entries)||page.entries.length>r.limit)fail('INTENT_JOURNAL_UNAVAILABLE');
   const rows=[];
   for(const entry of page.entries){
    if(typeof entry?.conversationId!=='string'||!UUID.test(entry.conversationId))fail('INTENT_JOURNAL_UNAVAILABLE');
    const row=inboxRow(await item(life,principal,entry,entry.conversationId),entry.conversationId,c.now());
    if(row!==null)rows.push(row);
   }
   return inboxPage(rows,page.next);
  }finally{life.close();}
 }
 /** The badge count: prepared inbox rows still inside their release window, before any decision owner is consulted. It can
  * only overstate what the inbox page shows as awaiting (an approved, unexecuted proposal still counts until its window ends). */
 async function inboxCount({principal,request,signal,deadlineMs}){
  enabled();if(typeof journal.countForActor!=='function')fail('INTENT_JOURNAL_UNAVAILABLE');
  try{own(request,[]);}catch{fail('INTENT_REQUEST_INVALID');}
  const life=lifetime(deadlineMs,signal),at=c.now();
  try{
   let open;
   try{open=await life.run(s=>journal.countForActor.call(c.journal,{actor:{tenantId:principal.tenantId,actorId:principal.actorId},operations:INBOX_OPERATIONS,nowMs:at,signal:s}));}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
   if(!Number.isSafeInteger(open)||open<0)fail('INTENT_JOURNAL_UNAVAILABLE');
   return data({open,checkedAt:new Date(at).toISOString()});
  }finally{life.close();}
 }
 return Object.freeze({decide,list,inbox,inboxCount});
}

/** Publication correlation only. Current access, original preparation and exact
 * projected request are checked by the existing document owner before release. */
function documentOutcome(raw,proposal){
 try{
  const r=data(raw);artifactShape('ArtifactCreatedResult',r);artifacts.version(r.version);artifacts.inspection(r.inspection);
  const p=proposal.command,b=r.version.binding;
  if(r.execution.kind!=='native-document'||!same(conversationOf(b),conversationOf(p.binding))||!same(r.version.scopes,p.scopes)||!same(r.version.object.scopes,p.scopes)||
   r.version.parentVersionId!==p.arguments.baseVersionId||r.inspection.format!=='docx'||r.version.mimeType!=='application/vnd.openxmlformats-officedocument.wordprocessingml.document'||
   r.version.object.sha256!==r.inspection.sha256||r.version.object.bytes!==r.inspection.bytes)throw Error();
  return r;
 }catch{fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');}
}
