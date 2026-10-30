/** Core browser-approval operations over the EXISTING approval-forwarder transport.
 *
 * This module owns no credential, HTTP or lifetime logic: the shared forwarder supplies its bounded
 * lifetime, its attended post (native bearer + verified service secret + fresh session checks) and its
 * canonical proposal/session readers. Only the Core04 bodies and the permissive/non-permissive rule live
 * here.
 *
 * Rules: `record` names the current authenticated canonical actor and is refused if it is not the
 * proposal's binding actor; `consume` returns a permission ONLY for a fresh `meri-browser-approval-receipt/1`
 * for this exact proposal and subject digest, and every repeat/lost-ACK/restart answer is the
 * non-permissive status document (status-only recovery never consumes again); `result` reports an effect
 * that already happened and is evidence, never a new grant.
 */
import {CORE_BROWSER_APPROVAL_ROUTES,recordBody,decideBody,resultBody,assertBrowserApprovalStatus}
 from '../../../packages/contracts/runtime-0.2/browser-approval-channel.mjs';
import {browserRequestFromPreparation} from '../../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {receiptRefusal} from '../../worker/conversation/browser/approval-binding.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';

const fail=(code,effect='none')=>{throw Object.assign(Error(code),{code,effect});};

export function createBrowserApprovalOperations({transport,now}={}){
 if(typeof transport?.lifetime!=='function'||typeof transport?.post!=='function'||
  typeof transport?.proposal!=='function'||typeof transport?.selected!=='function'||typeof now!=='function')
  throw fail('BROWSER_APPROVAL_CONFIGURATION');
 /** The retained canonical preparation for this proposal under the exact binding, correlated with the
  * requested proposalId and subject digest BEFORE any Core call. */
 async function prepared(life,{proposalId,subjectSha256,binding}){
  const retained=await transport.proposal(life,{proposalId,binding});
  if(!retained)fail('ACCESS_DENIED');
  if(retained.schemaVersion!==1||retained.metadata?.record?.proposalId!==proposalId||
   retained.metadata?.record?.request?.subjectSha256!==subjectSha256)fail('ACCESS_DENIED');
  return retained;
 }
 /** A status/result answer must describe THIS proposal and subject; a foreign status is not recovery. */
 function correlated(value,proposalId,subjectSha256,proposal){
  if(!value||value.proposalId!==proposalId||value.subjectSha256!==subjectSha256)fail('ACCESS_DENIED');
  const toolUseId=proposal?.metadata?.record?.request?.subject?.toolUseId;
  if(toolUseId!==undefined&&value.toolUseId!==toolUseId)fail('ACCESS_DENIED');
  return value;
 }
 async function call({signal,deadlineMs}={},build){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const {body,binding,proposal,route}=build();
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,route,{selected,body});
   life.check();
   return {answer:answer.value,sessionExpiresAtMs:answer.sessionExpiresAtMs,binding,proposal};
  }finally{life.close();}
 }
 /** Record the human decision of the CURRENT authenticated canonical actor for the retained proposal. */
 async function record({proposalId,subjectSha256,decision,approver,binding,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,subjectSha256,binding});
   const body=recordBody({proposalId,subjectSha256,decision,approver,binding});
   // Attended self-approval: the approver IS the canonical run actor, never an independent reviewer.
   if(body.approver.actorId!==body.binding.actorId||body.approver.tenantId!==body.binding.tenantId)fail('ACCESS_DENIED');
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.record,{selected,body});
   life.check();
   // Core answers exactly {decision,checkedAtMs,revoked}; the returned decision must be the canonical
   // one for THIS proposal, subject and approver.
   const value=answer.value;
   // Exactly these three keys: an extra field is not part of the Core04 record answer.
   if(!value||typeof value!=='object'||Object.keys(value).sort().join()!=='checkedAtMs,decision,revoked'||
    typeof value.revoked!=='boolean'||!Number.isSafeInteger(value.checkedAtMs))fail('UNAVAILABLE');
   if(value.decision!==null){
    try{validateShape('ApprovalDecision',value.decision);}catch{fail('UNAVAILABLE');}
    const d=value.decision;
    if(d.commandSha256!==subjectSha256||d.proposalId!==proposalId||d.decision!==decision||
     d.approver?.tenantId!==binding.tenantId||d.approver?.actorId!==binding.actorId||
     d.policyRevision!==proposal.run?.policyRevision)fail('ACCESS_DENIED');
   }
   return Object.freeze({decision:value.decision??null,checkedAtMs:now(),revoked:value.revoked,
    sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Consume ONCE. Only a fresh CLAIMED receipt is permissive; anything else is status and refuses. */
 async function consume({proposalId,subjectSha256,binding,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,subjectSha256,binding});
   const body=decideBody({proposalId,subjectSha256,binding});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.consume,{selected,body});
   life.check();
   const value=answer.value;
   // Canonical permission: the UNCHANGED browser receiptRefusal over the ORIGINAL request derived from
   // the retained preparation, at this clock. A malformed, partial, rejected or expired decision and any
   // foreign subject/tool-use/proposal refuse here.
   const request=browserRequestFromPreparation(proposal.metadata.record.request);
   const refusal=receiptRefusal(value,request,now());
   if(refusal===null){
    if(value.proposalId!==proposalId||value.subjectSha256!==subjectSha256)
     fail('ACCESS_DENIED');
    // receiptRefusal checks the tenant but not the exact actor or policy revision: the approver must be
    // the canonical run actor/requiredApprover and the policy the retained one.
    if(value.decision.approver?.tenantId!==binding.tenantId||value.decision.approver?.actorId!==binding.actorId)
     fail('ACCESS_DENIED');
    if(value.decision.policyRevision!==proposal.run?.policyRevision)fail('ACCESS_DENIED');
    return Object.freeze({permitted:true,receipt:value,sessionExpiresAtMs:answer.sessionExpiresAtMs});
   }
   // A repeat, restart or lost acknowledgement: non-permissive status, and NO second consume.
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(correlated(value,proposalId,subjectSha256,proposal)),
    sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Status-only recovery: reads the canonical status and never consumes. */
 async function status({proposalId,subjectSha256,binding,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,subjectSha256,binding});
   const body=decideBody({proposalId,subjectSha256,binding});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.status,{selected,body});
   life.check();
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(
    correlated(answer.value,proposalId,subjectSha256,proposal)),sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Report the ACTUAL outcome of an already-approved effect. Evidence, not a permission. */
 async function result({proposalId,subjectSha256,binding,outcome,result:settlement,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,subjectSha256,binding});
   const body=resultBody({proposalId,subjectSha256,binding,outcome,result:settlement});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.result,{selected,body});
   life.check();
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(
    correlated(answer.value,proposalId,subjectSha256,proposal)),sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({record,consume,status,result,routes:CORE_BROWSER_APPROVAL_ROUTES});
}
