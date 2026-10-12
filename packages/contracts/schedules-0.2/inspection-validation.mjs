// Private inspection boundary: typed correlation is not current authorization.
import { readFileSync } from 'node:fs';
import { types } from 'node:util';
import Ajv from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { canonicalSha256 } from '../validate.mjs';
import { snapshotOperationData } from '../retrieval-0.2/operation-contracts.mjs';

const schema = JSON.parse(readFileSync(new URL('./inspection.schema.json', import.meta.url)));
const publicSchema = JSON.parse(readFileSync(new URL('../meri.schema.json', import.meta.url)));
const ajv = new Ajv({ strict: true, allErrors: true });
addFormats(ajv); ajv.addSchema(publicSchema); ajv.addSchema(schema);
const validators = new Map(Object.keys(schema.$defs).map(name => [name, ajv.getSchema(`${schema.$id}#/$defs/${name}`)]));
const fail = () => { throw new Error('SCHEDULE_INSPECTION_DATA'); };
function shape(name, value) { if (!validators.get(name)?.(value)) fail(); return value; }
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}
function instant(ms) { if (!Number.isSafeInteger(ms)) fail(); try { return new Date(ms).toISOString(); } catch { fail(); } }
function row(value) {
  if (!value || types.isProxy(value) || (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) fail();
  return value;
}
// Deliberately read only selected SDK data fields. Never touch omitted args/memo/raw.
function field(value, name, optional = false) {
  row(value); const d = Object.getOwnPropertyDescriptor(value, name);
  if (!d) { if (optional) return undefined; fail(); }
  if (!Object.hasOwn(d, 'value') || !d.enumerable) fail();
  return d.value;
}
function date(value) {
  if (types.isProxy(value) || !types.isDate(value)) fail();
  return instant(Date.prototype.getTime.call(value));
}
function window(value, convert, recent = false) {
  if (!Array.isArray(value) || types.isProxy(value) || Object.getPrototypeOf(value) !== Array.prototype) fail();
  const observed = value.length, returned = Math.min(observed, 100), start = recent ? observed-returned : 0, items = [];
  for (let i=start; i<start+returned; i++) {
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if (!d?.enumerable || !Object.hasOwn(d,'value')) fail();
    items.push(convert(d.value));
  }
  return {items, coverage:{observed,returned,omitted:observed-returned}};
}
function originalRun(action) {
  if (field(action,'type') !== 'startWorkflow') fail();
  const workflow=field(action,'workflow');
  return {workflowId:field(workflow,'workflowId'),firstExecutionRunId:field(workflow,'firstExecutionRunId')};
}
export function snapshotScheduleInspectionBinding(value, nowMs) {
  const binding=shape('ScheduleInspectionBinding',snapshotOperationData(value));
  if (!Number.isSafeInteger(nowMs) || binding.deadlineMs <= nowMs || binding.deadlineMs-nowMs > 60000) fail();
  const {projection,callerIdentity}=binding;
  if (projection.owner.tenantId !== callerIdentity.tenantId || projection.scopes.some(scope=>scope.tenantId!==callerIdentity.tenantId)) fail();
  // Owner identity remains separate: the current authority decides delegated access.
  return freeze({...binding,projectionSha256:canonicalSha256(projection)});
}
export function assertScheduleInspectionAuthorization(value, binding) {
  const receipt=shape('ScheduleInspectionAuthorization',snapshotOperationData(value));
  if (receipt.projectionSha256 !== binding.projectionSha256 || canonicalSha256(receipt.callerIdentity)!==canonicalSha256(binding.callerIdentity)) fail();
  return freeze(receipt);
}
export function projectScheduleInspection(description, binding, nowMs) {
  if (field(description,'scheduleId') !== binding.projection.temporalScheduleId) fail();
  const state=field(description,'state'), info=field(description,'info');
  const next=window(field(info,'nextActionTimes'),date);
  const recent=window(field(info,'recentActions'),item=>({scheduledAt:date(field(item,'scheduledAt')),takenAt:date(field(item,'takenAt')),workflow:originalRun(field(item,'action'))}),true);
  const running=window(field(info,'runningActions'),originalRun);
  const remaining=field(state,'remainingActions',true), updated=field(info,'lastUpdatedAt',true);
  const output={projection:binding.projection,projectionSha256:binding.projectionSha256,observedAt:instant(nowMs),temporal:{
    scheduleId:binding.projection.temporalScheduleId,paused:field(state,'paused'),remainingActions:remaining===undefined?null:remaining,
    createdAt:date(field(info,'createdAt')),lastUpdatedAt:updated===undefined?null:date(updated),
    numActionsTaken:field(info,'numActionsTaken'),numActionsMissedCatchupWindow:field(info,'numActionsMissedCatchupWindow'),numActionsSkippedOverlap:field(info,'numActionsSkippedOverlap'),
    nextActionTimes:next.items,recentActions:recent.items,runningActions:running.items},coverage:{historyComplete:false,currentRunIdentityVerified:false,nextActions:next.coverage,recentActions:recent.coverage,runningActions:running.coverage}};
  return freeze(shape('ScheduleInspectionOutput',snapshotOperationData(output)));
}
