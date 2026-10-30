/** Control's browser APPROVAL preparation and human wait.
 *
 * prepare() turns the exact `meri-browser-approval-request/3` an authenticated host captured into retained
 * metadata through the existing preparation producer. The exporting role and the canonical browser policy
 * are re-resolved on EVERY producer authority pass, so a role or policy change during preparation refuses
 * instead of freezing the value read when the owner was built. The self-approver is the canonical admitted
 * binding's actor, never a boot-time global.
 *
 * settle() waits on the canonical Core status and consumes AT MOST ONCE. A permit requires an approved,
 * unexpired decision on THIS proposal with consumption still null; any CLAIMED/COMPLETED/unknown answer is
 * status-only evidence, and a lost consume acknowledgement is reported UNKNOWN so recovery never
 * re-consumes.
 *
 * Activation stays held: constructing this owner creates no listener, credential or schedule.
 */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createBrowserPreparationProducer} from '../control/commands/approval-metadata/browser-preparation-producer.mjs';
import {createTransactionalApprovalMetadataStore} from '../control/commands/approval-metadata/postgres-store.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';
const DENIED='BROWSER_APPROVAL_REFUSED',UNKNOWN='BROWSER_APPROVAL_UNKNOWN';
const TERMINAL=new Set(['rejected','revoked','expired']);

export function createBrowserApprovalOwner(configuration){
 const c=own(configuration,['journal','pool','readCapabilityRole','readBrowserPolicy','ports'],
  ['now','limits','wait','store']);
 const {journal,pool,readCapabilityRole,readBrowserPolicy,ports}=c;
 if(typeof journal?.withCurrentRun!=='function'||!pool||typeof pool.connect!=='function'||
  typeof readCapabilityRole!=='function'||typeof readBrowserPolicy!=='function'||
  typeof ports?.status!=='function'||typeof ports?.consume!=='function')fail('BROWSER_APPROVAL_CONFIGURATION');
 const now=c.now??Date.now;
 if(typeof now!=='function')fail('BROWSER_APPROVAL_CONFIGURATION');
 const requestMs=c.limits?.requestMs??3000;
 if(!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>30000)fail('BROWSER_APPROVAL_CONFIGURATION');
 const pollMs=Number.isSafeInteger(c.wait?.pollMs)&&c.wait.pollMs>=50?c.wait.pollMs:500;
 const sleep=c.wait?.sleep??(ms=>new Promise(resolve=>setTimeout(resolve,ms)));
 const store=c.store??createTransactionalApprovalMetadataStore({pool});

 /** One current exporting role (a bare CORE role string). */
 async function role({signal,deadlineMs}){
  const started=now();
  let value;
  try{value=await readCapabilityRole({signal,deadlineMs:Math.min(deadlineMs??now()+requestMs,now()+requestMs)});}
  catch{throw fail(CHANGED);}
  return projectCapabilityRole({role:value.actorRole,checkedAtMs:value.checkedAtMs,expiresAtMs:value.expiresAtMs},
   {started,now:now()}).actorRole;
 }

 /** Retained preparation for exactly this request; the caller never supplies an approver. */
 async function prepare(value){
  const v=own(value,['request','binding'],['signal','deadlineMs']);
  const signal=nativeSignal(v.signal),binding=data(v.binding);
  const deadlineMs=v.deadlineMs??now()+requestMs;
  const approver=Object.freeze({tenantId:binding.tenantId,actorId:binding.actorId});
  const pinned=await role({signal,deadlineMs});
  // Re-resolved on every producer authority pass: a changed canonical role refuses.
  const browserPolicy=async({scopes,signal:inner,deadlineMs:innerDeadline})=>{
   const current=await role({signal:inner,deadlineMs:innerDeadline??deadlineMs});
   if(current!==pinned)throw fail(CHANGED);
   return readBrowserPolicy({binding,scopes,actorRole:current});
  };
  const producer=createBrowserPreparationProducer({journal,browserPolicy,store,approver,actorRole:pinned,
   now,maxRequestMs:requestMs});
  const record=await producer.prepare({request:v.request,binding,deadlineMs,
   ...(signal===undefined?{}:{signal})});
  if(!record||typeof record.proposalId!=='string')fail(DENIED);
  return Object.freeze({record,proposalId:record.proposalId,
   subjectSha256:record.request?.subjectSha256,binding:Object.freeze(data(binding))});
 }

 /** A fresh grant needs an approved, unexpired decision for THIS proposal with consumption still null. */
 function fresh(status,{proposalId,subjectSha256}){
  if(!status||status.unknown===true)return false;
  if(status.proposalId!==proposalId||status.subjectSha256!==subjectSha256)return false;
  if(status.consumption!==null)return false;
  const decision=status.decision;
  if(!decision||decision.decision!=='approved'||decision.proposalId!==proposalId||
   decision.commandSha256!==subjectSha256)return false;
  return Date.parse(decision.expiresAt)>now();
 }

 async function settle(value){
  const v=own(value,['proposalId','subjectSha256','binding'],['signal','deadlineMs']);
  const signal=nativeSignal(v.signal),until=v.deadlineMs??now()+requestMs;
  const binding=data(v.binding);
  let consumed=false,last=null;
  while(now()<until){
   signal?.throwIfAborted();
   let answer;
   try{answer=await ports.status({proposalId:v.proposalId,subjectSha256:v.subjectSha256,binding,
    ...(signal===undefined?{}:{signal}),deadlineMs:Math.min(until,now()+requestMs)});}
   catch(error){if(signal?.aborted)throw error;throw fail(UNKNOWN);}
   last=answer;
   const status=answer?.status;
   if(!status||status.proposalId!==v.proposalId)fail(DENIED);
   const state=status.decision?.decision;
   if(TERMINAL.has(state))return Object.freeze({permitted:false,status,consumed,terminal:state});
   if(fresh(status,{proposalId:v.proposalId,subjectSha256:v.subjectSha256})){
    if(consumed)return Object.freeze({permitted:false,status,consumed,statusOnly:true});
    consumed=true;
    let receipt;
    try{receipt=await ports.consume({proposalId:v.proposalId,subjectSha256:v.subjectSha256,binding,
     ...(signal===undefined?{}:{signal}),deadlineMs:Math.min(until,now()+requestMs)});}
    catch(error){
     if(signal?.aborted)throw error;
     // The consume POST may have landed: only canonical status recovery follows, never a retry.
     return Object.freeze({permitted:false,status,consumed:true,unknown:true,statusOnly:true});}
    if(receipt?.permitted===true)return Object.freeze({permitted:true,receipt:receipt.receipt,consumed:true});
    last=receipt;
   }
   await sleep(Math.min(pollMs,Math.max(0,until-now())));
  }
  return Object.freeze({permitted:false,status:last?.status??null,consumed,expired:true});
 }
 return Object.freeze({prepare,settle});
}
