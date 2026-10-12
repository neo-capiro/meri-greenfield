// Explicit real-engine controls. Never provisions, migrates, resets or deletes.
// Syntax-checking this file is not execution or database qualification.
import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { liveFixture } from '../../service/test/fixture.mjs';
import { FixtureRegistry } from '../registry.mjs';
import { CommitUncertain } from '../errors.mjs';

if (process.env.MERI_FIXTURE_REVOCATION_TEST_RUN !== 'yes') {
  throw new Error('EXPLICIT_ISOLATED_DATABASE_EXECUTION_REQUIRED');
}
const port = Number(process.env.MERI_FIXTURE_TEST_PORT);
if (!Number.isInteger(port) || !process.env.MERI_FIXTURE_TEST_DATABASE || !process.env.MERI_FIXTURE_TEST_USER) {
  throw new Error('ISOLATED_TEST_DATABASE_REQUIRED');
}
const { PostgresStore } = await import('../store.mjs');
const config = { host: '127.0.0.1', port, database: process.env.MERI_FIXTURE_TEST_DATABASE,
  user: process.env.MERI_FIXTURE_TEST_USER };
const store = new PostgresStore(config), registry = new FixtureRegistry(store);
function input() {
  const context = liveFixture().producer;
  context.runUuid = randomUUID(); context.namespace.sessionId = randomUUID();
  for (const key of ['mappingId', 'grantId']) context.identity[key] = randomUUID();
  for (const key of ['conversationId', 'runId', 'attemptId', 'workerId']) {
    context.identity.canonical[key] = randomUUID();
  }
  context.identity.taskArn = `arn:aws:ecs:us-east-1:967807252336:task/qualification/${randomUUID().replaceAll('-', '')}`;
  return { context, peer: { peerId: `synthetic-${randomUUID()}`, credentialId: randomUUID() } };
}
async function grant(context) {
  return store.transact(async client => (await client.query(
    'SELECT state, revoked_at, admitted_at_ms, expires_at_ms FROM meri_qualification_sdk_fixture.grants WHERE grant_id = $1',
    [context.identity.grantId])).rows[0]);
}
function presented(context) {
  const i = context.identity;
  return { runUuid: context.runUuid, sessionId: context.namespace.sessionId, attempt: i.attempt,
    fence: i.fence, policyRevision: i.policyRevision, grantId: i.grantId, mappingId: i.mappingId,
    taskArn: i.taskArn, attemptId: i.canonical.attemptId, workerId: i.canonical.workerId };
}

test('real PostgreSQL serializes concurrent owner revocations with one immutable timestamp', async () => {
  const value = input(); await registry.admitRun(value);
  const results = await Promise.all([registry.revokeRun(value), registry.revokeRun(value)]);
  assert.deepEqual(results.map(r => r.outcome).sort(), ['ALREADY_REVOKED', 'REVOKED']);
  const first = await grant(value.context);
  assert.equal(first.state, 'REVOKED'); assert.ok(first.revoked_at instanceof Date);
  assert.equal((await registry.revokeRun(value)).outcome, 'ALREADY_REVOKED');
  assert.deepEqual(await grant(value.context), first);
  await assert.rejects(registry.authorize({ presented: presented(value.context), peer: value.peer }),
    /FIXTURE_GRANT_REVOKED/);
  assert.equal((await registry.readPublication({ runUuid: value.context.runUuid })).outcome, 'NOT_COMMITTED');
});

test('real PostgreSQL lost acknowledgement requires explicit exact-binding readback', async () => {
  const value = input(); await registry.admitRun(value);
  const uncertain = new FixtureRegistry(new PostgresStore(config, { afterCommit: () => { throw new Error('synthetic-lost-ack'); } }));
  await assert.rejects(uncertain.revokeRun(value), error => error instanceof CommitUncertain);
  assert.equal((await registry.revokeRun(value)).outcome, 'ALREADY_REVOKED');
});

test('real PostgreSQL wrong binding/peer cannot change current grant', async () => {
  const value = input(); await registry.admitRun(value);
  const before = await grant(value.context);
  await assert.rejects(registry.revokeRun({ ...value, peer: { ...value.peer, peerId: 'foreign' } }),
    /FIXTURE_REVOCATION_BINDING/);
  const changed = structuredClone(value); changed.context.pins.skillsManifestSha256 = 'f'.repeat(64);
  await assert.rejects(registry.revokeRun(changed), /FIXTURE_REVOCATION_BINDING/);
  assert.deepEqual(await grant(value.context), before);
  assert.equal((await registry.authorize({ presented: presented(value.context), peer: value.peer })).decision, 'AUTHORIZED');
  await registry.revokeRun(value);
});
