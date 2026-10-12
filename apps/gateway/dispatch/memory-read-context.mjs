/** Trusted retained-page boundary; storage is injected and is not qualified here. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';
import { deny, exactKeys, parseRawJson } from './operation-result.mjs';

const same = (a, b) => canonicalSha256(a) === canonicalSha256(b);
const freeze = value => {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
};
function continuationKey(authority, operation, cursor) {
  const { authorizationDecisionId: ignored, ...subject } = authority.subject;
  return freeze({ binding: authority.binding, operation, policyRevision: authority.policyRevision, subject, cursor });
}

export async function prepareMemoryReadContext({ ports, authority, identityDeadlineMs, operation, request, lifetime, now, maxBytes }) {
  if (!ports || typeof ports.loadPrevious !== 'function' || typeof ports.retain !== 'function') deny('GATEWAY_CONFIGURATION');
  let previous;
  let expiresAtMs = Math.min(identityDeadlineMs, authority.deadlineMs);
  const fresh = (stamp, started) => {
    lifetime.check();
    if (!Number.isSafeInteger(stamp) || stamp < started || stamp > now()) deny('ACCESS_DENIED');
  };
  if (request.cursor != null) {
    const key = continuationKey(authority, operation, request.cursor); const started = now();
    const receipt = parseRawJson(await lifetime.run(signal => ports.loadPrevious({ key, signal })), maxBytes, 'ACCESS_DENIED');
    exactKeys(receipt, ['record', 'checkedAtMs'], 'ACCESS_DENIED'); fresh(receipt.checkedAtMs, started);
    const record = receipt.record;
    exactKeys(record, ['key', 'previous', 'previousSha256', 'recordedAtMs', 'expiresAtMs'], 'ACCESS_DENIED');
    exactKeys(record.previous, ['request', 'page'], 'ACCESS_DENIED');
    if (!same(record.key, key) || record.previousSha256 !== canonicalSha256(record.previous) ||
        !Number.isSafeInteger(record.recordedAtMs) || record.recordedAtMs > receipt.checkedAtMs ||
        !Number.isSafeInteger(record.expiresAtMs) || record.expiresAtMs <= now() ||
        record.expiresAtMs > expiresAtMs || record.recordedAtMs >= record.expiresAtMs) deny('ACCESS_DENIED');
    expiresAtMs = record.expiresAtMs; lifetime.limitDeadline(expiresAtMs);
    previous = freeze(record.previous);
  }
  return Object.freeze({
    authority,
    options(current) { return { subject: current.subject, ...(previous === undefined ? {} : { previous }) }; },
    observeAuthority(current) { expiresAtMs = Math.min(expiresAtMs, current.deadlineMs); },
    async retain({ current, normalized, result }) {
      lifetime.check();
      if (result.nextCursor === null) return;
      const key = continuationKey(current, operation, result.nextCursor);
      const prior = { request: normalized.request, page: result };
      const record = freeze({ key, previous: prior, previousSha256: canonicalSha256(prior), recordedAtMs: now(), expiresAtMs });
      // Bound outbound retained context just as strictly as inbound source facts.
      if (Buffer.byteLength(JSON.stringify(record), 'utf8') > maxBytes) deny('RESOURCE_LIMIT');
      const started = now();
      const receipt = parseRawJson(await lifetime.run(signal => ports.retain({ record, signal })), maxBytes, 'ACCESS_DENIED');
      exactKeys(receipt, ['decision', 'keySha256', 'previousSha256', 'checkedAtMs'], 'ACCESS_DENIED');
      fresh(receipt.checkedAtMs, started);
      if (receipt.decision !== 'retained' || receipt.keySha256 !== canonicalSha256(key) ||
          receipt.previousSha256 !== record.previousSha256) deny('ACCESS_DENIED');
    },
  });
}
