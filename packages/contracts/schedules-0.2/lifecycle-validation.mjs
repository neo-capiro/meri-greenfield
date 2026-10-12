import { readFileSync } from 'node:fs';
import {types} from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalSha256 } from '../validate.mjs';
import { snapshotOperationData } from '../retrieval-0.2/operation-contracts.mjs';

const schema=JSON.parse(readFileSync(new URL('./lifecycle.schema.json',import.meta.url)));
const ajv=new Ajv({strict:true,allErrors:true}); addFormats(ajv);
ajv.addSchema(JSON.parse(readFileSync(new URL('../meri.schema.json',import.meta.url)))); ajv.addSchema(schema);
export const denySchedule=code=>{throw Object.assign(new Error(code),{code});};
export function scheduleErrorCode(error) {
  if(!error||types.isProxy(error)||(typeof error!=='object'&&typeof error!=='function'))return null;
  const d=Object.getOwnPropertyDescriptor(error,'code');return d&&Object.hasOwn(d,'value')&&typeof d.value==='string'?d.value:null;
}
export function frozenScheduleData(value) {
  const copied=snapshotOperationData(value);
  const freeze=value=>{if(value&&typeof value==='object'){Object.values(value).forEach(freeze);Object.freeze(value);}return value;};
  return freeze(copied);
}
export function scheduleShape(name,value) {
  const copy=frozenScheduleData(value);
  if(!ajv.getSchema(`${schema.$id}#/$defs/${name}`)?.(copy)) denySchedule('SCHEDULE_DATA');
  return copy;
}
function date(value) {
  const ms=Date.parse(value);
  if(!Number.isSafeInteger(ms)||new Date(ms).toISOString()!==value) denySchedule('SCHEDULE_DATE');
  return ms;
}
function projection(p,tenant) {
  if(p.owner.tenantId!==tenant||p.scopes.some(s=>s.tenantId!==tenant))denySchedule('SCHEDULE_TENANT');
  date(p.createdAt);
}
export function snapshotScheduleCall(kind,value,now) {
  const call=scheduleShape(kind,value);
  if(!Number.isSafeInteger(now)||call.deadlineMs<=now||call.deadlineMs-now>60000)denySchedule('SCHEDULE_DEADLINE');
  const tenant=call.callerIdentity.tenantId;
  if(kind==='List') {
    if(call.selection.owner.tenantId!==tenant)denySchedule('SCHEDULE_TENANT');
  } else {
    const i=call.intent,p=i.projection,a=call.approval;
    projection(p,tenant);
    if(!Number.isSafeInteger(p.maxRuntimeSeconds*1000)||!Number.isSafeInteger(p.retryLimit+1))denySchedule('SCHEDULE_BUDGET');
    if(i.generation!==i.expectedGeneration+1)denySchedule('SCHEDULE_GENERATION');
    if(i.operation==='schedule_task' ? i.expectedGeneration!==0||i.previousProjectionSha256!==null : i.expectedGeneration<1||i.previousProjectionSha256===null)denySchedule('SCHEDULE_GENERATION');
    if(a.decision!=='approved'||a.proposalId!==i.intentId||a.commandSha256!==canonicalSha256(i)||a.approver.tenantId!==tenant||date(a.decidedAt)>now||date(a.expiresAt)<=now||date(a.decidedAt)>=date(a.expiresAt))denySchedule('SCHEDULE_APPROVAL');
    if(i.operation==='cancel_scheduled_task') {
      if(i.configuration!==null||!i.cancel||p.state!==(i.cancel.mode==='delete'?'cancelled':'paused')||(i.cancel.running==='leave'&&i.cancel.runs.length))denySchedule('SCHEDULE_CANCEL');
      if(new Set(i.cancel.runs.map(r=>canonicalSha256(r))).size!==i.cancel.runs.length)denySchedule('SCHEDULE_RUN');
    } else {
      const c=i.configuration;
      if(!c||i.cancel!==null||p.state!==(c.paused?'paused':'active')||p.timezone!==c.spec.timezone||(i.operation==='update_scheduled_task'&&c.runNow))denySchedule('SCHEDULE_CONFIGURATION');
      const s=c.spec;
      if(!s.calendars.length&&!s.intervals.length&&!s.cronExpressions.length)denySchedule('SCHEDULE_SPEC');
      if(s.startAt!==null)date(s.startAt);if(s.endAt!==null)date(s.endAt);
      if(s.startAt!==null&&s.endAt!==null&&date(s.startAt)>date(s.endAt))denySchedule('SCHEDULE_SPEC');
      for(const v of s.intervals)if(v.offset>=v.every||v.every%1000||v.offset%1000)denySchedule('SCHEDULE_INTERVAL');
      for(const c of [...s.calendars,...s.skip])for(const [key,ranges]of Object.entries(c))if(key!=='comment'&&ranges!=='*')for(const r of ranges)if(typeof r.start==='number'&&r.end<r.start)denySchedule('SCHEDULE_RANGE');
    }
  }
  return frozenScheduleData({...call,bindingSha256:canonicalSha256(call)});
}
export function assertScheduleAuthority(value,binding) {
  const a=scheduleShape('Authorization',value);
  if(a.bindingSha256!==binding.bindingSha256||canonicalSha256(a.callerIdentity)!==canonicalSha256(binding.callerIdentity))denySchedule('SCHEDULE_AUTHORIZATION');
  return a;
}
export {canonicalSha256};
