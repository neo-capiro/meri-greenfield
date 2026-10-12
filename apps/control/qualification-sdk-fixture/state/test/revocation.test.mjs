import test from 'node:test';
import assert from 'node:assert/strict';
import { FixtureRegistry } from '../registry.mjs';
import { CommitUncertain } from '../errors.mjs';
import { fixture, NOW } from '../../ingress/test/fixture-data.mjs';

const peer = { peerId: 'synthetic-task-a', credentialId: 'synthetic-credential-a' };
function rows(c) {
  const i = c.identity, p = c.pins, a = i.canonical;
  const run = { run_uuid: c.runUuid, session_id: c.namespace.sessionId,
    t0_ms: String(c.clock.t0Ms), deadline_ms: String(c.clock.deadlineMs),
    cleanup_deadline_ms: String(c.clock.cleanupDeadlineMs), canonical_tenant_id: a.tenantId,
    canonical_actor_id: a.actorId, canonical_conversation_id: a.conversationId, canonical_run_id: a.runId,
    source_commit: p.sourceCommit, image_digest: p.imageDigest, sdk_version: p.sdkVersion,
    cli_version: p.cliVersion, contracts_version: p.contractsVersion,
    contracts_schema_sha256: p.contractsSchemaSha256, skills_manifest_sha256: p.skillsManifestSha256,
    policy_revision: i.policyRevision, current_attempt: i.attempt, current_fence: i.fence,
    current_grant_id: i.grantId, current_mapping_id: i.mappingId, current_task_arn: i.taskArn,
    current_attempt_id: a.attemptId, current_worker_id: a.workerId,
    current_peer_id: peer.peerId, current_credential_id: peer.credentialId,
    current_admitted_at_ms: String(i.admittedAtMs), current_expires_at_ms: String(i.expiresAtMs) };
  const grant = { grant_id: i.grantId, run_uuid: c.runUuid, session_id: c.namespace.sessionId,
    phase: c.phase, attempt: i.attempt, fence: i.fence, mapping_id: i.mappingId, task_arn: i.taskArn,
    attempt_id: a.attemptId, worker_id: a.workerId, peer_id: peer.peerId, credential_id: peer.credentialId,
    policy_revision: i.policyRevision, admitted_at_ms: String(i.admittedAtMs),
    expires_at_ms: String(i.expiresAtMs), state: 'ACTIVE', revoked_at: null };
  return { run, grant };
}
function harness(context = fixture().producer, { nowMs = NOW, mutate = () => {}, after = () => {}, onRun = () => {} } = {}) {
  const state = rows(context), trace = []; mutate(state);
  const store = { transact: async callback => {
    const result = await callback({ query: async (sql, args) => {
      trace.push({ sql, args });
      if (sql.includes('.runs')) { await onRun(); return { rows: state.run ? [state.run] : [] }; }
      if (sql.startsWith('SELECT') && sql.includes('.grants')) return { rows: state.grant ? [state.grant] : [] };
      if (sql === 'SELECT clock_timestamp() AS now') return { rows: [{ now: new Date(nowMs) }] };
      assert.match(sql, /^UPDATE .*grants SET state = 'REVOKED'/);
      assert.deepEqual(args, [state.grant.grant_id]);
      state.grant.state = 'REVOKED'; state.grant.revoked_at = new Date(nowMs);
      return { rowCount: 1 };
    } });
    await after(); return result;
  } };
  return { registry: new FixtureRegistry(store), state, trace, context };
}
const updates = h => h.trace.filter(x => x.sql.startsWith('UPDATE'));

test('pre-checkpoint revocation locks run then grant, records once, and denies future authorization', async () => {
  const h = harness(), input = { context: h.context, peer };
  const first = await h.registry.revokeRun(input);
  assert.equal(first.outcome, 'REVOKED');
  assert.match(h.trace[0].sql, /runs.*FOR UPDATE/);
  assert.match(h.trace[1].sql, /grants.*FOR UPDATE/);
  assert.equal(h.trace[2].sql, 'SELECT clock_timestamp() AS now');
  const timestamp = h.state.grant.revoked_at;
  assert.equal((await h.registry.revokeRun(input)).outcome, 'ALREADY_REVOKED');
  assert.equal(h.state.grant.revoked_at, timestamp);
  assert.equal(updates(h).length, 1);
  assert.ok(Object.isFrozen(first.binding.pins));
  const b = first.binding;
  const presented = Object.fromEntries(['runUuid', 'sessionId', 'attempt', 'fence', 'policyRevision',
    'grantId', 'mappingId', 'taskArn', 'attemptId', 'workerId'].map(k => [k, b[k]]));
  await assert.rejects(h.registry.authorize({ presented, peer }), /FIXTURE_GRANT_REVOKED/);
});

test('every stored run and grant field must match before mutation', async () => {
  for (const table of ['run', 'grant']) for (const key of Object.keys(rows(fixture().producer)[table])) {
    const h = harness(undefined, { mutate: state => {
      const value = state[table][key];
      state[table][key] = typeof value === 'number' ? value + 1 : value === null ? new Date(NOW) : `${value}x`;
    } });
    await assert.rejects(h.registry.revokeRun({ context: h.context, peer }), undefined, `${table}.${key}`);
    assert.equal(updates(h).length, 0, `${table}.${key}`);
  }
});

test('expired exact context can revoke; future admission, invalid DB clock and missing rows cannot', async () => {
  const expired = harness(undefined, { nowMs: fixture().producer.clock.cleanupDeadlineMs + 1 });
  assert.equal((await expired.registry.revokeRun({ context: expired.context, peer })).outcome, 'REVOKED');
  for (const options of [{ nowMs: 1 }, { nowMs: NaN }, { mutate: s => { s.run = null; } },
    { mutate: s => { s.grant = null; } }]) {
    const h = harness(undefined, options);
    await assert.rejects(h.registry.revokeRun({ context: h.context, peer }));
    assert.equal(updates(h).length, 0);
  }
});

test('stale A cannot revoke current B and wrong peer cannot revoke current A', async () => {
  const f = fixture(), h = harness(f.current);
  await assert.rejects(h.registry.revokeRun({ context: f.producer, peer }), /FIXTURE_REVOCATION_BINDING/);
  assert.equal(updates(h).length, 0);
  const a = harness();
  await assert.rejects(a.registry.revokeRun({ context: a.context, peer: { ...peer, peerId: 'other' } }),
    /FIXTURE_REVOCATION_BINDING/);
  assert.equal(updates(a).length, 0);
});

test('detached input survives caller mutation during lock wait; accessors fail before transaction', async () => {
  const context = fixture().producer, mutablePeer = { ...peer };
  const h = harness(context, { onRun: () => { context.identity.grantId = fixture().current.identity.grantId;
    mutablePeer.peerId = 'other'; } });
  assert.equal((await h.registry.revokeRun({ context, peer: mutablePeer })).outcome, 'REVOKED');
  const bad = harness(), inert = fixture().producer;
  Object.defineProperty(inert, 'identity', { enumerable: true, get() { throw new Error('GETTER_RAN'); } });
  await assert.rejects(bad.registry.revokeRun({ context: inert, peer }), /FIXTURE_JSON_ONLY/);
  assert.equal(bad.trace.length, 0);
});

test('unknown commit acknowledgement propagates without retry or inferred success', async () => {
  const ambiguous = new CommitUncertain();
  const h = harness(undefined, { after: () => { throw ambiguous; } });
  await assert.rejects(h.registry.revokeRun({ context: h.context, peer }), error => error === ambiguous);
  assert.equal(updates(h).length, 1);
});
