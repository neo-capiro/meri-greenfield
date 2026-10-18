/** Conversation write-intent approvals: the user's decision on one prepared proposal, its approved execution, and the
 * conversation's intent history. It adds no authorization of its own and mints nothing:
 *
 * - The proposal is read from the intent replay journal (`meri_intents.preparations`), only under the caller's own tenant,
 *   actor and conversation, and only when it is a PREPARED command proposal whose ids the caller named exactly.
 * - The decision is recorded by the canonical approval-decision owner (Core) through `decisions.record`. Meri never writes
 *   an ApprovalDecision; without that owner the route answers APPROVAL_OWNER_UNAVAILABLE and nothing happens.
 * - An approval reaches an effect only through the existing approved-execution path: `commands/tool-interface.mjs`
 *   `executeApproved`, whose executor rechecks the CURRENT decision (approval guard) and fresh `command.execute` authority
 *   before claim, before effect, at effect, release, settlement and completion. A recorded approval alone executes nothing.
 * - The durable result is the command journal row (`meri_commands.command_journal`) the executor writes; history reads it back.
 *
 * Ports (all supplied by the trusted composition; see docs/shipping/20261017/lanes/lane-3-write-intents.md):
 *  journal            {read({key,signal}), list({conversation,after,limit,signal})}  the intent journal store
 *  decisions          {record({proposal,decision,approver,binding,signal,deadlineMs}) → {decision,checkedAtMs,revoked},
 *                      readDecision({proposalId,commandSha256,binding,signal}) → ApprovalDecision|null}   Core, optional
 *  issueExecution     ({proposal,principal,signal,deadlineMs}) → {execution,credential,checkedAtMs,expiresAtMs}  broker, optional
 *  commandOptionsFor  ({proposal,signal}) → exact createCommandToolInterface options for the proposal's original binding
 *  outcomes           {read({proposal,signal}) → null|{state,outcome}}  command journal reader, optional
 *
 * Construction is inert. `enabled` defaults to false. */
import {assertProposalIntegrity,canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {data,own,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {createCommandToolInterface} from '../commands/tool-interface.mjs';
import {ProductError,productFailure} from '../product-access/errors.mjs';
const UUID=/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/u,DELIVERY=/^sdk:[a-f0-9]{64}$/u,DIGEST=/^[a-f0-9]{64}$/u;
/** Commands an approved intent may execute: those with a proposal (approval-metadata) owner today. */
export const APPROVABLE_ACTIONS=Object.freeze(['task.create']);
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
 let r;try{r=data(own(value,['conversationId','deliveryId','proposalId','commandSha256','decision']));}catch{fail('INTENT_REQUEST_INVALID');}
 if(typeof r.conversationId!=='string'||!UUID.test(r.conversationId))fail('INTENT_REQUEST_INVALID',null,'conversationId');
 if(typeof r.deliveryId!=='string'||!DELIVERY.test(r.deliveryId))fail('INTENT_REQUEST_INVALID',null,'deliveryId');
 if(typeof r.proposalId!=='string'||!UUID.test(r.proposalId))fail('INTENT_REQUEST_INVALID',null,'proposalId');
 if(typeof r.commandSha256!=='string'||!DIGEST.test(r.commandSha256))fail('INTENT_REQUEST_INVALID',null,'commandSha256');
 if(r.decision!=='approved'&&r.decision!=='rejected')fail('INTENT_REQUEST_INVALID',null,'decision');
 return r;
}
function listRequest(value){
 let r;try{r=data(own(value,['conversationId'],['after','limit']));}catch{fail('INTENT_REQUEST_INVALID');}
 if(typeof r.conversationId!=='string'||!UUID.test(r.conversationId))fail('INTENT_REQUEST_INVALID',null,'conversationId');
 if(r.after!==undefined&&r.after!==null&&(typeof r.after!=='string'||!DELIVERY.test(r.after)))fail('INTENT_REQUEST_INVALID',null,'after');
 if(r.limit!==undefined&&(!Number.isSafeInteger(r.limit)||r.limit<1||r.limit>50))fail('INTENT_REQUEST_INVALID',null,'limit');
 return {conversationId:r.conversationId,after:r.after??null,limit:r.limit??20};
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
 const c=own(configuration,['journal','commandOptionsFor','now','limits'],['decisions','issueExecution','outcomes','enabled']);
 const journal=own(c.journal,['read','list'],['claim','settle']),limits=data(c.limits);own(limits,['maxRequestMs']);
 if(typeof journal.read!=='function'||typeof journal.list!=='function'||typeof c.commandOptionsFor!=='function'||typeof c.now!=='function'||typeof(c.enabled??false)!=='boolean'||
  !Number.isSafeInteger(limits.maxRequestMs)||limits.maxRequestMs<1||limits.maxRequestMs>30000)throw new ProductError('PRODUCT_CONFIGURATION');
 const decisions=c.decisions===undefined?undefined:own(c.decisions,[],['record','readDecision','getCurrent']);
 const outcomes=c.outcomes===undefined?undefined:own(c.outcomes,['read']);
 if(decisions&&Object.values(decisions).some(f=>typeof f!=='function')||outcomes&&typeof outcomes.read!=='function'||c.issueExecution!==undefined&&typeof c.issueExecution!=='function')throw new ProductError('PRODUCT_CONFIGURATION');
 const lifetime=(deadlineMs,signal)=>{nativeSignal(signal);const at=c.now();
  return createOperationLifetime({deadlineMs:Math.min(Number.isSafeInteger(deadlineMs)?deadlineMs:at+limits.maxRequestMs,at+limits.maxRequestMs),now:c.now,signal,errorFactory:code=>new ProductError(code)});};
 const enabled=()=>{if(c.enabled!==true)fail('INTENT_APPROVALS_DISABLED','NOT_DISPATCHED');};
 const owned=(error,code,outcome)=>productFailure(error)&&!['PRODUCT_UNAVAILABLE'].includes(productFailure(error).code)?error:new ProductError(code,outcome);
 async function readEntry(life,principal,conversationId,deliveryId){
  try{return await life.run(signal=>journal.read.call(c.journal,{key:{tenantId:principal.tenantId,actorId:principal.actorId,conversationId,deliveryId},signal}));}
  catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;fail('INTENT_JOURNAL_UNAVAILABLE');}
 }
 /** The exact proposal the caller named, still approvable by this caller now. Refuses before any owner call. */
 function approvable(entry,r,principal){
  if(entry===null)fail('INTENT_NOT_FOUND','NOT_DISPATCHED');
  if(entry.state!=='PREPARED')fail('INTENT_NOT_PREPARED','NOT_DISPATCHED');
  const proposal=commandProposal(entry);if(!proposal)fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
  try{assertProposalIntegrity(proposal);}catch{fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');}
  if(proposal.proposalId!==r.proposalId||proposal.commandSha256!==r.commandSha256)fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!same(conversationOf(proposal.command.binding),{tenantId:principal.tenantId,actorId:principal.actorId,conversationId:r.conversationId}))fail('INTENT_MISMATCH','NOT_DISPATCHED');
  if(!APPROVABLE_ACTIONS.includes(proposal.command.action))fail('INTENT_NOT_APPROVABLE','NOT_DISPATCHED');
  if(!(instant(proposal.expiresAt)>c.now()))fail('INTENT_EXPIRED','NOT_DISPATCHED');
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
   const proposal=approvable(await readEntry(life,principal,r.conversationId,r.deliveryId),r,principal);
   const approver=data({tenantId:principal.tenantId,actorId:principal.actorId});
   // Independent review (a required approver other than the conversation owner) needs its own owner and listing; refused here.
   if(!same(approver,proposal.requiredApprover))fail('APPROVER_REFUSED','NOT_DISPATCHED');
   if(typeof decisions?.record!=='function')fail('APPROVAL_OWNER_UNAVAILABLE','NOT_DISPATCHED');
   life.limitDeadline(instant(proposal.expiresAt));
   const started=c.now();let raw;
   try{raw=await life.run(s=>decisions.record.call(c.decisions,{proposal,decision:r.decision,approver,binding:proposal.command.binding,signal:s,deadlineMs:Math.min(deadlineMs??Infinity,instant(proposal.expiresAt))}));}
   // The owner may have recorded the decision: repeat the same request (the owner answers by proposal and approver).
   catch{fail('APPROVAL_DECISION_UNKNOWN','UNKNOWN');}
   const decision=admitDecision(raw,proposal,r.decision,approver,started);
   if(r.decision==='rejected')return data({status:'rejected',deliveryId:r.deliveryId,proposalId:proposal.proposalId,decision});
   return await execute(life,principal,proposal,decision,r.deliveryId);
  }catch(error){throw owned(error,'INTENT_EXECUTION_UNKNOWN','UNKNOWN');}finally{life.close();}
 }
 async function execute(life,principal,proposal,decision,deliveryId){
  if(typeof c.issueExecution!=='function')fail('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
  let options;
  try{options=await life.run(signal=>c.commandOptionsFor({proposal,signal}));}catch(error){throw owned(error,'EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');}
  const context=options?.commandContext;
  if(options?.action!==proposal.command.action||!same(context?.binding,proposal.command.binding))fail('EXECUTION_OWNER_UNAVAILABLE','NOT_DISPATCHED');
  const started=c.now();let issued;
  try{issued=data(own(await life.run(signal=>c.issueExecution({proposal,principal,signal,deadlineMs:Math.min(started+limits.maxRequestMs,instant(proposal.expiresAt))})),['execution','credential','checkedAtMs','expiresAtMs']));}
  catch(error){throw owned(error,'EXECUTION_AUTHORITY_REFUSED','NOT_DISPATCHED');}
  const e=issued.execution,at=c.now();
  try{validateShape('CommandExecutionRequest',e);}catch{fail('EXECUTION_AUTHORITY_REFUSED','NOT_DISPATCHED');}
  if(typeof issued.credential!=='string'||!issued.credential||!Number.isSafeInteger(issued.checkedAtMs)||issued.checkedAtMs<started||issued.checkedAtMs>at||!Number.isSafeInteger(issued.expiresAtMs)||issued.expiresAtMs<=at||
   e.proposalId!==proposal.proposalId||e.commandSha256!==proposal.commandSha256||e.idempotencyKey!==proposal.command.idempotencyKey)fail('EXECUTION_AUTHORITY_REFUSED','NOT_DISPATCHED');
  // The command journal binds a command to its original run: an approval cannot execute it from another run (lane gap).
  if(['tenantId','actorId','conversationId','runId'].some(k=>e.executorBinding[k]!==proposal.command.binding[k]))fail('INTENT_CROSS_RUN','NOT_DISPATCHED');
  life.limitDeadline(issued.expiresAtMs);
  // Track whether the executor itself was reached and returned: before it nothing can be claimed; after it returned, an
  // effect may exist and only the release failed; while it runs, only its own codes say whether it claimed.
  const phase={executor:false,returned:false};
  const tracked={...options,executor:{async execute(...call){phase.executor=true;const out=await options.executor.execute(...call);phase.returned=true;return out;}}};
  let result;
  try{result=data(await life.run(signal=>createCommandToolInterface(tracked).executeApproved(proposal,e,issued.credential,signal)));}
  catch(error){
   const f=productFailure(error),code=String(error?.message??'');
   if(phase.returned)fail('INTENT_RESULT_NOT_RELEASED','RESULT_NOT_RELEASED');
   if(f)throw new ProductError(f.code,phase.executor?'UNKNOWN':'NOT_DISPATCHED');
   if(code==='COMMAND_OUTCOME_UNKNOWN'||code==='COMMAND_COMMIT_UNCERTAIN')fail('COMMAND_OUTCOME_UNKNOWN','UNKNOWN');
   // The executor reports every refusal before its journal claim as a closed code other than the two above; no claim, no effect.
   fail(['COMMAND_APPROVAL_REFUSED','COMMAND_AUTHORITY_REFUSED','COMMAND_PREPARATION_REFUSED'].includes(code)?code:'COMMAND_REFUSED','NOT_DISPATCHED');
  }
  if(result?.status==='observed')return data({status:'executed',deliveryId,proposalId:proposal.proposalId,decision,outcome:result.outcome});
  // Indeterminate: the existing journal holds the claim; nothing here retries it.
  return data({status:'indeterminate',deliveryId,proposalId:proposal.proposalId,decision});
 }
 /** History item for one journal entry. Content is withheld when the caller no longer sees its client scopes. */
 async function item(life,principal,entry){
  const base={deliveryId:entry.deliveryId,createdAt:entry.createdAt,operation:entry.record.operation};
  if(entry.state==='PENDING')return {...base,state:'pending'};
  if(entry.state==='UNKNOWN')return {...base,state:'unknown'};
  if(entry.state==='FAILED')return {...base,state:'failed',code:entry.outcome.code};
  const result=entry.outcome.result;
  if(result?.status==='draft'){
   if(!visible(result.version?.scopes,principal))return {...base,state:'prepared',kind:'draft',withheld:true};
   return {...base,state:'prepared',kind:'draft',versionId:result.version.versionId};
  }
  const proposal=commandProposal(entry);
  if(!proposal)return {...base,state:'prepared',kind:'schedule_proposal',proposalId:result?.proposal?.proposalId??null};
  if(!visible(proposal.command.scopes,principal))return {...base,state:'prepared',kind:'proposal',withheld:true};
  let decision='unavailable',execution='unavailable';
  if(typeof decisions?.readDecision==='function'){
   try{const d=data(await life.run(signal=>decisions.readDecision.call(c.decisions,{proposalId:proposal.proposalId,commandSha256:proposal.commandSha256,binding:proposal.command.binding,signal})));
    if(d===null)decision=null;else{validateShape('ApprovalDecision',d);if(d.proposalId===proposal.proposalId&&d.commandSha256===proposal.commandSha256)decision=d;}}
   catch(error){const f=productFailure(error);if(f&&['DEADLINE','CANCELLED'].includes(f.code))throw error;}
  }
  if(outcomes){
   try{const row=data(await life.run(signal=>outcomes.read.call(c.outcomes,{proposal,signal})));
    execution=row===null?null:row.state==='OUTCOME'?{state:'completed',outcome:row.outcome}:row.state==='UNKNOWN'?{state:'unknown'}:row.state==='CLAIMED'?{state:'executing'}:'unavailable';}
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
   const intents=[];for(const entry of page.entries)intents.push(await item(life,principal,entry));
   return data({conversationId:r.conversationId,intents,next:page.next});
  }finally{life.close();}
 }
 return Object.freeze({decide,list});
}
