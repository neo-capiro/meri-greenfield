/** Mail candidate continuation over trusted storage ports; no storage/source owner. */
import { types } from 'node:util';
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../packages/contracts/retrieval-0.2/validate.mjs';
import { deny, exactKeys, parseRawJson } from './operation-result.mjs';

const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const freeze = value => {
  const pending = [value];
  while (pending.length) {
    const item = pending.pop();
    if (!item || typeof item !== 'object' || Object.isFrozen(item)) continue;
    pending.push(...Object.values(item)); Object.freeze(item);
  }
  return value;
};
function stableSubject(subject) {
  const { authorizationDecisionId: ignored, ...selection } = subject;
  return selection;
}
function continuationKey(authority, operation, selection) {
  return freeze({ binding: authority.binding, operation, policyRevision: authority.policyRevision,
    subject: stableSubject(authority.subject), selection });
}
function contextPorts(value) {
  if (!value || types.isProxy(value) || Object.getPrototypeOf(value) !== Object.prototype) deny('GATEWAY_CONFIGURATION');
  const fields = Object.getOwnPropertyDescriptors(value), result = {};
  if (Reflect.ownKeys(fields).length !== 2) deny('GATEWAY_CONFIGURATION');
  for (const key of ['loadPrevious', 'retain']) {
    const field = fields[key];
    if (!field?.enumerable || !Object.hasOwn(field, 'value') || typeof field.value !== 'function') deny('GATEWAY_CONFIGURATION');
    result[key] = field.value.bind(value);
  }
  return result;
}

export async function prepareMailReadContext({ ports, authority, operation, normalized, lifetime, readDeadline, now, maxBytes }) {
  const storage = contextPorts(ports);
  let previousPage;
  let expiresAtMs = Math.min(readDeadline(), authority.deadlineMs);
  const fresh = (stamp, started) => {
    lifetime.check();
    if (!Number.isSafeInteger(stamp) || stamp < started || stamp > now()) deny('ACCESS_DENIED');
  };
  if (normalized.input.offset > 0) {
    const key = continuationKey(authority, operation, normalized.input), started = now();
    const receipt = parseRawJson(await lifetime.run(signal => storage.loadPrevious({ key, signal })), maxBytes, 'ACCESS_DENIED');
    exactKeys(receipt, ['record', 'checkedAtMs'], 'ACCESS_DENIED'); fresh(receipt.checkedAtMs, started);
    const record = receipt.record;
    exactKeys(record, ['key', 'previousPage', 'previousSha256', 'recordedAtMs', 'expiresAtMs'], 'ACCESS_DENIED');
    if (!same(record.key, key) || record.previousSha256 !== canonicalSha256(record.previousPage) ||
        !Number.isSafeInteger(record.recordedAtMs) || record.recordedAtMs < 0 || record.recordedAtMs > receipt.checkedAtMs ||
        !Number.isSafeInteger(record.expiresAtMs) || record.expiresAtMs <= now() ||
        record.expiresAtMs > Math.min(expiresAtMs, readDeadline()) || record.recordedAtMs >= record.expiresAtMs) deny('ACCESS_DENIED');
    try { validateShape('MailCandidateSourcePage', record.previousPage); } catch { deny('ACCESS_DENIED'); }
    const page = record.previousPage;
    if (!same(page.binding, authority.binding) || !same(page.operation, operation) ||
        !same(stableSubject(page.subject), stableSubject(authority.subject)) || page.hasMore !== true ||
        page.nextOffset !== normalized.input.offset || page.messages.length === 0 ||
        !same({ ...page.selection, offset: page.nextOffset, asOf: page.queryScope.asOfInclusive }, normalized.input)) deny('ACCESS_DENIED');
    expiresAtMs = record.expiresAtMs;
    // Publish the validated retained deadline before any later authority/port awaits.
    lifetime.limitDeadline(expiresAtMs);
    previousPage = freeze(page);
  }
  return Object.freeze({
    authority, normalized,
    options() { return { nowMs: now(), actorId: authority.binding.actorId,
      ...(previousPage === undefined ? {} : { previousPage }) }; },
    observeAuthority(current) { expiresAtMs = Math.min(expiresAtMs, current.deadlineMs, readDeadline()); },
    async retain({ current, normalized: selection, result }) {
      lifetime.check();
      if (result.nextOffset === null) return;
      expiresAtMs = Math.min(expiresAtMs, current.deadlineMs, readDeadline());
      const recordedAtMs = now();
      if (!Number.isSafeInteger(recordedAtMs) || recordedAtMs < 0 || recordedAtMs >= expiresAtMs) deny('ACCESS_DENIED');
      const nextSelection = { ...selection.input, offset: result.nextOffset, asOf: result.queryScope.asOfInclusive };
      const key = continuationKey(current, operation, nextSelection);
      // Retain the original validated page, including its exact decision ID and window.
      // Canonical output validation still rejects prior/current full-subject mismatch.
      const record = freeze({ key, previousPage: result, previousSha256: canonicalSha256(result), recordedAtMs, expiresAtMs });
      if (Buffer.byteLength(JSON.stringify(record), 'utf8') > maxBytes) deny('RESOURCE_LIMIT');
      const receipt = parseRawJson(await lifetime.run(signal => storage.retain({ record, signal })), maxBytes, 'ACCESS_DENIED');
      exactKeys(receipt, ['decision', 'keySha256', 'previousSha256', 'checkedAtMs'], 'ACCESS_DENIED');
      fresh(receipt.checkedAtMs, recordedAtMs);
      if (receipt.decision !== 'retained' || receipt.keySha256 !== canonicalSha256(key) ||
          receipt.previousSha256 !== record.previousSha256) deny('ACCESS_DENIED');
    },
  });
}
