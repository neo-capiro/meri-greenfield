// Full trusted source path: real loopback mTLS and isolated PostgreSQL, fake S3.
// No cloud task, S3 request, provider call or native evidence is produced here.
import test from 'node:test';
import assert from 'node:assert/strict';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { createFixtureControl } from '../control.mjs';
import { PostgresStore } from '../../state/store.mjs';
import { CERTS, TRUSTED_FINGERPRINT, TRUSTED_B_FINGERPRINT, httpsCall, waitFor }
  from '../../ingress/test/harness.mjs';
import { decodeFixtureResponse } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';
import { fixtureReceiptIdentity } from '../../../../../packages/contracts/qualification-sdk/validate.mjs';
import { liveFixture, requestFor, wire } from './fixture.mjs';
import { bucket, kmsKeyArn, fakeS3 } from './fake-s3.mjs';

const port = Number(process.env.MERI_FIXTURE_TEST_PORT);
const database = process.env.MERI_FIXTURE_TEST_DATABASE;
const enabled = Number.isInteger(port) && port > 0 && Boolean(database);
const peerA = Object.freeze({ peerId: 'synthetic-task-a', credentialId: TRUSTED_FINGERPRINT });
const peerB = Object.freeze({ peerId: 'synthetic-task-b', credentialId: TRUSTED_B_FINGERPRINT });

test('composition refuses a missing inspector before object or listener allocation', () => {
  const store = new PostgresStore({ host: '127.0.0.1', port: 5432,
    database: 'meri_qualification_sdk_fixture_test', user: 'synthetic' });
  const s3 = fakeS3();
  assert.throws(() => createFixtureControl({ database: store, bucket, kmsKeyArn,
    objectClient: s3.client }), /FIXTURE_CONTROL_CONFIGURATION/);
  assert.equal(s3.calls.length, 0);
});

test('A commit is versioned, B rereads it through the current fence, A is revoked',
  { skip: !enabled && 'isolated PostgreSQL test database required' }, async t => {
    const f = liveFixture(), s3 = fakeS3();
    const store = new PostgresStore({ host: '127.0.0.1', port, database,
      user: process.env.MERI_FIXTURE_TEST_USER });
    await store.migrateNewDatabase();
    let inspections = 0;
    const control = createFixtureControl({ database: store, bucket, kmsKeyArn,
      objectClient: s3.client, bind: { host: '127.0.0.1', port: 0 },
      tls: { cert: CERTS.serverCert, key: CERTS.serverKey, clientCa: CERTS.ca },
      evidenceInspector: { verify: async ({ producer, evidence }) => {
        assert.deepEqual(producer, f.producer);
        assert.deepEqual(evidence, f.evidence);
        inspections++;
        return true;
      } } });
    t.after(() => control.close());
    assert.equal(control.address(), null);
    assert.equal(s3.calls.length, 0);
    await control.registry.admitRun({ context: f.producer, peer: peerA });
    const address = await control.start();
    async function send(request, client = 'trusted') {
      const result = await httpsCall({ port: address.port, client, body: wire(request) });
      if (result.status !== 200) return result;
      return { ...result, decoded: decodeFixtureResponse(result.body, request,
        { producer: f.producer, nowMs: Date.now() }) };
    }

    assert.equal((await send(requestFor(f, 'authorizeFixturePhase'))).decoded.status, 'AUTHORIZED');
    const committed = await send(requestFor(f, 'commitFixtureCheckpoint'));
    assert.equal(committed.decoded.status, 'COMMITTED');
    assert.equal(inspections, 1);
    f.receipt = committed.decoded.response.receipt;
    f.reference = fixtureReceiptIdentity(f.receipt);
    assert.deepEqual((await control.registry.readPublication({ runUuid: f.producer.runUuid })).identity,
      f.reference);
    assert.equal(s3.calls.filter(c => c.type === 'PutObjectCommand').length, 3);
    assert.equal(s3.calls.filter(c => c.type === 'GetObjectCommand').length, 3);
    const unadmitted = await send(requestFor(f, 'loadFixtureCheckpoint'), 'trusted-b');
    assert.equal(unadmitted.status, 403);
    assert.equal(unadmitted.body.length, 0);

    // The real store stamps its receipt at commit time. B's trusted admission
    // must be later; the static fixture's historical B timestamp is too early.
    await new Promise(resolve => setTimeout(resolve, 5));
    f.current.identity.admittedAtMs = Date.now();
    assert(f.current.identity.admittedAtMs > f.receipt.commit.committedAtMs);
    assert.equal((await control.registry.replaceRun({ context: f.current, peer: peerB })).outcome,
      'REPLACED');
    const stale = await send(requestFor(f, 'authorizeFixturePhase'));
    assert.equal(stale.decoded.status, 'STALE_BINDING_DENIED');
    const bAuth = requestFor(f, 'authorizeFixturePhase');
    bAuth.context = structuredClone(f.current);
    assert.equal((await send(bAuth, 'trusted-b')).decoded.status, 'AUTHORIZED');
    const loaded = await send(requestFor(f, 'loadFixtureCheckpoint'), 'trusted-b');
    assert.equal(loaded.decoded.status, 'LOADED');
    assert.deepEqual(loaded.decoded.response.bundle, f.bundle);
    assert.deepEqual(loaded.decoded.response.fixtureFile, f.sentinel);
    assert.equal((await send(requestFor(f, 'verifyFixtureCheckpoint'), 'trusted-b')).decoded.status,
      'VERIFIED');
    assert.equal(s3.calls.filter(c => c.type === 'GetObjectCommand').length, 9);

    s3.alter();
    const corrupted = await send(requestFor(f, 'loadFixtureCheckpoint'), 'trusted-b');
    assert.equal(corrupted.status, 500);
    assert.equal(corrupted.body.length, 0);

    const late = await send(requestFor(f, 'commitFixtureCheckpoint'));
    assert.equal(late.status, 500);
    assert.equal(late.body.length, 0);
    assert.equal(inspections, 1);
    assert.equal(s3.calls.filter(c => c.type === 'PutObjectCommand').length, 3);
    assert.equal(await waitFor(() => control.activeConnections() === 0), true);
    const originalSend = s3.client.send;
    let entered, release;
    const didEnter = new Promise(resolve => { entered = resolve; });
    const gate = new Promise(resolve => { release = resolve; });
    let paused = false;
    s3.client.send = async command => {
      if (!paused && command instanceof GetObjectCommand) {
        paused = true;
        entered();
        await gate;
      }
      return originalSend(command);
    };
    const pending = send(requestFor(f, 'loadFixtureCheckpoint'), 'trusted-b').catch(() => null);
    await didEnter;
    assert.equal(control.activeOperations(), 1);
    const closing = control.close();
    const closedEarly = await Promise.race([
      closing.then(() => true), new Promise(resolve => setTimeout(() => resolve(false), 20)),
    ]);
    assert.equal(closedEarly, false, 'shutdown waits for the exact unsettled read');
    release();
    await closing;
    await pending;
    assert.equal(control.activeOperations(), 0);
    assert.equal(control.address(), null);
  });
