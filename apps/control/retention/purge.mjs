/** Purge planning and execution. A plan is bound to the suppression generation it was computed under (the SUPPRESSED ledger entry),
 * to the complete canonical target set (storage versions with their classes and database artifact versions, plus database row
 * targets) and to the policy and inventory hashes; its digest is recomputed from authoritative current facts immediately before any
 * effect, and any difference, any changed eligibility, holder, hold, liability or policy, or any missing authority refuses with zero
 * deletes. Execution is disabled by default. */
import {own,data,fail,hash,subject,subjectKey,clock} from './boundary.mjs';
import {purgeEligibility,requirePurgePolicy} from './policy.mjs';
import {externalClasses,rowClasses,rowClassSubjectKind} from './inventory.mjs';
import {externalRequestClasses} from './data-classes.mjs';
import {projectionToken} from './memory-journal.mjs';
export const workflowIdentity=({tenantId,classes,objectId,versionId,policyVersion})=>hash({tenantId,classes,objectId,versionId,policyVersion});
export const rowWorkflowIdentity=({tenantId,subjectId,target,policyVersion})=>hash({tenantId,subjectId,target,policyVersion});
const hold=value=>{const h=own(data(value),['objectLockRetainUntilMs','legalHold']);if(h.objectLockRetainUntilMs!==null&&!Number.isSafeInteger(h.objectLockRetainUntilMs)||typeof h.legalHold!=='boolean')fail('RETENTION_INVALID_REQUEST');return h;};
export const stepFacts=st=>({workflowId:st.workflowId,classes:st.classes,objectId:st.objectId,versionId:st.versionId,sha256:st.sha256,artifactVersionIds:st.artifactVersionIds});
export const rowStepFacts=st=>({workflowId:st.workflowId,className:st.className,target:st.target});
/** Eligibility of this subject as a holder: every obligation on every object it binds must be clear. Used by other subjects' shared-reference checks. */
export function holderEligibility({journalState,policy,inventory,holds,liabilities,lastActivityAtMs,nowMs}){
 const reasons=new Set();if(!journalState||journalState.state!=='SUPPRESSED'){reasons.add(journalState?.state==='RELEASED'?'HOLDER_RELEASED':'HOLDER_NOT_SUPPRESSED');return {eligible:false,reasons:[...reasons]};}
 let p;try{p=requirePurgePolicy(policy);}catch{reasons.add('HOLDER_POLICY_REQUIRED');return {eligible:false,reasons:[...reasons]};}
 for(const l of liabilities??[])reasons.add('HOLDER_UNKNOWN_LIABILITY');
 for(const o of inventory.objects){for(const c of o.classes){if(externalClasses.includes(c))continue;for(const r of purgeEligibility({policy:p,className:c,suppressedAtMs:journalState.suppressedAtMs,lastActivityAtMs,nowMs}).reasons)reasons.add('HOLDER_'+r);}
  const h=hold(holds(o));if(h.legalHold)reasons.add('HOLDER_LEGAL_HOLD');if(h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs)reasons.add('HOLDER_OBJECT_LOCK');}
 return {eligible:reasons.size===0,reasons:[...reasons].sort()};
}
/** The canonical digest covers the subject, the suppression generation, policy and inventory hashes and every target. */
export const planDigest=plan=>hash({subject:plan.subject,suppression:plan.suppression,policySha256:plan.policySha256,inventorySha256:plan.inventorySha256,steps:plan.steps,rowSteps:plan.rowSteps,blocks:plan.blocks,state:plan.state});
export function planPurge({subject:rawSubject,journalState,policy,inventory,shared,holds,liabilities,lastActivityAtMs,nowMs}){
 const s=subject(rawSubject),key=subjectKey(s);if(!journalState||journalState.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
 if(!Number.isSafeInteger(journalState.ledgerSequence)||typeof journalState.entrySha256!=='string')fail('RETENTION_INVALID_REQUEST');
 const p=requirePurgePolicy(policy);if(!Number.isSafeInteger(nowMs)||typeof holds!=='function'||!Array.isArray(shared)||!Array.isArray(liabilities))fail('RETENTION_INVALID_REQUEST');
 const blocks=[],steps=[],rowSteps=[];const sharedByKey=new Map(shared.map(x=>[`${x.object.objectId}@${x.object.versionId}`,x]));
 for(const l of liabilities){const v=own(data(l),['runId','kind']);blocks.push({reason:'UNKNOWN_LIABILITY',detail:v});}
 // Data owned outside Meri (memory proposals) leaves only through its owner; with no deletion port the plan stays BLOCKED naming it.
 for(const r of inventory.rows??[])if(externalRequestClasses.includes(r.className))blocks.push({reason:'EXTERNAL_DELETION_UNAVAILABLE',detail:{className:r.className,key:r.key}});
 const eligible=(className,detail)=>{const e=purgeEligibility({policy:p,className,suppressedAtMs:journalState.suppressedAtMs,lastActivityAtMs,nowMs});for(const r of e.reasons)blocks.push({reason:r,detail:{...detail,className}});return e.eligible;};
 for(const o of inventory.objects){
  const obligations=o.classes.filter(c=>!externalClasses.includes(c));if(!obligations.length)continue;
  for(const c of obligations)eligible(c,{objectId:o.objectId,versionId:o.versionId});
  const h=hold(holds(o));if(h.legalHold)blocks.push({reason:'LEGAL_HOLD',detail:{objectId:o.objectId,versionId:o.versionId}});
  if(h.objectLockRetainUntilMs!==null&&h.objectLockRetainUntilMs>nowMs)blocks.push({reason:'OBJECT_LOCK',detail:{objectId:o.objectId,versionId:o.versionId,retainUntilMs:h.objectLockRetainUntilMs}});
  const sh=sharedByKey.get(`${o.objectId}@${o.versionId}`);if(sh){blocks.push({reason:'SHARED_REFERENCE',detail:{objectId:o.objectId,versionId:o.versionId,heldBy:sh.heldBy,blocking:sh.blocking}});continue;}
  steps.push({workflowId:workflowIdentity({tenantId:s.tenantId,classes:obligations,objectId:o.objectId,versionId:o.versionId,policyVersion:p.version}),classes:obligations,objectId:o.objectId,versionId:o.versionId,sha256:o.sha256,artifactVersionIds:o.artifactVersionIds});
 }
 // A row target owned by another subject kind (an artifact version enumerated under its conversation) blocks the whole plan: no
 // byte is deleted on the strength of a row deletion the row owner will refuse, and the target stays visible until it is purged
 // under its own authorized subject and leaves this subject's inventory.
 for(const t of inventory.rowTargets??[]){if(!rowClasses.includes(t.className))fail('RETENTION_INVALID_REQUEST');
  if(rowClassSubjectKind[t.className]!==s.kind)blocks.push({reason:'ROW_TARGET_SUBJECT_MISMATCH',detail:{className:t.className,target:t,subjectKind:s.kind,requiredSubjectKind:rowClassSubjectKind[t.className]}});
  eligible(t.className,{target:t});rowSteps.push({workflowId:rowWorkflowIdentity({tenantId:s.tenantId,subjectId:s.subjectId,target:t,policyVersion:p.version}),className:t.className,target:t});}
 const unique=[...new Map(steps.map(st=>[st.workflowId,st])).values()].sort((a,b)=>a.workflowId.localeCompare(b.workflowId)),uniqueRows=[...new Map(rowSteps.map(st=>[st.workflowId,st])).values()].sort((a,b)=>a.workflowId.localeCompare(b.workflowId));
 const plan={subject:s,subjectKey:key,suppression:{ledgerSequence:journalState.ledgerSequence,entrySha256:journalState.entrySha256},policyId:p.policyId,policyVersion:p.version,policySha256:p.policySha256,inventorySha256:inventory.inventorySha256,steps:unique,rowSteps:uniqueRows,blocks,state:blocks.length?'BLOCKED':'PLANNED',plannedAtMs:nowMs};
 return Object.freeze({...plan,planSha256:planDigest(plan)});
}
const planFields=['subject','subjectKey','suppression','policyId','policyVersion','policySha256','inventorySha256','steps','rowSteps','blocks','state','plannedAtMs','planSha256'];
/** Validates a claimed plan's shape and recomputes its digest from its own contents: a changed target under an unchanged claimed hash refuses. */
export function verifyPlanDigest(plan){const p=own(data(plan),planFields);if(planDigest(p)!==p.planSha256)fail('RETENTION_PLAN_DIGEST_REFUSED');return p;}
/** Authoritative current recomputation through the fact ports; any unavailable port or failure is a refusal, never a cleared block. */
export async function recomputePlan(facts,subjectValue,journalState,nowMs){
 if(typeof facts?.policy!=='function'||typeof facts?.inventoryFor!=='function'||typeof facts?.sharedFor!=='function'||typeof facts?.holds!=='function'||typeof facts?.liabilities!=='function'||typeof facts?.lastActivityFor!=='function')fail('RETENTION_AUTHORITY_UNAVAILABLE');
 let policy,inventory,shared,liabilities,lastActivityAtMs;
 try{policy=await facts.policy(subjectValue);inventory=await facts.inventoryFor(subjectValue);shared=await facts.sharedFor(subjectValue,inventory);liabilities=await facts.liabilities(subjectValue);lastActivityAtMs=await facts.lastActivityFor(subjectValue);}catch{fail('RETENTION_AUTHORITY_UNAVAILABLE');}
 if(!inventory||!Array.isArray(shared)||!Array.isArray(liabilities)||!Number.isSafeInteger(lastActivityAtMs))fail('RETENTION_AUTHORITY_UNAVAILABLE');
 const holds=o=>{try{return facts.holds(o);}catch{fail('RETENTION_AUTHORITY_UNAVAILABLE');}};
 return planPurge({subject:subjectValue,journalState,policy,inventory,shared,holds,liabilities,lastActivityAtMs,nowMs});
}
/** `rows` is the database-row purge port: `preflight(subjectKey, plan)` validates every row target against the row owner's routing
 * without any effect, `purge(subjectKey, plan)` deletes every row target inside one transaction that first records the exact targets
 * under the subject lock, returning one record per row step, and `present(subjectKey, rowStepFacts)` answers whether a target row
 * exists. It is required before any effect when the plan carries row targets. */
export function createPurgeExecutor({storage,ledger,journal,keyFor,facts,serving,rows=null,enabled=false,now}){
 if(typeof storage?.deleteVersion!=='function'||typeof storage?.headVersion!=='function'||typeof ledger?.append!=='function'||typeof journal?.get!=='function'||typeof journal?.set!=='function'||typeof keyFor!=='function'||typeof serving?.isEnabled!=='function'||typeof enabled!=='boolean'||typeof facts!=='object'||facts===null||rows!==null&&(typeof rows?.purge!=='function'||typeof rows?.preflight!=='function'))fail('RETENTION_CONFIGURATION');const tick=clock(now);
 const barrier=()=>{if(!serving.isEnabled())fail('RETENTION_RECOVERY_BARRIER');};
 const cas=async(key,row,expected)=>{try{await journal.set(key,row,{expected});}catch(error){if(error?.code==='RETENTION_STALE_WRITE')fail('RETENTION_STALE_WRITE');serving.disable?.();throw Object.assign(new Error('RETENTION_PROJECTION_FAILED'),{code:'RETENTION_PROJECTION_FAILED',cause:error});}};
 /** Current authority gate before any effect: barrier open, row SUPPRESSED under the plan's suppression generation, and the authoritative
  * recomputation equal to the claimed canonical digest. */
 async function authorize(p){barrier();const current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');
  if(current.ledgerSequence!==p.suppression.ledgerSequence||current.entrySha256!==p.suppression.entrySha256)fail('RETENTION_SUPPRESSION_GENERATION_REFUSED');
  const recomputed=await recomputePlan(facts,p.subject,current,tick());if(recomputed.state!=='PLANNED')fail('RETENTION_PURGE_BLOCKED');if(recomputed.planSha256!==p.planSha256)fail('RETENTION_PLAN_DIGEST_REFUSED');return current;}
 /** Every target is resolved and validated before anything is recorded or deleted: the storage delete permission, every object key, and
  * every database row target through the row owner's own routing. One invalid target refuses the whole plan with zero effects. */
 async function preflight(p){
  if(storage.permissions!==undefined&&storage.permissions?.deleteObjectVersion!==true)fail('RETENTION_STORAGE_PERMISSION');
  const keys=new Map();for(const st of p.steps){let key;try{key=keyFor(st);}catch{fail('RETENTION_INVALID_REQUEST');}if(typeof key!=='string'||!key||key.length>1024)fail('RETENTION_INVALID_REQUEST');keys.set(st.workflowId,key);}
  if(p.rowSteps.length){try{await rows.preflight(p.subjectKey,p);}catch(error){fail(String(error?.code??'').startsWith('RETENTION_')?error.code:'RETENTION_ROW_PURGE_UNAVAILABLE');}}
  return keys;}
 /** Fails closed before touching any state when execution is not enabled; production stays disabled until policy, bindings and authorization exist.
  * Once effects may have begun, every step is durably UNKNOWN before its effect and carries its outcome after it: a ledger PURGE_UNKNOWN
  * entry precedes the first effect, the projection marks each step started, and an exception records what is known before it is rethrown,
  * so neither a thrown step nor a lost process is ever read back as done (recovery re-verifies every step of a PURGE_UNKNOWN entry). */
 async function execute(plan){
  if(!enabled)fail('RETENTION_PURGE_DISABLED');const p=verifyPlanDigest(plan);if(p.state!=='PLANNED')fail('RETENTION_PURGE_BLOCKED');if(p.rowSteps.length&&!rows)fail('RETENTION_ROW_PURGE_UNAVAILABLE');
  const current=await authorize(p);
  const existing=current.purge??null;if(existing&&existing.planSha256!==p.planSha256)fail('RETENTION_PURGE_PLAN_MISMATCH');if(existing?.state==='EXECUTED')return Object.freeze({...existing,replayed:true});
  const keys=await preflight(p);
  const stepState=new Map((existing?.steps??[]).map(st=>[st.workflowId,st])),rowState=new Map((existing?.rowSteps??[]).map(st=>[st.workflowId,st]));
  let sequence=existing?.ledgerSequence??null,started=existing?.state==='UNKNOWN';
  if(!existing){const e=await ledger.append({subject:p.subject,state:'PURGE_PLANNED',facts:{planSha256:p.planSha256,suppression:p.suppression,policySha256:p.policySha256,inventorySha256:p.inventorySha256,steps:p.steps.map(stepFacts),rowSteps:p.rowSteps.map(rowStepFacts)}});const row={...current,purge:{state:'PLANNED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[],rowSteps:[]}};await cas(p.subjectKey,row,projectionToken(current));sequence=e.sequence;}
  const outcomeFacts=()=>({planSha256:p.planSha256,suppression:p.suppression,policySha256:p.policySha256,inventorySha256:p.inventorySha256,steps:p.steps.map(st=>{const r=stepState.get(st.workflowId);return {...stepFacts(st),state:r?.state??'PENDING',readback:r?.readback?.outcome??null,reason:r?.readback?.reason??null};}),rowSteps:p.rowSteps.map(st=>({...rowStepFacts(st),state:rowState.get(st.workflowId)?.state??'PENDING'}))});
  const purgeRow=state=>({state,planSha256:p.planSha256,ledgerSequence:sequence,steps:[...stepState.values()],rowSteps:[...rowState.values()]});
  /** Immediately before an irreversible effect: re-authorize, record that effects have begun (once, ledger first), then project the
   * steps about to run as UNKNOWN on the row the authorization read. */
  async function begin(mark){const cur=await authorize(p);
   if(!started){const e=await ledger.append({subject:p.subject,state:'PURGE_UNKNOWN',reason:'EFFECTS_STARTED',facts:outcomeFacts()});started=true;sequence=e.sequence;}
   mark();await cas(p.subjectKey,{...cur,purge:purgeRow('UNKNOWN')},projectionToken(cur));}
  try{
   let unknown=null;
   for(const st of p.steps){const done=stepState.get(st.workflowId);if(done?.state==='EXECUTED')continue;
    const key=keys.get(st.workflowId);await begin(()=>stepState.set(st.workflowId,{...st,requested:null,readback:null,state:'UNKNOWN',startedAtMs:tick()}));
    const requested=await storage.deleteVersion({key,versionId:st.versionId});const readback=await storage.headVersion({key,versionId:st.versionId});
    const record={...st,requested,readback,state:readback.outcome==='ABSENT'?'EXECUTED':'UNKNOWN',atMs:tick()};stepState.set(st.workflowId,record);
    if(record.state!=='EXECUTED'){unknown=record;break;}}
   // Database row targets are deleted last, in one transaction that records the exact targets under the subject lock (the trigger
   // amendments admit nothing else), after the same re-authorization; a row that is still present afterwards leaves the purge UNKNOWN.
   const pendingRows=p.rowSteps.filter(st=>rowState.get(st.workflowId)?.state!=='EXECUTED');
   if(!unknown&&pendingRows.length){await begin(()=>{for(const st of pendingRows)rowState.set(st.workflowId,{...rowStepFacts(st),state:'UNKNOWN',deleted:null,startedAtMs:tick()});});
    const records=data(await rows.purge(p.subjectKey,p));if(!Array.isArray(records))fail('RETENTION_ROW_PURGE_UNAVAILABLE');const returned=new Set();
    for(const r of records){const st=p.rowSteps.find(x=>x.workflowId===r.workflowId);if(!st||!['EXECUTED','UNKNOWN'].includes(r.state))fail('RETENTION_ROW_PURGE_UNAVAILABLE');returned.add(st.workflowId);rowState.set(st.workflowId,{...rowStepFacts(st),state:r.state,deleted:r.deleted??null,atMs:tick()});}
    for(const st of pendingRows)if(!returned.has(st.workflowId))fail('RETENTION_ROW_PURGE_UNAVAILABLE');
    unknown=[...rowState.values()].find(r=>r.state!=='EXECUTED')??null;}
   const state=unknown?'UNKNOWN':'EXECUTED';
   const e=await ledger.append({subject:p.subject,state:unknown?'PURGE_UNKNOWN':'PURGE_EXECUTED',facts:outcomeFacts()});sequence=e.sequence;
   const latest=await journal.get(p.subjectKey);if(!latest||latest.state!=='SUPPRESSED'||latest.purge?.planSha256!==p.planSha256||latest.ledgerSequence!==p.suppression.ledgerSequence)fail('RETENTION_STALE_WRITE');
   const purge=purgeRow(state);await cas(p.subjectKey,{...latest,purge},projectionToken(latest));return Object.freeze({...purge,replayed:false});
  }catch(error){if(started)await recordUncertain(error);throw error;}
  /** Best effort after effects may have begun: the outcome known so far is appended as PURGE_UNKNOWN and projected. If either write fails,
   * the earlier EFFECTS_STARTED entry and the per-step UNKNOWN markers still stand; the original failure is what the caller sees. */
  async function recordUncertain(error){try{
   const e=await ledger.append({subject:p.subject,state:'PURGE_UNKNOWN',reason:String(error?.code??'RETENTION_EFFECT_FAILED').slice(0,1024),facts:outcomeFacts()});sequence=e.sequence;
   const latest=await journal.get(p.subjectKey);if(latest?.state==='SUPPRESSED'&&latest.purge?.planSha256===p.planSha256&&latest.ledgerSequence===p.suppression.ledgerSequence)await cas(p.subjectKey,{...latest,purge:purgeRow('UNKNOWN')},projectionToken(latest));
  }catch{}}
 }
 /** A BLOCKED plan is recorded (ledger first, with its complete targets and reasons) so a restore can re-evaluate it; recording a block is not execution. */
 async function recordBlocked(plan){
  const p=verifyPlanDigest(plan);if(p.state!=='BLOCKED')fail('RETENTION_INVALID_REQUEST');barrier();
  const current=await journal.get(p.subjectKey);if(!current||current.state!=='SUPPRESSED')fail('RETENTION_NOT_SUPPRESSED');if(current.ledgerSequence!==p.suppression.ledgerSequence)fail('RETENTION_SUPPRESSION_GENERATION_REFUSED');if(current.purge?.state==='EXECUTED')fail('RETENTION_PURGE_PLAN_MISMATCH');
  if(current.purge?.state==='BLOCKED'&&current.purge.planSha256===p.planSha256)return Object.freeze({...current.purge,replayed:true});
  const e=await ledger.append({subject:p.subject,state:'PURGE_BLOCKED',facts:{planSha256:p.planSha256,suppression:p.suppression,policySha256:p.policySha256,inventorySha256:p.inventorySha256,blocked:p.blocks,steps:p.steps.map(stepFacts),rowSteps:p.rowSteps.map(rowStepFacts)}});
  const purge={state:'BLOCKED',planSha256:p.planSha256,ledgerSequence:e.sequence,steps:[],rowSteps:[],blocked:p.blocks};await cas(p.subjectKey,{...current,purge},projectionToken(current));return Object.freeze({...purge,replayed:false});
 }
 return Object.freeze({execute,recordBlocked,authorize,enabled});
}
