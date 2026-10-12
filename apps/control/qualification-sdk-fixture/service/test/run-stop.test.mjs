// Actual owner/registry source, scripted transaction rows and inert HTTPS stub.
// No listener, credential, database engine, cloud client or native process runs.
import test from 'node:test';
import assert from 'node:assert/strict';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { createFixtureControl } from '../control.mjs';
import { createRunStop } from '../run-stop.mjs';
import { FixtureRegistry } from '../../state/registry.mjs';
import { PostgresStore } from '../../state/store.mjs';
import { CommitUncertain } from '../../state/errors.mjs';
import { liveFixture, requestFor } from './fixture.mjs';
import { bucket, kmsKeyArn, fakeS3 } from './fake-s3.mjs';

class ScriptedStore extends PostgresStore {
  constructor(now) {
    super({ host: '127.0.0.1', port: 1, database: 'meri_qualification_sdk_fixture_source', user: 'synthetic' });
    this.now = now; this.run = null; this.grant = null; this.writes = 0; this.unknown = null; this.park = null;
  }
  async transact(operation) {
    let wrote = false;
    const result = await operation({ query: async (sql, args) => {
      if (sql.startsWith('INSERT')) {
        const columns = sql.match(/\(([^)]+)\) VALUES/)[1].split(',').map(s => s.trim());
        const row = Object.fromEntries(columns.map((column, i) => [column, args[i]]));
        if (sql.includes('.runs')) this.run = row;
        else { this.grant = row; this.grant.revoked_at = null; }
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith('UPDATE')) {
        assert.match(sql, /grants SET state = 'REVOKED'/);
        if (this.park) await this.park;
        this.grant.state = 'REVOKED'; this.grant.revoked_at = new Date(this.now());
        this.writes++; wrote = true; return { rowCount: 1, rows: [] };
      }
      if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now: new Date(this.now()) }] };
      if (sql.includes('.runs')) return { rows: this.run ? [this.run] : [] };
      if (sql.includes('.grants')) return { rows: this.grant ? [this.grant] : [] };
      throw new Error('UNEXPECTED_SOURCE_SQL');
    } });
    if (wrote && this.unknown) throw this.unknown;
    return result;
  }
}
async function setup() {
  const f = liveFixture(), peer = { peerId: 'synthetic-a', credentialId: 'synthetic-a' };
  let at = Date.now();
  const store = new ScriptedStore(() => at), registry = new FixtureRegistry(store);
  await registry.admitRun({ context: f.producer, peer });
  const owner = createRunStop({ registry, now: () => at });
  const input = { context: f.producer, peer };
  const call = { request: requestFor(f, 'commitFixtureCheckpoint'), peer, producer: f.producer,
    context: f.producer, signal: new AbortController().signal };
  return { f, peer, store, registry, owner, input, call, now: () => at, setNow: value => { at = value; } };
}

test('actual control.stopRun consumes canonical registry and preserves raw registry API', async () => {
  const h = await setup(), original = https.createServer;
  let serverCalls = 0;
  https.createServer = () => { serverCalls++; const server = new EventEmitter();
    server.address = () => null; server.listening = false;
    server.listen = () => { throw new Error('NO_LISTENER_ALLOWED'); }; return server; };
  let control;
  try { control = createFixtureControl({ database: h.store, evidenceInspector: { verify: async () => true },
    bucket, kmsKeyArn, objectClient: fakeS3().client, bind: { host: '127.0.0.1', port: 0 },
    tls: { cert: 'inert', key: 'inert', clientCa: 'inert' }, now: h.now }); }
  finally { https.createServer = original; }
  assert.equal(serverCalls, 1); assert.ok(control.registry instanceof FixtureRegistry);
  assert.deepEqual(control.runStatus(h.input), { stopRequested: false, revocation: 'NOT_REQUESTED',
    activeOperations: 0, publicationUncertain: false });
  const first = control.stopRun(h.input), repeated = control.stopRun(h.input);
  assert.equal(first, repeated); assert.equal((await first).outcome, 'REVOKED');
  assert.equal(h.store.grant.state, 'REVOKED'); assert.equal(h.store.writes, 1);
  await control.close();
});

test('synchronous stop gate prevents queued and later matching handlers', async () => {
  const h = await setup(); let effects = 0;
  const work = h.owner.track(async () => { effects++; }, h.call);
  const stopped = h.owner.stopRun(h.input);
  await assert.rejects(work, /FIXTURE_CONTROL_STOPPED/);
  assert.throws(() => h.owner.track(async () => { effects++; }, h.call), /FIXTURE_CONTROL_STOPPED/);
  assert.equal((await stopped).outcome, 'REVOKED'); assert.equal(effects, 0);
});

test('already running handler is aborted, settled and cannot hide publication uncertainty', async () => {
  const h = await setup(); let entered, release, observedSignal;
  const started = new Promise(r => { entered = r; }), parked = new Promise(r => { release = r; });
  const work = h.owner.track(async input => { observedSignal = input.signal; entered(); await parked;
    throw new CommitUncertain(); }, h.call);
  await started;
  const stopped = h.owner.stopRun(h.input);
  assert.equal(observedSignal.aborted, true);
  release(); await assert.rejects(work, CommitUncertain); await assert.rejects(stopped, CommitUncertain);
  assert.equal(h.owner.runStatus(h.input).publicationUncertain, true);
  assert.equal(h.owner.runStatus(h.input).activeOperations, 0);
  h.owner.closeAdmission(); await assert.rejects(h.owner.settleForClose(), CommitUncertain);
});

test('unknown revocation remains visible and repeating stop never retries', async () => {
  const h = await setup(); h.store.unknown = new CommitUncertain();
  const attempt = h.owner.stopRun(h.input);
  await assert.rejects(attempt, e => e === h.store.unknown);
  assert.equal(h.owner.stopRun(h.input), attempt);
  assert.equal(h.owner.runStatus(h.input).revocation, 'UNCERTAIN');
  assert.equal(h.store.writes, 1);
  h.owner.closeAdmission(); await assert.rejects(h.owner.settleForClose(), CommitUncertain);
});

test('wrong full binding does not abort the authenticated matching handler', async () => {
  const h = await setup(); let entered, release, signal;
  const started = new Promise(r => { entered = r; }), parked = new Promise(r => { release = r; });
  const work = h.owner.track(async input => { signal = input.signal; entered(); await parked; return true; }, h.call);
  await started;
  const wrong = structuredClone(h.input); wrong.context.pins.skillsManifestSha256 = 'f'.repeat(64);
  await assert.rejects(h.owner.stopRun(wrong), /FIXTURE_REVOCATION_BINDING/);
  assert.equal(signal.aborted, false); assert.equal(h.store.writes, 0);
  release(); assert.equal(await work, true);
});

test('cleanup cutoff bounds waiting but retains an issued late revocation', async () => {
  const h = await setup(); let release;
  h.setNow(h.f.producer.clock.cleanupDeadlineMs - 15);
  h.store.park = new Promise(r => { release = r; });
  const attempt = h.owner.stopRun(h.input);
  await assert.rejects(attempt, /FIXTURE_CONTROL_UNSETTLED/);
  assert.equal(h.owner.runStatus(h.input).revocation, 'PENDING');
  assert.equal(h.owner.stopRun(h.input), attempt);
  release(); await new Promise(r => setImmediate(r));
  assert.equal(h.owner.runStatus(h.input).revocation, 'REVOKED');
  assert.equal(h.store.writes, 1);
});
test('owner entrypoints reject top-level effectful or extra fields without evaluation', async () => {
  const h = await setup(); let reads = 0;
  for (const method of ['stopRun', 'runStatus']) {
    const hostile = { peer: h.peer };
    Object.defineProperty(hostile, 'context', { enumerable: true, get() { reads++; return h.f.producer; } });
    assert.throws(() => h.owner[method](hostile));
    assert.throws(() => h.owner[method]({ ...h.input, extra: true }));
  }
  assert.equal(reads, 0); assert.equal(h.store.writes, 0);
});
test('reentrant abort listener receives the already reserved stop attempt', async () => {
  const h = await setup(); let entered, release, second;
  const started = new Promise(r => { entered = r; }), parked = new Promise(r => { release = r; });
  const work = h.owner.track(async input => { input.signal.addEventListener('abort', () => {
    second = h.owner.stopRun(h.input);
  }, { once: true }); entered(); await parked; }, h.call);
  await started;
  const first = h.owner.stopRun(h.input);
  release(); await work;
  await first;
  assert.equal(first, second); assert.equal(h.store.writes, 1);
});
