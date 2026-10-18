/** Unattended routine authority for the schedule service (D016-A item 5), composed over Core's firing grant (wire C,
 * routines-firing-grant.mjs) and Meri's own schedule owner. Two owners come from here:
 *
 *  `createRoutinesFiringAuthority(...).authorize({phase, occurrence, occurrenceKey, projection, signal, limitDeadline})` is the
 *  `authority` port of apps/control/schedules/scheduled-dispatch.mjs `current()`: the ORIGINAL owner's current authority at
 *  `before_admission` and `before_start`. It answers exactly `{authorized:true, occurrenceKey, owner, scopes, checkedAtMs,
 *  expiresAtMs}` or the three-field denial `{authorized:false, occurrenceKey, code}`; anything uncertain throws (UNKNOWN).
 *  Order: the schedule owner's current firing row must be ACTIVE at the occurrence's generation with the occurrence's exact
 *  projection and an acknowledged intent (pause, delete or a newer generation DENY before Core is asked); then Core's grant for
 *  exactly this occurrence/phase must verify against the pinned key and bind the same owner, schedule, generation, intent and
 *  projection digests, the projection's resource set, a consent window ≤ 30 days and limits that cover the projection's. Core's 403
 *  (no consent, revoked, membership or client-wall change) is a DENY; a missing route, 5xx or malformed answer is UNAVAILABLE.
 *  The receipt is Meri's own observation: checkedAtMs now, expiresAtMs = min(pre-request instant + the grant's lease (≤ 30 s),
 *  consent expiry); membership alone is never policy and no JSON value is authority.
 *
 *  `createRoutinesUnattendedRunControl(...).cancel({binding, signal, deadlineMs})` is the schedule service's `runControl`
 *  (scheduled-job-lifecycle.mjs cancel): stopping an occurrence's own run when its Temporal wrapper is cancelled. The binding is
 *  mapped to its occurrence through the schedule owner's `readOccurrenceForConversation` (never request data), a `before_stop`
 *  grant for that occurrence is obtained and verified, and the existing lifecycle Stop order runs (journal `run.status:cancelled`
 *  first, dispatcher cancel second) with no session. Stopping is the safe direction: a paused or deleted schedule still stops.
 *
 * Neither owner issues, caches or renews consent; every check is a fresh Core answer inside one request bound. */
import {randomUUID} from 'node:crypto';
import {types} from 'node:util';
import {own,data,nativeSignal} from '../../../packages/contracts/commands-0.2/execution-boundary.mjs';
import {canonicalSha256 as hash,validateShape} from '../../../packages/contracts/validate.mjs';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';
import {sdkMethod} from '../../control/schedules/temporal-schedule-mutations.mjs';
import {verifyRoutineFiringGrant} from './routines-firing-grant.mjs';
import {createRunStopper} from './routines-run-control.mjs';

const same=(a,b)=>hash(a)===hash(b),HEX64=/^[a-f0-9]{64}$/u,LIMIT_KEYS=['maxCostMicrousd','maxRuntimeSeconds','retryLimit'];
const resourceSet=scopes=>hash(scopes.map(s=>hash({tenantId:s.tenantId,kind:s.kind,resourceId:s.resourceId})).sort());
const configurationFault=()=>Object.assign(Error('ROUTINES_CONFIGURATION'),{code:'ROUTINES_CONFIGURATION'});
const fault=code=>Object.assign(Error('ROUTINE_FIRING_'+code),{code:'ROUTINE_FIRING_'+code,outcome:'UNKNOWN'});
const refuse=code=>{throw fault(code);};
export const ROUTINE_FIRING_DENIED='SCHEDULE_AUTHORITY_REFUSED';
const denial=occurrenceKey=>data({authorized:false,occurrenceKey,code:ROUTINE_FIRING_DENIED});
/** DENY is a value (evidence); UNAVAILABLE is a throw (no evidence). This sentinel carries a DENY out of the shared grant step. */
class Denied extends Error{constructor(){super('ROUTINE_FIRING_DENIED');this.code='ROUTINE_FIRING_DENIED';}}

function capture(configuration,extra=[]){
 let c;try{
  c=own(configuration,['wires','trust','scheduleOwner','now','maxRequestMs',...extra],['newId']);
  if(typeof c.now!=='function'||types.isProxy(c.now)||!Number.isSafeInteger(c.maxRequestMs)||c.maxRequestMs<1||c.maxRequestMs>30000||!c.trust||typeof c.trust!=='object')throw Error();
 }catch{throw configurationFault();}
 return {c,grant:sdkMethod(c.wires,'unattendedGrant'),readFiring:sdkMethod(c.scheduleOwner,'readFiring')};
}
/** The current firing row for a schedule, read through the canonical owner. */
async function firingRow(readFiring,tenantId,scheduleId,life){
 const row=data(await life.run(()=>readFiring({tenantId,scheduleId},life.check)));
 if(row===null)return null;
 try{own(row,['projection','generation','activeIntent','intent']);validateShape('ScheduleProjection',row.projection);}catch{refuse('SCHEDULE');}
 if(!Number.isSafeInteger(row.generation)||row.generation<1||row.projection.scheduleId!==scheduleId||row.projection.owner.tenantId!==tenantId)refuse('SCHEDULE');
 return row;
}
/** One grant for `{owner, schedule, generation, intent, projection, occurrenceKey, phase}`, verified and bound. Throws Denied for
 * Core's 403, ROUTINE_FIRING_* for anything uncertain. Returns the verified grant and Meri's own lease bounds. */
async function boundGrant({grant,trust,now},request,life){
 const began=now();let issued;
 try{issued=await life.run(signal=>grant({...request,signal,deadlineMs:life.deadlineMs}));}
 catch(error){if(error?.code==='ROUTINES_CORE_REFUSED')throw new Denied();throw error;}
 const v=verifyRoutineFiringGrant(issued.grant,{trust,nowMs:now()}),k=v.claims;
 if(k.tenantId!==request.tenantId||k.ownerActorId!==request.ownerActorId||k.scheduleId!==request.scheduleId||k.generation!==request.generation||k.intentSha256!==request.intentSha256||
  k.projectionSha256!==request.projectionSha256||k.occurrenceKey!==request.occurrenceKey||k.phase!==request.phase)refuse('GRANT');
 const checkedAtMs=now(),expiresAtMs=Math.min(began+(v.exp-v.iat)*1000,k.consentExpiresAtS*1000);
 if(!Number.isSafeInteger(checkedAtMs)||checkedAtMs<began||expiresAtMs<=checkedAtMs)refuse('EXPIRED');
 return {verified:v,checkedAtMs,expiresAtMs};
}

export function createRoutinesFiringAuthority(configuration){
 const {c,grant,readFiring}=capture(configuration),now=c.now;
 async function authorize(value){
  let v,projection,identity;
  try{
   v=own(value,['phase','occurrence','occurrenceKey','projection'],['signal','limitDeadline']);nativeSignal(v.signal);
   identity=data(own(v.occurrence,['tenantId','actorId','scheduleId','temporalScheduleId','generation','workflowId','scheduledAt']));projection=data(v.projection);validateShape('ScheduleProjection',projection);
  }catch{refuse('REQUEST');}
  if(!['before_admission','before_start'].includes(v.phase)||v.limitDeadline!==undefined&&typeof v.limitDeadline!=='function'||typeof v.occurrenceKey!=='string'||!HEX64.test(v.occurrenceKey)||
   v.occurrenceKey!==hash(identity)||projection.scheduleId!==identity.scheduleId||projection.owner.tenantId!==identity.tenantId||projection.owner.actorId!==identity.actorId||
   !Number.isSafeInteger(identity.generation)||identity.generation<1)refuse('REQUEST');
  const began=now(),life={...createOperationLifetime({now,signal:v.signal,deadlineMs:began+c.maxRequestMs,errorFactory:code=>fault(code)}),deadlineMs:began+c.maxRequestMs};
  try{
   // Meri's own fence first: pause, delete, a newer generation or a changed projection deny before Core is asked.
   const row=await firingRow(readFiring,identity.tenantId,identity.scheduleId,life);
   if(row===null||row.projection.state!=='active'||row.generation!==identity.generation||!same(row.projection,projection)||row.intent===null)return denial(v.occurrenceKey);
   const request={tenantId:identity.tenantId,ownerActorId:identity.actorId,scheduleId:identity.scheduleId,generation:row.generation,intentSha256:hash(row.intent),projectionSha256:hash(projection),occurrenceKey:v.occurrenceKey,phase:v.phase};
   let bound;try{bound=await boundGrant({grant,trust:c.trust,now},request,life);}catch(error){if(error instanceof Denied)return denial(v.occurrenceKey);throw error;}
   const k=bound.verified.claims;
   // The consent must cover the schedule's resources and limits exactly as approved; a narrower or different consent denies.
   if(resourceSet(k.scopes)!==resourceSet(projection.scopes)||LIMIT_KEYS.some(key=>projection[key]>k.limits[key]))return denial(v.occurrenceKey);
   // The row must still be the same after Core answered (no mutation landed meanwhile).
   const again=await firingRow(readFiring,identity.tenantId,identity.scheduleId,life);
   if(again===null||!same(again,row))return denial(v.occurrenceKey);
   v.limitDeadline?.(bound.expiresAtMs);life.check();
   return data({authorized:true,occurrenceKey:v.occurrenceKey,owner:{tenantId:identity.tenantId,actorId:identity.actorId},scopes:k.scopes,checkedAtMs:bound.checkedAtMs,expiresAtMs:bound.expiresAtMs});
  }finally{life.close();}
 }
 return Object.freeze({authorize});
}

export function createRoutinesUnattendedRunControl(configuration){
 const {c,grant,readFiring}=capture(configuration,['store','dispatcher']),now=c.now;
 let readOccurrence,stopper;
 try{readOccurrence=sdkMethod(c.scheduleOwner,'readOccurrenceForConversation');stopper=createRunStopper({store:c.store,dispatcher:c.dispatcher,now,newId:c.newId??randomUUID});}catch{throw configurationFault();}
 async function cancel(value){
  let v,binding;
  try{v=own(value,['binding','deadlineMs'],['signal']);nativeSignal(v.signal);binding=data(v.binding);validateShape('RunBinding',binding);}catch{refuse('REQUEST');}
  if(!Number.isSafeInteger(v.deadlineMs))refuse('REQUEST');
  const began=now(),cutoff=Math.min(v.deadlineMs,began+c.maxRequestMs),life={...createOperationLifetime({now,signal:v.signal,deadlineMs:cutoff,errorFactory:code=>fault(code)}),deadlineMs:cutoff};
  try{
   // The run's occurrence, from Meri's own custody: a run that is not a scheduled occurrence of this owner is never stopped here.
   const record=data(await life.run(()=>readOccurrence({tenantId:binding.tenantId,conversationId:binding.conversationId},life.check)));
   if(record===null)refuse('NOT_SCHEDULED');
   const origin=record.effect?.binding,p=record.occurrence?.projection;
   if(!origin||!p||origin.tenantId!==binding.tenantId||origin.actorId!==binding.actorId||origin.conversationId!==binding.conversationId||p.owner.tenantId!==binding.tenantId||p.owner.actorId!==binding.actorId)refuse('NOT_SCHEDULED');
   const row=await firingRow(readFiring,binding.tenantId,record.scheduleId,life);
   if(row===null||row.intent===null)refuse('SCHEDULE');
   const request={tenantId:binding.tenantId,ownerActorId:binding.actorId,scheduleId:record.scheduleId,generation:row.generation,intentSha256:hash(row.intent),projectionSha256:hash(row.projection),occurrenceKey:record.occurrenceKey,phase:'before_stop'};
   let bound;try{bound=await boundGrant({grant,trust:c.trust,now},request,life);}catch(error){if(error instanceof Denied)refuse('DENIED');throw error;}
   life.limitDeadline(bound.expiresAtMs);
   const saved=await stopper.read(binding,life);
   return await stopper.stop(binding,saved,life,Math.min(cutoff,bound.expiresAtMs));
  }finally{life.close();}
 }
 return Object.freeze({cancel});
}
