/** Closed immutable invocation provenance; no caller data establishes authority. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { invocation, grantFacts, snapshot, keys, same, digest } from './tool-budget-binding.mjs';
import { outcomeExpectation } from './tool-budget-outcome.mjs';
import { rejectArgumentAuthority } from '../dispatch/operation-result.mjs';
import { refuse } from './postgres-budget-store.mjs';

export const ownedId = value => typeof value === 'string' && value.startsWith('owned_');
const text = value => { if (typeof value !== 'string' || !/^[A-Za-z0-9_.:@/-]{1,255}$/.test(value)) refuse('INVALID_DELIVERY_IDENTITY'); };
export function deliveryRecord(deliveryJson, requestJson, a) {
  const delivery = snapshot(deliveryJson); keys(delivery, ['context', 'producer', 'deliveryId']);
  keys(delivery.producer, ['namespace', 'executionId']);
  text(delivery.producer.namespace); text(delivery.producer.executionId); text(delivery.deliveryId);
  const context = invocation(JSON.stringify({ ...delivery.context, invocationId: 'binding-admission' }), a);
  if (!same(delivery.context, grantFacts(context))) refuse('INVALID_DELIVERY_CONTEXT');
  const request = snapshot(requestJson); keys(request, ['operation', 'arguments']);
  rejectArgumentAuthority(request.arguments);
  const expected = outcomeExpectation(JSON.stringify({ operation: request.operation,
    argumentsSha256: canonicalSha256(request.arguments) }), a);
  return Object.freeze({ delivery, context, operation: expected.operation,
    rawRequestSha256: canonicalSha256(request),
    key: canonicalSha256({ producer: delivery.producer, deliveryId: delivery.deliveryId }) });
}
export function assertInvocationRecord(row, d, a) {
  if (!row || !/^owned_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(row.invocation_id) ||
      row.run_id !== a.run.runId || row.producer_key_sha256 !== d.key || !same(row.delivery, d.delivery) ||
      row.raw_request_sha256 !== d.rawRequestSha256 || !same(row.operation, d.operation)) refuse('INVOCATION_CONFLICT');
  const i = invocation(JSON.stringify(row.facts), a);
  if (i.invocationId !== row.invocation_id || !same(grantFacts(i), grantFacts(d.context))) refuse('INVOCATION_CONFLICT');
  if(!((typeof row.deadline_ms==='string'&&/^[1-9][0-9]*$/.test(row.deadline_ms))||Number.isSafeInteger(row.deadline_ms)))refuse('INVOCATION_CORRUPT');
  const deadlineMs = Number(row.deadline_ms);
  if (!Number.isSafeInteger(deadlineMs) || deadlineMs <= 0 ||
      !(row.created_at instanceof Date) || !Number.isSafeInteger(row.created_at.getTime())) refuse('INVOCATION_CORRUPT');
  if ((row.reservation_id === null) !== (row.arguments_sha256 === null) ||
      (row.reservation_id === null && row.completion !== null)) refuse('INVOCATION_CORRUPT');
  if (row.arguments_sha256 !== null) digest(row.arguments_sha256);
  return Object.freeze({ invocationJson: JSON.stringify(i), rawRequestSha256: d.rawRequestSha256,
    operation: d.operation, deadlineMs });
}
export function completionRecord(row, call) {
  digest(call.resultSha256);
  if (row.reservation_id !== call.reservationId || !Number.isSafeInteger(call.outputBytes) || call.outputBytes < 0) refuse('COMPLETION_MISMATCH');
  return Object.freeze({ invocationId: row.invocation_id, reservationId: row.reservation_id,
    factsSha256: canonicalSha256(row.facts), rawRequestSha256: row.raw_request_sha256,
    operation: row.operation, argumentsSha256: row.arguments_sha256,
    resultSha256: call.resultSha256, outputBytes: call.outputBytes });
}
