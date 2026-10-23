/** Immediate, authorized access removal and its release. Ownership comes from the trusted application authority (`ownership.ownerOf`),
 * never from caller-supplied subject metadata; authorization runs before any replay; the ledger is appended first (durable
 * acknowledgement), the journal projection second as a compare-and-set on the row the decision read under the journal's shared
 * recovery lock; an acknowledged transition whose projection write fails closes the serving barrier until reconciliation. In-flight
 * work is cancelled through the existing authenticated cancellation port; already-issued signed URLs cannot be recalled and are
 * recorded with their latest expiry. The serving gate is mandatory. */
import {own,data,fail,subject,subjectKey,clock,text,uuid} from './boundary.mjs';
import {projectionToken} from './memory-journal.mjs';
import {AsyncLocalStorage} from 'node:async_hooks';
const principalOf=value=>{const p=own(data(value),['tenantId','actorId']);text(p.tenantId);text(p.actorId);return p;};
export const refusingOwnerMediation=Object.freeze({async ownerMediated(){fail('RETENTION_AUTHORIZATION_REFUSED');}});
/** The canonical trusted read gate every serving owner consults (conversations, lifecycle, artifacts). It reads the same journal
 * rows the suppression owner writes (no parallel store): refused while the recovery barrier is closed, refused when the journal cannot
 * answer (never "unsuppressed" by default), refused when the subject is suppressed. Subjects are trusted identities resolved by the
 * owner after its own authentication, never caller claims. */
export function createRetentionReadGate({journal,serving}){
 if(typeof journal?.get!=='function'||typeof serving?.isEnabled!=='function')fail('RETENTION_CONFIGURATION');
 const barrier=()=>{if(!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 async function isSuppressed(rawSubject,read=journal.get){barrier();const s=subject(rawSubject);let current;try{current=await read(subjectKey(s));}catch(error){if(!serving.isEnabled()||error?.code==='RETENTION_RECOVERY_BARRIER')fail('RETENTION_RECOVERY_BARRIER');fail('RETENTION_READ_UNAVAILABLE');}barrier();return Boolean(current&&current.state!=='RELEASED');}
 async function assertServable(rawSubject,read=journal.get){if(await isSuppressed(rawSubject,read))fail('RETENTION_SUPPRESSED');}
 /** Serving owners provide authenticated subject identities and serialize their response inside this transition exclusion. */
 async function withRelease(rawSubjects,release,options){
  if(!Array.isArray(rawSubjects)||rawSubjects.length>100||typeof release!=='function'||typeof journal.withServing!=='function')fail('RETENTION_CONFIGURATION');
  barrier();const keys=[...new Set(rawSubjects.map(s=>subjectKey(subject(s))))].sort(),locked=new Set(keys);
  return journal.withServing(keys,async(signal,scoped)=>{if(scoped!==undefined&&typeof scoped?.get!=='function')fail('RETENTION_CONFIGURATION');
   let active=true;const assertLockedServable=raw=>{if(!active)fail('RETENTION_READ_UNAVAILABLE');const s=subject(raw);
    if(!locked.has(subjectKey(s)))fail('RETENTION_INVALID_REQUEST');return assertServable(s,scoped?.get??journal.get);};
   const readScheduleOriginRows=scoped?.readScheduleOriginRows&&((selection)=>{
    if(!active)fail('RETENTION_READ_UNAVAILABLE');return scoped.readScheduleOriginRows(selection);
   });
   try{barrier();const result=await release(signal,assertLockedServable,readScheduleOriginRows);barrier();return result;}finally{active=false;}},options);
 }
 return Object.freeze({isSuppressed,assertServable,withRelease});
}
export function createSuppressionOwner({ledger,journal,ownership,authorization=refusingOwnerMediation,cancellation=null,serving,now}){
 if(typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.withTransition!=='function'||typeof ownership?.ownerOf!=='function'||typeof authorization?.ownerMediated!=='function'||cancellation!==null&&typeof cancellation?.cancelInFlight!=='function'||typeof serving?.isEnabled!=='function'||typeof serving?.disable!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const barrier=()=>{if(!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 const transitionScope=new AsyncLocalStorage();
 const samePrincipal=(a,b)=>a.tenantId===b.tenantId&&a.actorId===b.actorId;
 /** Only this owner can reuse its already held transition. An inherited async context is not a permanent lock capability:
  * it expires when the callback returns, and in-flight nested work is drained before the actual journal lock is released. */
 function transition(key,p,work){
  const scope=transitionScope.getStore();
  if(!scope)return journal.withTransition(key,work);
  if(!scope.active)fail('RETENTION_TRANSITION_EXPIRED');
  if(scope.key!==key||!samePrincipal(scope.principal,p))fail('RETENTION_TRANSITION_MISMATCH');
  const pending=Promise.resolve().then(()=>{if(!scope.active)fail('RETENTION_TRANSITION_EXPIRED');return work();});
  scope.pending.add(pending);pending.finally(()=>scope.pending.delete(pending)).catch(()=>{});return pending;
 }
 async function withTransition({principal,subject:rawSubject},work){
  if(typeof work!=='function')fail('RETENTION_INVALID_REQUEST');
  barrier();const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);
  if(p.tenantId!==s.tenantId||p.actorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
  const inherited=transitionScope.getStore();
  if(inherited)return transition(key,p,work);
  return journal.withTransition(key,async()=>{
   const current=await trustedSubject(rawSubject);if(current.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
   const scope={key,principal:p,active:true,pending:new Set()};
   return transitionScope.run(scope,async()=>{try{barrier();return await work();}finally{
    scope.active=false;await Promise.allSettled([...scope.pending]);
   }});
  });
 }
 async function trustedSubject(raw){const s=subject(raw);let owner;try{owner=await ownership.ownerOf({tenantId:s.tenantId,kind:s.kind,subjectId:s.subjectId});}catch{fail('RETENTION_SUBJECT_UNKNOWN');}if(typeof owner!=='string'||!owner)fail('RETENTION_SUBJECT_UNKNOWN');if(s.ownerActorId!==undefined&&s.ownerActorId!==owner)fail('RETENTION_OWNERSHIP_REFUSED');return {...s,ownerActorId:owner};}
 async function authorize(principal,s,operation){
  if(principal.tenantId===s.tenantId&&principal.actorId===s.ownerActorId)return {mode:'owner',receiptId:null};
  const receipt=await authorization.ownerMediated({principal,subject:s,operation});const r=own(data(receipt),['receiptId']);uuid(r.receiptId);return {mode:'owner-mediated',receiptId:r.receiptId};
 }
 const outstanding=value=>{const o=own(data(value??{signedUrlsExpireAtMs:null,inFlightRuns:[]}),['signedUrlsExpireAtMs','inFlightRuns']);
  if(o.signedUrlsExpireAtMs!==null&&!Number.isSafeInteger(o.signedUrlsExpireAtMs)||!Array.isArray(o.inFlightRuns)||o.inFlightRuns.length>256)fail('RETENTION_INVALID_REQUEST');return o;};
 /** Projection write as compare-and-set under the shared recovery lock. A stale token whose current row already carries this exact
  * acknowledged entry (recovery projected it from the ledger first) is already projected; any other failure after an acknowledged
  * ledger entry closes the barrier until reconciliation. */
 async function project(key,row,expected){try{await journal.set(key,row,{expected});}catch(error){
  if(error?.code==='RETENTION_STALE_WRITE'){let current=null;try{current=await journal.get(key);}catch{current=null;}if(current&&current.state===row.state&&current.ledgerSequence===row.ledgerSequence&&current.entrySha256===row.entrySha256)return;}
  serving.disable();throw Object.assign(new Error('RETENTION_PROJECTION_FAILED'),{code:'RETENTION_PROJECTION_FAILED',cause:error});}}
 async function suppress({principal,subject:rawSubject,reason,outstandingAccess,signal}){
  barrier();const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);text(reason,1024);const access=outstanding(outstandingAccess);
  return transition(key,p,async()=>{
   const currentOwner=await trustedSubject(rawSubject);if(currentOwner.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
   const auth=await authorize(p,s,'retention.suppress');barrier();
   const current=await journal.get(key),expected=projectionToken(current);if(current&&current.state!=='RELEASED')return Object.freeze({...current,replayed:true});
   let cancelled=[];if(cancellation&&access.inFlightRuns.length){cancelled=data(await cancellation.cancelInFlight({principal:p,subject:s,runs:access.inFlightRuns,signal}));if(!Array.isArray(cancelled))fail('RETENTION_CANCELLATION_REFUSED');}
   barrier();const entry=await ledger.append({subject:s,state:'SUPPRESSED',reason,facts:{principal:p,authorization:auth,outstandingAccess:access,cancelled,revokes:['read','replay','restore','continuation','reservation','allocationClaim'],cannotRecall:['issuedSignedUrlsUntilExpiry','runningWorkerUntilOwnCleanup']}});
   const row={state:'SUPPRESSED',ownerActorId:s.ownerActorId,suppressedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,outstandingAccess:access,cancelled,purge:null};
   await project(key,row,expected);return Object.freeze({...row,replayed:false});
  });
 }
 async function release({principal,subject:rawSubject,reason}){
  barrier();const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);text(reason,1024);
  return transition(key,p,async()=>{
   const currentOwner=await trustedSubject(rawSubject);if(currentOwner.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');
   const auth=await authorize(p,s,'retention.release');barrier();
   const current=await journal.get(key),expected=projectionToken(current);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge)fail('RETENTION_PURGE_IN_PROGRESS');
   const entry=await ledger.append({subject:s,state:'RELEASED',reason,facts:{principal:p,authorization:auth}});
   const row={state:'RELEASED',ownerActorId:s.ownerActorId,releasedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,purge:null};
   await project(key,row,expected);return Object.freeze({...row,replayed:false});
  });
 }
 const gate=createRetentionReadGate({journal,serving});
 return Object.freeze({suppress,release,withTransition,isSuppressed:gate.isSuppressed,assertServable:gate.assertServable,withRelease:gate.withRelease,now:tick});
}
