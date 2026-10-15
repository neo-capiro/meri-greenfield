/** Recovery after a database or bucket restore. Serving is disabled; the pass runs under the journal's exclusive recovery lock, so every
 * in-flight transition completes first and none interleaves; the ledger is replayed in order and the latest state of every subject is
 * rebuilt from the ledger's complete facts with compare-and-set writes; purge receipts are re-verified against the store; historical
 * PLANNED and BLOCKED plans are both re-planned through ordinary planning from authoritative current facts (an unavailable authority
 * keeps the block); the ledger watermark is re-read after the writes and the pass repeats until nothing new arrived; only then does
 * serving reopen. Idempotent. */
import {fail,subjectKey,clock} from './boundary.mjs';
import {recomputePlan,stepFacts,rowStepFacts} from './purge.mjs';
import {projectionToken} from './memory-journal.mjs';
export function createServingGate(){let enabled=true;return Object.freeze({disable(){enabled=false;},enable(){enabled=true;},isEnabled:()=>enabled});}
export function createRecoveryReconciler({ledger,journal,storage,serving,keyFor,facts,rows=null,now,maxPasses=8}){
 if(typeof ledger?.replay!=='function'||typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof journal?.exclusive!=='function'||typeof storage?.headVersion!=='function'||typeof serving?.disable!=='function'||typeof keyFor!=='function'||typeof facts!=='object'||facts===null||rows!==null&&typeof rows?.present!=='function'||!Number.isSafeInteger(maxPasses)||maxPasses<1)fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const stepRow=f=>({workflowId:f.workflowId,classes:f.classes,objectId:f.objectId,versionId:f.versionId,sha256:f.sha256,artifactVersionIds:f.artifactVersionIds??[]});
 /** Current-facts re-planning; any unavailable authority returns a BLOCKED result naming it (never a cleared block). */
 async function replan(subjectValue,journalState,nowMs){try{return await recomputePlan(facts,subjectValue,journalState,nowMs);}catch(error){return {state:'BLOCKED',blocks:[{reason:String(error?.code??'RETENTION_AUTHORITY_UNAVAILABLE'),detail:{}}],steps:[],rowSteps:[],planSha256:null};}}
 async function pass(report,nowMs){
  const entries=await ledger.replay();const bySubject=new Map();for(const e of entries){const k=subjectKey(e.subject);if(!bySubject.has(k))bySubject.set(k,[]);bySubject.get(k).push(e);}
  for(const [key,history] of bySubject){const latest=history.at(-1),current=await journal.get(key,{exclusive:true}),expected=projectionToken(current);const suppression=[...history].reverse().find(e=>['SUPPRESSED','RELEASED'].includes(e.state));
   const write=async row=>{if(JSON.stringify(current)===JSON.stringify(row))return;await journal.set(key,row,{expected,exclusive:true});};
   if(suppression?.state==='RELEASED'&&latest.state==='RELEASED'){const row={state:'RELEASED',ownerActorId:latest.subject.ownerActorId,releasedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,purge:null};if(!current||current.state!=='RELEASED'||current.ledgerSequence!==suppression.sequence){await write(row);report.released.push(key);}continue;}
   if(suppression?.state!=='SUPPRESSED')continue;
   const base={state:'SUPPRESSED',ownerActorId:latest.subject.ownerActorId,suppressedAtMs:suppression.atMs,ledgerSequence:suppression.sequence,entrySha256:suppression.entrySha256,authorization:suppression.facts.authorization,outstandingAccess:suppression.facts.outstandingAccess,cancelled:suppression.facts.cancelled??[],purge:null};
   if(!current||current.state!=='SUPPRESSED'||current.ledgerSequence!==suppression.sequence)report.reapplied.push(key);
   const purgeEntries=history.filter(e=>e.sequence>suppression.sequence&&e.state.startsWith('PURGE_'));const last=purgeEntries.at(-1);let row=base;
   if(last){const planSha256=last.facts.planSha256,factsSteps=last.facts.steps??[];
    if(last.state==='PURGE_BLOCKED'||last.state==='PURGE_PLANNED'){
     // Historical targets are never restored as-is: eligibility is recomputed from current facts under the current suppression generation.
     const plan=await replan(latest.subject,base,nowMs);
     if(plan.state==='PLANNED'){if(plan.planSha256!==planSha256){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:last.state==='PURGE_BLOCKED'?'RECONCILED_BLOCK_CLEARED':'RECONCILED_REPLANNED',facts:{planSha256:plan.planSha256,suppression:plan.suppression,policySha256:plan.policySha256,inventorySha256:plan.inventorySha256,steps:plan.steps.map(stepFacts),rowSteps:plan.rowSteps.map(rowStepFacts)}});row={...base,purge:{state:'PLANNED',planSha256:plan.planSha256,ledgerSequence:e.sequence,steps:[],rowSteps:[]}};report.replanned.push(key);}else row={...base,purge:{state:'PLANNED',planSha256,ledgerSequence:last.sequence,steps:[],rowSteps:[]}};}
     else{row={...base,purge:{state:'BLOCKED',planSha256:plan.planSha256??planSha256,ledgerSequence:last.sequence,steps:[],rowSteps:[],blocked:plan.blocks}};report.stillBlocked.push(key);}}
    else{const verified=[];let revived=false,pending=false;
     for(const f of factsSteps){const target=stepRow(f);if(!['EXECUTED','UNKNOWN','PENDING'].includes(f.state))fail('RETENTION_LEDGER_CORRUPT');
      const readback=await storage.headVersion({key:keyFor(target),versionId:target.versionId});const state=readback.outcome==='ABSENT'?'EXECUTED':readback.outcome==='PRESENT'?'REVIVED':'UNKNOWN';if(state==='REVIVED')revived=true;if(state==='UNKNOWN')pending=true;verified.push({...target,readback,state});}
     // Database row targets recorded as deleted are re-verified too: a restored row is a revival; an unverifiable one stays UNKNOWN.
     const verifiedRows=[];for(const f of last.facts.rowSteps??[]){if(!['EXECUTED','UNKNOWN','PENDING'].includes(f.state))fail('RETENTION_LEDGER_CORRUPT');const target={workflowId:f.workflowId,className:f.className,target:f.target};
      if(!rows){pending=true;verifiedRows.push({...target,state:'UNKNOWN'});continue;}let present;try{present=await rows.present(key,target);}catch{present=null;}
      const state=present===false?'EXECUTED':present===true?'REVIVED':'UNKNOWN';if(state==='REVIVED')revived=true;if(state==='UNKNOWN')pending=true;verifiedRows.push({...target,state});}
     if(revived){const plan=await replan(latest.subject,base,nowMs);
      if(plan.state==='PLANNED'){const e=await ledger.append({subject:latest.subject,state:'PURGE_PLANNED',reason:'RESTORE_REVIVED_VERSION',facts:{planSha256:plan.planSha256,suppression:plan.suppression,policySha256:plan.policySha256,inventorySha256:plan.inventorySha256,steps:plan.steps.map(stepFacts),rowSteps:plan.rowSteps.map(rowStepFacts)}});row={...base,purge:{state:'PLANNED',planSha256:plan.planSha256,ledgerSequence:e.sequence,steps:[],rowSteps:[]}};report.replanned.push(key);}
      else{row={...base,purge:{state:'BLOCKED',planSha256:plan.planSha256??planSha256,ledgerSequence:last.sequence,steps:[],rowSteps:[],blocked:plan.blocks}};report.stillBlocked.push(key);}}
     else{row={...base,purge:{state:pending?'UNKNOWN':'EXECUTED',planSha256,ledgerSequence:last.sequence,steps:verified,rowSteps:verifiedRows}};(pending?report.unknown:report.verified).push(key);}}}
   await write(row);}
  return entries.length;
 }
 async function reconcile({nowMs=tick()}={}){
  serving.disable();
  return journal.exclusive(async()=>{const report={subjects:0,reapplied:[],verified:[],replanned:[],unknown:[],released:[],stillBlocked:[],passes:0};
   let watermark=-1;for(let i=0;i<maxPasses;i++){const before=(await ledger.replay()).length;report.passes++;await pass(report,nowMs);const after=(await ledger.replay()).length;watermark=after;if(after===before){serving.enable();return Object.freeze({...report,subjects:new Set([...report.reapplied,...report.verified,...report.replanned,...report.unknown,...report.released,...report.stillBlocked]).size,watermark,completedAtMs:tick(),servingEnabled:true});}}
   fail('RETENTION_RECOVERY_UNSETTLED');});
 }
 return Object.freeze({reconcile});
}
