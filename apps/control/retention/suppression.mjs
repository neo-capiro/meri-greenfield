/** Immediate, authorized access removal and its release. Ownership comes from the trusted application authority (`ownership.ownerOf`),
 * never from caller-supplied subject metadata; authorization runs before any replay; the ledger is appended first (durable
 * acknowledgement), the journal projection second as a compare-and-set on the row the decision read under the journal's shared
 * recovery lock; an acknowledged transition whose projection write fails closes the serving barrier until reconciliation. In-flight
 * work is cancelled through the existing authenticated cancellation port; already-issued signed URLs cannot be recalled and are
 * recorded with their latest expiry. The serving gate is mandatory. */
import {own,data,fail,subject,subjectKey,clock,text,uuid} from './boundary.mjs';
import {projectionToken} from './memory-journal.mjs';
const principalOf=value=>{const p=own(data(value),['tenantId','actorId']);text(p.tenantId);text(p.actorId);return p;};
export const refusingOwnerMediation=Object.freeze({async ownerMediated(){fail('RETENTION_AUTHORIZATION_REFUSED');}});
/** The canonical trusted read gate every serving owner consults (conversations, lifecycle, artifacts). It reads the same journal
 * rows the suppression owner writes (no parallel store): refused while the recovery barrier is closed, refused when the journal cannot
 * answer (never "unsuppressed" by default), refused when the subject is suppressed. Subjects are trusted identities resolved by the
 * owner after its own authentication, never caller claims. Every refusal that is not a suppression writes one terminal line (capped
 * like the history diagnostics) naming the fence state and the innermost cause code, so operators can tell a per-request read
 * failure (`fence:"open"`) from a latched fence (`fence:"closed"` with its reason). */
const causeCode=error=>{let code=null;for(let e=error,i=0;e&&i<8;e=e.cause,i++)if(typeof e.code==='string'&&e.code)code=e.code.slice(0,64);return code;};
export function createRetentionReadGate({journal,serving,log=line=>process.stderr.write(line+'\n')}){
 if(typeof journal?.get!=='function'||typeof serving?.isEnabled!=='function'||typeof log!=='function')fail('RETENTION_CONFIGURATION');
 let windowStart=-Infinity,count=0;
 const report=(code,cause)=>{try{const at=Date.now();if(at-windowStart>=60000){windowStart=at;count=0;}if(count>20)return;if(count++===20){log('MERI_RETENTION_GATE_SUPPRESSED');return;}
  const state=typeof serving.state==='function'?serving.state():{enabled:serving.isEnabled(),reason:null};
  log(JSON.stringify({event:'MERI_RETENTION_GATE',stage:'retention',outcome:'refused',code,cause:causeCode(cause),fence:state.enabled?'open':'closed',reason:state.enabled?null:state.reason??'RETENTION_RECOVERY_BARRIER'}));}catch{/* Observability cannot affect the refusal. */}};
 const refuse=(code,cause)=>{report(code,cause);fail(code,cause);};
 const barrier=()=>{if(!serving.isEnabled())refuse('RETENTION_RECOVERY_BARRIER');};
 async function isSuppressed(rawSubject,read=journal.get){barrier();const s=subject(rawSubject);let current;try{current=await read(subjectKey(s));}catch(error){refuse(!serving.isEnabled()||error?.code==='RETENTION_RECOVERY_BARRIER'?'RETENTION_RECOVERY_BARRIER':'RETENTION_READ_UNAVAILABLE',error);}barrier();return Boolean(current&&current.state!=='RELEASED');}
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
 /** One subject exclusion can span the metadata transaction and its recovery.
  * Scoped methods retain the ordinary ownership/auth/projection checks without
  * reacquiring the same lock on another lease. Lock order: retention, conversation. */
 async function withTransition({principal,subject:rawSubject},work){
  if(typeof work!=='function')fail('RETENTION_CONFIGURATION');barrier();
  const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);
  return journal.withTransition(key,async databaseLease=>{
   let accepting=true,active=true;const pending=new Set();
   const check=()=>{if(!active)fail('RETENTION_INVALID_REQUEST');barrier();};
   async function access(operation){check();const currentOwner=await trustedSubject(rawSubject);check();if(currentOwner.ownerActorId!==s.ownerActorId)fail('RETENTION_OWNERSHIP_REFUSED');const auth=await authorize(p,s,operation);check();return auth;}
   // Drain any operation a trusted callback started before returning so the
   // subject exclusion never ends while a ledger acknowledgement is in flight.
   const scoped=fn=>input=>{if(!accepting) return Promise.reject(Object.assign(new Error('RETENTION_INVALID_REQUEST'),{code:'RETENTION_INVALID_REQUEST'}));
    const promise=Promise.resolve().then(()=>fn(input));pending.add(promise);promise.catch(()=>{});return promise;};
   async function suppress({reason,outstandingAccess,signal}){
   text(reason,1024);const accessState=outstanding(outstandingAccess),auth=await access('retention.suppress');
   const current=await journal.get(key),expected=projectionToken(current);if(current&&current.state!=='RELEASED')return Object.freeze({...current,replayed:true});
   let cancelled=[];if(cancellation&&accessState.inFlightRuns.length){cancelled=data(await cancellation.cancelInFlight({principal:p,subject:s,runs:accessState.inFlightRuns,signal}));if(!Array.isArray(cancelled))fail('RETENTION_CANCELLATION_REFUSED');}
   check();const entry=await ledger.append({subject:s,state:'SUPPRESSED',reason,facts:{principal:p,authorization:auth,outstandingAccess:accessState,cancelled,revokes:['read','replay','restore','continuation','reservation','allocationClaim'],cannotRecall:['issuedSignedUrlsUntilExpiry','runningWorkerUntilOwnCleanup']}});
   const row={state:'SUPPRESSED',ownerActorId:s.ownerActorId,suppressedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,reason,authorization:auth,outstandingAccess:accessState,cancelled,purge:null};
   await project(key,row,expected);return Object.freeze({...row,replayed:false});
   }
   async function release({reason}){
   text(reason,1024);const auth=await access('retention.release');
   const current=await journal.get(key),expected=projectionToken(current);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge)fail('RETENTION_PURGE_IN_PROGRESS');
   const entry=await ledger.append({subject:s,state:'RELEASED',reason,facts:{principal:p,authorization:auth}});
   const row={state:'RELEASED',ownerActorId:s.ownerActorId,releasedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,reason,authorization:auth,purge:null};
   await project(key,row,expected);return Object.freeze({...row,replayed:false});
   }
   const scope=Object.freeze({databaseLease,suppress:scoped(suppress),release:scoped(release),current:scoped(async()=>{await access('retention.read');const value=await journal.get(key);check();return value;})});
   let result,failure;
   try{result=await work(scope);}catch(error){failure=error;}finally{accepting=false;const results=await Promise.allSettled(pending);active=false;failure??=results.find(r=>r.status==='rejected')?.reason;}
   if(failure)throw failure;return result;
  });
 }
 const suppress=({principal,subject,...input})=>withTransition({principal,subject},scope=>scope.suppress(input));
 const release=({principal,subject,...input})=>withTransition({principal,subject},scope=>scope.release(input));
 const gate=createRetentionReadGate({journal,serving});
 return Object.freeze({suppress,release,withTransition,isSuppressed:gate.isSuppressed,assertServable:gate.assertServable,withRelease:gate.withRelease,now:tick});
}
