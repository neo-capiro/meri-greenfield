/** Content-free observation of an exact Core-authorized Trash request. Uses the
 * existing projection, external-ledger proof and subject release lease; no job,
 * request log, content access, or deletion side effect. */
import {fail,subjectKey,clock} from './boundary.mjs';
import {verifyPurgeTargets} from './verify-targets.mjs';
const reasons=Object.freeze({TRASH_RESTORE_PERIOD:'restore_period',LEGAL_HOLD:'legal_hold',OBJECT_LOCK:'object_lock',SHARED_REFERENCE:'shared_reference',COOLING_PERIOD:'policy',RETENTION_PERIOD:'policy',CLASS_NOT_PURGEABLE:'policy'});
export function createDeletionStatusReader({journal,ensureServing,owners,enabled,now}){
 const tick=clock(now);
 if(typeof ensureServing!=='function')fail('RETENTION_CONFIGURATION');
 return Object.freeze({async withStatus({principal,reference,signal,deadlineMs},publish){
  if(typeof publish!=='function'||typeof journal?.withTransition!=='function')fail('RETENTION_INVALID_REQUEST');
  const subject={tenantId:principal.tenantId,kind:'conversation',subjectId:reference.conversationId,ownerActorId:principal.actorId},key=subjectKey(subject);
  await ensureServing();
  // Reuse the journal's existing transition lease. On PostgreSQL the target
  // reads and projection checks borrow that lease instead of exhausting a
  // finite pool with a second connection. The watermark is checked again at
  // release to detect recovery or restored projections during those reads.
  return journal.withTransition(key,async()=>{
   const check=()=>{signal?.throwIfAborted();if(Number.isFinite(deadlineMs)&&tick()>=deadlineMs)fail('RETENTION_READ_UNAVAILABLE');};
   check();const row=await journal.get(key);check();
   const result=(state,why=[])=>({state,reasons:why,checkedAtMs:tick(),retainedSharedCopies:(row?.purge?.retainedObjects?.length??0)>0});
   let status;
   if(row&&row.ownerActorId!==principal.actorId)fail('RETENTION_FORBIDDEN');
   if(reference.metadataState==='superseded')status=result('superseded');
   else if(row?.state!=='SUPPRESSED'||row.reason!=='conversation-trash:'+reference.requestId)status=result('unknown',['verification_unavailable']);
   else if(!enabled)status=result('blocked',['cleanup_disabled']);
   else if(reference.metadataState==='present'&&Date.parse(reference.restoreUntil)>tick())status=result('pending',['restore_period']);
   else{
    const purge=row.purge;
    if(!purge||purge.state==='PLANNED')status=result('pending',['cleanup_pending']);
    else if(purge.trash?.requestId!==reference.requestId||purge.trash.revision!==reference.revision||purge.trash.restoreUntilMs!==Date.parse(reference.restoreUntil))status=result('unknown',['verification_unavailable']);
    else if(purge.state==='BLOCKED')status=result('blocked',[...new Set((purge.blocked?.length?purge.blocked:[{}]).map(b=>reasons[b.reason]??'verification_unavailable'))]);
    else if(purge.state!=='EXECUTED'||purge.coreFinalized!==true||reference.metadataState!=='absent')status=result('unknown',['verification_unavailable']);
    else{
     // Completion needs every bound owner, including current Office/Core
     // readbacks. This remains false when an owner or its proof is unavailable.
     let complete=false;
     if(owners.storage&&owners.rows&&owners.keyFor&&owners.verify&&owners.office?.verify&&purge.officeRetired===true){
      const verified=await verifyPurgeTargets({...owners,facts:purge,key});check();
      if(!verified.revived&&!verified.pending){
       try{complete=await owners.office.verify(subject)===true&&await owners.verify(subject,purge.trash)===true;}catch{}
      }
     }
     status=result(complete?'completed':'unknown',complete?[]:['verification_unavailable']);
    }
   }
   check();
   // A second atomic projection/watermark observation catches a restored
   // database or an external-ledger advance during the absence checks.
   const assertCurrent=async()=>{const after=await journal.get(key);if(JSON.stringify(after)!==JSON.stringify(row))fail('RETENTION_READ_UNAVAILABLE');check();};
   await assertCurrent();return publish(status,assertCurrent);
  });
 }});
}
