/** Recovery after a database or bucket restore: serving is disabled, the ledger is replayed in order, the latest state of every subject
 * is rebuilt from the ledger's complete facts (never from the possibly stale projection), purge receipts are re-verified against the
 * store, every historical block is re-evaluated against current facts and a usable plan is regenerated through ordinary planning when
 * the block clears, and serving resumes only when every subject has been reconciled. Idempotent. */
import {fail,subjectKey,clock} from './boundary.mjs';
import {planPurge} from './purge.mjs';
export function createServingGate(){let enabled=true;return Object.freeze({disable(){enabled=false;},enable(){enabled=true;},isEnabled:()=>enabled});}
export function createRecoveryReconciler({ledger,journal,storage,serving,keyFor,holds,liabilities,policy=null,inventoryFor=null,sharedFor=null,lastActivityFor=null,now}){
 if(typeof ledger?.replay!=='function'||typeof journal?.get!=='function'||typeof storage?.headVersion!=='function'||typeof serving?.disable!=='function'||typeof keyFor!=='function'||typeof holds!=='function'||typeof liabilities!=='function')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const stepRow=f=>({workflowId:f.workflowId,classes:f.classes,objectId:f.objectId,versionId:f.versionId,sha256:f.sha256});
 /** Current-facts re-planning for a historically blocked subject; absent ports leave the block in place (never a silent clear). */
 async function replan(subject,nowMs){if(typeof policy!=='function'||typeof inventoryFor!=='function'||typeof lastActivityFor!=='function')return null;const js=await journal.get(subjectKey(subject));if(!js||js.state!=='SUPPRESSED')return null;const inventory=await inventoryFor(subject);const shared=typeof sharedFor==='function'?await sharedFor(subject,inventory):[];
  try{return planPurge({subject,journalState:js,policy:await policy(subject),inventory,shared,holds,liabilities:await liabilities(subject),lastActivityAtMs:await lastActivityFor(subject),nowMs});}catch(error){return {state:'BLOCKED',blocks:[{reason:String(error?.code??'RETENTION_PLAN_REFUSED'),detail:{}}],steps:[],planSha256:null};}}
 async function reconcile({nowMs=tick()}={}){
  serving.disable();const entries=await ledger.replay();const bySubject=new Map();for(const e of entries){const k=subjectKey(e.subject);if(!bySubject.has(k))bySubject.set(k,[]);bySubject.get(k).push(e);}
  const report={subjects:0,reapplied:[],verified:[],replanned:[],unknown:[],released:[],stillBlocked:[]};
  for(const [key,history] of bySubject){report.subjects++;const latest=history.at(-1),current=await journal.get(key);const suppression=[...history].reverse().find(e=>['SUPPRESSED','RELEASED'].includes(e.state));
   const write=async row=>{if(JSON.stringify(current)===JSON.stringify(row))return;await journal.set(key,row);};
   if(suppression?.state==='RELEASED'&&latest.state==='RELEASED'){const row={state:'RELEASED',ownerActorId:latest.subject.ownerActorId,releasedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,purge:null};if(!current||current.state!=='RELEASED'||current.ledgerSequence!==suppression.sequence){await write(row);report.released.push(key);}continue;}
   if(suppression?.state!=='SUPPRESSED')continue;
   const base={state:'SUPPRESSED',ownerActorId:latest.subject.ownerActorId,suppressedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,outstandingAccess:suppression.facts.outstandingAccess,cancelled:suppression.facts.cancelled??[],purge:null};
   if(!current||current.state!=='SUPPRESSED'||current.ledgerSequence!==suppression.sequence)report.reapplied.push(key);
   const purgeEntries=history.filter(e=>e.sequence>suppression.sequence&&e.state.startsWith('PURGE_'));const last=purgeEntries.at(-1);let row=base;
   if(last){const planSha256=last.facts.planSha256,facts=last.facts.steps??[];
    if(last.state==='PURGE_BLOCKED'){const plan=await replan(latest.subject,nowMs);
     if(plan&&plan.state==='PLANNED'){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:'RECONCILED_BLOCK_CLEARED',facts:{planSha256:plan.planSha256,policySha256:plan.policySha256,inventorySha256:plan.inventorySha256,steps:plan.steps.map(stepRow)}});row={...base,purge:{state:'PLANNED',planSha256:plan.planSha256,ledgerSequence:e.sequence,steps:[]}};report.replanned.push(key);}
     else{const reasons=plan?plan.blocks:(last.facts.blocked??[]);row={...base,purge:{state:'BLOCKED',planSha256,ledgerSequence:last.sequence,steps:[],blocked:reasons}};report.stillBlocked.push(key);}}
    else if(last.state==='PURGE_PLANNED'){row={...base,purge:{state:'PLANNED',planSha256,ledgerSequence:last.sequence,steps:[]}};}
    else{const verified=[];let revived=false,pending=false;
     for(const f of facts){const target=stepRow(f);if(f.state!=='EXECUTED'&&f.state!=='UNKNOWN'&&f.state!=='PENDING')fail('RETENTION_LEDGER_CORRUPT');
      const readback=await storage.headVersion({key:keyFor(target),versionId:target.versionId});const state=readback.outcome==='ABSENT'?'EXECUTED':readback.outcome==='PRESENT'?'REVIVED':'UNKNOWN';if(state==='REVIVED')revived=true;if(state==='UNKNOWN')pending=true;verified.push({...target,readback,state});}
     if(revived){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:'RESTORE_REVIVED_VERSION',facts:{planSha256,policySha256:last.facts.policySha256??null,inventorySha256:last.facts.inventorySha256??null,steps:facts.map(stepRow)}});row={...base,purge:{state:'PLANNED',planSha256,ledgerSequence:e.sequence,steps:verified.filter(v=>v.state==='EXECUTED')}};report.replanned.push(key);}
     else{row={...base,purge:{state:pending?'UNKNOWN':'EXECUTED',planSha256,ledgerSequence:last.sequence,steps:verified}};(pending?report.unknown:report.verified).push(key);}}}
   await write(row);}
  serving.enable();return Object.freeze({...report,completedAtMs:tick(),servingEnabled:serving.isEnabled()});
 }
 return Object.freeze({reconcile});
}
