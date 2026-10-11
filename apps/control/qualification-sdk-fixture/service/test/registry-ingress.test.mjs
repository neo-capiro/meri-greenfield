// Actual loopback mTLS plus isolated PostgreSQL current-fence integration.
// The checkpoint storage port below is synthetic; this is not S3 or ECS proof.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createFixtureIngress } from '../../ingress/index.mjs';
import { CERTS, TRUSTED_FINGERPRINT, TRUSTED_B_FINGERPRINT, httpsCall, waitFor }
  from '../../ingress/test/harness.mjs';
import { decodeFixtureResponse } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';
import { FixtureRegistry } from '../../state/registry.mjs';
import { PostgresStore } from '../../state/store.mjs';
import { createFixtureServiceHandlers } from '../handlers.mjs';
import { liveFixture, requestFor, wire } from './fixture.mjs';

const port = Number(process.env.MERI_FIXTURE_TEST_PORT);
const database = process.env.MERI_FIXTURE_TEST_DATABASE;
const enabled = Number.isInteger(port) && port > 0 && Boolean(database);
const peerA = Object.freeze({ peerId: 'synthetic-task-a', credentialId: TRUSTED_FINGERPRINT });
const peerB = Object.freeze({ peerId: 'synthetic-task-b', credentialId: TRUSTED_B_FINGERPRINT });

test('real mTLS credentials reach PostgreSQL current-fence decisions across A and B',
  { skip: !enabled && 'isolated PostgreSQL test database required' }, async t => {
    const f = liveFixture();
    const store = new PostgresStore({ host: '127.0.0.1', port, database,
      user: process.env.MERI_FIXTURE_TEST_USER });
    await store.migrateNewDatabase();
    const registry = new FixtureRegistry(store);
    await registry.admitRun({ context: f.producer, peer: peerA });
    let objectPreparations = 0;
    const checkpointStore = {
      prepareCommit: async () => { objectPreparations++; return {
        receipt: f.receipt, readback: f.readback }; },
      load: async () => ({ receipt: f.receipt, readback: f.readback,
        bundle: f.bundle, fixtureFile: f.sentinel }),
    };
    const handlers = createFixtureServiceHandlers({ registry, checkpointStore });
    const resolver = query => registry.resolveCertificate(query);
    async function start(resolveCredential) {
      const ingress = createFixtureIngress({ bind: { host: '127.0.0.1', port: 0 },
        tls: { cert: CERTS.serverCert, key: CERTS.serverKey, clientCa: CERTS.ca },
        resolveCredential, handlers, now: Date.now });
      const address = await ingress.start();
      t.after(() => ingress.close());
      return { ingress, port: address.port };
    }
    const active = await start(resolver);
    async function send(request, client = 'trusted', target = active) {
      const result = await httpsCall({ port: target.port, client, body: wire(request) });
      if (result.status !== 200) return result;
      return { ...result, decoded: decodeFixtureResponse(result.body, request,
        { producer: f.producer, nowMs: Date.now() }) };
    }

    assert.equal((await send(requestFor(f, 'authorizeFixturePhase'))).decoded.status, 'AUTHORIZED');
    assert.equal((await send(requestFor(f, 'commitFixtureCheckpoint'))).decoded.status, 'COMMITTED');
    assert.equal(objectPreparations, 1);
    assert.deepEqual((await registry.readPublication({ runUuid: f.producer.runUuid })).identity,
      f.reference);
    assert.equal((await registry.replaceRun({ context: f.current, peer: peerB })).outcome, 'REPLACED');
    const stale = await send(requestFor(f, 'authorizeFixturePhase'));
    assert.equal(stale.decoded.status, 'STALE_BINDING_DENIED');
    assert.deepEqual(stale.decoded.response.currentContext, f.current);
    const currentRequest = requestFor(f, 'authorizeFixturePhase');
    currentRequest.context = structuredClone(f.current);
    assert.equal((await send(currentRequest, 'trusted-b')).decoded.status, 'AUTHORIZED');
    const loaded = await send(requestFor(f, 'loadFixtureCheckpoint'), 'trusted-b');
    assert.equal(loaded.decoded.status, 'LOADED');
    assert.deepEqual(loaded.decoded.response.bundle, f.bundle);
    assert.equal((await send(requestFor(f, 'verifyFixtureCheckpoint'), 'trusted-b')).decoded.status,
      'VERIFIED');
    const lateCommit = await send(requestFor(f, 'commitFixtureCheckpoint'));
    assert.equal(lateCommit.status, 500);
    assert.equal(lateCommit.body.length, 0);
    assert.equal(objectPreparations, 1, 'revoked A causes no second storage preparation');

    const wrongPeer = await send(requestFor(f, 'authorizeFixturePhase'), 'trusted-b');
    assert.equal(wrongPeer.status, 403);
    assert.equal(wrongPeer.body.length, 0);
    const wrongCurrent = structuredClone(f.current);
    wrongCurrent.identity.grantId = '00000000-0000-4000-9000-000000000999';
    const substituted = await start(async query => {
      const binding = await resolver(query);
      return binding === null ? null : { ...binding, context: wrongCurrent };
    });
    const refusal = await send(requestFor(f, 'authorizeFixturePhase'), 'trusted', substituted);
    assert.equal(refusal.status, 500);
    assert.equal(refusal.body.length, 0, 'no forged current context becomes a stale reply');
    assert.equal(await waitFor(() => active.ingress.activeConnections() === 0), true);
    assert.equal(await waitFor(() => substituted.ingress.activeConnections() === 0), true);
  });
