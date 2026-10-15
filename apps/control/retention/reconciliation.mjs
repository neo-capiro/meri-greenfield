/** Recovery after a database or bucket restore: serving is disabled, the ledger is replayed in order, the latest state of every subject
 * is re-applied to the journal, purge receipts are re-verified against the store, blocks are re-evaluated, and serving resumes only
 * when every subject has been reconciled. Idempotent. */
import {fail,subjectKey,clock} from './boundary.mjs';
export function createServingGate(){let enabled=true;return Object.freeze({disable(){enabled=false;},enable(){enabled=true;},isEnabled:()=>enabled});}
export function createRecoveryReconciler({ledger,journal,storage,serving,keyFor,holds,liabilities,now}){
 if(typeof ledger?.replay!=='function'||typeof journal?.get!=='function'||typeof storage?.headVersion!=='function'||typeof serving?.disable!=='function'||typeof keyFor!=='function'||typeof holds!=='function'||typeof liabilities!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 async function reconcile({nowMs=tick()}={}){
  serving.disable();const entries=await ledger.replay();const bySubject=new Map();for(const e of entries){const k=subjectKey(e.subject);if(!bySubject.has(k))bySubject.set(k,[]);bySubject.get(k).push(e);}
  const report={subjects:0,reapplied:[],verified:[],replanned:[],unknown:[],released:[]};
  for(const [key,history] of bySubject){report.subjects++;const latest=history.at(-1),current=await journal.get(key);const suppression=[...history].reverse().find(e=>['SUPPRESSED','RELEASED'].includes(e.state));
   if(suppression?.state==='RELEASED'&&latest.state==='RELEASED'){if(!current||current.state!=='RELEASED'){await journal.set(key,{state:'RELEASED',releasedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,purge:null});report.released.push(key);}continue;}
   if(suppression?.state!=='SUPPRESSED')continue;
   let row=current&&current.state==='SUPPRESSED'&&current.ledgerSequence===suppression.sequence?{...current}:null;
   if(!row){row={state:'SUPPRESSED',suppressedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,outstandingAccess:suppression.facts.outstandingAccess,purge:null};report.reapplied.push(key);}
   const purgeEntries=history.filter(e=>e.sequence>suppression.sequence&&e.state.startsWith('PURGE_'));const last=purgeEntries.at(-1);
   if(last){const planSha256=last.facts.planSha256;const steps=row.purge?.planSha256===planSha256?[...row.purge.steps]:[];
    if(last.state==='PURGE_BLOCKED'){const cleared=!(await liabilities(latest.subject)).length&&!(last.facts.blocked??[]).some(b=>{if(b.reason==='LEGAL_HOLD'||b.reason==='OBJECT_LOCK'){const h=holds({objectId:b.detail.objectId,versionId:b.detail.versionId});return h.legalHold||h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs;}return true;});
     row.purge={state:cleared?'PLANNED':'BLOCKED',planSha256,ledgerSequence:last.sequence,steps};if(cleared){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:'RECONCILED_BLOCK_CLEARED',facts:{planSha256,steps:(last.facts.steps??[]).map(s=>s.workflowId??s)}});row.purge.ledgerSequence=e.sequence;report.replanned.push(key);}}
    else if(last.state==='PURGE_PLANNED'){row.purge={state:'PLANNED',planSha256,ledgerSequence:last.sequence,steps};}
    else{const verified=[];let revived=false,pending=false;
     for(const s of last.facts.steps){const known=steps.find(x=>x.workflowId===s.workflowId);const key2=known?keyFor(known):null;
      if(!known){pending=true;verified.push({workflowId:s.workflowId,state:s.state==='EXECUTED'?'EXECUTED_UNVERIFIED':'UNKNOWN'});continue;}
      const readback=await storage.headVersion({key:key2,versionId:known.versionId});const state=readback.outcome==='ABSENT'?'EXECUTED':readback.outcome==='PRESENT'?'REVIVED':'UNKNOWN';if(state==='REVIVED')revived=true;if(state==='UNKNOWN')pending=true;verified.push({...known,readback,state});}
     if(revived){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:'RESTORE_REVIVED_VERSION',facts:{planSha256,steps:verified.filter(v=>v.state==='REVIVED').map(v=>v.workflowId)}});row.purge={state:'PLANNED',planSha256,ledgerSequence:e.sequence,steps:verified.filter(v=>v.state==='EXECUTED')};report.replanned.push(key);}
     else{row.purge={state:pending?'UNKNOWN':'EXECUTED',planSha256,ledgerSequence:last.sequence,steps:verified};(pending?report.unknown:report.verified).push(key);}}}
   await journal.set(key,row);}
  serving.enable();return Object.freeze({...report,completedAtMs:tick(),servingEnabled:serving.isEnabled()});
 }
 return Object.freeze({reconcile});
}
