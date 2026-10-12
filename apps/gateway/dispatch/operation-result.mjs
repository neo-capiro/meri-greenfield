/** Raw external data and content-free failures; never establishes source truth. */
import { canonicalSha256 } from '../../../packages/contracts/validate.mjs';

const CODES = new Set(['GATEWAY_CONFIGURATION', 'INVALID_ARGUMENTS', 'ACCESS_DENIED',
  'UNAVAILABLE', 'DEADLINE', 'CANCELLED', 'INVALID_RESULT', 'RESOURCE_LIMIT',
  'BUDGET_UNCERTAIN', 'INTERNAL_ERROR']);
const ownedFailures = new WeakMap();

export class GatewayDenied extends Error {
  constructor(code) { const fixed = CODES.has(code) ? code : 'INTERNAL_ERROR'; super(fixed); this.name = 'GatewayDenied'; ownedFailures.set(this, fixed); }
}
export const deny = code => { throw new GatewayDenied(code); };

export function parseRawJson(raw, maxBytes, code = 'INVALID_ARGUMENTS') {
  // Reject objects/proxies without touching properties, descriptors or toJSON.
  if (typeof raw !== 'string' || !Number.isSafeInteger(maxBytes) || maxBytes < 1 ||
      Buffer.byteLength(raw, 'utf8') > maxBytes) deny(code);
  try { return JSON.parse(raw); } catch { deny(code); }
}

export function exactKeys(value, keys, code = 'INVALID_ARGUMENTS') {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      Object.keys(value).length !== keys.length || !keys.every(key => Object.hasOwn(value, key))) deny(code);
}

const AUTHORITY_KEYS = new Set(['tenantId', 'actorId', 'grantId', 'policyRevision',
  'writerFence', 'capability', 'authorizedSources', 'binding']);
export function rejectArgumentAuthority(value) {
  // Only call after parseRawJson: all children are ordinary parsed JSON data.
  const pending = [value]; let visited = 0;
  while (pending.length) {
    const item = pending.pop();
    if (++visited > 100000) deny('RESOURCE_LIMIT');
    if (item !== null && typeof item === 'object') {
      for (const [key, child] of Object.entries(item)) {
        if (AUTHORITY_KEYS.has(key)) deny('INVALID_ARGUMENTS');
        pending.push(child);
      }
    }
  }
}

export function assertResultLineage(value, authority) {
  if (value === null || typeof value !== 'object' || Array.isArray(value) ||
      value.binding === null || typeof value.binding !== 'object' ||
      value.subject === null || typeof value.subject !== 'object') deny('INVALID_RESULT');
  if (canonicalSha256(value.binding) !== canonicalSha256(authority.binding)) deny('INVALID_RESULT');
  if (value.subject.tenantId !== authority.binding.tenantId ||
       value.subject.actorId !== authority.binding.actorId ||
       value.subject.policyRevision !== authority.policyRevision ||
       canonicalSha256(value.subject) !== canonicalSha256(authority.subject)) deny('INVALID_RESULT');
}

export function safeFailure(error) {
  return new GatewayDenied(error !== null && typeof error === 'object'
    ? ownedFailures.get(error) ?? 'INTERNAL_ERROR' : 'INTERNAL_ERROR');
}
