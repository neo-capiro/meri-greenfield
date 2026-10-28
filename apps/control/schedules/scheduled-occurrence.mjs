/** One Temporal schedule firing as an immutable occurrence. Its run identity is derived only from server-set firing facts
 * (Temporal schedule ID, scheduled start time, scheduled workflow ID) plus the schedule ID, generation and owner, so every replay,
 * retry or reconciliation of the same firing names the same conversation, run, request and first event, never a replacement. */
import {createHash} from 'node:crypto';
import {types} from 'node:util';
import {validateShape} from '../../../packages/contracts/validate.mjs';
import {canonicalSha256,frozenScheduleData,denySchedule} from '../../../packages/contracts/schedules-0.2/lifecycle-validation.mjs';

const KEYS=['workflowId','temporalScheduleId','scheduledAt','projection','generation','task'];
const hex64=/^[a-f0-9]{64}$/u,uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/u;
const text=v=>typeof v==='string'&&v.length>0&&v.length<=256;
function shape(name,value){try{validateShape(name,value);}catch{denySchedule('SCHEDULE_OCCURRENCE');}}

export function snapshotOccurrence(value){
 if(!value||typeof value!=='object'||types.isProxy(value))denySchedule('SCHEDULE_OCCURRENCE');
 const o=frozenScheduleData(value),keys=Object.keys(o);
 if(keys.length!==KEYS.length||!KEYS.every(k=>Object.hasOwn(o,k)))denySchedule('SCHEDULE_OCCURRENCE');
 shape('ScheduleProjection',o.projection);
 const t=o.task,at=Date.parse(o.scheduledAt);
 if(!text(o.workflowId)||o.temporalScheduleId!==o.projection.temporalScheduleId||!Number.isSafeInteger(o.generation)||o.generation<1||
  !Number.isSafeInteger(at)||new Date(at).toISOString()!==o.scheduledAt||!t||typeof t!=='object'||Object.keys(t).length!==3||
  !uuid.test(t.taskId)||!hex64.test(t.manifestSha256)||!Number.isSafeInteger(t.version)||t.version<1||
  o.projection.scopes.some(s=>s.tenantId!==o.projection.owner.tenantId))denySchedule('SCHEDULE_OCCURRENCE');
 return o;
}

// RFC 9562 version 8 (custom) layout over a domain-separated SHA-256; lower-case as the conversation boundary requires.
function derivedUuid(key,label){
 const h=createHash('sha256').update(`meri.schedule.occurrence.v1\0${key}\0${label}`).digest('hex');
 const variant=((Number.parseInt(h[16],16)&3)|8).toString(16);
 return `${h.slice(0,8)}-${h.slice(8,12)}-8${h.slice(13,16)}-${variant}${h.slice(17,20)}-${h.slice(20,32)}`;
}

export function occurrenceIdentity(o){
 const p=o.projection,identity={tenantId:p.owner.tenantId,actorId:p.owner.actorId,scheduleId:p.scheduleId,temporalScheduleId:o.temporalScheduleId,generation:o.generation,workflowId:o.workflowId,scheduledAt:o.scheduledAt};
 const occurrenceKey=canonicalSha256(identity),id=label=>derivedUuid(occurrenceKey,label);
 // The original schedule owner is the run's actor; a scheduled run never acts as anyone else.
 const binding={tenantId:p.owner.tenantId,actorId:p.owner.actorId,conversationId:id('conversation'),runId:id('run'),attemptId:id('attempt'),workerId:id('worker'),writerFence:1};
 shape('RunBinding',binding);
 return frozenScheduleData({identity,occurrenceKey,binding,requestId:id('request'),eventId:id('event')});
}

/**
 * MB-05: one accepted producer EVENT as an occurrence of its bound routine, reusing this same
 * identity owner so an event occurrence names exactly one conversation/run/request and never a
 * replacement. The workflow id is a pure function of the event identity and the bound
 * schedule generation, and the scheduled instant is the EVENT's own instant — both server-set
 * from the accepted event, never caller-chosen — so a redelivery after a crash derives the same
 * occurrence while two distinct events never collide.
 *
 * `temporalScheduleId` is the bound schedule's identifier because the existing occurrence,
 * barrier and dispatch owners key firings by it. It is NOT a claim that a Temporal schedule
 * fired: an event trigger has no Temporal schedule and no cron semantics.
 */
export function sourceEventWorkflowId(eventKey,scheduleId,generation){
 if(!hex64.test(eventKey)||typeof scheduleId!=='string'||!scheduleId||!Number.isSafeInteger(generation)||generation<1)denySchedule('SCHEDULE_OCCURRENCE');
 return `source-event-${derivedUuid(canonicalSha256({domain:'meri.schedule.source-event.v1',eventKey,scheduleId,generation}),'workflow')}`;
}

export function sourceEventOccurrence(value){
 if(!value||typeof value!=='object'||types.isProxy(value))denySchedule('SCHEDULE_OCCURRENCE');
 const o=frozenScheduleData(value),keys=['projection','generation','task','eventKey','occurredAt','workflowId'];
 if(Object.keys(o).length!==keys.length||!keys.every(k=>Object.hasOwn(o,k)))denySchedule('SCHEDULE_OCCURRENCE');
 if(!hex64.test(o.eventKey))denySchedule('SCHEDULE_OCCURRENCE');
 const occurrence=snapshotOccurrence({workflowId:o.workflowId,temporalScheduleId:o.projection.temporalScheduleId,scheduledAt:o.occurredAt,projection:o.projection,generation:o.generation,task:o.task});
 // The workflow id is recomputed here: a caller cannot select the run identity of an event.
 if(occurrence.workflowId!==sourceEventWorkflowId(o.eventKey,o.projection.scheduleId,o.generation))denySchedule('SCHEDULE_OCCURRENCE');
 return occurrence;
}
