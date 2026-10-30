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
import {CORE_BROWSER_APPROVAL_ROUTES,recordBody,decideBody,resultBody,assertBrowserApprovalReceipt,
 assertBrowserApprovalStatus,browserApprovalPermitted} from '../../../packages/contracts/runtime-0.2/browser-approval-channel.mjs';

const fail=(code,effect='none')=>{throw Object.assign(Error(code),{code,effect});};

export function createBrowserApprovalOperations({transport,now}={}){
 if(typeof transport?.lifetime!=='function'||typeof transport?.post!=='function'||
  typeof transport?.proposal!=='function'||typeof transport?.selected!=='function'||typeof now!=='function')
  throw fail('BROWSER_APPROVAL_CONFIGURATION');
 /** The retained canonical preparation for this proposal under the exact binding. */
 async function prepared(life,{proposalId,binding}){
  const retained=await transport.proposal(life,{proposalId,binding});
  if(!retained)fail('ACCESS_DENIED');
  return retained;
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
   const proposal=await prepared(life,{proposalId,binding});
   const body=recordBody({proposalId,subjectSha256,decision,approver,binding});
   // Attended self-approval: the approver IS the canonical run actor, never an independent reviewer.
   if(body.approver.actorId!==body.binding.actorId||body.approver.tenantId!==body.binding.tenantId)fail('ACCESS_DENIED');
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.record,{selected,body});
   life.check();
   return Object.freeze({decision:answer.value?.decision??null,checkedAtMs:now(),revoked:answer.value?.revoked===true,
    sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Consume ONCE. Only a fresh CLAIMED receipt is permissive; anything else is status and refuses. */
 async function consume({proposalId,subjectSha256,binding,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,binding});
   const body=decideBody({proposalId,subjectSha256,binding});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.consume,{selected,body});
   life.check();
   const value=answer.value;
   if(browserApprovalPermitted(value,{proposalId,subjectSha256}))
    return Object.freeze({permitted:true,receipt:assertBrowserApprovalReceipt(value),sessionExpiresAtMs:answer.sessionExpiresAtMs});
   // A repeat, restart or lost acknowledgement: non-permissive status, and NO second consume.
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(value),sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Status-only recovery: reads the canonical status and never consumes. */
 async function status({proposalId,subjectSha256,binding,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,binding});
   const body=decideBody({proposalId,subjectSha256,binding});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.status,{selected,body});
   life.check();
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(answer.value),sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 /** Report the ACTUAL outcome of an already-approved effect. Evidence, not a permission. */
 async function result({proposalId,subjectSha256,binding,outcome,result:settlement,signal,deadlineMs}={}){
  const life=transport.lifetime(signal,deadlineMs);
  try{
   const proposal=await prepared(life,{proposalId,binding});
   const body=resultBody({proposalId,subjectSha256,binding,outcome,result:settlement});
   const selected=await transport.selected(life,proposal,binding);
   const answer=await transport.post(life,CORE_BROWSER_APPROVAL_ROUTES.result,{selected,body});
   life.check();
   return Object.freeze({permitted:false,status:assertBrowserApprovalStatus(answer.value),sessionExpiresAtMs:answer.sessionExpiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({record,consume,status,result,routes:CORE_BROWSER_APPROVAL_ROUTES});
}
