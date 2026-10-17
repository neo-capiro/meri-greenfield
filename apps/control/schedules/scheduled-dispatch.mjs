/** Product dispatch of one Temporal schedule firing into one conversation run, composed from the canonical owners: the schedule
 * owner's generation/state fence, the original owner's current authority, the conversation store's durable request acceptance and
 * the conversation Temporal dispatcher. Temporal's schedule is the only scheduler; this owner never fires, retries or mints a second
 * identity. Outcomes: DISPATCHED (run admitted and its workflow start acknowledged or observed), REFUSED (fenced or denied with
 * evidence; `admitted` says whether an earlier attempt already admitted the run), UNKNOWN (no evidence; blocks until reconciled).
 * Reconciliation additionally answers ADMITTED (run admitted, workflow proven never started) or NOT_DISPATCHED (run proven absent);
 * either may be completed only by dispatching the same immutable occurrence again, with every fence re-checked.
 *
 * Before its first effect an occurrence opens a durable barrier row in the schedule owner that names its exact conversation run
 * and native workflow. The row stays OPEN through UNKNOWN, so it outlives the dispatch workflow's run timeout: no later occurrence
 * of the schedule is admitted while it is open. Only evidence settles it: the run's start observed (DISPATCHED) or a fenced
 * refusal of this occurrence (REFUSED). A later firing may settle a blocking predecessor only by observing the predecessor's own
 * started run through that row; absence or an admitted-but-unstarted run keeps the barrier.
 * With the runtime's canonical jobOwner, ACTIVE also retains OPEN through running/paused/approval-waiting work. DISPATCHED then
 * requires actual same-work terminal state and proven retirement; started workflows alone never settle the job-mode barrier.
 * The original two-port low-level mode remains compatible for source-only legacy callers. */
import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {canonicalSha256,frozenScheduleData,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';
import {snapshotOccurrence,occurrenceIdentity} from './scheduled-occurrence.mjs';
import {workflowId} from '../conversations/temporal-dispatch.mjs';

const PORTS=['scheduleOwner','store','dispatcher','runs','authority','taskInstructions','versions','now','maxRequestMs','runAdmission','jobOwner'];
function optionsData(value,allowed,required=allowed) {
 if(!value||typeof value!=='object'||types.isProxy(value)||Object.getPrototypeOf(value)!==Object.prototype)denySchedule('SCHEDULE_DISPATCH_OPTIONS');
 const out={};for(const key of Reflect.ownKeys(value)){const d=Object.getOwnPropertyDescriptor(value,key);if(!allowed.includes(key)||!d.enumerable||!Object.hasOwn(d,'value'))denySchedule('SCHEDULE_DISPATCH_OPTIONS');out[key]=d.value;}
 if(required.some(k=>!Object.hasOwn(out,k)))denySchedule('SCHEDULE_DISPATCH_OPTIONS');return out;
}
const scopeKey=s=>canonicalSha256({tenantId:s.tenantId,kind:s.kind,resourceId:s.resourceId});
const resourceSet=scopes=>canonicalSha256(scopes.map(scopeKey).sort());
const exposed=code=>typeof code==='string'&&/^[A-Z][A-Z0-9_]{0,63}$/u.test(code)?code:'SCHEDULE_DISPATCH_UNKNOWN';

export function createScheduledDispatch(options) {
 const o=optionsData(options,PORTS,PORTS.slice(0,7)),now=o.now??Date.now,maxRequestMs=o.maxRequestMs??10000;
 const readFiring=sdkMethod(o.scheduleOwner,'readFiring'),openOccurrence=sdkMethod(o.scheduleOwner,'openOccurrence'),settleOccurrence=sdkMethod(o.scheduleOwner,'settleOccurrence'),accept=sdkMethod(o.store,'accept'),readOptional=sdkMethod(o.store,'readOptional');
 const start=sdkMethod(o.dispatcher,'start'),describeRun=sdkMethod(o.runs,'describe'),authorize=sdkMethod(o.authority,'authorize'),readInstruction=sdkMethod(o.taskInstructions,'read');
 const admit=o.runAdmission===undefined?null:sdkMethod(o.runAdmission,'admit');
 const inspectJob=o.jobOwner===undefined?null:sdkMethod(o.jobOwner,'inspect'),cancelJob=o.jobOwner===undefined?null:sdkMethod(o.jobOwner,'cancel');
 try{validateShape('RuntimeVersions',o.versions);}catch{denySchedule('SCHEDULE_DISPATCH_OPTIONS');}
 const versions=frozenScheduleData(o.versions);
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)denySchedule('SCHEDULE_DISPATCH_OPTIONS');

 function parse(request) {
  const {occurrence,signal}=optionsData(request,['occurrence','signal'],['occurrence']);
  if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))denySchedule('SCHEDULE_DISPATCH_OPTIONS');
  const occ=snapshotOccurrence(occurrence);return {occ,id:occurrenceIdentity(occ),signal};
 }
 // The occurrence's actual effect identity: its conversation run, request, first event and the native workflow that runs it.
 const effectOf=id=>frozenScheduleData({binding:id.binding,requestId:id.requestId,eventId:id.eventId,workflowId:workflowId(id.binding)});
 function begin({occ,id,signal}) {
  let deadline=now()+maxRequestMs;
  const life=createOperationLifetime({deadlineMs:deadline,now,signal,errorFactory:code=>Object.assign(Error(`SCHEDULE_DISPATCH_${code}`),{code:`SCHEDULE_DISPATCH_${code}`})});
  const limit=ms=>{life.limitDeadline(ms);deadline=Math.min(deadline,ms);};
  return {occ,id,effect:effectOf(id),life,limit,deadline:()=>deadline};
 }
 const result=(outcome,id,code,admitted)=>frozenScheduleData({outcome,occurrenceKey:id.occurrenceKey,binding:id.binding,code,admitted});
 // A malformed firing has no identity to dispatch or reconcile: refused with no run, never retried into an effect.
 const malformed=()=>frozenScheduleData({outcome:'REFUSED',occurrenceKey:null,binding:null,code:'SCHEDULE_OCCURRENCE',admitted:false});
 const opened=request=>{let parsed;try{parsed=parse(request);}catch{return null;}return begin(parsed);};

 /** The canonical store's exact-binding read: under the conversation's advisory lock, so an in-flight acceptance has either
  * committed or the read fails. Absence here is proof that this occurrence has no run. */
 async function existing(c) {
  const saved=await c.life.run(()=>readOptional(c.id.binding,{after:0,limit:1},c.life.check));
  if(saved===null)return null;
  if(canonicalSha256(saved?.run?.binding)!==canonicalSha256(c.id.binding)||saved.request?.requestId!==c.id.requestId)denySchedule('SCHEDULE_OCCURRENCE_CONFLICT');
  return saved;
 }
 /** Whether an admitted run's workflow start happened: its state moved past queued, or Temporal shows its exact workflow ID.
  * Only the typed not-found is absence; any other answer throws (UNKNOWN). */
 async function started(c,saved) {
  if(saved.run.state!=='queued')return true;
  const observed=await c.life.run(signal=>describeRun({binding:c.id.binding,signal,deadlineMs:c.deadline()}));
  if(observed!=='PRESENT'&&observed!=='ABSENT')denySchedule('SCHEDULE_RUN_EVIDENCE');
  return observed==='PRESENT';
 }
 function fence(occ,firing) {
  if(firing===null)return 'SCHEDULE_FIRING_ABSENT';
  if(firing.activeIntent!==null)return 'SCHEDULE_FIRING_UNRESOLVED';
  if(firing.generation!==occ.generation||canonicalSha256(firing.projection)!==canonicalSha256(occ.projection))return 'SCHEDULE_FIRING_STALE';
  const i=firing.intent;
  if(firing.projection.state!=='active'||i===null||i.configuration===null||i.configuration.paused)return 'SCHEDULE_FIRING_INACTIVE';
  if(canonicalSha256(i.configuration.task)!==canonicalSha256(occ.task)||typeof i.taskInstructionSha256!=='string')return 'SCHEDULE_FIRING_STALE';
  return null;
 }
 // Misfire: a new admission is refused once the firing is older than its approved catch-up window (plus approved jitter).
 const missed=(occ,firing)=>now()-Date.parse(occ.scheduledAt)>firing.intent.configuration.catchupWindowMs+firing.intent.configuration.spec.jitterMs?'SCHEDULE_OCCURRENCE_MISSED':null;

 /** Current authority of the ORIGINAL schedule owner at this phase. An explicit denial is evidence (REFUSED); a throw or a
  * malformed receipt is no evidence (UNKNOWN). The receipt's scopes must cover exactly the schedule's resources. */
 async function current(c,phase) {
  const p=c.occ.projection,started=now();
  const raw=await c.life.run(signal=>authorize({phase,occurrence:c.id.identity,occurrenceKey:c.id.occurrenceKey,projection:p,signal,limitDeadline:c.limit}));
  const r=frozenScheduleData(raw),at=now();
  if(r?.occurrenceKey!==c.id.occurrenceKey)denySchedule('SCHEDULE_AUTHORITY_RECEIPT');
  if(r.authorized===false&&Object.keys(r).length===3&&typeof r.code==='string')return null;
  if(r.authorized!==true||Object.keys(r).length!==6||canonicalSha256(r.owner)!==canonicalSha256(p.owner)||!Array.isArray(r.scopes)||!r.scopes.length||r.scopes.length>100||
   !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<started||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at)denySchedule('SCHEDULE_AUTHORITY_RECEIPT');
  for(const s of r.scopes){try{validateShape('Scope',s);}catch{denySchedule('SCHEDULE_AUTHORITY_RECEIPT');}if(s.tenantId!==p.owner.tenantId)denySchedule('SCHEDULE_AUTHORITY_RECEIPT');}
  if(new Set(r.scopes.map(canonicalSha256)).size!==r.scopes.length||new Set(r.scopes.map(s=>s.policyRevision)).size!==1||resourceSet(r.scopes)!==resourceSet(p.scopes))denySchedule('SCHEDULE_AUTHORITY_RECEIPT');
  c.limit(r.expiresAtMs);return r;
 }
 /** The approved instruction for this generation, verified against the acknowledged intent's digest. */
 async function instruction(c,firing) {
  const i=firing.intent,raw=await c.life.run(signal=>readInstruction({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId,generation:firing.generation,task:i.configuration.task,instructionSha256:i.taskInstructionSha256,signal}));
  const v=frozenScheduleData(raw);
  if(!v||Object.keys(v).length!==1||typeof v.instruction!=='string'||!v.instruction.trim()||v.instruction.length>100000)denySchedule('SCHEDULE_INSTRUCTION');
  return canonicalSha256(v.instruction)===i.taskInstructionSha256?v.instruction:null;
 }
 /** Settle this occurrence's barrier row on evidence, then report. A failed settlement is UNKNOWN: the barrier stays. */
 async function settled(c,state,admitted,code=null) {
  const r=frozenScheduleData(await c.life.run(()=>settleOccurrence({tenantId:c.id.binding.tenantId,occurrenceKey:c.id.occurrenceKey,effectSha256:canonicalSha256(c.effect),state},c.life.check)));
  if(r?.state!==state&&r?.state!=='ABSENT')denySchedule('SCHEDULE_OCCURRENCE_RECEIPT');
  return result(state,c.id,code,admitted);
 }
 /** Job mode keeps the same OPEN row through start, holds and uncertain effects. Only the canonical job owner may release it. */
 async function jobProgress(c,{cancel=false}={}) {
  const began=now(),r=frozenScheduleData(await c.life.run(signal=>(cancel?cancelJob:inspectJob)({occurrence:c.occ,effect:c.effect,signal,deadlineMs:c.deadline()}))),at=now();
  if(!r||Object.keys(r).length!==7||!['state','binding','currentBinding','runState','reason','checkedAtMs','expiresAtMs'].every(k=>Object.hasOwn(r,k))||
   !['OCCUPIED','SETTLED'].includes(r.state)||canonicalSha256(r.binding)!==canonicalSha256(c.id.binding)||
   !Number.isSafeInteger(r.checkedAtMs)||r.checkedAtMs<began||r.checkedAtMs>at||!Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=at||
   r.reason!==null&&typeof r.reason!=='string')denySchedule('SCHEDULE_JOB_RECEIPT');
  if((r.currentBinding===null)!==(r.runState===null))denySchedule('SCHEDULE_JOB_RECEIPT');
  if(r.currentBinding!==null){try{validateShape('RunBinding',r.currentBinding);}catch{denySchedule('SCHEDULE_JOB_RECEIPT');}
   if(['tenantId','actorId','conversationId'].some(k=>r.currentBinding[k]!==c.id.binding[k])||r.currentBinding.writerFence<c.id.binding.writerFence||
    !['queued','starting','running','paused','waiting-for-approval','completed','failed','cancelled'].includes(r.runState))denySchedule('SCHEDULE_JOB_RECEIPT');}
  if(r.state==='SETTLED'&&(r.currentBinding===null||!['completed','failed','cancelled'].includes(r.runState)||r.reason!==null))denySchedule('SCHEDULE_JOB_RECEIPT');
  c.limit(r.expiresAtMs);
  return r.state==='SETTLED'?settled(c,'DISPATCHED',true):result('ACTIVE',c.id,r.reason,r.currentBinding!==null);
 }
 // An earlier absence read cannot foreclose a concurrent native admission. In job mode a pre-admission refusal records no
 // settlement; any existing OPEN row remains a barrier until the canonical job owner proves its actual work settled.
 const refused=(c,admitted,code)=>inspectJob?admitted?jobProgress(c):result('REFUSED',c.id,code,false):settled(c,'REFUSED',admitted,code);
 /** A blocking predecessor is settled only by its own started run, found through the run its durable row names. */
 async function predecessorStarted(c,blocking) {
  const occ=snapshotOccurrence(blocking.occurrence),id=occurrenceIdentity(occ),p={...c,occ,id,effect:effectOf(id)};
  if(occ.projection.scheduleId!==c.occ.projection.scheduleId||id.binding.tenantId!==c.id.binding.tenantId||canonicalSha256(p.effect)!==blocking.effectSha256)denySchedule('SCHEDULE_OCCURRENCE_CONFLICT');
  const saved=await existing(p);
  if(saved===null||!await started(p,saved))return false;
  if(inspectJob)return (await jobProgress(p)).outcome==='DISPATCHED';
  await settled(p,'DISPATCHED',true);return true;
 }
 /** Open (or resume) this occurrence's durable barrier before any effect. Returns null when this occurrence holds it. */
 async function barrier(c) {
  for(let attempt=0;attempt<2;attempt++) {
   const r=frozenScheduleData(await c.life.run(()=>openOccurrence({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId,generation:c.occ.generation,occurrenceKey:c.id.occurrenceKey,occurrence:c.occ,effect:c.effect},c.life.check)));
   if(r?.state==='OPEN')return null;
   if(r?.state==='DISPATCHED'||r?.state==='REFUSED')return 'SCHEDULE_OCCURRENCE_SETTLED';
   if(r?.state!=='BLOCKED')denySchedule('SCHEDULE_OCCURRENCE_RECEIPT');
   if(!await predecessorStarted(c,r.blocking))break;
  }
  return 'SCHEDULE_OCCURRENCE_UNRESOLVED';
 }
 function admission(c,scopes,prompt,saved=null) {
  const b=c.id.binding,createdAt=saved?.run.createdAt??new Date(now()).toISOString(),policyRevision=scopes[0].policyRevision;
  return {conversation:{conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt,policyRevision},
   run:saved?.run??{binding:b,state:'queued',scopes,createdAt,policyRevision,versions},
   request:saved?.request??{requestId:c.id.requestId,prompt,skill:null,window:null,windowRequest:null},
   event:{contractVersion:'0.1.0',eventId:c.id.eventId,binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}};
 }
 /** The runtime facet must prove durable original admission, then the canonical store must independently show the same request.
  * Receipt text alone never permits a native start. The low-level direct-accept path remains compatible for existing callers. */
 async function nativeAdmission(c,input) {
  const raw=await c.life.run(signal=>admit({occurrence:c.occ,occurrenceKey:c.id.occurrenceKey,effect:c.effect,input,signal,deadlineMs:c.deadline()}));
  const r=frozenScheduleData(raw);
  if(!r||Object.keys(r).length!==4||!['binding','requestSha256','expiresAtMs','replayed'].every(k=>Object.hasOwn(r,k))||
   canonicalSha256(r.binding)!==canonicalSha256(c.id.binding)||r.requestSha256!==canonicalSha256(input.request)||
   !Number.isSafeInteger(r.expiresAtMs)||r.expiresAtMs<=now()||typeof r.replayed!=='boolean')denySchedule('SCHEDULE_ADMISSION_RECEIPT');
  c.limit(r.expiresAtMs);
  const saved=await existing(c);
  if(saved===null||canonicalSha256(saved.request)!==r.requestSha256||canonicalSha256(saved.run.versions)!==canonicalSha256(input.run.versions)||
   canonicalSha256(saved.run.scopes)!==canonicalSha256(input.run.scopes)||saved.run.policyRevision!==input.run.policyRevision)denySchedule('SCHEDULE_ADMISSION_RECEIPT');
 }

 async function dispatch(request) {
  const c=opened(request);if(c===null)return malformed();let admitted=null;
  try {
   const saved=await existing(c);admitted=saved!==null;
   // A run past queued, or the exact workflow observed, is evidence the start happened; replay never adds an effect.
   if(saved&&await started(c,saved))return inspectJob?await jobProgress(c):await settled(c,'DISPATCHED',true);
   const firing=await c.life.run(()=>readFiring({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId},c.life.check));
   const refusal=fence(c.occ,firing)??(admitted?null:missed(c.occ,firing));
   if(refusal)return await refused(c,admitted,refusal);
   let receipt=null,prompt=null;
   if(!admitted) {
    prompt=await instruction(c,firing);
    if(prompt===null)return await refused(c,false,'SCHEDULE_INSTRUCTION_MISMATCH');
    receipt=await current(c,'before_admission');
    if(receipt===null)return await refused(c,false,'SCHEDULE_AUTHORITY_REFUSED');
   }
   const blocked=await barrier(c);
   if(blocked)return result('REFUSED',c.id,blocked,admitted);
   if(!admitted){admitted=null;const input=admission(c,receipt.scopes,prompt);if(admit)await nativeAdmission(c,input);else await c.life.run(()=>accept(input,c.life.check));admitted=true;}
   // A committed request is evidence of admission, not of a successfully released native proof. UNKNOWN recovery and legacy
   // queued rows must pass the required runtime facet again, with the saved request/time unchanged, before any workflow start.
   else if(admit)await nativeAdmission(c,admission(c,saved.run.scopes,saved.request.prompt,saved));
   if(await current(c,'before_start')===null)return await refused(c,true,'SCHEDULE_AUTHORITY_REFUSED');
   // The canonical dispatcher starts the exact workflow ID with REJECT_DUPLICATE/USE_EXISTING; a lost acknowledgement is UNKNOWN.
   await c.life.run(signal=>start({binding:c.id.binding,signal,deadlineMs:c.deadline()}));
   return inspectJob?await jobProgress(c):await settled(c,'DISPATCHED',true);
  } catch(error) {return result('UNKNOWN',c.id,exposed(scheduleErrorCode(error)),admitted);}
  finally {c.life.close();}
 }
 async function reconcile(request) {
  const c=opened(request);if(c===null)return malformed();let admitted=null;
  try {
   const saved=await existing(c);
   if(saved===null)return result('NOT_DISPATCHED',c.id,null,false);
   admitted=true;
   return await started(c,saved)?inspectJob?await jobProgress(c):await settled(c,'DISPATCHED',true):result('ADMITTED',c.id,null,true);
  } catch(error) {return result('UNKNOWN',c.id,exposed(scheduleErrorCode(error)),admitted);}
  finally {c.life.close();}
 }
 async function cancel(request){const c=opened(request);if(c===null)return malformed();try{return await jobProgress(c,{cancel:true});}catch(error){return result('UNKNOWN',c.id,exposed(scheduleErrorCode(error)),null);}finally{c.life.close();}}
 return Object.freeze({dispatch,reconcile,...(cancelJob?{cancel}:{})});
}
