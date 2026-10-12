// Synthetic callback -> private wire -> real HTTPS/mTLS -> ingress integration.
// The resolver and handlers below are test fakes, not durable registry or S3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { createFixtureChannel } from '../../../../worker/qualification/checkpoint/fixture-channel.mjs';
import { createFixtureHttpsTransport } from '../../../../worker/qualification/checkpoint/fixture-transport.mjs';
import { createResumeAdmissionVerifier } from '../../../../worker/qualification/checkpoint/resume-admission.mjs';
import { createStaleWorkerChallenge } from '../../../../../scripts/qualification/sdk-stale-worker-challenge.mjs';
import { encodeFixtureRequest } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';
import { INGRESS_PATH, INGRESS_OPERATIONS } from '../config.mjs';
import { CERTS, TRUSTED_FINGERPRINT, TRUSTED_B_FINGERPRINT, startIngress, httpsCall, testClock, waitFor } from './harness.mjs';
import { NOW, fixture, requestFor, responseFor } from './fixture-data.mjs';

const PEER = Object.freeze({ peerId: 'fixture-worker-a', credentialId: 'cred-ingress-1' });
const serverPin = new X509Certificate(CERTS.serverCert).fingerprint256;
const driver = full => ({ runUuid: full.runUuid, sessionId: full.namespace.sessionId,
  attempt: full.identity.attempt, fence: full.identity.fence, operation: full.phase,
  deadlineMs: full.clock.deadlineMs });

function transport(port, { pinSha256 = serverPin, cert = CERTS.clientCert,
  key = CERTS.clientKey } = {}) {
  return createFixtureHttpsTransport({
    endpoint: { origin: `https://127.0.0.1:${port}`, path: INGRESS_PATH },
    approvedPorts: [port], identity: { pinSha256 },
    mtls: { cert, key, ca: CERTS.ca },
    limits: { requestBytes: 50 * 1024 * 1024, responseBytes: 50 * 1024 * 1024 },
    contentType: 'application/json', now: testClock(),
  });
}

test('A commit and B stale denial/load/verify cross the actual mTLS callback chain', async t => {
  const f = fixture();
  let replacementAdmitted = false;
  const seen = [];
  const { ingress, port, calls } = await startIngress(t, {
    resolver: ({ fingerprintSha256, operation }) => {
      if (fingerprintSha256 !== TRUSTED_FINGERPRINT) return null;
      return { peer: { ...PEER }, context: structuredClone(f.current),
        producer: structuredClone(f.producer), audience: operation === 'authorizeFixturePhase'
          ? [f.producer, f.current] : operation === 'commitFixtureCheckpoint'
            ? [f.producer] : [f.current] };
    },
    handlers: Object.fromEntries(INGRESS_OPERATIONS.map(operation => [operation,
      async ({ request, peer }) => {
        seen.push({ operation, phase: request.context.phase, peer });
        if (operation === 'authorizeFixturePhase' && replacementAdmitted &&
            request.context.phase === 'interrupt') {
          return { ...responseFor(f, request), status: 'DENIED_STALE_BINDING',
            currentContext: structuredClone(f.current) };
        }
        return responseFor(f, request);
      }])),
  });
  const wire = transport(port);
  let nextId = 0;
  const requestId = () => `00000000-0000-4000-9000-${(++nextId).toString(16).padStart(12, '0')}`;
  const original = createFixtureChannel({ transport: wire, producer: f.producer,
    current: f.producer, phaseDeadlineMs: NOW + 10000, requestId,
    fixtureFile: f.sentinel, evidence: f.evidence, now: testClock() });
  assert.equal(await original.gateway.authorize(driver(f.producer)), true);
  const reference = await original.checkpoint.commit({ context: driver(f.producer), bundle: f.bundle });
  assert.deepEqual(reference, f.reference);

  replacementAdmitted = true; // Test arrangement only; not an actual registry transaction.
  const resumed = createFixtureChannel({ transport: wire, producer: f.producer,
    current: f.current, phaseDeadlineMs: NOW + 10000, requestId,
    reference, now: testClock() });
  assert.equal(await resumed.gateway.authorize(driver(f.producer)), false);
  assert.equal(await resumed.gateway.authorize(driver(f.current)), true);
  const loaded = await resumed.checkpoint.load({ context: driver(f.current), reference });
  assert.deepEqual(loaded.bundle, f.bundle);
  assert.equal(loaded.receipt.completeRecoveryCheckpoint, false);
  assert.equal(loaded.receipt.sessionStoreQualified, false);
  assert.equal(await resumed.checkpoint.verify({ context: driver(f.current),
    bundle: loaded.bundle, reference }), true);

  assert.deepEqual(seen.map(({ operation }) => operation), [
    'authorizeFixturePhase', 'commitFixtureCheckpoint', 'authorizeFixturePhase',
    'authorizeFixturePhase',
    'loadFixtureCheckpoint', 'verifyFixtureCheckpoint',
  ]);
  assert.ok(seen.every(({ peer }) => peer.peerId === PEER.peerId));
  assert.equal(calls.resolver.length, 6);
  assert.ok(calls.resolver.every(query => query.fingerprintSha256 === TRUSTED_FINGERPRINT));
  assert.equal(await waitFor(() => ingress.activeConnections() === 0), true);
});

test('wrong server pin and an untrusted client certificate never dispatch', async t => {
  const f = fixture();
  let dispatched = 0;
  const { ingress, port, calls } = await startIngress(t, {
    resolver: () => ({ peer: { ...PEER }, context: f.current,
      producer: f.producer, audience: [f.producer, f.current] }),
    handlers: Object.fromEntries(INGRESS_OPERATIONS.map(operation => [operation,
      async ({ request }) => { dispatched++; return responseFor(f, request); }])),
  });
  const requestBytes = encodeFixtureRequest(requestFor(f, 'authorizeFixturePhase'), { nowMs: NOW });
  const call = { operation: 'authorizeFixturePhase', requestBytes, deadlineMs: NOW + 5000 };
  await assert.rejects(transport(port, { pinSha256: '0'.repeat(64) })(call),
    /FIXTURE_TRANSPORT_(?:IDENTITY|DISPATCH|CLOSED)/);
  await assert.rejects(transport(port, { cert: CERTS.rogueCert, key: CERTS.rogueKey })(call),
    /FIXTURE_TRANSPORT_(?:IDENTITY|DISPATCH|CLOSED)/);
  assert.equal(calls.resolver.length, 0);
  assert.equal(dispatched, 0);
  assert.equal(await waitFor(() => ingress.activeConnections() === 0), true);
});

test('separate A/B certificates keep B outside A audience while the owner performs A stale challenge', async t => {
  const f = fixture(), seen = [], now = testClock();
  const { ingress, port, calls } = await startIngress(t, {
    // Synthetic grant lookup with the same individual audiences as the durable
    // resolver. Actual PostgreSQL/ECS grant admission is a separate gate.
    resolver: ({ fingerprintSha256 }) => {
      const phase = fingerprintSha256 === TRUSTED_FINGERPRINT ? 'interrupt'
        : fingerprintSha256 === TRUSTED_B_FINGERPRINT ? 'resume' : null;
      if (!phase) return null;
      return { peer: { peerId: `fixture-worker-${phase === 'interrupt' ? 'a' : 'b'}`,
        credentialId: fingerprintSha256 }, producer: f.producer, context: f.current,
        audience: [phase === 'interrupt' ? f.producer : f.current] };
    },
    handlers: Object.fromEntries(INGRESS_OPERATIONS.map(operation => [operation,
      async ({ request, peer }) => {
        seen.push({ operation, phase: request.context.phase, peer });
        return request.context.phase === 'interrupt'
          ? { ...responseFor(f, request), status: 'DENIED_STALE_BINDING', currentContext: f.current }
          : responseFor(f, request);
      }])),
  });
  const originalA = transport(port), currentB = transport(port,
    { cert: CERTS.clientBCert, key: CERTS.clientBKey });
  const deadlineMs = NOW + 10000, requestId = () => '00000000-0000-4000-9000-000000000999';
  const b = createFixtureChannel({ transport: currentB, producer: f.producer,
    current: f.current, phaseDeadlineMs: deadlineMs, requestId, now });
  // This must remain a 403 transport refusal, never a stale-A witness.
  const wrongAudience = await httpsCall({ port, client: 'trusted-b',
    body: encodeFixtureRequest(requestFor(f, 'authorizeFixturePhase'), { nowMs: now() }) });
  assert.equal(wrongAudience.status, 403); assert.equal(wrongAudience.body.length, 0);
  await assert.rejects(b.gateway.authorize(driver(f.producer)), /FIXTURE_CHANNEL_TRANSPORT/);
  assert.equal(seen.length, 0);
  assert.equal(await b.gateway.authorize(driver(f.current)), true);
  const owner = createStaleWorkerChallenge({ transport: originalA, producer: f.producer,
    current: f.current, phaseDeadlineMs: deadlineMs, now });
  const admission = createResumeAdmissionVerifier({ admission: { producer: f.producer,
    current: f.current, staleWorkerChallenge: owner, requestId },
    scenario: { runUuid: f.producer.runUuid, sessionId: f.producer.namespace.sessionId,
      ...f.producer.clock, phaseDeadlineMs: deadlineMs }, now });
  assert.equal(await admission.verify(), true);
  assert.deepEqual(seen.map(({ phase, peer }) => [phase, peer.credentialId]), [
    ['resume', TRUSTED_B_FINGERPRINT], ['interrupt', TRUSTED_FINGERPRINT],
  ]);
  assert.deepEqual(calls.resolver.map(call => call.fingerprintSha256), [
    TRUSTED_B_FINGERPRINT, TRUSTED_B_FINGERPRINT, TRUSTED_B_FINGERPRINT, TRUSTED_FINGERPRINT,
  ]);
  assert.equal(await waitFor(() => ingress.activeConnections() === 0), true);
});
