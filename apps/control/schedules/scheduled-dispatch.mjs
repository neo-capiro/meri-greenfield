/** Product dispatch of one Temporal schedule firing into one conversation run, composed from the canonical owners: the schedule
 * owner's generation/state fence, the original owner's current authority, the conversation store's durable request acceptance and
 * the conversation Temporal dispatcher. Temporal's schedule is the only scheduler; this owner never fires, retries or mints a second
 * identity. Outcomes: DISPATCHED (run admitted and its workflow start acknowledged or observed), REFUSED (fenced or denied with
 * evidence; `admitted` says whether an earlier attempt already admitted the run), UNKNOWN (no evidence; blocks until reconciled).
 * Reconciliation additionally answers ADMITTED (run admitted, workflow proven never started) or NOT_DISPATCHED (run proven absent);
 * either may be completed only by dispatching the same immutable occurrence again, with every fence re-checked. */
import {types} from 'node:util';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {canonicalSha256,frozenScheduleData,denySchedule,scheduleErrorCode} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';
import {sdkMethod} from './temporal-schedule-mutations.mjs';
import {snapshotOccurrence,occurrenceIdentity} from './scheduled-occurrence.mjs';

const PORTS=['scheduleOwner','store','dispatcher','runs','authority','taskInstructions','versions','now','maxRequestMs'];
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
 const readFiring=sdkMethod(o.scheduleOwner,'readFiring'),accept=sdkMethod(o.store,'accept'),readOptional=sdkMethod(o.store,'readOptional');
 const start=sdkMethod(o.dispatcher,'start'),describeRun=sdkMethod(o.runs,'describe'),authorize=sdkMethod(o.authority,'authorize'),readInstruction=sdkMethod(o.taskInstructions,'read');
 try{validateShape('RuntimeVersions',o.versions);}catch{denySchedule('SCHEDULE_DISPATCH_OPTIONS');}
 const versions=frozenScheduleData(o.versions);
 if(typeof now!=='function'||!Number.isSafeInteger(maxRequestMs)||maxRequestMs<1||maxRequestMs>30000)denySchedule('SCHEDULE_DISPATCH_OPTIONS');

 function parse(request) {
  const {occurrence,signal}=optionsData(request,['occurrence','signal'],['occurrence']);
  if(signal!==undefined&&(types.isProxy(signal)||!(signal instanceof AbortSignal)))denySchedule('SCHEDULE_DISPATCH_OPTIONS');
  const occ=snapshotOccurrence(occurrence);return {occ,id:occurrenceIdentity(occ),signal};
 }
 function begin({occ,id,signal}) {
  let deadline=now()+maxRequestMs;
  const life=createOperationLifetime({deadlineMs:deadline,now,signal,errorFactory:code=>Object.assign(Error(`SCHEDULE_DISPATCH_${code}`),{code:`SCHEDULE_DISPATCH_${code}`})});
  const limit=ms=>{life.limitDeadline(ms);deadline=Math.min(deadline,ms);};
  return {occ,id,life,limit,deadline:()=>deadline};
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
 function admission(c,scopes,prompt) {
  const b=c.id.binding,createdAt=new Date(now()).toISOString(),policyRevision=scopes[0].policyRevision;
  return {conversation:{conversationId:b.conversationId,owner:{tenantId:b.tenantId,actorId:b.actorId},scopes,createdAt,policyRevision},
   run:{binding:b,state:'queued',scopes,createdAt,policyRevision,versions},
   request:{requestId:c.id.requestId,prompt,skill:null,window:null,windowRequest:null},
   event:{contractVersion:'0.1.0',eventId:c.id.eventId,binding:b,sequence:1,createdAt,scopes,type:'run.status',data:{state:'queued',reasonCode:null}}};
 }

 async function dispatch(request) {
  const c=opened(request);if(c===null)return malformed();let admitted=null;
  try {
   const saved=await existing(c);admitted=saved!==null;
   // A run past queued, or the exact workflow observed, is evidence the start happened; replay never adds an effect.
   if(saved&&await started(c,saved))return result('DISPATCHED',c.id,null,true);
   const firing=await c.life.run(()=>readFiring({tenantId:c.id.binding.tenantId,scheduleId:c.occ.projection.scheduleId},c.life.check));
   const refusal=fence(c.occ,firing)??(admitted?null:missed(c.occ,firing));
   if(refusal)return result('REFUSED',c.id,refusal,admitted);
   if(!admitted) {
    const prompt=await instruction(c,firing);
    if(prompt===null)return result('REFUSED',c.id,'SCHEDULE_INSTRUCTION_MISMATCH',false);
    const receipt=await current(c,'before_admission');
    if(receipt===null)return result('REFUSED',c.id,'SCHEDULE_AUTHORITY_REFUSED',false);
    admitted=null;await c.life.run(()=>accept(admission(c,receipt.scopes,prompt),c.life.check));admitted=true;
   }
   if(await current(c,'before_start')===null)return result('REFUSED',c.id,'SCHEDULE_AUTHORITY_REFUSED',true);
   // The canonical dispatcher starts the exact workflow ID with REJECT_DUPLICATE/USE_EXISTING; a lost acknowledgement is UNKNOWN.
   await c.life.run(signal=>start({binding:c.id.binding,signal,deadlineMs:c.deadline()}));
   return result('DISPATCHED',c.id,null,true);
  } catch(error) {return result('UNKNOWN',c.id,exposed(scheduleErrorCode(error)),admitted);}
  finally {c.life.close();}
 }
 async function reconcile(request) {
  const c=opened(request);if(c===null)return malformed();let admitted=null;
  try {
   const saved=await existing(c);
   if(saved===null)return result('NOT_DISPATCHED',c.id,null,false);
   admitted=true;
   return result(await started(c,saved)?'DISPATCHED':'ADMITTED',c.id,null,true);
  } catch(error) {return result('UNKNOWN',c.id,exposed(scheduleErrorCode(error)),admitted);}
  finally {c.life.close();}
 }
 return Object.freeze({dispatch,reconcile});
}
