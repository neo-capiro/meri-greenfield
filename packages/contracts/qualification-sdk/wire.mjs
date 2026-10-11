// Private fixture wire representation. Validation and hashes grant no authority.
import canonicalize from 'canonicalize';
import { assertFixtureRequest, assertFixtureResponse } from './validate.mjs';

export const MAX_FIXTURE_WIRE_BYTES = 50 * 1024 * 1024;
const fail = code => { throw new Error(code); };

export function encodeFixtureRequest(request, { nowMs }) {
  try {
    assertFixtureRequest(request, { nowMs });
    const raw = Buffer.from(canonicalize(request), 'utf8');
    if (raw.length === 0 || raw.length > MAX_FIXTURE_WIRE_BYTES) fail('BOUND');
    return raw;
  } catch { fail('FIXTURE_WIRE_INVALID_REQUEST'); }
}

export function decodeFixtureResponse(raw, request, { producer, nowMs }) {
  try {
    if (!Buffer.isBuffer(raw) || raw.length === 0 || raw.length > MAX_FIXTURE_WIRE_BYTES ||
        (raw[0] === 0xef && raw[1] === 0xbb && raw[2] === 0xbf)) fail('BOUND_OR_ENCODING');
    const bytes = Buffer.from(raw);
    const response = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
    // Canonical validation bounds node/depth/schema traversal before serialization.
    const status = assertFixtureResponse(request, response, { producer, nowMs });
    const canonical = Buffer.from(canonicalize(response), 'utf8');
    if (canonical.length > MAX_FIXTURE_WIRE_BYTES || !canonical.equals(bytes)) fail('NONCANONICAL');
    return { response, status };
  } catch { fail('FIXTURE_WIRE_INVALID_RESPONSE'); }
}
