// Synthetic callback -> private wire -> real HTTPS/mTLS -> ingress integration.
// The resolver and handlers below are test fakes, not durable registry or S3.
import test from 'node:test';
import assert from 'node:assert/strict';
import { X509Certificate } from 'node:crypto';
import { createFixtureChannel } from '../../../../worker/qualification/checkpoint/fixture-channel.mjs';
import { createFixtureHttpsTransport } from '../../../../worker/qualification/checkpoint/fixture-transport.mjs';
import { encodeFixtureRequest } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';
import { INGRESS_PATH, INGRESS_OPERATIONS } from '../config.mjs';
import { CERTS, TRUSTED_FINGERPRINT, startIngress, testClock, waitFor } from './harness.mjs';
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
  const loaded = await resumed.checkpoint.load({ context: driver(f.current), reference });
  assert.deepEqual(loaded.bundle, f.bundle);
  assert.equal(loaded.receipt.completeRecoveryCheckpoint, false);
  assert.equal(loaded.receipt.sessionStoreQualified, false);
  assert.equal(await resumed.checkpoint.verify({ context: driver(f.current),
    bundle: loaded.bundle, reference }), true);

  assert.deepEqual(seen.map(({ operation }) => operation), [
    'authorizeFixturePhase', 'commitFixtureCheckpoint', 'authorizeFixturePhase',
    'loadFixtureCheckpoint', 'verifyFixtureCheckpoint',
  ]);
  assert.ok(seen.every(({ peer }) => peer.peerId === PEER.peerId));
  assert.equal(calls.resolver.length, 5);
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
