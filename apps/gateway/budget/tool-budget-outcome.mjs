/** Historical accounting observations only; never execution or retry authority. */
import { validateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { digest, keys, same, snapshot, grantFacts } from './tool-budget-binding.mjs';
import { refuse } from './postgres-budget-store.mjs';

const fail = () => refuse('OUTCOME_BINDING_MISMATCH');
const money = value => {
  if (!((typeof value === 'string' && /^(0|[1-9][0-9]*)$/.test(value)) ||
      (Number.isSafeInteger(value) && value >= 0))) fail();
  const result = BigInt(value);
  if (result > 9223372036854775807n) fail();
  return result;
};
const time = value => {
  if (!(value instanceof Date) || !Number.isSafeInteger(value.getTime())) fail();
  return value.getTime();
};
export function outcomeExpectation(raw, allocation) {
  const expected = snapshot(raw);
  keys(expected, ['operation', 'argumentsSha256']);
  validateShape('OperationRef', expected.operation); digest(expected.argumentsSha256);
  if (!allocation.schedule.operations.some(item => same(item.operation, expected.operation))) fail();
  return expected;
}
export function assertHistoricalGrant(i, bound, grant) {
  const q = i.qualificationBinding;
  if (!bound || bound.grant_id !== i.grantId || bound.run_id !== i.binding.runId ||
      !same(bound.facts, grantFacts(i)) || !grant || grant.grant_id !== i.grantId ||
      grant.run_id !== q.runId || grant.attempt !== q.attempt || grant.worker_arn !== q.workerArn ||
      grant.fence !== q.fence || grant.policy_revision !== q.policyRevision ||
      grant.capability_sha256 !== i.capabilitySha256 || !['ACTIVE', 'REVOKED'].includes(grant.state)) fail();
  time(grant.expires_at); // Integrity only: expired/revoked original authority remains inspectable.
}
export function outcomeSnapshot({ allocation, invocation, expected, row, now }) {
  const observedAtMs = time(now);
  const result = { invocationId: invocation.invocationId, reservationId: null, state: 'ABSENT',
    operation: expected.operation, argumentsSha256: expected.argumentsSha256,
    holdMicrousd: null, chargedMicrousd: null, outputBytes: null, observedAtMs };
  if (!row) return Object.freeze(result); // A pending transaction can still commit later.
  if (row.invocation_id !== invocation.invocationId || row.grant_id !== invocation.grantId ||
      row.run_id !== invocation.binding.runId || !same(row.facts, invocation) ||
      !same(row.operation, expected.operation) || row.arguments_sha256 !== expected.argumentsSha256 ||
      typeof row.reservation_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.reservation_id)) fail();
  const charge = allocation.schedule.operations.find(item => same(item.operation, expected.operation)).chargeMicrousd;
  const hold = money(row.hold_micro_usd), maximum = money(row.max_output_bytes);
  const created = time(row.created_at);
  if (hold !== BigInt(charge) || maximum < 1n || maximum > BigInt(allocation.budgets.maxOutputBytes) ||
      created > observedAtMs) fail();
  if (row.state === 'UNKNOWN') {
    if (row.charged_micro_usd !== null || row.output_bytes !== null || row.settled_at !== null) fail();
  } else if (row.state === 'SETTLED') {
    if (money(row.charged_micro_usd) !== hold || money(row.output_bytes) > maximum ||
        time(row.settled_at) < created || time(row.settled_at) > observedAtMs) fail();
    result.chargedMicrousd = hold.toString(); result.outputBytes = Number(money(row.output_bytes));
  } else fail();
  return Object.freeze({ ...result, reservationId: row.reservation_id, state: row.state,
    holdMicrousd: hold.toString() });
}
