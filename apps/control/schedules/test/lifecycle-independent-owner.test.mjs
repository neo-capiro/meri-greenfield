import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalSha256 } from '../../../../packages/contracts/validate.mjs';
import { createPostgresScheduleOwner } from '../postgres-schedule-owner.mjs';

const projection = () => ({
  scheduleId: '11111111-1111-4111-8111-111111111111', owner: { tenantId: 'tenant-a', actorId: 'owner-a' },
  temporalScheduleId: 'application/a', timezone: 'UTC', state: 'active',
  scopes: [{ tenantId: 'tenant-a', kind: 'client', resourceId: 'client-a', policyRevision: 'policy-a' }],
  maxCostMicrousd: 100, maxRuntimeSeconds: 10, retryLimit: 0,
  destinationId: 'destination-a', createdAt: '2026-10-12T00:00:00.000Z',
});
function binding(operation = 'schedule_task') {
  const p = projection();
  const intent = { intentId: '22222222-2222-4222-8222-222222222222', operation,
    expectedGeneration: operation === 'schedule_task' ? 0 : 2, generation: operation === 'schedule_task' ? 1 : 3,
    previousProjectionSha256: operation === 'schedule_task' ? null : canonicalSha256(p), projection: p,
    configuration: null, cancel: null };
  return { intent, bindingSha256: canonicalSha256({ intent, request: 'independent scripted owner only' }) };
}
function database(options = {}) {
  const b = options.binding ?? binding(); const p = b.intent.projection;
  const queries = [], releases = []; let acquired = 0, expired = false;
  const old = { generation: String(b.intent.expectedGeneration), active_intent: null,
    projection_sha256: b.intent.previousProjectionSha256, temporal_schedule_id: p.temporalScheduleId,
    owner_actor_id: p.owner.actorId, projection: p, ...options.old };
  const row = { intent_id: b.intent.intentId, binding_sha256: b.bindingSha256,
    intent_sha256: canonicalSha256(b.intent), state: 'CLAIMED', ...options.row };
  const client = {
    async query(sql, args) {
      queries.push({ sql, args });
      const answer = options.query?.(sql, args, { expire() { expired = true; } });
      if (answer !== undefined) return answer;
      if (sql.startsWith('SELECT intent_id')) return { rows: options.replay ? [{ intent_id: b.intent.intentId }] : [] };
      if (sql.startsWith('SELECT * FROM meri_schedules.projections')) return { rows: b.intent.operation === 'schedule_task' ? options.exists ? [old] : [] : options.missing ? [] : [old] };
      if (sql.startsWith('SELECT * FROM meri_schedules.intents')) return { rows: options.missing ? [] : [row] };
      if (sql.startsWith('SELECT projection,generation')) return { rows: options.rows ?? [] };
      return { rows: [], rowCount: options.zeroUpdated && sql.startsWith('UPDATE meri_schedules.projections') ? 0 : 1 };
    },
    release(error) { releases.push(error); if (options.releaseThrows) throw Error('release refused'); },
  };
  const pool = { async connect() { acquired++; if (options.connectThrows) throw Error('no connection'); if (options.lateConnect) expired = true; return client; } };
  const check = () => { if (expired) throw Object.assign(Error('deadline'), { code: 'DEADLINE' }); };
  return { owner: createPostgresScheduleOwner({ pool }), b, queries, releases, check, acquired: () => acquired };
}
const writes = h => h.queries.filter(v => /^(INSERT|UPDATE|DELETE)/.test(v.sql));

test('independent owner: construction is inert; create claims exact tenant and intent under transaction lock', async () => {
  const h = database(); assert.equal(h.acquired(), 0);
  const out = await h.owner.claim(h.b, h.check);
  assert.deepEqual(out, { intentId: h.b.intent.intentId, bindingSha256: h.b.bindingSha256, state: 'CLAIMED' });
  assert.equal(h.acquired(), 1); assert.equal(h.queries[0].sql, 'BEGIN');
  const lock = h.queries.findIndex(v => v.sql.includes('pg_advisory_xact_lock'));
  assert.ok(lock >= 0); assert.ok(lock < h.queries.findIndex(v => v.sql.startsWith('SELECT * FROM meri_schedules.projections')));
  const insert = h.queries.find(v => v.sql.startsWith('INSERT INTO meri_schedules.intents'));
  assert.equal(insert.args[0], 'tenant-a'); assert.equal(insert.args[1], h.b.intent.intentId);
  assert.equal(insert.args[3], canonicalSha256(h.b.intent)); assert.equal(insert.args[4], h.b.bindingSha256);
  assert.equal(h.queries.at(-1).sql, 'COMMIT'); assert.deepEqual(h.releases, [undefined]);
});

for (const reason of ['replay', 'exists']) test(`independent owner: ${reason} cannot create a second dispatch claim`, async () => {
  const h = database({ [reason]: true }); await assert.rejects(h.owner.claim(h.b, h.check));
  assert.equal(writes(h).length, 0); assert.equal(h.queries.at(-1).sql, 'ROLLBACK'); assert.deepEqual(h.releases, [undefined]);
});

for (const field of ['generation', 'active_intent', 'projection_sha256', 'temporal_schedule_id', 'owner_actor_id', 'createdAt', 'missing']) {
  test(`independent owner: stale ${field} denies update before any write`, async () => {
    const b = binding('update_scheduled_task'); const old = {};
    if (field === 'generation') old.generation = '1';
    if (field === 'active_intent') old.active_intent = 'other-intent';
    if (field === 'projection_sha256') old.projection_sha256 = 'b'.repeat(64);
    if (field === 'temporal_schedule_id') old.temporal_schedule_id = 'other-temporal';
    if (field === 'owner_actor_id') old.owner_actor_id = 'other-owner';
    if (field === 'createdAt') old.projection = { ...projection(), createdAt: '2026-10-11T00:00:00.000Z' };
    const h = database({ binding: b, old, missing: field === 'missing' });
    await assert.rejects(h.owner.claim(h.b, h.check)); assert.equal(writes(h).length, 0);
    assert.equal(h.queries.at(-1).sql, 'ROLLBACK');
  });
}

for (const field of ['binding_sha256', 'intent_sha256', 'state', 'missing']) test(`independent owner: altered ${field} cannot dispatch retained claim`, async () => {
  const row = field === 'state' ? { state: 'UNKNOWN' } : { [field]: 'b'.repeat(64) };
  const h = database({ row, missing: field === 'missing' });
  await assert.rejects(h.owner.markDispatching(h.b, h.check)); assert.equal(writes(h).length, 0);
});

for (const state of ['UNKNOWN', 'ACKNOWLEDGED']) test(`independent owner: ${state} cannot be redispatched or recommitted`, async () => {
  const h = database({ row: { state } });
  await assert.rejects(h.owner.markDispatching(h.b, h.check));
  await assert.rejects(h.owner.commitKnown(h.b, h.check)); assert.equal(writes(h).length, 0);
});

test('independent owner: acknowledged commit compares active intent and expected generation atomically', async () => {
  const h = database({ row: { state: 'DISPATCHING' } });
  const out = await h.owner.commitKnown(h.b, h.check); assert.equal(out.state, 'ACKNOWLEDGED');
  const q = h.queries.find(v => v.sql.startsWith('UPDATE meri_schedules.projections'));
  assert.match(q.sql, /active_intent=\$3 AND generation=\$7/);
  assert.equal(q.args[2], h.b.intent.intentId); assert.equal(q.args[6], h.b.intent.expectedGeneration);
  assert.match(q.sql, /active_intent=NULL/);
});
test('independent owner: failed final projection CAS rolls back acknowledgement', async () => {
  const h = database({ row: { state: 'DISPATCHING' }, zeroUpdated: true });
  await assert.rejects(h.owner.commitKnown(h.b, h.check)); assert.equal(h.queries.at(-1).sql, 'ROLLBACK');
  assert.equal(h.queries.some(v => v.sql === 'COMMIT'), false);
});
test('independent owner: unknown transition retains unresolved projection barrier', async () => {
  const h = database({ row: { state: 'DISPATCHING' } }); const out = await h.owner.markUnknown(h.b, h.check);
  assert.equal(out.state, 'UNKNOWN'); assert.equal(h.queries.some(v => v.sql.startsWith('UPDATE meri_schedules.projections')), false);
});

for (const statement of ['BEGIN', 'COMMIT']) test(`independent owner: lost ${statement} acknowledgement evicts connection without retry`, async () => {
  const h = database({ query(sql) { if (sql === statement) throw Error('wire lost'); } });
  await assert.rejects(h.owner.claim(h.b, h.check)); assert.equal(h.acquired(), 1);
  assert.equal(h.queries.filter(v => v.sql === statement).length, 1);
  assert.equal(h.releases.length, 1); assert.ok(h.releases[0] instanceof Error);
  assert.equal(h.queries.some(v => v.sql === 'ROLLBACK'), false);
});
test('independent owner: failed rollback evicts unhealthy connection', async () => {
  const h = database({ replay: true, query(sql) { if (sql === 'ROLLBACK') throw Error('rollback lost'); } });
  await assert.rejects(h.owner.claim(h.b, h.check)); assert.ok(h.releases[0] instanceof Error);
  assert.equal(h.queries.filter(v => v.sql === 'ROLLBACK').length, 1);
});
test('independent owner: release failure after commit never returns acknowledgement', async () => {
  const h = database({ releaseThrows: true }); await assert.rejects(h.owner.claim(h.b, h.check));
  assert.equal(h.queries.at(-1).sql, 'COMMIT'); assert.equal(h.releases.length, 1); assert.equal(h.acquired(), 1);
});
test('independent owner: late pool acquisition closes owned lease without BEGIN', async () => {
  const h = database({ lateConnect: true }); await assert.rejects(h.owner.claim(h.b, h.check));
  assert.equal(h.queries.length, 0); assert.equal(h.releases.length, 1); assert.ok(h.releases[0] instanceof Error);
});
for (const after of ['BEGIN', "SET LOCAL statement_timeout = '5s'", "SET LOCAL lock_timeout = '2s'", 'SELECT pg_advisory_xact_lock', 'SELECT intent_id', 'INSERT INTO meri_schedules.projections', 'INSERT INTO meri_schedules.intents']) {
  test(`independent owner: expiry after ${after} allows only rollback cleanup`, async () => {
    const h = database({ query(sql, _args, controls) { if (sql.startsWith(after)) controls.expire(); } });
    await assert.rejects(h.owner.claim(h.b, h.check));
    const index = h.queries.findIndex(v => v.sql.startsWith(after)); assert.ok(index >= 0);
    assert.deepEqual(h.queries.slice(index + 1).map(v => v.sql), ['ROLLBACK']);
    assert.equal(h.releases.length, 1);
  });
}
test('independent owner: late successful commit stays uncertain with no rollback or replay', async () => {
  const h = database({ query(sql, _args, controls) { if (sql === 'COMMIT') controls.expire(); } });
  await assert.rejects(h.owner.claim(h.b, h.check)); assert.equal(h.queries.at(-1).sql, 'COMMIT'); assert.equal(h.acquired(), 1);
});
test('independent owner: tenant and owner list filtering are SQL-bound and output detached', async () => {
  const p = projection(); const h = database({ rows: [{ projection: p, generation: '4', active_intent: 'unresolved' }] });
  const s = { operation: 'list_scheduled_tasks', owner: p.owner, afterScheduleId: null, limit: 2, historyLimit: 0 };
  const out = await h.owner.list(s, h.check); assert.equal(out.rows[0].generation, 4); assert.equal(out.rows[0].unresolved, true);
  const q = h.queries.find(v => v.sql.startsWith('SELECT projection,generation'));
  assert.deepEqual(q.args, ['tenant-a', 'owner-a', null, 3]); assert.match(q.sql, /tenant_id=\$1 AND owner_actor_id=\$2/);
  p.owner.actorId = 'changed'; assert.equal(out.rows[0].projection.owner.actorId, 'owner-a');
});
