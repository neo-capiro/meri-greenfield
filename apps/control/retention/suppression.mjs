/** Immediate, authorized access removal and its release. Ledger first (durable acknowledgement), journal second; ownership semantics are the
 * existing ones (tenant and owning actor); cross-user suppression needs an owner-mediated receipt and the default port refuses. */
import {own,data,fail,subject,subjectKey,clock,text,uuid} from './boundary.mjs';
const principalOf=value=>{const p=own(data(value),['tenantId','actorId']);text(p.tenantId);text(p.actorId);return p;};
export const refusingOwnerMediation=Object.freeze({async ownerMediated(){fail('RETENTION_AUTHORIZATION_REFUSED');}});
export function createSuppressionOwner({ledger,journal,authorization=refusingOwnerMediation,serving=null,now}){
 if(typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof authorization?.ownerMediated!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 async function authorize(principal,s,operation){
  if(principal.tenantId===s.tenantId&&principal.actorId===s.ownerActorId)return {mode:'owner',receiptId:null};
  const receipt=await authorization.ownerMediated({principal,subject:s,operation});const r=own(data(receipt),['receiptId']);uuid(r.receiptId);return {mode:'owner-mediated',receiptId:r.receiptId};
 }
 const barrier=()=>{if(serving&&typeof serving.isEnabled==='function'&&!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 /** What suppression revokes now (future reads, replays, restores, continuations, reservations, claims) and what it cannot recall. */
 const outstanding=value=>{const o=own(data(value??{signedUrlsExpireAtMs:null,inFlightRuns:[]}),['signedUrlsExpireAtMs','inFlightRuns']);
  if(o.signedUrlsExpireAtMs!==null&&!Number.isSafeInteger(o.signedUrlsExpireAtMs)||!Array.isArray(o.inFlightRuns)||o.inFlightRuns.length>256)fail('RETENTION_INVALID_REQUEST');return o;};
 async function suppress({principal,subject:rawSubject,reason,outstandingAccess}){
  barrier();const p=principalOf(principal),s=subject(rawSubject),key=subjectKey(s);text(reason,1024);const access=outstanding(outstandingAccess);
  const current=await journal.get(key);if(current&&current.state!=='RELEASED')return Object.freeze({...current,replayed:true});
  const auth=await authorize(p,s,'retention.suppress');
  const entry=await ledger.append({subject:s,state:'SUPPRESSED',reason,facts:{principal:p,authorization:auth,outstandingAccess:access,revokes:['read','replay','restore','continuation','reservation','allocationClaim'],cannotRecall:['issuedSignedUrlsUntilExpiry','runningWorkerUntilOwnCleanup']}});
  const row={state:'SUPPRESSED',ownerActorId:s.ownerActorId,suppressedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,outstandingAccess:access,purge:null};
  await journal.set(key,row);return Object.freeze({...row,replayed:false});
 }
 async function release({principal,subject:rawSubject,reason}){
  barrier();const p=principalOf(principal),s=subject(rawSubject),key=subjectKey(s);text(reason,1024);
  const current=await journal.get(key);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge)fail('RETENTION_PURGE_IN_PROGRESS');
  const auth=await authorize(p,s,'retention.release');
  const entry=await ledger.append({subject:s,state:'RELEASED',reason,facts:{principal:p,authorization:auth}});
  const row={state:'RELEASED',ownerActorId:s.ownerActorId,releasedAtMs:entry.atMs,ledgerSequence:entry.sequence,entrySha256:entry.entrySha256,authorization:auth,purge:null};
  await journal.set(key,row);return Object.freeze({...row,replayed:false});
 }
 /** The read-path check every owner consults: refused while the recovery barrier is closed. */
 async function isSuppressed(rawSubject){barrier();const current=await journal.get(subjectKey(subject(rawSubject)));return Boolean(current&&current.state!=='RELEASED');}
 return Object.freeze({suppress,release,isSuppressed,now:tick});
}
