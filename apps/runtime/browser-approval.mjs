/** Control's browser APPROVAL preparation and human wait.
 *
 * prepare() turns the exact `meri-browser-approval-request/3` an authenticated host captured into retained
 * metadata through the existing preparation producer. The exporting role and the canonical browser policy
 * are re-resolved on EVERY producer authority pass, so a role or policy change during preparation refuses
 * instead of freezing the value read when the owner was built. The self-approver is the canonical admitted
 * binding's actor, never a boot-time global.
 *
 * `wait`/`decide` are backed by the durable preparation and consumption owners: the consumption claim is
 * taken in the existing intent journal, so a recreated owner cannot consume twice after a lost
 * acknowledgement. `prepare` returns the SAME full immutable result on a fresh producer ACK and on replay,
 * and it validates both with one strict shared validator before anything is retained.
 *
 * A preparation whose metadata COMMIT happened but whose journal settle was lost is recovered from the
 * ACTUAL canonical metadata at the deterministic proposal identity; the producer is never re-run.
 *
 * Activation stays held: constructing this owner creates no listener, credential or schedule.
 */
import {own,data,nativeSignal} from '../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {createBrowserPreparationProducer} from '../control/commands/approval-metadata/browser-preparation-producer.mjs';
import {createTransactionalApprovalMetadataStore} from '../control/commands/approval-metadata/postgres-store.mjs';
import {browserPreparationProposalId,assertBrowserApprovalRequest,browserRequestFromPreparation}
 from '../../packages/contracts/runtime-0.2/browser-approval-preparation.mjs';
import {immutablePayload,readKey} from '../control/commands/approval-metadata/binding.mjs';
import {browserPreparationResult,assertBrowserPreparationResult}
 from '../control/commands/approval-metadata/browser-preparation-result.mjs';
import {canonicalSha256} from '../../packages/contracts/validate.mjs';
import {projectCapabilityRole} from './product-ports/capability-policy.mjs';
const fail=code=>{throw Object.assign(new Error(code),{code});};
const CHANGED='BROWSER_PREPARATION_AUTHORITY_CHANGED';
const DENIED='BROWSER_APPROVAL_REFUSED',UNKNOWN='BROWSER_APPROVAL_UNKNOWN';
const TERMINAL=new Set(['rejected','revoked','expired']);
/** Abortable pause: no timer or listener survives a cancelled wait. */
const pause=(ms,signal)=>new Promise((resolve,reject)=>{
 if(signal?.aborted)return reject(Object.assign(new Error('ABORTED'),{code:'ABORTED',name:'AbortError'}));
 const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
 const abort=()=>{clearTimeout(timer);reject(Object.assign(new Error('ABORTED'),{code:'ABORTED',name:'AbortError'}));};
 signal?.addEventListener('abort',abort,{once:true});
});

export function createBrowserApprovalOwner(configuration){
 const c=own(configuration,['journal','pool','readCapabilityRole','readBrowserPolicy','ports','preparations','consumption'],
  ['now','limits','store','sleep']);
 const {journal,pool,readCapabilityRole,readBrowserPolicy,ports}=c;
 if(typeof journal?.withCurrentRun!=='function'||!pool||typeof pool.connect!=='function'||
  typeof readCapabilityRole!=='function'||typeof readBrowserPolicy!=='function'||
  typeof ports?.status!=='function'||typeof ports?.consume!=='function'||
  typeof c.preparations?.claim!=='function'||typeof c.preparations?.settle!=='function'||
  typeof c.consumption?.claim!=='function'||typeof c.consumption?.settle!=='function')
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
  let request;
  try{request=assertBrowserApprovalRequest(v.request);}catch{throw fail(DENIED);}
  // The original request's own complete binding must be the acting one, before any claim is made.
  if(canonicalSha256(data(request.subject.binding))!==canonicalSha256(binding))throw fail(DENIED);
  if(request.subject.binding.tenantId!==binding.tenantId)throw fail(DENIED);
  // The proposal identity is deterministic, so a repeat from a NEW owner recovers it instead of creating
  // a second proposal. No clock, lease or checkedAt enters the identity.
  const proposalId=browserPreparationProposalId({binding,toolUseId:request.subject.toolUseId});
  const requestSha256=canonicalSha256(request);
  let durable;
  try{durable=await c.preparations.claim({binding,toolUseId:request.subject.toolUseId,proposalId,requestSha256,
   ...(signal===undefined?{}:{signal})});}
  catch(error){
   // A retained conflict/refusal keeps its code; only an uncertain claim is UNKNOWN.
   if(signal?.aborted)throw error;
   if(error?.code&&error.code!=='UNKNOWN')throw error;
   throw fail(UNKNOWN);
  }
  /** A producer bound to a FRESHLY resolved canonical role. Every authority pass re-resolves the role and
   * refuses if it moved, so a revoked role can never be used to release a retained preparation. */
  async function authorityBound(){
   const current=await role({signal,deadlineMs});
   const authorityPolicy=async({scopes,signal:inner,deadlineMs:innerDeadline})=>{
    const nowRole=await role({signal:inner,deadlineMs:innerDeadline??deadlineMs});
    if(nowRole!==current)throw fail(CHANGED);
    return readBrowserPolicy({binding,scopes,actorRole:nowRole});
   };
   return createBrowserPreparationProducer({journal,browserPolicy:authorityPolicy,store,approver,actorRole:current,
    now,maxRequestMs:requestMs,newId:()=>proposalId});
  }
  const canonicalOf=record=>{const {checkedAtMs:_seen,resolved:_resolved,...rest}=data(record);
   return canonicalSha256(rest);};
  if(durable.dispatch!==true){
   if(durable.variant==='replayed'){
    // A retained result is returned only when it is a FULL genuine preparation for this exact identity...
    let saved;
    try{saved=assertBrowserPreparationResult(durable.preparation,
     {binding,toolUseId:request.subject.toolUseId});}catch{throw fail(UNKNOWN);}
    if(saved.requestSha256!==requestSha256)throw fail('BROWSER_PREPARATION_CONFLICT');
    // ...and only while TODAY'S authority can still read the same canonical row. The retained result keeps
    // its ORIGINAL acknowledgement fingerprint; the fresh read is compared on canonical content only.
    let released;
    try{released=await (await authorityBound()).readPrepared({request,binding,deadlineMs,
     ...(signal===undefined?{}:{signal})});}catch{throw fail(UNKNOWN);}
    if(canonicalOf(released.record)!==canonicalOf(saved.record))throw fail('BROWSER_PREPARATION_CONFLICT');
    return Object.freeze({record:saved.record,proposalId:saved.proposalId,subjectSha256:saved.subjectSha256,
     binding:Object.freeze(data(binding)),recordSha256:saved.recordSha256,recovered:true,
     deliveryId:durable.deliveryId});
   }
   // PENDING/UNKNOWN: the metadata COMMIT may have happened with a lost ACK. Recovery reads the ACTUAL
   // canonical metadata WITH current authority (the owner re-resolves scopes/policy before and after the
   // read), validates it against the ORIGINAL request and settles only this original delivery. The producer
   // is never re-run and no command id, scope or digest is invented.
   let recovered;
   try{recovered=await (await authorityBound()).readPrepared({request,binding,deadlineMs,
    ...(signal===undefined?{}:{signal})});}catch{throw fail(UNKNOWN);}
   try{await c.preparations.settle({binding,toolUseId:request.subject.toolUseId,proposalId,requestSha256,
    preparation:recovered,...(signal===undefined?{}:{signal})});}
   catch(error){if(signal?.aborted)throw error;throw fail(UNKNOWN);}
   return Object.freeze({record:recovered.record,proposalId:recovered.proposalId,
    subjectSha256:recovered.subjectSha256,binding:Object.freeze(data(binding)),
    recordSha256:recovered.recordSha256,recovered:true,deliveryId:durable.deliveryId});
  }
  const producer=await authorityBound();
  const record=await producer.prepare({request:v.request,binding,deadlineMs,
   ...(signal===undefined?{}:{signal})});
  if(!record||record.proposalId!==proposalId)fail(DENIED);
  // The fresh ACK is validated with the SAME strict validator before it is retained.
  let result;
  try{result=browserPreparationResult(record,{requestSha256});
   assertBrowserPreparationResult(result,{binding,toolUseId:request.subject.toolUseId});}
  catch{throw fail(DENIED);}
  // PREPARED is settled only after the metadata owner acknowledged; a lost settle stays unresolved.
  try{await c.preparations.settle({binding,toolUseId:request.subject.toolUseId,proposalId,requestSha256,
   preparation:result,...(signal===undefined?{}:{signal})});}
  catch(error){if(signal?.aborted)throw error;throw fail(UNKNOWN);}
  return Object.freeze({record:result.record,proposalId,subjectSha256:result.subjectSha256,
   binding:Object.freeze(data(binding)),recordSha256:result.recordSha256,deliveryId:durable.deliveryId});
 }

 /** A fresh grant needs an approved, unexpired decision for THIS proposal with consumption still null. */
 function fresh(status,proposalId,subjectSha256){
  if(!status||status.unknown===true||status.revoked===true)return false;
  if(status.proposalId!==proposalId||status.subjectSha256!==subjectSha256)return false;
  if(status.consumption!==null)return false;
  const d=status.decision;
  if(!d||d.decision!=='approved'||d.proposalId!==proposalId||d.commandSha256!==subjectSha256)return false;
  return Date.parse(d.expiresAt)>now();
 }
 /** Human wait. Each Core call keeps the short request bound; only this loop's lifetime is long. The
  * consume POST happens at most once, only after a fresh durable claim, and a lost acknowledgement leaves
  * the delivery unresolved instead of retrying. */
 async function wait(value){
  const v=own(value,['proposalId','subjectSha256','requestSha256','toolUseId','binding'],['signal','deadlineMs']);
  const signal=nativeSignal(v.signal),binding=data(v.binding);
  const until=v.deadlineMs??now()+requestMs;
  if(!Number.isSafeInteger(until))fail('BROWSER_APPROVAL_REFUSED');
  const pollMs=Number.isSafeInteger(c.limits?.pollMs)&&c.limits.pollMs>=50?c.limits.pollMs:250;
  let posted=false,last=null;
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
   if(state==='rejected'||state==='revoked'||state==='expired')
    return Object.freeze({permitted:false,status,terminal:state,consumed:posted});
   // An unresolved or already-consumed answer is non-permissive NOW, never polled to timeout.
   if(status.unknown===true||status.revoked===true||status.consumption!==null)
    return Object.freeze({permitted:false,status,statusOnly:true,consumed:posted});
   if(fresh(status,v.proposalId,v.subjectSha256)){
    if(posted)return Object.freeze({permitted:false,status,statusOnly:true,consumed:true});
    let claim;
    try{claim=await c.consumption.claim({binding,toolUseId:v.toolUseId,proposalId:v.proposalId,
     requestSha256:v.requestSha256,...(signal===undefined?{}:{signal})});}
    catch(error){
     if(signal?.aborted)throw error;
     if(error?.code&&error.code!=='UNKNOWN')throw error;
     return Object.freeze({permitted:false,status,unknown:true,statusOnly:true,consumed:false});
    }
    if(claim.dispatch!==true)
     // A retained or unresolved claim is provenance: no consume POST, no permission.
     return Object.freeze({permitted:false,status,statusOnly:true,evidence:claim.evidence??null,
      consumed:false,variant:claim.variant});
    // Cancellation or expiry immediately before the consume POST never sends it.
    signal?.throwIfAborted();
    if(now()>=until)fail(UNKNOWN);
    posted=true;
    let answerReceipt;
    try{answerReceipt=await ports.consume({proposalId:v.proposalId,subjectSha256:v.subjectSha256,binding,
     ...(signal===undefined?{}:{signal}),deadlineMs:Math.min(until,now()+requestMs)});}
    catch(error){
     if(signal?.aborted)throw error;
     // The POST may have landed: UNKNOWN, status-only, never a retry.
     return Object.freeze({permitted:false,status,unknown:true,statusOnly:true,consumed:true});
    }
    if(answerReceipt?.permitted!==true)
     return Object.freeze({permitted:false,status,statusOnly:true,consumed:true});
    // The owner's own original deadline still governs: an elapsed wait never returns a grant, even when a
    // canonical receipt was just settled (the receipt stays provenance).
    if(now()>=until)return Object.freeze({permitted:false,status,expired:true,consumed:true});
    try{await c.consumption.settle({binding,toolUseId:v.toolUseId,proposalId:v.proposalId,
     requestSha256:v.requestSha256,receipt:answerReceipt.receipt,...(signal===undefined?{}:{signal})});}
    catch(error){
     if(signal?.aborted)throw error;
     return Object.freeze({permitted:false,status,unknown:true,statusOnly:true,consumed:true});
    }
    // ...and not after it either: a caller that aborted while the canonical receipt was being settled
    // never receives a grant.
    signal?.throwIfAborted();
    if(now()>=until)return Object.freeze({permitted:false,status,expired:true,consumed:true});
    return Object.freeze({permitted:true,receipt:answerReceipt.receipt,status,consumed:true});
   }
   await (c.sleep?c.sleep(pollMs):pause(pollMs,signal));
  }
  return Object.freeze({permitted:false,status:last?.status??null,expired:true,consumed:posted});
 }
 /** The ONLY public approval entry: prepare the ORIGINAL request, then wait within its own window. The
  * caller cannot pass an identity, a request digest or a longer window than the original request allows. */
 async function decide(value){
  const v=own(value,['request','binding'],['signal','deadlineMs']);
  const signal=nativeSignal(v.signal);
  const prepared=await prepare({request:v.request,binding:v.binding,
   ...(signal===undefined?{}:{signal}),...(v.deadlineMs===undefined?{}:{deadlineMs:v.deadlineMs})});
  const until=Math.min(v.request.expiresAtMs,v.deadlineMs??v.request.expiresAtMs);
  if(!Number.isSafeInteger(until)||until<=now())fail('BROWSER_APPROVAL_REFUSED');
  return wait({proposalId:prepared.proposalId,subjectSha256:prepared.subjectSha256,
   requestSha256:canonicalSha256(v.request),toolUseId:v.request.subject.toolUseId,binding:v.binding,
   deadlineMs:until,...(signal===undefined?{}:{signal})});
 }
 return Object.freeze({prepare,decide});
}
