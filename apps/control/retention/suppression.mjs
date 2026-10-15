/** Immediate, authorized access removal and its release. Ownership comes from the trusted application authority (`ownership.ownerOf`),
 * never from caller-supplied subject metadata; authorization runs before any replay; the ledger is appended first (durable
 * acknowledgement), the journal projection second as a compare-and-set on the row the decision read; an acknowledged transition whose
 * projection write fails closes the serving barrier until reconciliation. In-flight work is cancelled through the existing
 * authenticated cancellation port; already-issued signed URLs cannot be recalled and are recorded with their latest expiry. */
import {own,data,fail,subject,subjectKey,clock,text,uuid} from './boundary.mjs';
import {projectionToken} from './memory-journal.mjs';
const principalOf=value=>{const p=own(data(value),['tenantId','actorId']);text(p.tenantId);text(p.actorId);return p;};
export const refusingOwnerMediation=Object.freeze({async ownerMediated(){fail('RETENTION_AUTHORIZATION_REFUSED');}});
export function createSuppressionOwner({ledger,journal,ownership,authorization=refusingOwnerMediation,cancellation=null,serving=null,now}){
 if(typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof ownership?.ownerOf!=='function'||typeof authorization?.ownerMediated!=='function'||cancellation!==null&&typeof cancellation?.cancelInFlight!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const barrier=()=>{if(serving&&typeof serving.isEnabled==='function'&&!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 /** Trusted ownership: the application's record of who owns the subject; a caller-supplied claim must match it exactly or is refused. */
 async function trustedSubject(raw){const s=subject(raw);const owner=await ownership.ownerOf({tenantId:s.tenantId,kind:s.kind,subjectId:s.subjectId});if(typeof owner!=='string'||!owner)fail('RETENTION_SUBJECT_UNKNOWN');if(s.ownerActorId!==undefined&&s.ownerActorId!==owner)fail('RETENTION_OWNERSHIP_REFUSED');return {...s,ownerActorId:owner};}
 async function authorize(principal,s,operation){
  if(principal.tenantId===s.tenantId&&principal.actorId===s.ownerActorId)return {mode:'owner',receiptId:null};
  const receipt=await authorization.ownerMediated({principal,subject:s,operation});const r=own(data(receipt),['receiptId']);uuid(r.receiptId);return {mode:'owner-mediated',receiptId:r.receiptId};
 }
 const outstanding=value=>{const o=own(data(value??{signedUrlsExpireAtMs:null,inFlightRuns:[]}),['signedUrlsExpireAtMs','inFlightRuns']);
  if(o.signedUrlsExpireAtMs!==null&&!Number.isSafeInteger(o.signedUrlsExpireAtMs)||!Array.isArray(o.inFlightRuns)||o.inFlightRuns.length>256)fail('RETENTION_INVALID_REQUEST');return o;};
 /** Projection write as compare-and-set; on failure after an acknowledged ledger entry the barrier closes (fail closed) and the caller sees RETENTION_PROJECTION_FAILED. */
 async function project(key,row,expected){try{await journal.set(key,row,{expected});}catch(error){serving?.disable?.();throw Object.assign(new Error('RETENTION_PROJECTION_FAILED'),{code:'RETENTION_PROJECTION_FAILED',cause:error});}}
 async function suppress({principal,subject:rawSubject,reason,outstandingAccess,signal}){
  barrier();const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);text(reason,1024);const access=outstanding(outstandingAccess);
  const auth=await authorize(p,s,'retention.suppress');
  const current=await journal.get(key),expected=projectionToken(current);if(current&&current.state!=='RELEASED')return Object.freeze({...current,replayed:true});
  let cancelled=[];if(cancellation&&access.inFlightRuns.length){cancelled=data(await cancellation.cancelInFlight({principal:p,subject:s,runs:access.inFlightRuns,signal}));if(!Array.isArray(cancelled))fail('RETENTION_CANCELLATION_REFUSED');}
  const entry=await ledger.append({subject:s,state:'SUPPRESSED',reason,facts:{principal:p,authorization:auth,outstandingAccess:access,cancelled,revokes:['read','replay','restore','continuation','reservation','allocationClaim'],cannotRecall:['issuedSignedUrlsUntilExpiry','runningWorkerUntilOwnCleanup']}});
  const row={state:'SUPPRESSED',ownerActorId:s.ownerActorId,suppressedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,outstandingAccess:access,cancelled,purge:null};
  await project(key,row,expected);return Object.freeze({...row,replayed:false});
 }
 async function release({principal,subject:rawSubject,reason}){
  barrier();const p=principalOf(principal),s=await trustedSubject(rawSubject),key=subjectKey(s);text(reason,1024);
  const auth=await authorize(p,s,'retention.release');
  const current=await journal.get(key),expected=projectionToken(current);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge)fail('RETENTION_PURGE_IN_PROGRESS');
  const entry=await ledger.append({subject:s,state:'RELEASED',reason,facts:{principal:p,authorization:auth}});
  const row={state:'RELEASED',ownerActorId:s.ownerActorId,releasedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,purge:null};
  await project(key,row,expected);return Object.freeze({...row,replayed:false});
 }
 /** The read-path check every owner consults: refused while the recovery barrier is closed. */
 async function isSuppressed(rawSubject){barrier();const s=subject(rawSubject);const current=await journal.get(subjectKey(s));return Boolean(current&&current.state!=='RELEASED');}
 return Object.freeze({suppress,release,isSuppressed,now:tick});
}
