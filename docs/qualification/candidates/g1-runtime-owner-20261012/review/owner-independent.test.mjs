import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, deferred, CommitUncertain } from './control-harness.mjs';

const target = (h, phase = 'a') => ({ context: phase === 'a' ? h.f.producer : h.f.current,
  peer: phase === 'a' ? h.peerA : h.peerB });
const revokeWrites = h => h.store.calls.filter(c => c.sql.startsWith('UPDATE meri_qualification_sdk_fixture.grants'));
const pause = () => new Promise(resolve => setTimeout(resolve, 0));
const assertAPI = h => { assert.equal(typeof h.control.stopRun, 'function'); assert.equal(typeof h.control.runStatus, 'function'); };
async function owned(run) {
  const h = await fixture();
  try { assertAPI(h); await run(h); }
  finally { await h.close().catch(() => {}); }
}

test('independent actual control pipeline commits A, replaces B, loads and verifies exact bytes', async () => {
  const h = await fixture();
  try {
    assert.equal((await h.committed()).status, 'COMMITTED');
    assert.equal((await h.replace()).outcome, 'REPLACED');
    assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'REVOKED');
    assert.equal(h.store.grants.get(h.f.current.identity.grantId).state, 'ACTIVE');
    const loaded = await h.send('loadFixtureCheckpoint', { peer: 'b' }).promise;
    assert.equal(loaded.status, 200);
    assert.equal((await h.send('verifyFixtureCheckpoint', { peer: 'b' }).promise).status, 200);
    assert.notEqual((await h.send('commitFixtureCheckpoint').promise).status, 200);
    assert.equal(h.store.commits.size, 1);
  } finally { await h.close(); }
});

test('independent owner exposes frozen content-free bound status without database work', async () => owned(async h => {
  const before = h.store.calls.length, status = h.control.runStatus(target(h));
  assert.deepEqual(status, { stopRequested: false, revocation: 'NOT_REQUESTED', activeOperations: 0, publicationUncertain: false });
  assert.equal(Object.isFrozen(status), true);
  assert.equal(h.store.calls.length, before);
}));

test('independent owner stop before checkpoint consumes real revoke and denies subsequent ingress', async () => owned(async h => {
  const result = await h.control.stopRun(target(h));
  assert.equal(result.outcome, 'REVOKED');
  assert.equal(result.binding.grantId, h.f.producer.identity.grantId);
  assert.equal(h.store.grants.get(result.binding.grantId).state, 'REVOKED');
  assert.equal(h.store.commits.size, 0);
  assert.equal(revokeWrites(h).length, 1);
  assert.notEqual((await h.send('authorizeFixturePhase').promise).status, 200);
  assert.deepEqual(h.control.runStatus(target(h)), { stopRequested: true, revocation: 'REVOKED', activeOperations: 0, publicationUncertain: false });
}));

test('independent repeated and concurrent stop reuses one attempt without timestamp rewrite', async () => owned(async h => {
  const results = await Promise.all([h.control.stopRun(target(h)), h.control.stopRun(target(h))]);
  assert.deepEqual(results[0], results[1]);
  const stamp = h.store.grants.get(h.f.producer.identity.grantId).revoked_at;
  const calls = h.store.calls.length;
  assert.deepEqual(await h.control.stopRun(target(h)), results[0]);
  assert.equal(h.store.calls.length, calls);
  assert.deepEqual(h.store.grants.get(h.f.producer.identity.grantId).revoked_at, stamp);
  assert.equal(revokeWrites(h).length, 1);
}));

test('independent owner invalidates expired exact current grant without resetting original clock', async () => owned(async h => {
  const before = structuredClone(h.store.runs.get(h.f.producer.runUuid));
  h.setNow(h.f.producer.identity.expiresAtMs + 1);
  assert.equal((await h.control.stopRun(target(h))).outcome, 'REVOKED');
  assert.deepEqual(h.store.runs.get(h.f.producer.runUuid), before);
}));

test('independent owner cannot begin new durable stop after original cleanup deadline', async () => owned(async h => {
  const calls = h.store.calls.length;
  h.setNow(h.f.producer.clock.cleanupDeadlineMs);
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.store.calls.length, calls);
  assert.equal(h.control.runStatus(target(h)).stopRequested, true);
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'ACTIVE');
}));

test('independent current B stop leaves original immutable A commit intact', async () => owned(async h => {
  await h.committed(); await h.replace();
  const committed = structuredClone(h.store.commits.get(h.f.producer.runUuid));
  assert.equal((await h.control.stopRun(target(h, 'b'))).outcome, 'REVOKED');
  assert.equal(h.store.grants.get(h.f.current.identity.grantId).state, 'REVOKED');
  assert.deepEqual(h.store.commits.get(h.f.producer.runUuid), committed);
  assert.notEqual((await h.send('loadFixtureCheckpoint', { peer: 'b' }).promise).status, 200);
}));

test('independent stale A stop refuses without closing B gate or changing B grant', async () => owned(async h => {
  await h.committed(); await h.replace();
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.control.runStatus(target(h)).revocation, 'FAILED');
  assert.equal(h.control.runStatus(target(h, 'b')).stopRequested, false);
  assert.equal(h.store.grants.get(h.f.current.identity.grantId).state, 'ACTIVE');
  assert.equal((await h.send('loadFixtureCheckpoint', { peer: 'b' }).promise).status, 200);
}));

for (const wrong of ['peer', 'actor', 'pin']) test(`independent wrong ${wrong} stop cannot close actual A gate`, async () => owned(async h => {
  const input = structuredClone(target(h));
  if (wrong === 'peer') input.peer.peerId = 'foreign';
  if (wrong === 'actor') input.context.identity.canonical.actorId = 'foreign';
  if (wrong === 'pin') input.context.pins.skillsManifestSha256 = 'e'.repeat(64);
  await assert.rejects(h.control.stopRun(input));
  assert.equal(h.control.runStatus(target(h)).stopRequested, false);
  assert.equal((await h.send('authorizeFixturePhase').promise).status, 200);
  assert.equal(revokeWrites(h).length, 0);
}));

test('independent caller mutation across first database await cannot retarget stop', async () => owned(async h => {
  const input = structuredClone(target(h)); let changed = false;
  h.store.beforeQuery = async call => { if (!changed && call.sql.includes('FROM meri_qualification_sdk_fixture.runs')) {
    changed = true; input.context.identity.canonical.actorId = 'foreign'; input.peer.peerId = 'foreign';
  } };
  const result = await h.control.stopRun(input);
  assert.equal(result.outcome, 'REVOKED');
  assert.equal(h.control.runStatus(target(h)).stopRequested, true);
  assert.equal(result.binding.actorId, h.f.producer.identity.canonical.actorId);
}));

test('independent accessor and proxy stop targets cause no getter trap or durable dispatch', async () => owned(async h => {
  for (const kind of ['accessor', 'proxy']) {
    let effects = 0;
    const input = kind === 'accessor' ? { peer: h.peerA,
      get context() { effects++; return h.f.producer; } } : new Proxy(target(h), {
      get() { effects++; throw new Error('trap'); }, ownKeys() { effects++; throw new Error('trap'); },
      getPrototypeOf() { effects++; throw new Error('trap'); }
    });
    const before = h.store.calls.length;
    await assert.rejects(async () => h.control.stopRun(input));
    assert.equal(effects, 0); assert.equal(h.store.calls.length, before);
  }
}));

test('independent stop aborts parked evidence inspection before any object or commit effect', async () => owned(async h => {
  const entered = deferred(), release = deferred(); let signal;
  h.inspector.verify = async input => { signal = input.signal; entered.resolve(); await release.promise; return true; };
  const pending = h.send('commitFixtureCheckpoint').promise;
  await entered.promise;
  const stop = h.control.stopRun(target(h));
  assert.equal(signal.aborted, true);
  assert.equal(h.control.runStatus(target(h)).stopRequested, true);
  release.resolve();
  assert.equal((await stop).outcome, 'REVOKED');
  assert.notEqual((await pending).status, 200);
  assert.equal(h.s3.calls.length, 0); assert.equal(h.store.commits.size, 0);
  assert.equal(h.control.runStatus(target(h)).activeOperations, 0);
}));

test('independent stop after parked object put prevents next object effect and publication', async () => owned(async h => {
  const entered = deferred(), release = deferred(); let signal;
  const original = h.s3.client.send;
  h.s3.client.send = async (command, options) => { signal = options.abortSignal; entered.resolve(); await release.promise; return original(command); };
  const pending = h.send('commitFixtureCheckpoint').promise;
  await entered.promise;
  const stop = h.control.stopRun(target(h)); assert.equal(signal.aborted, true);
  release.resolve(); await stop;
  assert.notEqual((await pending).status, 200);
  assert.equal(h.s3.calls.length, 1); assert.equal(h.store.commits.size, 0);
}));

test('independent local stop gate catches request already parked in credential resolution before revocation completes', async () => owned(async h => {
  const resolverEntered = deferred(), resolverRelease = deferred(), revokeEntered = deferred(), revokeRelease = deferred();
  let resolverParked = false, revokeParked = false;
  h.store.beforeQuery = async call => {
    if (!resolverParked && call.sql.startsWith('SELECT run_uuid FROM')) {
      resolverParked = true; resolverEntered.resolve(); await resolverRelease.promise;
    } else if (!revokeParked && call.sql.includes('FROM meri_qualification_sdk_fixture.runs')) {
      revokeParked = true; revokeEntered.resolve(); await revokeRelease.promise;
    }
  };
  const pending = h.send('authorizeFixturePhase').promise;
  await resolverEntered.promise;
  const stop = h.control.stopRun(target(h)); await revokeEntered.promise;
  resolverRelease.resolve();
  assert.notEqual((await pending).status, 200);
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'ACTIVE');
  assert.equal(h.store.calls.filter(c => c.sql === 'SELECT clock_timestamp() AS now').length, 1, 'only original admission read the database clock; blocked handler never authorized');
  revokeRelease.resolve(); assert.equal((await stop).outcome, 'REVOKED');
}));

test('independent unknown revoke acknowledgement remains visible and repeated stop never retries', async () => owned(async h => {
  const unknown = new CommitUncertain();
  h.store.afterTransaction = async ({ queries }) => { if (queries.some(c => c.sql.startsWith('UPDATE meri_qualification_sdk_fixture.grants'))) throw unknown; };
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.control.runStatus(target(h)).revocation, 'UNCERTAIN');
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'REVOKED');
  const calls = h.store.calls.length;
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.store.calls.length, calls);
  await assert.rejects(h.control.close());
  assert.equal(h.control.runStatus(target(h)).revocation, 'UNCERTAIN');
}));

test('independent definite pre-update failure stays FAILED rather than unknown and does not retry', async () => owned(async h => {
  h.store.beforeQuery = async () => { throw new Error('synthetic definite failure'); };
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.control.runStatus(target(h)).revocation, 'FAILED');
  const calls = h.store.calls.length;
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.store.calls.length, calls);
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'ACTIVE');
  await h.control.close();
}));

test('independent unknown publication survives bodyless ingress failure and settled handler tracking', async () => owned(async h => {
  const unknown = new CommitUncertain(); let issued = false;
  h.store.afterTransaction = async ({ queries }) => {
    if (queries.some(c => c.sql.startsWith('INSERT INTO meri_qualification_sdk_fixture.commits'))) { issued = true; throw unknown; }
  };
  h.store.beforeQuery = async call => {
    if (issued && call.sql.includes('FROM meri_qualification_sdk_fixture.commits')) throw new Error('synthetic read outage');
  };
  const response = await h.send('commitFixtureCheckpoint').promise;
  assert.notEqual(response.status, 200); assert.equal(response.body.length, 0);
  await pause();
  assert.equal(h.control.runStatus(target(h)).activeOperations, 0);
  assert.equal(h.control.runStatus(target(h)).publicationUncertain, true);
  assert.equal(h.store.commits.size, 1);
  await assert.rejects(h.control.stopRun(target(h)));
  assert.equal(h.control.runStatus(target(h)).revocation, 'REVOKED');
  assert.equal(h.control.runStatus(target(h)).publicationUncertain, true);
  const calls = h.store.calls.length;
  await assert.rejects(h.control.close());
  assert.equal(h.store.calls.length, calls);
}));

test('independent ordinary checkpoint failure is not mislabelled as unknown publication', async () => owned(async h => {
  h.inspector.verify = async () => { throw new Error('synthetic validation refusal'); };
  assert.notEqual((await h.send('commitFixtureCheckpoint').promise).status, 200);
  await pause();
  assert.equal(h.control.runStatus(target(h)).publicationUncertain, false);
  assert.equal((await h.control.stopRun(target(h))).outcome, 'REVOKED');
  await h.control.close();
}));

test('independent cleanup deadline bounds stop but never asserts parked work is physically stopped', async () => owned(async h => {
  const entered = deferred(), release = deferred();
  h.inspector.verify = async () => { entered.resolve(); await release.promise; return true; };
  const pending = h.send('commitFixtureCheckpoint').promise; await entered.promise;
  h.setNow(h.f.producer.clock.cleanupDeadlineMs - 30);
  const started = Date.now();
  await assert.rejects(h.control.stopRun(target(h)));
  assert.ok(Date.now() - started < 1000);
  assert.equal(h.control.runStatus(target(h)).activeOperations, 1);
  assert.equal(h.control.runStatus(target(h)).stopRequested, true);
  release.resolve(); assert.notEqual((await pending).status, 200); await pause();
  assert.equal(h.control.runStatus(target(h)).activeOperations, 0);
}));

for (const method of ['stopRun', 'runStatus']) test(`supplemental ${method} admits only closed inert own-data target`, async () => owned(async h => {
  for (const kind of ['extra', 'symbol', 'hidden', 'prototype', 'accessor', 'proxy']) {
    let effects = 0;
    let input = { ...target(h) };
    if (kind === 'extra') input.allow = true;
    if (kind === 'symbol') input[Symbol('allow')] = true;
    if (kind === 'hidden') Object.defineProperty(input, 'context', { value: h.f.producer, enumerable: false });
    if (kind === 'prototype') Object.setPrototypeOf(input, { inherited: true });
    if (kind === 'accessor') Object.defineProperty(input, 'context', { enumerable: true,
      get() { effects++; return h.f.producer; } });
    if (kind === 'proxy') input = new Proxy(input, {
      get() { effects++; throw new Error('trap'); },
      ownKeys() { effects++; throw new Error('trap'); },
      getPrototypeOf() { effects++; throw new Error('trap'); }
    });
    const calls = h.store.calls.length;
    await assert.rejects(async () => h.control[method](input), undefined, `${method}/${kind}`);
    assert.equal(effects, 0, `${method}/${kind}`);
    assert.equal(h.store.calls.length, calls, `${method}/${kind}`);
  }
}));

test('supplemental close bars request already resolving without implicit grant revocation', async () => owned(async h => {
  const entered = deferred(), release = deferred(); let paused = false;
  h.store.beforeQuery = async call => {
    if (!paused && call.sql.startsWith('SELECT run_uuid FROM')) { paused = true; entered.resolve(); await release.promise; }
  };
  const pending = h.send('authorizeFixturePhase').promise;
  await entered.promise;
  await h.control.close();
  release.resolve();
  assert.notEqual((await pending).status, 200);
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'ACTIVE');
  assert.equal(h.store.calls.filter(c => c.sql === 'SELECT clock_timestamp() AS now').length, 1);
}));

test('supplemental reentrant real handler abort receives the same reserved stop promise', async () => owned(async h => {
  const entered = deferred(), release = deferred(); let second;
  h.inspector.verify = async ({ signal }) => {
    signal.addEventListener('abort', () => { second = h.control.stopRun(target(h)); }, { once: true });
    entered.resolve(); await release.promise; return true;
  };
  const pending = h.send('commitFixtureCheckpoint').promise; await entered.promise;
  const first = h.control.stopRun(target(h));
  assert.equal(second, first);
  release.resolve(); await first;
  assert.notEqual((await pending).status, 200);
  assert.equal(revokeWrites(h).length, 1);
}));

test('supplemental stop during issued publication preserves its late unknown acknowledgement', async () => owned(async h => {
  const entered = deferred(), release = deferred(); const unknown = new CommitUncertain();
  h.store.afterTransaction = async ({ queries }) => {
    if (queries.some(c => c.sql.startsWith('INSERT INTO meri_qualification_sdk_fixture.commits'))) {
      entered.resolve(); await release.promise; throw unknown;
    }
  };
  const pending = h.send('commitFixtureCheckpoint').promise; await entered.promise;
  const stop = h.control.stopRun(target(h));
  release.resolve();
  await assert.rejects(stop, error => error instanceof CommitUncertain);
  assert.notEqual((await pending).status, 200);
  assert.equal(h.store.commits.size, 1);
  assert.equal(h.store.grants.get(h.f.producer.identity.grantId).state, 'REVOKED');
  assert.equal(h.control.runStatus(target(h)).publicationUncertain, true);
  assert.equal(h.control.runStatus(target(h)).activeOperations, 0);
  await assert.rejects(h.control.close(), error => error instanceof CommitUncertain);
}));
