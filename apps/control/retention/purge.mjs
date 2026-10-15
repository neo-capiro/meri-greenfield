/** Purge planning (deterministic, idempotent identities; every block named; every obligation of an exact object honored) and the
 * execution gate, disabled by default. Ledger facts carry the complete target set so recovery can rebuild the projection after total
 * loss. Execution deletes exact versions and marks a step executed only after a readback classified ABSENT; ambiguity leaves
 * PURGE_UNKNOWN; replaying EXECUTED with a different plan refuses. */
import {own,data,fail,hash,subject,subjectKey,clock} from './boundary.mjs';
import {purgeEligibility,requirePurgePolicy} from './policy.mjs';
import {externalClasses} from './inventory.mjs';
import {projectionToken} from './memory-journal.mjs';
export const workflowIdentity=({tenantId,classes,objectId,versionId,policyVersion})=>hash({tenantId,classes,objectId,versionId,policyVersion});
const hold=value=>{const h=own(data(value),['objectLockRetainUntilMs','legalHold']);if(h.objectLockRetainUntilMs!==null&&!Number.isSafeInteger(h.objectLockRetainUntilMs)||typeof h.legalHold!=='boolean')fail('RETENTION_INVALID_REQUEST');return h;};
const stepFacts=st=>({workflowId:st.workflowId,classes:st.classes,objectId:st.objectId,versionId:st.versionId,sha256:st.sha256});
/** Eligibility of this subject as a holder: every obligation on every object it binds must be clear. Used by other subjects' shared-reference checks. */
export function holderEligibility({journalState,policy,inventory,holds,liabilities,lastActivityAtMs,nowMs}){
 const reasons=new Set();if(!journalState||journalState.state!=='SUPPRESSED'){reasons.add(journalState?.state==='RELEASED'?'HOLDER_RELEASED':'HOLDER_NOT_SUPPRESSED');return {eligible:false,reasons:[...reasons]};}
 let p;try{p=requirePurgePolicy(policy);}catch{reasons.add('HOLDER_POLICY_REQUIRED');return {eligible:false,reasons:[...reasons]};}
 for(const l of liabilities??[])reasons.add('HOLDER_UNKNOWN_LIABILITY');
 for(const o of inventory.objects){for(const c of o.classes){if(externalClasses.includes(c))continue;for(const r of purgeEligibility({policy:p,className:c,suppressedAtMs:journalState.suppressedAtMs,lastActivityAtMs,nowMs}).reasons)reasons.add('HOLDER_'+r);}
  const h=hold(holds(o));if(h.legalHold)reasons.add('HOLDER_LEGAL_HOLD');if(h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs)reasons.add('HOLDER_OBJECT_LOCK');}
 return {eligible:reasons.size===0,reasons:[...reasons].sort()};
}
export function planPurge({subject:rawSubject,journalState,policy,inventory,shared,holds,liabilities,lastActivityAtMs,nowMs}){
 const s=subject(rawSubject),key=subjectKey(s);if(!journalState||journalState.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
 const p=requirePurgePolicy(policy);if(!Number.isSafeInteger(nowMs))fail('RETENTION_INVALID_REQUEST');
 const blocks=[],steps=[];const sharedByKey=new Map((shared??[]).map(x=>[`${x.object.objectId}@${x.object.versionId}`,x]));
 for(const l of liabilities??[]){const v=own(data(l),['runId','kind']);blocks.push({reason:'UNKNOWN_LIABILITY',detail:v});}
 for(const o of inventory.objects){
  const obligations=o.classes.filter(c=>!externalClasses.includes(c));if(!obligations.length)continue;
  // Every class that references this exact version must be purge-eligible under its own retention and purgeability.
  for(const c of obligations){const e=purgeEligibility({policy:p,className:c,suppressedAtMs:journalState.suppressedAtMs,lastActivityAtMs,nowMs});for(const r of e.reasons)blocks.push({reason:r,detail:{objectId:o.objectId,versionId:o.versionId,className:c}});}
  const h=hold(holds(o));if(h.legalHold)blocks.push({reason:'LEGAL_HOLD',detail:{objectId:o.objectId,versionId:o.versionId}});
  if(h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs)blocks.push({reason:'OBJECT_LOCK',detail:{objectId:o.objectId,versionId:o.versionId,retainUntilMs:h.objectLockRetainUntilMs}});
  const sh=sharedByKey.get(`${o.objectId}@${o.versionId}`);if(sh){blocks.push({reason:'SHARED_REFERENCE',detail:{objectId:o.objectId,versionId:o.versionId,heldBy:sh.heldBy,blocking:sh.blocking}});continue;}
  steps.push({workflowId:workflowIdentity({tenantId:s.tenantId,classes:obligations,objectId:o.objectId,versionId:o.versionId,policyVersion:p.version}),classes:obligations,objectId:o.objectId,versionId:o.versionId,sha256:o.sha256});
 }
 const unique=[...new Map(steps.map(st=>[st.workflowId,st])).values()].sort((a,b)=>a.workflowId.localeCompare(b.workflowId));
 const plan={subject:s,subjectKey:key,policyId:p.policyId,policyVersion:p.version,policySha256:p.policySha256,inventorySha256:inventory.inventorySha256,steps:unique,blocks,state:blocks.length?'BLOCKED':'PLANNED',plannedAtMs:nowMs};
 return Object.freeze({...plan,planSha256:hash({...plan,plannedAtMs:undefined})});
}
export function createPurgeExecutor({storage,ledger,journal,keyFor,enabled=false,now}){
 if(typeof storage?.deleteVersion!=='function'||typeof storage?.headVersion!=='function'||typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof keyFor!=='function'||typeof enabled!=='boolean')fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const planOf=plan=>own(data(plan),['subject','subjectKey','policyId','policyVersion','policySha256','inventorySha256','steps','blocks','state','plannedAtMs','planSha256']);
 const cas=async(key,row,expected)=>{try{await journal.set(key,row,{expected});}catch(error){fail(error?.code==='RETENTION_STALE_WRITE'?'RETENTION_STALE_WRITE':'RETENTION_PROJECTION_FAILED');}};
 /** Fails closed before touching any state when execution is not enabled; production stays disabled until policy, bindings and authorization exist. */
 async function execute(plan){
  if(!enabled)fail('RETENTION_PURGE_DISABLED');const p=planOf(plan);
  if(p.state!=='PLANNED')fail('RETENTION_PURGE_BLOCKED');let current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
  const existing=current.purge??null;if(existing&&existing.planSha256!==p.planSha256)fail('RETENTION_PURGE_PLAN_MISMATCH');if(existing?.state==='EXECUTED')return Object.freeze({...existing,replayed:true});
  const stepState=new Map((existing?.steps??[]).map(st=>[st.workflowId,st]));
  if(!existing){const e=await ledger.append({subject:p.subject,state:'PURGE_PLANNED',facts:{planSha256:p.planSha256,policySha256:p.policySha256,inventorySha256:p.inventorySha256,steps:p.steps.map(stepFacts)}});const row={...current,purge:{state:'PLANNED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[]}};await cas(p.subjectKey,row,projectionToken(current));current=row;}
  const receipts=[];let unknown=null;
  for(const st of p.steps){const done=stepState.get(st.workflowId);if(done?.state==='EXECUTED'){receipts.push(done);continue;}
   const key=keyFor(st),requested=await storage.deleteVersion({key,versionId:st.versionId});const readback=await storage.headVersion({key,versionId:st.versionId});
   const record={...st,requested,readback,state:readback.outcome==='ABSENT'?'EXECUTED':'UNKNOWN',atMs:tick()};receipts.push(record);stepState.set(st.workflowId,record);
   if(record.state!=='EXECUTED'){unknown=record;break;}}
  const steps=[...stepState.values()],state=unknown?'UNKNOWN':'EXECUTED';
  const e=await ledger.append({subject:p.subject,state:unknown?'PURGE_UNKNOWN':'PURGE_EXECUTED',facts:{planSha256:p.planSha256,policySha256:p.policySha256,inventorySha256:p.inventorySha256,steps:p.steps.map(st=>{const r=stepState.get(st.workflowId);return {...stepFacts(st),state:r?.state??'PENDING',readback:r?.readback?.outcome??null,reason:r?.readback?.reason??null};})}});
  const purge={state,planSha256:p.planSha256,ledgerSequence:e.sequence,steps};const latest=await journal.get(p.subjectKey);if(!latest||latest.state!=='SUPPRESSED'||latest.purge?.planSha256!==p.planSha256)fail('RETENTION_STALE_WRITE');await cas(p.subjectKey,{...latest,purge},projectionToken(latest));return Object.freeze({...purge,replayed:false});
 }
 /** A BLOCKED plan is recorded (ledger first, with its complete targets and reasons) so a restore can re-evaluate it; recording a block is not execution. */
 async function recordBlocked(plan){
  const p=planOf(plan);if(p.state!=='BLOCKED')fail('RETENTION_INVALID_REQUEST');
  const current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.purge?.state==='EXECUTED')fail('RETENTION_PURGE_PLAN_MISMATCH');
  if(current.purge?.state==='BLOCKED'&&current.purge.planSha256===p.planSha256)return Object.freeze({...current.purge,replayed:true});
  const e=await ledger.append({subject:p.subject,state:'PURGE_BLOCKED',facts:{planSha256:p.planSha256,policySha256:p.policySha256,inventorySha256:p.inventorySha256,blocked:p.blocks,steps:p.steps.map(stepFacts)}});
  const purge={state:'BLOCKED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[]};await cas(p.subjectKey,{...current,purge},projectionToken(current));return Object.freeze({...purge,replayed:false});
 }
 return Object.freeze({execute,recordBlocked,enabled});
}
