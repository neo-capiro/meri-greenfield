// Authenticated request binding: socket credential -> trusted peer/context.
//
// The client identity is derived from the authenticated TLS socket only. A
// header, a body field, a query parameter or an unauthenticated socket can never
// supply or override it. Peer resolution is delegated entirely to the injected
// trusted resolver; this module compares the worker-presented context to the
// resolver's operation-bound context and trusted audience as DATA and never decides currentness, fence,
// expiry, revocation or a stale-binding denial - those stay with the durable
// registry behind the handlers.
import { createHash } from 'node:crypto';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { validateShape } from '../../../../packages/contracts/qualification-sdk/validate.mjs';
import { INGRESS_OPERATIONS } from './config.mjs';
import { INGRESS_CODES, fail } from './errors.mjs';

const SHA256 = /^[a-f0-9]{64}$/;
const PEER_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,127}$/;
const CREDENTIAL_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/-]{0,255}$/;
const BINDING_KEYS = Object.freeze(['peer', 'context', 'producer', 'audience']);
const PEER_KEYS = Object.freeze(['peerId', 'credentialId']);

function plainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype;
}

/**
 * SHA-256 of the client certificate actually presented on the authenticated
 * socket, computed from its DER bytes. Requires a verified certificate: an
 * unauthenticated or certificate-less socket refuses.
 *
 * @param {import('node:tls').TLSSocket} socket
 * @returns {string} lowercase hex fingerprint
 */
export function peerCertificateFingerprint(socket) {
  if (socket === null || typeof socket !== 'object' || socket.authorized !== true ||
      typeof socket.getPeerCertificate !== 'function') fail(INGRESS_CODES.TLS_PEER);
  let certificate;
  try { certificate = socket.getPeerCertificate(false); } catch { fail(INGRESS_CODES.TLS_PEER); }
  const raw = certificate?.raw;
  if (!Buffer.isBuffer(raw) || raw.length === 0) fail(INGRESS_CODES.TLS_FINGERPRINT);
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Peer identity as resolved by trusted composition from an authenticated
 * credential. Mirrors the registry's peer contract by shape only; it is not an
 * import of, or a substitute for, the registry's own peer validation.
 */
function fixedPeer(peer) {
  if (!plainObject(peer) || Reflect.ownKeys(peer).length !== PEER_KEYS.length ||
      !PEER_KEYS.every(key => Object.hasOwn(peer, key)) ||
      typeof peer.peerId !== 'string' || !PEER_ID.test(peer.peerId) ||
      typeof peer.credentialId !== 'string' || !CREDENTIAL_ID.test(peer.credentialId)) {
    fail(INGRESS_CODES.RESOLVER);
  }
  return Object.freeze({ peerId: peer.peerId, credentialId: peer.credentialId });
}

/** Trusted resolver output: peer, credential-bound context, producer, audience. */
function fixedBinding(resolved) {
  if (!plainObject(resolved) || Reflect.ownKeys(resolved).length !== BINDING_KEYS.length ||
      !BINDING_KEYS.every(key => Object.hasOwn(resolved, key))) fail(INGRESS_CODES.RESOLVER);
  const { context, producer, audience } = resolved;
  const peer = fixedPeer(resolved.peer);
  // Canonical shape/integrity only: the validator grants no authority, and the
  // clock, fence, expiry and admission checks remain the registry's.
  try {
    validateShape('FixtureContext', context);
    validateShape('FixtureContext', producer);
    if (!Array.isArray(audience) || audience.length === 0) fail(INGRESS_CODES.RESOLVER);
    audience.forEach(entry => validateShape('FixtureContext', entry));
  } catch (error) {
    if (error instanceof Error && error.message === INGRESS_CODES.RESOLVER) throw error;
    fail(INGRESS_CODES.RESOLVER);
  }
  // The resolver may return current B together with historical producer A so
  // an A authorize can receive an explicit stale decision. Both contexts must
  // still describe the same run and immutable lineage. This is a structural
  // binding check; the registry owns whether B is actually current.
  const same = (left, right) => canonicalSha256(left) === canonicalSha256(right);
  const left = producer.identity.canonical, right = context.identity.canonical;
  if (producer.phase !== 'interrupt' || context.runUuid !== producer.runUuid ||
      !same(context.namespace, producer.namespace) || !same(context.clock, producer.clock) ||
      !same(context.pins, producer.pins) ||
      context.identity.policyRevision !== producer.identity.policyRevision ||
      ['tenantId', 'actorId', 'conversationId', 'runId'].some(key => left[key] !== right[key]) ||
      (context.phase === 'interrupt' && !same(context, producer)) ||
      (context.phase === 'resume' && (context.identity.attempt !== 2 ||
        context.identity.fence <= producer.identity.fence ||
        context.identity.admittedAtMs <= producer.identity.admittedAtMs)) ||
      !['interrupt', 'resume'].includes(context.phase)) fail(INGRESS_CODES.RESOLVER);
  return { peer, context, producer, audience };
}

/**
 * Binds one decoded operation to an authenticated peer.
 *
 * The resolver receives the socket-derived fingerprint and the fixed operation;
 * a null/undefined answer is an unknown credential and refuses. The presented
 * context must match an operation-allowed trusted context AND an audience
 * entry; anything else refuses without implying a stale denial.
 *
 * @param {{fingerprintSha256: string, operation: string, presentedContext: object,
 *   resolveCredential: Function, nowMs: number, signal: AbortSignal}} input
 * @returns {Promise<{peer: object, context: object, producer: object}>}
 */
export async function bindAuthenticatedOperation({ fingerprintSha256, operation, presentedContext,
  resolveCredential, nowMs, signal }) {
  if (typeof fingerprintSha256 !== 'string' || !SHA256.test(fingerprintSha256)) {
    fail(INGRESS_CODES.TLS_FINGERPRINT);
  }
  if (!INGRESS_OPERATIONS.includes(operation)) fail(INGRESS_CODES.DISPATCH);
  if (!Number.isSafeInteger(nowMs)) fail(INGRESS_CODES.CLOCK);
  let resolved;
  try { resolved = await resolveCredential({ fingerprintSha256, operation, signal }); }
  catch { fail(signal?.aborted ? INGRESS_CODES.HANDLER_TIMEOUT : INGRESS_CODES.RESOLVER); }
  if (signal?.aborted) fail(INGRESS_CODES.HANDLER_TIMEOUT);
  if (resolved === null || resolved === undefined) fail(INGRESS_CODES.UNKNOWN_PEER);
  const binding = fixedBinding(resolved);
  const presented = canonicalSha256(presentedContext);
  const candidates = operation === 'authorizeFixturePhase'
    ? [binding.producer, binding.context]
    : operation === 'commitFixtureCheckpoint' ? [binding.producer] : [binding.context];
  if (!candidates.some(expected => canonicalSha256(expected) === presented) ||
      !binding.audience.some(entry => canonicalSha256(entry) === presented)) {
    fail(INGRESS_CODES.CONTEXT_BINDING);
  }
  return Object.freeze({ peer: binding.peer, context: binding.context, producer: binding.producer });
}
