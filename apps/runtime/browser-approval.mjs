/** Control's browser APPROVAL preparation and human wait.
 *
 * prepare() turns the exact `meri-browser-approval-request/3` an authenticated host captured into retained
 * metadata through the existing preparation producer. The exporting role and the canonical browser policy
 * are re-resolved on EVERY producer authority pass, so a role or policy change during preparation refuses
 * instead of freezing the value read when the owner was built. The self-approver is the canonical admitted
 * binding's actor, never a boot-time global.
 *
 * settle() is NOT exposed yet. A permission path needs a durable claim that survives owner recreation, and
 * an in-process flag cannot provide that: a recreated owner would start with consumed=false and could
 * consume a second time after a lost acknowledgement. The seam refuses to build a settle port until that
 * durable claim exists, so no permission can be issued from this module today.
 *
 * Activation stays held: constructing this owner creates no listener, credential or schedule.
 */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createBrowserPreparationProducer} from '../control/commands/approval-metadata/browser-preparation-producer.mjs';
import {createTransactionalApprovalMetadataStore} from '../control/commands/approval-metadata/postgres-store.mjs';
import {createBrowserApprovalPreparationOwner} from '../control/commands/approval-metadata/browser-preparation-journal.mjs';
import {browserPreparationProposalId} from '../../packages/contracts/runtime-0.2/browser-operation.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';
const DENIED='BROWSER_APPROVAL_REFUSED',UNKNOWN='BROWSER_APPROVAL_UNKNOWN';
const TERMINAL=new Set(['rejected','revoked','expired']);

export function createBrowserApprovalOwner(configuration){
 const c=own(configuration,['journal','pool','readCapabilityRole','readBrowserPolicy','ports'],
  ['now','limits','wait','store','claim']);
 const {journal,pool,readCapabilityRole,readBrowserPolicy,ports}=c;
 if(typeof journal?.withCurrentRun!=='function'||!pool||typeof pool.connect!=='function'||
  typeof readCapabilityRole!=='function'||typeof readBrowserPolicy!=='function'||
  typeof ports?.status!=='function'||typeof ports?.consume!=='function'||
  typeof c.preparations?.claim!=='function'||typeof c.preparations?.settle!=='function')
  fail('BROWSER_APPROVAL_CONFIGURATION');
 const now=c.now??Date.now;
 if(typeof now!=='function')fail('BROWSER_APPROVAL_CONFIGURATION');
 const requestMs=c.limits?.requestMs??3000;
 if(!Number.isSafeInteger(requestMs)||requestMs<1||requestMs>30000)fail('BROWSER_APPROVAL_CONFIGURATION');
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
  const request=v.request;
  if(!request||typeof request.subject?.toolUseId!=='string'||typeof request.subjectSha256!=='string')
   fail(DENIED);
  // The proposal identity is deterministic, so a repeat from a NEW owner recovers it instead of creating
  // a second proposal. No clock, lease or checkedAt enters the identity.
  const proposalId=browserPreparationProposalId({binding,toolUseId:request.subject.toolUseId,
   subjectSha256:request.subjectSha256});
  const requestSha256=canonicalSha256(request);
  let durable;
  try{durable=await c.preparations.claim({binding,toolUseId:request.subject.toolUseId,proposalId,requestSha256,
   ...(signal===undefined?{}:{signal})});}
  catch(error){if(signal?.aborted)throw error;throw fail(UNKNOWN);}
  if(durable.dispatch!==true){
   if(durable.variant!=='replayed'||!durable.preparation)throw fail(UNKNOWN);
   return Object.freeze({record:null,proposalId:durable.preparation.proposalId,
    subjectSha256:request.subjectSha256,binding:Object.freeze(data(binding)),recovered:true,deliveryId:durable.deliveryId});
  }
  const pinned=await role({signal,deadlineMs});
  // Re-resolved on every producer authority pass: a changed canonical role refuses.
  const browserPolicy=async({scopes,signal:inner,deadlineMs:innerDeadline})=>{
   const current=await role({signal:inner,deadlineMs:innerDeadline??deadlineMs});
   if(current!==pinned)throw fail(CHANGED);
   return readBrowserPolicy({binding,scopes,actorRole:current});
  };
  const producer=createBrowserPreparationProducer({journal,browserPolicy,store,approver,actorRole:pinned,
   now,maxRequestMs:requestMs,newId:()=>proposalId});
  const record=await producer.prepare({request:v.request,binding,deadlineMs,
   ...(signal===undefined?{}:{signal})});
  if(!record||record.proposalId!==proposalId)fail(DENIED);
  // PREPARED is settled only after the metadata owner acknowledged; a lost settle stays unresolved.
  try{await c.preparations.settle({binding,toolUseId:request.subject.toolUseId,proposalId,requestSha256,
   preparation:{proposalId,subjectSha256:record.request.subjectSha256,requestSha256},
   ...(signal===undefined?{}:{signal})});}
  catch(error){if(signal?.aborted)throw error;throw fail(UNKNOWN);}
  return Object.freeze({record,proposalId,subjectSha256:record.request.subjectSha256,
   binding:Object.freeze(data(binding)),deliveryId:durable.deliveryId});
 }

 // No permission path here: an approval/consume port needs a durable consume claim that survives owner
 // recreation, which this module does not own yet. Only the durable PREPARATION is exposed.
 return Object.freeze({prepare});
}
