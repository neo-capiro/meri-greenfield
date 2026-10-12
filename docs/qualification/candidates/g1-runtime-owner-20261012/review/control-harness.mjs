// Reviewer-only source integration. No database, TLS engine, socket or AWS call.
// Real control/ingress/handler/registry code consumes scripted external boundaries.
import assert from 'node:assert/strict';
import https from 'node:https';
import { EventEmitter } from 'node:events';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { liveFixture, requestFor } from '../../../../../apps/control/qualification-sdk-fixture/service/test/fixture.mjs';
import { encodeFixtureRequest, decodeFixtureResponse } from '../../../../../packages/contracts/qualification-sdk/wire.mjs';

const root = process.env.G1_OWNER_SOURCE_ROOT ?? resolve('.');
const source = path => import(pathToFileURL(resolve(root, path)));
const { fakeS3, bucket, kmsKeyArn } = await source('apps/control/qualification-sdk-fixture/service/test/fake-s3.mjs');
export const { PostgresStore } = await source('apps/control/qualification-sdk-fixture/state/store.mjs');
export const { CommitUncertain } = await source('apps/control/qualification-sdk-fixture/state/errors.mjs');
const { createFixtureControl } = await source('apps/control/qualification-sdk-fixture/service/control.mjs');
const prefix = 'meri_qualification_sdk_fixture.';
const digest = value => createHash('sha256').update(value).digest('hex');
const clone = structuredClone;

class ScriptedStore extends PostgresStore {
  constructor(clock) {
    super({ host: '127.0.0.1', port: 1, database: 'meri_qualification_sdk_fixture_review', user: 'synthetic' });
    this.clock = clock;
    this.runs = new Map(); this.grants = new Map(); this.commits = new Map();
    this.calls = []; this.transactionCount = 0;
    this.beforeQuery = async () => {};
    this.afterTransaction = async () => {};
  }

  async transact(operation) {
    const transaction = ++this.transactionCount;
    const queries = [];
    const result = await operation({ query: async (sql, values = []) => {
      const call = { transaction, sql, values: clone(values) };
      this.calls.push(call); queries.push(call);
      await this.beforeQuery(call);
      if (sql === 'SELECT clock_timestamp() AS now') return { rowCount: 1, rows: [{ now: new Date(this.clock()) }] };
      const insert = sql.match(/^INSERT INTO meri_qualification_sdk_fixture\.(runs|grants|commits) \(([^)]+)\)/);
      if (insert) {
        const row = Object.fromEntries(insert[2].split(',').map((key, i) => [key.trim(), clone(values[i])]));
        const table = this[insert[1]], key = row.grant_id && insert[1] === 'grants' ? row.grant_id : row.run_uuid;
        assert.equal(table.has(key), false, 'script rejects duplicate insert');
        if (insert[1] === 'grants') row.revoked_at = null;
        table.set(key, row);
        return { rowCount: 1, rows: [{ commit_id: row.commit_id }] };
      }
      if (sql.startsWith(`UPDATE ${prefix}grants SET state = 'REVOKED'`)) {
        const row = this.grants.get(values[0]);
        if (!row || row.state !== 'ACTIVE') return { rowCount: 0, rows: [] };
        row.state = 'REVOKED'; row.revoked_at = new Date(this.clock());
        return { rowCount: 1, rows: [] };
      }
      if (sql.startsWith(`UPDATE ${prefix}runs SET current_attempt`)) {
        const row = this.runs.get(values[0]); assert.ok(row);
        const keys = ['current_attempt', 'current_fence', 'current_grant_id', 'current_mapping_id',
          'current_task_arn', 'current_attempt_id', 'current_worker_id', 'current_peer_id',
          'current_credential_id', 'current_admitted_at_ms', 'current_expires_at_ms'];
        keys.forEach((key, i) => { row[key] = values[i + 1]; });
        return { rowCount: 1, rows: [] };
      }
      let rows;
      if (sql.startsWith(`SELECT run_uuid FROM ${prefix}grants WHERE credential_id`)) {
        rows = [...this.grants.values()].filter(row => row.credential_id === values[0]).map(row => ({ run_uuid: row.run_uuid }));
      } else if (sql.startsWith(`SELECT * FROM ${prefix}grants WHERE run_uuid`)) {
        rows = [...this.grants.values()].filter(row => row.run_uuid === values[0]).sort((a, b) => a.attempt - b.attempt);
      } else if (sql.startsWith('SELECT') && sql.includes(`FROM ${prefix}runs WHERE run_uuid`)) {
        assert.match(sql, /FOR UPDATE$/); rows = [this.runs.get(values[0])].filter(Boolean);
      } else if (sql.startsWith('SELECT') && sql.includes(`FROM ${prefix}grants WHERE grant_id`)) {
        assert.match(sql, /FOR UPDATE$/); rows = [this.grants.get(values[0])].filter(Boolean);
      } else if (sql.startsWith('SELECT') && sql.includes(`FROM ${prefix}commits WHERE run_uuid`)) {
        rows = [this.commits.get(values[0])].filter(Boolean);
      } else throw new Error('UNSUPPORTED_SCRIPTED_DATABASE_BOUNDARY');
      return { rowCount: rows.length, rows: clone(rows) };
    } });
    await this.afterTransaction({ transaction, queries, result });
    return result;
  }
}

export function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

export async function fixture() {
  const f = liveFixture();
  let clock = Date.now();
  const store = new ScriptedStore(() => clock), s3 = fakeS3();
  const certificates = { a: Buffer.from('synthetic-transport-peer-a'), b: Buffer.from('synthetic-transport-peer-b') };
  const peerA = { peerId: 'synthetic-task-a', credentialId: digest(certificates.a) };
  const peerB = { peerId: 'synthetic-task-b', credentialId: digest(certificates.b) };
  let server, callback;
  const original = https.createServer;
  https.createServer = (_options, onRequest) => {
    callback = onRequest;
    server = new EventEmitter(); server.listening = false;
    server.address = () => server.listening ? { address: '127.0.0.1', port: 1 } : null;
    server.listen = () => { server.listening = true; queueMicrotask(() => server.emit('listening')); };
    server.close = done => { server.listening = false; done?.(); };
    return server;
  };
  let control;
  const inspector = { verify: async () => true };
  try {
    control = createFixtureControl({ database: store, objectClient: s3.client, bucket, kmsKeyArn,
      evidenceInspector: inspector, bind: { host: '127.0.0.1', port: 0 },
      tls: { cert: 'synthetic-not-a-certificate', key: 'synthetic-not-a-key', clientCa: 'synthetic-not-a-ca' },
      limits: { bodyMs: 500, handlerMs: 2000 }, now: () => clock });
  } finally { https.createServer = original; }
  await control.registry.admitRun({ context: f.producer, peer: peerA });

  function send(operation, { context, peer = 'a', request } = {}) {
    const input = request ?? requestFor(f, operation);
    if (context) input.context = clone(context);
    const raw = encodeFixtureRequest(input, { nowMs: clock });
    const req = new EventEmitter(), res = new EventEmitter(), socket = new EventEmitter();
    socket.authorized = true;
    socket.getPeerCertificate = () => ({ raw: certificates[peer] });
    socket.destroyed = false;
    socket.destroy = () => { if (!socket.destroyed) { socket.destroyed = true; socket.emit('close'); } };
    Object.assign(req, { socket, httpVersion: '1.1', method: 'POST', url: '/v1/qualification/sdk-fixture/interruption',
      rawHeaders: ['host', 'synthetic', 'content-type', 'application/json', 'content-length', String(raw.length)] });
    const done = deferred();
    res.socket = socket; res.headers = {};
    res.setHeader = (key, value) => { res.headers[key] = value; };
    res.end = body => { done.resolve({ status: res.statusCode, body: body ?? Buffer.alloc(0), input }); res.emit('finish'); };
    server.emit('connection', socket);
    callback(req, res);
    req.emit('data', raw); req.emit('end');
    return { promise: done.promise, socket };
  }
  async function committed() {
    const response = await send('commitFixtureCheckpoint').promise;
    assert.equal(response.status, 200);
    const decoded = decodeFixtureResponse(response.body, response.input, { producer: f.producer, nowMs: clock });
    f.receipt = decoded.response.receipt;
    const row = store.commits.get(f.producer.runUuid);
    f.reference = { receiptId: row.receipt_id, receiptSha256: row.receipt_sha256 };
    return decoded;
  }
  async function replace() {
    f.current.identity.admittedAtMs = clock + 1; clock += 2;
    return control.registry.replaceRun({ context: f.current, peer: peerB });
  }
  return { f, store, s3, inspector, control, peerA, peerB, send, committed, replace,
    now: () => clock, setNow: value => { clock = value; },
    close: () => control.close() };
}
