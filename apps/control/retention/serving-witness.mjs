/** Private Core readback of the canonical external retention position. This is
 * a snapshot, never an authorization or a lease. Core must compare it inside
 * its database transaction while holding the canonical retention exclusions,
 * and re-read before releasing content or committing an activation.
 *
 * Deliberately does not recover: Core may already hold the shared recovery
 * lock. Startup/readiness owns reconciliation; trying it here would invert
 * that lock and could deadlock a caller against its own transaction. */
import {timingSafeEqual} from 'node:crypto';
import {createOperationLifetime} from '../../../packages/runtime/operation-lifetime.mjs';

export const RETENTION_WITNESS_PATH = '/v1/internal/retention/serving-witness';
const unavailable = () => Object.assign(Error('RETENTION_WITNESS_UNAVAILABLE'), {code: 'RETENTION_WITNESS_UNAVAILABLE'});
const secret = value => typeof value === 'string' && value.length >= 16 && value.length <= 8192 && !/[\s\x00-\x1f\x7f]/u.test(value);
const response = (status, body) => Response.json(body, {status, headers: {'cache-control': 'no-store', 'x-content-type-options': 'nosniff'}});

export function createRetentionWitnessApplication({startup, getServiceSecret, now = Date.now, maxRequestMs = 10000}) {
  if (typeof startup?.readServingWitness !== 'function' || typeof getServiceSecret !== 'function' ||
      typeof now !== 'function' || !Number.isSafeInteger(maxRequestMs) || maxRequestMs < 1 || maxRequestMs > 30000) throw unavailable();
  return Object.freeze({async handle(request) {
    const url = new URL(request.url);
    if (url.pathname !== RETENTION_WITNESS_PATH) return null;
    if (request.method !== 'GET' || url.search || url.hash || request.body !== null ||
        request.headers.has('content-encoding') ||
        request.headers.has('content-length') && request.headers.get('content-length') !== '0') {
      return response(400, {error: {code: 'RETENTION_WITNESS_REQUEST_REFUSED'}});
    }
    let life;
    try {
      life = createOperationLifetime({now, signal: request.signal, deadlineMs: now() + maxRequestMs, errorFactory: unavailable});
      const supplied = request.headers.get('x-internal-service-secret');
      if (!secret(supplied)) throw unavailable();
      const expected = await life.run(signal => getServiceSecret({signal}));
      if (!secret(expected)) throw unavailable();
      const a = Buffer.from(supplied), b = Buffer.from(expected);
      if (a.length !== b.length || !timingSafeEqual(a, b)) throw unavailable();
      const position = await life.run(() => startup.readServingWitness());
      life.check();
      // Only the content-free position crosses this private service boundary.
      return response(200, {schemaVersion: 1, sequence: position.sequence, entrySha256: position.entrySha256});
    } catch {
      return response(503, {error: {code: 'RETENTION_WITNESS_UNAVAILABLE'}});
    } finally { life?.close(); }
  }});
}
