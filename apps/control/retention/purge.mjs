/** Purge planning (deterministic, idempotent identities; every block named) and the execution gate, disabled by default. Execution
 * deletes exact versions and marks a step executed only after a readback classified ABSENT; ambiguity leaves PURGE_UNKNOWN. */
import {own,data,fail,hash,subject,subjectKey,clock,text} from './boundary.mjs';
import {purgeEligibility,requirePurgePolicy} from './policy.mjs';
import {externalClasses} from './inventory.mjs';
export const workflowIdentity=({tenantId,className,objectId,versionId,policyVersion})=>hash({tenantId,className,objectId,versionId,policyVersion});
const hold=value=>{const h=own(data(value),['objectLockRetainUntilMs','legalHold']);if(h.objectLockRetainUntilMs!==null&&!Number.isSafeInteger(h.objectLockRetainUntilMs)||typeof h.legalHold!=='boolean')fail('RETENTION_INVALID_REQUEST');return h;};
export function planPurge({subject:rawSubject,journalState,policy,inventory,shared,holds,liabilities,lastActivityAtMs,nowMs}){
 const s=subject(rawSubject),key=subjectKey(s);if(!journalState||journalState.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
 const p=requirePurgePolicy(policy);if(!Number.isSafeInteger(nowMs))fail('RETENTION_INVALID_REQUEST');
 const blocks=[],steps=[];const sharedKeys=new Set((shared??[]).map(x=>`${x.object.objectId}@${x.object.versionId}`));
 for(const l of liabilities??[]){const v=own(data(l),['runId','kind']);blocks.push({reason:'UNKNOWN_LIABILITY',detail:v});}
 for(const o of inventory.objects){
  if(externalClasses.includes(o.className))continue;
  const e=purgeEligibility({policy:p,className:o.className,suppressedAtMs:journalState.suppressedAtMs,lastActivityAtMs,nowMs});
  for(const r of e.reasons)blocks.push({reason:r,detail:{objectId:o.objectId,versionId:o.versionId,className:o.className}});
  const h=hold(holds(o));if(h.legalHold)blocks.push({reason:'LEGAL_HOLD',detail:{objectId:o.objectId,versionId:o.versionId}});
  if(h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs)blocks.push({reason:'OBJECT_LOCK',detail:{objectId:o.objectId,versionId:o.versionId,retainUntilMs:h.objectLockRetainUntilMs}});
  if(sharedKeys.has(`${o.objectId}@${o.versionId}`)){blocks.push({reason:'SHARED_REFERENCE',detail:{objectId:o.objectId,versionId:o.versionId,heldBy:(shared??[]).find(x=>x.object.objectId===o.objectId&&x.object.versionId===o.versionId).heldBy}});continue;}
  steps.push({workflowId:workflowIdentity({tenantId:s.tenantId,className:o.className,objectId:o.objectId,versionId:o.versionId,policyVersion:p.version}),className:o.className,objectId:o.objectId,versionId:o.versionId,sha256:o.sha256});
 }
 const unique=new Map(steps.map(st=>[st.workflowId,st]));
 const plan={subject:s,subjectKey:key,policyId:p.policyId,policyVersion:p.version,policySha256:p.policySha256,inventorySha256:inventory.inventorySha256,steps:[...unique.values()],blocks,state:blocks.length?'BLOCKED':'PLANNED',plannedAtMs:nowMs};
 return Object.freeze({...plan,planSha256:hash({...plan,plannedAtMs:undefined})});
}
export function createPurgeExecutor({storage,ledger,journal,keyFor,enabled=false,now}){
 if(typeof storage?.deleteVersion!=='function'||typeof storage?.headVersion!=='function'||typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof keyFor!=='function'||typeof enabled!=='boolean')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 /** Fails closed before touching any state when execution is not enabled; production stays disabled until policy, bindings and authorization exist. */
 async function execute(plan){
  if(!enabled)fail('RETENTION_PURGE_DISABLED');const p=own(data(plan),['subject','subjectKey','policyId','policyVersion','policySha256','inventorySha256','steps','blocks','state','plannedAtMs','planSha256']);
  if(p.state!=='PLANNED')fail('RETENTION_PURGE_BLOCKED');const current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
  const existing=current.purge??null;if(existing&&existing.planSha256!==p.planSha256&&existing.state!=='EXECUTED')fail('RETENTION_PURGE_PLAN_MISMATCH');if(existing?.state==='EXECUTED')return Object.freeze({...existing,replayed:true});
  const stepState=new Map((existing?.steps??[]).map(st=>[st.workflowId,st]));
  if(!existing){const e=await ledger.append({subject:p.subject,state:'PURGE_PLANNED',facts:{planSha256:p.planSha256,steps:p.steps.map(st=>st.workflowId)}});await journal.set(p.subjectKey,{...current,purge:{state:'PLANNED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[]}});}
  const receipts=[];let unknown=null;
  for(const st of p.steps){const done=stepState.get(st.workflowId);if(done?.state==='EXECUTED'){receipts.push(done);continue;}
   const key=keyFor(st),requested=await storage.deleteVersion({key,versionId:st.versionId});const readback=await storage.headVersion({key,versionId:st.versionId});
   const record={...st,requested,readback,state:readback.outcome==='ABSENT'?'EXECUTED':'UNKNOWN',atMs:tick()};receipts.push(record);stepState.set(st.workflowId,record);
   if(record.state!=='EXECUTED'){unknown=record;break;}}
  const steps=[...stepState.values()],state=unknown?'UNKNOWN':'EXECUTED';
  const e=await ledger.append({subject:p.subject,state:unknown?'PURGE_UNKNOWN':'PURGE_EXECUTED',facts:{planSha256:p.planSha256,steps:steps.map(st=>({workflowId:st.workflowId,state:st.state,readback:st.readback.outcome,reason:st.readback.reason}))}});
  const purge={state,planSha256:p.planSha256,ledgerSequence:e.sequence,steps};await journal.set(p.subjectKey,{...current,purge});return Object.freeze({...purge,replayed:false});
 }
 /** A BLOCKED plan is recorded (ledger first) so a restore can re-evaluate it; recording a block is not execution and needs no enablement. */
 async function recordBlocked(plan){
  const p=own(data(plan),['subject','subjectKey','policyId','policyVersion','policySha256','inventorySha256','steps','blocks','state','plannedAtMs','planSha256']);if(p.state!=='BLOCKED')fail('RETENTION_INVALID_REQUEST');
  const current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge?.state==='EXECUTED')fail('RETENTION_PURGE_PLAN_MISMATCH');
  if(current.purge?.state==='BLOCKED'&&current.purge.planSha256===p.planSha256)return Object.freeze({...current.purge,replayed:true});
  const e=await ledger.append({subject:p.subject,state:'PURGE_BLOCKED',facts:{planSha256:p.planSha256,blocked:p.blocks,steps:p.steps.map(st=>st.workflowId)}});
  const purge={state:'BLOCKED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[]};await journal.set(p.subjectKey,{...current,purge});return Object.freeze({...purge,replayed:false});
 }
 return Object.freeze({execute,recordBlocked,enabled});
}
