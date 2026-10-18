/** Trusted allocation and invocation snapshots; validation does not grant authority. */
import { canonicalSha256, validateShape as publicShape } from '../../../packages/contracts/validate.mjs';
import { validateShape as privateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { refuse } from './postgres-budget-store.mjs';
import {assertOccurrenceCostScope} from './occurrence-cost-scope.mjs';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const digest = value => { if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) refuse('INVALID_DIGEST'); return value; };
export const integer = value => { if (!Number.isSafeInteger(value) || value < 1) refuse('INVALID_BUDGET_INTEGER'); return value; };
export const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
export function keys(value, required) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).length !== required.length || required.some(k => !Object.hasOwn(value, k))) refuse('INVALID_BUDGET_SHAPE');
}
const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
export function snapshot(raw) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 65536) refuse('TRUSTED_JSON_REQUIRED');
  try { return freeze(JSON.parse(raw)); } catch { refuse('TRUSTED_JSON_REQUIRED'); }
}
export function allocation(raw) {
  const a = snapshot(raw);
  keys(a, ['run', 'manifest', 'manifestSha256', 'catalogSha256', 'budgets', 'schedule',...(Object.hasOwn(a??{},'occurrenceCostScope')?['occurrenceCostScope']:[])]);
  keys(a.run, ['tenantId', 'actorId', 'conversationId', 'runId']);
  publicShape('RunBinding', { ...a.run, attemptId: a.run.runId, workerId: a.run.runId, writerFence: 1 });
  if(Object.hasOwn(a,'occurrenceCostScope'))assertOccurrenceCostScope(a.occurrenceCostScope,a.run);
  digest(a.manifestSha256); digest(a.catalogSha256); privateShape('Budgets', a.budgets);
  privateShape('SkillManifest', a.manifest);
  if (canonicalSha256(a.manifest) !== a.manifestSha256 || !same(a.manifest.budgets,a.budgets)) refuse('MANIFEST_BUDGET_MISMATCH');
  keys(a.schedule, ['revision', 'expiresAt', 'operations']); digest(a.schedule.revision);
  if (!Number.isSafeInteger(Date.parse(a.schedule.expiresAt)) || !Array.isArray(a.schedule.operations) || !a.schedule.operations.length || a.schedule.operations.length > 4096) refuse('INVALID_CHARGE_SCHEDULE');
  const seen = new Set();
  for (const item of a.schedule.operations) {
    keys(item, ['operation', 'chargeMicrousd']); privateShape('OperationRef', item.operation); integer(item.chargeMicrousd);
    if (!a.manifest.allowedOperations.some(op => same(op,item.operation))) refuse('MANIFEST_OPERATION_MISMATCH');
    const key = canonicalSha256(item.operation); if (seen.has(key)) refuse('DUPLICATE_OPERATION_CHARGE'); seen.add(key);
  }
  return a;
}
function validateGrantBinding(i, a) {
  publicShape('RunBinding', i.binding); digest(i.capabilitySha256); digest(i.allocationSha256);
  const q = i.qualificationBinding;
  keys(q, ['runId', 'attempt', 'workerArn', 'fence', 'policyRevision']);
  integer(q.attempt); integer(q.fence); digest(q.policyRevision);
  if (q.attempt > 2147483647 || q.fence > 2147483647 || q.runId !== i.binding.runId || q.fence !== i.binding.writerFence ||
      typeof q.workerArn !== 'string' || !/^arn:aws:ecs:us-east-1:967807252336:task\/[A-Za-z0-9_-]{1,255}\/[0-9a-f]{32}$/.test(q.workerArn)) refuse('INVALID_QUALIFICATION_MAPPING');
  if (!same(a.run, Object.fromEntries(Object.keys(a.run).map(k => [k, i.binding[k]]))) || canonicalSha256(a) !== i.allocationSha256) refuse('ALLOCATION_BINDING_MISMATCH');
  return i;
}
/** Full immutable grant identity, independent of any invocation identifier. */
export function parseToolGrantFacts(raw, a) {
  const i = snapshot(raw);
  keys(i, ['grantId', 'binding', 'qualificationBinding', 'capabilitySha256', 'allocationSha256']);
  if (!UUID.test(i.grantId)) refuse('INVALID_INVOCATION_ID');
  return validateGrantBinding(i, a);
}
export function invocation(raw, a) {
  const i = snapshot(raw);
  keys(i, ['invocationId', 'grantId', 'binding', 'qualificationBinding', 'capabilitySha256', 'allocationSha256']);
  if (typeof i.invocationId !== 'string' || !/^[A-Za-z0-9_-]{1,128}$/.test(i.invocationId) || !UUID.test(i.grantId)) refuse('INVALID_INVOCATION_ID');
  return validateGrantBinding(i, a);
}
export function grantFacts(i) { const { invocationId: ignored, ...facts } = i; return facts; }
export function assertAuthority(i, claims, credentialSha256) {
  if (!same(i.binding, claims.binding) || i.qualificationBinding.policyRevision !== claims.policyRevision || credentialSha256 !== i.capabilitySha256) refuse('CAPABILITY_BINDING_MISMATCH');
}
