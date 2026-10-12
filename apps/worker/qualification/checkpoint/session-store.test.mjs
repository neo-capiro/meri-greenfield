import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemorySessionStore } from '@anthropic-ai/claude-agent-sdk';
import { createRunBoundSessionStore } from './bound-session-store.mjs';
import { verifySessionStoreSnapshot } from './verify-session-store.mjs';

const uuid = n => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const binding = { tenantId: 'synthetic-tenant', actorId: 'synthetic-actor', conversationId: uuid(1),
  runId: uuid(2), attemptId: uuid(3), workerId: uuid(4), writerFence: 1 };
const key = { projectKey: '-workspace-conversation', sessionId: uuid(5) };
const main = [
  { type: 'user', uuid: uuid(6), unknown: { nested: [null, false, 0, 'verbatim'] } },
  { type: 'system', mode: 'unknown-future-mode' },
  { type: 'system', mode: 'unknown-future-mode' },
  { type: 'system', compact: { opaque: true, retained: ['original'] } },
];
const subkey = { ...key, subpath: 'subagents/agent-synthetic' };
const subentries = [{ type: 'assistant', uuid: uuid(7), unknown: { subagent: true } }];
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
function fixture(overrides = {}, options = {}) {
  const backend = new InMemorySessionStore(), calls = [];
  const transport = Object.fromEntries(['append', 'load', 'listSubkeys'].map(method => [method, async request => {
    calls.push({ method, binding: request.binding, key: request.key });
    assert.deepEqual(request.binding, binding);
    return method === 'append' ? backend.append(request.key, request.entries) : backend[method](request.key);
  }]));
  Object.assign(transport, overrides);
  return { backend, calls, ...createRunBoundSessionStore({ binding, sessionKey: key, transport, ...options }) };
}

test('pinned SDK interface roundtrips unknown/compaction fields and repeated UUID-less entries', async () => {
  const f = fixture();
  await f.store.append(key, main); await f.store.append(subkey, subentries);
  assert.deepEqual(await f.store.load(key), main);
  assert.deepEqual(await f.store.listSubkeys(key), [subkey.subpath]);
  assert.deepEqual(await f.store.load(subkey), subentries);
  assert.equal(f.store.delete, undefined); assert.equal(f.store.listSessions, undefined);
  assert.ok(f.calls.every(c => c.binding.writerFence === 1));
});

test('all append calls are delivered in call order even when an earlier commit is delayed', async () => {
  const gate = deferred(), started = deferred(), delivered = [];
  const f = fixture({ append: async request => {
    delivered.push(request.entries[0].ordinal);
    if (delivered.length === 1) { started.resolve(); await gate.promise; }
  } });
  const first = f.store.append(key, [{ type: 'system', ordinal: 1 }]);
  const second = f.store.append(subkey, [{ type: 'system', ordinal: 2 }]);
  await started.promise; assert.deepEqual(delivered, [1]);
  gate.resolve(); await Promise.all([first, second]); assert.deepEqual(delivered, [1, 2]);
});

test('input and loaded values cannot mutate stored state or trusted binding', async () => {
  const mutableBinding = structuredClone(binding), entries = structuredClone(main);
  let seen;
  const f = fixture({ append: async request => { seen = request; } }, { binding: mutableBinding });
  const write = f.store.append(key, entries); entries[0].unknown.nested[3] = 'changed'; mutableBinding.writerFence = 99;
  await write;
  assert.equal(seen.binding.writerFence, 1); assert.ok(Object.isFrozen(seen.binding));
  assert.deepEqual(seen.entries, main);
  const g = fixture(); await g.store.append(key, main);
  const loaded = await g.store.load(key); loaded[0].unknown.nested[3] = 'changed';
  assert.deepEqual(await g.store.load(key), main);
});

test('foreign session/project and malformed key refuse before transport', async () => {
  const f = fixture();
  for (const bad of [{ ...key, sessionId: uuid(99) }, { ...key, projectKey: 'foreign' },
    { ...key, subpath: '' }, { ...key, subpath: null }, { ...key, extra: true }]) {
    await assert.rejects(f.store.append(bad, main), /SESSION_KEY_SCOPE/);
    await assert.rejects(f.store.load(bad), /SESSION_KEY_SCOPE/);
  }
  await assert.rejects(f.store.listSubkeys(subkey), /SESSION_KEY_SCOPE/);
  assert.equal(f.calls.length, 0);
});

test('JSON-unsafe entries and payload/entry bounds refuse before transport', async () => {
  const f = fixture(); const cycle = { type: 'system' }; cycle.self = cycle;
  for (const entries of [[{ type: 'system', bad: undefined }], [{ type: 'system', bad: NaN }],
    [{ type: 'system', bad: new Date() }], [cycle], [{}], Array(1001).fill({ type: 'system' }),
    [{ type: 'system', text: 'x'.repeat(8 * 1024 * 1024) }]])
    await assert.rejects(f.store.append(key, entries), /SESSION_/);
  assert.equal(f.calls.length, 0);
});

test('invalid canonical binding, missing subkey transport and timeout policy fail at construction', () => {
  for (const options of [{ binding: { ...binding, writerFence: 0 } }, { binding: { ...binding, extra: true } },
    { timeoutMs: 0 }, { timeoutMs: 30001 }, { transport: { append() {}, load() {} } }])
    assert.throws(() => fixture({}, options), /SESSION_/);
});

test('transport errors are redacted, and a successful SDK retry can follow a definite rejection', async () => {
  let count = 0;
  const f = fixture({ append: async () => { if (++count === 1) throw Object.assign(new Error('private provider detail'), { code: 'SESSION_WRITE_REJECTED' }); } });
  await assert.rejects(f.store.append(key, main), { message: 'SESSION_TRANSPORT_FAILED' });
  await f.store.append(key, main);
  const state = await f.settleObservedCalls();
  assert.equal(state.appendFailures, 1); assert.equal(count, 2); assert.equal(state.uncertain, false);
});

test('uncertain timeout aborts its signal and refuses queued/retried dispatch', async () => {
  const pending = deferred(); let count = 0, signal;
  const f = fixture({ append: request => { count++; signal = request.signal; return pending.promise; } }, { timeoutMs: 10 });
  const first = assert.rejects(f.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  const second = assert.rejects(f.store.append(subkey, subentries), /SESSION_TRANSPORT_UNCERTAIN/);
  await Promise.all([first, second]);
  await assert.rejects(f.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  assert.equal(count, 1); assert.equal(signal.aborted, true);
  assert.equal((await f.settleObservedCalls()).uncertain, true);
  pending.resolve(); // This late remote completion cannot authorize another write.
});

test('closing rejects late SDK writes; observed settlement is not labelled durable', async () => {
  const gate = deferred(), f = fixture({ append: () => gate.promise });
  const write = f.store.append(key, main); f.closeMirror();
  await assert.rejects(f.store.append(key, main), /SESSION_MIRROR_CLOSED/);
  f.recordMirrorError({ type: 'system', subtype: 'mirror_error' });
  gate.resolve(); await write;
  assert.deepEqual(await f.settleObservedCalls(), { pending: 0, closed: true, uncertain: false,
    appendFailures: 0, rejectedAppends: 1, mirrorErrors: 1 });
});

test('trusted execution boundary can reject an obsolete generation before append', async () => {
  let currentFence = 2, writes = 0;
  const f = fixture({ append: async request => {
    if (request.binding.writerFence !== currentFence) throw Object.assign(new Error('STALE'), { code: 'SESSION_WRITE_REJECTED' });
    writes++;
  } });
  await assert.rejects(f.store.append(key, main), /SESSION_TRANSPORT_FAILED/); assert.equal(writes, 0);
  // Synthetic transport predicate only: actual gateway atomic commit remains a live gate.
  assert.equal(currentFence, 2);
});

test('unknown append rejection is treated as possibly committed and is never retried by dispatch', async () => {
  let writes = 0;
  const f = fixture({ append: async () => { writes++; throw new Error('connection lost after commit'); } });
  await assert.rejects(f.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  await assert.rejects(f.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  assert.equal(writes, 1);
});

test('full transcripts can exceed one append batch without truncation', async () => {
  const f = fixture(), expected = Array.from({ length: 1500 }, (_, ordinal) => ({ type: 'system', ordinal }));
  await f.store.append(key, expected.slice(0, 1000)); await f.store.append(key, expected.slice(1000));
  assert.deepEqual(await f.store.load(key), expected);
  const result = await verifySessionStoreSnapshot(f.store, key, [{ entries: expected }]);
  assert.equal(result.entries, 1500);
});

test('whole-snapshot verification checks ordered main/subagent entries and produces readback-only digest', async () => {
  const f = fixture(); await f.store.append(key, main); await f.store.append(subkey, subentries);
  const result = await verifySessionStoreSnapshot(f.store, key, [{ entries: main }, { subpath: subkey.subpath, entries: subentries }]);
  assert.equal(result.kind, 'session-mirror-readback-only'); assert.equal(result.entries, 5);
  assert.equal(result.transcripts, 2); assert.match(result.sha256, /^[a-f0-9]{64}$/);
  assert.equal(result.durableReceiptId, undefined);
});

test('missing, changed, reordered, duplicated or omitted UUID-less transcript records fail verification', async () => {
  const f = fixture(); await f.store.append(key, main);
  for (const entries of [main.slice(0, -1), [...main].reverse(), [...main, main[1]],
    main.map((e, i) => i === 0 ? { ...e, unknown: 'changed' } : e)])
    await assert.rejects(verifySessionStoreSnapshot(f.store, key, [{ entries }]), /SESSION_SNAPSHOT_CONTENT/);
  const missing = fixture();
  await assert.rejects(verifySessionStoreSnapshot(missing.store, key, [{ entries: main }]), /SESSION_SNAPSHOT_CONTENT/);
});

test('missing or extra subagent streams and missing main refuse', async () => {
  const f = fixture(); await f.store.append(key, main); await f.store.append(subkey, subentries);
  await assert.rejects(verifySessionStoreSnapshot(f.store, key, [{ entries: main }]), /SESSION_SNAPSHOT_SUBKEYS/);
  await assert.rejects(verifySessionStoreSnapshot(f.store, key, [{ entries: main }, { subpath: 'missing', entries: [] }]), /SESSION_SNAPSHOT_SUBKEYS/);
  await assert.rejects(verifySessionStoreSnapshot(f.store, key, [{ subpath: subkey.subpath, entries: subentries }]), /SESSION_SNAPSHOT_MISSING_MAIN/);
  await assert.rejects(verifySessionStoreSnapshot(f.store, key, [{ entries: main }, { entries: main }]), /SESSION_SNAPSHOT_DUPLICATE/);
});

test('backend cannot return malformed/duplicate subkeys or invalid transcript entries', async () => {
  for (const value of [['duplicate', 'duplicate'], [''], [null], null]) {
    const f = fixture({ listSubkeys: async () => value });
    await assert.rejects(f.store.listSubkeys(key), /SESSION_/);
  }
  const f = fixture({ load: async () => [{ type: 'system', bad: undefined }] });
  await assert.rejects(f.store.load(key), /SESSION_NOT_JSON_SAFE/);
});

test('changing key getters refuse without invoking caller code or any transport', async () => {
  const f = fixture(); let reads = 0;
  for (const field of ['projectKey', 'sessionId', 'subpath']) {
    const hostile = { ...key };
    Object.defineProperty(hostile, field, { enumerable: true, get() {
      reads++; return reads === 1 ? key[field] : 'foreign-project';
    } });
    await assert.rejects(f.store.append(hostile, main), /SESSION_KEY_SCOPE/);
    await assert.rejects(f.store.load(hostile), /SESSION_KEY_SCOPE/);
    await assert.rejects(f.store.listSubkeys(hostile), /SESSION_KEY_SCOPE/);
  }
  assert.equal(reads, 0); assert.equal(f.calls.length, 0);
});

test('options, binding, session keys and transport accessors are never executed', () => {
  let reads = 0;
  const getter = () => { reads++; return binding; };
  const options = { binding, sessionKey: key, transport: { append() {}, load() {}, listSubkeys() {} } };
  for (const field of ['binding', 'sessionKey', 'transport']) {
    const hostile = { ...options };
    Object.defineProperty(hostile, field, { enumerable: true, get: getter });
    assert.throws(() => createRunBoundSessionStore(hostile), /SESSION_/);
  }
  const hostileBinding = { ...binding };
  Object.defineProperty(hostileBinding, 'writerFence', { enumerable: true, get: getter });
  assert.throws(() => fixture({}, { binding: hostileBinding }), /SESSION_NOT_JSON_SAFE/);
  const transport = { append() {}, load() {}, listSubkeys() {} };
  Object.defineProperty(transport, 'append', { get: getter });
  assert.throws(() => fixture({}, { transport }), /SESSION_TRANSPORT_REQUIRED/);
  assert.equal(reads, 0);
});

test('entry getters, toJSON, proxies and non-plain values refuse before transport effects', async () => {
  const f = fixture(); let executed = 0;
  const accessor = { type: 'system' };
  Object.defineProperty(accessor, 'opaque', { enumerable: true, get() { executed++; return 'changed'; } });
  const hooks = { get() { executed++; throw new Error('proxy executed'); },
    ownKeys() { executed++; throw new Error('proxy executed'); },
    getOwnPropertyDescriptor() { executed++; throw new Error('proxy executed'); },
    getPrototypeOf() { executed++; throw new Error('proxy executed'); } };
  const custom = Object.create({ inherited: true }); custom.type = 'system';
  const nonenumerable = { type: 'system' };
  Object.defineProperty(nonenumerable, 'hidden', { value: 'opaque' });
  const sparse = []; sparse.length = 1;
  for (const entries of [[accessor], [{ type: 'system', nested: accessor }],
    [{ type: 'system', toJSON() { executed++; return { type: 'system' }; } }],
    new Proxy(main, hooks), [new Proxy({ type: 'system' }, hooks)], [custom],
    [nonenumerable], sparse, [Object.create(null)]])
    await assert.rejects(f.store.append(key, entries), /SESSION_/);
  await assert.rejects(f.store.append(new Proxy(key, hooks), main), /SESSION_KEY_SCOPE/);
  assert.equal(executed, 0); assert.equal(f.calls.length, 0);
});

test('captured normal keys and class dependency methods stay stable after caller mutation', async () => {
  const requests = [];
  class Transport {
    append(request) { assert.equal(this.marker, 'receiver'); requests.push(request); }
    load() { return null; }
    listSubkeys() { return []; }
    marker = 'receiver';
  }
  const transport = new Transport(), mutableKey = { ...key };
  const f = createRunBoundSessionStore({ binding, sessionKey: mutableKey, transport });
  const call = f.store.append(mutableKey, main);
  mutableKey.projectKey = 'foreign-project';
  transport.append = () => assert.fail('replacement method cannot run');
  await call;
  assert.deepEqual(requests[0].key, key); assert.ok(Object.isFrozen(requests[0].key));
  assert.equal(requests[0].binding.writerFence, 1);
});

test('returned transcript/subkeys and thrown code getters never execute caller code', async () => {
  let executed = 0;
  const accessor = { type: 'system' };
  Object.defineProperty(accessor, 'opaque', { enumerable: true, get() { executed++; return true; } });
  const f = fixture({ load: async () => [accessor], listSubkeys: async () => {
    const result = ['subagent'];
    Object.defineProperty(result, '0', { enumerable: true, get() { executed++; return 'foreign'; } });
    return result;
  } });
  await assert.rejects(f.store.load(key), /SESSION_NOT_JSON_SAFE/);
  await assert.rejects(f.store.listSubkeys(key), /SESSION_NOT_JSON_SAFE/);
  const error = new Error('redacted');
  Object.defineProperty(error, 'code', { get() { executed++; return 'SESSION_WRITE_REJECTED'; } });
  let dispatches = 0;
  const g = fixture({ append: async () => { dispatches++; throw error; } });
  await assert.rejects(g.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  await assert.rejects(g.store.append(key, main), /SESSION_TRANSPORT_UNCERTAIN/);
  assert.equal(executed, 0); assert.equal(dispatches, 1);
});

test('expected snapshot getters/proxies refuse before any trusted store read', async () => {
  const f = fixture(); let executed = 0;
  const hostile = {};
  Object.defineProperty(hostile, 'entries', { enumerable: true, get() { executed++; return main; } });
  const proxy = new Proxy([{ entries: main }], { get() { executed++; return []; },
    ownKeys() { executed++; return []; }, getPrototypeOf() { executed++; return Array.prototype; } });
  for (const expected of [[hostile], proxy])
    await assert.rejects(verifySessionStoreSnapshot(f.store, key, expected), /SESSION_NOT_JSON_SAFE/);
  assert.equal(executed, 0); assert.equal(f.calls.length, 0);
});

test('mirror event accessors refuse without code execution or changing error state', async () => {
  const f = fixture(); let executed = 0;
  const event = { subtype: 'mirror_error' };
  Object.defineProperty(event, 'type', { enumerable: true, get() { executed++; return 'system'; } });
  assert.throws(() => f.recordMirrorError(event), /SESSION_NOT_JSON_SAFE/);
  assert.equal(executed, 0); assert.equal((await f.settleObservedCalls()).mirrorErrors, 0);
});
